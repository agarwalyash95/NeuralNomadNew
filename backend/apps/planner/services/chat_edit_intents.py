"""
Chat-edit intents (docs/planner-product-audit-2026-07.md CH1;
docs/planner-north-star-audit-and-vision.md Phase 1) — turns a class of
chat messages into a PlanProposal instead of just talking about the trip.

Every match requires an explicit, unambiguous instruction. Any ambiguity —
no match, multiple candidate blocks, an unparseable time — proposes
nothing. Silence is the correct default; a wrong guess that silently edits
someone's trip is far worse than not being clever enough to catch a
phrasing. Every proposer here is a pure detect-then-diff function: it never
mutates the trip directly (that only happens if/when the user accepts the
resulting PlanProposal in accept_proposal, views.py, which as of Phase 1
also runs the same commitment-hierarchy guard patch_trip/select_item use —
a booked/locked block can never be silently dropped, retimed, or replaced
by any proposal here, chat-derived or not).

Covered as of Phase 1: retime one block; extend the trip by whole days at
the end; remove the last day OR any explicitly-numbered day (renumbering
every later day); add a non-bookable rest/hotel-return anchor to a named
day; remove one named block from anywhere in the trip; move one named
block to a different named day; add a new place to a named day via real
search (capabilities/search.py — the same DB-first/Places-cache-on-miss
substrate every browse capability uses, never an invented place); swap one
named block for a different real result in the same category/city.

Deliberately still NOT covered: parsing a *description* of what a
replacement/addition should be ("something cheaper", "a rooftop place") —
every search-backed proposer here always searches by the target's own
category and takes the top real result, never tries to interpret vague
free-text preference into a query. A composite instruction like "make day
3 relaxed" is not its own intent; it is two ordinary messages (remove a
block, add a rest block) chained by the user, not guessed by the system.

Plan evolution (docs/ai-chat-implementation-plan.md Phase 8.2): most
proposers here touch only the day(s) directly affected — every other
day's content is left completely alone, via the `diff.after.days` /
`deltas.add_days` / `deltas.remove_day_numbers` proposal contract (see
accept_proposal in views.py), never a full-plan regeneration.
"""

import re
import uuid
from datetime import date as date_cls, timedelta

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


# ── Extend stay / remove last day (Plan Evolution, Phase 8.2) ────────────

_EXTEND_STAY_RE = re.compile(
    r"\b(?:stay|extend)\b.*?\b(?:(\d+)\s*(?:more|extra|additional)\s*days?|another\s+day|one\s+more\s+day)\b",
    re.IGNORECASE,
)
_REMOVE_LAST_DAY_RE = re.compile(
    r"\b(?:remove|drop|cancel|skip)\b.*?\b(?:the\s+)?last\s+day\b",
    re.IGNORECASE,
)


def detect_extend_stay_intent(message):
    """Returns the number of extra days requested, or None. 'stay another
    day' / 'can we stay one more day' / 'extend the trip by 2 days'."""
    text = (message or "").strip()
    if not re.search(r"\b(stay|extend)\b", text, re.IGNORECASE):
        return None
    m = _EXTEND_STAY_RE.search(text)
    if not m:
        return None
    days_str = m.group(1)
    if days_str:
        try:
            n = int(days_str)
            return n if 1 <= n <= 14 else None
        except ValueError:
            return None
    return 1  # "another day" / "one more day"


def detect_remove_last_day_intent(message):
    return bool(_REMOVE_LAST_DAY_RE.search((message or "").strip()))


def propose_extend_stay_from_chat(workspace, message):
    """
    Files a day-scoped proposal appending N empty new days after the trip's
    last city/day — never touches any existing day's content. The new
    day(s) are an empty shell (no invented activities); the user fills them
    in via the normal add-activity flow, same honest-no-fabrication
    discipline the rest of the planner follows.
    """
    from apps.planner.models import PlanProposal

    trip = getattr(workspace, "trip", None)
    if trip is None:
        return None

    try:
        extra_days = detect_extend_stay_intent(message)
        if not extra_days:
            return None

        days = trip.days or []
        if not days:
            return None
        last_day = max(days, key=lambda d: d.get("day_number") or 0)
        last_number = last_day.get("day_number") or len(days)
        last_date = last_day.get("date")
        last_city = last_day.get("city")

        proposal_title = f"Add {extra_days} day{'s' if extra_days != 1 else ''} to the trip"
        already_open = workspace.proposals.filter(
            is_deleted=False, status=PlanProposal.STATUS_OPEN,
            kind=PlanProposal.KIND_PLAN_EDIT, title=proposal_title,
        ).exists()
        if already_open:
            return None

        new_days = []
        for i in range(1, extra_days + 1):
            new_date = None
            if last_date:
                try:
                    from datetime import date as date_cls
                    new_date = (date_cls.fromisoformat(last_date) + timedelta(days=i)).isoformat()
                except ValueError:
                    new_date = None
            new_days.append({
                "day_number": last_number + i,
                "date": new_date,
                "city": last_city,
                "activities": [],
            })

        return PlanProposal.objects.create(
            workspace=workspace,
            kind=PlanProposal.KIND_PLAN_EDIT,
            title=proposal_title,
            rationale=(
                f"From chat: add {extra_days} more day{'s' if extra_days != 1 else ''} in {last_city or 'your destination'}. "
                "Accept to append the day(s) — you can then add activities to them."
            ),
            diff={"before": {"days": []}, "after": {"days": []}, "deltas": {"add_days": new_days}},
            created_by="agent",
            base_trip_updated_at=trip.updated_at,
        )
    except Exception:
        return None


def propose_remove_last_day_from_chat(workspace, message):
    """Files a proposal dropping only the trip's final day — the simple,
    no-renumbering case. detect_remove_last_day_intent only matches the
    literal phrase "last day", so it never collides with
    detect_remove_day_intent below (which requires an explicit digit and
    handles the renumbering a middle-day removal needs)."""
    from apps.planner.models import PlanProposal

    trip = getattr(workspace, "trip", None)
    if trip is None:
        return None

    try:
        if not detect_remove_last_day_intent(message):
            return None

        days = trip.days or []
        if len(days) <= 1:
            return None  # never remove the only day via chat
        last_day = max(days, key=lambda d: d.get("day_number") or 0)
        last_number = last_day.get("day_number")

        proposal_title = "Remove the last day"
        already_open = workspace.proposals.filter(
            is_deleted=False, status=PlanProposal.STATUS_OPEN,
            kind=PlanProposal.KIND_PLAN_EDIT, title=proposal_title,
        ).exists()
        if already_open:
            return None

        return PlanProposal.objects.create(
            workspace=workspace,
            kind=PlanProposal.KIND_PLAN_EDIT,
            title=proposal_title,
            rationale=f'From chat: drop Day {last_number} ("{last_day.get("city") or "trip"}"). Accept to remove it.',
            diff={"before": {"days": [last_day]}, "after": {"days": []}, "deltas": {"remove_day_numbers": [last_number]}},
            created_by="agent",
            base_trip_updated_at=trip.updated_at,
        )
    except Exception:
        return None


# ── Phase 1 shared helpers ────────────────────────────────────────────────

_DAY_REF_RE = re.compile(r"\bday\s*(\d{1,2})\b", re.IGNORECASE)


def _extract_day_number(message):
    """The one explicit day number named in a message, or None. Chat text
    alone carries no reliable notion of "today" or "the day the user is
    looking at" — an explicit "day N" is required rather than guessed."""
    m = _DAY_REF_RE.search(message or "")
    if not m:
        return None
    try:
        n = int(m.group(1))
        return n if 1 <= n <= 30 else None
    except ValueError:
        return None


def _find_day(trip, day_number):
    for day in trip.days or []:
        if day.get("day_number") == day_number:
            return day
    return None


def _add_minutes(hhmm, minutes):
    try:
        h, m = (int(x) for x in (hhmm or "").split(":"))
    except (ValueError, AttributeError):
        h, m = 14, 0
    total = (h * 60 + m + minutes) % (24 * 60)
    return f"{total // 60:02d}:{total % 60:02d}"


def _find_city_hotel_title(trip, city_name):
    """The active hotel block's title in the given city, or None. Mirrors
    the frontend's findCityHotelTitle (ItineraryTimeline.tsx) so a
    chat-added hotel-return anchor and a canvas-added one read the same."""
    for day in trip.days or []:
        if day.get("city") != city_name:
            continue
        for act in day.get("activities") or []:
            if act.get("category") == "hotel" and act.get("is_active") is not False:
                return act.get("title")
    return None


def _build_rest_block(start_time=None):
    """Mirrors createLightBlock('rest', ...) in ItineraryTimeline.tsx — a
    chat-added rest block and a canvas-added one are the same shape."""
    start_time = start_time or "14:00"
    return {
        "id": str(uuid.uuid4()),
        "category": "rest",
        "title": "Free time",
        "location_name": "",
        "start_time": start_time,
        "end_time": _add_minutes(start_time, 120),
        "estimated_cost": None,
        "status": "pending",
        "notes": "No plans — rest, wander, or revisit a favorite spot.",
        "why": "",
        "latitude": None,
        "longitude": None,
        "rating": None,
        "image_url": None,
        "metadata": {},
        "is_active": True,
    }


def _build_hotel_return_block(hotel_title=None, start_time=None):
    """Mirrors createLightBlock('hotel_return', ...) in ItineraryTimeline.tsx."""
    start_time = start_time or "19:00"
    title = f"Back to {hotel_title}" if hotel_title else "Back to your hotel"
    return {
        "id": str(uuid.uuid4()),
        "category": "hotel_return",
        "title": title,
        "location_name": "",
        "start_time": start_time,
        "end_time": _add_minutes(start_time, 30),
        "estimated_cost": None,
        "status": "pending",
        "notes": "",
        "why": "",
        "latitude": None,
        "longitude": None,
        "rating": None,
        "image_url": None,
        "metadata": {},
        "is_active": True,
    }


# ── Add a rest block (Phase 1) ────────────────────────────────────────────

_ADD_REST_RE = re.compile(
    r"\b(?:add|give me|schedule|include|block off)\b.*"
    r"\b(?:rest|free\s*time|down\s*time|downtime|relax(?:ation)?|nothing\s+planned)\b",
    re.IGNORECASE,
)


def detect_add_rest_intent(message):
    """Returns the target day_number, or None."""
    text = (message or "").strip()
    if not _ADD_REST_RE.search(text):
        return None
    return _extract_day_number(text)


def propose_add_rest_from_chat(workspace, message):
    """
    Files a proposal appending a non-bookable 'rest' block (no price, no
    provenance, no candidate search — the same concept plan-canvas Phase 0b
    added to the manual timeline) to an explicitly-named day.
    """
    from apps.planner.models import PlanProposal

    trip = getattr(workspace, "trip", None)
    if trip is None:
        return None

    try:
        day_number = detect_add_rest_intent(message)
        if day_number is None:
            return None

        day = _find_day(trip, day_number)
        if day is None:
            return None

        proposal_title = f"Add free time to day {day_number}"
        already_open = workspace.proposals.filter(
            is_deleted=False, status=PlanProposal.STATUS_OPEN,
            kind=PlanProposal.KIND_PLAN_EDIT, title=proposal_title,
        ).exists()
        if already_open:
            return None

        activities = day.get("activities") or []
        last_time = None
        with_times = [a.get("end_time") or a.get("start_time") for a in activities if a.get("end_time") or a.get("start_time")]
        if with_times:
            last_time = max(with_times)

        updated_day = dict(day)
        updated_day["activities"] = [*activities, _build_rest_block(start_time=last_time)]

        return PlanProposal.objects.create(
            workspace=workspace,
            kind=PlanProposal.KIND_PLAN_EDIT,
            title=proposal_title,
            rationale=f"From chat: add unstructured free time to day {day_number}. Accept to add it.",
            diff={"before": {"days": [day]}, "after": {"days": [updated_day]}, "deltas": {}},
            created_by="agent",
            base_trip_updated_at=trip.updated_at,
        )
    except Exception:
        return None


# ── Add a return-to-hotel anchor (Phase 1) ───────────────────────────────

_HOTEL_RETURN_RE = re.compile(
    r"\b(?:back to|return to|head back to|go back to)\b[^.!]*\bhotel\b"
    r"|\bhotel\b[^.!]*\b(?:for the night|to rest|to sleep)\b",
    re.IGNORECASE,
)


def detect_hotel_return_intent(message):
    """Returns the target day_number, or None."""
    text = (message or "").strip()
    if not _HOTEL_RETURN_RE.search(text):
        return None
    return _extract_day_number(text)


def propose_hotel_return_from_chat(workspace, message):
    """
    Files a proposal appending an evening "Back to <hotel>" anchor block to
    an explicitly-named day. Defaults to right after that day's last
    scheduled item; names the actual booked hotel in that city when one
    exists, same honest fallback ("your hotel") the canvas version uses
    when it doesn't.
    """
    from apps.planner.models import PlanProposal

    trip = getattr(workspace, "trip", None)
    if trip is None:
        return None

    try:
        day_number = detect_hotel_return_intent(message)
        if day_number is None:
            return None

        day = _find_day(trip, day_number)
        if day is None:
            return None

        proposal_title = f"Add hotel return to day {day_number}"
        already_open = workspace.proposals.filter(
            is_deleted=False, status=PlanProposal.STATUS_OPEN,
            kind=PlanProposal.KIND_PLAN_EDIT, title=proposal_title,
        ).exists()
        if already_open:
            return None

        activities = day.get("activities") or []
        last_time = None
        with_times = [a.get("end_time") or a.get("start_time") for a in activities if a.get("end_time") or a.get("start_time")]
        if with_times:
            last_time = max(with_times)

        hotel_title = _find_city_hotel_title(trip, day.get("city"))
        block = _build_hotel_return_block(hotel_title=hotel_title, start_time=last_time)

        updated_day = dict(day)
        updated_day["activities"] = [*activities, block]

        return PlanProposal.objects.create(
            workspace=workspace,
            kind=PlanProposal.KIND_PLAN_EDIT,
            title=proposal_title,
            rationale=(
                f"From chat: add an evening return to {hotel_title or 'your hotel'} on day {day_number}. "
                "Accept to add it."
            ),
            diff={"before": {"days": [day]}, "after": {"days": [updated_day]}, "deltas": {}},
            created_by="agent",
            base_trip_updated_at=trip.updated_at,
        )
    except Exception:
        return None


# ── Remove one named block, any day (Phase 1) ────────────────────────────

_REMOVE_BLOCK_RE = re.compile(r"^(?:remove|drop|cancel|skip|delete)\s+(?:the\s+)?(.+?)[.!]?$", re.IGNORECASE)


def detect_remove_block_intent(message):
    """Returns a title fragment, or None. Declines whenever the fragment
    mentions "day" — that phrasing belongs to detect_remove_last_day_intent
    or detect_remove_day_intent, never a false block-title match."""
    text = (message or "").strip()
    m = _REMOVE_BLOCK_RE.match(text)
    if not m:
        return None
    fragment = m.group(1).strip()
    if not fragment or re.search(r"\bday\b", fragment, re.IGNORECASE):
        return None
    return fragment


def propose_remove_block_from_chat(workspace, message):
    """
    Files a proposal removing ONE unambiguous named block from wherever it
    is in the trip. Booked/locked blocks are protected by
    accept_proposal's commitment-hierarchy guard on accept, not here.
    """
    from apps.planner.models import PlanProposal

    trip = getattr(workspace, "trip", None)
    if trip is None:
        return None

    try:
        fragment = detect_remove_block_intent(message)
        if not fragment:
            return None

        match = _find_unique_active_block(trip, fragment)
        if match is None:
            return None
        day, block = match

        proposal_title = f'Remove "{block.get("title")}"'
        already_open = workspace.proposals.filter(
            is_deleted=False, status=PlanProposal.STATUS_OPEN,
            kind=PlanProposal.KIND_PLAN_EDIT, title=proposal_title,
        ).exists()
        if already_open:
            return None

        updated_day = dict(day)
        updated_day["activities"] = [a for a in (day.get("activities") or []) if a.get("id") != block.get("id")]

        return PlanProposal.objects.create(
            workspace=workspace,
            kind=PlanProposal.KIND_PLAN_EDIT,
            title=proposal_title,
            rationale=f'From chat: remove "{block.get("title")}". Accept to remove it.',
            diff={"before": {"days": [day]}, "after": {"days": [updated_day]}, "deltas": {}},
            created_by="agent",
            base_trip_updated_at=trip.updated_at,
        )
    except Exception:
        return None


# ── Move one named block to a different day (Phase 1) ────────────────────

_MOVE_TO_DAY_RE = re.compile(
    r"^(?:move|shift|reschedule)\s+(?:the\s+)?(.+?)\s+to\s+day\s*(\d{1,2})[.!]?$", re.IGNORECASE
)


def detect_move_block_intent(message):
    """Returns (title_fragment, target_day_number) or None. The literal
    "to day N" suffix keeps this disjoint from detect_retime_intent's
    "move X to <time>" — a bare time token never matches \\bday\\s*\\d+\\b."""
    m = _MOVE_TO_DAY_RE.match((message or "").strip())
    if not m:
        return None
    title_fragment = m.group(1).strip()
    try:
        day_number = int(m.group(2))
    except ValueError:
        return None
    if not title_fragment or day_number < 1:
        return None
    return title_fragment, day_number


def propose_move_block_from_chat(workspace, message):
    """Files a proposal moving one unambiguous named block from its current
    day to an explicitly-named different day, appended at the end of the
    target day's activities."""
    from apps.planner.models import PlanProposal

    trip = getattr(workspace, "trip", None)
    if trip is None:
        return None

    try:
        parsed = detect_move_block_intent(message)
        if not parsed:
            return None
        title_fragment, target_day_number = parsed

        match = _find_unique_active_block(trip, title_fragment)
        if match is None:
            return None
        source_day, block = match

        if source_day.get("day_number") == target_day_number:
            return None  # already there — nothing to propose

        target_day = _find_day(trip, target_day_number)
        if target_day is None:
            return None

        proposal_title = f'Move "{block.get("title")}" to day {target_day_number}'
        already_open = workspace.proposals.filter(
            is_deleted=False, status=PlanProposal.STATUS_OPEN,
            kind=PlanProposal.KIND_PLAN_EDIT, title=proposal_title,
        ).exists()
        if already_open:
            return None

        updated_source = dict(source_day)
        updated_source["activities"] = [
            a for a in (source_day.get("activities") or []) if a.get("id") != block.get("id")
        ]
        updated_target = dict(target_day)
        updated_target["activities"] = [*(target_day.get("activities") or []), block]

        return PlanProposal.objects.create(
            workspace=workspace,
            kind=PlanProposal.KIND_PLAN_EDIT,
            title=proposal_title,
            rationale=(
                f'From chat: move "{block.get("title")}" from day {source_day.get("day_number")} '
                f"to day {target_day_number}. Accept to apply it."
            ),
            diff={"before": {"days": [source_day, target_day]}, "after": {"days": [updated_source, updated_target]}, "deltas": {}},
            created_by="agent",
            base_trip_updated_at=trip.updated_at,
        )
    except Exception:
        return None


# ── Remove any explicitly-numbered day, with renumbering (Phase 1) ───────

_REMOVE_DAY_RE = re.compile(r"\b(?:remove|drop|cancel|skip)\b.*\bday\s*(\d{1,2})\b", re.IGNORECASE)


def detect_remove_day_intent(message):
    """Returns the target day_number, or None. Requires an explicit digit —
    deliberately disjoint from detect_remove_last_day_intent, which matches
    only the literal phrase "last day" with no number, so the two never
    both fire for the same message."""
    m = _REMOVE_DAY_RE.search((message or "").strip())
    if not m:
        return None
    try:
        n = int(m.group(1))
        return n if n >= 1 else None
    except ValueError:
        return None


def propose_remove_day_from_chat(workspace, message):
    """
    Files a proposal removing an explicitly-named day at ANY position (not
    just the last) and renumbering every later day down by one, with its
    date shifted back one day. A day whose removal — or whose renumbering —
    would silently drop a booked/locked block is caught by
    accept_proposal's commitment-hierarchy guard on accept, not here; this
    only constructs the candidate diff.
    """
    from apps.planner.models import PlanProposal

    trip = getattr(workspace, "trip", None)
    if trip is None:
        return None

    try:
        target_number = detect_remove_day_intent(message)
        if target_number is None:
            return None

        days = sorted(trip.days or [], key=lambda d: d.get("day_number") or 0)
        if len(days) <= 1:
            return None  # never remove the only day via chat
        target_day = _find_day(trip, target_number)
        if target_day is None:
            return None

        proposal_title = f"Remove day {target_number}"
        already_open = workspace.proposals.filter(
            is_deleted=False, status=PlanProposal.STATUS_OPEN,
            kind=PlanProposal.KIND_PLAN_EDIT, title=proposal_title,
        ).exists()
        if already_open:
            return None

        later_days = [d for d in days if (d.get("day_number") or 0) > target_number]
        after_days = []
        for d in later_days:
            shifted = dict(d)
            shifted["day_number"] = (d.get("day_number") or 0) - 1
            old_date = d.get("date")
            if old_date:
                try:
                    shifted["date"] = (date_cls.fromisoformat(old_date) - timedelta(days=1)).isoformat()
                except ValueError:
                    pass
            after_days.append(shifted)

        last_number = days[-1].get("day_number")

        return PlanProposal.objects.create(
            workspace=workspace,
            kind=PlanProposal.KIND_PLAN_EDIT,
            title=proposal_title,
            rationale=(
                f'From chat: remove day {target_number} ("{target_day.get("city") or "trip"}") '
                "and shift every later day back by one. Accept to apply it."
            ),
            diff={
                "before": {"days": [target_day, *later_days]},
                "after": {"days": after_days},
                "deltas": {"remove_day_numbers": [last_number]},
            },
            created_by="agent",
            base_trip_updated_at=trip.updated_at,
        )
    except Exception:
        return None


# ── Add / swap a place via real search (Phase 1) ─────────────────────────

_SEARCH_CATEGORY_TO_BLOCK = {"hotel": "hotel", "restaurant": "food", "attraction": "attraction", "activity": "activity"}
_BLOCK_TO_SEARCH_CATEGORY = {v: k for k, v in _SEARCH_CATEGORY_TO_BLOCK.items()}

_PLACE_CATEGORY_WORDS = {
    "hotel": "hotel", "hotels": "hotel", "stay": "hotel", "resort": "hotel",
    "restaurant": "restaurant", "restaurants": "restaurant", "place to eat": "restaurant",
    "museum": "attraction", "attraction": "attraction", "attractions": "attraction",
    "sight": "attraction", "sights": "attraction", "temple": "attraction", "fort": "attraction",
    "activity": "activity", "activities": "activity", "experience": "activity",
}

_ADD_PLACE_RE = re.compile(r"^add\s+(?:a|an|another|some)?\s*\S", re.IGNORECASE)


def detect_add_place_intent(message):
    """Returns (search_category, day_number) or None. Requires both an
    explicit day number and a recognizable place-category word; declines
    on "add N more days"/"add a rest block" — those belong to the extend-
    stay and add-rest detectors, not this one."""
    text = (message or "").strip()
    if not _ADD_PLACE_RE.match(text):
        return None
    if re.search(r"\b(?:more|extra|additional)\s*days?\b", text, re.IGNORECASE):
        return None
    if _ADD_REST_RE.search(text) or _HOTEL_RETURN_RE.search(text):
        return None
    day_number = _extract_day_number(text)
    if day_number is None:
        return None
    lowered = text.lower()
    category = None
    for word, cat in _PLACE_CATEGORY_WORDS.items():
        if word in lowered:
            category = cat
            break
    if category is None:
        return None
    return category, day_number


def _build_place_block(result, search_category, start_time=None):
    """Shapes a real capabilities/search.py result into a block dict. Never
    invents a place — `result` always came from explore_places (DB-first,
    Google Places cache-on-miss), the same substrate every browse
    capability already uses."""
    start_time = start_time or "10:00"
    return {
        "id": str(uuid.uuid4()),
        "category": _SEARCH_CATEGORY_TO_BLOCK.get(search_category, "attraction"),
        "title": result.get("name") or "Selected place",
        "location_name": result.get("address") or "",
        "start_time": start_time,
        "end_time": _add_minutes(start_time, 90),
        "estimated_cost": None,
        "status": "pending",
        "notes": "",
        "why": "Added from chat via real search results.",
        "latitude": result.get("latitude"),
        "longitude": result.get("longitude"),
        "rating": result.get("rating"),
        "image_url": result.get("image_url"),
        "metadata": {
            "master_ref": {"table": "search_result", "id": result.get("id")},
            "provenance": "verified_database",
        },
        "is_active": True,
    }


def propose_add_place_from_chat(workspace, message):
    """
    Files a proposal adding ONE new place to an explicitly-named day, using
    the real search every browse capability already uses. Takes the top
    real result — there is no existing block to disambiguate a choice
    against, so a top-rated real result is the honest default; the user
    reviews the specific place before accepting.
    """
    from apps.planner.models import PlanProposal
    from apps.planner.services.capabilities.search import _run_search

    trip = getattr(workspace, "trip", None)
    if trip is None:
        return None

    try:
        parsed = detect_add_place_intent(message)
        if not parsed:
            return None
        category, day_number = parsed

        day = _find_day(trip, day_number)
        if day is None:
            return None

        destination_text = day.get("city") or ""
        if not destination_text:
            return None

        results, error = _run_search(category, destination_text, limit=1)
        if error or not results:
            return None
        block = _build_place_block(results[0], category)

        proposal_title = f'Add "{block["title"]}" to day {day_number}'
        already_open = workspace.proposals.filter(
            is_deleted=False, status=PlanProposal.STATUS_OPEN,
            kind=PlanProposal.KIND_PLAN_EDIT, title=proposal_title,
        ).exists()
        if already_open:
            return None

        updated_day = dict(day)
        updated_day["activities"] = [*(day.get("activities") or []), block]

        return PlanProposal.objects.create(
            workspace=workspace,
            kind=PlanProposal.KIND_PLAN_EDIT,
            title=proposal_title,
            rationale=f'From chat: add "{block["title"]}" ({destination_text}) to day {day_number}. Accept to add it.',
            diff={"before": {"days": [day]}, "after": {"days": [updated_day]}, "deltas": {}},
            created_by="agent",
            base_trip_updated_at=trip.updated_at,
        )
    except Exception:
        return None


# ── Swap one named block for a different real result (Phase 1) ──────────

_CATEGORY_WORD_TO_BLOCK_CATEGORY = {
    "hotel": "hotel", "stay": "hotel",
    "dinner": "food", "lunch": "food", "breakfast": "food", "restaurant": "food", "meal": "food",
}

_SWAP_BLOCK_RE = re.compile(
    r"^(?:swap|change|replace)\s+(?:my\s+|the\s+)?(.+?)\s+(?:for|with|to)\s+.+?[.!]?$", re.IGNORECASE
)


def detect_swap_block_intent(message):
    """Returns the target-block phrase, or None. Deliberately never parses
    what the message says the replacement SHOULD be — see module docstring."""
    m = _SWAP_BLOCK_RE.match((message or "").strip())
    if not m:
        return None
    fragment = m.group(1).strip()
    return fragment or None


def _find_swap_target(trip, fragment):
    """Finds the ONE block a swap phrase refers to. Tries an exact
    category-word match first ("my hotel" -> the trip's one active hotel
    block, if there's exactly one), then falls back to the same
    unique-title-fragment match retime already uses. More than one active
    block in that category is ambiguous — decline rather than guess which
    one ("swap my dinner" on an 8-day trip has 8 candidates)."""
    fragment_lower = fragment.strip().lower()
    for word, category in _CATEGORY_WORD_TO_BLOCK_CATEGORY.items():
        if word in fragment_lower:
            matches = []
            for day in trip.days or []:
                for act in day.get("activities") or []:
                    if act.get("is_active") is False or act.get("status") == "inactive":
                        continue
                    if (act.get("category") or "").lower() == category:
                        matches.append((day, act))
            if len(matches) == 1:
                return matches[0]
            if len(matches) > 1:
                return None
    return _find_unique_active_block(trip, fragment)


def propose_swap_block_from_chat(workspace, message):
    """
    Files a proposal replacing ONE unambiguous existing block with a
    different real place in the same category and city, via real search.
    Preserves the slot id (this is a swap, not an add-plus-remove), so a
    booked/locked target is protected by accept_proposal's
    commitment-hierarchy guard exactly like any other change to it.
    """
    from apps.planner.models import PlanProposal
    from apps.planner.services.capabilities.search import _run_search

    trip = getattr(workspace, "trip", None)
    if trip is None:
        return None

    try:
        fragment = detect_swap_block_intent(message)
        if not fragment:
            return None

        match = _find_swap_target(trip, fragment)
        if match is None:
            return None
        day, block = match

        search_category = _BLOCK_TO_SEARCH_CATEGORY.get((block.get("category") or "").lower())
        if search_category is None:
            return None  # transport/rest/hotel_return aren't swappable via this search

        destination_text = day.get("city") or ""
        if not destination_text:
            return None

        results, error = _run_search(search_category, destination_text, limit=5)
        if error or not results:
            return None
        current_title = (block.get("title") or "").strip().lower()
        candidate = next((r for r in results if (r.get("name") or "").strip().lower() != current_title), None)
        if candidate is None:
            return None

        replacement = _build_place_block(candidate, search_category, start_time=block.get("start_time"))
        replacement["end_time"] = block.get("end_time") or replacement["end_time"]
        replacement["id"] = block.get("id")  # preserve the slot id — a swap, not a new block

        proposal_title = f'Swap "{block.get("title")}" for "{replacement["title"]}"'
        already_open = workspace.proposals.filter(
            is_deleted=False, status=PlanProposal.STATUS_OPEN,
            kind=PlanProposal.KIND_PLAN_EDIT, title=proposal_title,
        ).exists()
        if already_open:
            return None

        updated_day = dict(day)
        updated_day["activities"] = [
            replacement if a.get("id") == block.get("id") else a for a in (day.get("activities") or [])
        ]

        return PlanProposal.objects.create(
            workspace=workspace,
            kind=PlanProposal.KIND_PLAN_EDIT,
            title=proposal_title,
            rationale=(
                f'From chat: swap "{block.get("title")}" for "{replacement["title"]}" '
                f"({destination_text}). Accept to apply it."
            ),
            diff={"before": {"days": [day]}, "after": {"days": [updated_day]}, "deltas": {}},
            created_by="agent",
            base_trip_updated_at=trip.updated_at,
        )
    except Exception:
        return None
