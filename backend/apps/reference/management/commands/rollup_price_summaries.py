"""Phase 5 rollup (docs/plans/reference-foundation-and-planner-intelligence-
master-plan.md §10.1 class 3, §10.4): quantile (p25/median/p75) TravelPriceSummary
rows computed from TravelPriceObservation. Near-zero observation volume today
means most groups will have a tiny sample_count — recorded honestly (and
reflected in a deliberately low ``confidence``), not padded to look mature.

Known limitation, not fixed this phase (TravelPriceSummary predates Phase 5 and
changing its schema is out of this pass's scope): ``month`` has no paired
``year`` field, so observations from the same calendar month in different
years collapse into one summary row. Acceptable at today's volume; flagged
for whoever adds real seasonal history.
"""

import json
import statistics
from collections import defaultdict
from datetime import date, timedelta

from django.core.management.base import BaseCommand

from apps.reference.models import TravelPriceObservation, TravelPriceSummary


def _city_pair(obs):
    """(origin_city, destination_city) for one observation, or None if the
    observation's route/hotel/city FK never resolved (fuzzy-match miss)."""
    if obs.service_type == "flight" and obs.airport_route_id:
        r = obs.airport_route
        return (getattr(r.source, "city", None), getattr(r.destination, "city", None))
    if obs.service_type == "train" and obs.train_route_id:
        r = obs.train_route
        return (getattr(r.source, "city", None), getattr(r.destination, "city", None))
    if obs.service_type == "bus" and obs.bus_route_id:
        r = obs.bus_route
        return (getattr(r.source, "city", None), getattr(r.destination, "city", None))
    if obs.service_type == "hotel" and obs.hotel_id:
        return (None, getattr(obs.hotel, "city", None))
    if obs.service_type == "cab" and obs.city_id:
        return (obs.city, None)
    return None


class Command(BaseCommand):
    help = "Roll up TravelPriceObservation rows into TravelPriceSummary quantiles."

    def add_arguments(self, parser):
        parser.add_argument("--json", action="store_true")
        parser.add_argument(
            "--window-days", type=int, default=180,
            help="Only consider observations from the last N days.",
        )

    def handle(self, *args, **options):
        window_start = date.today() - timedelta(days=options["window_days"])
        observations = TravelPriceObservation.objects.filter(
            observed_date__gte=window_start
        ).select_related(
            "airport_route__source__city", "airport_route__destination__city",
            "train_route__source__city", "train_route__destination__city",
            "bus_route__source__city", "bus_route__destination__city",
            "hotel__city", "city",
        )
        total = observations.count()

        groups = defaultdict(list)
        skipped_unresolved = 0
        for obs in observations:
            pair = _city_pair(obs)
            if pair is None or (pair[0] is None and pair[1] is None):
                skipped_unresolved += 1
                continue
            origin_city, destination_city = pair
            key = (
                obs.service_type,
                getattr(origin_city, "id", None),
                getattr(destination_city, "id", None),
                obs.observed_date.month,
            )
            groups[key].append(float(obs.price))

        created, updated = 0, 0
        for (service_type, origin_id, dest_id, month), prices in groups.items():
            prices.sort()
            n = len(prices)
            median = statistics.median(prices)
            p25 = prices[int(n * 0.25)]
            p75 = prices[min(int(n * 0.75), n - 1)]
            defaults = {
                "median_price": round(median, 2),
                "p25_price": round(p25, 2),
                "p75_price": round(p75, 2),
                "sample_count": n,
                "observation_period_start": window_start,
                "observation_period_end": date.today(),
                # Honestly low until real volume exists — never inflated to
                # look mature (§10.5's calibration rule: confidence maps to
                # measured coverage, not to how confident we'd like to sound).
                "confidence": round(min(0.9, 0.2 + 0.05 * n), 2),
            }
            obj, was_created = TravelPriceSummary.objects.update_or_create(
                service_type=service_type, origin_city_id=origin_id,
                destination_city_id=dest_id, month=month, defaults=defaults,
            )
            created += int(was_created)
            updated += int(not was_created)

        result = {
            "total_observations_in_window": total,
            "groups_summarized": len(groups),
            "summaries_created": created,
            "summaries_updated": updated,
            "observations_skipped_unresolved_fk": skipped_unresolved,
        }
        if options["json"]:
            self.stdout.write(json.dumps(result, indent=2, sort_keys=True))
        else:
            self.stdout.write(self.style.SUCCESS(
                f"{total} observations -> {len(groups)} groups "
                f"(created={created} updated={updated}, "
                f"{skipped_unresolved} skipped: no resolved city)"
            ))
