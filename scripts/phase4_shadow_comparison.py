"""Phase 4 shadow-mode regression check (S11, master plan §9.4/§14).

Runs BOTH journey_resolver implementations (legacy and the new
route_graph-backed adapter) against the real S11 workspace — Kolkata ->
Gangtok/Pelling, the actual Phase-B evidence workspace — and reports a diff.
Read-only against application logic (it calls the resolver, which may read
JourneyRouteCache/reference tables, but writes nothing new itself beyond
whatever the resolver's own normal cache-write behavior already does).

No paid API calls: LIVE_PROVIDERS_ENABLED is left at its configured value,
but this script does not flip it — it reports whatever each implementation
produces under the current environment.
"""

import json
import os
import sys
from pathlib import Path

REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
BACKEND_ROOT = REPOSITORY_ROOT / "backend"
sys.path.insert(0, str(BACKEND_ROOT))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")

import django  # noqa: E402

django.setup()

from apps.planner.models import PlannerWorkspace, TripDraftState  # noqa: E402
from apps.planner.services.foundation import DecisionTrace, UsageBudget  # noqa: E402
from apps.planner.services.journey_resolver import (  # noqa: E402
    _resolve_journey_options_impl, _resolve_scheduled_mode, _route_graph_resolve_scheduled_mode,
)

S11_WORKSPACE_ID = "be504346-2f80-489d-965f-c93c4112d3bb"


def _summarize(options):
    return {
        "option_count": len(options),
        "modes": sorted({o["mode"] for o in options}),
        "recommended_mode": next((o["mode"] for o in options if o.get("recommended")), None),
        "recommended_score": next((o["planning_suitability"]["score"] for o in options if o.get("recommended")), None),
    }


def main():
    workspace = PlannerWorkspace.objects.filter(id=S11_WORKSPACE_ID).first()
    if not workspace:
        print(json.dumps({"error": f"S11 workspace {S11_WORKSPACE_ID} not found in this DB"}, indent=2))
        return

    draft = TripDraftState.objects.filter(workspace=workspace).first()
    if not draft:
        print(json.dumps({"error": "No TripDraftState found for the S11 workspace"}, indent=2))
        return

    legacy_options = _resolve_journey_options_impl(
        draft, usage=UsageBudget(), trace=DecisionTrace(), scheduled_mode_resolver=_resolve_scheduled_mode,
    )
    route_graph_options = _resolve_journey_options_impl(
        draft, usage=UsageBudget(), trace=DecisionTrace(), scheduled_mode_resolver=_route_graph_resolve_scheduled_mode,
    )

    legacy_summary = _summarize(legacy_options)
    route_graph_summary = _summarize(route_graph_options)

    report = {
        "workspace": str(workspace.id),
        "workspace_name": workspace.title,
        "origin": draft.origin_text,
        "destination": draft.destination_text,
        "legacy": legacy_summary,
        "route_graph": route_graph_summary,
        "no_regression": (
            route_graph_summary["option_count"] >= 1
            and bool(set(route_graph_summary["modes"]) & set(legacy_summary["modes"]))
        ),
        "mode_set_identical": legacy_summary["modes"] == route_graph_summary["modes"],
        "recommended_mode_identical": legacy_summary["recommended_mode"] == route_graph_summary["recommended_mode"],
    }
    print(json.dumps(report, indent=2, default=str))


if __name__ == "__main__":
    main()
