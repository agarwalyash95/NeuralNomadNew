from apps.planner.services.capabilities.base import capability_envelope
from apps.planner.services.chat_edit_intents import (
    detect_add_place_intent,
    detect_add_rest_intent,
    detect_extend_stay_intent,
    detect_hotel_return_intent,
    detect_move_block_intent,
    detect_remove_block_intent,
    detect_remove_day_intent,
    detect_remove_last_day_intent,
    detect_retime_intent,
    detect_swap_block_intent,
)

_UNSUPPORTED_MESSAGE = (
    "I can't make that kind of change from chat yet. I can move a block "
    '("move dinner to 7pm"), swap or add a place ("swap my hotel", "add a '
    'museum on day 2"), move or remove a block ("move the fort to day 3", '
    '"remove the museum"), add free time or a hotel return ("add free '
    'time on day 2", "back to the hotel on day 3"), extend the trip, or '
    "remove a day — for anything else, use the Plan Canvas or a Helper "
    "Canvas."
)

_DETECTORS = (
    detect_retime_intent,
    detect_extend_stay_intent,
    detect_remove_last_day_intent,
    detect_remove_day_intent,
    detect_add_rest_intent,
    detect_hotel_return_intent,
    detect_remove_block_intent,
    detect_move_block_intent,
    detect_swap_block_intent,
    detect_add_place_intent,
)


def edit_plan(workspace, message: str):
    """
    Chat card for a message that reads as a plan-edit request. This
    producer never mutates the plan itself — chat_edit_intents.py's
    proposers (docs/planner-north-star-audit-and-vision.md Phase 1) already
    run unconditionally for every turn from ConversationService.send_message,
    independent of whether this capability fires, and are the only thing
    that actually files a PlanProposal.

    This function's only job is to classify the message honestly for the
    card: if it matches one of the supported edit patterns, the card says a
    change was drafted (true for the great majority of matches — that
    proposer runs on this same message this same turn; a few of the
    search-backed proposers, swap/add-place, can still legitimately produce
    nothing, e.g. an ambiguous swap target or no live search result, the
    same honest caveat retime/extend/remove already carried before Phase 1).
    For anything else it says plainly that chat can't do it yet, instead of
    the original behavior of always claiming success regardless of what was
    asked (see git history / docs/agent/HANDOFF.md for that fix).
    """
    trip = getattr(workspace, "trip", None) if workspace is not None else None
    if trip is None:
        return capability_envelope(
            "edit_plan",
            {"message": "Generate a plan first — there's nothing to edit yet."},
            freshness="derived",
            degraded=True,
            degraded_reason="No generated plan exists for this trip yet.",
        )

    recognized = any(detector(message) for detector in _DETECTORS)
    if recognized:
        return capability_envelope(
            "edit_plan",
            {"message": "Got it — I've drafted that change. Review and accept it below to apply it."},
            freshness="derived",
        )

    return capability_envelope(
        "edit_plan",
        {"message": _UNSUPPORTED_MESSAGE},
        freshness="derived",
        degraded=True,
        degraded_reason="This kind of edit isn't supported from chat yet.",
    )
