"""Phase 3 PostGIS adoption checkpoint (master plan §8.4).

Read-only, deterministic, no network calls. Measures the four §8.4 adoption
triggers at current scale and reports a stay/adopt recommendation — it never
installs PostGIS itself; adoption is a separate, owner-approved infra change
regardless of what this command reports.
"""

import json
import statistics
import time

from django.core.management.base import BaseCommand
from django.db import connection, transaction

from apps.reference.models import (
    ActivityMaster, Airport, AttractionMaster, BusStation, City, HotelMaster,
    RailwayStation, RestaurantMaster,
)
from apps.reference.services.geo import bbox_prefilter, nearest
from apps.reference.services.provenance import publishable

PUBLISHABLE_MODELS = (City, Airport, RailwayStation, BusStation, HotelMaster, RestaurantMaster, AttractionMaster, ActivityMaster)

# §8.4 adoption triggers.
TRIGGER_ENTITY_COUNT = 500_000
TRIGGER_P95_MS = 150.0
TRIGGER_BBOX_CANDIDATES = 5_000

BENCHMARK_CENTERS = (
    ("Delhi", 28.6139, 77.2090, 80),
    ("Mumbai", 19.0760, 72.8777, 80),
    ("Bengaluru", 12.9716, 77.5946, 80),
)


def _percentile(values, fraction):
    ordered = sorted(values)
    if not ordered:
        return 0.0
    index = min(len(ordered) - 1, max(0, int(round((len(ordered) - 1) * fraction))))
    return round(ordered[index], 3)


class Command(BaseCommand):
    help = "PostGIS adoption checkpoint (§8.4) — read-only, no network."

    def add_arguments(self, parser):
        parser.add_argument("--json", action="store_true")

    def handle(self, *args, **options):
        publishable_counts = {model._meta.label: publishable(model.objects.all()).count() for model in PUBLISHABLE_MODELS}
        total_publishable = sum(publishable_counts.values())

        per_center = []
        all_timings = []
        all_bbox_sizes = []
        for label, lat, lng, radius_km in BENCHMARK_CENTERS:
            bbox_qs = bbox_prefilter(RailwayStation.objects.all(), lat, lng, radius_km)
            bbox_count = bbox_qs.count()
            all_bbox_sizes.append(bbox_count)

            for _ in range(3):
                nearest(RailwayStation.objects.all(), lat, lng, radius_km, limit=20)
            timings = []
            for _ in range(30):
                started = time.perf_counter()
                nearest(RailwayStation.objects.all(), lat, lng, radius_km, limit=20)
                timings.append((time.perf_counter() - started) * 1000)
            all_timings.extend(timings)

            with transaction.atomic():
                explain_plan = bbox_qs.explain()

            per_center.append({
                "center": label,
                "radius_km": radius_km,
                "bbox_candidates": bbox_count,
                "median_ms": round(statistics.median(timings), 3),
                "p95_ms": _percentile(timings, 0.95),
                "uses_coordinate_index": "ref_rail_lat_lon_idx" in explain_plan,
            })

        overall_p95 = _percentile(all_timings, 0.95)
        max_bbox = max(all_bbox_sizes) if all_bbox_sizes else 0

        triggers = {
            "entity_count_over_500k": total_publishable > TRIGGER_ENTITY_COUNT,
            "p95_over_150ms": overall_p95 > TRIGGER_P95_MS,
            "bbox_routinely_over_5000": max_bbox > TRIGGER_BBOX_CANDIDATES,
            "polygon_or_geometry_feature_approved": False,  # product decision, not measurable here
        }
        any_trigger = any(triggers.values())

        report = {
            "publishable_entity_counts": publishable_counts,
            "total_publishable_point_entities": total_publishable,
            "per_center_benchmarks": per_center,
            "overall_p95_ms": overall_p95,
            "max_bbox_candidates_seen": max_bbox,
            "adoption_triggers": triggers,
            "recommendation": "adopt" if any_trigger else "defer",
            "note": (
                "This command reports the checkpoint only; PostGIS adoption itself "
                "requires a separate, owner-approved infra change regardless of the "
                "recommendation above."
            ),
        }

        if options["json"]:
            self.stdout.write(json.dumps(report, indent=2, sort_keys=True))
        else:
            self.stdout.write(self.style.SUCCESS(json.dumps(report, indent=2)))
