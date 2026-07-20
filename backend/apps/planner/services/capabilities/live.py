"""
Live Travel Information + Utilities capabilities (docs/conversation-capability-layer.md §4, §10).

Honest-degrade is mandatory: a capability with no wired live source returns
degraded=True with a clear reason rather than fabricating a value
(docs/ai-orchestration-architecture.md §9 "Trustworthy").
"""

from apps.planner.services.capabilities.base import capability_envelope


def weather(destination_text=None, start_date=None, **_):
    from apps.planner.services.weather_service import fetch_live_weather

    res = fetch_live_weather(destination_text, start_date)
    is_degraded = (res.get("provenance") == "unknown")
    
    return capability_envelope(
        "weather",
        {
            "destination": destination_text,
            "avg_temp_c": res.get("avg_temp_c"),
            "precipitation_mm": res.get("precipitation_mm"),
            "feels_like_bucket": res.get("feels_like_bucket"),
            "condition": res.get("condition"),
            "note": res.get("note")
        },
        freshness="live" if res.get("provenance") == "live" else "slow",
        degraded=is_degraded,
        degraded_reason="No climate data or live coordinates available for this destination." if is_degraded else None
    )



def flight_status(flight_number=None, **_):
    # No live flight-status API is wired yet — honest degradation rather
    # than a fabricated on-time/delayed guess.
    return capability_envelope(
        "flight_status", {"flight_number": flight_number}, freshness="live", degraded=True,
        degraded_reason="Live flight status isn't wired yet — check the airline or airport site directly.",
    )


def train_running_status(train_number=None, **_):
    return capability_envelope(
        "train_running_status", {"train_number": train_number}, freshness="live", degraded=True,
        degraded_reason="Live train running status isn't wired yet — check IRCTC/NTES directly.",
    )


def forex(from_currency="INR", to_currency=None, amount=1, **_):
    from apps.forex.models import ForexData

    if not to_currency:
        return capability_envelope(
            "forex", {"from_currency": from_currency}, freshness="slow", degraded=True,
            degraded_reason="Tell me which currency to convert to.",
        )
    try:
        from_rate = 1.0 if from_currency == "INR" else float(ForexData.objects.get(currency=from_currency).exchange_rate)
        to_rate = 1.0 if to_currency == "INR" else float(ForexData.objects.get(currency=to_currency).exchange_rate)
    except ForexData.DoesNotExist:
        return capability_envelope(
            "forex", {"from_currency": from_currency, "to_currency": to_currency}, freshness="slow", degraded=True,
            degraded_reason=f"No rate on file for {to_currency} yet.",
        )

    converted = float(amount) * (from_rate / to_rate)
    return capability_envelope("forex", {
        "from_currency": from_currency,
        "to_currency": to_currency,
        "amount": amount,
        "converted_amount": round(converted, 2),
        "rate": round(from_rate / to_rate, 4),
    }, freshness="slow")


def exchange_calculator(from_currency="INR", to_currency=None, amount=1, **_):
    # Same source/logic as forex — a distinct capability id (per docs/
    # conversation-capability-layer.md) so the frontend can render a
    # converter widget rather than a status card.
    result = forex(from_currency=from_currency, to_currency=to_currency, amount=amount)
    result["cap"] = "exchange_calculator"
    return result
