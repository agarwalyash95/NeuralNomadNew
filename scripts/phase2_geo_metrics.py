"""Read-only Phase 2 geospatial acceptance metrics; never calls external APIs."""

from __future__ import annotations

import io
import json
import os
import statistics
import sys
import time
from collections import Counter
from pathlib import Path


REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
BACKEND_ROOT = REPOSITORY_ROOT / "backend"
sys.path.insert(0, str(BACKEND_ROOT))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")

import django  # noqa: E402

django.setup()

from django.core.management import call_command  # noqa: E402
from django.db import connection, transaction  # noqa: E402
from django.db.models import Q  # noqa: E402

from apps.reference.models import (  # noqa: E402
    ActivityMaster,
    Airport,
    AttractionMaster,
    BusStation,
    City,
    HotelMaster,
    RailwayStation,
    RestaurantMaster,
)
from apps.reference.services.geo import bbox_prefilter, nearest  # noqa: E402
from apps.reference.services.provenance import publishable  # noqa: E402


EXPECTED_INDEXES = {
    City: "ref_city_lat_lon_idx",
    Airport: "ref_airport_lat_lon_idx",
    RailwayStation: "ref_rail_lat_lon_idx",
    BusStation: "ref_bus_lat_lon_idx",
    HotelMaster: "ref_hotel_lat_lon_idx",
    RestaurantMaster: "ref_rest_lat_lon_idx",
    AttractionMaster: "ref_attr_lat_lon_idx",
    ActivityMaster: "ref_act_lat_lon_idx",
}


def percentile(values, fraction):
    ordered = sorted(values)
    index = min(len(ordered) - 1, max(0, int(round((len(ordered) - 1) * fraction))))
    return round(ordered[index], 3)


def main():
    audit_output = io.StringIO()
    call_command("audit_reference_data", json=True, details=True, stdout=audit_output)
    detailed_audit = json.loads(audit_output.getvalue())
    reason_rows = detailed_audit["coverage_reports"]["9_non_publishable_entities"]["rows"]
    reasons = Counter(reason for row in reason_rows for reason in row["reasons"])

    center = (28.6139, 77.2090)
    radius_km = 80
    bbox_queryset = bbox_prefilter(RailwayStation.objects.all(), *center, radius_km)
    default_explain = bbox_queryset.explain()
    with transaction.atomic():
        with connection.cursor() as cursor:
            cursor.execute("SET LOCAL enable_seqscan=off")
        diagnostic_explain = bbox_queryset.explain()

    # Diagnostic only: the contractual p95 uses the Phase 0 service-area
    # workload in baseline_metrics.py. This fallback measurement accompanies
    # the required index plan and is not substituted for that baseline.
    for _ in range(5):
        nearest(RailwayStation.objects.all(), *center, radius_km, limit=20)
    timings = []
    result_count = 0
    for _ in range(100):
        started = time.perf_counter()
        results = nearest(RailwayStation.objects.all(), *center, radius_km, limit=20)
        timings.append((time.perf_counter() - started) * 1000)
        result_count = len(results)

    found_indexes = {}
    with connection.cursor() as cursor:
        for model, expected_name in EXPECTED_INDEXES.items():
            constraints = connection.introspection.get_constraints(cursor, model._meta.db_table)
            found_indexes[expected_name] = expected_name in constraints

    station_total = RailwayStation.objects.count()
    station_complete = RailwayStation.objects.exclude(
        Q(latitude__isnull=True) | Q(longitude__isnull=True)
    ).count()
    report = {
        "schema": {
            "expected_coordinate_indexes": found_indexes,
            "all_expected_indexes_present": all(found_indexes.values()),
        },
        "coordinates": {
            "cities_total": City.objects.count(),
            "cities_publishable": City.objects.filter(is_publishable=True).count(),
            "cities_missing": City.objects.filter(
                Q(latitude__isnull=True) | Q(longitude__isnull=True)
            ).count(),
            "cities_at_placeholder": City.objects.filter(
                latitude=20.5937, longitude=78.9629
            ).count(),
            "publishable_placeholder_cities": City.objects.filter(
                is_publishable=True, latitude=20.5937, longitude=78.9629
            ).count(),
            "railway_stations_total": station_total,
            "railway_stations_complete": station_complete,
            "railway_coordinate_coverage": round(station_complete / max(station_total, 1), 6),
        },
        "publishable_counts": {
            model._meta.label: publishable(model.objects.all()).count()
            for model in EXPECTED_INDEXES
        },
        "reports": {
            "non_publishable_rows": len(reason_rows),
            "reason_counts": dict(sorted(reasons.items())),
            "per_state_report_present": bool(
                detailed_audit["coverage_reports"]["1_missing_coordinates"]["by_state"]
            ),
        },
        "nearest_railway_stations": {
            "center": center,
            "radius_km": radius_km,
            "bbox_candidates": bbox_queryset.count(),
            "returned": result_count,
            "measurement_role": "diagnostic fallback; contractual p95 is baseline_metrics nearby_hub_lookup",
            "runs": len(timings),
            "median_ms": round(statistics.median(timings), 3),
            "p95_ms": percentile(timings, 0.95),
            "max_ms": round(max(timings), 3),
            "default_explain": default_explain,
            "diagnostic_index_explain": diagnostic_explain,
            "diagnostic_uses_coordinate_index": "ref_rail_lat_lon_idx" in diagnostic_explain,
        },
        "paid_api_calls": 0,
    }
    print(json.dumps(report, indent=2, default=str))


if __name__ == "__main__":
    main()
