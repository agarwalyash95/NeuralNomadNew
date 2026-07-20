"""
Turn Router (docs/ai-chat-implementation-plan.md §4) — deterministic
BROWSE-mode classifier. Runs after intent detection; decides whether (and
which) capabilities to surface this turn, ADDITIVE to whatever cluster
widget the PLAN-mode ladder already chose (never replaces it — capabilities
never collect a required slot, see docs/conversation-capability-layer.md §1).

Routing is keyword-based and Python-owned: capability selection is never
left to the model (docs/ai-orchestration-architecture.md §10.6 determinism
ledger) — a browse request must reliably fire the same capability every
time, and a bad model guess here can't stack unrelated cards into the chat.
"""

import logging
import re

logger = logging.getLogger(__name__)

from apps.planner.services.capabilities.base import MAX_CAPABILITIES_PER_TURN
from apps.planner.services.capabilities import live as _live
from apps.planner.services.capabilities import monitoring as _monitoring
from apps.planner.services.capabilities import navigation as _navigation
from apps.planner.services.capabilities import search as _search
from apps.planner.services.capabilities import edit_plan as _edit_plan

_MONITOR_PRICE_RE = re.compile(
    r"(?:watch|monitor|track|keep an eye on)\s+(?:the\s+|this\s+|my\s+)?(.+?)(?:'s)?\s*(?:price|cost|rate|fare)\b",
    re.I,
)

_TRIGGERS = [
    (re.compile(r"\bhotels?\b.*\bnear\b|\bnearby hotels?\b|\bstay near\b|\bhotels? in\b", re.I), "search_hotels"),
    (re.compile(r"\brestaurants?\b|\bwhere to eat\b|\bfood near\b|\bdining\b", re.I), "search_restaurants"),
    (re.compile(r"\battractions?\b|\bsights?\b|\bthings to do\b|\bplaces to visit\b", re.I), "search_attractions"),
    (re.compile(r"\bnearby\b|\bnear me\b|\baround here\b|what'?s around", re.I), "nearby_search"),
    (re.compile(r"\bweather\b|\bhow hot\b|\bhow cold\b|\brain(?:y|fall)?\b|\bclimate\b", re.I), "weather"),
    (re.compile(r"flight status|is\s+.*flight.*\s+on time|flight delay", re.I), "flight_status"),
    (re.compile(r"train status|running status|is\s+.*train.*\s+on time", re.I), "train_running_status"),
    (re.compile(r"\bconvert\b.*\b(inr|usd|eur|gbp|aed|sgd|myr|jpy|aud|cad|rupees?|dollars?|euros?|pounds?|yen)\b", re.I), "exchange_calculator"),
    (re.compile(r"exchange rate|\bforex\b", re.I), "forex"),
    (re.compile(r"\bdistance\b|\bhow far\b", re.I), "distance"),
    (re.compile(r"\b(change|remove|add|swap|replace|update|delete|cancel)\b", re.I), "edit_plan"),
    (_MONITOR_PRICE_RE, "monitor_price"),
]

# When a specific-category search fires, the generic nearby_search is
# redundant for the same turn — drop it rather than show two similar cards.
_SPECIFIC_SEARCH_CAPS = {"search_hotels", "search_restaurants", "search_attractions"}

_PRODUCERS = {
    "search_hotels": _search.search_hotels,
    "search_restaurants": _search.search_restaurants,
    "search_attractions": _search.search_attractions,
    "nearby_search": _search.nearby_search,
    "weather": _live.weather,
    "flight_status": _live.flight_status,
    "train_running_status": _live.train_running_status,
    "forex": _live.forex,
    "exchange_calculator": _live.exchange_calculator,
    "distance": _navigation.distance,
    "monitor_price": _monitoring.monitor_price,
    "edit_plan": _edit_plan.edit_plan,
}

_CURRENCY_WORDS = {
    "inr": "INR", "rupee": "INR", "rupees": "INR",
    "usd": "USD", "dollar": "USD", "dollars": "USD",
    "eur": "EUR", "euro": "EUR", "euros": "EUR",
    "gbp": "GBP", "pound": "GBP", "pounds": "GBP",
    "aed": "AED", "sgd": "SGD", "myr": "MYR",
    "jpy": "JPY", "yen": "JPY", "aud": "AUD", "cad": "CAD",
}


def classify_turn(message):
    """Ordered list of capability names this message's text deterministically triggers."""
    msg = message or ""
    hits = []
    for pattern, cap_name in _TRIGGERS:
        if pattern.search(msg) and cap_name not in hits:
            hits.append(cap_name)
    if "nearby_search" in hits and any(c in hits for c in _SPECIFIC_SEARCH_CAPS):
        hits.remove("nearby_search")
    return hits


def _extract_currency_amount(message):
    """Small deterministic parse for 'convert 200 euros to inr' style asks."""
    msg = (message or "").lower()
    amount_match = re.search(r"(\d+(?:\.\d+)?)", msg)
    amount = float(amount_match.group(1)) if amount_match else 1
    found = [code for word, code in _CURRENCY_WORDS.items() if word in msg]
    from_currency = found[0] if found else "INR"
    to_currency = None
    for code in found:
        if code != from_currency:
            to_currency = code
            break
    return from_currency, to_currency, amount


def resolve_capabilities(draft, ai_data, message):
    """
    The Turn Router's BROWSE branch. Deterministic keyword classification →
    invoke up to MAX_CAPABILITIES_PER_TURN producers, additive to whatever
    PLAN-mode cluster widget was already chosen this turn. A capability
    producer failing must never break the turn — caught and skipped.
    """
    triggered = classify_turn(message)
    if not triggered:
        return []

    destination_text = draft.destination_text or ""
    start_date = draft.start_date
    meta = draft.metadata or {}
    origin_text = meta.get("origin", "")

    results = []
    for cap_name in triggered[:MAX_CAPABILITIES_PER_TURN]:
        producer = _PRODUCERS.get(cap_name)
        if producer is None:
            continue
        try:
            if cap_name in ("forex", "exchange_calculator"):
                from_c, to_c, amount = _extract_currency_amount(message)
                payload = producer(from_currency=from_c, to_currency=to_c, amount=amount)
            elif cap_name == "distance":
                payload = producer(origin_name=origin_text, dest_name=destination_text)
            elif cap_name == "monitor_price":
                fragment_match = _MONITOR_PRICE_RE.search(message or "")
                title_fragment = fragment_match.group(1).strip() if fragment_match else ""
                workspace = getattr(draft, "workspace", None)
                payload = producer(workspace, title_fragment)
            elif cap_name == "edit_plan":
                workspace = getattr(draft, "workspace", None)
                payload = producer(workspace, message)
            elif cap_name == "weather":
                payload = producer(destination_text=destination_text, start_date=start_date)
            elif cap_name in ("flight_status", "train_running_status"):
                payload = producer()
            else:
                payload = producer(destination_text=destination_text)
        except Exception as exc:
            logger.warning("[TurnRouter] capability %r failed (non-fatal): %s", cap_name, exc)
            continue
        if payload:
            results.append(payload)

    return results
