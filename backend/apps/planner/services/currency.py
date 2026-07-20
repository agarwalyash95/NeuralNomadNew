"""Trip currency resolution and mixed-currency-safe aggregation."""

from django.conf import settings


def currency_for_city(city, fallback=None):
    return getattr(getattr(city, "country", None), "currency_code", None) or fallback or settings.DEFAULT_CURRENCY_CODE


def trip_currency(draft, city_objs):
    primary = getattr(draft, "destination_city", None)
    if primary:
        return currency_for_city(primary, draft.budget_currency)
    ordered = list(city_objs.values()) if isinstance(city_objs, dict) else list(city_objs or [])
    if ordered:
        return currency_for_city(ordered[0], draft.budget_currency)
    return draft.budget_currency or settings.DEFAULT_CURRENCY_CODE


def sum_matching_currency(days, currency_code):
    total, gaps = 0.0, []
    for day in days:
        for block in day.get("activities", []):
            amount = block.get("estimated_cost")
            if amount in (None, "", 0, 0.0):
                continue
            block_currency = (block.get("cost") or {}).get("currency") or block.get("currency_code")
            if block_currency and block_currency != currency_code:
                gaps.append({
                    "day": day.get("day_number"), "category": "currency",
                    "reason": f"Excluded {block_currency} amount from the {currency_code} total.",
                })
                continue
            total += float(amount)
    return total, gaps
