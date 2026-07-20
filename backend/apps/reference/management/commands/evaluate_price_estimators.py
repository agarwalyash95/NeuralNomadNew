"""Phase 5 offline evaluator (docs/plans/reference-foundation-and-planner-
intelligence-master-plan.md §10.5): a deterministic, free, holdout-based
backtest of the ladder's *statistical* rung (class 3, the same city-segment
quantile method ``rollup_price_summaries``/``price_estimator``'s benchmark
path uses) — not the FareRule rate-card formulas (classes 1/2), which are
deterministic parameters, not fitted predictions, and so aren't the kind of
thing a holdout/MAE backtest evaluates.

Holdout = most recent 20% of each category's observations. A category with
fewer than ``--min-observations`` (default 10) reports ``cold_start`` and no
metrics — the honest state at this phase's real data volume, not a bug.
"""

import json
import statistics
from collections import defaultdict

from django.core.management.base import BaseCommand

from apps.reference.models import TravelPriceObservation


def _city_pair(obs):
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


def _pinball_loss(actual, predicted, quantile):
    diff = actual - predicted
    return max(quantile * diff, (quantile - 1) * diff)


class Command(BaseCommand):
    help = "Offline holdout evaluation of the price-estimation ladder's benchmark method (§10.5)."

    def add_arguments(self, parser):
        parser.add_argument("--json", action="store_true")
        parser.add_argument("--min-observations", type=int, default=10)

    def handle(self, *args, **options):
        min_obs = options["min_observations"]

        by_category = defaultdict(list)
        observations = TravelPriceObservation.objects.all().select_related(
            "airport_route__source__city", "airport_route__destination__city",
            "train_route__source__city", "train_route__destination__city",
            "bus_route__source__city", "bus_route__destination__city",
            "hotel__city", "city",
        ).order_by("observed_date")
        for obs in observations:
            pair = _city_pair(obs)
            key_city = (getattr(pair[0], "id", None), getattr(pair[1], "id", None)) if pair else (None, None)
            by_category[obs.service_type].append((float(obs.price), key_city))

        report = {}
        for category, rows in by_category.items():
            n = len(rows)
            if n < min_obs:
                report[category] = {
                    "status": "cold_start",
                    "sample_count": n,
                    "note": f"fewer than {min_obs} observations — no holdout split attempted.",
                }
                continue

            split = int(n * 0.8)
            train, holdout = rows[:split], rows[split:]
            train_by_city = defaultdict(list)
            for price, key_city in train:
                train_by_city[key_city].append(price)

            errors, pinball_25, pinball_50, pinball_75, covered, evaluated = [], [], [], [], 0, 0
            for actual, key_city in holdout:
                prices = sorted(train_by_city.get(key_city) or [])
                if not prices:
                    continue  # this holdout row's segment never appeared in train — cold-start per segment
                evaluated += 1
                m = len(prices)
                median = statistics.median(prices)
                p25 = prices[int(m * 0.25)]
                p75 = prices[min(int(m * 0.75), m - 1)]
                errors.append(abs(actual - median))
                pinball_25.append(_pinball_loss(actual, p25, 0.25))
                pinball_50.append(_pinball_loss(actual, median, 0.5))
                pinball_75.append(_pinball_loss(actual, p75, 0.75))
                if p25 <= actual <= p75:
                    covered += 1

            if evaluated == 0:
                report[category] = {
                    "status": "insufficient_overlap",
                    "sample_count": n,
                    "note": "every holdout row's city segment was absent from the train split — a per-segment cold start, not a global data shortage.",
                }
                continue

            holdout_prices = [a for a, _ in holdout]
            wape = (sum(errors) / sum(abs(p) for p in holdout_prices[:evaluated])) if any(holdout_prices[:evaluated]) else None
            report[category] = {
                "status": "evaluated",
                "sample_count": n,
                "holdout_size": len(holdout),
                "evaluated_count": evaluated,
                "mae": round(statistics.mean(errors), 2),
                "median_ae": round(statistics.median(errors), 2),
                "wape": round(wape, 4) if wape is not None else None,
                "pinball_loss_q25": round(statistics.mean(pinball_25), 2),
                "pinball_loss_q50": round(statistics.mean(pinball_50), 2),
                "pinball_loss_q75": round(statistics.mean(pinball_75), 2),
                "interval_coverage_p25_p75": round(covered / evaluated, 3),
                "note": "coverage is against the train split's [p25,p75] band (~50% by construction), not the spec's 80% [min,max] target — reported honestly rather than relabeled to look like a pass/fail against that target.",
            }

        cold_start_categories = [c for c, r in report.items() if r["status"] != "evaluated"]
        if options["json"]:
            self.stdout.write(json.dumps(report, indent=2, sort_keys=True))
        else:
            for category, r in sorted(report.items()):
                self.stdout.write(f"[{category}] {r['status']} (n={r['sample_count']})")
                if r["status"] == "evaluated":
                    self.stdout.write(
                        f"    MAE={r['mae']} median_AE={r['median_ae']} WAPE={r['wape']} "
                        f"pinball(q25/50/75)={r['pinball_loss_q25']}/{r['pinball_loss_q50']}/{r['pinball_loss_q75']} "
                        f"coverage={r['interval_coverage_p25_p75']}"
                    )
            if cold_start_categories:
                self.stdout.write(self.style.WARNING(
                    f"cold-start / no metrics for: {', '.join(cold_start_categories)} "
                    "(expected at this phase's data volume, not a failure)."
                ))
