"""
App-layer planning graph with dependency propagation (T7.1).

Uses the existing PostgreSQL/JSON trip.days schema directly — no graph DB,
no schema migration. A change to one block can have cascading effects on
others; this module computes them and files a PlanProposal for review.

The graph is ephemeral — built from trip.days on demand, never stored.
Postgres is the source of truth; this module is a pure computation layer.

Design note: block_added/block_removed effects (overloaded day, schedule
gap) are NOT re-derived here — PlanInsightEngine's OverloadedDayWarning and
ScheduleGapWarning already evaluate the current trip state live on every
GET /insights call (the same pattern every rule in that engine uses), so
they surface automatically after any edit with zero extra plumbing. This
module's job is narrower: the one cascade that needs an actual corrective
action — a time shift that causes downstream overlaps — which becomes a
PlanProposal, not just a detection.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

CHANGE_TIME_SHIFT = "time_shift"  # a block's start_time moved


def propagate(workspace, change: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Given a change event on workspace.trip, compute downstream effects and
    file a PlanProposal if one is warranted. Returns a list of effect dicts
    describing what cascaded (empty if nothing did).

    change dict shape: {"type": "time_shift", "day_number": int,
                         "block_id": str, "delta_minutes": int}
    """
    trip = getattr(workspace, "trip", None)
    if trip is None or not trip.days:
        return []

    if change.get("type") == CHANGE_TIME_SHIFT:
        return _propagate_time_shift(workspace, trip, change)
    return []


def _to_mins(t) -> Optional[int]:
    """'HH:MM' or 'HH:MM:SS' -> minutes since midnight."""
    if not t:
        return None
    try:
        parts = str(t).split(":")
        return int(parts[0]) * 60 + int(parts[1])
    except Exception:
        return None


def _from_mins(m: int) -> str:
    return f"{m // 60:02d}:{m % 60:02d}"


def _find_day(trip, day_number: int):
    for d in trip.days:
        if d.get("day_number") == day_number:
            return d
    return None


def _propagate_time_shift(workspace, trip, change) -> List[Dict[str, Any]]:
    """
    Cascade a time-shift: if block X moves by delta_minutes, all subsequent
    blocks on the same day that now overlap need to shift too. Files a
    single PlanProposal listing the bumped blocks — never mutates directly.
    """
    from apps.planner.models import PlanProposal

    day_number = change.get("day_number")
    block_id = str(change.get("block_id", ""))
    delta = int(change.get("delta_minutes", 0))
    if delta == 0 or not day_number or not block_id:
        return []

    day = _find_day(trip, day_number)
    if day is None:
        return []

    activities = list(day.get("activities") or [])
    pivot_idx = next((i for i, a in enumerate(activities) if str(a.get("id") or "") == block_id), None)
    if pivot_idx is None:
        return []

    bumped = []
    after_activities = list(activities)
    for i in range(pivot_idx + 1, len(after_activities)):
        prev = after_activities[i - 1]
        curr = after_activities[i]
        prev_end = _to_mins(prev.get("end_time"))
        curr_start = _to_mins(curr.get("start_time"))
        if prev_end is None or curr_start is None:
            break
        if curr_start < prev_end:
            overlap = prev_end - curr_start
            new_start = curr_start + overlap
            new_end = _to_mins(curr.get("end_time"))
            new_end = (new_end + overlap) if new_end is not None else new_start + 60
            updated = {**curr, "start_time": _from_mins(new_start), "end_time": _from_mins(new_end)}
            after_activities[i] = updated
            bumped.append({"title": curr.get("title", "block"), "new_start": _from_mins(new_start)})
        else:
            break

    if not bumped:
        return []

    after_day = {**day, "activities": after_activities}
    before_days = [d for d in trip.days if d.get("day_number") == day_number]
    after_days = [after_day]

    bump_list = ", ".join(f"'{b['title']}' → {b['new_start']}" for b in bumped)
    PlanProposal.objects.create(
        workspace=workspace,
        kind=PlanProposal.KIND_ROUTE_OPTIMIZATION,
        title=f"Day {day_number}: cascading time shift",
        rationale=f"Moving that block causes overlaps. Bumped: {bump_list}.",
        diff={"before": {"days": before_days}, "after": {"days": after_days}, "deltas": {"bumped": bumped}},
        metadata={
            "diff_explanation": {
                "what_changed": f"Subsequent blocks on day {day_number} shifted to avoid overlap.",
                "why": f"The block before them moved {delta} minutes — cascade keeps times realistic.",
                "what_improved": ["No overlapping blocks"],
                "what_got_worse": [f"{len(bumped)} block(s) start later than originally scheduled"],
                "confidence": "high",
                "can_undo": True,
            },
        },
        created_by="agent",
        base_trip_updated_at=trip.updated_at,
    )
    return [{"type": "cascade_time_shift", "bumped": bumped, "day_number": day_number}]


def detect_and_propagate_changes(workspace, old_days: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Called after a plan PATCH saves. Diffs old_days against the just-saved
    workspace.trip.days; when a block's start_time changed, runs it through
    propagate(). Best-effort — callers should catch exceptions so a diff
    failure never blocks the actual save that already succeeded.

    Only detects time_shift (the one cascade this module acts on) — block
    add/remove effects surface on their own via the live insight rules (see
    module docstring).
    """
    trip = getattr(workspace, "trip", None)
    if trip is None or not trip.days:
        return []

    old_by_day = {d.get("day_number"): d for d in old_days}
    all_effects = []

    for new_day in trip.days:
        day_number = new_day.get("day_number")
        old_day = old_by_day.get(day_number)
        if old_day is None:
            continue

        old_blocks = {str(a.get("id") or ""): a for a in (old_day.get("activities") or [])}
        new_blocks = {str(a.get("id") or ""): a for a in (new_day.get("activities") or [])}

        for block_id, new_block in new_blocks.items():
            old_block = old_blocks.get(block_id)
            if old_block is None:
                continue
            old_start = _to_mins(old_block.get("start_time"))
            new_start = _to_mins(new_block.get("start_time"))
            if old_start is not None and new_start is not None and new_start != old_start:
                all_effects.extend(propagate(workspace, {
                    "type": CHANGE_TIME_SHIFT,
                    "day_number": day_number,
                    "block_id": block_id,
                    "delta_minutes": new_start - old_start,
                }))
                break  # one cascade per day per save avoids overlapping proposals

    return all_effects
