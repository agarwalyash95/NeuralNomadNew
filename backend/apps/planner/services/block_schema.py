"""
Canonical block schema (v2) for plan JSON stored on PlannerTrip.days / .cities.

Every itinerary activity ("block") carries:
  - block_status: idea | planned | priced | booked   (money/commitment ladder)
  - cost: {
      amount, currency,
      provenance: {tier, source, basis, verified_at}
    }

Provenance tiers (the product-wide trust grammar):
  - "verified"   — from a live provider lookup or a completed booking, timestamped
  - "estimated"  — computed from historical/statistical data, basis stated
  - "suggested"  — AI-generated and not yet checked against anything

Legacy fields (estimated_cost, currency_code, status) are preserved so old
readers keep working. Upcasting is idempotent: applying it to v2 data is a
no-op. This module is the ONLY place that defines the mapping.
"""

from apps.common.provenance import (
    TIER_ESTIMATED,
    TIER_SUGGESTED,
    TIER_VERIFIED,
    make_provenance,
)

SCHEMA_VERSION = 2

# Legacy activity statuses → v2 block statuses
_LEGACY_STATUS_MAP = {
    "booked": "booked",
    "pending": "planned",
    "inactive": "planned",  # inactive is an is_active flag, not a lifecycle stage
}


def upcast_activity(act, default_currency="INR"):
    """Idempotently lift a legacy activity dict to block schema v2 (in place)."""
    if not isinstance(act, dict):
        return act

    legacy_status = act.get("status", "pending")
    if "block_status" not in act:
        act["block_status"] = _LEGACY_STATUS_MAP.get(legacy_status, "planned")

    if "cost" not in act or not isinstance(act.get("cost"), dict):
        amount = act.get("estimated_cost")
        try:
            amount = float(amount) if amount is not None else None
        except (TypeError, ValueError):
            amount = None

        if act["block_status"] == "booked":
            provenance = make_provenance(TIER_VERIFIED, source="booking")
        else:
            # AI-generated plans produce suggestions; nothing has checked them yet
            provenance = make_provenance(TIER_SUGGESTED, source="ai_planner")

        act["cost"] = {
            "amount": amount,
            "currency": act.get("currency_code") or default_currency,
            "provenance": provenance,
        }
    else:
        cost = act["cost"]
        cost.setdefault("currency", act.get("currency_code") or default_currency)
        if not isinstance(cost.get("provenance"), dict):
            cost["provenance"] = make_provenance(TIER_SUGGESTED, source="ai_planner")

    return act


def upcast_trip_payload(payload, default_currency="INR"):
    """
    Idempotently lift a serialized trip payload (dict with 'days'/'cities')
    to schema v2. Mutates and returns the payload.
    """
    if not isinstance(payload, dict):
        return payload

    currency = payload.get("currency_code") or default_currency

    for day in payload.get("days") or []:
        for act in day.get("activities") or []:
            upcast_activity(act, currency)

    for city in payload.get("cities") or []:
        transit = city.get("transitToNext")
        if isinstance(transit, dict):
            upcast_activity(transit, currency)

    payload["schema_version"] = SCHEMA_VERSION
    return payload


def find_block(trip, block_id):
    """
    Locate an activity dict by id inside trip.days (or a transitToNext inside
    trip.cities). Returns (block, day_dict_or_None) or (None, None).
    """
    for day in trip.days or []:
        for act in day.get("activities") or []:
            if str(act.get("id")) == str(block_id):
                return act, day
    for city in trip.cities or []:
        transit = city.get("transitToNext")
        if isinstance(transit, dict) and str(transit.get("id")) == str(block_id):
            return transit, None
    return None, None


def apply_price_result(block, price_result, default_currency="INR"):
    """
    Write a live-price lookup result onto a block: cost amount + provenance,
    and promote block_status planned → priced. The provenance tier comes from
    the lookup itself (live provider = verified, historical = estimated).
    """
    upcast_activity(block, default_currency)

    block["cost"]["amount"] = price_result["exact_price"]
    block["cost"]["provenance"] = price_result["provenance"]
    block["estimated_cost"] = price_result["exact_price"]  # keep legacy readers truthful

    if block.get("block_status") in (None, "idea", "planned"):
        block["block_status"] = "priced"

    if price_result.get("details"):
        block.setdefault("metadata", {})
        if isinstance(block["metadata"], dict):
            block["metadata"]["price_details"] = price_result["details"]

    return block
