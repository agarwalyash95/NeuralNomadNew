"""
Journey Feed — ambient "Did you know…" facts during planning.

Never a question, never gates anything, never displaces a cluster ask or a
proactive offer. Deterministic sources (season/route facts already in our
own DB) come first; a once-per-destination cached LLM call tops up with
general delightful facts once the deterministic well runs dry. At most one
fact per turn, only on a turn where the user just advanced the draft and no
offer already fired (the same "calm" rule offers.py uses), and each fact
shown at most once per trip (metadata["facts_shown"]).
"""

from typing import Any, Dict, List, Optional

_CACHE_TTL_SECONDS = 60 * 60 * 24 * 30  # facts don't go stale — 30 days


def _deterministic_facts(draft) -> List[str]:
    dest = (draft.destination_text or "").strip()
    if not dest:
        return []
    facts: List[str] = []

    try:
        import calendar

        from apps.reference.models import WeatherNormals

        mild_months = sorted(
            {n.month for n in WeatherNormals.objects.filter(city__name__icontains=dest, feels_like_bucket="mild")}
        )
        if mild_months:
            month_names = ", ".join(calendar.month_name[m] for m in mild_months[:3])
            facts.append(f"{month_names} tend to be the most pleasant months to visit {dest}.")
    except Exception as exc:
        print(f"[JourneyFeed] seasonality fact failed (non-fatal): {exc}")

    try:
        from apps.planner.services.intelligence.recommendations import route_price_summary

        route = route_price_summary(draft)
        if route.get("train") and route.get("flight"):
            delta = route["flight"]["price"] - route["train"]["price"]
            if delta > 0:
                facts.append(f"Taking the train instead of flying on this route saves about ₹{delta:,} per person.")
    except Exception as exc:
        print(f"[JourneyFeed] route fact failed (non-fatal): {exc}")

    return facts


def _llm_facts(destination: str) -> List[str]:
    """One cached LLM call per destination — 5 concise, delightful facts."""
    from django.core.cache import cache

    cache_key = f"journey_feed_facts:{destination.strip().lower()}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    facts: List[str] = []
    try:
        from google import genai
        from pydantic import BaseModel, Field

        from apps.common.ai import DEFAULT_GEMINI_MODEL, get_genai_client

        class _JourneyFacts(BaseModel):
            facts: List[str] = Field(
                description="5 concise, delightful, non-obvious traveler facts about the destination, each under 20 words."
            )

        client = get_genai_client()
        response = client.models.generate_content(
            model=DEFAULT_GEMINI_MODEL,
            contents=[{"role": "user", "parts": [{"text": f"Give 5 concise delightful traveler facts about {destination}."}]}],
            config=genai.types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=_JourneyFacts,
                temperature=0.6,
            ),
        )
        facts = list(response.parsed.facts)[:5]
    except Exception as exc:
        print(f"[JourneyFeed] LLM facts failed (non-fatal): {exc}")
        facts = []

    cache.set(cache_key, facts, _CACHE_TTL_SECONDS)
    return facts


def next_fact(draft) -> Optional[Dict[str, Any]]:
    """The next unshown fact for this trip, or None. Marks it shown on the draft
    (caller saves the draft as part of the turn, same convention as offers.py)."""
    dest = (draft.destination_text or "").strip()
    if not dest:
        return None

    meta = draft.metadata or {}
    shown = set(meta.get("facts_shown") or [])

    for fact in _deterministic_facts(draft) + _llm_facts(dest):
        if fact not in shown:
            shown.add(fact)
            if not draft.metadata:
                draft.metadata = {}
            draft.metadata["facts_shown"] = list(shown)[-30:]
            return {"fact": fact, "destination": dest}
    return None
