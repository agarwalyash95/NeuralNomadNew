"""
Shared live-price lookup used by the reference LivePriceView and the planner
block-verify endpoint.

Provenance semantics (the product trust grammar):
  - A fresh provider-registry fetch is "verified" (a live source answered now).
  - A TravelPriceHistory hit is "estimated" (historical data, basis stated).
  - If neither matches the requested route/date we return None. We never
    return an unrelated record as if it were this item's price.
"""

from datetime import datetime, timedelta

from django.conf import settings
from django.db.models import Avg, Count, Q
from django.utils import timezone

from apps.reference.models import TravelPriceHistory


def _parse_date(date_str):
    try:
        return datetime.strptime(date_str, "%Y-%m-%d").date()
    except (TypeError, ValueError):
        try:
            return datetime.fromisoformat(date_str.split("T")[0]).date()
        except (TypeError, ValueError, AttributeError):
            return datetime.today().date()


def _format_price(service_type, price):
    formatted = f"Rs {int(price):,}"
    if service_type == "hotel":
        formatted += "/night"
    elif service_type == "cab":
        formatted += "/km"
    return formatted


def _result_from_record(service_type, record, tier, basis):
    from apps.common.provenance import make_provenance

    return {
        "status": "success",
        "price": _format_price(service_type, record.price),
        "exact_price": float(record.price),
        "provider": record.provider,
        "code": record.code,
        "details": record.details,
        "provenance": make_provenance(tier, source=record.provider or "provider", basis=basis),
        "price_trend": _compute_price_trend(service_type, record.code, record.price),
    }


def _compute_price_trend(service_type, code, current_price):
    """
    A pure statistic — 30-day moving average vs. the current price — never
    LLM-authored. Powers copy like "12% below the 30-day average" (roadmap
    §1.4); returns None rather than a trend computed from too little history.
    """
    if not code or current_price is None:
        return None
    cutoff = timezone.now().date() - timedelta(days=30)
    qs = TravelPriceHistory.objects.filter(service_type=service_type, code=code, date__gte=cutoff)
    stats = qs.aggregate(avg_price=Avg("price"), n=Count("id"))
    avg_price, n = stats["avg_price"], stats["n"]
    if avg_price is None or n < 3 or float(avg_price) == 0:
        return None
    delta_pct = round((float(current_price) - float(avg_price)) / float(avg_price) * 100, 1)
    direction = "down" if delta_pct < -1 else ("up" if delta_pct > 1 else "flat")
    return {
        "direction": direction,
        "magnitude_pct": abs(delta_pct),
        "basis": f"{n}-point 30-day average",
    }


def _record_tier(record):
    """
    A record's tier is whatever was stored on it at write time — never
    re-derived from "did *this* request just call a live provider." Previously
    every row read back from the DB was unconditionally tagged "estimated"
    even if it originated from a live provider lookup moments earlier, which
    meant "verified" only ever appeared on the exact request that wrote the
    row (see docs/travel-knowledge-engine-plan.md §1). Falls back to
    "estimated" only for rows written before this field existed.
    """
    return record.provenance_tier or "estimated"


def _numeric_price(value):
    if value in (None, "") or isinstance(value, bool):
        return None
    try:
        price = float(value)
    except (TypeError, ValueError):
        return None
    return price if price >= 0 else None


def _extract_provider_price(service_type, result):
    """Return only a price actually present in the provider payload."""
    if service_type == "train":
        for item in result.get("meta", {}).get("classes") or []:
            price = _numeric_price(item.get("price"))
            if price is not None:
                return price

    for provider_result in result.get("providers") or []:
        price = _numeric_price(provider_result.get("price"))
        if price is not None:
            return price

    return _numeric_price(result.get("price"))


def _resolve_city(name):
    """Exact match first, icontains fallback — a plain icontains alone can
    resolve a short city name to an unrelated city that merely contains it
    as a substring (e.g. "Agra" is a literal substring of "Lagrange")."""
    from apps.reference.models import City

    if not name:
        return None
    clean = name.strip()
    return (
        City.objects.filter(name__iexact=clean).first()
        or City.objects.filter(name__icontains=clean).order_by("name").first()
    )


def _resolve_observation_fk(service_type, item, origin=""):
    """Same best-effort fuzzy title/code match lookup_live_price already does
    for TravelPriceHistory rows — reused here so an observation and its
    matching history row (when one gets written) resolve to the same FK."""
    from apps.reference.models import AirportRoute, TrainRoute, BusRoute, HotelMaster

    fk_params = {}
    if service_type == "flight":
        fk_params["airport_route"] = AirportRoute.objects.filter(
            airline__name__icontains=item.get("title") or "").first()
    elif service_type == "train":
        fk_params["train_route"] = TrainRoute.objects.filter(
            train_number=item.get("code")).first()
    elif service_type == "bus":
        fk_params["bus_route"] = BusRoute.objects.filter(
            operator_name__icontains=item.get("title") or "").first()
    elif service_type == "hotel":
        fk_params["hotel"] = HotelMaster.objects.filter(
            name__icontains=item.get("title") or "").first()
    elif service_type == "cab":
        fk_params["city"] = _resolve_city(origin) if origin else None
    return fk_params


def record_price_observation(service_type, item, params=None):
    """Phase 5 observation writer: one TravelPriceObservation per priced
    provider result, live or mock (mock rows are useful for machinery
    validation, tagged honestly as ``provider_cache`` rather than
    ``live_api`` — never confused with a real quote by TravelPriceSummary's
    rollup, which is free to filter source_type when it wants live-only
    signal). Never raises — a provider search must not fail because
    observation-writing had a problem.
    """
    try:
        from apps.reference.models import TravelPriceObservation

        price_val = _extract_provider_price(service_type, item)
        if price_val is None:
            return None

        params = params or {}
        origin = params.get("origin", "")
        source_type = "live_api" if item.get("source") == "live_inventory" else "provider_cache"
        fk_params = _resolve_observation_fk(service_type, item, origin=origin)

        return TravelPriceObservation.objects.create(
            service_type=service_type,
            observed_date=timezone.now().date(),
            price=price_val,
            currency="INR",
            provider=item.get("title", "") or "",
            code=item.get("code", "") or "",
            source_type=source_type,
            details=item.get("meta", {}) or {},
            **fk_params,
        )
    except Exception as exc:  # observation-writing degrades, never crashes a search
        print(f"Failed to record price observation: {exc}")
        return None


def _estimator_fallback_result(service_type, destination):
    """Phase 5 ladder rung (§10.1 classes 2-4), tried after TravelPriceHistory
    and a live-provider fetch both come up empty, before finally giving up.

    Wired for ``hotel`` only: it's the one category this function's own
    signature can serve without a distance figure (cab/bus/train need
    caller-supplied distance_km, which lookup_live_price never receives —
    those are switched onto price_estimator at their own call sites instead,
    e.g. transport_compare.py, which already computes distance before calling
    this function). Returns None (never a fabricated price) when the
    estimator itself has insufficient_data.
    """
    if service_type != "hotel" or not destination:
        return None
    from apps.reference.services import price_estimator

    envelope = price_estimator.estimate("hotel", destination_text=destination)
    if envelope.get("expected") is None:
        return None
    return {
        "status": "success",
        "price": _format_price(service_type, envelope["expected"]),
        "exact_price": envelope["expected"],
        "provider": envelope["provenance"]["source"],
        "code": "",
        "details": {"assumptions": envelope["assumptions"], "method": envelope["method"]},
        "provenance": envelope["provenance"],
        "price_trend": None,
    }


def lookup_live_price(service_type, date_str, provider="", code="", origin="", destination=""):
    """
    Returns a price result dict with provenance, or None when no relevant
    price exists for this route/date.
    """
    if not service_type or not date_str:
        return None

    date = _parse_date(date_str)

    query = Q(service_type=service_type, date=date)
    if provider:
        query &= Q(provider__icontains=provider)
    if code:
        query &= Q(code__icontains=code)

    if service_type in ["flight", "train", "bus"]:
        if origin:
            query &= (Q(airport_route__source__city__name__icontains=origin) |
                      Q(train_route__source__city__name__icontains=origin) |
                      Q(bus_route__source__city__name__icontains=origin) |
                      Q(airport_route__source__iata_code__icontains=origin) |
                      Q(train_route__source__code__icontains=origin))
        if destination:
            query &= (Q(airport_route__destination__city__name__icontains=destination) |
                      Q(train_route__destination__city__name__icontains=destination) |
                      Q(bus_route__destination__city__name__icontains=destination) |
                      Q(airport_route__destination__iata_code__icontains=destination) |
                      Q(train_route__destination__code__icontains=destination))
    elif service_type == "hotel":
        if destination:
            query &= Q(hotel__city__name__icontains=destination)
    elif service_type == "cab":
        if origin:
            query &= Q(city__name__icontains=origin)

    price_record = TravelPriceHistory.objects.filter(query).first()
    if price_record:
        tier = _record_tier(price_record)
        basis = (
            f"historical price for {date.isoformat()}"
            if tier == "estimated"
            else "live provider lookup, cached"
        )
        return _result_from_record(service_type, price_record, tier, basis=basis)

    # Live fetch from real providers — this is the "verified" path
    if not getattr(settings, "LIVE_PROVIDERS_ENABLED", False):
        return _estimator_fallback_result(service_type, destination)

    from apps.bookings.providers.registry import provider_registry

    search_params = {
        "origin": origin,
        "destination": destination,
        "city": destination or origin,
        "departureDate": date_str,
        "cabinClass": "Economy",
        "travellers": "1",
    }
    try:
        real_results = provider_registry.search(service_type, search_params)
    except Exception as exc:  # provider outage must degrade, not crash
        print(f"Live price provider lookup failed: {exc}")
        real_results = None

    if not real_results:
        return _estimator_fallback_result(service_type, destination)

    matched_res = None
    for res in real_results:
        if provider and provider.lower() in res.get("title", "").lower():
            matched_res = res
            break
    if not matched_res:
        matched_res = real_results[0]

    price_val = _extract_provider_price(service_type, matched_res)
    if price_val is None:
        return _estimator_fallback_result(service_type, destination)

    source = matched_res.get("source") or matched_res.get("provenance", {}).get("source")
    is_live_price = bool(
        getattr(settings, "LIVE_PROVIDERS_ENABLED", False)
        and (
            source == "live_inventory"
            or matched_res.get("provenance", {}).get("is_live") is True
        )
    )
    tier = "verified" if is_live_price else "estimated"
    classification = "cached_live_response" if is_live_price else "mock_data"

    fk_params = _resolve_observation_fk(service_type, matched_res, origin=origin)

    try:
        price_record = TravelPriceHistory.objects.create(
            service_type=service_type,
            date=date,
            price=price_val,
            currency="INR",
            provider=matched_res.get("title", provider or "Provider"),
            code=matched_res.get("code", code or "Code"),
            details=matched_res.get("meta", {}),
            provenance_tier=tier,
            classification=classification,
            **fk_params,
        )
    except Exception as exc:
        print(f"Failed to cache live price record: {exc}")
        return None

    # Phase 5: the observation this history row's price is based on — a
    # separate write (TravelPriceObservation feeds the rollup/benchmark
    # ladder; TravelPriceHistory is the display-facing cache) rather than
    # reusing one row for both purposes.
    record_price_observation(service_type, matched_res, params={"origin": origin})

    return _result_from_record(
        service_type,
        price_record,
        tier,
        basis="live provider lookup" if is_live_price else "mock inventory estimate",
    )
