"""
Contextual proactive offers — "intent is fixed, but the AI is never shy."

The main thread only ever asks the intent's own clusters; offers are how
adjacent value shows up (hotel_only → what's around the stay; a one-way
flight → a hotel at the destination), keyed by intent × visit_purpose so a
honeymoon gets sunset dinners, a family gets kid-friendly ideas — never a
generic card.

Calm rules:
  - Max ONE offer per turn, and only on turns where the user just advanced
    the draft (a widget submit/skip), never on browse turns.
  - Each offer id fires at most once per trip (metadata["offers_shown"]);
    declines recorded in metadata["offers_declined"] as an extra guard.
  - Rides the existing capability envelope + producers, so it inherits the
    MAX_CAPABILITIES_PER_TURN cap and the honest-degrade discipline.
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
    INTENT_ACTIVITIES_ONLY,
    INTENT_FOOD_AND_DINING,
)
from apps.planner.services.intelligence.clusters import cluster_satisfied

_TRANSPORT_INTENTS = (INTENT_FLIGHT_ONLY, INTENT_TRAIN_ONLY, INTENT_BUS_ONLY, INTENT_CAB_ONLY, INTENT_CRUISE_ONLY)

# Each offer: fires once, when its `after` cluster is satisfied for a
# matching intent (and purpose, when set). `cap` names an existing
# capability producer; `title`/`reason`/`chip` ride in data["offer"].
_OFFER_SPECS: List[Dict[str, Any]] = [
    # hotel_only — purpose-flavored, else generic "around your stay"
    {"id": "hotel_honeymoon_dining", "intents": (INTENT_HOTEL_ONLY, INTENT_FULL_TRIP), "purposes": ("honeymoon",),
     "after": ("stay_style", "logistics"), "cap": "search_restaurants",
     "title": "Sunset dinner ideas", "reason": "A honeymoon deserves one unforgettable dinner — these are the romantic picks nearby.",
     "chip": "Show romantic dinners"},
    {"id": "hotel_family_kids", "intents": (INTENT_HOTEL_ONLY, INTENT_FULL_TRIP), "purposes": ("family",),
     "after": ("stay_style", "logistics"), "cap": "search_attractions",
     "title": "Kid-friendly nearby", "reason": "Traveling with the family — these spots keep the kids happy.",
     "chip": "Kid-friendly ideas"},
    {"id": "hotel_arrival_nearby", "intents": (INTENT_HOTEL_ONLY,), "purposes": None,
     "after": ("stay_style",), "cap": "nearby_search",
     "title": "Around your stay", "reason": "Worth knowing what's within reach of the hotel — and I can line up a cab from the station or airport if you tell me how you're arriving.",
     "chip": "What's near the hotel?"},
    # one-way transport — offer the stay
    {"id": "transport_hotel_offer", "intents": _TRANSPORT_INTENTS, "purposes": None,
     "after": ("journey_style",), "cap": "search_hotels",
     "title": "Need a stay there too?", "reason": "Since you're headed there anyway — a few well-rated stays at your destination.",
     "chip": "Find hotels there"},
    # activities → refuel; dining → make an evening of it
    {"id": "activities_dining", "intents": (INTENT_ACTIVITIES_ONLY,), "purposes": None,
     "after": ("trip_style", "party"), "cap": "search_restaurants",
     "title": "Refuel spots", "reason": "Good food near the action — worth planning the meals around the activities.",
     "chip": "Food near the activities"},
    {"id": "dining_attractions", "intents": (INTENT_FOOD_AND_DINING,), "purposes": None,
     "after": ("dining", "party"), "cap": "search_attractions",
     "title": "Make an evening of it", "reason": "Pair the meal with something nearby — these are close to the food scene.",
     "chip": "What's nearby?"},
]


def _shown(meta: dict) -> set:
    return set(meta.get("offers_shown") or []) | set(meta.get("offers_declined") or [])


def record_offer_declined(draft, offer_id: str) -> None:
    if not draft.metadata:
        draft.metadata = {}
    declined = set(draft.metadata.get("offers_declined") or [])
    declined.add(offer_id)
    draft.metadata["offers_declined"] = sorted(declined)


def next_offer(draft) -> Optional[Dict[str, Any]]:
    """
    The single best unshown offer whose moment has arrived, as a capability
    envelope (data["offer"] = {id, title, reason, chip}), or None. Marks the
    offer as shown on the draft (caller saves the draft as part of the turn).
    """
    intent = draft.intent or INTENT_FULL_TRIP
    meta = draft.metadata or {}
    if not draft.destination_text:
        return None
    already = _shown(meta)
    purpose = meta.get("visit_purpose")

    for spec in _OFFER_SPECS:
        if spec["id"] in already:
            continue
        if intent not in spec["intents"]:
            continue
        if spec["purposes"] is not None and purpose not in spec["purposes"]:
            continue
        if not any(cluster_satisfied(draft, c, intent) for c in spec["after"]):
            continue

        envelope = _produce(spec, draft)
        if not envelope:
            continue

        envelope.setdefault("data", {})["offer"] = {
            "id": spec["id"],
            "title": spec["title"],
            "reason": spec["reason"],
            "chip": spec["chip"],
        }
        if not draft.metadata:
            draft.metadata = {}
        shown = set(draft.metadata.get("offers_shown") or [])
        shown.add(spec["id"])
        draft.metadata["offers_shown"] = sorted(shown)
        return envelope
    return None


def _produce(spec: Dict[str, Any], draft) -> Optional[Dict[str, Any]]:
    try:
        from apps.planner.services.capabilities import search as _search
        producers = {
            "search_hotels": _search.search_hotels,
            "search_restaurants": _search.search_restaurants,
            "search_attractions": _search.search_attractions,
            "nearby_search": _search.nearby_search,
        }
        producer = producers.get(spec["cap"])
        if producer is None:
            return None
        return producer(destination_text=draft.destination_text or "")
    except Exception as exc:
        print(f"[Intelligence] offer '{spec['id']}' producer failed (non-fatal): {exc}")
        return None


def active_offer_chip(draft) -> Optional[str]:
    """Chip text for the most recently shown, not-declined offer (for views)."""
    meta = draft.metadata or {}
    shown = meta.get("offers_shown") or []
    declined = set(meta.get("offers_declined") or [])
    for offer_id in reversed(shown):
        if offer_id in declined:
            continue
        for spec in _OFFER_SPECS:
            if spec["id"] == offer_id:
                return spec["chip"]
    return None
