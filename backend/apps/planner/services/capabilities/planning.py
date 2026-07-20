"""
Planning Helpers capabilities (docs/conversation-capability-layer.md §10).

`trip_progress` is the MVP capability here — a deterministic, always-honest
summary of the live draft. It's the visible proof that "plan anytime"
(docs/master-planner-conversation-model.md §5) is real: the draft already
IS the plan-in-progress (is_ready_for_plan only ever required destination +
dates, never the optional clusters — "Create Plan" was never actually gated
on them). This just makes that growth visible turn by turn, before the user
taps "Create Plan".
"""

from apps.planner.services.capabilities.base import capability_envelope


def trip_progress(draft, confidence_score=None, **_):
    meta = draft.metadata or {}
    known = {}

    if draft.destination_text:
        known["destination"] = draft.destination_text
    if draft.start_date and draft.end_date:
        known["dates"] = f"{draft.start_date.isoformat()} → {draft.end_date.isoformat()}"
    if draft.adults:
        known["travelers"] = draft.adults + (draft.children or 0)
    if meta.get("budget_inr"):
        known["budget"] = f"₹{meta['budget_inr']:,}"
    elif draft.budget_tier:
        known["budget"] = draft.budget_tier
    if meta.get("visit_purpose"):
        known["purpose"] = meta["visit_purpose"]
    if meta.get("origin"):
        known["origin"] = meta["origin"]

    return capability_envelope("trip_progress", {
        "known": known,
        "confidence_score": confidence_score,
        "ready_for_plan": draft.is_ready_for_plan,
    }, freshness="derived")

def regenerate_plan(workspace, **_):
    """
    Capability to retry plan generation when a previous generation job failed.
    """
    return capability_envelope("regenerate_plan", {
        "success": True,
        "workspace_id": workspace.id,
        "message": "Retrying plan generation..."
    }, freshness="live")

