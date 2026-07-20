"""
Deterministic repair pass for ValidationReport violations (docs/planner-
output-generation-architecture.md Phase 3). Repairs what can be fixed
mechanically (time-shifting overlapping blocks, correcting a backwards
time range); anything left over after repair is recorded as an honest,
human-readable gap on the itinerary rather than silently dropped or
crashing generation.

DEFERRED: the architecture doc's other half of Phase 3 — "one targeted
LLM re-prompt only for days with remaining error-severity violations" —
is intentionally NOT implemented here. The deterministic pass alone
should be measured against real generations first; if overlaps/backwards
times turn out to be rare (the compose prompt already asks for
"sequential" times), the LLM re-prompt's extra cost/latency may not be
justified. Add it once that's measured, not speculatively.
"""

from datetime import timedelta
from typing import Any, Dict, List, Tuple

from apps.planner.services.validation import _parse_time, validate_plan


def _fmt_time(dt) -> str:
    return dt.strftime("%H:%M")


def repair_plan(days: List[Dict[str, Any]], constraint_engine=None) -> Tuple[List[Dict[str, Any]], List[str]]:
    """
    Repairs autofixable violations in `days` IN PLACE; returns
    (days, gaps) where gaps are honest notes for anything that could not
    be repaired. Never raises — a plan that can't be fully repaired is
    still returned, with its remaining defects named, not hidden.
    """
    for day in days:
        _repair_day_overlaps_and_backwards_times(day)

    post_report = validate_plan(days, constraint_engine=constraint_engine)
    gaps = [v.message for v in post_report.violations if v.severity == "error"]
    return days, gaps


def _repair_day_overlaps_and_backwards_times(day: Dict[str, Any]) -> None:
    activities = day.get("activities") or []
    parsed = []
    for block in activities:
        start = _parse_time(block.get("start_time"))
        end = _parse_time(block.get("end_time"))
        if start is None or end is None:
            parsed.append((None, None, block))
            continue
        if end <= start:
            # A backwards/zero-length range — repair to a visible 1-hour
            # default rather than guessing the LLM's intended duration.
            end = start + timedelta(hours=1)
            block["end_time"] = _fmt_time(end)
        parsed.append((start, end, block))

    timed = [p for p in parsed if p[0] is not None]
    untimed = [p for p in parsed if p[0] is None]
    timed.sort(key=lambda p: p[0])

    # Push any block that starts before the previous one ends forward,
    # preserving its own original duration — never delete a block to
    # resolve an overlap.
    for i in range(1, len(timed)):
        _prev_start, prev_end, _prev_block = timed[i - 1]
        start, end, block = timed[i]
        if start < prev_end:
            duration = end - start
            new_start = prev_end
            new_end = new_start + duration
            block["start_time"] = _fmt_time(new_start)
            block["end_time"] = _fmt_time(new_end)
            timed[i] = (new_start, new_end, block)

    day["activities"] = [b for _s, _e, b in timed] + [b for _s, _e, b in untimed]
