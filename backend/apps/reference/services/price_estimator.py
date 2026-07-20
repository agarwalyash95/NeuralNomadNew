"""
Phase 5 (docs/plans/reference-foundation-and-planner-intelligence-master-plan.md
§10.1): one honest price-estimation ladder, replacing the hardcoded price
literals that used to be scattered across planner service modules
(``transport_compare._CAB_BASE_FARE``, ``suggestions._RESTAURANT_PRICE_BAND``,
``recommendations.DEST_TIER_RATES``).

``estimate(service_type, **params)`` returns one uniform envelope:
``{min, expected, max, currency, unit, confidence, method, freshness,
taxes_included, assumptions[], live_available, provenance}``. ``provenance``
is the app's existing 3-tier display vocabulary (``apps.common.provenance``)
so callers can use it exactly like a ``live_price`` result; ``confidence``/
``method`` carry the richer 6-class ladder detail for anyone who needs it.

Ladder actually implemented this phase (§10.1 classes, reference app only —
no ML, no live-provider call here, that's ``live_price.py``'s job):
  3. Historical benchmark  — ``TravelPriceSummary`` quantiles, when sampled.
  1/2. Rule                — ``FareRule`` lookup (cab/bus/train) or a DB-median
       /price_range-band fallback (hotel) or a price_level band (restaurant).
  "insufficient_data"      — honest empty envelope. Never a fabricated number.

A category with no seeded ``FareRule`` row and no observations (train, at the
end of this phase — see the phase report for why) simply returns
``insufficient_data`` rather than guessing. That is by design, not a bug.
"""

from __future__ import annotations

from datetime import date
from typing import Any, Dict, List, Optional

from apps.common.provenance import TIER_ESTIMATED, TIER_SUGGESTED, make_provenance

# Google Places price_level (0-4) -> "for two" INR band. Ported verbatim from
# apps.reference.services.suggestions._RESTAURANT_PRICE_BAND — same numbers,
# one home. Unit is deliberately "per_two" (matching the data's real shape),
# not the master plan's per-person ideal — retrofitting the unit semantics of
# an already-consumed field is a separate, riskier change than this phase's
# "same numbers, one source" scope covers.
_RESTAURANT_PRICE_BAND = {0: 200, 1: 200, 2: 500, 3: 1000, 4: 2000}
_RESTAURANT_PRICE_LABEL = {
    0: "₹200 for two", 1: "₹200 for two", 2: "₹500 for two",
    3: "₹1000 for two", 4: "₹2000 for two",
}
_RESTAURANT_DEFAULT = 400

# Ported verbatim from apps.reference.services.HotelMaster.price_range bands —
# only used when no TravelPriceHistory rows exist for the destination at all.
_HOTEL_RANGE_BAND = {"$": 1500, "$$": 3000, "$$$": 6000, "$$$$": 12000}
_HOTEL_RANGE_DEFAULT = 3000

# Ported verbatim from apps.planner.services.intelligence.recommendations
# .DEST_TIER_RATES — same keyword/rate pairs, one source instead of two
# (conversation_engine.py had an undefined-name duplicate, now removed).
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

# Same ₹1500/person/day rule-of-thumb recommendations.py used inline — moved
# here so it carries an honest confidence/assumption instead of looking like
# a fact. Not derived from real dining observations (none exist yet).
_FOOD_PER_DAY_INR = 1500


def _envelope(
    *, min_v, expected, max_v, unit, confidence, method,
    tier, source, basis, currency="INR", freshness=None,
    taxes_included=None, assumptions=None, live_available=False,
):
    return {
        "min": min_v,
        "expected": expected,
        "max": max_v,
        "currency": currency,
        "unit": unit,
        "confidence": confidence,
        "method": method,
        "freshness": freshness,
        "taxes_included": taxes_included,
        "assumptions": assumptions or [],
        "live_available": live_available,
        "provenance": make_provenance(tier, source=source, basis=basis),
    }


def _insufficient_data(unit=None, note="No fare rule or historical observation available for this category yet."):
    return _envelope(
        min_v=None, expected=None, max_v=None, unit=unit,
        confidence=0.0, method="insufficient_data", tier=TIER_SUGGESTED,
        source="none", basis=note, assumptions=[note],
    )


def _best_fare_rule(category, *, city=None, service_class=None):
    """Simple, explicit best-match: prefer an exact service_class + city match,
    then city-only, then service_class-only, then the national default."""
    from django.db.models import Q
    from apps.reference.models import FareRule

    today = date.today()
    base = FareRule.objects.filter(
        category=category, is_active=True, valid_from__lte=today,
    ).filter(Q(valid_to__isnull=True) | Q(valid_to__gte=today))

    candidates = []
    if city is not None and service_class:
        candidates.append(base.filter(city=city, service_class=service_class))
    if city is not None:
        candidates.append(base.filter(city=city, service_class=""))
    if service_class:
        candidates.append(base.filter(city__isnull=True, service_class=service_class))
    candidates.append(base.filter(city__isnull=True, service_class=""))

    for qs in candidates:
        row = qs.order_by("-valid_from").first()
        if row is not None:
            return row
    return None


def _summary_lookup(service_type, *, origin_city=None, destination_city=None):
    """Class 3 — a TravelPriceSummary row, when the rollup has produced one.
    Near-always None until real observation volume accumulates; that is the
    documented, expected state at the end of this phase."""
    from apps.reference.models import TravelPriceSummary

    qs = TravelPriceSummary.objects.filter(service_type=service_type)
    if destination_city is not None:
        qs = qs.filter(destination_city=destination_city)
    if origin_city is not None:
        qs = qs.filter(origin_city=origin_city)
    return qs.filter(sample_count__gt=0).order_by("-calculation_date").first()


def _rate_card_envelope(rule, distance_km, *, unit_label):
    params = rule.params or {}
    base_fare = float(params.get("base_fare", 0) or 0)
    per_km = float(params.get("per_km", 0) or 0)
    expected = round(base_fare + distance_km * per_km)
    tier = TIER_ESTIMATED
    basis = f"Rs {per_km:g}/km x {distance_km:g} km" + (f" + Rs {base_fare:g} base" if base_fare else "")
    return _envelope(
        min_v=round(expected * 0.9), expected=expected, max_v=round(expected * 1.15),
        unit=unit_label, confidence=rule.confidence, method=f"rule:fare_rule:{rule.id}",
        tier=tier, source=rule.name, basis=basis,
        freshness=rule.freshness_at.isoformat() if rule.freshness_at else None,
        assumptions=[f"{rule.get_provenance_tier_display()} fare rule, valid from {rule.valid_from.isoformat()}"],
    )


def estimate_cab(distance_km: float, *, city=None, service_class: str = "") -> Dict[str, Any]:
    if distance_km is None:
        return _insufficient_data(unit="trip")
    # Cab observations resolve their city FK to the *origin* (the pickup
    # city, per _resolve_observation_fk's cab branch) — TravelPriceSummary
    # rows for cab therefore carry origin_city, not destination_city.
    summary = _summary_lookup("cab", origin_city=city)
    if summary and summary.median_price is not None:
        return _envelope(
            min_v=float(summary.p25_price or summary.median_price), expected=float(summary.median_price),
            max_v=float(summary.p75_price or summary.median_price), unit="trip",
            confidence=summary.confidence, method="benchmark",
            tier=TIER_ESTIMATED, source="TravelPriceSummary", basis=f"{summary.sample_count} observations",
        )
    rule = _best_fare_rule("cab", city=city, service_class=service_class)
    if rule:
        return _rate_card_envelope(rule, distance_km, unit_label="trip")
    return _insufficient_data(unit="trip")


def estimate_bus(distance_km: float, *, city=None, service_class: str = "non_ac") -> Dict[str, Any]:
    if distance_km is None:
        return _insufficient_data(unit="per_person")
    summary = _summary_lookup("bus", destination_city=city)
    if summary and summary.median_price is not None:
        return _envelope(
            min_v=float(summary.p25_price or summary.median_price), expected=float(summary.median_price),
            max_v=float(summary.p75_price or summary.median_price), unit="per_person",
            confidence=summary.confidence, method="benchmark",
            tier=TIER_ESTIMATED, source="TravelPriceSummary", basis=f"{summary.sample_count} observations",
        )
    rule = _best_fare_rule("bus", city=city, service_class=service_class)
    if rule:
        return _rate_card_envelope(rule, distance_km, unit_label="per_person")
    return _insufficient_data(unit="per_person")


def estimate_train(distance_km: float, *, service_class: str = "") -> Dict[str, Any]:
    if distance_km is None:
        return _insufficient_data(unit="per_person")
    summary = _summary_lookup("train")
    if summary and summary.median_price is not None:
        return _envelope(
            min_v=float(summary.p25_price or summary.median_price), expected=float(summary.median_price),
            max_v=float(summary.p75_price or summary.median_price), unit="per_person",
            confidence=summary.confidence, method="benchmark",
            tier=TIER_ESTIMATED, source="TravelPriceSummary", basis=f"{summary.sample_count} observations",
        )
    rule = _best_fare_rule("train", service_class=service_class)
    if rule:
        return _rate_card_envelope(rule, distance_km, unit_label="per_person")
    # No confidently-sourced IRCTC distance-slab table was encoded this phase
    # (see phase-05 report) — honestly insufficient, not guessed.
    return _insufficient_data(unit="per_person")


def _median_hotel_price(destination_text: str) -> Optional[int]:
    """Same DB-first pattern recommendations.median_hotel_price_per_night uses,
    reimplemented here (reference must not import planner, D-004)."""
    if not destination_text:
        return None
    from apps.reference.models import TravelPriceHistory

    rows = TravelPriceHistory.objects.filter(
        service_type="hotel", hotel__city__name__icontains=destination_text.strip()
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


def estimate_hotel(destination_text: str, *, price_range: Optional[str] = None) -> Dict[str, Any]:
    median = _median_hotel_price(destination_text)
    if median is not None:
        return _envelope(
            min_v=round(median * 0.85), expected=median, max_v=round(median * 1.25),
            unit="per_night", confidence=0.6, method="benchmark:travel_price_history",
            tier=TIER_ESTIMATED, source="TravelPriceHistory",
            basis=f"median nightly price observed for {destination_text}",
        )
    band = _HOTEL_RANGE_BAND.get(price_range, _HOTEL_RANGE_DEFAULT)
    return _envelope(
        min_v=round(band * 0.7), expected=band, max_v=round(band * 1.4),
        unit="per_night", confidence=0.3, method="rule:price_range_band",
        tier=TIER_SUGGESTED, source="price_range band",
        basis=f"Google price_range '{price_range}' band" if price_range else "no price_range data, default band",
        assumptions=["No observed nightly prices for this destination yet — a coarse price-tier band, not a quote."],
    )


def estimate_restaurant(price_level: Optional[int]) -> Dict[str, Any]:
    amount = _RESTAURANT_PRICE_BAND.get(price_level, _RESTAURANT_DEFAULT)
    label = _RESTAURANT_PRICE_LABEL.get(price_level, f"₹{_RESTAURANT_DEFAULT} for two")
    return _envelope(
        min_v=round(amount * 0.75), expected=amount, max_v=round(amount * 1.5),
        unit="per_two", confidence=0.3, method="rule:price_level_band",
        tier=TIER_SUGGESTED, source="Google price_level band", basis=label,
        assumptions=["Approx. price band from Google Places, not an exact bill."],
    )


def estimate_food_daily(travelers: int, days: int, *, purpose: Optional[str] = None) -> Dict[str, Any]:
    mult = PURPOSE_BUDGET_MULTIPLIERS.get(purpose or "vacation", 1.0)
    travelers = max(int(travelers or 1), 1)
    days = max(int(days or 1), 1)
    expected = int(_FOOD_PER_DAY_INR * days * travelers * max(mult, 0.6))
    return _envelope(
        min_v=round(expected * 0.7), expected=expected, max_v=round(expected * 1.4),
        unit="trip", confidence=0.3, method="rule:food_per_day",
        tier=TIER_SUGGESTED, source="rule of thumb",
        basis=f"Rs {_FOOD_PER_DAY_INR}/person/day x {days} day(s) x {travelers} traveler(s)",
        assumptions=["Rule-of-thumb food estimate, not derived from real dining observations yet."],
    )


def estimate_trip_day_budget(destination_text: str, *, purpose: Optional[str] = None) -> Dict[str, Any]:
    dest_lower = (destination_text or "").lower()
    base_per_day = 3000
    for tier_data in DEST_TIER_RATES.values():
        if any(kw in dest_lower for kw in tier_data["keywords"]):
            base_per_day = tier_data["base_per_day"]
            break
    mult = PURPOSE_BUDGET_MULTIPLIERS.get(purpose or "vacation", 1.0)
    expected = int(base_per_day * mult)
    return _envelope(
        min_v=round(expected * 0.7), expected=expected, max_v=round(expected * 1.5),
        unit="per_traveler_per_day", confidence=0.3, method="rule:destination_tier",
        tier=TIER_SUGGESTED, source="destination-tier heuristic",
        basis=f"typical {'international' if base_per_day >= 6000 else 'domestic'} per-day cost for this destination",
        assumptions=["No hotel/fare observations for this destination — a coarse per-day heuristic."],
    )


_DISPATCH = {
    "cab": estimate_cab,
    "bus": estimate_bus,
    "train": estimate_train,
    "hotel": estimate_hotel,
    "restaurant": estimate_restaurant,
    "food_daily": estimate_food_daily,
    "trip_day_budget": estimate_trip_day_budget,
}


def estimate(service_type: str, **params) -> Dict[str, Any]:
    """Single dispatch entry point. Unknown service_type -> insufficient_data
    rather than a KeyError, since callers may pass through a category this
    ladder doesn't cover yet (e.g. flight, until real observations exist)."""
    fn = _DISPATCH.get(service_type)
    if fn is None:
        return _insufficient_data()
    return fn(**params)
