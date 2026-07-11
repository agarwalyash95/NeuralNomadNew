"""
Place-level LLM enrichment — Hotel/Restaurant/Attraction judgment synthesis.
See docs/travel-intelligence-implementation-roadmap.md §1.1-§1.3, §1.12.

One call per place per enrichment cycle, not per card render — results are
cached as PlaceInsight rows. The rule this whole module follows: wherever a
fact can be computed (mention counts, z-scores), it is, in plain Python;
the LLM only synthesizes/phrases from those computed signals or extracts
verbatim from review text. Every prompt explicitly allows/expects null
output over a plausible-sounding guess.

Unlike PlanInsight (itinerary-level, context_hash keyed on trip content),
these are place-level facts — context_hash is a stable per-insight-type
marker; re-enrichment overwrites the same row rather than versioning by
trip context.
"""

import logging
from datetime import timedelta

from django.contrib.contenttypes.models import ContentType
from django.utils import timezone

logger = logging.getLogger(__name__)

_STATIC_CONTEXT = "v1"


def _save_insight(instance, insight_type, *, text="", structured=None, tier="suggested", basis="", ttl_days=14):
    from apps.knowledge.models import PlaceInsight
    from apps.planner.services.block_schema import make_provenance

    content_type = ContentType.objects.get_for_model(instance)
    PlaceInsight.objects.update_or_create(
        content_type=content_type,
        object_id=str(instance.pk),
        insight_type=insight_type,
        context_hash=_STATIC_CONTEXT,
        defaults={
            "text": text,
            "structured": structured or {},
            "provenance": make_provenance(tier, source="gemini-2.5-flash", basis=basis),
            "expires_at": timezone.now() + timedelta(days=ttl_days),
        },
    )


def _gemini_json(prompt, response_schema, *, model="gemini-2.5-flash", temperature=0.2):
    """Shared call shape — same pattern as apps.planner.services.plan_generation."""
    try:
        from google import genai
    except ImportError:
        logger.warning("google-genai not installed; enrichment skipped")
        return None
    try:
        client = genai.Client()
        response = client.models.generate_content(
            model=model,
            contents=prompt,
            config=genai.types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=response_schema,
                temperature=temperature,
            ),
        )
        return response.parsed
    except Exception as exc:
        logger.warning("Enrichment LLM call failed: %s", exc)
        return None


# ── Hotels (roadmap §1.1) ────────────────────────────────────────────────

def enrich_hotel(hotel):
    from pydantic import BaseModel

    class HotelJudgment(BaseModel):
        noise_profile_verdict: str | None
        noise_profile_basis: str
        guest_fit_tags: list[str]
        guest_fit_basis: str
        room_tier_verdict: str | None
        room_tier_reasoning: str

    room_tiers = [{"tier_name": t.tier_name, "premium_pct": t.price_premium_pct} for t in hotel.room_tiers.all()]
    prompt = f"""You are writing internal judgment notes for a travel app, not marketing
copy. Given a hotel's structured data and recent guest reviews, produce a
specific, evidence-grounded note per field or return null if the evidence
doesn't support a confident claim — never pad a null with generic
hospitality language. Cite what in the reviews supports each claim.

Hotel: {hotel.name}
Room tiers on file: {room_tiers or 'none on file'}
Amenities/editorial: {hotel.editorial_summary or 'none'}
Reviews (up to 30): {(hotel.reviews or [])[:30]}
"""
    result = _gemini_json(prompt, HotelJudgment)
    if result is None:
        return False

    if result.noise_profile_verdict:
        _save_insight(hotel, "noise_profile", text=result.noise_profile_verdict, basis=result.noise_profile_basis)
    if result.guest_fit_tags:
        _save_insight(hotel, "guest_fit", structured={"tags": result.guest_fit_tags}, basis=result.guest_fit_basis)
    if result.room_tier_verdict:
        _save_insight(hotel, "room_tier_verdict", text=result.room_tier_verdict, basis=result.room_tier_reasoning)
    return True


# ── Restaurants (roadmap §1.2) ───────────────────────────────────────────

def enrich_restaurant(restaurant):
    from pydantic import BaseModel

    class DishMention(BaseModel):
        dish: str
        mention_count: int

    class RestaurantJudgment(BaseModel):
        dish_mentions: list[DishMention]
        occasion_fit: list[str]
        dietary_notes: str

    prompt = f"""Extract facts about this restaurant from review text — never invent
from the cuisine type. Dish names must be extracted verbatim from review
text. Only report a dish if at least 3 different reviews mention it by name;
otherwise omit it from dish_mentions entirely (an empty list is a valid,
expected answer for most restaurants).

Restaurant: {restaurant.name}, cuisine: {restaurant.cuisine or 'unspecified'}
Reviews (up to 50): {(restaurant.reviews or [])[:50]}
"""
    result = _gemini_json(prompt, RestaurantJudgment)
    if result is None:
        return False

    signature = max(result.dish_mentions, key=lambda d: d.mention_count, default=None)
    if signature and signature.mention_count >= 3:
        _save_insight(
            restaurant, "signature_dish",
            structured={"name": signature.dish, "mention_count": signature.mention_count},
            basis=f"mentioned in {signature.mention_count} reviews",
        )
    if result.occasion_fit:
        _save_insight(restaurant, "occasion_fit", structured={"tags": result.occasion_fit}, basis="review synthesis")
    return True


# ── Attractions + Photography (roadmap §1.3, §1.12 — one call covers both) ──

def enrich_attraction(attraction):
    from typing import Literal

    from pydantic import BaseModel

    class AttractionJudgment(BaseModel):
        real_duration_minutes: int | None
        duration_basis: str
        # Plain `str | None` let the first live test return free text
        # ("worth the hype") instead of an enum value — Literal is what
        # actually constrains Gemini's structured output to these choices.
        hype_verdict: Literal["over", "under", "as_advertised"] | None
        hype_explanation: str
        vantage_point_note: str | None
        vantage_point_basis: str
        photogenic_verdict: Literal["better_in_person", "better_in_photos"] | None
        photogenic_basis: str

    prompt = f"""Synthesize visit-planning judgment for this attraction from its
reviews. "Real duration" must come from explicit time mentions in reviews
("spent about 2 hours") — if none exist, return null, never estimate from
the category. Hype/vantage-point/photogenic verdicts are opinion; only
report photogenic_verdict if at least 2 reviews express the same direction.
Bound real_duration_minutes between 15 and 480 if reported at all.

Attraction: {attraction.name}, category: {attraction.category or 'unspecified'}
Reviews (up to 30): {(attraction.reviews or [])[:30]}
"""
    result = _gemini_json(prompt, AttractionJudgment)
    if result is None:
        return False

    if result.real_duration_minutes and 15 <= result.real_duration_minutes <= 480:
        _save_insight(attraction, "real_duration",
                       structured={"minutes": result.real_duration_minutes}, basis=result.duration_basis, ttl_days=14)
    if result.hype_verdict:
        _save_insight(attraction, "hype_calibration", text=result.hype_explanation,
                       structured={"verdict": result.hype_verdict}, basis="rating/sentiment + review synthesis", ttl_days=30)
    if result.vantage_point_note:
        _save_insight(attraction, "vantage_point", text=result.vantage_point_note, basis=result.vantage_point_basis)
    if result.photogenic_verdict:
        _save_insight(attraction, "photogenic_reality_check", structured={"verdict": result.photogenic_verdict},
                       basis=result.photogenic_basis)
    return True


# ── Activities ────────────────────────────────────────────────────────────

def enrich_activity(activity):
    from typing import Literal

    from pydantic import BaseModel

    class ActivityJudgment(BaseModel):
        real_duration_minutes: int | None
        duration_basis: str
        difficulty_verdict: Literal["easy", "moderate", "hard", "extreme"] | None
        difficulty_basis: str
        guided_tour_verdict: bool | None
        guided_tour_basis: str
        safety_note: str | None
        safety_basis: str

    prompt = f"""Synthesize visit-planning judgment for this activity from its
reviews. "Real duration" must come from explicit time mentions in reviews
("took about 3 hours") — if none exist, return null, never estimate from
the category. Only report difficulty_verdict or guided_tour_verdict if the
reviews give clear, repeated evidence — otherwise return null rather than a
guess. Only report a safety_note if reviews mention a specific, concrete
hazard or precaution (not generic "be careful").
Bound real_duration_minutes between 15 and 600 if reported at all.

Activity: {activity.name}, category: {activity.category or 'unspecified'}
Reviews (up to 30): {(activity.reviews or [])[:30]}
"""
    result = _gemini_json(prompt, ActivityJudgment)
    if result is None:
        return False

    if result.real_duration_minutes and 15 <= result.real_duration_minutes <= 600:
        _save_insight(activity, "real_duration",
                       structured={"minutes": result.real_duration_minutes}, basis=result.duration_basis, ttl_days=14)
    if result.difficulty_verdict:
        _save_insight(activity, "difficulty_verdict", text=result.difficulty_verdict,
                       basis=result.difficulty_basis, ttl_days=30)
    if result.guided_tour_verdict is not None:
        _save_insight(activity, "guided_tour_verdict", structured={"guided_tour": result.guided_tour_verdict},
                       basis=result.guided_tour_basis, ttl_days=30)
    if result.safety_note:
        _save_insight(activity, "safety_note", text=result.safety_note, basis=result.safety_basis, ttl_days=30)
    return True


# ── Safety & etiquette (roadmap §1.8) ────────────────────────────────────

def generate_safety_etiquette_tips(city):
    """
    Scam/after-dark tips are gated behind needs_human_review=True by default,
    and only "high" confidence output is even queued for review — medium/low
    confidence is discarded outright, not stored at a lower tier. A wrong
    safety claim isn't proportionally bad the way a wrong restaurant tip is,
    so this domain doesn't get the usual "suggested tier with a caveat"
    fallback other domains use. Etiquette tips (lower stakes) auto-publish.
    """
    from typing import Literal

    from django.contrib.contenttypes.models import ContentType
    from pydantic import BaseModel

    from apps.knowledge.models import LocalTip

    content_type = ContentType.objects.get_for_model(city)
    existing = list(
        LocalTip.objects.filter(content_type=content_type, object_id=str(city.pk))
        .values_list("tip_text", flat=True)
    )

    class TipOut(BaseModel):
        category: Literal["scam_warning", "after_dark", "etiquette"]
        tip_text: str
        confidence: Literal["high", "medium", "low"]
        reasoning: str

    class TipBatch(BaseModel):
        tips: list[TipOut]

    prompt = f"""You are drafting safety or etiquette notes for a travel app. Only
state a specific scam pattern or safety caution if it is a well-established,
commonly-reported issue for this exact city — not a generic "be aware of
pickpockets" that applies everywhere. If you are not confident, return no
tip rather than a vague one. Etiquette notes must be specific and actionable
(a number, a gesture, a garment), not general advice like "be respectful."
Do not repeat any tip already on file.

City: {city.name}, {city.country.name}
Existing tips already on file (avoid duplicates): {existing or 'none'}

Return up to 5 tips across scam_warning, after_dark, and etiquette categories.
"""
    result = _gemini_json(prompt, TipBatch, temperature=0.3)
    if result is None:
        return {"created": 0, "discarded": 0}

    created = 0
    discarded = 0
    for tip in result.tips:
        if tip.category in ("scam_warning", "after_dark") and tip.confidence != "high":
            discarded += 1
            continue
        LocalTip.objects.create(
            content_type=content_type,
            object_id=str(city.pk),
            category=tip.category,
            tip_text=tip.tip_text,
            source="llm-researched",
            confidence="suggested",
            needs_human_review=(tip.category != "etiquette"),
        )
        created += 1
    return {"created": created, "discarded": discarded}


_ENRICH_BY_CATEGORY = {
    "hotel": enrich_hotel,
    "restaurant": enrich_restaurant,
    "attraction": enrich_attraction,
    "activity": enrich_activity,
}

# Cheap "has this row already been through an enrichment cycle" proxy — the
# first insight_type each enrich_* function tries to write, used both by the
# popularity-ordered batch pass and by the on-demand single-place trigger
# (apps.reference.views details() actions) so they agree on what "done" means.
_PROXY_INSIGHT_TYPE = {
    "hotel": "guest_fit",
    "restaurant": "occasion_fit",
    "attraction": "hype_calibration",
    "activity": "real_duration",
}


def needs_enrichment(category, instance):
    """True if `instance` has no fresh proxy insight yet — i.e. never enriched."""
    from django.contrib.contenttypes.models import ContentType

    from apps.knowledge.models import PlaceInsight

    content_type = ContentType.objects.get_for_model(instance)
    return not PlaceInsight.objects.filter(
        content_type=content_type, object_id=str(instance.pk),
        insight_type=_PROXY_INSIGHT_TYPE[category],
    ).exists()


def enrich_one(category, instance):
    """Single-place enrichment — used by the on-demand Celery task, unlike
    run_enrichment_pass() below which batches popularity-ordered rows."""
    return _ENRICH_BY_CATEGORY[category](instance)


def run_safety_etiquette_pass(batch_size=5):
    """
    Cities that actually have hotels on file yet (a proxy for "somewhere a
    real trip visits" — City itself has no popularity_score, unlike the four
    EnrichmentMixin master tables) with no LocalTip on file yet.
    """
    from django.contrib.contenttypes.models import ContentType
    from django.db.models import Count

    from apps.knowledge.models import LocalTip
    from apps.reference.models import City

    content_type = ContentType.objects.get_for_model(City)
    already_done_ids = set(
        LocalTip.objects.filter(content_type=content_type).values_list("object_id", flat=True)
    )
    candidates = (
        City.objects.exclude(pk__in=[int(i) for i in already_done_ids if i.isdigit()])
        .annotate(hotel_count=Count("hotelmaster"))
        .filter(hotel_count__gt=0)
        .order_by("-hotel_count")[:batch_size]
    )

    results = {"attempted": 0, "created": 0, "discarded": 0}
    for city in candidates:
        results["attempted"] += 1
        outcome = generate_safety_etiquette_tips(city)
        results["created"] += outcome["created"]
        results["discarded"] += outcome["discarded"]
    return results


def run_enrichment_pass(batch_size_per_category=5):
    """
    Popularity-ordered batch enrichment across the three categories with a
    real LLM synthesis path. Skips rows that already have a fresh
    'guest_fit'/'occasion_fit'/'hype_calibration' insight (cheap proxy for
    "already enriched this cycle") rather than re-calling the LLM every run.
    """
    from apps.reference.models import ActivityMaster, AttractionMaster, HotelMaster, RestaurantMaster

    models_by_category = {
        "hotel": HotelMaster, "restaurant": RestaurantMaster,
        "attraction": AttractionMaster, "activity": ActivityMaster,
    }

    results = {}
    for category, model in models_by_category.items():
        content_type = ContentType.objects.get_for_model(model)
        already_done_ids = set(
            _place_insight_model()
            .objects.filter(content_type=content_type, insight_type=_PROXY_INSIGHT_TYPE[category])
            .values_list("object_id", flat=True)
        )
        candidates = (
            model.objects.exclude(pk__in=[int(i) for i in already_done_ids if i.isdigit()])
            .order_by("-popularity_score", "-user_ratings_total")[:batch_size_per_category]
        )
        done = 0
        for instance in candidates:
            if _ENRICH_BY_CATEGORY[category](instance):
                done += 1
        results[category] = {"attempted": len(candidates), "enriched": done}
    return results


def _place_insight_model():
    from apps.knowledge.models import PlaceInsight

    return PlaceInsight
