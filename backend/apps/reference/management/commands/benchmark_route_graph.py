"""Phase 8 (§14 P8) — `route_graph.search()` timing pass. Phase 4's own
verification report explicitly deferred this: "`route_graph.search()` p95
not formally benchmarked in isolation this session... a dedicated
`EXPLAIN`/timing pass is recommended before Phase 8 integration." This is
that pass.

Read-only, deterministic, no network calls, no paid API. Measures real
wall-clock latency of `route_graph.search()` across real city pairs (the
same "top-N population cities" convention every prior phase's benchmarks
use — see `benchmark_geo_queries.py`), reports p50/p95/p99, and is evidence
for the owner's eventual `PLANNER_ROUTE_GRAPH_ENABLED` decision — it does
not flip that flag itself.
"""

import json
import time

from django.core.management.base import BaseCommand

from apps.reference.models import City
from apps.reference.services.route_graph import search

DEFAULT_TOP_N_CITIES = 15


def _percentile(values, fraction):
    ordered = sorted(values)
    if not ordered:
        return 0.0
    index = min(len(ordered) - 1, max(0, int(round((len(ordered) - 1) * fraction))))
    return round(ordered[index], 2)


class Command(BaseCommand):
    help = "route_graph.search() wall-clock timing pass across real city pairs (read-only, no network)."

    def add_arguments(self, parser):
        parser.add_argument("--top-n-cities", type=int, default=DEFAULT_TOP_N_CITIES)
        parser.add_argument("--pairs", type=int, default=30, help="Number of city pairs to sample.")
        parser.add_argument("--json", action="store_true")

    def handle(self, *args, **options):
        top_n = options["top_n_cities"]
        n_pairs = options["pairs"]

        cities = list(
            City.objects.filter(population__isnull=False, latitude__isnull=False, longitude__isnull=False)
            .order_by("-population")[:top_n]
        )
        if len(cities) < 2:
            self.stdout.write(self.style.WARNING("Fewer than 2 publishable cities with population data — nothing to benchmark."))
            return

        pairs = []
        for i, origin in enumerate(cities):
            for destination in cities[i + 1:]:
                pairs.append((origin, destination))
                if len(pairs) >= n_pairs:
                    break
            if len(pairs) >= n_pairs:
                break

        timings_ms = []
        per_pair = []
        errors = 0
        for origin, destination in pairs:
            start = time.perf_counter()
            try:
                result = search(origin, destination)
                option_count = len(result.get("options") or result.get("all_options") or []) if isinstance(result, dict) else None
            except Exception as exc:
                errors += 1
                per_pair.append({"origin": origin.name, "destination": destination.name, "error": str(exc)})
                continue
            elapsed_ms = (time.perf_counter() - start) * 1000
            timings_ms.append(elapsed_ms)
            per_pair.append({
                "origin": origin.name, "destination": destination.name,
                "elapsed_ms": round(elapsed_ms, 2), "option_count": option_count,
            })

        report = {
            "cities_considered": len(cities),
            "pairs_attempted": len(pairs),
            "pairs_succeeded": len(timings_ms),
            "pairs_errored": errors,
            "p50_ms": _percentile(timings_ms, 0.50),
            "p95_ms": _percentile(timings_ms, 0.95),
            "p99_ms": _percentile(timings_ms, 0.99),
            "min_ms": round(min(timings_ms), 2) if timings_ms else None,
            "max_ms": round(max(timings_ms), 2) if timings_ms else None,
            "per_pair": per_pair,
        }

        if options["json"]:
            self.stdout.write(json.dumps(report, indent=2, sort_keys=True))
        else:
            self.stdout.write(self.style.SUCCESS(
                f"{len(timings_ms)}/{len(pairs)} pairs succeeded — "
                f"p50={report['p50_ms']}ms p95={report['p95_ms']}ms p99={report['p99_ms']}ms "
                f"(min={report['min_ms']}ms max={report['max_ms']}ms)"
            ))
