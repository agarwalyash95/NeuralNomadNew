"""Phase 6: idempotent seed of `CategoryVocabularyMap`.

Investigation while building this command found the master plan's premise
("Google-types->our-category mappings places_explore.py's field mappers
already hardcode inline") only half holds: `places_explore.py`'s mappers
store Google's raw `primaryType` string directly as `category`/`primary_type`
with **no normalization at all** today — there's no rich Google-subtype ->
our-vocab dict to port. What genuinely exists and anchors real code is the
request-side `included_type` filter per entity in `_category_config()`
(lodging/restaurant/tourist_attraction) — those are seeded here as the
`google` rows. Building out a full canonical taxonomy for Google's hundreds
of place subtypes with no current consumer would be speculative, not a real
mapping — not attempted. The `osm` rows are the ones this phase's own
`import_osm_places` command actually dispatches on.
"""

import json

from django.core.management.base import BaseCommand

from apps.reference.models import CategoryVocabularyMap


ROWS = [
    # Google Places `includedType` request filters (apps/reference/services
    # /places_explore.py::_category_config) — the only real Google-side
    # category anchor that exists in the codebase today.
    {"source_system": "google", "entity_type": "hotel", "source_value": "lodging", "canonical_category": "hotel"},
    {"source_system": "google", "entity_type": "restaurant", "source_value": "restaurant", "canonical_category": "restaurant"},
    {"source_system": "google", "entity_type": "attraction", "source_value": "tourist_attraction", "canonical_category": "attraction"},

    # OSM tags this phase's import_osm_places command actually queries/dispatches on.
    {"source_system": "osm", "entity_type": "hotel", "source_value": "tourism=hotel", "canonical_category": "hotel"},
    {"source_system": "osm", "entity_type": "hotel", "source_value": "tourism=guest_house", "canonical_category": "hotel"},
    {"source_system": "osm", "entity_type": "attraction", "source_value": "tourism=attraction", "canonical_category": "attraction"},
    {"source_system": "osm", "entity_type": "attraction", "source_value": "tourism=museum", "canonical_category": "museum"},
    {"source_system": "osm", "entity_type": "attraction", "source_value": "tourism=viewpoint", "canonical_category": "viewpoint"},
    {"source_system": "osm", "entity_type": "restaurant", "source_value": "amenity=restaurant", "canonical_category": "restaurant"},
    {"source_system": "osm", "entity_type": "restaurant", "source_value": "amenity=cafe", "canonical_category": "cafe"},
    {"source_system": "osm", "entity_type": "restaurant", "source_value": "amenity=fast_food", "canonical_category": "fast_food"},
]


class Command(BaseCommand):
    help = "Idempotently seed the Phase 6 CategoryVocabularyMap rows."

    def add_arguments(self, parser):
        parser.add_argument("--json", action="store_true")

    def handle(self, *args, **options):
        results = {"created": [], "updated": [], "unchanged": []}
        for spec in ROWS:
            lookup = {k: spec[k] for k in ("source_system", "entity_type", "source_value")}
            obj, created = CategoryVocabularyMap.objects.get_or_create(
                **lookup, defaults={"canonical_category": spec["canonical_category"]},
            )
            label = f"{spec['source_system']}:{spec['source_value']}"
            if created:
                results["created"].append(label)
            elif obj.canonical_category != spec["canonical_category"]:
                obj.canonical_category = spec["canonical_category"]
                obj.save()
                results["updated"].append(label)
            else:
                results["unchanged"].append(label)

        if options["json"]:
            self.stdout.write(json.dumps(results, indent=2, sort_keys=True))
        else:
            self.stdout.write(self.style.SUCCESS(
                f"created={len(results['created'])} updated={len(results['updated'])} "
                f"unchanged={len(results['unchanged'])}"
            ))
