"""
DB-first plan generation with real, pollable progress.

The old path (ConversationService.create_plan) asks the LLM to invent an
itinerary and then tries to reconcile the inventions against reference data.
This pipeline inverts that: real places come FIRST (reference master tables,
grown through the same Google-Places cache-on-miss path the explore canvases
use), and the LLM's only creative job is sequencing — picking candidate ids
and times. A hallucinated id is rejected and filled by heuristic; a
hallucinated venue can't exist here at all.

Progress is a PlanGenerationJob row updated in autocommit writes as each
phase runs, so the loading screen polls actual pipeline state. Runs on a
daemon thread spawned via transaction.on_commit — every phase manages its
own transactions (ATOMIC_REQUESTS wraps views, not this thread).

Phases:
  understanding      LLM 1 (flash): skeleton only — cities, nights, day themes
  selecting_cities   validate/geocode against reference.City
  finding_places     per-city candidate pools from master tables (+ live growth)
  composing          LLM 2 (pro): pick + sequence candidate ids; server joins rows
  routing            DistanceService transit_hints per day
  pricing            transport priced from TravelPriceHistory / providers
  finalizing         totals, weather normals, persist trip + snapshot
"""

import logging
import threading
import uuid
from datetime import date as date_cls

from django.db import close_old_connections, transaction
from django.utils import timezone

from apps.planner.models import (
    PlanGenerationJob,
    PlannerTrip,
    PlannerTripOriginal,
    PlannerWorkspace,
)

logger = logging.getLogger(__name__)

PHASES = [
    ("understanding", "Understanding your trip", 10),
    ("selecting_cities", "Mapping your route", 20),
    ("finding_places", "Finding real places", 55),
    ("composing", "Composing your days", 75),
    ("routing", "Calculating travel times", 85),
    ("pricing", "Pricing from real data", 95),
    ("finalizing", "Finalizing your plan", 100),
]
_PHASE_PROGRESS = {key: pct for key, _label, pct in PHASES}


class GenerationFailed(Exception):
    pass


class JobReporter:
    """Writes phase/progress/detail to the job row in autocommit saves —
    the poller must see every update immediately, never at thread end."""

    def __init__(self, job):
        self.job = job
        self.job.phase_log = [
            {"key": key, "label": label, "state": "pending", "detail": "", "at": None}
            for key, label, _pct in PHASES
        ]

    def _entry(self, key):
        for entry in self.job.phase_log:
            if entry["key"] == key:
                return entry
        raise KeyError(key)

    def start(self, key, detail=""):
        entry = self._entry(key)
        entry["state"] = "active"
        entry["detail"] = detail
        entry["at"] = timezone.now().isoformat()
        self.job.phase = key
        self.job.save(update_fields=["phase", "phase_log", "updated_at"])

    def detail(self, key, detail):
        self._entry(key)["detail"] = detail
        self.job.save(update_fields=["phase_log", "updated_at"])

    def done(self, key, detail=None):
        entry = self._entry(key)
        entry["state"] = "done"
        if detail is not None:
            entry["detail"] = detail
        self.job.progress = _PHASE_PROGRESS[key]
        self.job.save(update_fields=["progress", "phase_log", "updated_at"])

    def fail(self, key, message):
        entry = self._entry(key)
        entry["state"] = "failed"
        entry["detail"] = message
        self.job.save(update_fields=["phase_log", "updated_at"])


# ── Job orchestration ────────────────────────────────────────────────────


def start_generation_job(workspace):
    """Create (or return the already-running) generation job for a workspace."""
    existing = workspace.generation_jobs.filter(
        status__in=[PlanGenerationJob.STATUS_QUEUED, PlanGenerationJob.STATUS_RUNNING],
        is_deleted=False,
    ).first()
    if existing:
        return existing, False
    job = PlanGenerationJob.objects.create(workspace=workspace)
    return job, True


def spawn_generation_thread(job_id):
    thread = threading.Thread(
        target=run_generation_job, args=(job_id,), kwargs={"manage_connections": True}, daemon=True
    )
    thread.start()
    return thread


def run_generation_job(job_id, manage_connections=False):
    """Thread entry point. With manage_connections=True (the thread path) it
    opens/closes its own DB connections; synchronous callers (tests) share
    the caller's connection and must not have it closed underneath them."""
    if manage_connections:
        close_old_connections()
    try:
        job = PlanGenerationJob.objects.select_related("workspace").get(id=job_id)
    except PlanGenerationJob.DoesNotExist:
        return

    job.status = PlanGenerationJob.STATUS_RUNNING
    job.started_at = timezone.now()
    job.save(update_fields=["status", "started_at", "updated_at"])

    reporter = JobReporter(job)
    workspace = job.workspace
    draft = workspace.draft_state

    try:
        itinerary = run_pipeline(draft, reporter)
        _persist_trip(workspace, draft, itinerary)
        job.status = PlanGenerationJob.STATUS_DONE
        job.progress = 100
        job.finished_at = timezone.now()
        job.save(update_fields=["status", "progress", "finished_at", "updated_at"])
    except Exception as exc:
        logger.exception("Plan generation pipeline failed for workspace %s", workspace.id)
        reporter.fail(job.phase or "understanding", str(exc)[:300])
        # Terminal fallback: the curated skeleton plan is still a usable trip.
        try:
            from apps.planner.services.conversation_service import ConversationService

            itinerary = ConversationService()._skeleton_fallback(draft)
            _persist_trip(workspace, draft, itinerary)
            job.status = PlanGenerationJob.STATUS_DONE
            job.progress = 100
            job.error = f"AI pipeline unavailable — built a curated fallback plan. ({str(exc)[:200]})"
            job.finished_at = timezone.now()
            job.save(update_fields=["status", "progress", "error", "finished_at", "updated_at"])
        except Exception as fallback_exc:
            logger.exception("Skeleton fallback also failed for workspace %s", workspace.id)
            job.status = PlanGenerationJob.STATUS_FAILED
            job.error = str(fallback_exc)[:500]
            job.finished_at = timezone.now()
            job.save(update_fields=["status", "error", "finished_at", "updated_at"])
    finally:
        if manage_connections:
            close_old_connections()


def serialize_job(job, stale_after_seconds=90):
    """Poll payload. A running job with no writes for stale_after_seconds is
    reported failed — a dead thread must surface, not spin forever."""
    status = job.status
    error = job.error or None
    if status in (PlanGenerationJob.STATUS_QUEUED, PlanGenerationJob.STATUS_RUNNING):
        silence = (timezone.now() - job.updated_at).total_seconds()
        if silence > stale_after_seconds:
            status = PlanGenerationJob.STATUS_FAILED
            error = "Generation stopped responding. Please retry."
    return {
        "job_id": str(job.id),
        "status": status,
        "phase": job.phase,
        "progress": job.progress,
        "phases": job.phase_log,
        "error": error,
    }


# ── The pipeline ─────────────────────────────────────────────────────────


def run_pipeline(draft, reporter):
    """Returns the itinerary dict {title, summary, total_budget, currency_code,
    cities, days} — same contract create_plan persists."""

    # Phase 1: skeleton — structure only, no venues to hallucinate
    reporter.start("understanding", f"Reading your {draft.destination_text} trip brief")
    skeleton = _generate_skeleton(draft)
    reporter.done(
        "understanding",
        f"{len(skeleton['days'])} days across {len(skeleton['cities'])} "
        f"{'city' if len(skeleton['cities']) == 1 else 'cities'}",
    )

    # Phase 2: cities must exist in reference data (create + geocode on miss)
    reporter.start("selecting_cities")
    city_objs = _resolve_cities(skeleton["cities"], draft)
    reporter.done("selecting_cities", " → ".join(c.name for c in city_objs.values()))

    # Phase 3: real candidate pools per city
    reporter.start("finding_places")
    pools = {}
    for city_name, city_obj in city_objs.items():
        pools[city_name] = _build_candidate_pool(city_obj)
        counts = {cat: len(items) for cat, items in pools[city_name].items() if items}
        summary = ", ".join(f"{n} {cat}s" for cat, n in counts.items())
        reporter.detail("finding_places", f"{city_obj.name}: {summary}")
    total_candidates = sum(len(v) for pool in pools.values() for v in pool.values())
    if total_candidates == 0:
        raise GenerationFailed("No reference places available for these cities.")
    reporter.done("finding_places", f"{total_candidates} real places found")

    # Phase 4: LLM sequences candidate ids; server joins the real rows back
    reporter.start("composing")
    days, meta = _compose_days(draft, skeleton, pools, city_objs)
    reporter.done("composing", f"{sum(len(d['activities']) for d in days)} blocks scheduled")

    # Phase 5: distances between consecutive places, stamped on each day
    reporter.start("routing")
    hint_count = _stamp_transit_hints(days)
    reporter.done("routing", f"{hint_count} legs measured")

    # Phase 6: transport priced from history/providers — never invented
    reporter.start("pricing")
    priced = _price_transport_blocks(days, draft)
    reporter.done("pricing", f"{priced} blocks priced from real data" if priced else "No priced transport on this trip")

    # Phase 7: weather normals + totals
    reporter.start("finalizing")
    _stamp_weather_normals(days, city_objs)
    itinerary = _assemble_itinerary(draft, skeleton, days, meta, city_objs)
    reporter.done("finalizing")
    return itinerary


# ── Phase 1: skeleton ────────────────────────────────────────────────────


def _generate_skeleton(draft):
    from google import genai
    from pydantic import BaseModel, Field
    from typing import List, Optional

    class CityVisit(BaseModel):
        name: str = Field(description="City name only, e.g. 'Jaipur'")
        nights: int
        arrival_date: Optional[str] = Field(description="YYYY-MM-DD")
        departure_date: Optional[str] = Field(description="YYYY-MM-DD")

    class DayTheme(BaseModel):
        day_number: int
        date: str = Field(description="YYYY-MM-DD")
        title: str = Field(description="Catchy day title")
        day_type: str = Field(description="exploration | transit | relaxation | arrival | departure")
        city: str

    class TripSkeleton(BaseModel):
        title: str
        summary: str
        cities: List[CityVisit]
        days: List[DayTheme]

    nearby = (draft.metadata or {}).get("nearby_cities") or []
    nearby_str = f"Nearby cities to include as excursions: {', '.join(nearby)}" if nearby else ""
    purpose = (draft.metadata or {}).get("visit_purpose", "")

    prompt = f"""Plan the STRUCTURE of a trip — cities, nights, and a theme per day.
Do NOT name any hotels, restaurants, attractions, or specific venues; real places are selected separately from a database.

Intent: {draft.intent}
Destination: {draft.destination_text}
Dates: {draft.start_date} to {draft.end_date}
Travelers: {draft.adults} adults, {draft.children} children
Budget tier: {draft.budget_tier}
Interests: {draft.interests}
Purpose: {purpose}
{nearby_str}

Rules:
- Days must run sequentially from {draft.start_date} to {draft.end_date}, one entry per date.
- Multi-city trips (including provided nearby cities) get a 'transit' day_type on transition days.
- Day 1 is 'arrival', the last day is 'departure' (unless single-day intent).
"""

    from apps.common.ai import get_genai_client
    client = get_genai_client()
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
        config=genai.types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=TripSkeleton,
            temperature=0.4,
        ),
    )
    data = response.parsed
    if data is None or not data.days:
        raise GenerationFailed("Skeleton generation returned no days.")

    return {
        "title": data.title,
        "summary": data.summary,
        "cities": [
            {
                "name": c.name.strip(),
                "nights": c.nights,
                "arrival_date": c.arrival_date or draft.start_date.isoformat(),
                "departure_date": c.departure_date or draft.end_date.isoformat(),
            }
            for c in data.cities
        ]
        or [
            {
                "name": draft.destination_text,
                "nights": max((draft.end_date - draft.start_date).days, 1),
                "arrival_date": draft.start_date.isoformat(),
                "departure_date": draft.end_date.isoformat(),
            }
        ],
        "days": [
            {
                "day_number": d.day_number,
                "date": d.date,
                "title": d.title,
                "day_type": d.day_type,
                "city": d.city.strip(),
            }
            for d in sorted(data.days, key=lambda x: x.day_number)
        ],
    }


# ── Phase 2: cities ──────────────────────────────────────────────────────


def _resolve_cities(skeleton_cities, draft):
    """City name → reference City row, creating + geocoding on miss."""
    from apps.reference.models import City, Country

    city_objs = {}
    names = [c["name"] for c in skeleton_cities]
    for name in names:
        clean = name.strip()
        with transaction.atomic():
            city_obj = City.objects.filter(name__iexact=clean).first()
            if not city_obj:
                country = None
                if draft.destination_city:
                    country = draft.destination_city.country
                if not country:
                    country, _ = Country.objects.get_or_create(
                        name="India", defaults={"code": "IN", "currency_code": "INR"}
                    )
                lat, lng = _geocode_city(clean)
                city_obj = City.objects.create(name=clean, country=country, latitude=lat, longitude=lng)
        city_objs[clean.lower()] = city_obj
    return city_objs


def _geocode_city(name):
    """Google Geocoding first (real), LLM estimate second, None last."""
    import json as json_mod
    import urllib.parse
    import urllib.request

    from django.conf import settings

    api_key = getattr(settings, "GOOGLE_PLACES_API_KEY", "")
    if api_key:
        try:
            url = (
                "https://maps.googleapis.com/maps/api/geocode/json"
                f"?address={urllib.parse.quote(name)}&key={api_key}"
            )
            with urllib.request.urlopen(url, timeout=5) as resp:
                data = json_mod.loads(resp.read().decode("utf-8"))
            if data.get("results"):
                loc = data["results"][0]["geometry"]["location"]
                return loc["lat"], loc["lng"]
        except Exception:
            pass
    try:
        from apps.planner.services.conversation_service import ConversationService

        coords = ConversationService()._call_external_city_coordinates(name)
        if coords:
            return coords["latitude"], coords["longitude"]
    except Exception:
        pass
    return None, None


# ── Phase 3: candidate pools ─────────────────────────────────────────────


def _build_candidate_pool(city_obj, per_category=12):
    """
    Real candidates per category, best-rated first. Thin pools grow through
    the same KnowledgeEngine.resolve() path the canvases use (Google Places
    -> cached into the master tables), so generation and canvases share one
    cache and one field-mask config instead of two hand-kept-in-sync copies.
    """
    from apps.reference.models import ActivityMaster, AttractionMaster, HotelMaster, RestaurantMaster

    models_by_category = {
        "attraction": AttractionMaster, "activity": ActivityMaster,
        "restaurant": RestaurantMaster, "hotel": HotelMaster,
    }

    pool = {}
    for category, model in models_by_category.items():
        rows = list(model.objects.filter(city=city_obj))
        if len(rows) < 5:
            rows = _grow_pool_via_places(city_obj, category) or rows
        rows.sort(key=lambda r: float(r.user_rating or 0), reverse=True)
        pool[category] = rows[:per_category]
    return pool


def _grow_pool_via_places(city_obj, category):
    """Fetch live Places results into the master-table cache. Failure means
    'use what we have', never a crash."""
    try:
        from apps.knowledge.services.engine import KnowledgeEngine

        lat = float(city_obj.latitude) if city_obj.latitude else None
        lng = float(city_obj.longitude) if city_obj.longitude else None
        _source, places, _error = KnowledgeEngine.resolve(category, city_obj.name, lat=lat, lng=lng)
        return list(places) if places else None
    except Exception as exc:
        logger.warning("Pool growth via Places failed for %s/%s: %s", city_obj.name, category, exc)
        return None


# ── Phase 4: composing ───────────────────────────────────────────────────

_CATEGORY_TO_BLOCK = {"attraction": "attraction", "activity": "activity", "restaurant": "food", "hotel": "hotel"}


def _candidate_catalog_lines(pools):
    """Compact, LLM-readable catalog of real candidates with stable ids."""
    lines = []
    for city_name, pool in pools.items():
        lines.append(f"CITY: {city_name.title()}")
        for category, rows in pool.items():
            for row in rows:
                rating = f"{row.user_rating}★" if row.user_rating else "unrated"
                extra = ""
                if category == "restaurant" and getattr(row, "cuisine", ""):
                    extra = f", {row.cuisine[:40]}"
                elif category == "hotel" and getattr(row, "price_range", ""):
                    extra = f", {row.price_range}"
                lines.append(f"  {category}:{row.pk} | {row.name[:60]} ({rating}{extra})")
    return "\n".join(lines)


def _traveler_context_summary(user):
    """
    Known TravelerProfile facts, formatted for prompt injection — previously
    collected (stated/inferred/confirmed) but never actually read by
    generation, a gap the original adversarial audit flagged explicitly
    ("engine does not yet prefill from TravelerProfile facts"). See
    docs/travel-intelligence-implementation-roadmap.md §1.9.
    """
    if user is None:
        return ""
    try:
        from apps.planner.models import TravelerProfile

        profile = TravelerProfile.objects.filter(user=user).first()
    except Exception:
        return ""
    if not profile or not profile.facts:
        return ""

    lines = [f"- {f['key']}: {f['value']}" for f in profile.facts if f.get("key") and f.get("value")]
    return "\n".join(lines)


def _compose_days(draft, skeleton, pools, city_objs):
    from google import genai
    from pydantic import BaseModel, Field
    from typing import List, Optional

    class ComposedBlock(BaseModel):
        kind: str = Field(description="'candidate' for a place from the catalog, 'transport' for a travel leg")
        candidate_id: Optional[str] = Field(default=None, description="EXACT id from the catalog, e.g. 'attraction:42'. Required when kind='candidate'.")
        transport_mode: Optional[str] = Field(default=None, description="flight | train | bus | cab. Required when kind='transport'.")
        from_place: Optional[str] = Field(default=None, description="Transport origin city")
        to_place: Optional[str] = Field(default=None, description="Transport destination city")
        start_time: str = Field(description="e.g. 09:30")
        end_time: str = Field(description="e.g. 11:00")
        note: str = Field(description="One helpful, factual sentence about the visit. No invented prices or facts.")

    class ComposedDay(BaseModel):
        day_number: int
        blocks: List[ComposedBlock]

    class ComposedItinerary(BaseModel):
        days: List[ComposedDay]

    skeleton_lines = "\n".join(
        f"Day {d['day_number']} ({d['date']}, {d['city']}): {d['title']} [{d['day_type']}]"
        for d in skeleton["days"]
    )

    intent_rules = {
        "hotel_only": "Compose ONE day listing the 3 best hotel candidates as blocks. No transport, food, or sightseeing.",
        "flight_only": "Compose ONE day with the arrival transport leg only (kind='transport', mode flight).",
        "transit_only": "Compose ONE day with transport legs only.",
        "activities_only": "Use only attraction/activity candidates. No hotels or transport.",
        "food_and_dining": "Use only restaurant candidates. No hotels or transport.",
    }
    rules = intent_rules.get(
        draft.intent,
        "Each city's first day starts with an arrival transport leg (kind='transport') and hotel check-in "
        "(the SAME hotel candidate for a city's whole stay — check-in block once, on the first day there). "
        "Then 2-4 sightseeing/activity candidates per day and 1-2 restaurant candidates (lunch/dinner). "
        "The final day ends with a departure transport leg.",
    )
    origin = (draft.metadata or {}).get("origin") or (draft.metadata or {}).get("origin_text") or ""
    traveler_context = _traveler_context_summary(getattr(draft.workspace, "user", None))
    traveler_context_block = (
        f"\nKNOWN TRAVELER CONTEXT (apply silently, do not ask about these again):\n{traveler_context}\n"
        if traveler_context else ""
    )

    prompt = f"""Schedule this trip using ONLY the real candidates below.

TRIP STRUCTURE:
{skeleton_lines}

Origin city (for arrival/departure transport): {origin or 'not specified'}
Travelers: {draft.adults} adults, {draft.children} children
Interests: {draft.interests}
Budget tier: {draft.budget_tier}
{traveler_context_block}
CANDIDATE CATALOG (id | name (rating, extra)):
{_candidate_catalog_lines(pools)}

RULES:
- {rules}
- candidate_id MUST be copied exactly from the catalog. NEVER invent an id or a venue.
- Prefer higher-rated candidates that match the traveler's interests; don't reuse a candidate on multiple days (except the hotel).
- Times must be realistic and sequential within each day.
- Notes must be factual and generic (what/when/why) — no made-up prices, no invented details."""

    from apps.common.ai import get_genai_client
    client = get_genai_client()
    response = client.models.generate_content(
        model="gemini-2.5-pro",
        contents=prompt,
        config=genai.types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=ComposedItinerary,
            temperature=0.5,
        ),
    )
    composed = response.parsed
    if composed is None or not composed.days:
        raise GenerationFailed("Composer returned no days.")

    # Join composed ids back to real rows; reject hallucinations.
    candidate_index = {}
    for pool in pools.values():
        for category, rows in pool.items():
            for row in rows:
                candidate_index[f"{category}:{row.pk}"] = (category, row)

    composed_by_number = {d.day_number: d for d in composed.days}
    used_ids = set()
    days_out = []

    for sk_day in skeleton["days"]:
        day_city_key = sk_day["city"].strip().lower()
        city_obj = city_objs.get(day_city_key) or next(iter(city_objs.values()))
        pool = pools.get(day_city_key) or next(iter(pools.values()))
        composed_day = composed_by_number.get(sk_day["day_number"])

        activities = []
        for block in (composed_day.blocks if composed_day else []):
            if block.kind == "transport" and block.transport_mode:
                activities.append(_transport_block(block, city_obj))
                continue
            resolved = candidate_index.get(block.candidate_id or "")
            if resolved is None:
                # Hallucinated or missing id → heuristic fill: best unused
                # candidate of any sightseeing category in this city.
                resolved = _heuristic_pick(pool, used_ids)
                if resolved is None:
                    continue
            category, row = resolved
            key = f"{category}:{row.pk}"
            if key in used_ids and category != "hotel":
                replacement = _heuristic_pick(pool, used_ids, prefer=category)
                if replacement is None:
                    continue
                category, row = replacement
                key = f"{category}:{row.pk}"
            used_ids.add(key)
            activities.append(_candidate_block(category, row, block, pool, used_ids))

        days_out.append(
            {
                "day_number": sk_day["day_number"],
                "date": sk_day["date"],
                "title": sk_day["title"],
                "day_type": sk_day["day_type"],
                "city": sk_day["city"],
                "activities": activities,
            }
        )

    return days_out, {"title": skeleton["title"], "summary": skeleton["summary"]}


def _heuristic_pick(pool, used_ids, prefer=None):
    """Best-rated unused candidate; deterministic, no LLM involved."""
    order = [prefer] if prefer else []
    order += [c for c in ("attraction", "activity", "restaurant") if c not in order]
    for category in order:
        for row in pool.get(category, []):
            if f"{category}:{row.pk}" not in used_ids:
                return category, row
    return None


def _transport_block(block, city_obj):
    mode = (block.transport_mode or "cab").lower()
    if mode not in ("flight", "train", "bus", "cab"):
        mode = "cab"
    origin = (block.from_place or "").strip()
    dest = (block.to_place or city_obj.name).strip()
    title = f"{mode.title()} to {dest}" if dest else f"{mode.title()} transfer"
    if origin and dest:
        title = f"{mode.title()}: {origin} → {dest}"
    return {
        "id": str(uuid.uuid4()),
        "category": mode if mode != "cab" else "cab",
        "title": title,
        "location_name": origin or city_obj.name,
        "start_time": block.start_time,
        "end_time": block.end_time,
        "estimated_cost": None,
        "currency_code": "INR",
        "status": "pending",
        "notes": block.note,
        "metadata": {"transport": {"mode": mode, "origin": origin, "destination": dest}},
    }


def _candidate_block(category, row, block, pool, used_ids):
    """A block built from a real master-table row. Every displayed fact
    (rating, image, address, tip) comes from that row — nothing invented."""
    alternatives = []
    for alt in pool.get(category, []):
        alt_key = f"{category}:{alt.pk}"
        if alt_key in used_ids or alt.pk == row.pk:
            continue
        alternatives.append(
            {
                "id": f"cand-{category}-{alt.pk}",
                "title": alt.name,
                "subtitle": (alt.address or "")[:80],
                "rating": float(alt.user_rating) if alt.user_rating else None,
                "aiTip": (alt.editorial_summary or "")[:160] or None,
                "place_id": alt.place_id,
            }
        )
        if len(alternatives) == 2:
            break

    return {
        "id": str(uuid.uuid4()),
        "category": _CATEGORY_TO_BLOCK[category],
        "title": row.name,
        "location_name": row.address or "",
        "start_time": block.start_time,
        "end_time": block.end_time,
        "estimated_cost": None,
        "currency_code": "INR",
        "status": "pending",
        "notes": block.note,
        "latitude": float(row.latitude) if row.latitude is not None else None,
        "longitude": float(row.longitude) if row.longitude is not None else None,
        "rating": float(row.user_rating) if row.user_rating else None,
        "image_url": row.image_url,
        "ai_tip": (row.editorial_summary or "").strip() or None,
        "metadata": {
            "place_id": row.place_id,
            "master_ref": {"table": category, "id": row.pk},
        },
        "_aiInsights": {"candidates": alternatives} if alternatives else None,
    }


# ── Phase 5: routing ─────────────────────────────────────────────────────


def _stamp_transit_hints(days):
    from apps.planner.services.distance_service import DistanceService

    pairs = []
    pair_targets = {}
    for day in days:
        geo_blocks = [
            a for a in day["activities"]
            if a.get("latitude") is not None and a.get("longitude") is not None
        ]
        for a, b in zip(geo_blocks, geo_blocks[1:]):
            pair_id = f"{a['id']}:{b['id']}"
            pairs.append(
                {
                    "id": pair_id,
                    "origin": {"lat": a["latitude"], "lng": a["longitude"], "name": a["title"]},
                    "destination": {"lat": b["latitude"], "lng": b["longitude"], "name": b["title"]},
                }
            )
            pair_targets[pair_id] = day

    if not pairs:
        return 0

    results = DistanceService.fetch_batch_distances(pairs, mode="driving")
    for pair_id, result in results.items():
        day = pair_targets.get(pair_id)
        if day is None:
            continue
        day.setdefault("transit_hints", {})[pair_id] = {
            "distance_km": result["distance_km"],
            "duration_mins": result["duration_mins"],
            "source": result.get("source", "unknown"),
        }
    return len(results)


# ── Phase 6: pricing ─────────────────────────────────────────────────────


def _price_transport_blocks(days, draft):
    """Transport gets a price only when history/providers actually have one.
    Unpriced blocks stay suggested-tier with no amount — an honest gap."""
    from apps.reference.services.live_price import lookup_live_price

    priced = 0
    travelers = max((draft.adults or 1) + (draft.children or 0), 1)
    for day in days:
        for block in day["activities"]:
            category = (block.get("category") or "").lower()
            if category not in ("flight", "train", "bus", "cab"):
                continue
            transport_meta = (block.get("metadata") or {}).get("transport") or {}
            result = None
            try:
                result = lookup_live_price(
                    service_type=category,
                    date_str=day.get("date") or "",
                    origin=transport_meta.get("origin", ""),
                    destination=transport_meta.get("destination", ""),
                )
            except Exception as exc:
                logger.warning("Transport pricing lookup failed: %s", exc)
            if not result:
                continue
            per_head = float(result["exact_price"])
            total = per_head * travelers if category != "cab" else per_head
            block["estimated_cost"] = total
            block["cost"] = {
                "amount": total,
                "currency": "INR",
                "provenance": result["provenance"],
            }
            priced += 1
    return priced


# ── Phase 7: finalize ────────────────────────────────────────────────────


def _stamp_weather_normals(days, city_objs):
    from apps.reference.models import WeatherNormals

    normals_cache = {}
    for day in days:
        city_obj = city_objs.get((day.get("city") or "").strip().lower())
        if city_obj is None:
            continue
        try:
            month = date_cls.fromisoformat(day["date"]).month
        except (ValueError, TypeError):
            continue
        cache_key = (city_obj.pk, month)
        if cache_key not in normals_cache:
            normals_cache[cache_key] = WeatherNormals.objects.filter(city=city_obj, month=month).first()
        normal = normals_cache[cache_key]
        if normal:
            day["weather_normal"] = {
                "month": month,
                "avg_temp_c": float(normal.avg_temp_c) if normal.avg_temp_c is not None else None,
                "precipitation_mm": float(normal.precipitation_mm) if normal.precipitation_mm is not None else None,
            }


def _assemble_itinerary(draft, skeleton, days, meta, city_objs):
    known_costs = sum(
        float(a["estimated_cost"])
        for day in days
        for a in day["activities"]
        if a.get("estimated_cost")
    )
    budget = float(draft.budget_amount or 0) or (draft.metadata or {}).get("budget_inr") or known_costs

    cities_out = []
    for idx, c in enumerate(skeleton["cities"]):
        city_obj = city_objs.get(c["name"].strip().lower())
        cities_out.append(
            {
                "name": city_obj.name if city_obj else c["name"],
                "country": city_obj.country.name if city_obj else "",
                "order": idx + 1,
                "nights": c["nights"],
                "arrival_date": c["arrival_date"],
                "departure_date": c["departure_date"],
            }
        )

    return {
        "title": meta["title"],
        "summary": meta["summary"],
        "total_budget": float(budget or 0),
        "currency_code": "INR",
        "cities": cities_out,
        "days": days,
    }


def _persist_trip(workspace, draft, itinerary):
    """Same persistence semantics as the legacy create_plan — one atomic
    write of trip + workspace + pristine snapshot + learned flow/facts."""
    from apps.planner.services.conversation_service import ConversationService

    with transaction.atomic():
        trip, created = PlannerTrip.objects.get_or_create(
            workspace=workspace,
            defaults={
                "title": itinerary.get("title", f"{draft.destination_text} Trip"),
                "summary": itinerary.get("summary", "Generated itinerary."),
                "currency_code": itinerary.get("currency_code", "INR"),
                "total_budget": itinerary.get("total_budget", draft.budget_amount or 0),
                "cities": itinerary.get("cities", []),
                "days": itinerary.get("days", []),
                "metadata": {"status": "complete", "travelers": draft.adults + draft.children},
            },
        )
        if not created:
            trip.title = itinerary.get("title", trip.title)
            trip.summary = itinerary.get("summary", trip.summary)
            trip.currency_code = itinerary.get("currency_code", trip.currency_code)
            trip.total_budget = itinerary.get("total_budget", trip.total_budget)
            trip.cities = itinerary.get("cities") or trip.cities
            trip.days = itinerary.get("days", trip.days)
            trip.metadata = {"status": "complete", "travelers": draft.adults + draft.children}
            trip.save()

        workspace.status = PlannerWorkspace.STATUS_ACTIVE
        workspace.mode = PlannerWorkspace.MODE_PLANNING
        workspace.last_activity_at = timezone.now()
        workspace.title = trip.title
        workspace.save(update_fields=["status", "mode", "last_activity_at", "updated_at", "title"])

        PlannerTripOriginal.objects.get_or_create(
            workspace=workspace,
            defaults={
                "title": trip.title,
                "summary": trip.summary,
                "cities": trip.cities,
                "days": trip.days,
                "metadata": trip.metadata,
            },
        )

    service = ConversationService()
    try:
        service._record_successful_flow(workspace, draft)
    except Exception as exc:
        logger.warning("Flow recording failed (non-fatal): %s", exc)
    try:
        service._record_traveler_facts(workspace, draft)
    except Exception as exc:
        logger.warning("Traveler fact recording failed (non-fatal): %s", exc)

    return trip
