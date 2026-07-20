"""Deterministic guard separating answer-only turns from trip mutations."""

import re

_CHANGE = re.compile(
    r"\b(use|change|move|set|switch|replace|add|remove|drop|extend|make|shift|"
    r"reschedule|cancel|book|lock|unlock|update|choose|select)\b",
    re.IGNORECASE,
)
_QUESTION = re.compile(
    r"^\s*(is|are|was|were|would|should|could|can|do|does|did|what|when|where|"
    r"why|how|which|who|will|tell me|compare|explain)\b",
    re.IGNORECASE,
)


def is_answer_only_turn(message: str, structured_value=None) -> bool:
    """Questions do not mutate unless they contain explicit change language."""
    if structured_value:
        return False
    text = (message or "").strip()
    if not text or _CHANGE.search(text):
        return False
    return bool("?" in text or _QUESTION.search(text))


# Browse capabilities that are informational lookups — a turn firing only
# these must never mutate the draft (audit CH-12: "hotels in Goa" mid-intake
# used to fire the search card AND let extraction hijack the destination).
# edit_plan / monitor_price express change/standing intent and are excluded
# (their trigger regexes contain change verbs, which _CHANGE catches anyway).
_INFORMATIONAL_CAPS = {
    "search_hotels", "search_restaurants", "search_attractions", "nearby_search",
    "weather", "flight_status", "train_running_status", "forex",
    "exchange_calculator", "distance",
}


def is_browse_only_turn(message: str, structured_value=None) -> bool:
    """A browse/lookup request with no explicit change language: surface the
    capability card, answer, and leave the trip state untouched."""
    if structured_value:
        return False
    text = (message or "").strip()
    if not text or _CHANGE.search(text):
        return False
    from apps.planner.services.capabilities.router import classify_turn

    return any(cap in _INFORMATIONAL_CAPS for cap in classify_turn(text))
