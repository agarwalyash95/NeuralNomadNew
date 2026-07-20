"""Shared planner-foundation contracts.

These helpers deliberately contain no alternate trip state.  They annotate
the existing canonical draft/job/trip pipeline with priority, provenance,
freshness, semantic-widget and bounded-usage rules.
"""

from __future__ import annotations

from dataclasses import dataclass, field
import time
from typing import Any, Dict, Iterable, List, Optional

from django.conf import settings


PROVENANCE_VALUES = {
    "live_provider",
    "cached_provider",
    "verified_database",
    "estimated",
    "ai_recommended",
    "fallback",
}
FRESHNESS_VALUES = {"live", "fresh", "stale", "unknown"}
AVAILABILITY_VALUES = {"available", "limited", "unavailable", "unverified"}


COMMITMENT_LEVELS = {
    "safety": 1,
    "booked": 2,
    "locked": 3,
    "core_fact": 4,
    "trip_preference": 5,
    "trip_rejection": 6,
    "profile_preference": 7,
    "ai_default": 8,
    "ranking": 9,
}


def can_override(existing_level: int, proposed_level: int) -> bool:
    """A smaller hierarchy number is stronger and cannot be overwritten."""
    return proposed_level <= existing_level


def evidence(
    *,
    provenance: str,
    freshness: str = "unknown",
    availability: str = "unverified",
    source_name: str = "",
    as_of=None,
    expires_at=None,
    confidence: Optional[float] = None,
    verification_action: Optional[str] = None,
) -> Dict[str, Any]:
    if provenance not in PROVENANCE_VALUES:
        provenance = "fallback"
    if freshness not in FRESHNESS_VALUES:
        freshness = "unknown"
    if availability not in AVAILABILITY_VALUES:
        availability = "unverified"
    return {
        "provenance": provenance,
        "freshness": freshness,
        "booking_availability": availability,
        "source_name": source_name,
        "as_of": as_of.isoformat() if hasattr(as_of, "isoformat") else as_of,
        "expires_at": expires_at.isoformat() if hasattr(expires_at, "isoformat") else expires_at,
        "confidence": confidence,
        "verification_action": verification_action,
    }


WIDGET_ANSWER_INTENTS = {
    "destination_search": {"destination"},
    "origin_search": {"origin"},
    "date_range_picker": {"travel_dates"},
    "cluster_party": {"party", "origin", "travelers", "visit_purpose"},
    "cluster_trip_style": {"budget", "trip_style", "interests"},
    "cluster_logistics": {"transport_preference", "stay_style"},
    "cluster_stay_style": {"stay_style", "budget"},
    "cluster_journey_style": {"journey_style", "transport_preference", "budget"},
    "cluster_dining": {"dining"},
    "cluster_fine_tune": {"fine_tune", "accessibility", "special_requirements"},
    "nearby_cities_recommendation": {"nearby_excursions"},
    "self_drive_openness": {"self_drive_openness"},
    "self_drive_readiness": {"self_drive_readiness"},
    "self_drive_route_comfort": {"self_drive_route_comfort"},
    "plan_confirmation_widget": {"plan_confirmation", "fine_tune"},
}

WIDGET_ANSWER_FIELDS = {
    "destination_search": ["destination"],
    "origin_search": ["origin"],
    "date_range_picker": ["start_date", "end_date"],
    "cluster_party": ["origin", "travelers", "children", "visit_purpose"],
    "cluster_trip_style": ["budget", "trip_pace", "interests"],
    "cluster_logistics": ["preferred_mode", "star_rating", "property_type"],
    "cluster_stay_style": ["budget", "star_rating", "property_type", "stay_amenities"],
    "cluster_journey_style": ["budget", "preferred_mode", "journey_preferences"],
    "cluster_dining": ["meal_type", "cuisine", "dietary", "ambiance", "budget"],
    "cluster_fine_tune": ["dietary", "accessibility", "special_notes"],
    "nearby_cities_recommendation": ["nearby_cities"],
    "self_drive_openness": ["can_drive"],
    "self_drive_readiness": ["license_ready", "vehicle_access"],
    "self_drive_route_comfort": ["max_driving_hours", "night_driving", "mountain_experience"],
    "plan_confirmation_widget": ["confirmed", "fine_tune"],
}

PRIMARY_QUESTION_INTENT = {
    "cluster_party": "party",
    "cluster_trip_style": "trip_style",
    "cluster_logistics": "transport_preference",
    "cluster_stay_style": "stay_style",
    "cluster_journey_style": "journey_style",
    "cluster_dining": "dining",
    "cluster_fine_tune": "fine_tune",
    "plan_confirmation_widget": "plan_confirmation",
}


def decorate_widget(widget_type: str, payload: Optional[dict]) -> dict:
    data = dict(payload or {})
    intents = sorted(WIDGET_ANSWER_INTENTS.get(widget_type, {widget_type}))
    data.setdefault("answer_intents", intents)
    data.setdefault("question_intent", PRIMARY_QUESTION_INTENT.get(widget_type, intents[0]))
    data.setdefault("answer_fields", WIDGET_ANSWER_FIELDS.get(widget_type, list(data.get("fields") or [])))
    data.setdefault("required", widget_type in {"destination_search", "origin_search", "date_range_picker", "cluster_party"})
    data.setdefault("provenance", evidence(provenance="ai_recommended", source_name="planner_intelligence"))
    return data


def widget_semantically_matches(widget_type: Optional[str], payload: Optional[dict]) -> bool:
    if not widget_type:
        return True
    data = payload or {}
    question_intent = data.get("question_intent")
    allowed = set(data.get("answer_intents") or WIDGET_ANSWER_INTENTS.get(widget_type, []))
    return bool(question_intent and question_intent in allowed)


_INTENT_KEYWORDS = {
    "destination": {"destination", "where", "go"},
    "origin": {"depart", "from", "origin", "start"},
    "travel_dates": {"date", "when", "days", "trip window"},
    "party": {"traveling", "travelling", "people", "who", "occasion"},
    "budget": {"budget", "spend", "cost"},
    "trip_style": {"style", "pace", "interests", "budget"},
    "transport_preference": {"travel", "transport", "get there", "flight", "train", "drive"},
    "stay_style": {"stay", "hotel", "property"},
    "journey_style": {"journey", "class", "timing", "transport"},
    "dining": {"food", "dining", "cuisine", "meal"},
    "nearby_excursions": {"nearby", "excursion", "day trip", "add"},
    "self_drive_openness": {"drive", "self-drive", "self drive"},
    "self_drive_readiness": {"license", "vehicle", "rental", "drive"},
    "self_drive_route_comfort": {"driving", "hours", "night", "mountain", "comfort"},
    "plan_confirmation": {"create", "plan", "ready", "confirm"},
    "fine_tune": {"fine-tune", "adjust", "special", "anything else"},
}


def reply_semantically_matches(reply: str, payload: Optional[dict]) -> bool:
    """Conservative lexical guard after the routed reply call.

    Prompt routing is the primary guarantee; this catches a model reply that
    still asks about an unrelated decision before it can reach the user.
    """
    data = payload or {}
    intent = data.get("question_intent")
    if not intent or "?" not in (reply or ""):
        return True
    words = _INTENT_KEYWORDS.get(intent)
    if not words:
        return True
    lower = reply.lower()
    return any(word in lower for word in words)


@dataclass
class UsageBudget:
    max_ai_calls: int = field(default_factory=lambda: int(getattr(settings, "PLANNER_MAX_AI_CALLS", 3)))
    max_refinement_calls: int = field(default_factory=lambda: int(getattr(settings, "PLANNER_MAX_REFINEMENT_CALLS", 1)))
    max_tokens: int = field(default_factory=lambda: int(getattr(settings, "PLANNER_MAX_AI_TOKENS", 30000)))
    max_provider_calls: int = field(default_factory=lambda: int(getattr(settings, "PLANNER_MAX_PROVIDER_CALLS", 20)))
    ai_calls: int = 0
    refinement_calls: int = 0
    tokens: int = 0
    provider_calls: int = 0
    exhausted: List[str] = field(default_factory=list)
    started_monotonic: float = field(default_factory=time.monotonic)
    max_wall_seconds: int = field(default_factory=lambda: int(getattr(settings, "PLANNER_GENERATION_WALL_TIME_SECONDS", 120)))

    def wall_time_available(self) -> bool:
        if time.monotonic() - self.started_monotonic >= self.max_wall_seconds:
            self._exhaust("wall_time")
            return False
        return True

    def claim_ai(self, *, refinement: bool = False) -> bool:
        if not self.wall_time_available() or self.tokens >= self.max_tokens:
            if self.tokens >= self.max_tokens:
                self._exhaust("tokens")
            return False
        if self.ai_calls >= self.max_ai_calls:
            self._exhaust("ai_calls")
            return False
        if refinement and self.refinement_calls >= self.max_refinement_calls:
            self._exhaust("refinement_calls")
            return False
        self.ai_calls += 1
        if refinement:
            self.refinement_calls += 1
        return True

    def claim_provider(self) -> bool:
        if not self.wall_time_available():
            return False
        if self.provider_calls >= self.max_provider_calls:
            self._exhaust("provider_calls")
            return False
        self.provider_calls += 1
        return True

    def add_tokens(self, value: Any) -> None:
        try:
            self.tokens += int(value or 0)
        except (TypeError, ValueError):
            return
        if self.tokens >= self.max_tokens:
            self._exhaust("tokens")

    def _exhaust(self, key: str) -> None:
        if key not in self.exhausted:
            self.exhausted.append(key)

    def to_dict(self) -> dict:
        return {
            "ai_calls": self.ai_calls,
            "refinement_calls": self.refinement_calls,
            "tokens": self.tokens,
            "provider_calls": self.provider_calls,
            "limits": {
                "ai_calls": self.max_ai_calls,
                "refinement_calls": self.max_refinement_calls,
                "tokens": self.max_tokens,
                "provider_calls": self.max_provider_calls,
                "wall_time_seconds": self.max_wall_seconds,
            },
            "budget_exhausted": list(self.exhausted),
        }


class DecisionTrace:
    """Bounded append-only audit trace attached to PlanGenerationJob."""

    def __init__(self, entries: Optional[Iterable[dict]] = None, limit: int = 500):
        self.limit = limit
        self.entries = list(entries or [])[:limit]
        self.aggregates: Dict[str, int] = {}

    def add(self, event: str, **data: Any) -> None:
        if len(self.entries) < self.limit:
            self.entries.append({"event": event, **data})
        else:
            self.aggregates[event] = self.aggregates.get(event, 0) + 1

    def exclusion(self, reason: str, count: int = 1) -> None:
        key = f"excluded:{reason}"
        self.aggregates[key] = self.aggregates.get(key, 0) + count

    def to_list(self) -> List[dict]:
        result = list(self.entries)
        if self.aggregates and len(result) < self.limit:
            result.append({"event": "aggregate", "counts": dict(self.aggregates)})
        return result[: self.limit]
