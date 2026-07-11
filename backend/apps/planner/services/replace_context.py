"""
Replace-context refresh — closes the "stale day title after a swap" gap
(docs/planner-product-audit-2026-07.md R2): swap a day's centerpiece
attraction for something else and the day was still titled/labeled after
the old occupant.

Deliberately a literal keyword swap, not an LLM call: if a block's OLD title
appears verbatim inside its day's title, and the block was just replaced
with a NEW title, the day title keeps its shape with the anchor's name
refreshed. No attempt to re-judge whether the day title is still "good" —
that's a proposal for the human to accept or reject either way.
"""

import re


def _index_blocks_by_id(days):
    index = {}
    for day in days or []:
        for act in day.get("activities") or []:
            block_id = act.get("id")
            if block_id is not None:
                index[str(block_id)] = (day, act)
    return index


def detect_anchor_retitle(old_days, new_days):
    """
    Returns (retitled_day, old_day_title, new_day_title) for the first day
    whose title-anchoring block was renamed, or None if nothing qualifies.
    """
    old_by_id = _index_blocks_by_id(old_days)

    for new_day in new_days or []:
        day_title = (new_day.get("title") or "").strip()
        if not day_title:
            continue
        for act in new_day.get("activities") or []:
            block_id = act.get("id")
            if block_id is None:
                continue
            old_entry = old_by_id.get(str(block_id))
            if not old_entry:
                continue
            _old_day, old_act = old_entry
            old_title = (old_act.get("title") or "").strip()
            new_title = (act.get("title") or "").strip()
            if not old_title or not new_title or old_title == new_title:
                continue
            if old_title.lower() not in day_title.lower():
                continue

            pattern = re.compile(re.escape(old_title), re.IGNORECASE)
            suggested_title = pattern.sub(new_title, day_title, count=1)
            if suggested_title == day_title:
                continue

            retitled_day = dict(new_day)
            retitled_day["title"] = suggested_title
            return retitled_day, day_title, suggested_title
    return None


def propose_day_retitle(workspace, old_days, new_days):
    """
    Files a KIND_PLAN_EDIT proposal suggesting the refreshed day title.
    Returns the created proposal, or None if nothing qualified or an open
    proposal for this exact retitle already exists (never piles up dupes
    from repeated autosaves of the same unresolved swap).
    """
    from apps.planner.models import PlanProposal

    result = detect_anchor_retitle(old_days, new_days)
    if result is None:
        return None
    retitled_day, old_title, new_title = result

    trip = getattr(workspace, "trip", None)
    if trip is None:
        return None

    existing = workspace.proposals.filter(
        is_deleted=False,
        status=PlanProposal.STATUS_OPEN,
        kind=PlanProposal.KIND_PLAN_EDIT,
        title=f'Rename "{old_title}" to "{new_title}"',
    ).exists()
    if existing:
        return None

    original_day = next(
        (d for d in old_days if d.get("day_number") == retitled_day.get("day_number")),
        None,
    )
    if original_day is None:
        return None

    return PlanProposal.objects.create(
        workspace=workspace,
        kind=PlanProposal.KIND_PLAN_EDIT,
        title=f'Rename "{old_title}" to "{new_title}"',
        rationale=(
            f'Day {retitled_day.get("day_number")} was titled after a spot you just replaced. '
            f'Update the title to match what\'s actually planned now?'
        ),
        diff={
            "before": {"days": [original_day]},
            "after": {"days": [retitled_day]},
            "deltas": {},
        },
        created_by="agent",
        base_trip_updated_at=trip.updated_at,
    )
