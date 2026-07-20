"""
PlanContext — the single anti-leak boundary between everything a trip's
conversation/memory has captured and what the generation prompts actually
see (docs/planner-output-generation-architecture.md Part B).

Before this module, plan_generation.py hand-picked a handful of draft
fields inline at each prompt site. dietary/pace/stay/cabin/accessibility/
ai_preferences were captured into TripDraftState.metadata by the
conversation flow and then silently never read by generation — the
itinerary came out grounded but generic, not personalized. If a signal
isn't normalized into PlanContext.prefs here, it does not reach the LLM.
That makes this module the ONLY place a preference can leak, and that
claim is enforced by tests/test_plan_context.py::test_no_preference_dropped.

PlanContextBuilder.build() takes the ALREADY-SNAPSHOTTED `draft` object
(never re-fetches it) — see plan_generation.run_generation_job's snapshot
contract (Phase 0d).
"""

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional
from dataclasses import asdict

# Every TripDraftState.metadata key this module knows how to normalize into
# `prefs`. test_no_preference_dropped enforces that every key set on a
# draft's metadata actually surfaces somewhere in the returned prefs dict —
# add new capture points to conversation_engine.py AND this tuple together.
KNOWN_PREFERENCE_KEYS = (
    "interests",
    "dietary",
    "cuisine",
    "ambiance",
    "meal_type",
    "trip_pace",
    "intensity_level",
    "group_type",
    "star_rating",
    "property_type",
    "stay_amenities",
    "preferred_mode",
    "flight_class",
    "train_class",
    "bus_type",
    "cabin_class",
    "car_type",
    "vehicle_type",
    "transmission",
    "accessibility",
    "pets",
    "special_notes",
    "passport_ready",
    "visa_status",
    "forex_needed",
    # Phase 5 (M4 depth, chat intake completeness):
    "children_ages",
    "budget_split",
    "interests_other",
    "visit_purpose_other",
)


@dataclass
class PlanContext:
    intent: str
    destination_text: str
    start_date: Any
    end_date: Any
    adults: int
    children: int
    infants: int
    budget_tier: Optional[str]
    budget_amount: Optional[float]
    budget_currency: Optional[str]
    origin: str
    visit_purpose: str
    # Phase 5 (M4 depth): ages, when the traveler gave them — age-appropriate
    # activity/hotel suitability. Empty when only a child COUNT was given
    # (the pre-existing signal, still carried separately as `children` above).
    children_ages: List[int] = field(default_factory=list)
    # Normalized preferences — the anti-leak surface. See KNOWN_PREFERENCE_KEYS.
    prefs: Dict[str, Any] = field(default_factory=dict)
    # Durable cross-trip TravelerProfile facts, canonical keys (flat dict).
    profile_facts: Dict[str, Any] = field(default_factory=dict)
    # Must-honor vs nice-to-have split (accessibility/dietary are hard;
    # values/avoid are soft) — consumed by validation/scoring in later phases.
    must_honor: List[str] = field(default_factory=list)
    commitments: List[Dict[str, Any]] = field(default_factory=list)
    rejections: List[str] = field(default_factory=list)


class PlanContextBuilder:
    @staticmethod
    def build(draft) -> PlanContext:
        meta = draft.metadata or {}

        from apps.planner.services.intelligence.preferences import get_ai_preferences

        ai_prefs = get_ai_preferences(draft)

        # Phase 5 (M4 depth): a free-text "other" interest rides alongside the
        # fixed chip set rather than replacing it — deduped, order-preserving.
        interests_list = list(draft.interests or meta.get("interests") or [])
        if meta.get("interests_other"):
            interests_list = list(dict.fromkeys(interests_list + [meta["interests_other"]]))

        prefs: Dict[str, Any] = {
            "interests": interests_list,
            "dietary": meta.get("dietary"),
            "cuisine": meta.get("cuisine"),
            "ambiance": meta.get("ambiance"),
            "meal_type": meta.get("meal_type"),
            "pace": meta.get("trip_pace"),
            "intensity": meta.get("intensity_level"),
            "group_type": meta.get("group_type"),
            "stay": {
                "star_rating": meta.get("star_rating"),
                "property_type": meta.get("property_type"),
                "amenities": meta.get("stay_amenities"),
            },
            "transport": {
                "preferred_mode": meta.get("preferred_mode"),
                "flight_class": meta.get("flight_class"),
                "train_class": meta.get("train_class"),
                "bus_type": meta.get("bus_type"),
                "cabin_class": meta.get("cabin_class"),
                "car_type": meta.get("car_type"),
                "vehicle_type": meta.get("vehicle_type"),
                "transmission": meta.get("transmission"),
                "mobility": dict(meta.get("mobility") or {}),
            },
            "accessibility": meta.get("accessibility") or [],
            "pets": meta.get("pets"),
            "special_notes": meta.get("special_notes"),
            # Phase 5 (M4 depth): an optional, traveler-offered split of the
            # single budget_amount across categories — soft guidance for the
            # compose prompt, not a hard per-category cap (no per-category
            # enforcement mechanism exists anywhere downstream; see
            # docs/agent/HANDOFF.md Phase 5 note on scope).
            "budget_split": meta.get("budget_split") or {},
            "international": {
                "passport_ready": meta.get("passport_ready"),
                "visa_status": meta.get("visa_status"),
                "forex_needed": meta.get("forex_needed"),
            },
            "values": ai_prefs["values"],
            "avoid": ai_prefs["avoid"],
            "reasons": ai_prefs["reasons"],
        }

        must_honor: List[str] = []
        if prefs["dietary"]:
            must_honor.append("dietary")
        if prefs["accessibility"]:
            must_honor.append("accessibility")
        if prefs["transport"].get("preferred_mode"):
            must_honor.append("transport")

        profile_facts: Dict[str, Any] = {}
        user = getattr(getattr(draft, "workspace", None), "user", None)
        if user is not None:
            try:
                from apps.planner.models import TravelerProfile

                profile = TravelerProfile.objects.filter(user=user).first()
                if profile and profile.facts:
                    profile_facts = {f["key"]: f["value"] for f in profile.facts if f.get("key")}
            except Exception:
                profile_facts = {}
        # REC-01 R9: merge the cross-trip signal (TravelerProfile.facts
        # "recent_choice_ids", written by _persist_trip after every
        # generation, keyed by user so it survives across different trips)
        # with this trip's own last-run choices — the recency penalty in
        # ranking.score_candidate reads _recent_choice_ids and previously
        # only ever saw the latter, so a DIFFERENT trip to the same city
        # started with zero memory of what was already recommended.
        cross_trip_recent = list(profile_facts.get("recent_choice_ids") or [])
        same_trip_recent: List[str] = []
        try:
            trip = draft.workspace.trip
            same_trip_recent = list((trip.metadata or {}).get("last_generation_choice_ids") or [])
        except Exception:
            pass
        profile_facts["_recent_choice_ids"] = list(dict.fromkeys(same_trip_recent + cross_trip_recent))

        commitments = list(meta.get("commitments") or [])
        rejections = list(meta.get("rejections") or meta.get("rejected_candidates") or [])
        try:
            trip = draft.workspace.trip
            rejections.extend(list((trip.metadata or {}).get("rejected_candidates") or []))
            for day in trip.days or []:
                for block in day.get("activities") or []:
                    block_meta = block.get("metadata") or {}
                    status = str(block.get("block_status") or block.get("status") or "")
                    commitment = None
                    if status == "booked":
                        commitment = "booked"
                    elif block.get("locked") or block_meta.get("locked"):
                        commitment = "locked"
                    elif block.get("pinned") or block_meta.get("pinned"):
                        commitment = "locked"
                    elif status in {"selected", "accepted"}:
                        commitment = "locked"
                    if commitment:
                        commitments.append({
                            "level": commitment,
                            "day_date": day.get("date"),
                            "block": block,
                        })
        except Exception:
            pass

        return PlanContext(
            intent=draft.intent or "full_trip",
            destination_text=draft.destination_text or "",
            start_date=draft.start_date,
            end_date=draft.end_date,
            adults=draft.adults or 1,
            children=draft.children or 0,
            infants=draft.infants or 0,
            budget_tier=draft.budget_tier,
            budget_amount=draft.budget_amount,
            budget_currency=draft.budget_currency,
            origin=draft.origin_text or meta.get("origin") or meta.get("origin_text") or "",
            # Phase 5 (M4 depth): a free-text "other" purpose is more
            # specific than a fixed chip, so it wins when both are present.
            visit_purpose=meta.get("visit_purpose_other") or meta.get("visit_purpose") or "",
            children_ages=[int(a) for a in (meta.get("children_ages") or []) if str(a).strip().isdigit()],
            prefs=prefs,
            profile_facts=profile_facts,
            must_honor=must_honor,
            commitments=commitments,
            rejections=list(dict.fromkeys(str(value) for value in rejections)),
        )

    @staticmethod
    def fingerprint_payload(draft) -> Dict[str, Any]:
        """Complete serialized generation context used by revision-safe hashes."""
        context = PlanContextBuilder.build(draft)
        payload = asdict(context)
        for key in ("start_date", "end_date"):
            value = payload.get(key)
            payload[key] = value.isoformat() if hasattr(value, "isoformat") else value
        payload["destination_city_id"] = str(draft.destination_city_id or "")
        payload["origin_city_id"] = str(draft.origin_city_id or "")
        payload["locked_fields"] = sorted((draft.metadata or {}).get("locked_fields") or [])
        payload["selected_nearby_cities"] = list((draft.metadata or {}).get("nearby_cities") or [])
        return payload


def prefs_prompt_block(plan_context: "PlanContext") -> str:
    """
    Compiled TRAVELER PREFERENCES prompt block — this is the anti-leak
    payoff: every normalized pref that has a value is rendered here so the
    compose LLM actually sees it, instead of the compose prompt hand-
    picking a handful of fields inline (adults/children/interests/budget_
    tier only, previously). Empty string when nothing to say.
    """
    prefs = plan_context.prefs
    lines: List[str] = []

    # CTX-01 (docs/planner-complete-current-audit-and-repair-plan.md §19
    # R7): the numeric budget was captured on PlanContext (and already
    # reached deterministic hotel ranking via ranking._budget_fit) but never
    # rendered into the prompt text itself — only the coarse budget_tier
    # label did. The LLM composing the itinerary never actually saw the
    # number it was supposedly planning within.
    if plan_context.budget_amount is not None:
        currency = plan_context.budget_currency or "INR"
        lines.append(
            f"Total trip budget: {plan_context.budget_amount} {currency} for the whole trip "
            "(all travelers, all days) — treat this as a firm cap; favor venues, hotels, and "
            "activities that fit comfortably within it."
        )

    if prefs.get("dietary"):
        lines.append(f"Dietary requirement: {prefs['dietary']} — every restaurant/food block MUST accommodate this.")
    if prefs.get("cuisine"):
        lines.append(f"Preferred cuisine: {prefs['cuisine']}")
    if prefs.get("ambiance"):
        lines.append(f"Dining ambiance: {prefs['ambiance']}")
    if prefs.get("meal_type"):
        lines.append(f"Meal plan preference: {prefs['meal_type']}")
    if prefs.get("pace"):
        lines.append(f"Trip pace: {prefs['pace']}")
    if prefs.get("intensity"):
        lines.append(f"Activity intensity: {prefs['intensity']}")
    if prefs.get("group_type"):
        lines.append(f"Traveling as: {prefs['group_type']} — weight venue/activity choices accordingly (e.g. honeymoon → romantic, family → kid-friendly).")

    stay = prefs.get("stay") or {}
    if stay.get("star_rating"):
        lines.append(f"Preferred hotel star rating: {stay['star_rating']}")
    if stay.get("property_type"):
        lines.append(f"Preferred property type: {stay['property_type']}")
    if stay.get("amenities"):
        lines.append(f"Wanted amenities: {stay['amenities']}")

    transport = prefs.get("transport") or {}
    if transport.get("preferred_mode"):
        lines.append(
            f"REQUIRED transport mode: {transport['preferred_mode']} — every transit/transport leg "
            "between cities MUST use this exact mode (transport_mode field), never substitute cab or "
            "another mode, unless no route by that mode is physically possible."
        )
    for label, key in (
        ("Flight class", "flight_class"),
        ("Train class", "train_class"),
        ("Bus type", "bus_type"),
        ("Cabin class", "cabin_class"),
        ("Car type", "car_type"),
        ("Vehicle type", "vehicle_type"),
        ("Transmission", "transmission"),
    ):
        if transport.get(key):
            lines.append(f"{label}: {transport[key]}")

    if prefs.get("accessibility"):
        needs = ", ".join(prefs["accessibility"])
        lines.append(f"Accessibility needs: {needs} — every venue MUST accommodate these; never suggest a venue that can't.")
    if prefs.get("pets"):
        lines.append("Traveling with a pet — factor in pet-friendly venues where relevant.")
    if prefs.get("special_notes"):
        lines.append(f"Special notes: {prefs['special_notes']}")

    # Phase 5 (M4 depth): children's ages, when given — age-appropriate
    # activity/hotel suitability, not just "N children" as an undifferentiated count.
    if plan_context.children_ages:
        ages = ", ".join(str(a) for a in plan_context.children_ages)
        lines.append(f"Traveling with children aged: {ages} — favor age-appropriate activities and avoid anything unsuitable for the youngest.")

    # Phase 5 (M4 depth): an optional, traveler-offered per-category budget
    # split — soft guidance (a preference to weight toward), not a second
    # hard cap; the one hard cap remains the total budget_amount line above.
    budget_split = prefs.get("budget_split") or {}
    if budget_split:
        parts = ", ".join(f"{category}: {share}%" for category, share in budget_split.items())
        lines.append(f"Traveler's preferred budget split across categories: {parts} — weight allocation toward this where it doesn't conflict with the total cap.")

    # CTX-01 R7: international/passport/visa/forex signals were normalized
    # into prefs but never rendered — this is informational logistics
    # context (mirrors the other "apply silently, never ask again" facts
    # above), not a hard venue constraint like dietary/accessibility.
    international = prefs.get("international") or {}
    if international.get("passport_ready") is False:
        lines.append("Traveler's passport is not yet ready — note this only if it affects trip timing; do not ask about it again.")
    if international.get("visa_status"):
        lines.append(f"Visa status: {international['visa_status']}")
    if international.get("forex_needed"):
        lines.append("Traveler will need foreign currency for this trip.")

    if prefs.get("values"):
        lines.append(f"Values (weight toward these): {', '.join(prefs['values'])}")
    if prefs.get("avoid"):
        lines.append(f"Avoid: {', '.join(prefs['avoid'])}")

    if not lines:
        return ""
    return "TRAVELER PREFERENCES (apply to every choice silently, never ask about these again):\n" + "\n".join(
        f"- {line}" for line in lines
    )
