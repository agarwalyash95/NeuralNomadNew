"""Phase 9 (§14 P9) N+1 audit — real query-count profiling of the planner
generation pipeline's post-compose stages (validate_plan, score_plan,
_price_transport_blocks, _stamp_transit_hints), against real generated data
(the same S11 workspace's actual PlannerTrip.days used throughout this
initiative's regression checks — not synthetic fixtures).

Deliberately scoped to these stages, not a full run_pipeline() call: they
are the DB-heavy, per-block stages most likely to carry an N+1 pattern (one
query per block/day rather than a bulk query), and they run without any
Gemini call, so this script needs no LLM mocking at all — matching this
initiative's existing preference for testing against real data over
building new mock infrastructure the repo doesn't already have (confirmed:
no CaptureQueriesContext/assertNumQueries usage exists anywhere in this
tree before this script).

Methodology: run each stage against real data twice — once with all 8 real
days, once with only the first day — and compare query counts. A stage
whose query count scales roughly linearly with day count is exhibiting the
classic N+1 shape (one or more queries per day/block instead of a bulk
query); a stage whose count stays flat or grows sub-linearly is not.
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

from django.test.utils import CaptureQueriesContext  # noqa: E402
from django.db import connection  # noqa: E402

from apps.planner.models import PlannerTrip, PlannerWorkspace  # noqa: E402
from apps.planner.services.validation import validate_plan  # noqa: E402
from apps.planner.services.scoring import score_plan  # noqa: E402
from apps.planner.services.plan_generation import _price_transport_blocks, _stamp_transit_hints  # noqa: E402

S11_WORKSPACE_ID = "be504346-2f80-489d-965f-c93c4112d3bb"


def _profile(label, fn, *args):
    with CaptureQueriesContext(connection) as ctx:
        fn(*args)
    return {"label": label, "query_count": len(ctx.captured_queries)}


def main():
    workspace = PlannerWorkspace.objects.filter(id=S11_WORKSPACE_ID).first()
    if not workspace:
        print(json.dumps({"error": f"S11 workspace {S11_WORKSPACE_ID} not found in this DB"}, indent=2))
        return
    trip = PlannerTrip.objects.filter(workspace=workspace).first()
    if not trip or not trip.days:
        print(json.dumps({"error": "No PlannerTrip.days found for the S11 workspace"}, indent=2))
        return

    import copy
    full_days = copy.deepcopy(trip.days)
    one_day = copy.deepcopy(trip.days[:1])

    results = []
    for stage_name, fn in (
        ("validate_plan", validate_plan),
        ("score_plan", lambda days: score_plan(days)),
        ("_stamp_transit_hints", _stamp_transit_hints),
    ):
        full = _profile(f"{stage_name} (8 days)", fn, full_days if stage_name != "score_plan" else full_days)
        one = _profile(f"{stage_name} (1 day)", fn, one_day if stage_name != "score_plan" else one_day)
        ratio = round(full["query_count"] / one["query_count"], 2) if one["query_count"] else None
        results.append({
            "stage": stage_name,
            "queries_8_days": full["query_count"],
            "queries_1_day": one["query_count"],
            "ratio": ratio,
            "likely_n_plus_1": bool(ratio and ratio >= 4.0),  # ~8x days but <4x queries is fine; >=4x is suspicious
        })

    # _price_transport_blocks needs a draft (for traveler count) — build a
    # minimal real one from the workspace's own TripDraftState.
    from apps.planner.models import TripDraftState
    draft = TripDraftState.objects.filter(workspace=workspace).first()
    if draft:
        full = _profile("_price_transport_blocks (8 days)", _price_transport_blocks, full_days, draft)
        one = _profile("_price_transport_blocks (1 day)", _price_transport_blocks, one_day, draft)
        ratio = round(full["query_count"] / one["query_count"], 2) if one["query_count"] else None
        results.append({
            "stage": "_price_transport_blocks",
            "queries_8_days": full["query_count"],
            "queries_1_day": one["query_count"],
            "ratio": ratio,
            "likely_n_plus_1": bool(ratio and ratio >= 4.0),
        })

    print(json.dumps({"workspace": str(workspace.id), "stages": results}, indent=2, default=str))


if __name__ == "__main__":
    main()
