# NeuralNomad Travel Knowledge Engine — Architecture Plan

> Redesigns the intelligence layer behind the planner, not the planner. Routes, components, and the planner concept are unchanged. Self-contained: usable from any future context window.
> Created 2026-07-11. Builds on `docs/planner-redesign-plan.md` (shipped 2026-07-10) and the adversarial audit findings from the same day — cross-references are called out inline.

## 0. Philosophy, restated precisely

> Database first. External API only on a real miss. Normalize everything. Never re-fetch what you already know. Never fabricate what you don't.

This is already partially true today — `plan_generation.py` phase 3 (`finding_places`) queries the four master tables before calling `places_explore.explore_places`, and `live_price.py` checks `TravelPriceHistory` before hitting a provider. The problem isn't that the pattern doesn't exist; it's that it's **implemented three separate times** (generation pipeline, explore canvases, price lookup), **inconsistently** (no TTL anywhere, so "cached" and "stale forever" are the same thing), and **stops at facts** — there's no layer that turns cached facts into the kind of proactive, contextual intelligence the brief asks for ("this restaurant closes before you arrive").

The fix isn't a new database. It's:
1. One resolver function every caller goes through, so DB-first stops being a convention and becomes structurally the only path.
2. Freshness as a first-class field, so "cached" has an expiry.
3. A small number of genuinely new tables for the things that don't fit anywhere today (relationships between places, AI-generated insights, interaction history for popularity).
4. Actually wiring the Celery/Redis infrastructure that's already installed and sitting unused.

## 1. Ground truth this plan is built on

Verified directly against source, not assumed:

- **Postgres in production** (`config/settings/production.py:12-25`, `sslmode=require`), SQLite optional in dev. No `django.contrib.postgres`, no `ArrayField`/`SearchVector`/`TrigramSimilarity`/`pgvector` anywhere yet — clean slate.
- **Celery is scaffolded but disconnected**: `config/celery.py` exists and autodiscovers tasks, but no `CELERY_*` settings are read in `base.py`/`production.py`, no `CELERY_BEAT_SCHEDULE`, no `tasks.py` in any app, zero `@shared_task` usage beyond the placeholder `debug_task`. `celery==5.6.3`, `redis==8.0.0`, `django-redis==7.0.0` are all installed. `CACHES` is never configured — Django's default local-memory cache is active despite Redis being installed.
- **`google-genai` is used in `plan_generation.py:267,510` but absent from `requirements.txt`** — a latent packaging bug, fixed in Phase K0 below.
- **Photo URLs leak the Google API key to the browser.** `places_explore.py::extract_photos()` builds `.../v1/{photo_name}/media?maxHeightPx=800&key={api_key}` and stores that full URL as `HotelMaster.image_url`/`secondary_images` — served directly to every client. This is the same key flagged as leaked in the redesign log; the current architecture actively re-exposes it on every card render, independent of git history.
- **The four master tables already are the cache** — `HotelMaster`/`RestaurantMaster`/`AttractionMaster`/`ActivityMaster`, each keyed by a unique `place_id`, populated by `places_explore.py`'s cache-on-miss (`len(cached) < 5` → fetch → persist). There is no separate raw-response cache; `GooglePlaceCache` exists as a model but has zero references anywhere in the codebase — dead.
- **No freshness anywhere.** `LocationDistanceCache` has `unique_together` but no TTL — a distance computed once is permanent. Master-table rows have no `last_enriched_at`. Nothing ever gets refreshed; it only ever gets fetched once.
- **Provenance tiers are already a real, working vocabulary** (`apps/planner/services/block_schema.py`: `verified`/`estimated`/`suggested`) and `apps/reference/services/suggestions.py` already imports it — the reference app depends on planner's provenance module. This plan extends that vocabulary rather than inventing a second one.
- **Known placeholder-suppression already exists**: `suggestions.py:56-61,84-87` explicitly nulls out `AttractionMaster.suggested_duration_mins==120` and `ActivityMaster.price_estimate==1200.0` as known ingest-time defaults. This is the right instinct, applied ad hoc in two places — Phase K1 turns it into a registered rule, not a per-field `if`.
- **Duplicate concepts already exist**: `reference.VisaRequirement` (nationality×destination, FK-based, structurally correct) vs. `apps.visa.VisaData` (destination-only, string-keyed); `reference.Currency` vs. `apps.forex.ForexData` vs. `VendorCurrencyInventory`. The [audit](../docs/planner-redesign-plan.md) already flagged the *symptom* of this (VisaCanvas and ForexCanvas disagreeing on domestic/international because each hand-rolls its own keyword list) — this plan fixes the *cause*: two sources of truth for the same fact.
- **`live_price.py` has a tier bug**: a price is tagged `verified` only on the request that first calls a live provider; every subsequent read of that same `TravelPriceHistory` row returns tier `estimated`, because the tier is derived at read-time from "did I just call a provider," not stored on the row. Fixed in §4.

## 2. Design decision: what actually becomes a new table

The brief lists ~50 entity types (Country, State, City, Airport … Museum, Beach, Temple, Park … Golden Hour, Sunrise/Sunset …). Turning each into its own Django model would be sixty-odd tables, most of them holding one row's worth of distinguishing logic. That's not thoroughness, it's the over-engineering the current codebase's own architecture already avoids (four master tables cover eight+ requested entity types via a `category` field). This plan keeps that discipline and classifies every requested entity into one of four buckets:

| Bucket | Rule | Examples from the brief |
|---|---|---|
| **Already a real model** | No change needed structurally, only enrichment (§3) | Country, State, City, Airport, RailwayStation, BusStation, MetroStation, Hotel, Restaurant, Attraction, Activity, WeatherNormals, TravelSeason, TravelPriceHistory |
| **A category on an existing model, not a new table** | Distinguishing field, not distinguishing structure | Museum/Beach/Temple/Park/Shopping Area/Nightlife → `AttractionMaster.category`; Cafe → `RestaurantMaster.primary_type`; Landmark → `AttractionMaster` row with `category='landmark'` |
| **Computed on demand, cached in Redis, never stored as a "fact"** | Deterministic from lat/lng + date; storing it as data invites it going stale/wrong | Golden Hour, Sunrise/Sunset, Best Time To Visit (derived from `WeatherNormals` + `TravelSeason`, not a separate opinion) |
| **A genuinely new normalized model** | Doesn't fit anywhere above | Neighbourhood, Event, Local Tips, Emergency Contacts, Safety, Relationship Graph, Popularity, Crowd Levels, AI Summaries, Recommendation Scores |

New app: **`apps/knowledge`** — cross-cutting engine infrastructure, sitting alongside `reference` the way `visa`/`forex` already sit alongside it. It does not replace `reference`; it adds the enrichment layer `reference`'s master tables were never given.

## 3. Database schema

### 3a. Extend existing master tables (migration, not rewrite)

A single mixin applied to `HotelMaster`, `RestaurantMaster`, `AttractionMaster`, `ActivityMaster`, and `City` (all currently plain integer-PK models with no freshness concept):

```python
# apps/reference/models.py — new abstract mixin, applied via migration to existing tables
class EnrichmentMixin(models.Model):
    last_enriched_at = models.DateTimeField(null=True, blank=True)
    enrichment_ttl_days = models.PositiveSmallIntegerField(default=30)   # popularity-adjusted at write time, see §4
    data_completeness_score = models.FloatField(default=0.0)             # 0-1, fraction of enrichable fields populated
    popularity_score = models.FloatField(default=0.0, db_index=True)     # derived, see §9
    source = models.CharField(max_length=40, default="google_places")    # provenance of the row itself
    class Meta:
        abstract = True
```

Plus fixing two correctness gaps the inventory surfaced:
- `City`: add `unique_together = ("name", "state", "country")` and a `place_id` (Google Place ID for the city itself) — today `places_explore.resolve_city`/`plan_generation._resolve_cities` both match by `name__iexact` alone, so "Springfield" resolves to whichever row was created first, in whichever country.
- `WeatherNormals`, `TravelSeason`: add `unique_together = ("city", "month")` — currently unconstrained, duplicate month rows are possible.
- `TravelPriceHistory`: add a real dedup constraint (`service_type`, `date`, `provider`, `code`) with an upsert path in `live_price.py`'s write-back, and **store the tier on the row** instead of re-deriving it at read time (fixes the verified→estimated downgrade bug in §1).

### 3b. New models in `apps/knowledge`

```python
class Neighbourhood(BaseModel):          # UUID pk, timestamps, soft-delete — matches planner app's BaseModel, not reference's bare style
    city = models.ForeignKey("reference.City", on_delete=models.CASCADE, related_name="neighbourhoods")
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    vibe_tags = models.JSONField(default=list)          # ["nightlife", "family", "budget", "upscale"]
    center_lat = models.DecimalField(max_digits=9, decimal_places=6, null=True)
    center_lng = models.DecimalField(max_digits=9, decimal_places=6, null=True)
    safety_score = models.FloatField(null=True)          # provenance-tagged, see PlaceInsight for the "why"

class Event(BaseModel):
    city = models.ForeignKey("reference.City", on_delete=models.CASCADE, related_name="events")
    name = models.CharField(max_length=255)
    category = models.CharField(max_length=60)            # festival, concert, sports, market
    start_date = models.DateField()
    end_date = models.DateField(null=True)
    venue_place_id = models.CharField(max_length=255, blank=True)
    source = models.CharField(max_length=60, default="manual")   # ticketmaster / manual / llm-researched — never silently invented
    cost_provenance = models.JSONField(default=dict)      # reuses block_schema.make_provenance shape

class LocalTip(BaseModel):
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)   # generic: attach to City, Neighbourhood, or a master row
    object_id = models.UUIDField()  # or int, see note below
    target = GenericForeignKey("content_type", "object_id")
    category = models.CharField(max_length=40)             # safety, etiquette, money, transport, food
    tip_text = models.TextField()
    source = models.CharField(max_length=60)                # llm-researched / community / official
    confidence = models.CharField(max_length=12, choices=[("verified","verified"),("estimated","estimated"),("suggested","suggested")])

class EmergencyContact(BaseModel):
    country = models.ForeignKey("reference.Country", on_delete=models.CASCADE, related_name="emergency_contacts")
    city = models.ForeignKey("reference.City", on_delete=models.SET_NULL, null=True, blank=True)
    service_type = models.CharField(max_length=40)   # police, ambulance, fire, tourist_helpline, embassy
    number = models.CharField(max_length=30)
    notes = models.CharField(max_length=255, blank=True)

class SafetyAdvisory(BaseModel):
    country = models.ForeignKey("reference.Country", on_delete=models.CASCADE, related_name="safety_advisories")
    city = models.ForeignKey("reference.City", on_delete=models.SET_NULL, null=True, blank=True)
    level = models.CharField(max_length=20, choices=[("normal","normal"),("caution","caution"),("high_risk","high_risk")])
    summary = models.TextField()
    source = models.CharField(max_length=120)          # must be a real, named source — no LLM-invented advisories
    updated_at = models.DateTimeField(auto_now=True)

class PlaceRelationship(BaseModel):
    """The 'relationship graph.' One edge table instead of N join tables per relationship type."""
    from_content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE, related_name="+")
    from_object_id = models.CharField(max_length=64)    # supports both int (reference) and UUID (knowledge/planner) pks
    to_content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE, related_name="+")
    to_object_id = models.CharField(max_length=64)
    relation_type = models.CharField(max_length=30, choices=[
        ("near", "near"), ("pairs_well_with", "pairs_well_with"),
        ("alternative_to", "alternative_to"), ("on_route_between", "on_route_between"),
    ])
    strength_score = models.FloatField(default=0.0)      # 0-1, how strong the relationship is
    distance_km = models.FloatField(null=True)
    metadata = models.JSONField(default=dict)             # e.g. {"shared_theme": "sunset viewpoint"}
    class Meta:
        indexes = [models.Index(fields=["from_content_type", "from_object_id"])]
        unique_together = ("from_content_type", "from_object_id", "to_content_type", "to_object_id", "relation_type")

class EntityEmbedding(BaseModel):
    """Generic — decoupled from the master tables so embedding models can version independently."""
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.CharField(max_length=64)
    embedding = VectorField(dimensions=768)               # pgvector — see §10 for model choice
    embedding_version = models.CharField(max_length=40)    # e.g. "gemini-text-embedding-004"
    source_text_hash = models.CharField(max_length=64)      # detects when the underlying text changed and re-embed is needed
    class Meta:
        unique_together = ("content_type", "object_id", "embedding_version")
        indexes = [HnswIndex(name="entity_embedding_hnsw", fields=["embedding"], m=16, ef_construction=64, opclasses=["vector_cosine_ops"])]

class PlaceInsight(BaseModel):
    """Cached AI-generated text — the fix for AIInsightsPanel's hardcoded theme.localTip (see §6, §11)."""
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.CharField(max_length=64)
    insight_type = models.CharField(max_length=40)         # ai_summary, local_tip, best_time_note, crowd_note
    context_hash = models.CharField(max_length=64, db_index=True)   # hash of (item + trip context) that produced this text
    text = models.TextField()
    provenance = models.JSONField(default=dict)             # make_provenance() shape — an insight can itself be "suggested" tier
    generated_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    class Meta:
        unique_together = ("content_type", "object_id", "insight_type", "context_hash")

class EntityInteractionLog(BaseModel):
    """Substrate for popularity scoring (§9) — currently nothing tracks this at all."""
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.CharField(max_length=64)
    event_type = models.CharField(max_length=30)    # viewed, hovered, added_to_plan, booked, removed
    workspace_id = models.UUIDField(null=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

class DistanceEdge(BaseModel):
    """Supersedes LocationDistanceCache — same keys, same table conceptually, extended with TTL + modes + intelligence."""
    origin_key = models.CharField(max_length=255, db_index=True)
    destination_key = models.CharField(max_length=255, db_index=True)
    mode = models.CharField(max_length=20, db_index=True)    # walking, driving, transit, cycling, flight, train, bus
    distance_km = models.FloatField(null=True)
    duration_mins = models.FloatField(null=True)
    cost_estimate = models.JSONField(null=True)               # {amount, currency, provenance} — block_schema shape
    elevation_gain_m = models.FloatField(null=True)
    traffic_multiplier = models.FloatField(null=True)          # >1 = typically slower than free-flow
    scenic_score = models.FloatField(null=True)                 # 0-1 heuristic, always "estimated" tier, never asserted as fact
    carbon_kg = models.FloatField(null=True)
    source = models.CharField(max_length=30)         # google_distance_matrix, haversine_estimate, reference_route
    computed_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(db_index=True)             # the single field that was missing before
    class Meta:
        unique_together = ("origin_key", "destination_key", "mode")
```

### 3c. Deprecate, don't duplicate

- Retire `apps.visa.VisaData` (destination-only) in favor of `reference.VisaRequirement` (nationality×destination — structurally the only correct shape for a real visa lookup, since requirements depend on both). Migrate existing `VisaData` rows into `VisaRequirement` with `nationality="Indian"` as the default (matches the hardcoded `nationality: 'Indian'` already present in every booking search-param builder per the audit).
- Retire `reference.Currency` and consolidate onto `apps.forex.ForexData`/`VendorCurrencyInventory` (the forex app is the richer, actually-used implementation). `reference.Currency` becomes a thin read-through alias during migration, then deleted.
- `GooglePlaceCache` — repurpose rather than delete: becomes the **raw ingestion staging table** (§9) instead of dead code. This is the one place raw provider JSON is allowed to live before normalization.

## 4. Caching architecture

Three layers, each with a distinct job — this replaces "cache-on-miss inside four different services" with one shape used everywhere.

```mermaid
flowchart LR
    Caller[Any caller: plan_generation, explore canvas,\nbooking search, RichHoverCard prefetch] --> R[KnowledgeEngine.resolve()]
    R --> L1{Redis hit?\n(hot, ephemeral,\nTTL minutes-hours)}
    L1 -- yes --> Return1[Return]
    L1 -- no --> L2{Postgres fresh?\n(master tables + knowledge app,\nTTL days-weeks, popularity-adjusted)}
    L2 -- yes --> Warm[Warm Redis] --> Return2[Return]
    L2 -- no / thin --> L3[External provider\nGoogle Places / RapidAPI / Gemini]
    L3 --> Normalize[Normalize + validate against\nplaceholder registry (§9)]
    Normalize --> Persist[Persist to Postgres,\nstamp last_enriched_at]
    Persist --> Warm
```

**Layer 1 — Redis** (finally wiring the already-installed `django-redis`): per-request-cheap, deterministic, or session-scoped data that doesn't belong in Postgres — computed sunrise/sunset for a `(lat_bucket, lng_bucket, month)` key (deterministic, infinite TTL is fine but keep it at 90 days for simplicity), in-flight distance computations, rate-limit counters (also closes the "no rate limiting on LLM endpoints" Critical finding from the audit — same Redis instance, `django-ratelimit` or DRF throttle backed by Redis).

**Layer 2 — Postgres** (the real source of truth): master tables + `apps.knowledge` models. TTL lives on `enrichment_ttl_days`, **not a fixed constant** — it's popularity-adjusted:

| Entity type | Base TTL | Popularity adjustment |
|---|---|---|
| Hotel/Restaurant/Attraction/Activity master | 30 days | Top-decile `popularity_score` → 7 days; bottom half → 90 days (long-tail places refresh lazily on next request, never proactively) |
| `TravelPriceHistory` | 1 day | Not popularity-adjusted — price staleness risk is the same regardless of place popularity |
| Opening hours specifically (subfield, not whole row) | 14 days | Refreshed early if a `blocks/{id}/verify` call fails against stale hours (signal-driven, not just time-driven) |
| `WeatherNormals`/`TravelSeason` | 365 days | Static by nature |
| `EntityEmbedding` | Until `source_text_hash` changes | Not time-based — re-embed on content change, not on a clock |
| `DistanceEdge` | 60 days (driving/transit), 180 days (flight/train/bus — scheduled routes change rarely) | Not popularity-adjusted |
| `PlaceInsight` | 7 days or on `context_hash` change, whichever first | Insights tied to trip context (dates, weather) go stale when context does, not just on a clock |

**Layer 3 — External providers**: called only from inside `KnowledgeEngine.resolve()`, never directly from a view or canvas service. This is the enforcement mechanism for "AI should never repeatedly call external APIs for information that can be cached" — it stops being a design intention and becomes something a code reviewer (or a CI grep rule: no `requests.get`/`genai.Client()` calls outside `apps/knowledge/services/` and `apps/bookings/providers/`) can actually check.

**Invalidation**: time-based (TTL above) plus **signal-based** — a failed price verification, a 404 from a place-details re-check, or three consecutive `EntityInteractionLog` "removed" events on the same entity all force `last_enriched_at = null`, jumping the row to the front of the next background refresh pass regardless of its TTL.

**Background refresh** (Celery, finally configured):

```python
# config/settings/base.py additions — Phase K0
CELERY_BROKER_URL = env("CELERY_BROKER_URL", default="redis://localhost:6379/1")
CELERY_RESULT_BACKEND = env("CELERY_RESULT_BACKEND", default="redis://localhost:6379/2")
CACHES = {"default": {"BACKEND": "django_redis.cache.RedisCache", "LOCATION": env("REDIS_URL", default="redis://localhost:6379/0")}}
CELERY_BEAT_SCHEDULE = {
    "refresh-stale-entities": {"task": "apps.knowledge.tasks.refresh_stale_entities", "schedule": crontab(hour=3, minute=0)},
    "run-price-watches": {"task": "apps.planner.tasks.run_price_watches", "schedule": crontab(minute="*/30")},
    "recompute-popularity": {"task": "apps.knowledge.tasks.recompute_popularity_scores", "schedule": crontab(hour=2, minute=30)},
    "embed-backlog": {"task": "apps.knowledge.tasks.compute_embeddings_backlog", "schedule": crontab(minute="*/15")},
}
```

`run_price_watches` already exists as a management command with correct logic — the [prior audit](#) flagged it as dead because nothing schedules it. Wrapping the existing function body in a `@shared_task` and adding it to `CELERY_BEAT_SCHEDULE` is the entire fix; no logic changes needed. Same for `refresh_stale_entities`: query `WHERE last_enriched_at + enrichment_ttl_days < now() ORDER BY popularity_score DESC LIMIT batch_size`, call the same normalize+persist path `places_explore.py` already uses.

## 5. AI pipeline — one resolver, formalized

```python
# apps/knowledge/services/engine.py — the single DB-first entry point
class KnowledgeEngine:
    @staticmethod
    def resolve(category: str, city: City, filters: dict, *, allow_stale: bool = False) -> list[NormalizedPlace]:
        """
        1. Query the relevant master table, scoped to city + filters.
        2. If enough fresh rows (>= MIN_RESULTS) exist → return them (Layer 2 hit).
        3. If thin or stale and allow_stale=False → call the mapped provider,
           normalize through the placeholder registry (§9), persist, return.
        4. If thin and allow_stale=True (used by background jobs, not user-facing requests)
           → return what exists and queue an async refresh instead of blocking.
        """
```

Every current caller is refactored to go through this instead of its own copy of the pattern:

| Caller | Today | After |
|---|---|---|
| `plan_generation.py::_build_candidate_pool` | Direct `model.objects.filter()` + inline `_grow_pool_via_places` | `KnowledgeEngine.resolve(category, city, filters)` |
| `places_explore.py::explore_places` | Own cache-on-miss implementation | Becomes a thin wrapper calling `KnowledgeEngine.resolve` |
| Booking search forms (Flight/Hotel/Train/Bus/Cab) | `provider_registry.search()` direct calls | Routed through `KnowledgeEngine.resolve("flight", ...)`, which internally decides DB (`TravelPriceHistory`) vs. `provider_registry` — this is also where the real-vs-mock "Live search" label bug from the audit gets fixed structurally: the label is derived from which branch actually executed, not a hardcoded constant |
| `RichHoverCard`'s `usePlaceDetails` prefetch | Already correctly DB-first via `GET /reference/places/details/` | Unchanged in shape, backend swaps its internals to call the resolver |

**Insight generation** (distinct from fact resolution): a second, narrower service, `InsightEngine.generate(item, trip_context)`, called only for items actually rendered/hovered (not the whole trip eagerly), checks `PlaceInsight` first (keyed on `context_hash = hash(item.place_id, trip.dates, trip.travelers)`), and only calls Gemini if no cached insight matches that exact context. This directly replaces `AIInsightsPanel.tsx`'s hardcoded `theme.localTip` (static copy keyed only by category, not real AI) with genuinely generated, cached text — fixing a specific finding from the prior audit (the "AI Smart Recommendation" card was one of two real things; "Local Travel Tip" was the fake one) without reintroducing the "call the LLM on every hover" cost problem.

## 6. Distance & Route Engine

Extends `apps/planner/services/distance_service.py` rather than replacing it — the existing per-pair `ThreadPoolExecutor` + Google Distance Matrix + haversine-fallback pattern is sound; it's just single-mode and non-expiring today.

- **Multi-mode**: `fetch_batch_distances(pairs, modes=["driving","walking","transit"])` — same one-call-per-pair-per-mode approach, same thread pool, writes one `DistanceEdge` row per `(pair, mode)`.
- **Inter-city modes** (flight/train/bus) don't need a maps API at all — they're already modeled as `AirportRoute`/`TrainRoute`/`BusRoute.duration_mins`. The resolver reads those directly and tags the `DistanceEdge.source = "reference_route"`.
- **Elevation**: new Google Elevation API call, batched the same way, only for `walking`/`cycling` edges (irrelevant for flight/transit) — Phase K3, not K1, since it's additive and non-blocking.
- **Traffic/scenic/carbon**: computed heuristics, not fetched facts — `carbon_kg = distance_km * MODE_EMISSION_FACTOR[mode]` (published per-km emission factors, cited in code comments), `scenic_score` from a simple heuristic (density of `AttractionMaster` rows within 500m of the route midpoint, normalized 0-1). Both are tagged `provenance.tier = "estimated"` using the **same `make_provenance()` helper already used everywhere else** — this is the important part: a scenic score is not a new kind of trust signal the user has to learn, it's the same amber-dashed badge they already see on prices.
- **Route optimization moves server-side.** The audit's Critical/High findings on `routeOptimizer.ts` (unmemoized O(n!) permutation search running on every hover, two divergent trust models for the same action) get fixed as a byproduct of this redesign, not a separate patch: with `DistanceEdge` now a real, TTL'd, multi-mode table, the optimizer becomes a backend service (`apps/planner/services/route_optimizer.py`) that reads precomputed edges instead of recalculating haversine on the client, runs once per day-content-change (not per render), and — critically — **always produces a `PlanProposal`**, never a direct mutation. This retires the second, unreviewed "Optimize Route" button code path entirely rather than leaving two ways to do the same thing.

## 7. Card redesign

The frontend inventory found the gap isn't "no data" — it's data the backend already has that the card layer drops. Concretely: `FlightCanvas.tsx` computes `amenities` in its mapper (line 136) and never renders it. `RichHoverCard.tsx` destructures `details.wheelchair_accessible`, `details.good_for_children`, `details.parking_options`, `details.payment_options` and renders none of them, despite `SuggestionCard.tsx` — a sibling component — already having a working `buildFacts()` pattern for exactly this data. Phase K1's card work starts by **closing that gap** before adding a single new field, because it's free (the data exists, the fetch already happens) and immediately visible.

**Card anatomy, per type** (all built on the existing warm-paper token system from the redesign — `--paper`, `--ink`, `--trust-verified/estimated/suggested` — not a new palette):

| Card | Today shows | Adds (existing-but-unused data) | Adds (new Knowledge Engine data) |
|---|---|---|---|
| **Hotel** (`GenericNode` + `RichHoverCard`) | image, rating, geoTag, price, provenance badge | `parking_options`, `payment_options`, `wheelchair_accessible`, full opening-hours week (not just today) | Neighbourhood vibe tag, distance to nearest metro/transit, `PlaceInsight` "why this hotel" summary, crowd-level-by-season |
| **Restaurant** (`SuggestionCard`) | Most complete today — facts chips, reviews slice, editorial summary | `star_rating`, full review list (currently sliced to 5 with no "see more") | Cuisine-to-preference match score (from `TravelerProfile` facts), "closes before you'd arrive" insight, dietary-tag prominence (currently buried in `buildFacts()`) |
| **Attraction/Activity** (`GenericNode`) | image, rating, geoTag, aiTip, price+provenance | `good_for_children`, `wheelchair_accessible`, `guided_tour`/`equipment_included` (activity), `difficulty_level` | Best time to visit (computed, §3b), crowd-level-by-hour, "you're passing this anyway" relationship badge, golden-hour/sunset flag for photography-relevant categories |
| **Transit** (`TransitNode`) | image, title, subtitle only — **the thinnest card today, and the audit's Critical/High finding** | Price + `ProvenanceBadge` (currently absent entirely — a straight bug fix, not a redesign) | Mode-specific comfort notes (`amenities`/`seats`/`meal` — already computed by `FlightCanvas`, never wired through `blockMerge`) |
| **Flight/Train/Bus/Cab result** (booking canvases) | route, time, duration, stops, price | `amenities` (already computed, never rendered) | Real provenance (fixes the hardcoded "Live search" constant), fare-trend context ("this is 12% below the 30-day average" from `TravelPriceHistory`) |

Information density increases by **exposing existing structured data**, not by enlarging cards — the brief's own instruction. Each new fact gets the same visual treatment already established for provenance (small, muted, iconography-led) so density doesn't come at the cost of hierarchy.

## 8. Map experience

Kept as Google Maps JS API (no change to provider) with three additions, all backend-data-driven rather than new map UI paradigms:
- **Relationship-aware pins**: pins connected by a `PlaceRelationship(relation_type="on_route_between")` edge get a subtle connecting line when either endpoint is hovered — the visual expression of "you're passing this anyway."
- **Neighbourhood shading**: a soft boundary overlay per `Neighbourhood.center_lat/lng` (radius-based, not a full polygon store — avoids the schema bloat of storing precise boundaries nobody asked for) with the `vibe_tags` in the tooltip.
- **Fixes the existing Darjeeling-fallback bug** (audit High finding): missing-coordinate items fall back to the trip's actual `TripDraftState.destination_city` centroid instead of a hardcoded `27.0360, 88.2627`, and get a visibly distinct pin style (dashed outline) so "we don't actually know where this is" is honest in the UI, not silently wrong.

## 9. Data enrichment pipeline

```mermaid
flowchart TD
    A[Provider response: Google Places / RapidAPI] --> B[GooglePlaceCache\nraw JSON staging, repurposed from dead model]
    B --> C{Placeholder registry check}
    C -- known placeholder value --> D[Null the field, mark data_completeness_score down]
    C -- real value --> E[Keep]
    D --> F[Normalize into master table row]
    E --> F
    F --> G[Stamp last_enriched_at, source, popularity_score=0 if new]
    G --> H[Queue: compute_embeddings_backlog]
    G --> I[Queue: relationship-graph pass\n(nearby existing rows → PlaceRelationship edges)]
```

- **Placeholder registry** (Phase K1): a small declarative table replacing the two ad hoc `if value == 120` / `if value == 1200.0` checks in `suggestions.py` — `{model: AttractionMaster, field: suggested_duration_mins, placeholder_value: 120}` etc. — so adding a new known-placeholder rule is a data row, not a code change, and the same rule fires whether the value came from ingest, a stale cache read, or an LLM-composed fallback.
- **Photo strategy — the security fix first, storage second**: Phase K0 adds a backend proxy endpoint `GET /api/reference/photo/{photo_ref}/` that fetches from Google server-side (API key never leaves the backend) and streams the response with `Cache-Control` aligned to Google's Places API photo-caching terms. `image_url`/`secondary_images` stop storing the raw Google URL-with-embedded-key and store the `photo_ref` instead; the frontend requests through the proxy. This alone closes an active credential-exposure issue independent of any caching benefit. Longer-term (Phase K4, not K0): for the top-popularity-decile of places only, generate and store a downsized derivative via `Pillow` (already installed) in object storage — **flagged as needing a licensing/ToS review before implementation**, not assumed safe by default.
- **Review aggregation**: reviews stay as the existing JSON blob (correctly — they're semi-structured, third-party, don't need relational query) but gain a computed `RestaurantMaster`/`AttractionMaster`-level `review_sentiment_score` and a `PlaceInsight(insight_type="ai_summary")` row generated once per enrichment cycle (not per view), replacing "show 5 raw reviews" with "show a synthesized summary plus 2-3 representative quotes."
- **Popularity scoring**: `recompute_popularity_scores` (Celery, nightly) derives a 0-1 score per entity from `EntityInteractionLog` counts (weighted: `booked` > `added_to_plan` > `viewed` > `hovered`) blended with `user_ratings_total`. This is the first time the product has any interaction telemetry at the place level — it's what makes popularity-based refresh (§4) possible at all, and it's a small, justified new table, not speculative infrastructure.

## 10. Search & embeddings

- **Vector search**: `pgvector` (Postgres extension + `pgvector` Python package, `pgvector.django.VectorField`). Chosen over Elasticsearch/Algolia because the stack is already committed to Postgres in production, and adding a second search service is exactly the kind of new operational surface this plan should avoid introducing unless the existing one genuinely can't do the job — it can.
- **Embedding model**: Gemini's embedding endpoint (`text-embedding-004` equivalent) via the `google-genai` client already used for the LLM calls — no second AI vendor to integrate, key management, or billing relationship. (Requires pinning `google-genai` in `requirements.txt`, currently missing — Phase K0.)
- **Hybrid search**: Postgres full-text search (`SearchVectorField` + GIN index on `name`/`editorial_summary`/tags) for exact/lexical matches, combined with `EntityEmbedding` cosine-similarity for semantic matches ("quiet place to work" → cafés with relevant editorial summaries even without the word "quiet"). Combined via reciprocal rank fusion at query time — standard hybrid-search pattern, no new infra beyond the one extension.
- **Dev environment requirement**: this makes Postgres-with-`pgvector` a hard dev dependency, not just a prod one — the existing SQLite dev fallback (`USE_LOCAL_DB`) can't support vector/FTS features. Phase K0 includes a `docker-compose` Postgres+pgvector service for local dev, deprecating the SQLite path for any work touching search.

## 11. Planner intelligence — proactive insights

The brief's examples ("this restaurant closes before you arrive," "you're passing this famous viewpoint anyway," "this museum is free today") share a shape: **a rule evaluated against Knowledge Engine data, surfaced as a suggestion, never a silent mutation.** This is `PlanInsightEngine`, running as a batch pass after generation and incrementally on edit (not on every render):

```python
# apps/planner/services/insight_engine.py
RULES = [
    ClosesBeforeArrival,       # opening_hours vs. computed arrival time from transit_hints
    CrowdPeakWarning,          # crowd-level-by-hour (derived from EntityInteractionLog time-of-day distribution) vs. scheduled time
    SunriseAdjustedTiming,     # computed sunrise/sunset (§3) vs. scheduled breakfast/photography-tagged activities
    OnRouteOpportunity,        # PlaceRelationship(relation_type="on_route_between") within N meters of a scheduled transit leg
    HotelTravelTimeSaving,     # DistanceEdge sum across the day vs. an alternative HotelMaster row within budget
    PreferenceMatch,           # TravelerProfile facts vs. RestaurantMaster.cuisine / AttractionMaster.category
    ReviewRecencyDrop,         # rolling review_sentiment_score trend, not a point-in-time rating
    FreeEntryToday,            # HolidayCalendar / Event overlap with a paid AttractionMaster on the scheduled date
]
```

Each rule emits a `PlanInsight`-shaped object (not the `PlaceInsight` cache table from §5 — this is itinerary-level, not place-level) with `severity`, `message`, `related_block_ids`, and — the important part — an `action` that, if accepted, is submitted as a **`PlanProposal`**, the same accept/reject mechanism the redesign already built and the audit already found has a real staleness guard. This is deliberate: it means proactive AI suggestions and explicit route-optimization requests go through **one** trust model, not two, closing the exact inconsistency the audit flagged (`ItineraryTimeline`'s direct-apply "Optimize Route" button vs. `PlannerWorkspace`'s proposal-wrapped version of the identical function).

## 12. Prioritized implementation roadmap

Numbered `K0…K5` to avoid colliding with the redesign's existing `Phase 0-7`; this track can start independently once `Phase 0` foundations (settings/key hygiene) from the prior plan are in place.

| Phase | Scope | Depends on |
|---|---|---|
| **K0 — Infra foundations** (S) | Wire `CELERY_BROKER_URL`/`RESULT_BACKEND`/`CACHES` into settings (packages already installed); pin `google-genai` in `requirements.txt`; add `pgvector` extension + Postgres dev docker-compose; ship the photo-proxy endpoint and stop storing key-embedded URLs (security fix, independent of everything else — do this regardless of sequencing). | Nothing — can start immediately |
| **K1 — Schema + placeholder registry** (M) | `EnrichmentMixin` migration onto the four master tables + `City`; new `apps/knowledge` app with `PlaceRelationship`, `EntityEmbedding`, `PlaceInsight`, `EntityInteractionLog`, `DistanceEdge`; placeholder registry replacing the two ad hoc checks in `suggestions.py`; `City`/`WeatherNormals`/`TravelSeason`/`TravelPriceHistory` uniqueness fixes. | K0 (pgvector) |
| **K2 — KnowledgeEngine.resolve() + refactor callers** (L) | Build the resolver; migrate `plan_generation.py`, `places_explore.py`, and booking search to call it instead of their own copies; fix the `live_price.py` tier-persistence bug; wire `CELERY_BEAT_SCHEDULE` (`refresh_stale_entities`, `run_price_watches` as a real task, `recompute_popularity_scores`). This is also where the "Live search" mislabeling bug from the audit gets fixed structurally. | K1 |
| **K3 — Distance & route engine** (M) | Multi-mode `DistanceEdge` population; server-side route optimizer reading precomputed edges, emitting only `PlanProposal`s (retiring the direct-apply code path); carbon/scenic scoring with proper provenance tags. | K1 |
| **K4 — Cards + map** (M) | Wire the already-computed-but-unrendered fields (`amenities`, accessibility booleans, full review lists) through `RichHoverCard`/`TransitNode`/`blockMerge`; neighbourhood shading + relationship-line map overlay; Darjeeling-fallback fix. | K1 (data), independent of K2/K3 |
| **K5 — Embeddings, search, insight engine** (L) | `EntityEmbedding` backfill via Celery backlog task; hybrid FTS+vector search endpoint; `PlanInsightEngine` rules, wired to emit `PlanProposal`s; `InsightEngine.generate()` replacing `theme.localTip`. | K2, K3 |

**Sequencing note**: K0 and K4's Darjeeling/photo-proxy fixes are small, independently shippable, and fix real bugs regardless of whether the rest of this plan proceeds — worth doing even in isolation. K2 is the centerpiece and the highest-risk phase (touches the generation pipeline, the explore canvases, and booking search simultaneously) — matches how the prior redesign correctly treated its DB-first generation phase as "the centerpiece."

## 13. Critical files

| File | Role in this plan |
|---|---|
| `backend/apps/reference/services/places_explore.py` | Becomes a thin wrapper over `KnowledgeEngine.resolve()` (K2) |
| `backend/apps/reference/services/live_price.py` | Tier-persistence bug fix (K1); becomes a `KnowledgeEngine.resolve()` branch (K2) |
| `backend/apps/planner/services/plan_generation.py` | `_build_candidate_pool`/`_grow_pool_via_places` routed through the resolver (K2) |
| `backend/apps/planner/services/distance_service.py` | Extended for multi-mode + `DistanceEdge` (K3), not replaced |
| `backend/apps/planner/services/block_schema.py` | `make_provenance()` reused for scenic/carbon scores and `PlaceInsight`/`Event` cost tags — no second provenance vocabulary |
| `backend/apps/planner/management/commands/run_price_watches.py` | Logic reused verbatim inside a new `@shared_task` (K2) |
| `frontend/src/features/planner/workspace/plan-canvas/RichHoverCard.tsx` | Wires through already-fetched-but-unrendered fields first (K4) |
| `frontend/src/features/planner/workspace/plan-canvas/nodes/TransitNode.tsx` | Gets price + `ProvenanceBadge` (K4) — the audit's thinnest card |
| `frontend/src/features/planner/workspace/plan-canvas/AIInsightsPanel.tsx` | `theme.localTip` replaced by `InsightEngine`-backed `PlaceInsight` (K5) |
| `frontend/src/features/planner/workspace/plan-canvas/utils/routeOptimizer.ts` | Client-side brute force retired in favor of server-side K3 optimizer |

## 14. Out of scope / explicitly deferred

Real-time live weather forecast integration (WeatherNormals stays seasonal-average, honestly labeled); a dedicated search microservice (Postgres hybrid search is the deliberate choice, not a stopgap); polygon-precise neighbourhood boundaries (radius-based is sufficient for the stated use); self-hosted image storage for anything outside the top popularity decile; a general-purpose "events" data provider integration (Event rows start manual/LLM-researched with an honest `source` field, not a promise of live ticketing data).
