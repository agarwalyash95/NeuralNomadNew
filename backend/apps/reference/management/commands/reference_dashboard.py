"""Phase 9 (§14 P9) — one-payload data-quality + performance dashboard.

Aggregates every existing standalone report/benchmark command already built
across Phases 3-8 (`audit_reference_data`, `benchmark_geo_queries`,
`evaluate_price_estimators`, `recompute_completeness`) plus a new
cross-job aggregation of `PlanGenerationJob.usage` (the field already exists
and already tracks per-job `ai_calls`/`provider_calls`/`tokens`/`ceilings` —
this closes the "observability counters" gap without adding new
instrumentation, just reading what already gets written) and a real
`EXPLAIN` pass on the four query shapes the master plan names (route-lookup/
ServiceArea-by-city, ProviderEntityMap lookup, observation rollups).

Every sub-report this command calls is read-only by default (dry-run where
that's a concept at all) — this command itself never mutates data.
"""

import io
import json

from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.db import connection


def _call_json(command_name, *args):
    """Invoke another management command with --json, capture and parse its
    stdout. Never raises — a failing sub-report degrades to an error string
    in its own section rather than taking down the whole dashboard."""
    out = io.StringIO()
    try:
        call_command(command_name, *args, "--json", stdout=out)
        return json.loads(out.getvalue())
    except Exception as exc:
        return {"error": f"{command_name} failed: {exc}"}


def _explain_section():
    """Real EXPLAIN output (never fabricated) for the four query shapes the
    master plan names by name. ``route_graph.search()`` is a Python
    orchestration function, not one query — its own dominant real query is
    the ServiceArea-by-city hub-candidate lookup (route_graph.py's
    ``_candidate_hubs``), used here for both that row and the "route lookup"
    row since they are, in fact, the same query shape."""
    from apps.reference.models import ProviderEntityMap, RailwayStationServiceArea, TravelPriceObservation

    section = {}
    try:
        city = RailwayStationServiceArea.objects.select_related("city").first()
        city = city.city if city else None
        if city:
            qs = (
                RailwayStationServiceArea.objects.filter(city=city)
                .select_related("station")
                .order_by("-is_primary_hub", "distance_km")
            )
            section["route_lookup_and_service_area_by_city"] = qs.explain()
        else:
            section["route_lookup_and_service_area_by_city"] = "no RailwayStationServiceArea rows to EXPLAIN against"
    except Exception as exc:
        section["route_lookup_and_service_area_by_city"] = f"EXPLAIN failed: {exc}"

    try:
        sample = ProviderEntityMap.objects.first()
        if sample:
            qs = ProviderEntityMap.objects.filter(source=sample.source, external_id=sample.external_id)
            section["provider_entity_map_lookup"] = qs.explain()
        else:
            section["provider_entity_map_lookup"] = "no ProviderEntityMap rows to EXPLAIN against"
    except Exception as exc:
        section["provider_entity_map_lookup"] = f"EXPLAIN failed: {exc}"

    try:
        qs = TravelPriceObservation.objects.filter(service_type="cab").order_by("observed_date")
        section["observation_rollup"] = qs.explain()
    except Exception as exc:
        section["observation_rollup"] = f"EXPLAIN failed: {exc}"

    return section


def _usage_counters_section():
    """Cross-job aggregation of PlanGenerationJob.usage. PlanGenerationJob is
    a planner model — reference must not import apps.planner directly
    (D-004) — so the actual aggregation lives in the planner-owned
    `generation_usage_summary` command and this just calls it via
    `call_command`, the same funnel `_call_json` uses for every other
    sub-report in this file. No `apps.planner` import appears anywhere in
    this module; `check_layer_boundaries` confirmed clean after this fix."""
    return _call_json("generation_usage_summary")


class Command(BaseCommand):
    help = "Phase 9 dashboard: one JSON payload combining every existing reference-data report + benchmark + usage counters (read-only)."

    def add_arguments(self, parser):
        parser.add_argument("--json", action="store_true")
        parser.add_argument("--skip-slow", action="store_true", help="Skip audit_reference_data --full-reports (report 7 runs route_graph.search() per top-city pair and is slow).")

    def handle(self, *args, **options):
        audit_args = ["--full-reports"] if not options["skip_slow"] else []
        report = {
            "coverage_and_quality": _call_json("audit_reference_data", *audit_args),
            "postgis_adoption_checkpoint": _call_json("benchmark_geo_queries"),
            "price_estimator_evaluation": _call_json("evaluate_price_estimators"),
            "completeness_recompute_preview": _call_json("recompute_completeness"),
            "generation_usage_counters": _usage_counters_section(),
            "index_review_explain": _explain_section(),
            "db_vendor": connection.vendor,
        }

        if options["json"]:
            self.stdout.write(json.dumps(report, indent=2, sort_keys=True, default=str))
        else:
            self.stdout.write(self.style.SUCCESS("Dashboard sections: " + ", ".join(sorted(report.keys()))))
            self.stdout.write(json.dumps(report["generation_usage_counters"], indent=2))
