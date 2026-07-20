"""Phase 3 completeness recompute (master plan §14 Phase 3).

``EnrichmentMixin.data_completeness_score`` exists on all four master tables
but had zero writers anywhere in the tree before this command (confirmed by
grep) — every row silently carried the field's ``default=0.0``, and the one
reader (``plan_generation.py``) falls back to a flat 0.75 confidence whenever
the score is falsy. This command is that first real writer.

Score = fraction of a fixed 9-signal checklist present on the row, including
the two signals this phase's imports newly make possible: whether the row's
city carries a ``geonameid`` and whether it has at least one ``CityAlias``.
"""

import json

from django.core.management.base import BaseCommand

from apps.reference.models import ActivityMaster, AttractionMaster, HotelMaster, RestaurantMaster
from apps.reference.services.geo import valid_coordinates

PRICE_FIELD = {
    HotelMaster: "price_range",
    RestaurantMaster: "price_range",
    AttractionMaster: "ticket_price_estimate",
    ActivityMaster: "price_estimate",
}
MODEL_LABELS = {
    HotelMaster: "hotels", RestaurantMaster: "restaurants",
    AttractionMaster: "attractions", ActivityMaster: "activities",
}


def _score(row, price_field):
    signals = [
        bool(str(row.address or "").strip()),
        bool(str(row.image_url or "").strip()),
        valid_coordinates(row.latitude, row.longitude),
        bool(str(row.editorial_summary or "").strip()),
        bool(row.opening_hours),
        row.user_rating is not None,
        bool(str(getattr(row, price_field, "") or "").strip() or getattr(row, price_field, None)),
        bool(row.city_id and row.city.geonameid),
        bool(row.city_id and row.city.aliases.exists()),
    ]
    return round(sum(1 for s in signals if s) / len(signals), 4)


class Command(BaseCommand):
    help = "Recompute data_completeness_score on the four master tables (dry-run by default)."

    def add_arguments(self, parser):
        mode = parser.add_mutually_exclusive_group()
        mode.add_argument("--apply", action="store_true")
        mode.add_argument("--dry-run", action="store_true")
        parser.add_argument("--json", action="store_true")

    def handle(self, *args, **options):
        apply_mode = bool(options["apply"])
        metrics = {"mode": "apply" if apply_mode else "dry_run"}

        for model, price_field in PRICE_FIELD.items():
            label = MODEL_LABELS[model]
            rows = list(model.objects.select_related("city").all())
            changed = 0
            deltas = []
            for row in rows:
                new_score = _score(row, price_field)
                if abs(new_score - (row.data_completeness_score or 0.0)) > 1e-6:
                    changed += 1
                    deltas.append(round(new_score - (row.data_completeness_score or 0.0), 4))
                    if apply_mode:
                        row.data_completeness_score = new_score
            if apply_mode:
                model.objects.bulk_update(rows, ["data_completeness_score"], batch_size=1000)
            metrics[label] = {
                "total": len(rows),
                "changed": changed,
                "mean_delta": round(sum(deltas) / len(deltas), 4) if deltas else 0.0,
            }

        if options["json"]:
            self.stdout.write(json.dumps(metrics, indent=2, sort_keys=True))
        else:
            self.stdout.write(self.style.SUCCESS(json.dumps(metrics, indent=2)))
