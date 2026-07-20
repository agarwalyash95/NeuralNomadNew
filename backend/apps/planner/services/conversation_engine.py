import os
import json
import logging
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from typing import List, Optional, Dict, Any

logger = logging.getLogger(__name__)

from google import genai
from pydantic import BaseModel, Field
from django.utils.dateparse import parse_date

from apps.reference.models import City
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
    INTENT_OPTIONAL_FIELDS,
)


def safe_parse_date(val):
    if not val:
        return None
    if isinstance(val, date):
        return val
    if isinstance(val, datetime):
        return val.date()
    if isinstance(val, str):
        val = val.strip()
        if 'T' in val:
            val = val.split('T')[0]
        parsed = parse_date(val)
        if parsed:
            return parsed
        try:
            return date.fromisoformat(val)
        except ValueError:
            return None
    return None


INTENT_LABELS = {
    INTENT_FULL_TRIP:       "Full Trip Planning",
    INTENT_HOTEL_ONLY:      "Hotel Search",
    INTENT_FLIGHT_ONLY:     "Flight Search",
    INTENT_TRAIN_ONLY:      "Train Booking",
    INTENT_BUS_ONLY:        "Bus Booking",
    INTENT_CAB_ONLY:        "Cab / Taxi Booking",
    INTENT_CRUISE_ONLY:     "Cruise Booking",
    INTENT_CAR_RENTAL:      "Car Rental",
    INTENT_TRANSIT_ONLY:    "Transit (Mixed Transport)",
    INTENT_ACTIVITIES_ONLY: "Activities & Experiences",
    INTENT_FOOD_AND_DINING: "Food & Dining",
}

# Canonical cluster/ladder vocabulary + purpose/destination heuristics live
# in the Planner Intelligence Layer — ONE source of truth shared with the
# WidgetOrchestrator (services/intelligence/clusters.py).
from apps.planner.services.intelligence.clusters import CLUSTER_DEFS  # noqa: E402
from apps.planner.services.intelligence.recommendations import (  # noqa: E402
    PURPOSE_DEFAULTS,
    recommended_budget_inr,
)
from apps.planner.services.intelligence import (  # noqa: E402
    confidence as _intel_confidence,
    offers as _intel_offers,
    preferences as _intel_preferences,
    recommendations as _intel_recs,
)

# Deterministic keyword priors for intent-confidence (§1.2) — cheap,
# no-LLM signal for "did the detected intent actually match what the user
# said", distinct from confidence_score (trip-profile completeness).
_INTENT_KEYWORDS: Dict[str, List[str]] = {
    INTENT_FLIGHT_ONLY:     ["flight", "plane", "airfare", "fly", "airline"],
    INTENT_HOTEL_ONLY:      ["hotel", "stay", "accommodation", "resort", "hostel"],
    INTENT_TRAIN_ONLY:      ["train", "rail", "rajdhani", "shatabdi", "irctc", "vande bharat"],
    INTENT_BUS_ONLY:        ["bus", "coach", "volvo", "sleeper bus", "ksrtc"],
    INTENT_CAB_ONLY:        ["cab", "taxi", "uber", "ola", "outstation"],
    INTENT_CRUISE_ONLY:     ["cruise", "ship", "sailing", "port", "cordelia"],
    INTENT_CAR_RENTAL:      ["rent a car", "self-drive", "hire a car", "car rental"],
    INTENT_TRANSIT_ONLY:    ["how to get from", "transit", "transfer", "route"],
    INTENT_ACTIVITIES_ONLY: ["things to do", "activities", "tours", "experiences", "scuba", "rafting"],
    INTENT_FOOD_AND_DINING: ["restaurant", "food", "eat", "dine", "cuisine", "street food"],
}


@dataclass
class EngineResult:
    reply: str
    widgets: list
    commands: list
    extraction_tier: str
    missing_slots: list
    ready: bool
    detected_intent: str
    # Additive fields (docs/ai-chat-implementation-plan.md Phase 0) — old
    # callers that only read the fields above are unaffected.
    capabilities: list = field(default_factory=list)
    insights: list = field(default_factory=list)
    proposals: list = field(default_factory=list)
    intent_confidence: int = 70
    mode: str = "gathering"
    # Journey Feed (intelligence/journey_feed.py) — one ambient fact, or None.
    journey_fact: Optional[dict] = None
    # Observability (audit OBS-01 / checklist 0.1) — the ladder step the LLM
    # prompt's active-step instruction was built against, and which extraction
    # fields came back non-null this turn. Additive; consumed by turn_log.
    prompted_step: Optional[str] = None
    extracted_fields: list = field(default_factory=list)
    question_intent: Optional[str] = None


class NearbyCityRecommendation(BaseModel):
    city: str = Field(description="Name of the nearby city/destination.")
    distance: str = Field(description="Approximate travel distance or time from the main destination.")
    why_visit: str = Field(description="A brief, compelling reason why the user should visit this place.")
    recommended_duration: str = Field(description="Recommended duration, e.g. '1 Day'.")


class ExtraPreferences(BaseModel):
    train_class: Optional[str] = Field(
        default=None,
        description="Train seating/sleeper class, e.g. 'Sleeper', '3AC', '2AC', '1AC', 'Chair Car', 'Executive'."
    )
    cabin_class: Optional[str] = Field(
        default=None,
        description="Cruise cabin class, e.g. 'Interior', 'Oceanview', 'Balcony', 'Suite'."
    )
    car_type: Optional[str] = Field(
        default=None,
        description="Rental car type, e.g. 'Economy', 'Sedan', 'SUV', 'MUV', 'Luxury'."
    )
    preferred_mode: Optional[str] = Field(
        default=None,
        description="Preferred transit mode, e.g. 'Train', 'Bus', 'Ferry', 'Flight', 'Mixed'."
    )
    flight_class: Optional[str] = Field(
        default=None,
        description="Flight cabin class, e.g. 'Economy', 'Premium Economy', 'Business', 'First'."
    )
    vehicle_type: Optional[str] = Field(
        default=None,
        description="Cab/taxi vehicle type, e.g. 'Hatchback', 'Sedan', 'SUV', 'Luxury'."
    )
    time_window: Optional[str] = Field(
        default=None,
        description="Preferred travel time window, e.g. 'morning', 'afternoon', 'evening', 'any'."
    )
    bus_type: Optional[str] = Field(
        default=None,
        description="Bus type preference, e.g. 'Non-AC', 'AC Seater', 'AC Sleeper', 'Volvo'."
    )


class ContextUpdates(BaseModel):
    destination: Optional[str] = Field(
        default=None,
        description=(
            "Updated destination city — ONLY when the user explicitly changes where the trip goes "
            "('actually let's do Jaipur instead'). A mention of another city as an excursion, "
            "comparison, or question is NOT a destination change."
        ),
    )
    start_date: Optional[str] = Field(default=None, description="Updated trip start date (YYYY-MM-DD), only for an explicit date change")
    end_date: Optional[str] = Field(default=None, description="Updated trip end date (YYYY-MM-DD), only for an explicit date change")
    adults: Optional[int] = Field(default=None, description="Updated adult travelers count")
    children: Optional[int] = Field(default=None, description="Updated child travelers count")
    infants: Optional[int] = Field(default=None, description="Updated infant travelers count")
    budget_tier: Optional[str] = Field(default=None, description="Updated budget tier: budget | mid_range | premium")
    budget_inr: Optional[int] = Field(default=None, description="Updated budget amount in INR")
    interests: Optional[List[str]] = Field(default=None, description="Updated list of travel interests")
    origin: Optional[str] = Field(default=None, description="Updated departure / origin city")
    visit_purpose: Optional[str] = Field(default=None, description="Updated visit purpose")
    train_class: Optional[str] = Field(default=None, description="Updated train class")
    flight_class: Optional[str] = Field(default=None, description="Updated flight class")
    cabin_class: Optional[str] = Field(default=None, description="Updated cabin class")
    car_type: Optional[str] = Field(default=None, description="Updated car type")
    vehicle_type: Optional[str] = Field(default=None, description="Updated vehicle type")
    preferred_mode: Optional[str] = Field(default=None, description="Updated preferred mode")
    time_window: Optional[str] = Field(default=None, description="Updated time window")
    bus_type: Optional[str] = Field(default=None, description="Updated bus type")
    transmission: Optional[str] = Field(default=None, description="Updated car transmission")


class PreferenceReason(BaseModel):
    field: str = Field(description="Which decision this explains, e.g. 'budget', 'stay_style', 'destination'.")
    reason: str = Field(description="Short reason, e.g. 'values scenery over price'.")


class PreferenceSignals(BaseModel):
    values: Optional[List[str]] = Field(
        default=None,
        description=(
            "Short value tags the user revealed in free text (not a slot, a WHY). "
            "'I don't mind spending more if the view is amazing' → ['scenery']. "
            "'we love trying local food' → ['foodie']. Null if nothing new this turn."
        ),
    )
    avoid: Optional[List[str]] = Field(
        default=None,
        description="Things the user wants to avoid, e.g. ['crowds', 'nightlife'] from 'somewhere quiet, away from the crowds'.",
    )
    reasons: Optional[List[PreferenceReason]] = Field(
        default=None,
        description="The WHY behind a preference, tied to the field it affects — never invent one the user didn't imply.",
    )


class ExtractedTripData(BaseModel):
    detected_intent: Optional[str] = Field(
        default=None,
        description=(
            "The user's primary travel goal. Pick the MOST specific one that fits. "
            "Values: full_trip | hotel_only | flight_only | train_only | bus_only | "
            "cab_only | cruise_only | car_rental | transit_only | activities_only | food_and_dining. "
            "Detect from keywords: flight/plane/airfare/fly→flight_only, "
            "hotel/stay/accommodation/resort/hostel→hotel_only, "
            "train/rail/rajdhani/shatabdi/irctc/vande bharat→train_only, "
            "bus/coach/volvo/sleeper bus/ksrtc→bus_only, "
            "cab/taxi/uber/ola/outstation→cab_only, "
            "cruise/ship/sailing/port/cordelia→cruise_only, "
            "rent a car/self-drive/hire a car→car_rental, "
            "how to get from/transit/transfer/route→transit_only, "
            "things to do/activities/tours/experiences/scuba/rafting→activities_only, "
            "restaurant/food/eat/dine/cuisine/street food→food_and_dining. "
            "Default to full_trip if unclear."
        )
    )
    destination_text: Optional[str] = Field(
        default=None,
        description=(
            "The destination city or place extracted from the user's message. "
            "If user says 'flight to Bareilly' → 'Bareilly'. "
            "If user says 'I want to go to Paris' → 'Paris'. "
            "If user says 'trip to Goa' → 'Goa'. "
            "Set to null ONLY if no destination is mentioned at all."
        ),
    )
    start_date: Optional[str] = Field(
        default=None,
        description=(
            "ISO format start date (YYYY-MM-DD). Infer from natural language: "
            "'next weekend' → coming Friday/Saturday date, "
            "'next month' → first day of next month, "
            "'in August' → 2026-08-01, "
            "'on 15th July' → 2026-07-15. "
            "CRITICAL: Set to null if the user does NOT explicitly mention any date or timeline. Do NOT guess or hallucinate a date."
        ),
    )
    end_date: Optional[str] = Field(
        default=None,
        description=(
            "ISO format end date (YYYY-MM-DD). Calculate from duration if given: "
            "'5 days' from start → start + 5 days. "
            "'next weekend' → Sunday of that weekend. "
            "CRITICAL: Set to null if cannot be determined from user input. Do NOT hallucinate an end date."
        ),
    )
    adults: Optional[int] = Field(
        default=None,
        description="Number of adult travelers if mentioned ('2 people', '3 adults', 'family of 4', 'me and mom'=2, etc.).",
    )
    children: Optional[int] = Field(
        default=None,
        description="Number of child travelers if explicitly mentioned. Use 0 for an explicit correction to no children.",
    )
    infants: Optional[int] = Field(
        default=None,
        description="Number of infant travelers if explicitly mentioned. Use 0 for an explicit correction to no infants.",
    )
    budget_tier: Optional[str] = Field(
        default=None,
        description=(
            "Budget category. One of: budget | mid_range | premium. "
            "Infer: 'cheap/affordable/budget' → budget, 'moderate/standard' → mid_range, "
            "'luxury/5-star/premium' → premium."
        ),
    )
    interests: Optional[List[str]] = Field(
        default=None,
        description="List of travel interests if mentioned: food, nature, culture, shopping, adventure, relaxation, history, nightlife, beach, romantic, family.",
    )
    origin: Optional[str] = Field(
        default=None,
        description=(
            "Departure or origin city if mentioned. "
            "'from Mumbai to Goa' → 'Mumbai'. "
            "'Delhi to Agra train' → 'Delhi'. "
            "CRITICAL: Set to null if not EXPLICITLY mentioned. Do NOT guess or hallucinate the origin."
        ),
    )
    extra_preferences: Optional[ExtraPreferences] = Field(
        default=None,
        description=(
            "Intent-specific preferences. Set fields like train_class, cabin_class, flight_class, "
            "car_type, vehicle_type, preferred_mode, bus_type, time_window if mentioned."
        ),
    )
    visit_purpose: Optional[str] = Field(
        default=None,
        description=(
            "User's reason for this trip. Detect from context keywords: "
            "'client meeting'/'work'/'conference'/'office' → business, "
            "'home'/'family'/'parents'/'hometown'/'festival'/'back home' → hometown, "
            "'honeymoon'/'anniversary'/'romantic getaway' → honeymoon, "
            "'vacation'/'holiday'/'trip'/'getaway'/'leisure' → vacation, "
            "'emergency'/'urgent'/'asap'/'immediately'/'hospital' → emergency, "
            "'family trip'/'kids'/'school holiday'/'children' → family, "
            "'solo'/'backpacking'/'by myself'/'alone' → solo, "
            "'wedding'/'concert'/'event'/'festival' → event. "
            "Null if not determinable."
        )
    )
    budget_inr: Optional[int] = Field(
        default=None,
        description=(
            "If user mentions a budget in any currency, convert and store as INR integer. "
            "'₹1 lakh' → 100000, '$1000' → approximately 83000, '50k' → 50000, "
            "'1.5 lakh' → 150000. Null if not mentioned."
        )
    )
    context_updates: Optional[ContextUpdates] = Field(
        default=None,
        description=(
            "If the user's message CHANGES a previously answered slot (e.g. 'actually make it 3 people', "
            "'change to business class', 'update budget to premium', 'no wait Aug 10 instead'), "
            "set the updated fields in this object. "
            "This triggers a SILENT draft update — no widget is shown for changes stated explicitly in text."
        )
    )
    # Unused since the CH-01 turn-lifecycle fix (checklist 1.1): the reply is
    # generated by a SEPARATE call AFTER widget routing, so it can never
    # describe a different step than the card that renders. Kept optional for
    # schema/back-compat (old tests construct this model with reply set).
    reply: Optional[str] = Field(
        default=None,
        description="Unused — leave null. The conversational reply is produced by a separate call.",
    )
    nearby_cities: Optional[List[NearbyCityRecommendation]] = Field(
        default=None,
        description=(
            "2-3 REAL, SPECIFIC nearby city/day-trip suggestions. Populate this whenever the prompt below "
            "contains a '--- NEARBY CITIES ELIGIBLE ---' block (the backend has already confirmed this trip "
            "qualifies) — this is mandatory when that block is present, not optional. You may also populate it "
            "on your own judgment when intent=full_trip AND destination AND dates are both known AND the trip "
            "is 3+ days, even without that block. Use genuine travel knowledge (real towns, real distances). "
            "Set to null only when none of the above applies."
        ),
    )
    preference_signals: Optional[PreferenceSignals] = Field(
        default=None,
        description=(
            "Extract the WHY behind a preference whenever the user reveals one in free text — this is memory, "
            "not a slot. Only set when the message actually carries a reason; otherwise leave null."
        ),
    )
    # Both unused — the backend computes confidence deterministically
    # (services/intelligence/confidence.py); optional for back-compat only.
    confidence_score: Optional[int] = Field(
        default=None,
        description="Unused — leave null. Confidence is computed deterministically by the backend.",
    )
    confidence_explanation: Optional[str] = Field(
        default=None,
        description="Unused — leave null.",
    )


class TurnReply(BaseModel):
    """Schema for the reply-only call (LLM #2 of the turn lifecycle)."""

    reply: str = Field(
        description=(
            "Your conversational reply as the travel consultant — 2-3 sentences maximum, "
            "Three-Beat (acknowledge, one concrete give, one question for the ACTIVE STEP only)."
        )
    )


class ConversationEngine:
    def __init__(self):
        from apps.common.ai import get_genai_client
        self.client = get_genai_client()

    # ─────────────────────────────────────────────────────────────────────────
    # Public API
    # ─────────────────────────────────────────────────────────────────────────

    def process(self, draft, message, history=None, structured_value=None, persist=True):
        """
        The definitive turn lifecycle (audit CH-01, checklist 1.1):

            apply structured input → extract changes (LLM #1, no reply)
            → merge and validate → determine ONE final route/widget
            → generate the response FOR that final route (LLM #2) → persist

        The reply is always generated AFTER routing, against the widget that
        will actually render — never patched into an earlier reply. On any
        LLM failure the deterministic _fallback_reply(draft, widget) keeps
        the same guarantee.
        """
        extraction_tier = "ai"
        destination_was_set = bool(draft.destination_text)

        # ── Stage 1: apply any explicit widget submission first ──
        if structured_value:
            self._apply_structured_value(draft, structured_value)
            extraction_tier = "widget"

        widgets = []
        capabilities = []
        journey_fact = None
        detected_intent = draft.intent or INTENT_FULL_TRIP
        prior_intent = draft.intent
        intent_confidence = 70
        extracted_fields = []
        ai_data = None

        # ── Stage 2: extraction (LLM #1) + merge — no reply is produced here ──
        try:
            ai_data = self._call_gemini_extract(draft, message, history)
            extracted_fields = self._nonnull_extraction_fields(ai_data)
            detected_intent = ai_data.detected_intent or detected_intent
            intent_confidence = self._calculate_intent_confidence(ai_data, message, prior_intent)

            # Merge AI extractions into draft (includes context_updates)
            self._merge_ai_data(draft, ai_data, message)

            # AI reasoning memory (intelligence/preferences.py) — store WHY,
            # not just WHAT. Additive-only, never overwrites a user-stated
            # slot; feeds recommendation ranking + the prompt's PREFERENCES
            # block on later turns.
            _intel_preferences.merge_preference_signals(draft, ai_data.preference_signals)
        except Exception as e:
            logger.exception("[ConversationEngine] extraction call failed: %s", e)
            ai_data = None
            intent_confidence = 50

        # Deterministic confidence score — works with or without extraction
        confidence_score, confidence_explanation = self._calculate_confidence(draft)

        # ── Stage 3: route — the SINGLE widget decision, post-merge.
        # The orchestrator ladder is the sole widget authority.
        widget_type, widget_payload = self._determine_widget(draft, ai_data)
        if widget_type:
            from apps.planner.services.foundation import decorate_widget, widget_semantically_matches

            widget_payload = decorate_widget(widget_type, widget_payload)
            if not widget_semantically_matches(widget_type, widget_payload):
                widget_payload = decorate_widget(widget_type, {})
        # OBS-01: the step the reply below is generated for. By construction
        # this now always equals the emitted widget (step_mismatch == False).
        self._prompted_step = widget_type

        # ── Stage 4: respond FOR the routed widget (LLM #2) ──
        reply = None
        try:
            reply = self._call_gemini_reply(
                draft, message, history,
                widget_type=widget_type,
                widget_payload=widget_payload,
                ai_data=ai_data,
                structured_value=structured_value,
            )
        except Exception as e:
            logger.exception("[ConversationEngine] reply call failed: %s", e)
        if not reply:
            reply = self._fallback_reply(draft, widget_type)
        if widget_type:
            from apps.planner.services.foundation import reply_semantically_matches

            if not reply_semantically_matches(reply, widget_payload):
                reply = self._fallback_reply(draft, widget_type)

        # Turn Router (Phase 3) — browse/live capabilities are additive to
        # whatever cluster widget was chosen above; never replace it.
        try:
            capabilities = self._resolve_capabilities(draft, ai_data, message)
        except Exception as exc:
            logger.warning("[ConversationEngine] capability resolution failed (non-fatal): %s", exc)
            capabilities = []

        # Proactive contextual offer (intelligence/offers.py) — only when
        # the user just advanced the draft via a widget and no browse
        # capability was requested this turn. One offer max, each offer
        # fires once per trip; never an extra question.
        if structured_value and not capabilities:
            offer = _intel_offers.next_offer(draft)
            if offer:
                capabilities.append(offer)
            else:
                # Journey Feed (intelligence/journey_feed.py) — ambient
                # "Did you know…" delight, only when there's no offer to
                # show this turn either (calm: at most one bonus item).
                from apps.planner.services.intelligence import journey_feed as _intel_journey_feed

                journey_fact = _intel_journey_feed.next_fact(draft)

        # Plan-anytime (Phase 4, docs/master-planner-conversation-model.md
        # §5): "Create Plan" was never actually gated on the clusters —
        # is_ready_for_plan only needs destination + dates. This makes
        # that growth VISIBLE right when the user explicitly advanced the
        # draft (a cluster confirm/skip or a core slot), rather than
        # showing a static progress card on every mundane turn.
        explicit_change_fields = {"cluster_submit", "cluster_skip", "destination", "travel_dates", "origin"}
        if structured_value and structured_value.get("field") in explicit_change_fields and draft.destination_text:
            from apps.planner.services.capabilities.planning import trip_progress
            progress_capability = trip_progress(draft, confidence_score=confidence_score)
            capabilities = [progress_capability] + capabilities
        from apps.planner.services.capabilities.base import MAX_CAPABILITIES_PER_TURN
        capabilities = capabilities[:MAX_CAPABILITIES_PER_TURN]

        # Store confidence (score + explanation kept for back-compat;
        # factors power the ✓/• checklist UI and the review card's
        # "inferred" badges)
        if not draft.metadata:
            draft.metadata = {}
        draft.metadata["confidence_score"] = confidence_score
        draft.metadata["confidence_explanation"] = confidence_explanation
        draft.metadata["confidence_factors"] = self._last_confidence_factors
        draft.metadata["intent_confidence"] = intent_confidence

        if widget_type:
            widgets = [{"type": widget_type, "data": widget_payload or {}}]

        # Nearby-cities (excursion) is a first-class ladder step — the
        # orchestrator only shows the card when suggestions exist (a
        # model miss retries next turn instead of being a one-shot flip).
        if widget_type == "nearby_cities_recommendation" and (widget_payload or {}).get("suggestions"):
            draft.metadata["nearby_cities_shown"] = True

        # Living-chat hero card (docs/master-planner-conversation-model.md):
        # fires once, the turn destination first becomes known, alongside
        # whatever cluster ask follows — a GIVE, never a slot-filling ask.
        if not destination_was_set and draft.destination_text:
            try:
                highlight_payload = _intel_recs.destination_highlight_payload(draft)
                if highlight_payload:
                    widgets = [{"type": "destination_highlight", "data": highlight_payload}] + widgets
            except Exception as exc:
                logger.warning("[ConversationEngine] destination_highlight failed (non-fatal): %s", exc)

        if persist:
            draft.save()

        mode = "ready" if draft.is_ready_for_plan else "gathering"

        return EngineResult(
            reply=reply,
            widgets=widgets,
            commands=[],
            extraction_tier=extraction_tier,
            missing_slots=draft.missing_slots(),
            ready=draft.is_ready_for_plan,
            detected_intent=detected_intent,
            capabilities=capabilities,
            insights=[],
            proposals=[],
            intent_confidence=intent_confidence,
            mode=mode,
            journey_fact=journey_fact,
            prompted_step=self._prompted_step,
            extracted_fields=extracted_fields,
            question_intent=(widget_payload or {}).get("question_intent") if widget_type else None,
        )

    # OBS-01: which extraction fields the model returned non-null this turn.
    _EXTRACTION_FIELD_NAMES = (
        "detected_intent", "destination_text", "start_date", "end_date",
        "adults", "children", "infants", "budget_tier", "budget_inr",
        "interests", "origin", "visit_purpose",
    )

    def _nonnull_extraction_fields(self, ai_data):
        fields = [
            name for name in self._EXTRACTION_FIELD_NAMES
            if getattr(ai_data, name, None) is not None
        ]
        updates = getattr(ai_data, "context_updates", None)
        if updates is not None:
            try:
                update_keys = updates.model_dump(exclude_none=True).keys()
            except AttributeError:
                update_keys = updates.keys() if isinstance(updates, dict) else []
            fields.extend(f"context_updates.{k}" for k in update_keys)
        return fields

    # ─────────────────────────────────────────────────────────────────────────
    # Intent Confidence — deterministic, distinct from confidence_score
    # ─────────────────────────────────────────────────────────────────────────

    def _calculate_intent_confidence(self, ai_data, message, prior_intent):
        intent = ai_data.detected_intent or prior_intent or INTENT_FULL_TRIP
        msg = (message or "").lower()
        keyword_hit = any(kw in msg for kw in _INTENT_KEYWORDS.get(intent, []))

        score = 30
        if keyword_hit:
            score += 40
        if prior_intent and intent == prior_intent:
            score += 10
        if intent == INTENT_FULL_TRIP and not keyword_hit:
            score = min(score, 55)
        return max(0, min(100, score))

    # ─────────────────────────────────────────────────────────────────────────
    # Turn Router (Phase 3) — placeholder wired here so process() has a
    # stable call site; filled in once capability producers exist (Phase 2).
    # ─────────────────────────────────────────────────────────────────────────

    def _resolve_capabilities(self, draft, ai_data, message):
        from apps.planner.services.capabilities.router import resolve_capabilities

        return resolve_capabilities(draft, ai_data, message)

    # ─────────────────────────────────────────────────────────────────────────
    # Confidence Score — Deterministic Python Calculation
    # ─────────────────────────────────────────────────────────────────────────

    def _calculate_confidence(self, draft) -> tuple:
        """
        Deterministic confidence (AI estimate is ignored) — delegated to the
        Planner Intelligence Layer, which also produces the ✓/• factor
        checklist. Factors are stashed on the engine for process() to persist
        alongside the back-compat (score, explanation) pair.
        """
        conf = _intel_confidence.build_confidence(draft)
        self._last_confidence_factors = conf["factors"]
        return conf["score"], conf["explanation"]

    # ─────────────────────────────────────────────────────────────────────────
    # Recommended Budget Computation
    # ─────────────────────────────────────────────────────────────────────────

    # ─────────────────────────────────────────────────────────────────────────
    # Optional Form Prefill Builder
    # ─────────────────────────────────────────────────────────────────────────

    def _build_optional_prefilled(self, draft) -> dict:
        """Build the prefilled dict for the optional form widget from draft state + AI defaults."""
        meta = draft.metadata or {}
        purpose = meta.get("visit_purpose")
        defaults = PURPOSE_DEFAULTS.get(purpose or "vacation", PURPOSE_DEFAULTS["vacation"])

        budget_inr = meta.get("budget_inr") or recommended_budget_inr(draft, purpose)[0]

        return {
            # Core — from draft model fields
            "visit_purpose":   meta.get("visit_purpose"),
            "travelers":       draft.adults if draft.adults and draft.adults > 0 else defaults.get("travelers", 1),
            "children":        draft.children if draft.children else 0,
            "interests":       draft.interests if draft.interests else defaults.get("interests", []),
            "budget_inr":      budget_inr,
            "budget_tier":     draft.budget_tier or defaults.get("budget_tier"),
            "origin":          meta.get("origin"),

            # Intent-specific — from metadata first, then purpose defaults
            "train_class":     meta.get("train_class") or defaults.get("train_class"),
            "cabin_class":     meta.get("cabin_class") or defaults.get("cabin_class"),
            "car_type":        meta.get("car_type") or defaults.get("car_type"),
            "vehicle_type":    meta.get("vehicle_type") or defaults.get("car_type"),
            "flight_class":    meta.get("flight_class") or defaults.get("flight_class"),
            "preferred_mode":  meta.get("preferred_mode"),
            "time_window":     meta.get("time_window") or defaults.get("time_window"),
            "bus_type":        meta.get("bus_type"),
            "tatkal":          meta.get("tatkal", False),
            "meal_preference": meta.get("meal_preference"),
            "non_stop":        meta.get("non_stop", False),
            "journey_timing":  meta.get("journey_timing"),
            "return_trip":     meta.get("return_trip", False),
            "transmission":    meta.get("transmission"),
            "priority":        meta.get("priority"),
            "trip_pace":       meta.get("trip_pace"),
            "intensity_level": meta.get("intensity_level"),
            "star_rating":     meta.get("star_rating"),
            "stay_amenities":  meta.get("stay_amenities"),
            "property_type":   meta.get("property_type"),
            "dining_package":  meta.get("dining_package"),
            "meal_type":       meta.get("meal_type"),
            "cuisine":         meta.get("cuisine"),
            "dietary":         meta.get("dietary"),
            "ambiance":        meta.get("ambiance"),

            # Metadata for UI rendering
            "recommended_budget_inr": budget_inr,
            "purpose_defaults": {
                "train_class":  defaults.get("train_class"),
                "flight_class": defaults.get("flight_class"),
                "cabin_class":  defaults.get("cabin_class"),
                "car_type":     defaults.get("car_type"),
                "time_window":  defaults.get("time_window"),
                "travelers":    defaults.get("travelers"),
            }
        }

    # ─────────────────────────────────────────────────────────────────────────
    # Prompt building blocks shared by the extraction and reply calls
    # ─────────────────────────────────────────────────────────────────────────

    def _already_known_block(self, draft):
        """Canonical collected-state summary — the AI must never re-ask these."""
        meta = draft.metadata or {}
        already_known_lines = []
        if draft.destination_text:
            already_known_lines.append(f"Destination: {draft.destination_text}")
        if draft.start_date:
            already_known_lines.append(f"Start Date: {draft.start_date}")
        if draft.end_date:
            already_known_lines.append(f"End Date: {draft.end_date}")
        if draft.start_date and draft.end_date:
            already_known_lines.append(f"Duration: {(draft.end_date - draft.start_date).days} days")
        if meta.get("travelers_set"):
            already_known_lines.append(f"Travelers: {draft.adults} adults, {draft.children} children")
        if draft.budget_tier:
            already_known_lines.append(f"Budget Tier: {draft.budget_tier}")
        if meta.get("budget_inr"):
            already_known_lines.append(f"Budget (INR): ₹{meta['budget_inr']:,}")
        if draft.interests:
            already_known_lines.append(f"Interests: {', '.join(draft.interests)}")
        if meta.get("origin"):
            already_known_lines.append(f"Origin/Departure: {meta['origin']}")
        if meta.get("visit_purpose"):
            already_known_lines.append(f"Visit Purpose: {meta['visit_purpose']}")
        if meta.get("optional_submitted"):
            already_known_lines.append("Optional details: already submitted by user")
        if meta.get("nearby_cities"):
            already_known_lines.append(f"Nearby cities added: {', '.join(meta['nearby_cities'])}")
        for extra in ["train_class", "cabin_class", "car_type", "preferred_mode",
                      "flight_class", "vehicle_type", "time_window", "bus_type"]:
            if meta.get(extra):
                already_known_lines.append(f"{extra.replace('_', ' ').title()}: {meta[extra]}")

        return (
            "\n".join(f"  - {line}" for line in already_known_lines)
            if already_known_lines else "  - (nothing collected yet)"
        )

    def _real_options_block(self, draft):
        """Matching DB/cached transport+hotel options for the route/date — the
        only source the reply may quote specific services/prices from."""
        if not draft.destination_text:
            return ""
        meta = draft.metadata or {}
        dest_clean = draft.destination_text.strip()
        origin_clean = meta.get("origin", "").strip() if meta.get("origin") else ""
        travel_date = draft.start_date
        if not travel_date:
            travel_date = date.today() + timedelta(days=30)

        from apps.planner.services.intelligence.recommendations import (
            median_hotel_price_per_night,
            route_price_summary,
        )

        lines = []
        for mode, estimate in route_price_summary(draft).items():
            currency = estimate.get("currency") or ""
            unit = str(estimate.get("unit") or "").replace("_", " ")
            lines.append(
                f"{mode.title()} estimate: {currency} {estimate['price']:,} {unit} "
                f"({estimate.get('basis')}; as of {estimate.get('as_of') or 'unknown'})"
            )
        hotel_median = median_hotel_price_per_night(draft)
        if hotel_median is not None:
            lines.append(f"Accommodation estimate: INR {hotel_median:,} per room night (historical/official evidence)")
        return "\n".join(lines)

        from django.db.models import Q
        from apps.reference.models import TravelPriceHistory

        flights_qs = TravelPriceHistory.objects.filter(service_type='flight', date=travel_date)
        if origin_clean:
            flights_qs = flights_qs.filter(
                Q(airport_route__source__city__name__icontains=origin_clean) |
                Q(airport_route__source__iata_code__icontains=origin_clean)
            )
        if dest_clean:
            flights_qs = flights_qs.filter(
                Q(airport_route__destination__city__name__icontains=dest_clean) |
                Q(airport_route__destination__iata_code__icontains=dest_clean)
            )

        trains_qs = TravelPriceHistory.objects.filter(service_type='train', date=travel_date)
        if origin_clean:
            trains_qs = trains_qs.filter(
                Q(train_route__source__city__name__icontains=origin_clean) |
                Q(train_route__source__code__icontains=origin_clean)
            )
        if dest_clean:
            trains_qs = trains_qs.filter(
                Q(train_route__destination__city__name__icontains=dest_clean) |
                Q(train_route__destination__code__icontains=dest_clean)
            )

        buses_qs = TravelPriceHistory.objects.filter(service_type='bus', date=travel_date)
        if origin_clean:
            buses_qs = buses_qs.filter(bus_route__source__city__name__icontains=origin_clean)
        if dest_clean:
            buses_qs = buses_qs.filter(bus_route__destination__city__name__icontains=dest_clean)

        hotels_qs = TravelPriceHistory.objects.filter(service_type='hotel', date=travel_date)
        if dest_clean:
            hotels_qs = hotels_qs.filter(hotel__city__name__icontains=dest_clean)

        options_lines = []
        if flights_qs.exists():
            options_lines.append("Flights:")
            for item in flights_qs[:3]:
                options_lines.append(f"  - {item.provider} ({item.code}): Rs {int(item.price):,} (Economy), Duration: {item.details.get('duration')}, Departs: {item.details.get('departure_time')}")
        if trains_qs.exists():
            options_lines.append("Trains:")
            for item in trains_qs[:3]:
                classes_str = ", ".join(f"{c['class']}: Rs {int(c['price']):,}" for c in item.details.get('classes', []))
                options_lines.append(f"  - {item.provider} ({item.code}): {classes_str}, Duration: {item.details.get('duration')}, Departs: {item.details.get('departure_time')}")
        if buses_qs.exists():
            options_lines.append("Buses:")
            for item in buses_qs[:2]:
                options_lines.append(f"  - {item.provider} ({item.code}): Rs {int(item.price):,}, Duration: {item.details.get('duration')}")
        if hotels_qs.exists():
            options_lines.append("Hotels:")
            for item in hotels_qs[:3]:
                rooms_str = ", ".join(f"{r['name']}: Rs {int(r['price_per_night']):,}" for r in item.details.get('rooms', []))
                options_lines.append(f"  - {item.provider} (Stars: {item.details.get('stars')}): {rooms_str}")

        return "\n".join(options_lines)

    # Reply-side description of every routable step. None (post-confirmation)
    # gets its own entry so the reply never invents a next question.
    _WIDGET_STEP_DESCRIPTIONS = {
        "destination_search": "collecting the destination. GIVE one seasonal or fascinating fact relevant to where they might go. ASK a single open question: where do they want to go. Nothing about dates, origin, or travelers yet.",
        "date_range_picker": "collecting travel dates. GIVE season/weather/price context for the likely window. ASK a single question about their travel dates or trip length. Nothing about origin, travelers, or preferences yet.",
        "cluster_party": "the PARTY card (origin, traveler count, trip purpose — shown together as one card). GIVE a short acknowledgement of the destination/dates. ASK exactly ONE combined question, e.g. \"Who's joining you, and where are you traveling from?\" — never split this into two separate questions, and never mention budget, transport, or stay.",
        "cluster_trip_style": "the BUDGET & STYLE card (budget, pace, interests — one card). GIVE the ACTIVE CARD RECOMMENDATION below (the budget ballpark) in your own words. ASK ONE question about budget comfort or vibe — the card itself covers pace and interests, do not enumerate them in text.",
        "cluster_logistics": "the TRAVEL & STAY card (5-way transport mode choice + stay style — one card). GIVE the ACTIVE CARD RECOMMENDATION below (mode + stay reasoning). ASK ONE combined question, e.g. \"How do you want to get there, and what kind of stay suits you?\" — the card lists all 5 transport modes and stay options, do not list them yourself.",
        "cluster_stay_style": "the STAY card (budget, star rating, property type, amenities — one card). GIVE the ACTIVE CARD RECOMMENDATION below. ASK ONE question about the kind of stay they want.",
        "cluster_journey_style": "the JOURNEY card (mode-specific class/timing, budget folded in — one card). GIVE the ACTIVE CARD RECOMMENDATION below (real fare/duration when known). ASK ONE question about their preference for this leg.",
        "cluster_dining": "the DINING card (meal type, cuisine, dietary, ambiance, budget — one card). GIVE a specific dish or dining-scene fact for the destination. ASK ONE question about their food style.",
        "nearby_cities_recommendation": "the NEARBY EXCURSIONS card — this trip qualifies for day-trip suggestions and the card lists them. GIVE one compelling reason a nearby town is worth the detour. ASK ONE question: whether they'd like to add any of these excursions to the itinerary, or keep it to the main destination. Nothing about the review/confirmation step yet.",
        "plan_confirmation_widget": "the Trip Review Card — everything essential is gathered. GIVE one closing observation that ties the trip together. ASK if they're ready to create the plan, or want to fine-tune anything optional first.",
        None: "NO card this turn — the trip brief is complete (or the user is past intake). Do NOT ask a new planning question. Answer/acknowledge helpfully and remind them they can hit 'Create Plan' or adjust anything.",
        "self_drive_openness": "the optional driving openness card. ASK only whether driving a meaningful road leg is acceptable. Do not ask about licenses, rentals, night driving, or route details yet.",
        "self_drive_readiness": "the driving readiness card. The user already accepted driving in principle. ASK one combined question about license readiness and own vehicle versus rental.",
        "self_drive_route_comfort": "the route-specific road comfort card. ASK one combined question about the limits shown for this route; do not introduce unrelated driving questions.",
    }

    def _active_step_instruction(self, draft, widget_type, widget_payload):
        """Three-Beat instruction for the FINAL routed widget. Because routing
        happens before this prompt is built (checklist 1.1), the reply's
        question always refers to the card that actually renders."""
        desc = self._WIDGET_STEP_DESCRIPTIONS.get(
            widget_type,
            (widget_type or "").replace("_", " ") or self._WIDGET_STEP_DESCRIPTIONS[None],
        )

        recommendation_block = ""
        rec_text = ((widget_payload or {}).get("recommendation") or {}).get("text")
        if rec_text:
            recommendation_block = f"""
--- ACTIVE CARD RECOMMENDATION (the card the user sees already shows this — say it in your own words, don't contradict it) ---
{rec_text}"""

        suggestions_block = ""
        if widget_type == "nearby_cities_recommendation":
            names = [s.get("city") for s in (widget_payload or {}).get("suggestions", []) if s.get("city")]
            if names:
                suggestions_block = f"\nThe excursion card lists: {', '.join(names)}. Refer to them collectively; do not re-describe each."

        step_label = widget_type if widget_type else "no_widget"
        return f"""
--- CURRENT ACTIVE CHAT CONVERSATION STEP (CRITICAL SYNC — Three-Beat: Understand -> Give -> Ask) ---
You are currently on the step: '{step_label}' ({desc}).
Your reply must: (1) acknowledge what the user just gave in one short clause, (2) give the ONE concrete
recommendation/fact/price for THIS step, (3) ask exactly ONE question covering this whole card — never two
questions, never a question about a different or later step, never enumerate options the card already
renders as chips/tiles.{suggestions_block}
{recommendation_block}
"""

    # ─────────────────────────────────────────────────────────────────────────
    # LLM call #1 — extraction only (no reply is produced here)
    # ─────────────────────────────────────────────────────────────────────────

    def _call_gemini_extract(self, draft, message, history):
        today_str = date.today().isoformat()
        intent = draft.intent or INTENT_FULL_TRIP
        already_known = self._already_known_block(draft)

        # Nearby-cities eligibility is decided by Python, never the model —
        # this block only appears when the backend already confirmed the trip
        # qualifies (on the post-structured-value draft; if this turn's free
        # text supplies the last missing piece, content generation simply
        # happens next turn — routing and reply still agree either way).
        nearby_cities_block = ""
        if self._nearby_cities_eligible(draft):
            nearby_cities_block = f"""
--- NEARBY CITIES ELIGIBLE (MANDATORY: populate nearby_cities this turn) ---
This is a {(draft.end_date - draft.start_date).days}-day full trip to {draft.destination_text} — it qualifies
for nearby-city suggestions. You MUST populate the nearby_cities list with 2-3 REAL, SPECIFIC towns/cities
genuinely worth a day trip or short excursion from {draft.destination_text}, each with an honest distance,
a compelling why_visit, and a recommended_duration. Do not skip this field this turn.
"""

        system_prompt = f"""You are the EXTRACTION layer of a travel-planning assistant. Today is {today_str}.
Read the user's newest message and populate ONLY the structured fields. A separate call writes the
conversational reply — you never produce prose for the user.

--- EXTRACTION EXAMPLES ---
  - "flight to Bareilly" → detected_intent="flight_only", destination_text="Bareilly"
  - "trip to Tokyo next month for 5 days" → destination_text="Tokyo", derive start/end dates
  - "from Mumbai to Goa" → origin="Mumbai", destination_text="Goa"
  - "2 people, luxury budget" → adults=2, budget_tier="premium"
  - "Rajdhani from Delhi to Patna on 20th July" → intent="train_only", origin="Delhi", destination="Patna", start_date="{date.today().year}-07-20"
  - "me and mom" → adults=2
  - "going back home" → visit_purpose="hometown"
  - "business trip" → visit_purpose="business"

--- ALREADY COLLECTED (canonical state — do NOT re-extract unchanged values; only NEW or CHANGED information) ---
{already_known}

--- INTENT: {INTENT_LABELS.get(intent, intent)} ---
{self._intent_field_rules(intent)}

--- CONTEXT UPDATES ---
If the user's message EXPLICITLY CHANGES a slot already in ALREADY COLLECTED (e.g. "actually make it
3 people", "change to business class", "no wait Aug 10 instead", "let's do Jaipur instead"), set the
changed field-value pairs in context_updates. Destination and travel-date changes MUST go through
context_updates — mentioning another city as an excursion, comparison, or question is NOT a change.

--- PREFERENCE REASONING (memory, not a slot) ---
Whenever the user reveals WHY behind a choice — not just a value — capture it in preference_signals.
"I don't mind spending more if the view is amazing" -> values=["scenery"], reasons=[{{field:"budget", reason:"values scenery over price"}}].
Leave preference_signals null when nothing new was revealed. Never invent a reason the user didn't imply.
{nearby_cities_block}
RULES:
- CRITICAL: set a field to null unless the user explicitly stated it or it is directly inferable from this
  message. NEVER guess or hallucinate dates, origin, or traveler counts.
- RESOLVE RELATIVE DATES YOURSELF: "this weekend", "next month", "in December" must resolve to concrete
  start_date/end_date using today's date above. Only leave dates null when there is no time reference at all.
- CONTEXT PRECEDENCE: ALREADY COLLECTED and the newest explicit user statement override older chat history.
- If the message is purely a question (asks for information or a comparison) and states no new trip fact,
  leave every extraction field null."""

        chat_contents = []
        if history:
            for msg in history[-6:]:
                role = "user" if msg.role == "user" else "model"
                chat_contents.append({"role": role, "parts": [{"text": msg.message}]})
        chat_contents.append({"role": "user", "parts": [{"text": message or "Continue helping me plan."}]})

        from apps.common.ai import DEFAULT_GEMINI_MODEL

        response = self.client.models.generate_content(
            model=DEFAULT_GEMINI_MODEL,
            contents=chat_contents,
            config=genai.types.GenerateContentConfig(
                system_instruction=system_prompt,
                response_mime_type="application/json",
                response_schema=ExtractedTripData,
                temperature=0.2,
            ),
        )
        if response.parsed is None:
            raise ValueError("Extraction call returned no parseable payload.")
        return response.parsed

    # ─────────────────────────────────────────────────────────────────────────
    # LLM call #2 — the reply, generated FOR the already-routed widget
    # ─────────────────────────────────────────────────────────────────────────

    def _call_gemini_reply(self, draft, message, history, *, widget_type, widget_payload, ai_data, structured_value=None):
        today_str = date.today().isoformat()
        intent = draft.intent or INTENT_FULL_TRIP
        already_known = self._already_known_block(draft)
        real_options_block = self._real_options_block(draft)
        preferences_block = _intel_preferences.preferences_prompt_block(draft)
        learned_context = self._load_learned_context(draft)

        from apps.planner.services.turn_intent import is_answer_only_turn, is_browse_only_turn

        # CHAT-01 (docs/planner-complete-current-audit-and-repair-plan.md
        # §19 R6): this used to check only is_answer_only_turn, so a browse
        # phrase like "hotels in Goa" (no "?", no change verb) fell through
        # to _active_step_instruction and got a reply written for whatever
        # cluster widget the ladder routed — then conversation_service.py
        # strips that widget for browse-only turns (never mutates the
        # draft), leaving the mismatched cluster-step reply as the only
        # thing the user sees. Browse-only turns need the same "don't ask
        # the next planning question" treatment answer-only turns already
        # get. structured_value is threaded through here (previously
        # omitted) so a real widget submission whose message text happens to
        # read like a question is never misclassified as answer/browse-only.
        if is_answer_only_turn(message, structured_value) or is_browse_only_turn(message, structured_value):
            step_instruction = """
--- ANSWER-ONLY TURN ---
The user asked for information or a comparison. Answer that exact question concisely using the
canonical trip context below. Do not claim the trip changed, and do not ask the next planning
question in this turn. Never state an exact live price, schedule, availability, opening status,
or forecast unless it appears in verified data below."""
        else:
            step_instruction = self._active_step_instruction(draft, widget_type, widget_payload)

        # Explicit corrections applied this turn get confirmed naturally —
        # the reply call doesn't see raw extraction output, so summarize.
        changed_block = ""
        updates = getattr(ai_data, "context_updates", None) if ai_data is not None else None
        if updates is not None:
            try:
                changed = updates.model_dump(exclude_none=True)
            except AttributeError:
                changed = updates if isinstance(updates, dict) else {}
            if changed:
                changed_str = ", ".join(f"{k} → {v}" for k, v in changed.items())
                changed_block = f"""
--- JUST CHANGED THIS TURN ---
The user just corrected: {changed_str}. Confirm the change naturally in one short clause ("Done — updated to 3 travelers!")."""

        system_prompt = f"""You are a world-class human travel consultant named Priya -- you've booked thousands of trips
and you speak to clients like a trusted friend who happens to know everything about travel.
Today is {today_str}.

{step_instruction}

--- PERSONA RULES ---
1. RESPECT USER INTENT STRICTLY: the current intent is {INTENT_LABELS.get(intent, intent)} — stay 100% inside it.
2. Lead with a strong recommendation or insight first, then ask one focused follow-up question.
   Never invent a service number, exact departure, fare, availability, rating, opening hour, or forecast.
   If verified data is absent, compare modes or time windows and say a live check is still needed.
3. Sound like a knowledgeable friend, NOT a chatbot. Never use corporate phrases like "Certainly!",
   "Of course!", "Absolutely!", "I'd be happy to help".
4. Proactively share route insights and seasonal context. Price guidance without verified data must be a
   clearly labeled approximate range, never an exact live quote.
5. Name specific trains/airlines/hotels only when present in the database/cached block below; otherwise
   recommend the category or route pattern.
6. For honeymoon: be romantic. For business: be efficient. For hometown: be warm and personal.
7. NEVER ask two questions at once. One natural conversational question maximum per turn.
8. VALUE-DRIVEN INQUIRY: never ask a question without explaining WHY it matters (a localized tip, weather
   warning, budget advantage, or seasonal insight).
9. DATA PROVENANCE: database/cached options below may be quoted as recorded options, not guaranteed current
   availability. Only data explicitly marked live may be called live.
10. GIVE BEFORE YOU ASK: every reply delivers something of value -- a recommendation, a price ballpark, a
    seasonal fact -- BEFORE any question.
11. THREE-BEAT, HARD LIMIT: (1) acknowledge in <=1 clause, (2) one concrete give, (3) one question for the
    ACTIVE STEP above. 2-3 sentences maximum, total. Never list the individual options a widget card already
    renders as chips/tiles.
12. NEVER ask for, mention, or re-confirm anything already listed in ALREADY COLLECTED.
13. CONTEXT PRECEDENCE: canonical ALREADY COLLECTED state overrides older chat history.

--- DATABASE / CACHED TRAVEL OPTIONS (NOT LIVE AVAILABILITY UNLESS EXPLICITLY MARKED) ---
{real_options_block if real_options_block else "  - (no options matching this route/date found in the database yet)"}

--- ALREADY COLLECTED (CRITICAL: DO NOT ask for or re-confirm any of these) ---
{already_known}
{preferences_block}
{changed_block}
{learned_context}"""

        chat_contents = []
        if history:
            for msg in history[-6:]:
                role = "user" if msg.role == "user" else "model"
                chat_contents.append({"role": role, "parts": [{"text": msg.message}]})
        chat_contents.append({"role": "user", "parts": [{"text": message or "Continue helping me plan."}]})

        from apps.common.ai import DEFAULT_GEMINI_MODEL

        response = self.client.models.generate_content(
            model=DEFAULT_GEMINI_MODEL,
            contents=chat_contents,
            config=genai.types.GenerateContentConfig(
                system_instruction=system_prompt,
                response_mime_type="application/json",
                response_schema=TurnReply,
                temperature=0.5,
            ),
        )
        parsed = response.parsed
        reply = (getattr(parsed, "reply", None) or "").strip() if parsed is not None else ""
        return reply or None

    # ─────────────────────────────────────────────────────────────────────────
    # Intent Field Rules — per-intent DO/DO NOT
    # ─────────────────────────────────────────────────────────────────────────

    def _intent_field_rules(self, intent):
        rules = {
            INTENT_HOTEL_ONLY: (
                "For hotel_only: collect destination, check-in/out dates, visit_purpose, travelers, budget, star_rating, amenities. "
                "Recommend neighborhood based on purpose (business→near office district, honeymoon→beachfront, family→central+safe). "
                "NEVER ask about flights, origin city, activities, or transit."
            ),
            INTENT_FLIGHT_ONLY: (
                "For flight_only: collect destination, origin (required), dates, visit_purpose, passengers, flight_class, time_window. "
                "Mention fare range estimate immediately when both origin+destination are known. "
                "Recommend morning flights for business, upgrade pitch for honeymoon, early booking for hometown festive travel. "
                "NEVER ask about hotels, activities, visa, or how long the trip is."
            ),
            INTENT_TRAIN_ONLY: (
                "For train_only: collect destination, origin (required), travel date, visit_purpose, passengers, train_class. "
                "NAME the specific train immediately (Rajdhani, Shatabdi, Vande Bharat) when you know the route. "
                "Mention journey duration and fare range upfront. "
                "Recommend class by purpose: hometown→Sleeper/3AC, business→2AC/1AC, honeymoon→1AC. "
                "Surface Tatkal option if date is within 4 days. "
                "NEVER ask about hotels, flights, activities, or seat preference (window/aisle)."
            ),
            INTENT_BUS_ONLY: (
                "For bus_only: collect destination, origin (required), date, visit_purpose, passengers, bus_type. "
                "Recommend overnight sleeper bus for routes over 8 hours. Mention journey duration upfront. "
                "NEVER ask about hotels, flights, or suggest train/flight alternatives."
            ),
            INTENT_CAB_ONLY: (
                "For cab_only: collect drop location (destination), pickup (origin, required), date+time, visit_purpose, passengers, vehicle_type. "
                "Give a fare estimate with toll estimate as soon as both pickup+drop are known. "
                "Recommend Sedan for 1-3 pax, SUV for 4+. "
                "NEVER ask about hotels, flights, or stay duration."
            ),
            INTENT_CRUISE_ONLY: (
                "For cruise_only: collect destination/port, sailing dates, visit_purpose, guests, cabin_class, dining_package. "
                "Recommend Balcony cabin for honeymoon/couples proactively. Mention ports of call and duration upfront. "
                "NEVER ask about origin city or flights to the port — separate intent."
            ),
            INTENT_CAR_RENTAL: (
                "For car_rental: collect pickup location, rental dates, visit_purpose, car_type, transmission, passengers. "
                "Recommend SUV for groups of 4+ or hilly terrain routes. Mention that hill stations require 4WD. "
                "NEVER ask about hotels, flights, or driver (self-drive only — redirect driver requests to cab_only)."
            ),
            INTENT_TRANSIT_ONLY: (
                "For transit_only: collect destination, origin (required), date, visit_purpose, priority, preferred_mode. "
                "Present a route comparison proactively: 'Train takes 4h at ₹800. Bus takes 5h at ₹400. Which works?' "
                "NEVER ask about hotels, activities, or tourist attractions."
            ),
            INTENT_ACTIVITIES_ONLY: (
                "For activities_only: collect destination, activity dates, visit_purpose, participants, interests, intensity_level. "
                "Suggest top 2-3 activities for the destination immediately. Filter by purpose (family→skip nightlife). "
                "NEVER ask about flights, hotels, or how they're getting there."
            ),
            INTENT_FOOD_AND_DINING: (
                "For food_and_dining: collect destination, dining date, visit_purpose, guests, meal_type, cuisine, dietary. "
                "Name-drop a must-try dish or local specialty immediately. Recommend reservations for premium dining. "
                "NEVER ask about hotels, transport, or accommodation."
            ),
            INTENT_FULL_TRIP: (
                "For full_trip: collect destination, travel dates, visit_purpose, travelers, budget, interests, origin city. "
                "Share destination + seasonal context + budget ballpark immediately. "
                "For 3+ day trips, suggest nearby city excursions in conversation (not always as a widget). "
                "Infer interests from destination keywords (beach destination→beach+nature, city→culture+food). "
                "NEVER ask separately about hotel type, flight class, or train class — those are inside the itinerary."
            ),
        }
        return rules.get(intent, rules[INTENT_FULL_TRIP])

    def _nearby_cities_eligible(self, draft) -> bool:
        """Thin delegate to the shared ladder-vocabulary gate (services/
        intelligence/clusters.py) — WidgetOrchestrator and this prompt-time
        check must never diverge on eligibility."""
        from apps.planner.services.intelligence.clusters import nearby_cities_eligible

        return nearby_cities_eligible(draft)

    # ─────────────────────────────────────────────────────────────────────────
    # Widget Determination — Single Source of Truth
    # ─────────────────────────────────────────────────────────────────────────

    def _determine_widget(self, draft, ai_data):
        """
        Deterministically choose exactly ONE widget based on updated draft state.
        Runs AFTER _merge_ai_data. Returns (widget_type, data_payload) or (None, {}).
        """
        from apps.planner.services.widget_orchestrator import WidgetOrchestrator
        w_type, payload = WidgetOrchestrator.determine_next_widget(draft, ai_data)
        if w_type:
            return w_type, payload or {}
        return None, {}

    # ─────────────────────────────────────────────────────────────────────────
    # Slot provenance locking (docs/ai-orchestration-architecture.md §5.3) —
    # narrow, targeted guard: once the user has explicitly stated/confirmed a
    # slot, a later loose inference must never silently overwrite it. Scoped
    # today to "travelers", the one field with unconditional-overwrite
    # semantics in _merge_ai_data; the pattern generalizes to other fields
    # once they need it.
    # ─────────────────────────────────────────────────────────────────────────

    def _lock_field(self, draft, field_name):
        if not draft.metadata:
            draft.metadata = {}
        locked = set(draft.metadata.get("locked_fields", []))
        locked.add(field_name)
        draft.metadata["locked_fields"] = sorted(locked)

    @staticmethod
    def _set_origin(draft, value):
        """Write origin through the canonical column while mirroring legacy metadata."""
        cleaned = str(value or "").strip()[:160]
        if not cleaned:
            return
        if not draft.metadata:
            draft.metadata = {}
        city = City.objects.select_related("country").filter(name__iexact=cleaned).first()
        draft.origin_city = city
        draft.origin_text = city.name if city else cleaned
        draft.metadata["origin"] = draft.origin_text

    @staticmethod
    def _set_budget_inr(draft, value):
        """Keep exact budgets canonical; metadata remains a read-compatible mirror."""
        try:
            amount = int(value)
        except (ValueError, TypeError):
            return
        if amount <= 0:
            return
        if not draft.metadata:
            draft.metadata = {}
        draft.budget_amount = amount
        draft.budget_currency = "INR"
        draft.metadata["budget_inr"] = amount

    def _is_locked(self, draft, field_name):
        meta = draft.metadata or {}
        return field_name in (meta.get("locked_fields") or [])

    # ─────────────────────────────────────────────────────────────────────────
    # Draft Merging
    # ─────────────────────────────────────────────────────────────────────────

    def _merge_ai_data(self, draft, ai_data, message=""):
        """Merge AI extractions into the draft. Respects existing values + handles context_updates."""
        if ai_data.detected_intent:
            user_msg_lower = (message or "").lower()
            if not draft.intent:
                draft.intent = ai_data.detected_intent
            elif ai_data.detected_intent != INTENT_FULL_TRIP:
                draft.intent = ai_data.detected_intent
            elif any(kw in user_msg_lower for kw in ["full trip", "complete trip", "entire trip", "whole trip", "all-in-one", "full itinerary"]):
                draft.intent = INTENT_FULL_TRIP
            # Otherwise, keep established single-service intent (e.g. flight_only, hotel_only)


        # Provenance guard (audit CH-05, checklist 1.2): once the user has
        # explicitly set/confirmed the destination or dates (widget submit,
        # or an explicit context_updates correction), a loose extraction —
        # e.g. another city mentioned as an excursion or comparison — must
        # never silently replace them. Deliberate changes still flow through
        # context_updates below, which re-locks the new value.
        if ai_data.destination_text and not self._is_locked(draft, "destination"):
            cleaned_dest = ai_data.destination_text.strip()
            if not draft.destination_text or draft.destination_text.lower() != cleaned_dest.lower():
                city = City.objects.select_related("country").filter(
                    name__iexact=cleaned_dest
                ).first()
                if city:
                    draft.destination_city = city
                    draft.destination_text = city.name
                else:
                    draft.destination_city = None
                    draft.destination_text = cleaned_dest

        dates_locked = self._is_locked(draft, "travel_dates")

        if ai_data.start_date and not dates_locked:
            parsed = safe_parse_date(ai_data.start_date)
            if parsed and (not draft.start_date or draft.start_date != parsed):
                draft.start_date = parsed

        if ai_data.end_date and not dates_locked:
            parsed = safe_parse_date(ai_data.end_date)
            if parsed and (not draft.end_date or draft.end_date != parsed):
                draft.end_date = parsed

        # Provenance guard (docs/ai-orchestration-architecture.md §5.3): once
        # the user has explicitly stated/confirmed a traveler count, a later
        # turn's loose extraction must never silently stomp it — the
        # unconditional overwrites below only apply while unlocked.
        travelers_locked = self._is_locked(draft, "travelers")

        if ai_data.adults and not travelers_locked:
            draft.adults = ai_data.adults
            if not draft.metadata: draft.metadata = {}
            draft.metadata["travelers_set"] = True

        if ai_data.children is not None and not travelers_locked:
            draft.children = max(int(ai_data.children), 0)
            if not draft.metadata: draft.metadata = {}
            draft.metadata["travelers_set"] = True
        if ai_data.infants is not None and not travelers_locked:
            draft.infants = max(int(ai_data.infants), 0)
            if not draft.metadata: draft.metadata = {}
            draft.metadata["travelers_set"] = True

        # Regex & Semantic fallback for traveler extraction if LLM missed it
        user_msg = (message or "").lower()
        import re
        trav_match = re.search(r'(\d+)\s*(?:traveler|traveller|people|adult|person|passenger)s?', user_msg)
        child_match = re.search(r'(\d+)\s*(?:child|children|kid)s?', user_msg)
        infant_match = re.search(r'(\d+)\s*(?:infant|baby|babies)', user_msg)
        if not travelers_locked:
            if trav_match:
                try:
                    extracted_adults = int(trav_match.group(1))
                    if extracted_adults > 0:
                        draft.adults = extracted_adults
                        if not draft.metadata: draft.metadata = {}
                        draft.metadata["travelers_set"] = True
                except (ValueError, TypeError):
                    pass
            if child_match:
                draft.children = max(int(child_match.group(1)), 0)
                if not draft.metadata: draft.metadata = {}
                draft.metadata["travelers_set"] = True
            if infant_match:
                draft.infants = max(int(infant_match.group(1)), 0)
                if not draft.metadata: draft.metadata = {}
                draft.metadata["travelers_set"] = True
            if not trav_match:
                if "me and mom" in user_msg or "me and my friend" in user_msg or "me and wife" in user_msg or "me and husband" in user_msg or "couple" in user_msg or "we both" in user_msg or "two of us" in user_msg:
                    draft.adults = 2
                    if not draft.metadata: draft.metadata = {}
                    draft.metadata["travelers_set"] = True
                elif "solo" in user_msg or "myself" in user_msg or "just me" in user_msg:
                    draft.adults = 1
                    if not draft.metadata: draft.metadata = {}
                    draft.metadata["travelers_set"] = True


        if ai_data.budget_tier and not draft.budget_tier:
            draft.budget_tier = ai_data.budget_tier

        if ai_data.interests and not draft.interests:
            draft.interests = ai_data.interests

        if not draft.metadata:
            draft.metadata = {}

        if ai_data.origin and not (draft.origin_text or self._is_locked(draft, "origin")):
            self._set_origin(draft, ai_data.origin)

        # NEW: Persist visit_purpose (only if not already set)
        if ai_data.visit_purpose and not draft.metadata.get("visit_purpose"):
            draft.metadata["visit_purpose"] = ai_data.visit_purpose

        # NEW: Persist budget_inr (only if not already set)
        if ai_data.budget_inr and draft.budget_amount is None:
            self._set_budget_inr(draft, ai_data.budget_inr)

        # NEW: Handle context_updates — silently update changed slots
        if ai_data.context_updates:
            updates_dict = {}
            if hasattr(ai_data.context_updates, "model_dump"):
                updates_dict = ai_data.context_updates.model_dump(exclude_none=True)
            elif hasattr(ai_data.context_updates, "dict"):
                updates_dict = ai_data.context_updates.dict(exclude_none=True)
            elif isinstance(ai_data.context_updates, dict):
                updates_dict = ai_data.context_updates

            for field, value in updates_dict.items():
                if value is None:
                    continue
                # An explicit correction is the strongest provenance tier
                # (user_stated) — lock it so a later loose extraction can't
                # silently overwrite what the user just confirmed.
                if field in {"adults", "children", "infants"}:
                    lock_name = "travelers"
                elif field in {"start_date", "end_date"}:
                    lock_name = "travel_dates"
                else:
                    lock_name = field
                self._lock_field(draft, lock_name)
                if field == "destination":
                    cleaned = str(value).strip()
                    if cleaned:
                        city = City.objects.select_related("country").filter(
                            name__iexact=cleaned
                        ).first()
                        if city:
                            draft.destination_city = city
                            draft.destination_text = city.name
                        else:
                            draft.destination_city = None
                            draft.destination_text = cleaned[:160]
                elif field in ("start_date", "end_date"):
                    parsed = safe_parse_date(value)
                    if parsed:
                        setattr(draft, field, parsed)
                elif field == "adults":
                    try:
                        draft.adults = max(int(value), 1)
                    except (ValueError, TypeError):
                        pass
                elif field == "children":
                    try:
                        draft.children = max(int(value), 0)
                    except (ValueError, TypeError):
                        pass
                elif field == "infants":
                    try:
                        draft.infants = max(int(value), 0)
                    except (ValueError, TypeError):
                        pass
                elif field == "budget_tier":
                    draft.budget_tier = str(value)
                elif field == "budget_inr":
                    self._set_budget_inr(draft, value)
                elif field == "interests":
                    draft.interests = value if isinstance(value, list) else [str(value)]
                elif field == "origin":
                    self._set_origin(draft, value)
                elif field in [
                    "visit_purpose", "train_class", "cabin_class", "car_type",
                    "flight_class", "vehicle_type", "preferred_mode", "time_window",
                    "bus_type", "transmission",
                ]:
                    draft.metadata[field] = str(value)


        # Persist extra preferences from AI extraction
        if ai_data.extra_preferences:
            prefs = ai_data.extra_preferences
            pref_dict = {}
            if hasattr(prefs, "model_dump"):
                pref_dict = prefs.model_dump(exclude_none=True)
            elif hasattr(prefs, "dict"):
                pref_dict = prefs.dict(exclude_none=True)
            elif isinstance(prefs, dict):
                pref_dict = prefs

            for k, v in pref_dict.items():
                if v and k not in draft.metadata:
                    draft.metadata[k] = v

    # ─────────────────────────────────────────────────────────────────────────
    # Learned Context from DB
    # ─────────────────────────────────────────────────────────────────────────

    def _load_learned_context(self, draft):
        """Load the best proven questions for this intent + destination from DB."""
        from django.conf import settings as dj_settings

        # CH-08: the QuestionBank's success signal is noise today — the
        # "learned patterns" prompt block is gated off with the writes.
        if not getattr(dj_settings, "PLANNER_QUESTION_BANK_ENABLED", False):
            return ""
        try:
            from apps.planner.models import PlannerQuestionBank
            intent = draft.intent or INTENT_FULL_TRIP

            best_questions = PlannerQuestionBank.objects.filter(
                intent=intent,
                success_count__gt=0,
                destination_text__in=[draft.destination_text or "", "*"],
            ).order_by("-success_count")[:3]

            if not best_questions.exists():
                return ""

            lines = [
                "\n--- LEARNED PATTERNS (questions that worked well for similar sessions) ---"
            ]
            for q in best_questions:
                lines.append(
                    f"  Widget: {q.widget_type} | Proven question: \"{q.question_text}\" "
                    f"(used {q.success_count}x successfully)"
                )
            lines.append(
                "Use these as tone inspiration — adapt naturally, do not copy verbatim."
            )
            return "\n".join(lines)
        except Exception:
            return ""

    # ─────────────────────────────────────────────────────────────────────────
    # Fallback Reply
    # ─────────────────────────────────────────────────────────────────────────

    def _fallback_reply(self, draft, widget_type):
        intent = draft.intent or INTENT_FULL_TRIP
        label = INTENT_LABELS.get(intent, "trip").lower()
        meta = draft.metadata or {}
        dest = draft.destination_text or "your destination"
        origin = draft.origin_text or meta.get("origin", "")

        if widget_type == "destination_search":
            return "Where would you like to go? Tell me your destination."
        if widget_type == "origin_search":
            return f"Where are you departing from for your {label} to {dest}?"
        if widget_type == "date_range_picker":
            if origin:
                return f"When are you traveling from {origin} to {dest}? Pick your dates."
            return f"When are you planning to visit {dest}? Let me know your travel dates."
        if widget_type == "optional_trip_details":
            return f"A few quick preferences and I'll have everything I need to build your {label}."
        if widget_type and widget_type.startswith("cluster_"):
            cluster_name = widget_type[len("cluster_"):]
            cluster_label = CLUSTER_DEFS.get(cluster_name, {}).get("label", "a couple of preferences")
            return f"{cluster_label} — quick one, then I'll have everything for your {label}."
        if widget_type == "nearby_cities_recommendation":
            return f"Since you have a few days in {dest}, there are some great nearby spots worth adding. Interested?"
        if widget_type == "self_drive_openness":
            return "This route has a practical road leg. Would you consider driving it yourself?"
        if widget_type == "self_drive_readiness":
            return "Are you license-ready for this trip, and would you use your own vehicle or a rental?"
        if widget_type == "self_drive_route_comfort":
            return "What daily driving-hour limit feels comfortable, and are you comfortable driving at night?"
        return "You're all set! Hit 'Create Plan' whenever you're ready."

    # ─────────────────────────────────────────────────────────────────────────
    # Optional field application — shared by the legacy flat form and the new
    # per-cluster submissions. Applies whatever subset of fields is present;
    # never touches optional_submitted/clusters_done (callers own that).
    # ─────────────────────────────────────────────────────────────────────────

    def _apply_optional_field_values(self, draft, value, touched=None):
        """Apply whatever subset of fields is present.

        `touched` (audit CH-09, checklist 1.4): the fields the user actively
        changed on the card. Only those get user_confirmed provenance
        (locked). touched=None means the caller predates the touched contract
        (legacy flat form) — locking is preserved there. touched=set() means
        "nothing actively chosen" (e.g. cluster_skip defaults) — nothing locks.
        """
        if not draft.metadata:
            draft.metadata = {}

        def _confirmed(field_name):
            return touched is None or field_name in touched

        if "travelers" in value and value["travelers"] is not None:
            try:
                draft.adults = max(int(value["travelers"] or 1), 1)
                draft.metadata["travelers_set"] = True
                # A user-changed value is user_confirmed provenance — lock it
                # against a later loose extraction overwriting it. Untouched
                # prefill submitted via "Done" stays inferred (no lock).
                if _confirmed("travelers"):
                    self._lock_field(draft, "travelers")
            except (ValueError, TypeError):
                pass
        if "children" in value and value["children"] is not None:
            try:
                draft.children = max(int(value["children"] or 0), 0)
            except (ValueError, TypeError):
                pass

        # Budget — accepts both tier+inr
        budget_confirmed = touched is None or "budget" in touched or "budget_inr" in touched
        if budget_confirmed and "budget" in value and value["budget"] is not None:
            b = value["budget"]
            if isinstance(b, dict):
                draft.budget_tier = b.get("tier", draft.budget_tier)
                if b.get("amount"):
                    draft.budget_amount = b.get("amount", draft.budget_amount)
                draft.budget_currency = b.get("currency", draft.budget_currency)

        if budget_confirmed and "budget_inr" in value and value["budget_inr"] is not None:
            try:
                inr = int(value["budget_inr"])
                self._set_budget_inr(draft, inr)
                if inr <= 200000:
                    draft.budget_tier = "budget"
                elif inr <= 500000:
                    draft.budget_tier = "mid_range"
                else:
                    draft.budget_tier = "premium"
            except (ValueError, TypeError):
                pass

        if "interests" in value and value["interests"] is not None:
            draft.interests = (
                value["interests"] if isinstance(value["interests"], list) else draft.interests
            )

        if "origin" in value and value["origin"] is not None:
            self._set_origin(draft, value["origin"])
            if _confirmed("origin"):
                self._lock_field(draft, "origin")

        optional_meta_fields = [
            "visit_purpose", "train_class", "cabin_class", "car_type", "preferred_mode",
            "flight_class", "vehicle_type", "time_window", "bus_type", "tatkal",
            "meal_preference", "non_stop", "journey_timing", "return_trip",
            "transmission", "priority", "trip_pace", "intensity_level",
            "star_rating", "stay_amenities", "property_type", "dining_package",
            "meal_type", "cuisine", "dietary", "ambiance",
            # Fine-tune cluster fields (input-trace matrix finding, Phase 0):
            # these were missing here, so a fine_tune cluster_submit silently
            # dropped them even though PlanContext reads exactly these keys —
            # a wheelchair need entered via the review card never reached
            # generation. See docs/planner-complete-audit-and-fix-plan.md.
            "accessibility", "special_notes", "pets",
            # Phase 5 (M4 depth, chat intake completeness): children_ages
            # (party card), budget_split/interests_other/visit_purpose_other
            # (fine_tune card) — same write path, same anti-leak contract
            # (plan_context.py KNOWN_PREFERENCE_KEYS).
            "children_ages", "budget_split", "interests_other", "visit_purpose_other",
        ]
        for extra_field in optional_meta_fields:
            if extra_field in value and value[extra_field] is not None:
                draft.metadata[extra_field] = value[extra_field]

    # ─────────────────────────────────────────────────────────────────────────
    # Structured Widget Value Application
    # ─────────────────────────────────────────────────────────────────────────

    def _apply_structured_value(self, draft, structured_value):
        field = structured_value.get("field")
        value = structured_value.get("value")

        if field == "destination" and isinstance(value, dict):
            draft.destination_text = value.get("name", "")[:160]
            city_id = value.get("id")
            if city_id:
                draft.destination_city_id = city_id
            if draft.destination_text:
                # Widget-confirmed → user_confirmed provenance (audit CH-05)
                self._lock_field(draft, "destination")

        elif field == "destination_submit" and isinstance(value, dict):
            # DestinationWidget's actual wire shape ({destination, origin}) —
            # distinct from the "destination" branch above ({name, id}), left
            # by a widget rename that never got a matching backend handler.
            # Without this, every destination pick fell through to the
            # freeform LLM re-extraction of the chat message instead of
            # being applied deterministically, which is why explicit
            # selections could silently drift or get ignored.
            dest = (value.get("destination") or "").strip()
            if dest:
                draft.destination_text = dest[:160]
                # Widget-confirmed → user_confirmed provenance (audit CH-05)
                self._lock_field(draft, "destination")
            origin_val = (value.get("origin") or "").strip()
            if origin_val:
                self._set_origin(draft, origin_val)
                self._lock_field(draft, "origin")

        elif field == "multi_city" and isinstance(value, dict):
            # MultiCityWidget's submission — previously unhandled entirely,
            # so a multi-city request fell through to freeform extraction
            # (which treats destination as a single place) and produced a
            # single-city plan. Setting destination_text to the full ordered
            # route plus a dedicated metadata list lets _generate_skeleton
            # force a genuine multi-city structure.
            destinations = value.get("destinations")
            if isinstance(destinations, list):
                cleaned = [d.strip() for d in destinations if isinstance(d, str) and d.strip()]
                if cleaned:
                    draft.destination_text = ", ".join(cleaned)[:160]
                    if not draft.metadata:
                        draft.metadata = {}
                    draft.metadata["multi_city_destinations"] = cleaned
                    # An explicitly ordered multi-city route is the strongest
                    # destination statement possible (audit CH-05).
                    self._lock_field(draft, "destination")

        elif field == "group_type" and isinstance(value, dict):
            if not draft.metadata:
                draft.metadata = {}
            group_type = value.get("group_type")
            if group_type:
                draft.metadata["group_type"] = group_type

        elif field == "origin" and isinstance(value, dict):
            self._set_origin(draft, value.get("name", ""))
            if draft.origin_text:
                self._lock_field(draft, "origin")

        elif field == "travel_dates" and isinstance(value, dict):
            start_str = value.get("start_date")
            end_str = value.get("end_date")
            applied = False
            if start_str:
                parsed_start = safe_parse_date(start_str)
                if parsed_start:
                    draft.start_date = parsed_start
                    applied = True
            if end_str:
                parsed_end = safe_parse_date(end_str)
                if parsed_end:
                    draft.end_date = parsed_end
                    applied = True
            if applied:
                # Widget-confirmed → user_confirmed provenance (audit CH-05)
                self._lock_field(draft, "travel_dates")

        elif field == "travelers":
            if not draft.metadata: draft.metadata = {}
            draft.metadata["travelers_set"] = True
            if isinstance(value, dict):
                try:
                    draft.adults = max(int(value.get("adults", draft.adults) or 1), 1)
                except (ValueError, TypeError):
                    pass
                try:
                    draft.children = max(int(value.get("children", draft.children) or 0), 0)
                except (ValueError, TypeError):
                    pass
                try:
                    draft.infants = max(int(value.get("infants", draft.infants) or 0), 0)
                except (ValueError, TypeError):
                    pass
            else:
                try:
                    draft.adults = max(int(value or 1), 1)
                except (ValueError, TypeError):
                    pass

        elif field == "budget":
            if isinstance(value, dict):
                draft.budget_tier = value.get("tier", draft.budget_tier)
                draft.budget_amount = value.get("amount", draft.budget_amount)
                draft.budget_currency = value.get("currency", draft.budget_currency)
            elif isinstance(value, str):
                draft.budget_tier = value[:40]

        elif field == "interests":
            draft.interests = value if isinstance(value, list) else draft.interests

        elif field == "self_drive_profile" and isinstance(value, dict):
            if not draft.metadata:
                draft.metadata = {}
            mobility = dict(draft.metadata.get("mobility") or {})
            mobility.update({key: val for key, val in value.items() if val is not None})
            draft.metadata["mobility"] = mobility
            draft.metadata["mobility_source"] = "user_confirmed"

        elif field == "optional_trip_details" and isinstance(value, dict):
            # Legacy path — kept for backward compatibility (rollback safety
            # net per docs/ai-chat-implementation-plan.md Phase 1 DoD). Live
            # traffic now goes through cluster_submit below.
            if not draft.metadata:
                draft.metadata = {}
            self._apply_optional_field_values(draft, value)
            draft.metadata["optional_submitted"] = True

        elif field == "cluster_submit" and isinstance(value, dict):
            if not draft.metadata:
                draft.metadata = {}
            cluster_name = value.get("cluster")
            field_values = value.get("values") or {}
            # CH-09: lock only the fields the user actively changed; a bare
            # "Done" submits the recommendation as inferred, not confirmed.
            raw_touched = value.get("touched")
            touched = set(raw_touched) if isinstance(raw_touched, list) else None
            self._apply_optional_field_values(draft, field_values, touched=touched)
            if cluster_name:
                done = set(draft.metadata.get("clusters_done", []))
                done.add(cluster_name)
                draft.metadata["clusters_done"] = sorted(done)

        elif field == "cluster_skip" and isinstance(value, dict):
            if not draft.metadata:
                draft.metadata = {}
            cluster_name = value.get("cluster")
            if cluster_name == "party":
                return
            # Skip never deadlocks: apply the card's own recommendation
            # (shipped back as `defaults`) so required slots still get a
            # sensible value even when the user skips the ask. Nothing here
            # was actively chosen — touched=∅ so nothing gets locked (CH-09).
            defaults = value.get("defaults")
            if isinstance(defaults, dict) and defaults:
                inferred = {
                    key: item for key, item in defaults.items()
                    if key not in {"budget", "budget_inr", "recommended_budget_inr"}
                }
                self._apply_optional_field_values(draft, inferred, touched=set())
            if cluster_name:
                done = set(draft.metadata.get("clusters_done", []))
                done.add(cluster_name)
                draft.metadata["clusters_done"] = sorted(done)

        elif field == "add_nearby_city":
            if not draft.metadata:
                draft.metadata = {}
            nearby_cities = draft.metadata.get("nearby_cities", [])

            # CH-10: an explicit empty submit is a DECLINE ("keep it to the
            # main destination") — record it so missing_slots stops listing
            # nearby_cities forever after a skip.
            if isinstance(value, dict) and value.get("cities") == []:
                draft.metadata["nearby_cities_declined"] = True

            if isinstance(value, dict):
                cities = value.get("cities")
                if isinstance(cities, list):
                    for c in cities:
                        if c and c not in nearby_cities:
                            nearby_cities.append(c)
                else:
                    city_name = value.get("city")
                    if city_name and city_name not in nearby_cities:
                        nearby_cities.append(city_name)
            elif isinstance(value, list):
                for c in value:
                    if c and c not in nearby_cities:
                        nearby_cities.append(c)
            elif isinstance(value, str):
                if value and value not in nearby_cities:
                    nearby_cities.append(value)

            draft.metadata["nearby_cities"] = nearby_cities
