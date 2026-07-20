"""
Planning confidence — visible to the user AND used by the AI.

Replaces the flat percent-plus-sentence with a structured object:

    {"score": 0-100,
     "explanation": str,                       # back-compat sentence
     "factors": [{"label": "Dates confirmed", "state": "confirmed"},
                 {"label": "Hotel preference", "state": "missing"}, ...]}

States: "confirmed" (widget-submitted / user-stated / locked),
        "inferred"  (present via loose extraction — shown with a badge and
                     editable on the Trip Review Card),
        "missing".

The score keeps the exact weights of the old
ConversationEngine._calculate_confidence so existing UX thresholds
(e.g. the ≥85 create-plan highlight) stay meaningful.
"""

from typing import Any, Dict, List

from apps.planner.models import (
    INTENT_FULL_TRIP,
    INTENT_RECOMMENDED_FIELDS,
    INTENT_REQUIRED_FIELDS,
)

_OPTIONAL_WEIGHTS = {
    "travelers":    5,
    "budget":       8,
    "train_class":  8, "cabin_class":   8, "car_type":     8,
    "flight_class": 8, "preferred_mode": 8, "vehicle_type": 6,
    "interests":    7,
    "time_window":  4,
    "meal_preference": 3, "meal_type": 3,
    "bus_type":     3, "journey_timing": 2, "tatkal": 2,
    "transmission": 2, "non_stop": 2, "return_trip": 2,
    "star_rating":  4, "stay_amenities": 3, "property_type": 2,
    "dining_package": 3, "ambiance": 2, "cuisine": 3, "dietary": 2,
    "trip_pace":    3, "intensity_level": 3, "priority": 3,
}

# Which cluster's confirmation (clusters_done / legacy flag) marks a field
# as user-confirmed rather than merely extracted.
_FIELD_CONFIRMING_FLAGS = {
    "budget": ("budget_submitted",),
    "trip_pace": ("trip_preferences_submitted",),
    "interests": ("activity_preferences_submitted",),
    "preferred_mode": ("transport_selection_submitted",),
    "star_rating": ("accommodation_preferences_submitted",),
    "property_type": ("accommodation_preferences_submitted",),
    "dietary": ("food_preferences_submitted",),
    "cuisine": ("food_preferences_submitted",),
}

_FIELD_CLUSTERS = {
    "origin": ("party",),
    "travelers": ("party",),
    "visit_purpose": ("party",),
    "budget": ("trip_style", "stay_style", "journey_style", "dining"),
    "trip_pace": ("trip_style",),
    "interests": ("trip_style",),
    "preferred_mode": ("logistics", "journey_style"),
    "star_rating": ("logistics", "stay_style"),
    "property_type": ("logistics", "stay_style"),
}


def _field_state(draft, field: str) -> str:
    """confirmed | inferred | missing for one (possibly composite) field."""
    from apps.planner.services.intelligence.clusters import field_filled

    meta = draft.metadata or {}
    if not field_filled(draft, field):
        return "missing"

    locked = set(meta.get("locked_fields") or [])
    if field in locked or (field == "travelers" and "travelers" in locked):
        return "confirmed"
    for flag in _FIELD_CONFIRMING_FLAGS.get(field, ()):
        if meta.get(flag):
            return "confirmed"
    done = set(meta.get("clusters_done") or [])
    if meta.get("optional_submitted"):
        return "confirmed"
    for cluster in _FIELD_CLUSTERS.get(field, ()):
        if cluster in done:
            return "confirmed"
    return "inferred"


def build_confidence(draft) -> Dict[str, Any]:
    intent = draft.intent or INTENT_FULL_TRIP
    meta = draft.metadata or {}
    score = 0
    notes: List[str] = []
    factors: List[Dict[str, str]] = []

    # --- Core slots (destination/dates are explicit by construction) ---
    if draft.destination_text:
        score += 20
        notes.append(f"destination: {draft.destination_text}")
        factors.append({"label": "Destination", "state": "confirmed"})
    else:
        factors.append({"label": "Destination", "state": "missing"})

    if draft.start_date and draft.end_date:
        score += 20
        notes.append("dates: set")
        factors.append({"label": "Travel dates", "state": "confirmed"})
    else:
        factors.append({"label": "Travel dates", "state": "missing"})

    # Origin is RELEVANT (a factor row + score weight) whether it's a
    # generation blocker (transit intents) or merely recommended (full trip)
    # — the CH-04 required/recommended split changed gating, not the
    # checklist the user sees (required ∪ recommended equals the old set).
    required = INTENT_REQUIRED_FIELDS.get(intent, [])
    recommended = INTENT_RECOMMENDED_FIELDS.get(intent, [])
    if "origin" in required or "origin" in recommended:
        state = _field_state(draft, "origin")
        factors.append({"label": "Departure city", "state": state})
        if state != "missing":
            score += 10
            notes.append(f"origin: {meta.get('origin')}")
    else:
        score += 10  # origin not relevant for this intent

    # --- Visit purpose (most impactful optional) ---
    purpose_state = _field_state(draft, "visit_purpose")
    factors.append({"label": "Trip purpose", "state": purpose_state})
    if purpose_state != "missing":
        score += 15
        notes.append(f"purpose: {meta.get('visit_purpose')}")

    # --- Weighted optionals (same math as the legacy score) ---
    for field, weight in _OPTIONAL_WEIGHTS.items():
        filled = False
        if field == "travelers" and draft.adults and meta.get("travelers_set"):
            filled = True
        elif field == "budget" and (draft.budget_tier or meta.get("budget_inr")):
            filled = True
        elif field == "interests" and draft.interests:
            filled = True
        elif field in meta and meta[field] is not None:
            filled = True
        if filled:
            score += weight
            notes.append(field)

    score = min(score, 100)

    # --- User-facing factor rows for the remaining headline slots ---
    for label, field in (
        ("Travelers", "travelers"),
        ("Budget", "budget"),
    ):
        factors.append({"label": label, "state": _field_state(draft, field)})
    if intent in (INTENT_FULL_TRIP, "transit_only"):
        factors.append({"label": "Transport mode", "state": _field_state(draft, "preferred_mode")})
    if intent in (INTENT_FULL_TRIP, "hotel_only"):
        factors.append({"label": "Stay preference", "state": _field_state(draft, "stay_style")})
    if intent in ("flight_only", "train_only", "bus_only", "cab_only", "car_rental", "cruise_only"):
        factors.append({"label": "Journey preference", "state": _field_state(draft, "journey_style")})
    if intent in (INTENT_FULL_TRIP, "activities_only"):
        factors.append({"label": "Interests", "state": _field_state(draft, "interests")})

    if score >= 95:
        explanation = "You're all set! Everything looks perfect — ready to create your plan whenever you are."
    elif score >= 85:
        explanation = f"Almost perfect! {', '.join(notes[:2])} confirmed. Just one more preference and you're ready."
    elif score >= 65:
        explanation = f"Looking good! {', '.join(notes[:2])} locked in. Add a couple of preferences to sharpen the recommendations."
    elif score >= 50:
        explanation = "Destination and dates are locked. Share your preferences to get more personalised recommendations."
    else:
        explanation = "Let's start by picking a destination and travel dates."

    return {"score": score, "explanation": explanation, "factors": factors}
