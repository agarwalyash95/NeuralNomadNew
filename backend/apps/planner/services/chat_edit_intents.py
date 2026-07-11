"""
Chat-edit intents (docs/planner-product-audit-2026-07.md CH1) — turns a
narrow class of chat messages into a PlanProposal instead of just talking
about the trip. Deliberately scoped to re-timing: "move X to Y" is the one
edit a regex can resolve safely (one block, one field, an explicit new
value). Replace needs a real candidate search (which canvas would even
supply the replacement?) and move/remove need richer block resolution than
substring matching can do without risking a wrong-block edit — both are
left to the existing Helper Canvas / drag flows rather than half-built here.

Every match requires: a recognized trigger verb, an explicit parseable time,
and exactly one confidently-matching active block. Any ambiguity — no
match, multiple candidate blocks, an unparseable time — proposes nothing.
Silence is the correct default; a wrong guess that silently edits someone's
trip is far worse than not being clever enough to catch a phrasing.
"""

import re

_RETIME_RE = re.compile(
    r"^(?:move|change|shift|reschedule)\s+(?:the\s+)?(.+?)\s+to\s+(.+?)[.!]?$",
    re.IGNORECASE,
)
_TIME_TOKEN_RE = re.compile(r"^(\d{1,2})(?::(\d{2}))?\s*([ap]\.?m\.?)?$", re.IGNORECASE)


def _parse_time_token(text):
    m = _TIME_TOKEN_RE.match(text.strip())
    if not m:
        return None
    hour = int(m.group(1))
    minute = int(m.group(2) or 0)
    ampm = (m.group(3) or "").replace(".", "").lower()
    if ampm == "pm" and hour != 12:
        hour += 12
    elif ampm == "am" and hour == 12:
        hour = 0
    elif not ampm and 1 <= hour <= 12:
        # A bare hour in 1-12 with no am/pm ("move dinner to 8") is
        # genuinely ambiguous for a travel-planning re-time — reject rather
        # than guess. Hour 0 or 13-23 is unambiguous 24h format either way.
        return None
    if hour > 23 or minute > 59:
        return None
    return f"{hour:02d}:{minute:02d}"


def detect_retime_intent(message):
    """Returns (title_fragment, new_time_HHMM) or None."""
    m = _RETIME_RE.match((message or "").strip())
    if not m:
        return None
    title_fragment, time_text = m.group(1).strip(), m.group(2).strip()
    new_time = _parse_time_token(time_text)
    if not new_time or not title_fragment:
        return None
    return title_fragment, new_time


def _find_unique_active_block(trip, title_fragment):
    fragment = title_fragment.lower()
    matches = []
    for day in trip.days or []:
        for act in day.get("activities") or []:
            if act.get("is_active") is False or act.get("status") == "inactive":
                continue
            title = (act.get("title") or "").lower()
            if title and (fragment in title or title in fragment):
                matches.append((day, act))
    return matches[0] if len(matches) == 1 else None


def propose_retime_from_chat(workspace, message):
    """
    Files a KIND_PLAN_EDIT proposal moving one block's start_time, or
    returns None. Never raises — a misfire here must never break the chat
    turn that triggered it.
    """
    from apps.planner.models import PlanProposal

    trip = getattr(workspace, "trip", None)
    if trip is None:
        return None

    try:
        parsed = detect_retime_intent(message)
        if not parsed:
            return None
        title_fragment, new_time = parsed

        match = _find_unique_active_block(trip, title_fragment)
        if match is None:
            return None
        day, block = match
        if block.get("start_time") == new_time:
            return None

        proposal_title = f'Move "{block.get("title")}" to {new_time}'
        already_open = workspace.proposals.filter(
            is_deleted=False,
            status=PlanProposal.STATUS_OPEN,
            kind=PlanProposal.KIND_PLAN_EDIT,
            title=proposal_title,
        ).exists()
        if already_open:
            return None

        retimed_day = dict(day)
        retimed_day["activities"] = [
            {**a, "start_time": new_time} if a.get("id") == block.get("id") else a
            for a in day.get("activities") or []
        ]

        return PlanProposal.objects.create(
            workspace=workspace,
            kind=PlanProposal.KIND_PLAN_EDIT,
            title=proposal_title,
            rationale=f'From chat: move "{block.get("title")}" to {new_time}. Accept to apply it to the plan.',
            diff={"before": {"days": [day]}, "after": {"days": [retimed_day]}, "deltas": {}},
            created_by="agent",
            base_trip_updated_at=trip.updated_at,
        )
    except Exception:
        return None
