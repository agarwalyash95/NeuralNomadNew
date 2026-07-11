# Travel Intelligence Layer — Implementation Roadmap

> Converts the Product & Experience Direction (2026-07-11) into a buildable spec. Every domain and every surface from that vision is covered below — none dropped, none flattened into a generic placeholder. This document does not redesign the Knowledge Engine architecture (`docs/travel-knowledge-engine-plan.md`) — it extends it. Where a model, endpoint, or mechanism already exists in that plan (`KnowledgeEngine.resolve()`, `PlaceInsight`, `DistanceEdge`, `PlaceRelationship`, `EntityInteractionLog`, the `RULES` list, `apps/knowledge`), this document reuses it and only specifies the delta.

## 0. How to read this document

Two passes, twelve domains then six surfaces, because they compose differently:

- **§1, domain by domain** — for each of the vision's twelve intelligence domains: the exact insights promised (quoted, not paraphrased), the data model that backs each one, the enrichment pipeline that produces it, the API surface, the AI prompt where one is genuinely needed, and its caching tier.
- **§2, surface by surface** — for each of the vision's six redesigned surfaces: component tree, TypeScript data contract, every UI state (loading/empty/error/stale/interactive), and which domain data it consumes.
- **§3, consolidated schema diff** — every new model and field from §1 in one place, for migration planning.
- **§4, rollout** — every deliverable above mapped onto the existing K0–K5 phases, not a new phase track.

A rule this document follows throughout, because it's the same rule the whole Knowledge Engine exists to enforce: **wherever a fact can be computed or measured, it is — the LLM only phrases it. Wherever a fact is genuinely a judgment call, the AI's output is tagged `suggested` tier and never presented with the confidence of a verified price.** Domains that are naturally numeric (distance, weather, punctuality) get almost no new prompts; domains that are naturally subjective (hype, vibe, vantage points) get prompts with explicit low-confidence framing built in. This isn't a simplification of the vision — it's what makes the vision safe to ship at all, given the entire prior audit was about a product that told users things that weren't true.

## 1. Domain implementations

### 1.1 Hotels & Stays

> *"Which room category the view is actually worth paying extra for. Real noise profile — nightlife-adjacent vs. genuinely quiet street. Walkability to the nearest metro stop and a real meal, in minutes. Seasonal amenity truth — is the rooftop pool even open this month. Who it actually suits: couples, families, solo, business."*

**Data model**
```python
# apps/reference/models.py — new model, FK to the existing HotelMaster
class HotelRoomTier(models.Model):
    hotel = models.ForeignKey(HotelMaster, on_delete=models.CASCADE, related_name="room_tiers")
    tier_name = models.CharField(max_length=120)          # "Deluxe Hillside View"
    price_premium_pct = models.FloatField(null=True)       # vs. the hotel's base rate
    feature_tags = models.JSONField(default=list)           # ["hillside_view", "balcony"]
    source = models.CharField(max_length=40, default="provider_rate_data")

# HotelMaster gains (via migration):
seasonal_amenities = models.JSONField(default=list)   # [{"amenity": "rooftop pool", "active_months": [5,6,7,8,9]}]
```
`HotelMaster.popularity_score`/`enrichment_ttl_days`/`last_enriched_at` already exist via the `EnrichmentMixin` from the architecture plan — reused, not redefined.

**Enrichment pipeline**
1. `HotelRoomTier` rows populate from live hotel-provider room-rate responses (`apps/bookings/providers/hotel_providers.py`, `LIVE_PROVIDERS_ENABLED` gated per the architecture plan) — this is real provider data, not synthesized.
2. `seasonal_amenities` extracted from Places `editorial_summary`/amenity list via the enrichment LLM pass below, tagged `estimated` (inferred, not confirmed against a live hotel calendar).
3. `noise_profile`, `guest_fit`, and a `room_tier_verdict` (which tier is worth the premium, referencing real `HotelRoomTier` rows) are written as `PlaceInsight` rows by a single enrichment pass per hotel, run whenever `HotelMaster.last_enriched_at` refreshes (§4 caching table, "Hotel/Restaurant/Attraction/Activity master").

**AI prompt** — one call per hotel enrichment cycle, not per card render:
```text
SYSTEM: You are writing internal judgment notes for a travel app, not customer-facing
marketing copy. You will be given a hotel's structured data and up to 30 recent guest
reviews. For each requested field, either produce a specific, evidence-grounded note or
return null if the evidence doesn't support a confident claim — never pad a null with
generic hospitality language. Every non-null field must include a one-sentence "basis"
citing what in the input supports it.

USER: Hotel: {name}. Room tiers: {room_tiers_json}. Amenities: {amenities_json}.
Reviews (most recent 30): {reviews_json}.

Return JSON:
{
  "noise_profile": {"verdict": string|null, "basis": string},
  "guest_fit": {"tags": string[], "basis": string},
  "room_tier_verdict": {"tier_name": string|null, "reasoning": string, "basis": string},
  "seasonal_amenity_notes": [{"amenity": string, "note": string}]
}
```

**API** — no new endpoint. `GET /reference/places/details/?place_id=&category=hotel` (existing unified resolver, per the architecture plan) gains `room_tiers`, `noise_profile`, `guest_fit`, `seasonal_amenities` in its `details` payload.

**Caching** — `HotelMaster` fields: 30-day TTL, popularity-adjusted (architecture plan §4 table). `PlaceInsight` rows (`noise_profile`, `guest_fit`, `room_tier_verdict`): 7-day TTL or on review-set change, whichever first.

---

### 1.2 Restaurants & Food

> *"The one dish worth the visit, by name. Reservation reality — walk-in fine vs. book three weeks out. Local favorite vs. tourist-menu — and how to tell from the inside. Occasion fit: date night, family table, solo counter seat. Genuine dietary accommodation depth, not just a checkbox."*

**Data model**
```python
# RestaurantMaster gains:
reservation_policy = models.CharField(max_length=20, choices=[
    ("walk_in", "walk_in"), ("recommended", "recommended"), ("required", "required")], null=True)
typical_lead_time_days = models.PositiveSmallIntegerField(null=True)
dietary_accommodations = models.JSONField(default=dict)
# {"vegetarian": "full_menu"|"some_options"|"limited", "vegan": ..., "gluten_free": ..., "halal": ..., "kosher": ...}
# supersedes the existing flat booleans (serves_vegetarian_food etc.), which stay as a fast-filter fallback
```

**Enrichment pipeline**
1. `reservation_policy`/`typical_lead_time_days`: primary source is the Places API `reservable` flag; when absent, mined from review text ("booked three weeks ahead" style phrases) by the enrichment LLM, tagged `estimated`.
2. `signature_dish`: a **two-step, mostly-deterministic** pipeline, not a single LLM guess — (a) extract candidate dish names from the last ~50 reviews via the LLM (structured extraction, not opinion), (b) rank by mention frequency in code, (c) only the top dish with `mention_count >= 3` is surfaced; below that threshold, `signature_dish` is `null` and the card omits the banner rather than guessing.
3. `local_vs_tourist`: computed signal first (ratio of non-English-language reviews via Places' `review.language` field, plus price-vs-neighbourhood-median comparison), LLM only writes the one-sentence explanation from those two numbers — it does not originate the verdict.
4. `occasion_fit`, `dietary_accommodations`: LLM-synthesized from structured attributes + reviews, same enrichment pass as above.

**AI prompt**
```text
SYSTEM: You are extracting facts about a restaurant from review text, for a travel app
that never presents a guess as a fact. Dish names must be extracted verbatim from review
text, not invented from the cuisine type. If fewer than 3 reviews mention the same dish
by name, return an empty dish list rather than picking your best guess.

USER: Restaurant: {name}, cuisine: {cuisine}. Reviews: {reviews_json}.
Computed signals — local_review_ratio: {ratio}, price_vs_neighbourhood_median: {delta}.

Return JSON:
{
  "dish_mentions": [{"dish": string, "mention_count": number}],
  "occasion_fit": string[],
  "dietary_accommodations": {"vegetarian": string, "vegan": string, "gluten_free": string, "halal": string, "kosher": string},
  "local_vs_tourist_explanation": string   // one sentence, must reference the computed signals given
}
```

**API** — same details endpoint, `category=restaurant`.

**Caching** — `RestaurantMaster` structured fields: 30-day TTL. `signature_dish`/`local_vs_tourist`: 14-day TTL (review mix shifts faster than hotel amenities; matches the architecture plan's "opening hours" refresh cadence, reused here for the same reason — review-derived facts drift on a similar clock).

---

### 1.3 Attractions & Activities

> *"Real visit length for a typical pace — not a rounded placeholder. The one-hour window that avoids the tour-bus crush. Whether it's over-hyped, under-hyped, or exactly as advertised. What to skip first if the day runs short. Physical difficulty and step-free access, stated plainly."*

**Data model**
```python
# apps/knowledge/models.py — new, generic FK so it also covers routes/neighbourhoods later if needed
class CrowdPattern(BaseModel):
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.CharField(max_length=64)
    hour_of_day = models.PositiveSmallIntegerField()          # 0-23
    day_type = models.CharField(max_length=10, choices=[("weekday","weekday"),("weekend","weekend"),("holiday","holiday")])
    crowd_level = models.FloatField()                           # 0-1
    sample_size = models.PositiveIntegerField(default=0)         # count of EntityInteractionLog rows behind this cell
    source = models.CharField(max_length=20, choices=[("telemetry","telemetry"),("estimated_prior","estimated_prior")])
    class Meta:
        unique_together = ("content_type", "object_id", "hour_of_day", "day_type")

# AttractionMaster / ActivityMaster gain:
accessibility_detail = models.JSONField(default=dict)
# {"step_free": bool|null, "terrain": "paved"|"uneven"|"steep"|null, "typical_walk_distance_m": int|null, "difficulty_level": "easy"|"moderate"|"strenuous"|null}
```
This is the model that actually replaces the ingest-time placeholders the audit found (`suggested_duration_mins==120`, `price_estimate==1200.0`) with real values instead of just suppressing them — see the placeholder-registry pipeline in the architecture plan §9; the replacement value comes from `PlaceInsight(insight_type='real_duration')` below, not a better hardcoded default.

**Enrichment pipeline**
1. `real_duration`: LLM extraction of "spent X hours" style phrases from reviews, cross-checked against a sane bound (15 min–8 hrs) before acceptance; tagged `estimated`.
2. `CrowdPattern`: **cold start** — a one-time LLM "prior" seeding pass per attraction (below), tagged `source='estimated_prior'`, run at first enrichment. **Warm path** — once `EntityInteractionLog` accumulates ≥ 30 view/hover events at a given `(hour_of_day, day_type)` cell for that place, a nightly Celery task recomputes that cell from real telemetry and flips `source='telemetry'`. The crowd-meter UI (§2.3) only ever shows `telemetry` cells with confidence; `estimated_prior` cells render with an explicit "typical pattern, not yet confirmed here" caveat.
3. `hype_calibration`: computed signal (`user_ratings_total` z-score vs. `review_sentiment_score` z-score within the same city+category) with the LLM only writing the explanatory sentence — always tagged `suggested`, by design, since "overrated" is inherently opinion.
4. `accessibility_detail`: Places `accessibilityOptions` first; review-mined fallback (mentions of stairs, wheelchair access) tagged `estimated` when the structured field is absent.
5. Photography fields from §1.12 (`vantage_point`, `photogenic_reality_check`) are produced in this **same** enrichment call, not a separate one — one LLM pass per attraction covers both domain 3 and domain 12's outputs, avoiding a 13th call per place for what is fundamentally one enrichment cycle.

**AI prompts**
```text
SYSTEM (enrichment pass): You are synthesizing visit-planning judgment for one attraction
from its reviews and reference data. "Real duration" must come from explicit time mentions
in reviews (e.g. "spent about 2 hours") — if none exist, return null, do not estimate from
the category. Hype calibration and vantage-point notes are opinion; always phrase them as
"many visitors feel..." not as fact. Photogenic-reality-check requires at least two reviews
expressing the same direction (more/less impressive in person) before you report a verdict.

USER: Attraction: {name}, category: {category}. Reviews: {reviews_json}.
Computed — fame_zscore: {z1}, sentiment_zscore: {z2}.

Return JSON:
{
  "real_duration_minutes": number|null, "duration_basis": string,
  "hype_calibration": {"verdict": "over"|"under"|"as_advertised"|null, "explanation": string},
  "accessibility_detail": {"step_free": bool|null, "terrain": string|null, "difficulty_level": string|null},
  "vantage_point": {"note": string|null, "basis": string},
  "photogenic_reality_check": {"verdict": "better_in_person"|"better_in_photos"|null, "basis": string}
}
```
```text
SYSTEM (crowd-prior seeding, cold start only): Estimate a typical hour-by-hour crowd
pattern (0-1 scale) for this well-known attraction, for a weekday and separately a
weekend. Use general knowledge of how tourist attractions of this type and fame level
are typically visited. This is explicitly a rough prior, not a measurement — do not
overstate precision (round to the nearest 0.1).

USER: Attraction: {name}, category: {category}, city: {city}, fame_percentile: {z1}.

Return JSON: {"weekday": [{"hour": 0-23, "level": 0-1}, ...24 entries], "weekend": [...]}
```

**API** — details endpoint enrichment for duration/hype/accessibility/vantage/photogenic; new dedicated endpoint for the chart-shaped data: `GET /reference/places/{id}/crowd-pattern/?day_type=weekday` → `CrowdPattern` rows for that place.

**Caching** — `real_duration`: 14-day TTL (review-derived). `hype_calibration`: 30-day TTL (opinion is slow-moving). `CrowdPattern`: not TTL'd in the request path — recomputed by the nightly `recompute_crowd_patterns` Celery task (new, added alongside the architecture plan's `recompute_popularity_scores`).

---

### 1.4 Transportation

> *"Real transfer friction — platform changes, stair count, luggage practicality. Which seat class actually matters on this specific route. Operator punctuality track record, not a generic on-time badge. Walk time from the station exit to the actual destination. Whether booking now meaningfully beats booking later."*

**Data model**
```python
# apps/reference/models.py
class TransferProfile(models.Model):
    location_code = models.CharField(max_length=10, unique=True)   # IATA/station code
    typical_min_connection_mins = models.PositiveSmallIntegerField(null=True)
    terminal_change_common = models.BooleanField(default=False)
    stair_heavy = models.BooleanField(null=True)
    notes = models.CharField(max_length=255, blank=True)
    source = models.CharField(max_length=40, default="general_knowledge")

# apps/knowledge/models.py
class TransitOutcomeLog(BaseModel):
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)   # AirportRoute/TrainRoute/BusRoute
    object_id = models.CharField(max_length=64)
    scheduled_at = models.DateTimeField()
    actual_at = models.DateTimeField(null=True)          # null until a real tracking source reports it
    delta_minutes = models.IntegerField(null=True)
    source = models.CharField(max_length=40)               # which tracking/provider surfaced this
```
Punctuality is deliberately **not** a materialized stat table — `OperatorPunctualityStat` was considered and dropped in favor of a direct aggregate query over `TransitOutcomeLog` (`AVG(delta_minutes <= threshold)` over the trailing 30 days), Redis-cached for an hour. A dedicated table would duplicate data the log already holds for a query volume that doesn't need it yet.

**Enrichment pipeline**
1. `TransferProfile` — seeded once per airport/station via the LLM (general knowledge of known hub layouts), tagged `suggested`; upgraded to `estimated` if a provider ever supplies real minimum-connection-time data.
2. `TransitOutcomeLog` — populated only where a real tracking/status data source exists (flight/train status APIs where integrated); **this domain's punctuality promise is honestly gated on that integration existing** — until then, the punctuality UI element (§2.4) simply doesn't render rather than showing a fabricated percentage.
3. `seat_class_verdict` — a `PlaceInsight` targeting the route model directly (its generic FK already supports this without a schema change), synthesized from `TravelPriceHistory.details` fare-class data when present; `suggested` tier general-knowledge fallback otherwise, explicitly labeled as such in the UI.
4. `price_trend` — pure computed statistic over `TravelPriceHistory` (7-day and 30-day moving averages, direction + magnitude), not LLM-authored; the LLM's only role is turning `{direction: "down", magnitude_pct: 12}` into "this is 12% below the 30-day average," which is templated, not generated.

**AI prompt** (the one genuinely-LLM-authored piece in this domain):
```text
SYSTEM: Provide a general, well-known transfer profile for this transit hub — typical
minimum connection time and whether terminal changes are common. This is a rough
orientation note, not schedule-accurate data; say so implicitly by keeping claims general
("often requires a terminal change") rather than precise ("requires 14 minutes").

USER: Hub: {name} ({code}), city: {city}, hub_type: "airport"|"railway_station".

Return JSON: {"typical_min_connection_mins": number|null, "terminal_change_common": bool, "notes": string}
```

**API** — extends the standardized booking-provider response shape (`apps/bookings/providers/base.py`) with `transfer_details`, `seat_class_note`, `punctuality` (nullable — absent when no `TransitOutcomeLog` data exists), `station_walk_time` (from `DistanceEdge`), `price_trend`.

**Caching** — `TransferProfile`: 180-day TTL (matches the architecture plan's scheduled-route tier). Punctuality aggregate: 1-hour Redis cache, recomputed on read after expiry (cheap query, no need for a background job). `price_trend`: recomputed on every `TravelPriceHistory` write (event-driven).

---

### 1.5 Cities & Neighborhoods

> *"Which neighborhood actually suits this traveler's pace and budget. Core-walkable district vs. one that needs transit to enjoy. Local rhythm — late dinners, midday lulls, market-only days. How tourist-dense a district runs by season, honestly."*

**Data model** — extends the `Neighbourhood` model already specified in the architecture plan (§3b) rather than introducing a parallel one:
```python
# apps/knowledge/models.py — Neighbourhood gains, and adopts EnrichmentMixin
price_tier = models.CharField(max_length=10, null=True)          # $ / $$ / $$$ / $$$$, computed
pace_tag = models.CharField(max_length=20, null=True)              # "lively" / "residential" / "mixed"
walkability_score = models.FloatField(null=True)                    # 0-1, computed from DistanceEdge density
local_rhythm_notes = models.TextField(blank=True)
tourist_density_by_month = models.JSONField(default=dict)            # {"1": 0.3, "2": 0.35, ...}
```

**Enrichment pipeline**
1. `price_tier`, `walkability_score`: pure computation — median `price_range` across `HotelMaster`/`RestaurantMaster` rows within the neighbourhood radius; average walking-mode `DistanceEdge` distance between attraction/restaurant clusters. No LLM involved.
2. `local_rhythm_notes`: computed input (median opening/closing hour across `RestaurantMaster` rows in-radius) → LLM writes the one-paragraph description from those numbers, not from vibes.
3. `tourist_density_by_month`: blends `TravelSeason.season_type` with our own `EntityInteractionLog` volume trend for places in the neighbourhood, once enough history exists; before that, seeded from `TravelSeason` alone and tagged accordingly.

**AI prompt**
```text
SYSTEM: Write a neighbourhood character summary from computed statistics only — do not
add claims not supported by the numbers given. One paragraph, plain language, the kind
of thing a well-traveled friend would say, not marketing copy.

USER: Neighbourhood: {name}, city: {city}. Median restaurant hours: {hours}.
Price tier distribution: {price_dist}. Walkability score: {score}.
Dominant place categories in-radius: {category_counts}.

Return JSON: {"local_rhythm_notes": string, "vibe_tags": string[]}
```

**API** — `GET /reference/cities/{id}/neighbourhoods/` (list), `GET /reference/neighbourhoods/{id}/` (detail) — both new.

**Caching** — 30-day TTL via `EnrichmentMixin`, same as the master tables.

---

### 1.6 Weather & Seasonality

> *"What the season actually feels like to wear, not just a temperature. Rainy-season contingencies for the exact activities booked. Peak-bloom or peak-trail windows for season-specific activities. Shoulder-season trade-off: value gained vs. crowd/weather cost."*

**Data model**
```python
# WeatherNormals gains — computed, deterministic, not LLM output:
feels_like_bucket = models.CharField(max_length=20, null=True)   # derived from temp + precipitation via a lookup table
packing_note = models.CharField(max_length=255, blank=True)        # templated from feels_like_bucket

# TravelSeason gains:
natural_phenomena = models.JSONField(default=list)
# [{"name": "cherry blossom", "typical_window": ["03-25","04-10"], "year_variability_days": 7, "source": "seasonal_almanac"}]
```

**Enrichment pipeline** — this domain is deliberately the **least** LLM-dependent one in the whole layer, on purpose: a wrong packing suggestion has real consequences and the underlying data (`avg_temp_c`, `precipitation_mm`) is already real. `feels_like_bucket` and `packing_note` come from a fixed lookup table keyed on temperature/precipitation bands, not generation. `natural_phenomena` is the one part that's inherently uncertain (bloom dates shift year to year) — sourced from established seasonal-almanac data at ingest, always carrying `year_variability_days` so the UI can show a window, never a single confident date.

**Rainy-season contingencies** and the **shoulder-season trade-off** are not place-level facts at all — they're itinerary-context rules, implemented as `PlanInsight` RULES (architecture plan §11): `RainySeasonContingency` (checks a scheduled outdoor block against the travel month's `precipitation_mm`, suggests an indoor alternative) and a shoulder-season verdict folded into the existing trip-planning summary rather than a new rule, since it applies once per trip, not per block.

**AI prompt** — none new; `packing_note` is templated (`f"Pack for {feels_like_bucket}: {TEMPLATES[feels_like_bucket]}"`), not generated per city.

**API** — extends the existing `WeatherNormals`/`TravelSeason` viewsets (already present per the architecture plan's inventory) with the new fields.

**Caching** — 365-day TTL, unchanged from the architecture plan's table (static by nature).

---

### 1.7 Events & Timing

> *"A festival that closes the very street this trip is routed through. A public holiday that shuts the museum on the one day it's booked. A market that only runs Tuesdays and Fridays. Free-entry days at otherwise-paid attractions."*

**Data model** — reuses `Event` and `HolidayCalendar`, both already specified (architecture plan §3b, existing `reference` model respectively). No new models.

**Enrichment pipeline / rules** — three `PlanInsight` RULES, added to the architecture plan's `RULES` list:
- `FreeEntryToday` — already listed in the architecture plan.
- `HolidayClosureConflict` (**new**) — `HolidayCalendar` row on a scheduled day intersecting a paid attraction block with no explicit holiday-hours override on that `AttractionMaster` row. Surfaced as a warning requiring the user to verify, never an automatic removal — a wrong "it's closed" claim is worse than a missed warning.
- `RouteClosureConflict` (**new**) — an `Event` with a `venue_place_id` whose geo-point falls within a small buffer of a scheduled transit leg's `DistanceEdge` path. Also warning-only, same reasoning.

**AI prompt** — none for the rules themselves (deterministic geo/date intersection). `Event` ingestion, when LLM-researched rather than sourced from a real events feed, requires the model to state its confidence and a concrete reason in the `source` field — enforced by prompt instruction, not by a schema constraint, since `source` is free text by design (architecture plan §3b): "never fabricate an event — if you are not confident a specific date is correct, omit the event entirely."

**API** — `GET /knowledge/events/?city=&date_from=&date_to=` (new, backs both the rules above and any future events UI).

**Caching** — `Event` rows: 30-day TTL for events within the next 60 days (date/cancellation risk is real close to the date), 180-day TTL for events further out.

---

### 1.8 Safety & Culture

> *"Common scams by city, named specifically, not generalized. Area-specific after-dark judgment, not a whole-city warning. Etiquette that actually matters — tipping, temple dress, greetings. Emergency numbers and the nearest embassy, always one tap away."*

**Data model** — reuses `SafetyAdvisory`, `EmergencyContact`, `LocalTip` from the architecture plan, with `LocalTip` gaining two fields given this is the one domain where a wrong answer has real safety consequences:
```python
# LocalTip gains:
source_url = models.URLField(blank=True)          # strongly recommended for category="scam_warning"
needs_human_review = models.BooleanField(default=True)   # auto-generated safety tips are gated until reviewed
```

**Enrichment pipeline** — scam warnings and after-dark guidance are generated with `needs_human_review=True` by default and are **not surfaced to users until an operator flips it** — this is a deliberate manual gate, not a background job. Etiquette tips (lower stakes — wrong tipping advice is embarrassing, not dangerous) can auto-publish without review.

**AI prompt**
```text
SYSTEM: You are drafting a safety or etiquette note for a travel app. Only state a
specific scam pattern or safety caution if it is a well-established, commonly-reported
issue for this exact city — not a generic "be aware of pickpockets" that applies
everywhere. If you are not confident, return no tip rather than a vague one. Etiquette
notes should be specific and actionable (a number, a gesture, a garment), not general
advice like "be respectful."

USER: City: {city}, category: "scam_warning"|"after_dark"|"etiquette".
Existing tips already on file (avoid duplicates): {existing_tips}.

Return JSON: {"tips": [{"category": string, "tip_text": string, "confidence": "high"|"medium"|"low", "reasoning": string}]}
```
Only `confidence: "high"` outputs for `scam_warning`/`after_dark` are queued for human review; `medium`/`low` are discarded, not stored at a lower confidence — this domain doesn't have a "suggested tier, shown with a caveat" option the way a restaurant recommendation does, because the downside of a wrong safety claim isn't proportional to a wrong dish recommendation.

**API** — `GET /knowledge/safety/{city_id}/` (SafetyAdvisory + EmergencyContact + reviewed scam/after-dark tips), `GET /knowledge/etiquette/{city_id}/` (etiquette tips, auto-published).

**Caching** — 30-day TTL, but invalidation here is primarily operational (a human updates `SafetyAdvisory` in response to real events), not clock-driven.

---

### 1.9 Traveler Memory

> *"Dietary needs and past preferences, applied without a repeat question. Pace preference — packed days vs. slow mornings. Budget sensitivity, learned from what got booked, not just stated. Patterns from past trips this traveler actually took."*

**Data model** — **no new model.** `TravelerProfile.facts` (already shipped, per the codebase inventory: `{key, value, provenance, source_trip, updated_at}`) already covers this exactly. The gap the audit found ("engine does not yet prefill from TravelerProfile facts — facts are collected but not applied") is a wiring gap, not a schema gap, and closing it belongs in this roadmap rather than a new table. Two new fact-key conventions, documented (not enforced by schema, since `facts` is intentionally open-ended):
- `pace_preference` (`packed`/`moderate`/`slow`) — inferred, not asked.
- `budget_sensitivity` (`value`/`moderate`/`premium`) — inferred, not asked.

**Enrichment pipeline**
1. `infer_traveler_facts` — new Celery task, runs when a trip's status moves to `booked` or `completed`. Computes `pace_preference` from `items_per_day` averaged across the trip's `days` JSON (a plain aggregate, no LLM), and `budget_sensitivity` from comparing `PlanBlockCommitment.amount` totals actually committed against `TripDraftState.budget_amount` stated at planning time. Both written with `provenance='inferred'`.
2. **The actual fix**: `plan_generation.py`'s composing phase (`_compose_days`, phase 4) gains a "traveler context" block built from `TravelerProfile.facts` filtered to `provenance in ('confirmed','inferred')`, injected into the existing composing-LLM prompt. This is a prompt-injection change to an existing call, not a new one:
```text
# appended to the existing _compose_days system/user prompt:
Known traveler context (apply silently, do not ask about these again):
{traveler_facts_summary}
# e.g. "Prefers a moderate pace (3-4 activities/day). Value-conscious on transport,
# willing to spend more on dining. Vegetarian."
```

**API** — none new; existing `/planner/profile/` endpoints already expose `facts`.

**Caching** — none; `TravelerProfile` facts are durable identity data, not cached external content, and are correctly excluded from the TTL table.

---

### 1.10 Distance, Routes & Crowds

> *"Cumulative walking load across a full day, not just leg-by-leg distance. Crowd-by-hour intelligence for the exact time slot booked. Heat and elevation exposure for the route as planned. 'You'll pass this anyway' — a detour that costs nothing."*

**Data model** — no new models. This domain is almost entirely a matter of **using** what the architecture plan and §1.3 above already defined: `DistanceEdge` (walking distances + `elevation_gain_m`, already spec'd), `CrowdPattern` (§1.3), `PlaceRelationship` (`relation_type='on_route_between'`, already spec'd).

**Enrichment pipeline / rules** — three `PlanInsight` RULES:
- `OnRouteOpportunity` — already listed in the architecture plan.
- `DailyWalkLoadWarning` (**new**) — sums walking-mode `DistanceEdge.distance_km` across a day's sequential blocks; threshold informed by `TravelerProfile`'s `pace_preference` fact (§1.9) when present, a sane default otherwise.
- `HeatExposureWarning` (**new**) — flags outdoor walking segments scheduled between 11am–3pm in months where `WeatherNormals.avg_temp_c` exceeds a threshold for that city.

**AI prompt** — none; all three rules are deterministic given the underlying data.

**API** — no new endpoints; these compute at plan-generation and plan-edit time inside the existing `PlanInsightEngine` batch pass (architecture plan §11).

**Caching** — not applicable; computed fresh whenever the itinerary content changes, same trigger as the rest of `PlanInsightEngine`.

---

### 1.11 Visas & Documents

> *"The actual requirement for this traveler's passport, not a generic rule. Honest processing-time ranges, not an optimistic default. What document to carry physically vs. what's accepted digitally."*

**Data model** — extends `reference.VisaRequirement`, already designated canonical over `apps.visa.VisaData` in the architecture plan (§3c):
```python
processing_time_min_days = models.PositiveSmallIntegerField(null=True)
processing_time_max_days = models.PositiveSmallIntegerField(null=True)   # replaces the single processing_time string
document_checklist = models.JSONField(default=list)
# [{"document": "passport", "physical_required": true, "digital_accepted": false}, ...]
```

**Enrichment pipeline** — deliberately **not** LLM-primary. Visa rules are exactly the kind of fact where a plausible-sounding wrong answer is actively dangerous (this is precisely the failure mode the earlier adversarial audit found — VisaCanvas fabricating validity periods). Primary source must be a real visa-requirements data provider or dataset; where none is integrated yet, the record is created with `processing_time_min_days=null`/`max_days=null` and a UI state that says "check official source" (§2, no card in this domain fabricates a range to fill the gap). LLM involvement, if any, is restricted to phrasing already-sourced data into `document_checklist` entries, never originating the requirement itself.

**AI prompt** — none provided; explicitly out of scope for LLM synthesis in this domain, by design.

**API** — existing VisaCanvas-backing endpoint, response shape extended with the new fields (nullable).

**Caching** — 90-day TTL — shorter than static reference data since rules do change, longer than prices since they change rarely.

---

### 1.12 Photography & Experience

> *"Golden-hour timing for this exact date and location. The vantage point locals actually use, not the postcard angle. Whether a spot is more beautiful in person than in photos, or the reverse."*

**Data model** — no new models. Golden-hour/sunrise/sunset is the computed-and-Redis-cached mechanism already specified in the architecture plan §2 (astronomical calculation from lat/lng + date, never stored as a stale "fact"). `vantage_point` and `photogenic_reality_check` are `PlaceInsight` rows, produced in the **same** enrichment call as §1.3 (Attractions) — see that section's prompt, which already includes both fields. This section exists in the roadmap to confirm nothing from the vision was dropped, not to introduce parallel machinery.

**API** — same details endpoint as §1.3; golden-hour timing served from the existing computed/cached mechanism, keyed on `(lat_bucket, lng_bucket, month)`.

**Caching** — `vantage_point`/`photogenic_reality_check`: 14-day TTL, same cycle as the rest of the attraction enrichment pass. Golden-hour: Redis, 90-day TTL (deterministic, per the architecture plan).

## 2. Surface implementations

### 2.1 Hotel card — timeline node → hover

**Components**
```
plan-canvas/nodes/GenericNode.tsx                 (existing — collapsed/node state, extended)
plan-canvas/RichHoverCard/RichHoverCard.tsx        (existing — dispatches by category)
plan-canvas/RichHoverCard/HotelRichCard.tsx        (new — hotel-specific body)
plan-canvas/RichHoverCard/RoomTierBadge.tsx        (new)
plan-canvas/RichHoverCard/NoiseProfileChip.tsx     (new)
plan-canvas/RichHoverCard/GuestFitChip.tsx         (new)
```

**Data contract** — extends `SuggestionDetails` (`plan-canvas/types.ts`), which today has a loose `[key: string]: any` index signature; this replaces the loosely-typed hotel-relevant keys with:
```ts
interface HotelDetails extends SuggestionDetails {
  room_tiers?: { tier_name: string; price_premium_pct: number | null; feature_tags: string[] }[];
  noise_profile?: { verdict: string | null; basis: string };
  guest_fit?: { tags: string[]; basis: string };
  seasonal_amenities?: { amenity: string; active_months: number[] }[];
}
```

**UI states**
- **Loading** — shimmer photo block + 3 skeleton lines while `usePlaceDetails` resolves (existing hook, unchanged).
- **No `place_id`** — currently the card silently renders nothing (a real gap the frontend inventory found: `RichHoverCard` self-guards internally with no visible fallback). Fixed: a compact "basic details only" placeholder replaces the hover card entirely rather than nothing.
- **Low completeness** — when `HotelMaster.data_completeness_score < 0.5`, a small "limited info available" caption renders above the synthesis line instead of presenting thin data at full visual confidence.
- **Error** — fetch failed: retry affordance, visually distinct from the empty state above (a failure is retryable; missing `place_id` is not).
- **Populated** — the full card as shown in the vision mockup.

**Backend** — `GET /reference/places/details/?place_id=&category=hotel` (existing endpoint, enriched response per §1.1).

---

### 2.2 Restaurant card

**Components**
```
workspace/helper-canvases/shared/SuggestionCard.tsx   (existing, extended)
plan-canvas/RichHoverCard/SignatureDishBanner.tsx     (new)
```

**Data contract**
```ts
interface RestaurantDetails extends SuggestionDetails {
  signature_dish?: { name: string; mention_count: number; rationale: string } | null;
  reservation_policy?: "walk_in" | "recommended" | "required" | null;
  typical_lead_time_days?: number | null;
  local_vs_tourist?: { verdict: string; explanation: string } | null;
  dietary_accommodations?: Record<"vegetarian"|"vegan"|"gluten_free"|"halal"|"kosher", string>;
}
```

**UI states**
- **Not enough reviews for a signature dish** (`mention_count` never reaches 3) — the banner is omitted entirely, not shown with a low-confidence guess; this is a direct product decision, not an oversight, matching §1.2's extraction threshold.
- Loading/empty/error states follow the same pattern as §2.1.

**Backend** — same details endpoint, `category=restaurant`.

---

### 2.3 Attraction card — crowd intelligence

**Components**
```
plan-canvas/nodes/GenericNode.tsx        (extended for category="attraction"|"activity")
plan-canvas/CrowdMeter.tsx                (new — the bar chart)
workspace/hooks/usePlaceCrowdPattern.ts    (new)
```

**Data contract**
```ts
interface CrowdPatternResponse {
  hourly: { hour: number; level: number }[];   // 0-1
  day_type: "weekday" | "weekend" | "holiday";
  sample_size: number;
  confidence: "telemetry" | "estimated_prior";
}
```

**UI states**
- **`confidence: "estimated_prior"`** — chart renders with a visible caption: "Typical pattern — based on general data, not yet confirmed by traveler activity here." This is not hedge-copy for its own sake; it's the honest state of a cold-start attraction with no telemetry yet.
- **No data at all** (neither telemetry nor a seeded prior — rare, very obscure places) — the entire crowd-meter component is omitted, not shown empty, matching the placeholder-suppression discipline from the architecture plan.
- **Loading** — skeleton bars at uniform height, shimmer.

**Backend** — `GET /reference/places/{id}/crowd-pattern/?day_type=weekday` (new, per §1.3).

---

### 2.4 Transit node — before & after

**Components**
```
plan-canvas/nodes/TransitNode.tsx           (full rewrite — today's version is image+title+subtitle only)
plan-canvas/nodes/TransitComfortChips.tsx    (new)
plan-canvas/nodes/PunctualityIndicator.tsx    (new)
components/ProvenanceBadge.tsx                (existing, now actually used here — it wasn't before)
```

**Data contract** — extends the transit-segment branch of `ItineraryItem` (`workspace/services/planTransform.ts`'s `transitToNext` mapping), which today doesn't set `rating`, `cost`/provenance, or `place_id` at all:
```ts
interface TransitItem extends ItineraryItem {
  cost: BlockCost;                    // now actually populated + rendered — this was the audit's Critical/High finding
  transfer_details?: { location: string; typical_min_connection_mins: number | null; terminal_change_common: boolean }[];
  comfort?: { amenities: string[]; seat_class_note: string | null };
  punctuality?: { on_time_pct: number; sample_size: number } | null;   // null when no TransitOutcomeLog data exists
}
```

**UI states**
- **`punctuality: null`** — the punctuality row is omitted, not shown as "N/A" or a fabricated percentage; this domain is honestly gated on real tracking-data integration existing (§1.4).
- **Price verification** — the existing "Verify Price" gate (currently restricted to `['hotel','flight','train','bus','taxi']` in `GenericNode.tsx`) is extended to include the transit-segment card, closing the exact gap the audit flagged.
- Loading/error states follow the same pattern as other node types.

**Backend** — booking-search response shape enrichment (§1.4) flows through `blockMerge.ts` → stored block metadata → `planTransform.ts` → `ItineraryItem`. No new endpoint; this is a data-plumbing fix through an existing pipeline that currently drops these fields at the `blockMerge` hand-off.

---

### 2.5 Map interaction

**Components**
```
plan-canvas/PlannerMap.tsx                  (existing, extended)
plan-canvas/map/NeighbourhoodOverlay.tsx     (new)
plan-canvas/map/RelationshipLine.tsx          (new)
plan-canvas/map/MapHoverCard.tsx              (new — lighter-weight than RichHoverCard, tuned for map overlay context)
```

**Data contract**
```ts
interface MapIntelligenceData {
  relationships: PlaceRelationship[];    // fetched once per plan load, not per hover — keeps hover instant
  neighbourhoods: Neighbourhood[];        // for the current city only
}
```

**UI states**
- **Relationship line** — renders only while the related pin is hovered, never persistently; an explicit interaction-design constraint from the vision ("beautifully without overwhelming the user") translated into a concrete rule: nothing on the map is persistently decorative.
- **Neighbourhood shading** — off by default, toggled on via a map-layer control, not forced — some users will find it visually busy, and the vision's own standard ("without overwhelming") argues for opt-in here specifically, unlike the relationship line which is inherently transient.
- **Tooltip** — appears on pin hover, matches the mockup's card, but intentionally lighter than the full `RichHoverCard` (no photo strip, 2-3 lines max) since it's competing with the map for visual space.

**Backend** — `GET /knowledge/relationships/?workspace={id}` (new, batched for the whole plan in one call), `GET /reference/cities/{id}/neighbourhoods/` (§1.5).

---

### 2.6 AI recommendation strip

**Components**
```
plan-canvas/InsightStrip.tsx               (new — renders between NodeWrapper instances in ItineraryTimeline.tsx)
plan-canvas/InlineProposalActions.tsx        (new — compact accept/dismiss, reuses ProposalCard's isBusy pattern)
```

**Data contract**
```ts
interface PlanInsight {
  id: string;
  rule: string;              // e.g. "SunriseAdjustedTiming"
  message: string;
  related_block_ids: string[];
  action: PlanProposalDraft;  // accepting submits this exact shape to the existing proposals endpoint
  context_hash: string;
}
```

**UI states**
- **Dismissal must persist** — this is a real gap the vision mockup doesn't address but implementation must: without a persisted dismissal, "Not now" would simply reappear on next render. New model `PlanInsightDismissal(workspace FK, context_hash, dismissed_at)`; a dismissed insight is filtered server-side by `context_hash` until the underlying context changes (new `context_hash`, since it's derived from trip dates/content — dismissing doesn't mean "forever," it means "not for this version of the plan").
- **Loading** — a skeleton pill while the post-generation `PlanInsightEngine` batch pass runs; insights don't block the itinerary from rendering.
- **Accept in-flight** — button shows a spinner, matching `ProposalCard`'s existing `isBusy` pattern (reused, not reinvented).
- **Accept failure** — surfaces an inline error rather than silently resetting to idle (fixing the exact gap the audit found in `ProposalCard.tsx`'s non-409 error handling, applied here too since this component shares the mechanism).

**Backend** — `GET /planner/workspaces/{id}/insights/` (new — current active `PlanInsight` list), `POST /planner/workspaces/{id}/insights/{insight_id}/dismiss/` (new — writes `PlanInsightDismissal`), accept path reuses the existing `POST .../proposals/{id}/accept/` unchanged.

## 3. Consolidated schema diff

| Model | Change | Domain |
|---|---|---|
| `reference.HotelMaster` | + `seasonal_amenities` | 1.1 |
| `reference.HotelRoomTier` | **new** | 1.1 |
| `reference.RestaurantMaster` | + `reservation_policy`, `typical_lead_time_days`, `dietary_accommodations` | 1.2 |
| `reference.AttractionMaster` / `ActivityMaster` | + `accessibility_detail` | 1.3 |
| `knowledge.CrowdPattern` | **new** | 1.3, 1.10 |
| `reference.TransferProfile` | **new** | 1.4 |
| `knowledge.TransitOutcomeLog` | **new** | 1.4 |
| `knowledge.Neighbourhood` | + `price_tier`, `pace_tag`, `walkability_score`, `local_rhythm_notes`, `tourist_density_by_month`; adopts `EnrichmentMixin` | 1.5 |
| `reference.WeatherNormals` | + `feels_like_bucket`, `packing_note` | 1.6 |
| `reference.TravelSeason` | + `natural_phenomena` | 1.6 |
| `reference.VisaRequirement` | + `processing_time_min_days`/`max_days` (replaces `processing_time`), `document_checklist` | 1.11 |
| `knowledge.LocalTip` | + `source_url`, `needs_human_review` | 1.8 |
| `knowledge.PlaceInsight` | `insight_type` vocabulary extended: `room_tier_verdict`, `noise_profile`, `guest_fit`, `signature_dish`, `local_vs_tourist`, `occasion_fit`, `real_duration`, `hype_calibration`, `vantage_point`, `photogenic_reality_check`, `seat_class_verdict` | all |
| `knowledge.PlanInsightDismissal` | **new** | 2.6 |
| `planner.PlanInsightEngine.RULES` | + `DailyWalkLoadWarning`, `HeatExposureWarning`, `RouteClosureConflict`, `HolidayClosureConflict`, `TimeBudgetTradeoff` | 1.6, 1.7, 1.10 |

Everything else (`PlaceRelationship`, `EntityInteractionLog`, `DistanceEdge`, `Event`, `EmergencyContact`, `SafetyAdvisory`, `EntityEmbedding`) is used exactly as specified in the architecture plan — zero changes.

## 4. Rollout — mapped onto the existing K0–K5 phases

No new phase letters. Everything below is additional scope inside the phases the architecture plan already defined, sequenced by the same dependency logic.

| Phase | Adds from this roadmap |
|---|---|
| **K1 — Schema** | Every row in §3's table: new models + field migrations across `reference`, `knowledge`, `planner`. This is pure schema — no enrichment logic runs yet. |
| **K2 — Resolver + callers** | Wire the new §1 fields into `to_suggestion()`'s category-specific field builders; add `GET /reference/places/{id}/crowd-pattern/`, `GET /reference/cities/{id}/neighbourhoods/`, `GET /knowledge/events/`, `GET /knowledge/safety/{city_id}/`, `GET /knowledge/etiquette/{city_id}/`. |
| **K3 — Distance & route** | `TransferProfile` seeding; station-walk-time via `DistanceEdge`; `DailyWalkLoadWarning` + `HeatExposureWarning` rules; `price_trend` computation on `TravelPriceHistory` writes. |
| **K4 — Cards + map** | All six §2 surfaces' frontend work: `HotelRichCard`, `SignatureDishBanner`, `CrowdMeter`, the full `TransitNode` rewrite, `NeighbourhoodOverlay`/`RelationshipLine`/`MapHoverCard`, `InsightStrip`/`InlineProposalActions`. The `blockMerge.ts` plumbing fix for transit-segment `cost`/provenance (§2.4) belongs here specifically — it's a data-loss bug fix, not new capability, and should land early in K4. |
| **K5 — Embeddings, search, insight engine** | Every LLM enrichment prompt in §1 (Hotel/Restaurant/Attraction+Photography/Neighbourhood/Safety synthesis, crowd-prior seeding); `infer_traveler_facts` task + the `_compose_days` prompt-injection fix (§1.9) — this closes the specific deferred-debt item the original audit flagged; `RouteClosureConflict`/`HolidayClosureConflict`/`TimeBudgetTradeoff`/`FreeEntryToday` rules; `PlanInsightDismissal` wiring. |

**Sequencing note carried over from the architecture plan**: K2 remains the highest-risk phase. Everything in K5's prompt work depends on K1's schema and K2's resolver being in place first — there's no shortcut to skip straight to "write the prompts," since every prompt above takes computed signals (review-mined counts, z-scores, DistanceEdge densities) as input, not raw reviews alone. The domains that resisted LLM-primary design on purpose (§1.6 Weather, §1.11 Visas, most of §1.10 Distance/Routes) can ship ahead of K5 entirely, since they don't depend on the enrichment prompts at all — worth pulling forward if K5 slips.
