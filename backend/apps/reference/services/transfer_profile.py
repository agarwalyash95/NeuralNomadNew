"""
TransferProfile seeding — general orientation notes for an airport/station
hub (typical minimum connection time, whether terminal changes are common).
Deliberately a rough prior, not schedule-accurate data (see
docs/travel-intelligence-implementation-roadmap.md §1.4) — upgraded to a
"provider" source automatically if a real provider ever supplies connection
data (not implemented yet; no provider exposes this today).

Same genai.Client() / response_schema pattern as
apps.planner.services.plan_generation, so this reads GEMINI_API_KEY the
same way the rest of the app already does.
"""

import logging

logger = logging.getLogger(__name__)


def get_or_seed_transfer_profile(location_code, hub_name="", city="", hub_type="airport"):
    """
    Returns an existing TransferProfile for this hub, or seeds one via a
    single LLM call and persists it. Returns None (never raises) if seeding
    fails — a missing orientation note is a gap, not a crash.
    """
    from apps.reference.models import TransferProfile

    existing = TransferProfile.objects.filter(location_code=location_code).first()
    if existing:
        return existing

    result = _seed_via_llm(location_code, hub_name, city, hub_type)
    if result is None:
        return None

    profile, _created = TransferProfile.objects.update_or_create(
        location_code=location_code,
        defaults={
            "typical_min_connection_mins": result.typical_min_connection_mins,
            "terminal_change_common": result.terminal_change_common,
            "notes": result.notes[:255],
            "source": "general_knowledge",
        },
    )
    return profile


def _seed_via_llm(location_code, hub_name, city, hub_type):
    try:
        from google import genai
        from pydantic import BaseModel
    except ImportError:
        logger.warning("google-genai not available; TransferProfile seeding skipped for %s", location_code)
        return None

    class TransferProfileResult(BaseModel):
        typical_min_connection_mins: int | None
        terminal_change_common: bool
        notes: str

    prompt = f"""Provide a general, well-known transfer profile for this transit hub —
typical minimum connection time and whether terminal changes are common. This
is a rough orientation note, not schedule-accurate data; keep claims general
("often requires a terminal change") rather than precise ("requires 14
minutes"). If you have no genuine general knowledge of this specific hub,
return null for typical_min_connection_mins and a short honest notes field
saying general layout information isn't available, rather than guessing.

Hub: {hub_name or location_code} ({location_code})
City: {city}
Hub type: {hub_type}
"""

    try:
        from apps.common.ai import get_genai_client
        client = get_genai_client()
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=genai.types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=TransferProfileResult,
                temperature=0.2,
            ),
        )
        return response.parsed
    except Exception as exc:
        logger.warning("TransferProfile seeding failed for %s: %s", location_code, exc)
        return None
