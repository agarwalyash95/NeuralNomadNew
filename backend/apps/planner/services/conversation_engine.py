import os
import json
from dataclasses import dataclass
from datetime import date, datetime
from typing import List, Optional, Dict, Any

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

# Visit purposes ordered by frequency
VISIT_PURPOSES = ["vacation", "business", "hometown", "family", "honeymoon", "solo", "event", "emergency"]

# Purpose → recommended defaults
PURPOSE_DEFAULTS: Dict[str, Dict[str, Any]] = {
    "vacation":  {"budget_tier": "mid_range",  "travelers": 2,  "train_class": "2AC",     "flight_class": "Economy",  "cabin_class": "Oceanview", "car_type": "Sedan",    "interests": ["beach", "nature"],        "time_window": "any"},
    "business":  {"budget_tier": "premium",    "travelers": 1,  "train_class": "2AC",     "flight_class": "Business", "cabin_class": None,        "car_type": "Sedan",    "interests": [],                         "time_window": "morning"},
    "hometown":  {"budget_tier": "budget",     "travelers": 2,  "train_class": "Sleeper", "flight_class": "Economy",  "cabin_class": None,        "car_type": "Hatchback","interests": [],                         "time_window": "any"},
    "family":    {"budget_tier": "mid_range",  "travelers": 4,  "train_class": "3AC",     "flight_class": "Economy",  "cabin_class": "Oceanview", "car_type": "SUV",      "interests": ["family", "culture"],      "time_window": "morning"},
    "honeymoon": {"budget_tier": "premium",    "travelers": 2,  "train_class": "1AC",     "flight_class": "Business", "cabin_class": "Balcony",   "car_type": "SUV",      "interests": ["romantic", "food"],       "time_window": "evening"},
    "solo":      {"budget_tier": "budget",     "travelers": 1,  "train_class": "Sleeper", "flight_class": "Economy",  "cabin_class": "Interior",  "car_type": "Hatchback","interests": ["adventure"],              "time_window": "any"},
    "event":     {"budget_tier": "mid_range",  "travelers": 2,  "train_class": "2AC",     "flight_class": "Economy",  "cabin_class": None,        "car_type": "Sedan",    "interests": [],                         "time_window": "morning"},
    "emergency": {"budget_tier": "budget",     "travelers": 1,  "train_class": "any",     "flight_class": "Economy",  "cabin_class": None,        "car_type": "Hatchback","interests": [],                         "time_window": "earliest"},
}

# Destination tier base rates (INR per person per day)
DEST_TIER_RATES = {
    "international_premium": {
        "keywords": ["paris", "london", "new york", "tokyo", "dubai", "singapore", "europe", "usa", "uk", "maldives", "bali", "switzerland"],
        "base_per_day": 12000,
    },
    "international_mid": {
        "keywords": ["thailand", "vietnam", "malaysia", "nepal", "sri lanka", "cambodia", "indonesia"],
        "base_per_day": 6000,
    },
    "domestic_leisure": {
        "keywords": ["goa", "kerala", "rajasthan", "manali", "shimla", "darjeeling", "ooty", "munnar", "jaipur", "agra"],
        "base_per_day": 5000,
    },
    "domestic_metro": {
        "keywords": ["mumbai", "delhi", "bangalore", "bengaluru", "hyderabad", "chennai", "pune", "kolkata"],
        "base_per_day": 4000,
    },
    "domestic_budget": {
        "keywords": [],
        "base_per_day": 3000,
    },
}

PURPOSE_BUDGET_MULTIPLIERS = {
    "honeymoon": 2.2, "premium": 1.9,
    "business": 1.6, "family": 1.3,
    "vacation": 1.0, "event": 1.0,
    "solo": 0.7, "hometown": 0.5,
    "budget": 0.6, "emergency": 0.4,
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
    adults: Optional[int] = Field(default=None, description="Updated adult travelers count")
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
    reply: str = Field(
        description=(
            "Your conversational response as an experienced travel consultant. Rules: "
            "1. Sound like a brilliant human travel expert — warm, knowledgeable, and proactive. "
            "2. For the first mention of a destination: share one fascinating/seasonal fact + realistic budget estimate. "
            "3. For transit intents (train, flight, bus): name a specific well-known service on the route immediately. "
            "4. State your recommendation proactively ('I'd suggest X because Y') — do NOT ask open-ended questions when you can recommend. "
            "5. Ask ONLY for the NEXT single missing piece — never two questions at once. "
            "6. If visit_purpose was detected: adapt your tone (business=efficient, honeymoon=romantic, hometown=warm, emergency=calm+fast). "
            "7. If context_updates has values: confirm the change naturally ('Updated to 3 travelers — noted!'). "
            "8. NEVER mention anything already listed in ALREADY COLLECTED."
        )
    )
    widgets: List[str] = Field(
        description=(
            "Exactly ONE widget for the next missing piece, or empty list if complete. "
            "Options: 'destination_search' | 'origin_search' | 'date_range_picker' | 'optional_trip_details' | 'nearby_cities_recommendation'. "
            "IMPORTANT: If the user just provided the destination in this message, do NOT put 'destination_search'. "
            "Move to the next widget (origin_search if origin is missing, or date_range_picker if dates are missing). "
            "For emergency visit_purpose: skip optional_trip_details — return empty list once mandatory slots are done."
        )
    )
    nearby_cities: Optional[List[NearbyCityRecommendation]] = Field(
        default=None,
        description=(
            "2-3 nearby city suggestions ONLY when: intent=full_trip AND destination is known AND trip is 3+ days. "
            "Set to null otherwise."
        ),
    )
    confidence_score: int = Field(
        description="Integer 0-100 for trip profile completeness. Use the backend-computed score if available, otherwise estimate based on filled fields.",
    )
    confidence_explanation: str = Field(
        description="One encouraging sentence: what's set and what would make this 100%.",
    )


class ConversationEngine:
    def __init__(self):
        self.client = genai.Client()

    # ─────────────────────────────────────────────────────────────────────────
    # Public API
    # ─────────────────────────────────────────────────────────────────────────

    def process(self, draft, message, history=None, structured_value=None):
        extraction_tier = "ai"

        # Step 1 — Apply any explicit widget submission first
        if structured_value:
            self._apply_structured_value(draft, structured_value)
            extraction_tier = "widget"

        reply = "I'm sorry, I encountered an error. Please try again."
        widgets = []
        detected_intent = draft.intent or INTENT_FULL_TRIP

        try:
            ai_data = self._call_gemini(draft, message, history)
            detected_intent = ai_data.detected_intent or detected_intent

            # Merge AI extractions into draft (includes context_updates)
            self._merge_ai_data(draft, ai_data, message)


            # Compute deterministic confidence score (overrides AI estimate)
            confidence_score, confidence_explanation = self._calculate_confidence(draft)

            # Determine the single correct widget (uses updated draft state)
            widget_type, widget_payload = self._determine_widget(draft, ai_data)

            reply = ai_data.reply

            # Store confidence
            if not draft.metadata:
                draft.metadata = {}
            draft.metadata["confidence_score"] = confidence_score
            draft.metadata["confidence_explanation"] = confidence_explanation

            if widget_type:
                widgets = [{"type": widget_type, "data": widget_payload}]

        except Exception as e:
            print(f"[ConversationEngine] Gemini error: {e}")
            import traceback
            traceback.print_exc()
            # Deterministic fallback — show next needed widget based on current draft
            widget_type, widget_payload = self._determine_widget(draft, None)
            reply = self._fallback_reply(draft, widget_type)
            if widget_type:
                widgets = [{"type": widget_type, "data": widget_payload}]

        draft.save()

        return EngineResult(
            reply=reply,
            widgets=widgets,
            commands=[],
            extraction_tier=extraction_tier,
            missing_slots=draft.missing_slots(),
            ready=draft.is_ready_for_plan,
            detected_intent=detected_intent,
        )

    # ─────────────────────────────────────────────────────────────────────────
    # Confidence Score — Deterministic Python Calculation
    # ─────────────────────────────────────────────────────────────────────────

    def _calculate_confidence(self, draft) -> tuple:
        """
        Compute a deterministic confidence score 0-100 based on filled slots.
        This is always used — AI estimate is ignored.
        """
        from apps.planner.models import INTENT_REQUIRED_FIELDS
        intent = draft.intent or INTENT_FULL_TRIP
        meta = draft.metadata or {}
        score = 0
        notes = []

        # --- Mandatory base (50 pts) ---
        if draft.destination_text:
            score += 20
            notes.append(f"destination: {draft.destination_text}")
        if draft.start_date and draft.end_date:
            score += 20
            notes.append("dates: set")

        required = INTENT_REQUIRED_FIELDS.get(intent, [])
        if "origin" in required:
            if meta.get("origin"):
                score += 10
                notes.append(f"origin: {meta['origin']}")
            # else: 0 pts — mandatory slot missing
        else:
            score += 10  # Not required for this intent — give freely

        # --- Visit Purpose (+15) — most impactful optional ---
        if meta.get("visit_purpose"):
            score += 15
            notes.append(f"purpose: {meta['visit_purpose']}")

        # --- Optional fields (weighted) ---
        optional_weights = {
            "travelers":    5,
            "budget":       8,   # budget_tier or budget_inr
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
        for field, weight in optional_weights.items():
            filled = False
            if field == "travelers" and draft.adults and draft.adults > 0:
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

        # Build human explanation
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

        return score, explanation

    # ─────────────────────────────────────────────────────────────────────────
    # Recommended Budget Computation
    # ─────────────────────────────────────────────────────────────────────────

    def _compute_recommended_budget_inr(self, draft, purpose: Optional[str]) -> int:
        """Compute a sensible INR budget recommendation."""
        days = 1
        if draft.start_date and draft.end_date:
            days = max((draft.end_date - draft.start_date).days, 1)
        travelers = max(draft.adults or 1, 1)

        dest_lower = (draft.destination_text or "").lower()
        base_per_day = 3000  # default domestic budget

        for tier_data in DEST_TIER_RATES.values():
            if any(kw in dest_lower for kw in tier_data["keywords"]):
                base_per_day = tier_data["base_per_day"]
                break

        mult = PURPOSE_BUDGET_MULTIPLIERS.get(purpose or "vacation", 1.0)
        recommended = int(base_per_day * days * travelers * mult)

        # Clamp to slider range
        return max(50000, min(1000000, round(recommended / 5000) * 5000))

    # ─────────────────────────────────────────────────────────────────────────
    # Optional Form Prefill Builder
    # ─────────────────────────────────────────────────────────────────────────

    def _build_optional_prefilled(self, draft) -> dict:
        """Build the prefilled dict for the optional form widget from draft state + AI defaults."""
        meta = draft.metadata or {}
        purpose = meta.get("visit_purpose")
        defaults = PURPOSE_DEFAULTS.get(purpose or "vacation", PURPOSE_DEFAULTS["vacation"])

        budget_inr = meta.get("budget_inr") or self._compute_recommended_budget_inr(draft, purpose)

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
    # Gemini Call
    # ─────────────────────────────────────────────────────────────────────────

    def _call_gemini(self, draft, message, history):
        today_str = date.today().isoformat()
        intent = draft.intent or INTENT_FULL_TRIP
        meta = draft.metadata or {}

        # Build "already known" summary — AI must NEVER re-ask these
        already_known_lines = []
        if draft.destination_text:
            already_known_lines.append(f"Destination: {draft.destination_text}")
        if draft.start_date:
            already_known_lines.append(f"Start Date: {draft.start_date}")
        if draft.end_date:
            already_known_lines.append(f"End Date: {draft.end_date}")
        if draft.start_date and draft.end_date:
            already_known_lines.append(f"Duration: {(draft.end_date - draft.start_date).days} days")
        if draft.adults:
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

        already_known = (
            "\n".join(f"  - {line}" for line in already_known_lines)
            if already_known_lines else "  - (nothing collected yet)"
        )

        learned_context = self._load_learned_context(draft)

        system_prompt = f"""You are a world-class human travel consultant named Priya — you've booked thousands of trips
and you speak to clients like a trusted friend who happens to know everything about travel.
Today is {today_str}.

--- PERSONA RULES ---
1. RESPECT USER INTENT STRICTLY:
   - If user asks for a FLIGHT (flight_only): Focus 100% on flights! Recommend specific flight routes (airlines, direct vs connecting, departure windows, cabin class). DO NOT assume a 4-day full trip or ask about hotels/sightseeing unless asked.
   - If user asks for a HOTEL (hotel_only): Focus 100% on stays, resort amenities, and check-in times.
   - If user asks for a TRAIN (train_only): Focus 100% on train routes, Vande Bharat/Express options, and IRCTC seat classes.
   - Only plan multi-day hotel/tour itineraries if the user explicitly requested a full trip (full_trip).
2. HIGH-QUALITY RECOMMENDATIONS & CONVERSATIONAL QUESTIONS:
   - Always pair your questions with helpful, proactive expert recommendations.
   - Example: "IndiGo 6E-2401 departs at 08:15 AM (direct, 1h 45m) while AirIndia has an afternoon flex slot with 25kg luggage included. Would a morning or afternoon departure work better for you?"
3. Sound like a knowledgeable friend, NOT a chatbot.
4. Proactively share route insights, seasonal tips, and price estimates.
5. Name specific trains/airlines/hotels when you know the route.
6. For transit intents: give a fare/duration estimate the moment you know origin + destination.
7. For honeymoon: be romantic. For business: be efficient. For hometown: be warm and personal.
8. Never use corporate phrases like "Certainly!", "Of course!", "Absolutely!", "I'd be happy to help".
9. NEVER ask two questions at once. One natural conversational question maximum per turn.

--- EXTRACTION ---
Read the user's message and populate JSON output fields:
  - "flight to Bareilly" → detected_intent="flight_only", destination_text="Bareilly"
  - "trip to Tokyo next month for 5 days" → destination_text="Tokyo", derive start/end dates
  - "from Mumbai to Goa" → origin="Mumbai", destination_text="Goa"
  - "2 people, luxury budget" → adults=2, budget_tier="premium"
  - "Rajdhani from Delhi to Patna on 20th July" → intent="train_only", origin="Delhi", destination="Patna", start_date="2026-07-20"
  - "me and mom" → adults=2
  - "going back home" → visit_purpose="hometown"
  - "business trip" → visit_purpose="business"
  - "honeymoon" → visit_purpose="honeymoon"
  - "urgent"/"emergency" → visit_purpose="emergency"

--- ALREADY COLLECTED (CRITICAL: DO NOT ask for, mention, or show widgets for any of these) ---
{already_known}

--- INTENT: {INTENT_LABELS.get(intent, intent)} ---
{self._intent_field_rules(intent)}

--- CONTEXT UPDATES ---
If the user's message changes a slot that's already in ALREADY COLLECTED:
  - Populate context_updates with the changed field-value pairs
  - In your reply, confirm the change naturally: "Done — updated to 3 travelers!"
  - Set widgets to [] for that turn (no widget needed for a text-stated change)

--- RECOMMENDATION POLICY ---
When the optional form is next:
  - State your recommendation proactively in your reply
  - Example: "For a 7-day Bali trip I'd suggest a mid-range budget around ₹2.5L — enough for a good villa, day trips, and great food."
  - Then show the pre-filled optional form

--- WIDGET SELECTION (exactly one) ---
  - destination unknown → ["destination_search"]
  - destination known, origin unknown (for: flight_only, train_only, bus_only, cab_only, transit_only, car_rental) → ["origin_search"]
  - destination (+origin if needed) known, dates unknown → ["date_range_picker"]
  - all mandatory known, optional not submitted → ["optional_trip_details"]
  - EXCEPTION: if visit_purpose="emergency", skip optional_trip_details → []
  - full_trip, 3+ days, no nearby cities yet → ["nearby_cities_recommendation"]
  - everything done → []
{learned_context}"""

        # Build chat history
        chat_contents = []
        if history:
            for msg in history[-10:]:
                role = "user" if msg.role == "user" else "model"
                chat_contents.append({"role": role, "parts": [{"text": msg.message}]})

        chat_contents.append({"role": "user", "parts": [{"text": message or "Continue helping me plan."}]})

        response = self.client.models.generate_content(
            model="gemini-2.5-flash",
            contents=chat_contents,
            config=genai.types.GenerateContentConfig(
                system_instruction=system_prompt,
                response_mime_type="application/json",
                response_schema=ExtractedTripData,
                temperature=0.4,
            ),
        )
        return response.parsed

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

    # ─────────────────────────────────────────────────────────────────────────
    # Widget Determination — Single Source of Truth
    # ─────────────────────────────────────────────────────────────────────────

    def _determine_widget(self, draft, ai_data):
        """
        Deterministically choose exactly ONE widget based on updated draft state.
        Runs AFTER _merge_ai_data. Returns (widget_type, data_payload) or (None, {}).
        """
        from apps.planner.models import (
            INTENT_REQUIRED_FIELDS, INTENT_FLIGHT_ONLY, INTENT_TRAIN_ONLY,
            INTENT_BUS_ONLY, INTENT_CAB_ONLY, INTENT_CAR_RENTAL, INTENT_TRANSIT_ONLY
        )
        intent = draft.intent or INTENT_FULL_TRIP
        meta = draft.metadata or {}

        # Safe fallback for transit intents: if start_date is set but end_date is not
        if draft.start_date and not draft.end_date:
            transit_intents = {
                INTENT_FLIGHT_ONLY, INTENT_TRAIN_ONLY, INTENT_BUS_ONLY,
                INTENT_CAB_ONLY, INTENT_CAR_RENTAL, INTENT_TRANSIT_ONLY
            }
            if intent in transit_intents:
                draft.end_date = draft.start_date

        # Priority 1 — Destination still missing
        if not draft.destination_text:
            return "destination_search", {}

        # Priority 2 — Origin/Departure City still missing (transit intents)
        required_fields = INTENT_REQUIRED_FIELDS.get(intent, [])
        if "origin" in required_fields and not meta.get("origin"):
            return "origin_search", {
                "destination": draft.destination_text,
                "intent": intent,
            }

        # Priority 3 — Travel dates still missing
        if not (draft.start_date and draft.end_date):
            return "date_range_picker", {
                "intent": intent,
                "destination": draft.destination_text,
                "origin": meta.get("origin", ""),
            }

        # Priority 4 — Emergency fast-track: skip optional form
        if meta.get("visit_purpose") == "emergency":
            return None, {}

        # Priority 5 — Optional details not yet submitted
        if not meta.get("optional_submitted"):
            optional_fields = INTENT_OPTIONAL_FIELDS.get(intent, INTENT_OPTIONAL_FIELDS.get(INTENT_FULL_TRIP, []))
            if optional_fields:
                prefilled = self._build_optional_prefilled(draft)
                return "optional_trip_details", {
                    "fields": optional_fields,
                    "intent": intent,
                    "prefilled": prefilled,
                    "destination": draft.destination_text,
                    "duration_days": (
                        (draft.end_date - draft.start_date).days
                        if draft.start_date and draft.end_date else None
                    ),
                }

        # Priority 6 — Nearby cities (full_trip + 3+ days only)
        if (
            intent == INTENT_FULL_TRIP
            and draft.start_date and draft.end_date
            and (draft.end_date - draft.start_date).days >= 3
            and not meta.get("nearby_cities")
            and ai_data is not None
            and getattr(ai_data, "nearby_cities", None)
        ):
            suggestions = [
                {
                    "city": s.city,
                    "distance": s.distance,
                    "why_visit": s.why_visit,
                    "recommended_duration": s.recommended_duration,
                }
                for s in ai_data.nearby_cities
            ]
            return "nearby_cities_recommendation", {
                "destination": draft.destination_text,
                "suggestions": suggestions,
            }

        return None, {}

    def _get_unfilled_fields_inline(self, draft, fields):
        """Fallback in case model method not available."""
        meta = draft.metadata or {}
        filled = set()
        if draft.adults and draft.adults > 0:
            filled.add("travelers")
        if draft.budget_tier or meta.get("budget_inr"):
            filled.add("budget")
        if draft.interests:
            filled.add("interests")
        if meta.get("origin"):
            filled.add("origin")
        meta_backed = [
            "visit_purpose", "train_class", "cabin_class", "car_type", "preferred_mode",
            "flight_class", "vehicle_type", "time_window", "bus_type", "tatkal",
            "meal_preference", "non_stop", "journey_timing", "return_trip",
            "transmission", "priority", "trip_pace", "intensity_level",
            "star_rating", "stay_amenities", "property_type", "dining_package",
            "meal_type", "cuisine", "dietary", "ambiance",
        ]
        for field in meta_backed:
            if meta.get(field) is not None:
                filled.add(field)
        return [f for f in fields if f not in filled]

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


        if ai_data.destination_text and not draft.destination_text:
            city = City.objects.select_related("country").filter(
                name__iexact=ai_data.destination_text
            ).first()
            if city:
                draft.destination_city = city
                draft.destination_text = city.name
            else:
                draft.destination_text = ai_data.destination_text

        if ai_data.start_date and not draft.start_date:
            parsed = safe_parse_date(ai_data.start_date)
            if parsed:
                draft.start_date = parsed

        if ai_data.end_date and not draft.end_date:
            parsed = safe_parse_date(ai_data.end_date)
            if parsed:
                draft.end_date = parsed

        if ai_data.adults:
            draft.adults = ai_data.adults


        if ai_data.budget_tier and not draft.budget_tier:
            draft.budget_tier = ai_data.budget_tier

        if ai_data.interests and not draft.interests:
            draft.interests = ai_data.interests

        if not draft.metadata:
            draft.metadata = {}

        if ai_data.origin and "origin" not in draft.metadata:
            draft.metadata["origin"] = ai_data.origin

        # NEW: Persist visit_purpose (only if not already set)
        if ai_data.visit_purpose and not draft.metadata.get("visit_purpose"):
            draft.metadata["visit_purpose"] = ai_data.visit_purpose

        # NEW: Persist budget_inr (only if not already set)
        if ai_data.budget_inr and not draft.metadata.get("budget_inr"):
            draft.metadata["budget_inr"] = ai_data.budget_inr

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
                if field == "adults":
                    try:
                        draft.adults = max(int(value), 1)
                    except (ValueError, TypeError):
                        pass
                elif field == "budget_tier":
                    draft.budget_tier = str(value)
                elif field == "budget_inr":
                    try:
                        draft.metadata["budget_inr"] = int(value)
                    except (ValueError, TypeError):
                        pass
                elif field == "interests":
                    draft.interests = value if isinstance(value, list) else [str(value)]
                elif field == "origin":
                    draft.metadata["origin"] = str(value)
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
        origin = meta.get("origin", "")

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
        if widget_type == "nearby_cities_recommendation":
            return f"Since you have a few days in {dest}, there are some great nearby spots worth adding. Interested?"
        return "You're all set! Hit 'Create Plan' whenever you're ready."

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

        elif field == "origin" and isinstance(value, dict):
            if not draft.metadata:
                draft.metadata = {}
            draft.metadata["origin"] = value.get("name", "")[:160]

        elif field == "travel_dates" and isinstance(value, dict):
            start_str = value.get("start_date")
            end_str = value.get("end_date")
            if start_str:
                parsed_start = safe_parse_date(start_str)
                if parsed_start:
                    draft.start_date = parsed_start
            if end_str:
                parsed_end = safe_parse_date(end_str)
                if parsed_end:
                    draft.end_date = parsed_end

        elif field == "travelers" and isinstance(value, dict):
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

        elif field == "budget":
            if isinstance(value, dict):
                draft.budget_tier = value.get("tier", draft.budget_tier)
                draft.budget_amount = value.get("amount", draft.budget_amount)
                draft.budget_currency = value.get("currency", draft.budget_currency)
            elif isinstance(value, str):
                draft.budget_tier = value[:40]

        elif field == "interests":
            draft.interests = value if isinstance(value, list) else draft.interests

        elif field == "optional_trip_details" and isinstance(value, dict):
            if not draft.metadata:
                draft.metadata = {}

            # Travelers
            if "travelers" in value and value["travelers"] is not None:
                try:
                    draft.adults = max(int(value["travelers"] or 1), 1)
                except (ValueError, TypeError):
                    pass
            if "children" in value and value["children"] is not None:
                try:
                    draft.children = max(int(value["children"] or 0), 0)
                except (ValueError, TypeError):
                    pass

            # Budget — accepts both tier+inr
            if "budget" in value and value["budget"] is not None:
                b = value["budget"]
                if isinstance(b, dict):
                    draft.budget_tier = b.get("tier", draft.budget_tier)
                    if b.get("amount"):
                        draft.budget_amount = b.get("amount", draft.budget_amount)
                    draft.budget_currency = b.get("currency", draft.budget_currency)

            if "budget_inr" in value and value["budget_inr"] is not None:
                try:
                    draft.metadata["budget_inr"] = int(value["budget_inr"])
                    # Also derive budget_tier from the INR amount
                    inr = int(value["budget_inr"])
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
                draft.metadata["origin"] = value["origin"]

            # All new optional metadata fields
            optional_meta_fields = [
                "visit_purpose", "train_class", "cabin_class", "car_type", "preferred_mode",
                "flight_class", "vehicle_type", "time_window", "bus_type", "tatkal",
                "meal_preference", "non_stop", "journey_timing", "return_trip",
                "transmission", "priority", "trip_pace", "intensity_level",
                "star_rating", "stay_amenities", "property_type", "dining_package",
                "meal_type", "cuisine", "dietary", "ambiance",
            ]
            for extra_field in optional_meta_fields:
                if extra_field in value and value[extra_field] is not None:
                    draft.metadata[extra_field] = value[extra_field]

            draft.metadata["optional_submitted"] = True

        elif field == "add_nearby_city":
            if not draft.metadata:
                draft.metadata = {}
            nearby_cities = draft.metadata.get("nearby_cities", [])

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
