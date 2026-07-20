"""Read-only Phase 0 baseline capture. This script never calls external APIs."""

from __future__ import annotations

import json
import os
import statistics
import sys
import time
from pathlib import Path


REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
BACKEND_ROOT = REPOSITORY_ROOT / "backend"
sys.path.insert(0, str(BACKEND_ROOT))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")

import django  # noqa: E402

django.setup()

from django.apps import apps  # noqa: E402
from django.db.models import Q  # noqa: E402

from apps.planner.models import PlanGenerationJob  # noqa: E402
from apps.reference.models import (  # noqa: E402
    AirportRoute,
    AirportServiceArea,
    BusRoute,
    BusStationServiceArea,
    City,
    RailwayStation,
    RailwayStationServiceArea,
    TrainRoute,
    TravelPriceHistory,
)


def model_counts(app_label):
    counts = {}
    for model in apps.get_app_config(app_label).get_models():
        counts[model._meta.db_table] = model.objects.count()
    return dict(sorted(counts.items()))


def percentile(values, fraction):
    if not values:
        return None
    ordered = sorted(values)
    index = min(len(ordered) - 1, max(0, int(round((len(ordered) - 1) * fraction))))
    return round(ordered[index], 3)


def benchmark_queryset(factory, runs=25):
    samples = []
    for _ in range(runs):
        started = time.perf_counter()
        list(factory())
        samples.append((time.perf_counter() - started) * 1000)
    return {
        "runs": runs,
        "median_ms": round(statistics.median(samples), 3),
        "p95_ms": percentile(samples, 0.95),
        "max_ms": round(max(samples), 3),
    }


def route_baseline():
    route_models = (AirportRoute, TrainRoute, BusRoute)
    for model in route_models:
        route = model.objects.only("source_id", "destination_id").first()
        if route:
            return {
                "model": model._meta.label,
                **benchmark_queryset(
                    lambda: model.objects.filter(
                        source_id=route.source_id,
                        destination_id=route.destination_id,
                    ).values_list("id", flat=True)[:20]
                ),
            }
    return {"model": None, "runs": 0, "reason": "no route rows"}


def nearby_hub_baseline():
    service_models = (
        RailwayStationServiceArea,
        AirportServiceArea,
        BusStationServiceArea,
    )
    for model in service_models:
        row = model.objects.only("city_id").first()
        if row:
            return {
                "model": model._meta.label,
                **benchmark_queryset(
                    lambda: model.objects.filter(city_id=row.city_id)
                    .values_list("id", flat=True)[:20]
                ),
            }
    return {"model": None, "runs": 0, "reason": "no service-area rows"}


def external_call_baseline():
    rows = []
    for usage in PlanGenerationJob.objects.order_by("-created_at").values_list("usage", flat=True)[:50]:
        if not isinstance(usage, dict):
            continue
        rows.append({
            "ai_calls": usage.get("ai_calls"),
            "provider_calls": usage.get("provider_calls"),
            "external_calls": usage.get("external_calls"),
        })
    return {"jobs_sampled": len(rows), "usage": rows}


def main():
    poison_filter = Q(provenance_tier="verified", price__in=[850, 1500, 5000])
    report = {
        "repository_root": str(REPOSITORY_ROOT),
        "table_counts": {
            label: model_counts(label) for label in ("reference", "knowledge", "planner")
        },
        "coordinates": {
            "cities_total": City.objects.count(),
            "cities_missing": City.objects.filter(
                Q(latitude__isnull=True) | Q(longitude__isnull=True)
            ).count(),
            "cities_at_india_centroid": City.objects.filter(
                latitude=20.5937, longitude=78.9629
            ).count(),
            "railway_stations_total": RailwayStation.objects.count(),
            "railway_stations_missing": RailwayStation.objects.filter(
                Q(latitude__isnull=True) | Q(longitude__isnull=True)
            ).count(),
        },
        "likely_poisoned_price_history": {
            "signature": "verified tier and exact price in [850, 1500, 5000]",
            "count": TravelPriceHistory.objects.filter(poison_filter).count(),
        },
        "performance": {
            "direct_route_lookup": route_baseline(),
            "nearby_hub_lookup": nearby_hub_baseline(),
        },
        "external_calls_per_generation": external_call_baseline(),
    }
    print(json.dumps(report, indent=2, default=str))


if __name__ == "__main__":
    main()
