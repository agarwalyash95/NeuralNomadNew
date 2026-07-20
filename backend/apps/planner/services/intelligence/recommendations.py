"""
Ranked, reasoned recommendations — deterministic and DB-backed.

Every builder returns reasons the UI can show behind a tiny "Why?" toggle,
plus smart defaults so a card's Done-without-touching (or Skip) still yields
a sensible draft. Price lines come from TravelPriceHistory or not at all —
no invented numbers (docs/ai-orchestration-architecture.md §9).

All functions here are READ-ONLY on the draft.
"""

from datetime import date
from typing import Any, Dict, List, Optional, Tuple

from apps.planner.services.intelligence.clusters import MODE_CHOICES
from apps.planner.services.intelligence import preferences as _prefs
from apps.reference.services import price_estimator

# ── Shared purpose/destination heuristics (moved from conversation_engine —
#    intelligence is the canonical home; the engine imports from here). ────

PURPOSE_DEFAULTS: Dict[str, Dict[str, Any]] = {
    "vacation":  {"budget_tier": "mid_range",  "travelers": 2,  "train_class": "2AC",     "flight_class": "Economy",  "cabin_class": "Oceanview", "car_type": "Sedan",    "interests": ["beach", "nature"],   "time_window": "any"},
    "business":  {"budget_tier": "premium",    "travelers": 1,  "train_class": "2AC",     "flight_class": "Business", "cabin_class": None,        "car_type": "Sedan",    "interests": [],                    "time_window": "morning"},
    "hometown":  {"budget_tier": "budget",     "travelers": 2,  "train_class": "Sleeper", "flight_class": "Economy",  "cabin_class": None,        "car_type": "Hatchback","interests": [],                    "time_window": "any"},
    "family":    {"budget_tier": "mid_range",  "travelers": 4,  "train_class": "3AC",     "flight_class": "Economy",  "cabin_class": "Oceanview", "car_type": "SUV",      "interests": ["family", "culture"], "time_window": "morning"},
    "honeymoon": {"budget_tier": "premium",    "travelers": 2,  "train_class": "1AC",     "flight_class": "Business", "cabin_class": "Balcony",   "car_type": "SUV",      "interests": ["romantic", "food"],  "time_window": "evening"},
    "solo":      {"budget_tier": "budget",     "travelers": 1,  "train_class": "Sleeper", "flight_class": "Economy",  "cabin_class": "Interior",  "car_type": "Hatchback","interests": ["adventure"],         "time_window": "any"},
    "event":     {"budget_tier": "mid_range",  "travelers": 2,  "train_class": "2AC",     "flight_class": "Economy",  "cabin_class": None,        "car_type": "Sedan",    "interests": [],                    "time_window": "morning"},
    "emergency": {"budget_tier": "budget",     "travelers": 1,  "train_class": "any",     "flight_class": "Economy",  "cabin_class": None,        "car_type": "Hatchback","interests": [],                    "time_window": "earliest"},
}

_ISLAND_KEYWORDS = {"andamans", "port blair", "maldives", "bali", "phuket", "mauritius", "seychelles", "hawaii", "lakshadweep"}

_DEST_INTEREST_HINTS = [
    (["goa", "bali", "maldives", "phuket", "andaman", "beach", "kovalam", "gokarna"], ["beach", "nature"]),
    (["manali", "shimla", "darjeeling", "ooty", "munnar", "himachal", "ladakh", "uttarakhand", "sikkim"], ["nature", "adventure"]),
    (["jaipur", "agra", "udaipur", "varanasi", "rajasthan", "hampi", "delhi"], ["history", "culture"]),
    (["mumbai", "bangalore", "bengaluru", "hyderabad", "chennai", "kolkata", "pune", "tokyo", "london", "paris", "singapore", "dubai", "new york"], ["culture", "food"]),
]

_MODE_LABELS = {
    "flight": "Flight", "train": "Train", "bus": "Bus",
    "cab": "Cab", "self_drive": "Self-drive",
}

_MODE_EMISSIONS = {
    "train": "Lowest emissions",
    "bus": "Low emissions",
    "cab": None,
    "self_drive": None,
    "flight": None,
}


def infer_interests(destination_text: str) -> List[str]:
    dest_lower = (destination_text or "").lower()
    for keywords, interests in _DEST_INTEREST_HINTS:
        if any(kw in dest_lower for kw in keywords):
            return list(interests)
    return []


def _trip_days(draft) -> int:
    if draft.start_date and draft.end_date:
        return max((draft.end_date - draft.start_date).days, 1)
    return 1


def _cheapest_price(row) -> Optional[int]:
    """Cheapest fare on a TravelPriceHistory row (train rows carry per-class prices)."""
    try:
        details = row.details or {}
        classes = details.get("classes") or []
        class_prices = [int(c["price"]) for c in classes if c.get("price")]
        if class_prices:
            return min(class_prices)
        if row.price is not None:
            return int(row.price)
    except (TypeError, ValueError, KeyError):
        pass
    return None


def _row_duration(row) -> Optional[str]:
    try:
        return (row.details or {}).get("duration")
    except AttributeError:
        return None


def _row_departure(row) -> Optional[str]:
    try:
        return (row.details or {}).get("departure_time")
    except AttributeError:
        return None


def route_price_summary(draft) -> Dict[str, Dict[str, Any]]:
    """
    Real route data per mode from TravelPriceHistory:
      {"flight": {"price": int, "duration": str|None, "departure": str|None,
                  "provider": str|None}, "train": {...}, "bus": {...}}
    Only modes with actual rows appear. Empty dict when nothing matches —
    callers must degrade honestly.
    """
    meta = draft.metadata or {}
    dest = (draft.destination_text or "").strip()
    origin = (meta.get("origin") or "").strip()
    if not dest or not origin:
        return {}

    try:
        from django.db.models import Q
        from apps.reference.models import TravelPriceHistory
    except Exception:
        return {}

    summary: Dict[str, Dict[str, Any]] = {}
    try:
        flights = TravelPriceHistory.objects.filter(service_type="flight").filter(
            Q(airport_route__source__city__name__icontains=origin)
            | Q(airport_route__source__iata_code__icontains=origin)
        ).filter(
            Q(airport_route__destination__city__name__icontains=dest)
            | Q(airport_route__destination__iata_code__icontains=dest)
        ).order_by("-date")[:5]

        trains = TravelPriceHistory.objects.filter(service_type="train").filter(
            Q(train_route__source__city__name__icontains=origin)
            | Q(train_route__source__code__icontains=origin)
        ).filter(
            Q(train_route__destination__city__name__icontains=dest)
            | Q(train_route__destination__code__icontains=dest)
        ).order_by("-date")[:5]

        buses = TravelPriceHistory.objects.filter(
            service_type="bus",
            bus_route__source__city__name__icontains=origin,
            bus_route__destination__city__name__icontains=dest,
        ).order_by("-date")[:5]

        for mode, rows in (("flight", flights), ("train", trains), ("bus", buses)):
            best_row, best_price = None, None
            for row in rows:
                price = _cheapest_price(row)
                if price is not None and (best_price is None or price < best_price):
                    best_row, best_price = row, price
            if best_row is not None:
                summary[mode] = {
                    "price": best_price,
                    "duration": _row_duration(best_row),
                    "departure": _row_departure(best_row),
                    "provider": getattr(best_row, "provider", None),
                }
    except Exception as exc:  # DB shape drift must never break a turn
        print(f"[Intelligence] route_price_summary failed (non-fatal): {exc}")
        return {}
    return summary


def median_hotel_price_per_night(draft) -> Optional[int]:
    dest = (draft.destination_text or "").strip()
    if not dest:
        return None
    try:
        from apps.reference.models import TravelPriceHistory
        rows = TravelPriceHistory.objects.filter(
            service_type="hotel", hotel__city__name__icontains=dest
        ).order_by("-date")[:20]
        nightly: List[int] = []
        for row in rows:
            rooms = (row.details or {}).get("rooms") or []
            room_prices = [int(r["price_per_night"]) for r in rooms if r.get("price_per_night")]
            if room_prices:
                nightly.append(min(room_prices))
            elif row.price is not None:
                nightly.append(int(row.price))
        if not nightly:
            return None
        nightly.sort()
        return nightly[len(nightly) // 2]
    except Exception as exc:
        print(f"[Intelligence] median_hotel_price failed (non-fatal): {exc}")
        return None


def recommended_budget_inr(draft, purpose: Optional[str] = None) -> Tuple[int, List[str], bool]:
    """
    (amount, reasons, db_backed) — DB-first budget ballpark: median hotel
    night × nights × rooms + cheapest fare × travelers; falls back to the
    destination-tier heuristic when the DB has nothing for this place.
    """
    meta = draft.metadata or {}
    purpose = purpose or meta.get("visit_purpose")
    days = _trip_days(draft)
    travelers = max(draft.adults or 1, 1)
    mult = price_estimator.PURPOSE_BUDGET_MULTIPLIERS.get(purpose or "vacation", 1.0)

    reasons: List[str] = []
    hotel_night = median_hotel_price_per_night(draft)
    route = route_price_summary(draft)
    cheapest_fare = min((m["price"] for m in route.values()), default=None)

    if hotel_night:
        rooms = max(1, (travelers + 1) // 2)
        stay_cost = hotel_night * max(days, 1) * rooms
        food_envelope = price_estimator.estimate("food_daily", travelers=travelers, days=days, purpose=purpose)
        food_local = food_envelope["expected"] or 0
        total = stay_cost + food_local
        reasons.append(f"₹{hotel_night:,}/night median hotel price here")
        if cheapest_fare:
            total += cheapest_fare * travelers * 2  # return fare
            reasons.append(f"fares from ₹{cheapest_fare:,} per person each way")
        reasons.append(f"{days} day{'s' if days != 1 else ''} × {travelers} traveler{'s' if travelers != 1 else ''}")
        total = int(total * max(mult, 0.6))
        return max(20000, min(2000000, round(total / 5000) * 5000)), reasons[:3], True

    # estimate_trip_day_budget already applies the purpose multiplier
    # internally — don't reapply it here.
    day_budget_envelope = price_estimator.estimate("trip_day_budget", destination_text=draft.destination_text, purpose=purpose)
    base_per_day = day_budget_envelope["expected"] or 3000
    recommended = int(base_per_day * days * travelers)
    dest_lower = (draft.destination_text or "").lower()
    is_international = any(
        any(kw in dest_lower for kw in tier_data["keywords"])
        for name, tier_data in price_estimator.DEST_TIER_RATES.items()
        if name.startswith("international")
    )
    reasons.append(f"typical {'international' if is_international else 'domestic'} costs for this destination")
    if purpose:
        reasons.append(f"adjusted for a {purpose} trip")
    return max(50000, min(1000000, round(recommended / 5000) * 5000)), reasons[:3], False


def recommend_transport_mode(draft, route: Optional[Dict[str, Dict[str, Any]]] = None) -> Dict[str, Any]:
    """
    Pure ranking (NO draft writes — replaces the payload-builder that used to
    save preferred_mode as a side effect). Returns
    {"mode", "text", "confidence", "reasons": [...]}.
    """
    meta = draft.metadata or {}
    dest = (draft.destination_text or "").strip()
    dest_lower = dest.lower()
    origin = (meta.get("origin") or "").strip()
    route = route if route is not None else route_price_summary(draft)

    if any(isl in dest_lower for isl in _ISLAND_KEYWORDS):
        return {
            "mode": "flight",
            "text": f"Flight is the practical way to reach {dest or 'your destination'} — island route, no train or road access.",
            "confidence": 98,
            "reasons": ["Island destination — no rail or road access", "Fastest option"],
        }

    flight, train = route.get("flight"), route.get("train")
    if flight and train:
        delta = flight["price"] - train["price"]
        if delta > 500:
            reasons = [f"₹{delta:,} cheaper than flying"]
            if train.get("duration"):
                reasons.append(f"~{train['duration']} journey")
            reasons.append("Lowest emissions")
            return {
                "mode": "train",
                "text": f"Train wins on this route — ₹{delta:,} cheaper than flying" + (f" at about {train['duration']}." if train.get("duration") else "."),
                "confidence": 94,
                "reasons": reasons[:3],
            }
        reasons = ["Fastest option"]
        if flight.get("duration"):
            reasons.append(f"~{flight['duration']} in the air")
        reasons.append(f"from ₹{flight['price']:,}")
        return {
            "mode": "flight",
            "text": f"Flight is worth it here — fares start around ₹{flight['price']:,} and it's much faster than rail.",
            "confidence": 92,
            "reasons": reasons[:3],
        }
    if train and not flight:
        return {
            "mode": "train",
            "text": f"Train is the strong option from {origin or 'your city'} — direct rail service on this route" + (f" from ₹{train['price']:,}." if train.get("price") else "."),
            "confidence": 92,
            "reasons": [r for r in [
                f"from ₹{train['price']:,}" if train.get("price") else None,
                f"~{train['duration']} journey" if train.get("duration") else None,
                "Lowest emissions",
            ] if r][:3],
        }
    if flight and not train:
        return {
            "mode": "flight",
            "text": f"Flight is the practical pick — it's the direct connection we found for this route, from ₹{flight['price']:,}.",
            "confidence": 93,
            "reasons": [r for r in [
                "Direct connection on this route",
                f"from ₹{flight['price']:,}" if flight.get("price") else None,
                f"~{flight['duration']}" if flight.get("duration") else None,
            ] if r][:3],
        }

    bus = route.get("bus")
    if bus:
        return {
            "mode": "bus",
            "text": f"Bus is the option we found for this route, from ₹{bus['price']:,}.",
            "confidence": 85,
            "reasons": [f"from ₹{bus['price']:,}", "Low emissions"],
        }

    return {
        "mode": "flight",
        "text": "Flight is usually the smoothest pick for this kind of trip — but every option below stays open.",
        "confidence": 75,
        "reasons": ["Fastest for most routes", "No route pricing in our data yet — pick what suits you"],
    }


def build_mode_options(draft) -> List[Dict[str, Any]]:
    """
    The explicit 5-way mode choice for the logistics card. Every mode is
    always listed and tappable; real price/duration lines attach only where
    TravelPriceHistory has the route (honest degrade). All detail data ships
    in the payload so the card reacts instantly with no round trip.
    """
    route = route_price_summary(draft)
    rec = recommend_transport_mode(draft, route)
    options = []
    for mode in MODE_CHOICES:
        row = route.get(mode)
        details: Dict[str, Any] = {
            "duration": row.get("duration") if row else None,
            "price_line": f"from ₹{row['price']:,}" if row and row.get("price") else None,
            "departure_hint": f"departs {row['departure']}" if row and row.get("departure") else None,
            "provider": row.get("provider") if row else None,
            "emissions_note": _MODE_EMISSIONS.get(mode),
            "reasons": rec["reasons"] if mode == rec["mode"] else [],
        }
        if mode in ("cab", "self_drive") and not details["price_line"]:
            details["note"] = "Fare depends on distance & vehicle"
        options.append({
            "mode": mode,
            "label": _MODE_LABELS[mode],
            "details": details,
            "recommended": mode == rec["mode"],
        })
    return options


def _stay_defaults(purpose: Optional[str], bias: Dict[str, bool]) -> Dict[str, Any]:
    star = {"honeymoon": 5, "business": 4, "family": 4, "premium": 5}.get(purpose or "", 3)
    prop = "resort" if purpose == "honeymoon" else "hotel"
    if bias.get("wants_scenery") and purpose != "business":
        prop = "resort"
    return {"star_rating": star, "property_type": prop}


def _stay_reco_text(draft, purpose: Optional[str], bias: Dict[str, bool]) -> Tuple[str, List[str]]:
    dest = draft.destination_text or "your destination"
    if purpose == "business":
        return (
            f"A 4★ business hotel near the commercial hub of {dest} keeps commutes short.",
            ["Close to business districts", "Reliable WiFi & desk space", "Late checkout options"],
        )
    if purpose == "honeymoon":
        text = f"A premium resort in {dest} with a couples-friendly setting fits a honeymoon best."
        reasons = ["Privacy and couple-focused amenities", "Top-rated for special occasions"]
        if bias.get("wants_scenery"):
            text = f"A view room at a premium resort — you said the view matters, so I'd prioritise scenery over saving here."
            reasons.insert(0, "You value scenery over price")
        return text, reasons[:3]
    if purpose == "family":
        return (
            f"A well-rated, family-friendly hotel in a central, safe part of {dest}.",
            ["Safe central location", "Family rooms available", "Easy transport connections"],
        )
    reasons = ["Central location saves transit time", "Best value comfort tier"]
    text = f"A well-located 3–4★ hotel in {dest} balances comfort and value."
    if bias.get("wants_scenery"):
        text = f"A view-facing room in {dest} — you mentioned scenery matters, so I'd put budget there."
        reasons.insert(0, "You value scenery over price")
    if bias.get("avoids_crowds"):
        reasons.insert(0, "Quieter neighborhood, away from the busiest strips")
    return text, reasons[:3]


def cluster_recommendation(draft, cluster: str, fields: List[str]) -> Dict[str, Any]:
    """{text, confidence, reasons} for a cluster card — always returns, never raises."""
    meta = draft.metadata or {}
    purpose = meta.get("visit_purpose")
    bias = _prefs.preference_bias(draft)
    dest = draft.destination_text or "your destination"

    try:
        if cluster == "party":
            if purpose:
                return {
                    "text": f"Got it — a {purpose} trip. Who's coming along" + (", and from where?" if "origin" in fields else "?"),
                    "confidence": 88,
                    "reasons": ["Group size sets pace, rooms, and fares", "Departure city fixes routes and prices"][: 2 if "origin" in fields else 1],
                }
            return {
                "text": "Who's traveling shapes everything — pace, rooms, and the right fares.",
                "confidence": 84,
                "reasons": ["Group size sets hotel rooms and fares", "The occasion tunes my recommendations"],
            }

        if cluster in ("trip_style", "stay_style", "dining"):
            amount, reasons, db_backed = recommended_budget_inr(draft, purpose)
            if cluster == "trip_style":
                text = f"For this trip I'd plan around ₹{amount:,}" + (" — based on real prices here." if db_backed else " as a working ballpark.")
                if bias.get("wants_scenery"):
                    text += " Happy to tilt it toward better views."
                return {"text": text, "confidence": 90 if db_backed else 78, "reasons": reasons}
            if cluster == "stay_style":
                text, stay_reasons = _stay_reco_text(draft, purpose, bias)
                return {"text": text, "confidence": 90, "reasons": stay_reasons}
            # dining
            text = f"Tell me your food style and I'll point at actual places in {dest}."
            reasons = ["Filters live restaurant results", "Dietary needs are respected everywhere in the plan"]
            if bias.get("foodie"):
                text = f"You clearly care about food — let's lock the style so I can shortlist the best of {dest}."
                reasons.insert(0, "You flagged food as a priority")
            return {"text": text, "confidence": 82, "reasons": reasons[:3]}

        if cluster in ("logistics", "journey_style"):
            mode_rec = recommend_transport_mode(draft)
            if cluster == "logistics":
                stay_text, stay_reasons = _stay_reco_text(draft, purpose, bias)
                return {
                    "text": mode_rec["text"] + " For the stay: " + stay_text[0].lower() + stay_text[1:],
                    "confidence": mode_rec["confidence"],
                    "reasons": (mode_rec["reasons"] + stay_reasons)[:3],
                }
            return {"text": mode_rec["text"], "confidence": mode_rec["confidence"], "reasons": mode_rec["reasons"]}

        if cluster == "fine_tune":
            return {
                "text": "Optional extras — dietary needs, accessibility, anything I should know. Skipping is completely fine.",
                "confidence": 80,
                "reasons": ["Never blocks your plan", "Applied everywhere if set"],
            }
    except Exception as exc:
        print(f"[Intelligence] cluster_recommendation({cluster}) failed (non-fatal): {exc}")

    return {
        "text": "This helps me keep the plan aligned with your style.",
        "confidence": 75,
        "reasons": [],
    }


_INTL_KEYWORDS = [
    "paris", "london", "dubai", "singapore", "bali", "thailand", "maldives",
    "europe", "usa", "america", "tokyo", "japan", "switzerland", "vietnam",
    "new york", "sydney", "australia", "malaysia", "sri lanka", "nepal",
    "indonesia", "cambodia",
]


def is_international(destination_text: Optional[str]) -> bool:
    dest = (destination_text or "").lower()
    return any(kw in dest for kw in _INTL_KEYWORDS)


def visa_note(destination_text: Optional[str]) -> Optional[str]:
    """One honest prep line for international destinations (None for domestic)."""
    dest = (destination_text or "").strip()
    if not is_international(dest):
        return None
    dest_lower = dest.lower()
    if any(k in dest_lower for k in ("bali", "thailand", "vietnam", "indonesia", "cambodia", "sri lanka", "nepal", "malaysia")):
        return f"Visa on Arrival / e-visa is typically available for Indian travelers in {dest} — carry a passport valid 6+ months."
    if any(k in dest_lower for k in ("singapore", "dubai")):
        return f"E-Visa is required before departure for {dest} — processing usually takes ~3-5 working days."
    return f"A regular visa is required before travel to {dest} — apply 4-6 weeks in advance, passport valid 6+ months."


def destination_highlight_payload(draft) -> Dict[str, Any]:
    """
    One-time hero card fired the turn the destination first becomes known —
    a GIVE, never a slot-filling ask (docs/master-planner-conversation-model.md
    living-chat upgrade: "people should get lost in it"). Photos come only
    from the existing enriched Places catalog (AttractionMaster.image_url) —
    no photo pipeline for a brand-new city yet degrades to an empty list, and
    the frontend falls back to a gradient hero rather than a broken image.
    """
    dest = (draft.destination_text or "").strip()
    if not dest:
        return {}

    photos: List[str] = []
    try:
        from apps.reference.models import AttractionMaster
        from apps.reference.services.provenance import exclude_unverified

        rows = (
            exclude_unverified(AttractionMaster.objects.filter(city__name__icontains=dest))
            .exclude(image_url__isnull=True)
            .exclude(image_url="")
            .order_by("-user_rating", "-user_ratings_total")[:3]
        )
        photos = [r.image_url for r in rows if r.image_url]
    except Exception as exc:
        print(f"[Intelligence] destination_highlight photos failed (non-fatal): {exc}")

    weather: Dict[str, Any] = {}
    try:
        from apps.planner.services.weather_service import fetch_live_weather

        w = fetch_live_weather(dest, draft.start_date)
        weather = {
            "temp_c": w.get("avg_temp_c"),
            "condition": w.get("condition"),
            "note": w.get("note"),
            "provenance": w.get("provenance"),
        }
    except Exception as exc:
        print(f"[Intelligence] destination_highlight weather failed (non-fatal): {exc}")

    best_time = None
    try:
        import calendar

        from apps.reference.models import WeatherNormals

        pleasant_months = sorted(
            {
                n.month
                for n in WeatherNormals.objects.filter(city__name__icontains=dest, feels_like_bucket="mild")
            }
        )
        if pleasant_months:
            best_time = ", ".join(calendar.month_name[m] for m in pleasant_months[:3])
    except Exception as exc:
        print(f"[Intelligence] destination_highlight best_time failed (non-fatal): {exc}")

    vibe_tags = infer_interests(dest)
    one_liner = f"{dest} is calling" + (f" — best visited around {best_time}" if best_time else "") + "."

    return {
        "destination": dest,
        "photos": photos,
        "weather": weather,
        "best_time": best_time,
        "vibe_tags": vibe_tags,
        "one_liner": one_liner,
    }


def cluster_defaults(draft, cluster: str, fields: List[str]) -> Dict[str, Any]:
    """
    Smart defaults applied when the user presses Skip (and prefilled so
    Done-without-touching submits them). STYLE fields only — we never invent
    identity facts (who's traveling / from where).
    """
    meta = draft.metadata or {}
    purpose = meta.get("visit_purpose")
    p_defaults = PURPOSE_DEFAULTS.get(purpose or "vacation", PURPOSE_DEFAULTS["vacation"])
    bias = _prefs.preference_bias(draft)
    defaults: Dict[str, Any] = {}

    try:
        if "budget" in fields and not (draft.budget_tier or meta.get("budget_inr")):
            amount, _, _ = recommended_budget_inr(draft, purpose)
            defaults["budget_inr"] = amount
        if "trip_pace" in fields and not meta.get("trip_pace"):
            defaults["trip_pace"] = "relaxed" if purpose == "honeymoon" else "balanced"
        if "interests" in fields and not (draft.interests or meta.get("interests")):
            inferred = infer_interests(draft.destination_text) or p_defaults.get("interests") or []
            if inferred:
                defaults["interests"] = inferred
        if "preferred_mode" in fields and not meta.get("preferred_mode"):
            defaults["preferred_mode"] = recommend_transport_mode(draft)["mode"]
        stay = _stay_defaults(purpose, bias)
        if "star_rating" in fields and not meta.get("star_rating"):
            defaults["star_rating"] = stay["star_rating"]
        if "property_type" in fields and not meta.get("property_type"):
            defaults["property_type"] = stay["property_type"]
        for f in ("flight_class", "train_class", "cabin_class", "car_type", "time_window"):
            if f in fields and not meta.get(f) and p_defaults.get(f):
                defaults[f] = p_defaults[f]
        if "vehicle_type" in fields and not meta.get("vehicle_type") and p_defaults.get("car_type"):
            defaults["vehicle_type"] = p_defaults["car_type"]
        if "intensity_level" in fields and not meta.get("intensity_level"):
            defaults["intensity_level"] = "moderate"
    except Exception as exc:
        print(f"[Intelligence] cluster_defaults({cluster}) failed (non-fatal): {exc}")

    return defaults
