"""
DiffEngine — compares the AI-generated PlannerTripOriginal snapshot against
the current (possibly user-edited) PlannerTrip.days (docs/planner-output-
generation-architecture.md Phase 6 / B15). User edits are the highest-
signal preference data available: it's revealed behavior, not a claim —
and a stronger signal than anything captured during conversation.

Detects four concrete, checkable edit patterns (deliberately conservative
— only patterns with an unambiguous, real signal are emitted; a single
"attraction deleted" alone would be guessing at WHY, so that pattern is
intentionally not detected here):
  hotel_tier_shift    the kept hotel's star rating differs meaningfully
                       from the AI-proposed hotel's rating
  day_thinned         a day lost a block outright (not a swap) — implies
                       the traveler wants a slower pace. Count-only, blind
                       to WHAT was thinned.
  start_time_shift    a kept block's start_time moved meaningfully earlier
                       or later than the AI originally proposed
  category_removed    (Phase 4, M2) a real, named place of a given category
                       is present in the AI's original proposal by
                       master_ref but absent anywhere in the current plan
                       (not merely moved to another day) — repeated across
                       >=2 places of the same category, this is a real
                       category-level signal day_thinned can't express
                       (day_thinned can't tell "removed 2 restaurants" from
                       "removed 2 attractions").
"""

from dataclasses import dataclass, field
from typing import Any, Dict, List


@dataclass
class EditSignal:
    kind: str
    detail: Dict[str, Any] = field(default_factory=dict)


_HOTEL_STAR_DELTA_THRESHOLD = 0.5
_MIN_ACTIVITIES_FOR_THINNING_SIGNAL = 3
_START_TIME_SHIFT_THRESHOLD_MINUTES = 45
_MIN_REMOVALS_FOR_CATEGORY_SIGNAL = 2


def _index_by_day(days):
    return {d.get("day_number"): d for d in days or []}


def _block_by_master_ref(activities):
    out = {}
    for b in activities or []:
        ref = (b.get("metadata") or {}).get("master_ref")
        if ref and ref.get("id") is not None:
            out[(ref.get("table"), str(ref.get("id")))] = b
    return out


def diff_trip(original_days: List[Dict[str, Any]], current_days: List[Dict[str, Any]]) -> List[EditSignal]:
    signals: List[EditSignal] = []
    original_by_day = _index_by_day(original_days)
    current_by_day = _index_by_day(current_days)

    for day_number, orig_day in original_by_day.items():
        cur_day = current_by_day.get(day_number)
        if cur_day is None:
            continue
        signals.extend(_diff_day_hotel(orig_day, cur_day))
        signals.extend(_diff_day_thinning(orig_day, cur_day))
        signals.extend(_diff_day_start_times(orig_day, cur_day))

    signals.extend(_diff_category_removals(original_days, current_days))
    return signals


def _diff_category_removals(original_days, current_days) -> List[EditSignal]:
    """Trip-wide (not per-day) so a block simply MOVED to another day is
    never mistaken for a removal — only a master_ref present in the
    original plan and genuinely absent from the whole current plan counts."""
    current_refs = set()
    for day in current_days or []:
        for block in day.get("activities") or []:
            ref = (block.get("metadata") or {}).get("master_ref")
            if ref and ref.get("id") is not None:
                current_refs.add((ref.get("table"), str(ref.get("id"))))

    removed_by_category: Dict[str, int] = {}
    for day in original_days or []:
        for block in day.get("activities") or []:
            ref = (block.get("metadata") or {}).get("master_ref")
            category = block.get("category")
            if not ref or ref.get("id") is None or not category:
                continue
            key = (ref.get("table"), str(ref.get("id")))
            if key not in current_refs:
                removed_by_category[category] = removed_by_category.get(category, 0) + 1

    return [
        EditSignal("category_removed", {"category": category, "count": count})
        for category, count in removed_by_category.items()
        if count >= _MIN_REMOVALS_FOR_CATEGORY_SIGNAL
    ]


def _diff_day_hotel(orig_day, cur_day) -> List[EditSignal]:
    orig_hotels = [b for b in (orig_day.get("activities") or []) if b.get("category") == "hotel"]
    cur_hotels = [b for b in (cur_day.get("activities") or []) if b.get("category") == "hotel"]
    if not orig_hotels or not cur_hotels:
        return []

    orig_ref = ((orig_hotels[0].get("metadata") or {}).get("master_ref") or {}).get("id")
    cur_ref = ((cur_hotels[0].get("metadata") or {}).get("master_ref") or {}).get("id")
    if orig_ref == cur_ref:
        return []  # same hotel — not a replacement

    orig_rating = orig_hotels[0].get("rating")
    cur_rating = cur_hotels[0].get("rating")
    if orig_rating is None or cur_rating is None:
        return []

    delta = float(cur_rating) - float(orig_rating)
    if delta >= _HOTEL_STAR_DELTA_THRESHOLD:
        return [EditSignal("hotel_tier_shift", {"direction": "up", "delta": delta})]
    if delta <= -_HOTEL_STAR_DELTA_THRESHOLD:
        return [EditSignal("hotel_tier_shift", {"direction": "down", "delta": delta})]
    return []


def _diff_day_thinning(orig_day, cur_day) -> List[EditSignal]:
    orig_count = len(orig_day.get("activities") or [])
    cur_count = len(cur_day.get("activities") or [])
    if orig_count >= _MIN_ACTIVITIES_FOR_THINNING_SIGNAL and cur_count < orig_count:
        return [EditSignal(
            "day_thinned",
            {"day_number": orig_day.get("day_number"), "removed": orig_count - cur_count},
        )]
    return []


def _diff_day_start_times(orig_day, cur_day) -> List[EditSignal]:
    from apps.planner.services.validation import _parse_time

    orig_blocks = _block_by_master_ref(orig_day.get("activities"))
    cur_blocks = _block_by_master_ref(cur_day.get("activities"))
    signals: List[EditSignal] = []

    for ref, orig_block in orig_blocks.items():
        cur_block = cur_blocks.get(ref)
        if not cur_block:
            continue
        orig_dt = _parse_time(orig_block.get("start_time"))
        cur_dt = _parse_time(cur_block.get("start_time"))
        if orig_dt is None or cur_dt is None:
            continue
        delta_minutes = (cur_dt - orig_dt).total_seconds() / 60
        if abs(delta_minutes) >= _START_TIME_SHIFT_THRESHOLD_MINUTES:
            signals.append(EditSignal(
                "start_time_shift",
                {"direction": "later" if delta_minutes > 0 else "earlier", "minutes": abs(delta_minutes)},
            ))

    return signals
