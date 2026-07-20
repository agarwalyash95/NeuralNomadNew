"""
Canonical cluster / ladder vocabulary — the ONE source of truth consumed by
both the ConversationEngine (prompt sync, fallback labels, skip handling)
and the WidgetOrchestrator (widget routing).

A cluster = one real-world decision rendered as ONE compact card
(docs/master-planner-conversation-model.md §2). The per-intent ladder keeps
the conversation to at most 5 asks + 1 confirmation for full_trip, fewer for
single-service intents; dynamic auto-skip drops any cluster whose essential
fields the user already provided in text.
"""

from typing import Any, Dict, List, Optional

from apps.planner.models import (
    INTENT_FULL_TRIP,
    INTENT_HOTEL_ONLY,
    INTENT_FLIGHT_ONLY,
    INTENT_TRAIN_ONLY,
    INTENT_BUS_ONLY,
    INTENT_CAB_ONLY,
    INTENT_CRUISE_ONLY,
    INTENT_CAR_RENTAL,
    INTENT_TRANSIT_ONLY,
    INTENT_ACTIVITIES_ONLY,
    INTENT_FOOD_AND_DINING,
)

# The explicit 5-way mode choice the logistics card always presents — the AI
# recommends one, the user can always pick any other.
MODE_CHOICES = ["flight", "train", "bus", "cab", "self_drive"]

CLUSTER_DEFS: Dict[str, Dict[str, Any]] = {
    "party": {
        "label": "Who's traveling",
        "hint": "Who's coming, and what's the occasion? I'll shape pace and comfort around it.",
        "fields": ["origin", "travelers", "visit_purpose"],
    },
    "trip_style": {
        "label": "Budget & style",
        "hint": "A budget and vibe lets me pick the right hotels, food, and pace.",
        "fields": ["budget", "trip_pace", "interests"],
    },
    "logistics": {
        "label": "Travel & stay",
        "hint": "How do you want to get there, and what kind of stay suits you?",
        "fields": ["preferred_mode", "star_rating", "property_type"],
    },
    "stay_style": {
        "label": "Your stay",
        "hint": "Pick the stay style — I'll match neighborhoods and properties to it.",
        "fields": ["budget", "star_rating", "property_type", "stay_amenities"],
    },
    "journey_style": {
        "label": "Journey preferences",
        "hint": "A couple of journey details and I can quote exact options.",
        # Resolved per intent — see JOURNEY_FIELDS_BY_INTENT.
        "fields": [],
    },
    "dining": {
        "label": "Dining preferences",
        "hint": "Food style locks in — then I can point at actual places.",
        "fields": ["meal_type", "cuisine", "dietary", "ambiance", "budget"],
    },
    # NEVER pushed as a ladder step — offered only inside the Trip Review
    # Card and via an optional suggestion chip. Skipping costs nothing.
    "fine_tune": {
        "label": "Fine-tune (optional)",
        "hint": "Optional extras — dietary needs, accessibility, budget split, anything special.",
        # Phase 5 (M4 depth): budget_split (optional per-category split) and
        # the interests/purpose free-text escape hatches ride here — genuinely
        # optional add-ons, not asks a full-trip traveler would expect
        # proactively (unlike dietary/accessibility, which now ride the
        # already-mandatory trip_style card instead — see
        # _TRIP_STYLE_FIELDS_BY_INTENT below).
        "fields": [
            "dietary", "cuisine", "accessibility", "special_notes",
            "budget_split", "interests_other", "visit_purpose_other",
        ],
    },
}

# Mode-specific journey fields (budget folded in — no separate budget ask).
JOURNEY_FIELDS_BY_INTENT: Dict[str, List[str]] = {
    INTENT_FLIGHT_ONLY: ["budget", "flight_class", "time_window", "non_stop"],
    INTENT_TRAIN_ONLY:  ["budget", "train_class", "journey_timing", "tatkal"],
    INTENT_BUS_ONLY:    ["budget", "bus_type", "journey_timing"],
    INTENT_CAB_ONLY:    ["vehicle_type", "return_trip", "budget"],
    INTENT_CAR_RENTAL:  ["car_type", "transmission", "budget"],
    INTENT_CRUISE_ONLY: ["budget", "cabin_class", "dining_package"],
    INTENT_TRANSIT_ONLY: ["budget", "preferred_mode", "priority"],
}

# Intents where the party card must NOT ask for a departure city.
_NO_ORIGIN_INTENTS = {
    INTENT_HOTEL_ONLY,
    INTENT_ACTIVITIES_ONLY,
    INTENT_FOOD_AND_DINING,
    INTENT_CRUISE_ONLY,
}

# activities_only swaps pace for intensity in the style card.
_TRIP_STYLE_FIELDS_BY_INTENT: Dict[str, List[str]] = {
    INTENT_ACTIVITIES_ONLY: ["interests", "intensity_level", "budget"],
    # Phase 5 (M4 depth): dietary/accessibility previously reached a
    # full-trip traveler only via the optional, easy-to-miss fine_tune
    # review-card expander (§A1 audit finding). Riding the trip_style
    # card — already mandatory-until-satisfied for every full trip — as
    # two more optional chip rows surfaces them proactively WITHOUT adding
    # a new ladder step: _CLUSTER_ESSENTIALS["trip_style"] below is
    # deliberately left as just ["budget"], so neither field can ever
    # block auto-skip or make this card newly required.
    INTENT_FULL_TRIP: ["budget", "trip_pace", "interests", "dietary", "accessibility"],
}

# Phase 5 (M4 depth): children's ages ride the party card (right where the
# child COUNT is already asked) for full trips only — same non-essential,
# purely-additive discipline as _TRIP_STYLE_FIELDS_BY_INTENT above.
_PARTY_FIELDS_BY_INTENT: Dict[str, List[str]] = {
    INTENT_FULL_TRIP: ["origin", "travelers", "visit_purpose", "children_ages"],
}

# Per-intent ladders: core slots → cluster asks → confirmation. A cluster
# step is auto-skipped when cluster_satisfied() is true, so the counts below
# are MAXIMUMS, not guarantees the user will be asked.
INTENT_LADDERS: Dict[str, List[str]] = {
    INTENT_FULL_TRIP:       ["destination", "dates", "party", "trip_style", "logistics", "nearby_cities", "confirmation"],
    INTENT_HOTEL_ONLY:      ["destination", "dates", "party", "stay_style", "confirmation"],
    INTENT_FLIGHT_ONLY:     ["destination", "dates", "party", "journey_style", "confirmation"],
    INTENT_TRAIN_ONLY:      ["destination", "dates", "party", "journey_style", "confirmation"],
    INTENT_BUS_ONLY:        ["destination", "dates", "party", "journey_style", "confirmation"],
    INTENT_CAB_ONLY:        ["destination", "dates", "party", "journey_style", "confirmation"],
    INTENT_CRUISE_ONLY:     ["destination", "dates", "party", "journey_style", "confirmation"],
    INTENT_CAR_RENTAL:      ["destination", "dates", "party", "journey_style", "confirmation"],
    INTENT_TRANSIT_ONLY:    ["destination", "dates", "party", "journey_style", "confirmation"],
    INTENT_ACTIVITIES_ONLY: ["destination", "dates", "party", "trip_style", "confirmation"],
    INTENT_FOOD_AND_DINING: ["destination", "dates", "party", "dining", "confirmation"],
}

# Kept for prompt/back-compat consumers that want "which clusters exist for
# this intent, in order" without the core slots.
INTENT_CLUSTER_ORDER: Dict[str, List[str]] = {
    intent: [s for s in steps if s in CLUSTER_DEFS]
    for intent, steps in INTENT_LADDERS.items()
}

# Essential fields per cluster — ALL must be satisfied for the cluster to be
# auto-skipped without the user seeing the card. Composites ("stay_style",
# "journey_style", "dining_signal") mirror missing_required_slots semantics.
_CLUSTER_ESSENTIALS: Dict[str, List[str]] = {
    "party":         ["travelers", "origin"],      # origin dropped when not asked
    "trip_style":    ["budget"],
    "logistics":     ["preferred_mode", "stay_style"],
    "stay_style":    ["stay_style"],
    "journey_style": ["journey_style"],
    "dining":        ["dining_signal"],
    "fine_tune":     [],                            # never a step
}

# Legacy per-widget submitted flags → the fields they covered. Old in-flight
# drafts (pre-cluster deploy) must never be re-asked (read-only mapping —
# nothing here is ever written).
_LEGACY_FLAG_FIELDS: Dict[str, List[str]] = {
    "budget_submitted":                  ["budget"],
    "trip_preferences_submitted":        ["trip_pace"],
    "activity_preferences_submitted":    ["interests"],
    "transport_selection_submitted":     ["preferred_mode"],
    "transport_preferences_submitted":   ["journey_style"],
    "accommodation_preferences_submitted": ["stay_style", "star_rating", "property_type", "stay_amenities"],
    "food_preferences_submitted":        ["dining_signal", "meal_type", "cuisine", "dietary", "ambiance"],
    "special_requirements_submitted":    ["accessibility", "special_notes"],
    "international_details_submitted":   ["passport_ready", "visa_status", "forex_needed"],
}

_JOURNEY_SIGNAL_FIELDS = [
    "flight_class", "train_class", "bus_type", "cabin_class",
    "car_type", "vehicle_type",
]

_DINING_SIGNAL_FIELDS = ["meal_type", "cuisine", "dietary"]


def cluster_fields(intent: str, cluster: str) -> List[str]:
    """The fields a cluster card collects for this intent."""
    if cluster == "journey_style":
        return list(JOURNEY_FIELDS_BY_INTENT.get(intent, ["budget", "preferred_mode"]))
    if cluster == "trip_style" and intent in _TRIP_STYLE_FIELDS_BY_INTENT:
        return list(_TRIP_STYLE_FIELDS_BY_INTENT[intent])
    if cluster == "party":
        fields = list(_PARTY_FIELDS_BY_INTENT.get(intent, CLUSTER_DEFS["party"]["fields"]))
        if intent in _NO_ORIGIN_INTENTS and "origin" in fields:
            fields.remove("origin")
        return fields
    return list(CLUSTER_DEFS.get(cluster, {}).get("fields", []))


def field_filled(draft, field: str) -> bool:
    """Is this (possibly composite) field already satisfied on the draft?"""
    meta = draft.metadata or {}
    if field == "travelers":
        return bool(draft.adults and meta.get("travelers_set"))
    if field == "budget":
        return bool(draft.budget_amount is not None or draft.budget_tier or meta.get("budget_inr"))
    if field == "interests":
        return bool(draft.interests or meta.get("interests"))
    if field == "origin":
        return bool(draft.origin_city_id or draft.origin_text or meta.get("origin"))
    if field == "stay_style":
        return bool(meta.get("star_rating") or meta.get("property_type"))
    if field == "journey_style":
        return any(meta.get(f) is not None for f in _JOURNEY_SIGNAL_FIELDS)
    if field == "dining_signal":
        return any(meta.get(f) is not None for f in _DINING_SIGNAL_FIELDS)
    return meta.get(field) is not None


def _legacy_flag_covers(meta: dict, field: str) -> bool:
    for flag, fields in _LEGACY_FLAG_FIELDS.items():
        if field in fields and meta.get(flag):
            return True
    return False


def _essential_satisfied(draft, field: str) -> bool:
    meta = draft.metadata or {}
    return field_filled(draft, field) or _legacy_flag_covers(meta, field)


def cluster_essentials(intent: str, cluster: str) -> List[str]:
    essentials = list(_CLUSTER_ESSENTIALS.get(cluster, []))
    if cluster == "party" and "origin" not in cluster_fields(intent, cluster):
        essentials = [f for f in essentials if f != "origin"]
    return essentials


def cluster_satisfied(draft, cluster: str, intent: Optional[str] = None) -> bool:
    """
    Dynamic auto-skip: a cluster step is satisfied (never shown) when the
    user already confirmed it, a legacy widget covered it, or every essential
    field arrived via text extraction ("Weekend Goa from Mumbai" fills
    dates/origin/purpose → party is skipped and the review card is the
    safety net where inferred values stay editable).
    """
    intent = intent or draft.intent or INTENT_FULL_TRIP
    meta = draft.metadata or {}
    if cluster in set(meta.get("clusters_done", [])):
        return True
    if meta.get("optional_submitted"):
        # The legacy mega-form covered every optional cluster.
        return True
    essentials = cluster_essentials(intent, cluster)
    if not essentials:
        return False
    return all(_essential_satisfied(draft, f) for f in essentials)


def unfilled_cluster_fields(draft, intent: str, cluster: str) -> List[str]:
    return [f for f in cluster_fields(intent, cluster) if not field_filled(draft, f)]


def nearby_cities_eligible(draft) -> bool:
    """
    Deterministic eligibility for the nearby-cities ladder step —
    intent=full_trip, destination AND dates both known, 3+ day trip, not
    already shown this session. Shared by WidgetOrchestrator (ladder
    routing) and ConversationEngine (prompt eligibility block) so there is
    exactly one gate, never left to the model to self-assess.
    """
    meta = draft.metadata or {}
    if meta.get("nearby_cities_shown"):
        return False
    if (draft.intent or INTENT_FULL_TRIP) != INTENT_FULL_TRIP:
        return False
    if not draft.destination_text:
        return False
    if not (draft.start_date and draft.end_date):
        return False
    return (draft.end_date - draft.start_date).days >= 3


def pending_clusters(draft) -> List[str]:
    """Cluster steps still ahead of the user, in ladder order (additive API)."""
    intent = draft.intent or INTENT_FULL_TRIP
    ladder = INTENT_LADDERS.get(intent, INTENT_LADDERS[INTENT_FULL_TRIP])
    return [
        step for step in ladder
        if step in CLUSTER_DEFS and not cluster_satisfied(draft, step, intent)
    ]
