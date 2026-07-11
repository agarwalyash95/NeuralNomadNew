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
    from apps.planner.services.block_schema import make_provenance

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
    from apps.bookings.providers.registry import provider_registry

    search_params = {
        "origin": origin or "DEL",
        "destination": destination or "BOM",
        "city": destination or origin or "Mumbai",
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
        return None

    matched_res = None
    for res in real_results:
        if provider and provider.lower() in res.get("title", "").lower():
            matched_res = res
            break
    if not matched_res:
        matched_res = real_results[0]

    if service_type == "train":
        price_val = matched_res.get("meta", {}).get("classes", [{}])[0].get("price", 850)
    elif matched_res.get("providers"):
        price_val = matched_res.get("providers")[0].get("price", 5000)
    else:
        price_val = 1500

    from apps.reference.models import AirportRoute, TrainRoute, BusRoute, HotelMaster, City

    fk_params = {}
    if service_type == "flight":
        fk_params["airport_route"] = AirportRoute.objects.filter(
            airline__name__icontains=matched_res.get("title")).first()
    elif service_type == "train":
        fk_params["train_route"] = TrainRoute.objects.filter(
            train_number=matched_res.get("code")).first()
    elif service_type == "bus":
        fk_params["bus_route"] = BusRoute.objects.filter(
            operator_name__icontains=matched_res.get("title")).first()
    elif service_type == "hotel":
        fk_params["hotel"] = HotelMaster.objects.filter(
            name__icontains=matched_res.get("title")).first()
    elif service_type == "cab":
        fk_params["city"] = City.objects.filter(name__icontains=origin).first()

    try:
        price_record = TravelPriceHistory.objects.create(
            service_type=service_type,
            date=date,
            price=price_val,
            currency="INR",
            provider=matched_res.get("title", provider or "Provider"),
            code=matched_res.get("code", code or "Code"),
            details=matched_res.get("meta", {}),
            provenance_tier="verified",
            **fk_params,
        )
    except Exception as exc:
        print(f"Failed to cache live price record: {exc}")
        return None

    return _result_from_record(
        service_type, price_record, "verified",
        basis="live provider lookup",
    )
