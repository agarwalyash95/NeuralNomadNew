"""
Transport mode comparison for a single inter-city leg
(docs/planner-product-audit-2026-07.md BK3) — composes services that already
exist rather than building a new pricing/routing stack: DistanceService for
duration (reference routes for flight/train/bus, road distance for cab), and
live_price.lookup_live_price for cost. No LLM call — the WHY line is a
templated comparison of real duration/price numbers, not synthesized prose.

A mode is included only when real duration data exists for it; a mode with
no matching reference route is omitted, never estimated from nothing.
"""

from apps.planner.services.distance_service import DistanceService
from apps.reference.services.live_price import lookup_live_price
from apps.reference.services import price_estimator

_SCHEDULED_MODES = ("flight", "train", "bus")


def _resolve_city(name):
    from apps.reference.models import City

    if not name:
        return None
    clean = name.strip()
    return (
        City.objects.filter(name__iexact=clean).select_related("country").first()
        or City.objects.filter(name__icontains=clean).select_related("country").order_by("name").first()
    )


def _format_duration(mins):
    if mins is None:
        return None
    hours, minutes = divmod(int(mins), 60)
    if hours and minutes:
        return f"{hours}h {minutes}m"
    if hours:
        return f"{hours}h"
    return f"{minutes}m"


def compare_legs(origin_name, destination_name, date_str, travelers=1):
    """
    Returns {"origin", "destination", "rows": [...], "recommendation": {...}|None}.
    Each row: {mode, duration_mins, duration_label, price, price_label,
    provenance, distance_km}. Rows are omitted entirely when no real
    duration is known for that mode — never a fabricated "estimated" travel time.
    """
    origin_city = _resolve_city(origin_name)
    dest_city = _resolve_city(destination_name)

    pair = {
        "id": "leg",
        "origin": {
            "name": origin_name,
            "lat": float(origin_city.latitude) if origin_city and origin_city.latitude is not None else None,
            "lng": float(origin_city.longitude) if origin_city and origin_city.longitude is not None else None,
        },
        "destination": {
            "name": destination_name,
            "lat": float(dest_city.latitude) if dest_city and dest_city.latitude is not None else None,
            "lng": float(dest_city.longitude) if dest_city and dest_city.longitude is not None else None,
        },
    }

    modes_to_fetch = list(_SCHEDULED_MODES)
    has_coords = pair["origin"]["lat"] is not None and pair["destination"]["lat"] is not None
    if has_coords:
        modes_to_fetch.append("driving")

    edges = DistanceService.fetch_multi_mode_edges([pair], modes_to_fetch)
    leg_edges = edges.get("leg", {})

    rows = []
    for mode in _SCHEDULED_MODES:
        edge = leg_edges.get(mode)
        if not edge or edge.get("duration_mins") is None:
            continue
        price_result = None
        try:
            price_result = lookup_live_price(mode, date_str, origin=origin_name, destination=destination_name)
        except Exception:
            price_result = None
        row = {
            "mode": mode,
            "duration_mins": edge["duration_mins"],
            "duration_label": _format_duration(edge["duration_mins"]),
            "distance_km": edge.get("distance_km"),
            "price": price_result["exact_price"] * travelers if price_result else None,
            "price_label": price_result["price"] if price_result else None,
            "provenance": price_result["provenance"] if price_result else None,
        }
        rows.append(row)

    driving_edge = leg_edges.get("driving")
    if driving_edge and driving_edge.get("distance_km"):
        distance_km = driving_edge["distance_km"]
        cab_envelope = price_estimator.estimate("cab", distance_km=distance_km, city=origin_city)
        fare = cab_envelope["expected"]
        rows.append({
            "mode": "cab",
            "duration_mins": driving_edge.get("duration_mins"),
            "duration_label": _format_duration(driving_edge.get("duration_mins")),
            "distance_km": distance_km,
            "price": fare,
            "price_label": f"Rs {fare:,.0f}" if fare is not None else None,
            "provenance": cab_envelope["provenance"],
        })
    # No driving edge (city unresolved or no coords) — the cab row is
    # honestly omitted rather than guessed.

    recommendation = _build_recommendation(rows)

    return {
        "origin": origin_name,
        "destination": destination_name,
        "rows": rows,
        "recommendation": recommendation,
    }


def _build_recommendation(rows):
    priced = [r for r in rows if r.get("price") is not None]
    timed = [r for r in rows if r.get("duration_mins") is not None]
    if not timed:
        return None

    fastest = min(timed, key=lambda r: r["duration_mins"])
    cheapest = min(priced, key=lambda r: r["price"]) if priced else None

    if cheapest is None or cheapest["mode"] == fastest["mode"]:
        return {
            "mode": fastest["mode"],
            "reason": f"{fastest['mode'].title()} wins outright — fastest at {fastest['duration_label']}"
            + (f" and cheapest at {fastest['price_label']}" if cheapest else ", no fare data for the others yet"),
        }

    delta_mins = cheapest["duration_mins"] - fastest["duration_mins"] if cheapest.get("duration_mins") is not None else None
    delta_price = fastest["price"] - cheapest["price"] if fastest.get("price") is not None else None

    reason = f"{fastest['mode'].title()} is fastest ({fastest['duration_label']})"
    if delta_price is not None and delta_price > 0:
        reason += f", but {cheapest['mode']} saves Rs {round(delta_price):,}"
        if delta_mins is not None and delta_mins > 0:
            reason += f" for {_format_duration(delta_mins)} more travel time"
    reason += "."

    return {"mode": fastest["mode"], "alternative_mode": cheapest["mode"], "reason": reason}
