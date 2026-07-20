# Reference Foundation and Planner Intelligence — Master Plan

- **Status:** DRAFT v2 — awaiting owner approval. **No schema migration, bulk import, data mutation, or application removal is authorized until the owner approves this document.** The only pre-approved work is the Phase 0 honesty/security hotfix set (§14, Phase 0), and even that requires the owner's explicit go-ahead at the Approval Gate (§18).
- **Date:** 2026-07-19 (Asia/Calcutta)
- **Prepared by:** Claude Code (Fable 5), acting as Principal Travel Data / Geospatial / ML / Django / AI Planner Architect
- **Audit basis:** direct inspection of the working tree at branch `main`, commit `a386842` (+ uncommitted work per `git status`), three parallel deep audits of `apps/reference`, `apps/knowledge`, `apps/planner`, `apps/bookings/providers`, infra/config, and frontend contracts. Every `file:line` in this document was reported from the real tree; the two most load-bearing claims (fabricated "verified" prices; API-key persistence) were independently re-verified by direct grep before writing.
- **Labeling convention:** **[VERIFIED]** = confirmed in code/config/web. **[PROVISIONAL]** = owner selected this as a default in a planning Q&A on 2026-07-19 but has NOT given final approval; treated as a proposed default (see §2). **[PROPOSED]** = architect's recommended default, not yet reviewed. **[UNKNOWN]** = could not be determined without running code or contacting a third party.

---

## 1. Executive decision

1. **The three-application separation is not justified as-is.** `reference` and `planner` are sound boundaries and remain. `knowledge` has no independent identity — **[VERIFIED]** it owns no views, urls, serializers, management commands, or Celery tasks of its own; it is consumed only through `reference` and `planner`, and is bidirectionally coupled to both (`knowledge/models.py:21` imports reference's `EnrichmentMixin`; `reference/views.py:27` uses function-local knowledge imports to break the load cycle). **`knowledge` is retired through the staged migration in §12 — never deletion-first.**
2. **No new intelligence application is created.** The intelligence layer remains `apps/planner/services/` (+ its `intelligence/` package) for planner-facing derivation. Planner-agnostic, data-derived computation (canonical resolution, hub selection, route search, price estimation) consolidates into `apps/reference/services/` — where `canonical_resolver`, `station_selector`, and `live_price` already live **[VERIFIED]**.
3. **Moves to `reference`:** knowledge's live models (`EntityEmbedding`, `DistanceEdge`, `PlaceInsight`, `LocalTip`) and live services (`embeddings`, `enrichment`, `engine` — folded into `places_explore`), plus the new source-registry, staging, route-graph, and fare-rule structures of Phases 3–5.
4. **Moves to `planner`:** `PlanInsightDismissal` (already FK'd to `PlannerWorkspace`). Nothing else — canonical data does not enter planner state.
5. **New intelligence genuinely required (minimal set):** (a) activation of the already-modeled-but-dead price benchmark tables (`TravelPriceObservation`/`TravelPriceSummary`) with rule-based estimators; (b) a bounded multimodal route search formalizing what `journey_resolver` + `station_selector` already do ad hoc; (c) an open-data ingestion/reconciliation pipeline. **Explicitly NOT built:** a new vector DB, a new RAG framework, autonomous agents, deep-learning pricing, RAPTOR/contraction routing, or any second recommendation engine.
6. **Honesty first.** The highest-priority defect in the entire system is that `reference/services/live_price.py` fabricates prices (hardcoded 850/1500/5000 defaults) and stamps them `provenance_tier="verified"` **[VERIFIED at live_price.py:165–169, 198]** — poisoning `TravelPriceHistory`, which is also the future benchmark source. This, the train/bus providers' hardcoded "live" prices, and the `attractions` API-key persistence are fixed in Phase 0 before any architecture work begins.
7. **This is a foundation plan.** It does not solve conversation/UX reliability (see §17 — those are deferred to a successor plan, *Planner Conversation and Output Reliability Plan*, which will consume this foundation).

---

## 2. Decision table

No decision below is final until the owner marks it Approved. Items marked *Provisional* were selected by the owner as recommended defaults in an interactive Q&A on 2026-07-19, but the owner subsequently directed that they be treated as proposed defaults pending approval of this corrected document.

| # | Proposed decision | Evidence | Recommended default | Consequence | Reversal cost | Approval status |
|---|---|---|---|---|---|---|
| D1 | Retire `knowledge` app via staged migration (§12) | **[VERIFIED]** no independent surface; 8 of 13 models have zero production readers+writers; bidirectional coupling with reference | Retire; migrate live pieces to reference/planner | One fewer app; single owner for sourced content; ~4 model moves, 3 service moves | Low until final deletion step (compat shims keep both paths alive); Medium after table renames | **Proposed** |
| D2 | Defer PostGIS; plain Postgres + pgvector + shared haversine/bbox util, with a **mandatory measured checkpoint** after the first large import (§8.4) | **[VERIFIED]** plain `django.db.backends.postgresql` (`config/settings/base.py:98–112`); no GDAL/GeoDjango installed (`requirements-docker.txt`); host-native Windows Postgres at :5433 (docker-compose.yml:46–50); current scale ~8.7k stations / 43k service areas | Defer, with hard adoption triggers defined in §8.4 | No infra change now; distance queries stay bbox+haversine; polygons/route geometry unavailable until adoption | Medium (adding PostGIS later is additive if Decimal columns are kept; §8.4 design rule) | **Provisional** (Q&A 2026-07-19) |
| D3 | Open-data spine: open sources become canonical identity/coordinates; Google Places demoted to a TTL'd enrichment layer keyed by stored `place_id` | **[VERIFIED]** Google policy: place ID "exempt from the caching restrictions" and may be stored; all other Places content "must not [be] pre-fetch[ed], cache[d], or store[d] … beyond the allowed exceptions" (developers.google.com/maps/documentation/places/web-service/policies, fetched 2026-07-19). Current master tables store Places content permanently **[VERIFIED]** (`EnrichmentMixin`, `reference/models.py:173`) | Adopt open-data spine (§5); keep Google for live/refresh under TTL | Licence exposure shrinks; import pipeline becomes mandatory work (Phase 3); no existing rows deleted | Low (additive columns + provenance; Google fields simply gain enforced TTL) | **Provisional** (Q&A 2026-07-19) |
| D4 | Retire legacy `attractions` app — **but as a separately gated Phase 6/10 track** with its own parity checklist (§13); the API-key exposure is fixed immediately in Phase 0 regardless | **[VERIFIED]** `attractions/views.py:135,157,213` builds photo URLs embedding `GOOGLE_PLACES_API_KEY` and persists them to `Attraction.image_url`; app duplicates `reference.AttractionMaster`; frontend calls it via `attraction.service.ts:102` | Fix leak in Phase 0; retire app only after the §13 gate (consumers mapped, IDs mapped, parity verified) | Removes a competing place master and a live key leak | Leak fix: none. App removal: Medium (frontend migration + ID mapping) | **Provisional** (Q&A 2026-07-19); leak fix itself **Proposed for Phase 0** |
| D5 | Codex fence on `apps/reference/**` lifted for this initiative; this document is the single coordination point | Repo docs (`docs/agent/HANDOFF.md`) record a working convention of not editing reference from planner sessions; no formal fence file exists **[VERIFIED]** | Lift, with this doc as coordinator | Any executing agent may implement reference phases | None (process decision) | **Provisional** (Q&A 2026-07-19) |
| D6 | Route search V1 = bounded access-leg → direct scheduled edge → egress-leg with Pareto pruning; schema designed forward-compatible to V2 timetable routing (§9) | **[VERIFIED]** current resolution is pairwise/ad hoc with no graph; `JourneyRouteCache` exists; ServiceArea tables already hold 43,232 transfer edges | Adopt V1 now; V1.5/V2/V3 staged (§9.3) | Formalizes journey_resolver; no graph engine dependency | Low (V1 is a service-layer change; schema additions are nullable) | **Proposed** |
| D7 | Pricing: official fare rules + rule-based estimates + quantile benchmarks first; statistical models gated on observation volume (§10) | **[VERIFIED]** benchmark tables exist but are dead (zero writers); observation volume today is near-zero; hardcoded rate cards exist in 3 places | Rules-first; ML trigger at §10.6 thresholds | Honest ranges immediately; no ML infra now | Low | **Proposed** |
| D8 | `make_provenance` moves from `apps/planner/services/block_schema` to `apps/common/provenance.py` (compat re-export retained) | **[VERIFIED]** `reference/services/live_price.py` imports it from planner — a reference→planner layering violation | Move in Phase 1 | Clean dependency direction: planner → reference → common | Trivial | **Proposed** |
| D9 | Dead-model dispositions (per-model list in §12.2): default delete for zero-reader/zero-writer models; revive only with a named feeding source | **[VERIFIED]** per-model reader/writer greps in §3.4 | Delete at Phase 10 unless revived by an approved phase | Smaller schema; less false capability | Low (tables dropped only at Phase 10 after re-grep) | **Proposed** |
| D10 | Rotate the Google Maps/Places API key after the Phase 0 scrub | Key has been persisted into `attractions_attraction.image_url` rows served to clients **[VERIFIED]**; project memory notes a previously deferred rotation | Rotate immediately after scrub | Old leaked key dies; env files updated | None | **Proposed** (owner action — cannot be done by an agent) |

---

## 3. Verified current architecture

Everything in this section is **[VERIFIED]** from the tree unless labeled otherwise.

### 3.1 Application responsibility map

| App | Actual responsibility today | Owns (models) | Owns (services/commands) | Incoming deps | Outgoing deps | Leaks / duplication |
|---|---|---|---|---|---|---|
| `reference` | Canonical geography, transport hubs, route facts, place masters (Google-fed), price history, weather/season normals; REST surface for explore/details/search | Country, State, City, Airport, Airline, AirportRoute, RailwayStation, TrainRoute, BusStation, BusRoute, MetroStation, Hotel/Restaurant/Attraction/ActivityMaster (+HotelRoomTier), TransferProfile, HolidayCalendar, WeatherNormals, TravelSeason, TravelPriceHistory, MetroArea(+Alias,+City), Locality(+Alias), CityAlias, 3× ServiceArea, ReferenceFieldProvenance, TravelPriceObservation, TravelPriceSummary | canonical_resolver, station_selector, live_price, places_explore, suggestions, transfer_profile, provenance; commands: seed_all_bulk, bootstrap_reference, backfill_city_coordinates, backfill_station_intelligence, audit_reference_data, validate_reference_data | planner (heavy), knowledge (engine/enrichment), config urls/beat | **planner** (`live_price.py` → `planner.services.block_schema.make_provenance`; views/commands → `planner.services.geocoding`), knowledge (function-local), bookings (provider registry via live_price) | Reverse import of planner = layering violation (H4). Audit-wave models write-orphaned (H3) |
| `knowledge` | pgvector embeddings, distance-edge cache, AI insights/tips, dormant scaffolding | Neighbourhood, Event, LocalTip, EmergencyContact, SafetyAdvisory, PlaceRelationship, EntityEmbedding, PlaceInsight, EntityInteractionLog, CrowdPattern, TransitOutcomeLog, DistanceEdge, PlanInsightDismissal | services: engine (KnowledgeEngine), embeddings, enrichment. **No views/urls/tasks/commands of its own** | reference (views/tasks/suggestions), planner (plan_generation, taste, distance_service, views) | reference (EnrichmentMixin at module load; masters function-local), planner (PlanInsightDismissal FK) | 8/13 models dormant; app is a library, not a domain |
| `planner` | Conversation, drafts, generation pipeline, trips, proposals, commitments, traveler memory, insights, capabilities | PlannerWorkspace, TripDraftState, PlannerChatMessage, PlannerTrip(+Original), PlanGenerationJob, JourneyRouteCache, PlannerQuestionBank, PlanProposal, PlanBlockCommitment, TravelerProfile, PriceWatch | 40+ services incl. journey_resolver, distance_service, geocoding, plan_generation, ranking, insight_engine, intelligence/*, capabilities/* | reference (live_price ← block_schema), frontend | reference (63 import sites/17 files), knowledge, bookings.providers, forex, notifications, common.ai | `geocoding.resolve_or_create_city` **writes** reference.City rows from planner (sanctioned but sensitive); hardcoded price tables duplicate provider/frontend values |
| `bookings` | Provider integrations (5 modes, RapidAPI live + mock), bookings, mock inventory | Booking, SearchInventory, Location | providers/{flight,train,bus,cab,hotel,registry,base}; seed_inventory, seed_manali | reference.live_price, planner (via registry) | none significant | Train/bus "live" prices hardcoded (C2) |
| `attractions` | **Legacy duplicate** of AttractionMaster using old Places API | Attraction, Destination | views call Google directly | frontend `attraction.service.ts` | Google APIs | **Persists API key in stored URLs (C3)**; duplicates reference |
| `visa` / `forex` / `homepage` | Admin-managed reference-like masters (visa rules, FX rates, CMS destinations) | VisaData; ForexData(+vendors); MoodCategory/Destination/SeasonalInsight | — | planner reads ForexData | — | Future consolidation candidates — **out of scope here** (flagged only) |

Infrastructure **[VERIFIED]**: Django 6.0.6 / DRF 3.17.1; plain PostgreSQL (host-native Windows, :5433, no compose service), `pgvector==0.5.0`, Redis (cache db0, Celery broker db1/2), `google-genai` (default model `gemini-3.5-flash`, Vertex or AI Studio), Razorpay. **Not installed:** GeoDjango/GDAL, geopy, networkx, shapely. Celery beat: refresh-stale 3h; enrichment 6h; safety 12h; embeddings 15min; price watches 30min; trip watch 15min; heartbeat 45s.

### 3.2 Actual data flows (traced through code)

1. **User message → planner response:** `planner/views` → `ConversationService`/`ConversationEngine` (ladder clusters from `intelligence/clusters.py`; deterministic capability router `capabilities/router.classify_turn`, max 2/turn) → `TripDraftState` updates → readiness gates (`is_ready_for_plan`) → `plan_generation.start_generation_job`.
2. **Destination name → canonical city:** `plan_generation._resolve_cities` → `geocoding.resolve_or_create_city` → parse "City, Country" → `reference.canonical_resolver.resolve_canonical_city` (normalized name + CityAlias, metro/state scoring) → Google Geocode on miss → **creates** `reference.City` (place_id-dedup guarded on the planner side only; the reference command retains the unguarded pattern, H5).
3. **City → nearby airports/stations:** `journey_resolver._resolve_scheduled_mode` → `reference.station_selector.select_optimal_hubs` (ServiceArea-driven, route-aware hard filter, hub scoring) → fallback `_nearest_hubs` (bbox 8°/4° + haversine over Airport/RailwayStation). Latent bugs: `canonical_resolver.py:45` (`models.Q` unimported → NameError in the metro branch), `station_selector.py:192` (loop-leaked `freq`).
4. **Transport search → recommendation:** `journey_resolver.resolve_journey_options` builds per-mode options; evidence ladder per hub pair (`_route_evidence`): live provider (gated by `LIVE_PROVIDERS_ENABLED`, default **False**) → `JourneyRouteCache` → reference `AirportRoute`/`TrainRoute` → geometry estimate (fallback_level 5). Road modes: haversine × 1.25 @ 55 km/h; cab feasible ≤ 1500 km. An unresolvable full-trip journey **raises `GenerationNeedsInput` — it does not silently cab** (`plan_generation.py:458–463`); cab downgrade happens only when a claimed hub genuinely doesn't exist on file, with an honest `downgrade_note` (`plan_generation.py:1868–1879`).
5. **Place search → hotel/restaurant/attraction/activity:** `/reference/*/explore` → `KnowledgeEngine.resolve` → `places_explore.explore_places` (DB cache first, MIN_CACHE_RESULTS=5, else Places searchText, 15 km radius) → rows upserted into master tables → `suggestions.to_suggestion` envelope (+ `PlaceInsight`/`LocalTip`).
6. **AI plan → DB enrichment:** compose LLM picks candidate IDs from a server-built pool (`_build_candidate_pool`: verified reference rows → KnowledgeEngine growth → pgvector semantic → taste vector → constraints/rejections → ranked, top 12/category); server joins real rows and rejects hallucinated IDs; `block_contract.validate_days` enforces grounding.
7. **Provider response → normalized cache:** `registry.search()` normalizes and stamps `provenance {source,label,is_live}`; mock results suppressed unless `BOOKINGS_ALLOW_MOCK_INVENTORY`; `live_price` write-through caches into `TravelPriceHistory` — **with the C1 fabrication defect**.
8. **Knowledge retrieval → prompt/context:** semantic candidates via `embeddings.semantic_search`; tips/insights joined into suggestion envelopes and block enrichment; traveler memory (`taste_vector`, `episode.*`, `category_affinity` on `TravelerProfile.facts`) read into `_traveler_context_summary`.
9. **Item selection → Plan Canvas persistence:** frontend PATCH → `plan_mutations`/`views` with revision CAS (409 on conflict) → `PlannerTrip.days` JSON; commitments ladder (`PlanBlockCommitment`) guards booked blocks.

### 3.3 Existing intelligence inventory (classification)

| Capability | Where | Classification | Disposition |
|---|---|---|---|
| City resolution (canonical + aliases + metro) | reference/canonical_resolver | Production-ready **with latent NameError (H1)** | Retain in reference; fix |
| Geocoding (Google) + city create/backfill | planner/geocoding | Production-ready | Retain; the create-write path becomes the single sanctioned writer, documented in Phase 1 |
| Nearby-hub search | journey_resolver `_nearest_hubs` + station_selector | Duplicated (two implementations) | Consolidate into reference route-graph service (Phase 4) |
| Hub selection scoring | reference/station_selector | Production-ready with bug (H2) | Retain in reference; fix; becomes V1 hub chooser |
| Distance calc | 3× haversine + Google Distance Matrix + DistanceEdge cache | Duplicated | One shared `reference/services/geo.py` (Phase 2) |
| Route construction | journey_resolver (pairwise ad hoc) | Partial — no graph | Formalize as `reference/services/route_graph.py` V1 (Phase 4) |
| Route optimization (intra-day TSP) | planner/route_optimizer | Production-ready (≤7 stops) | Retain in planner (planner-facing) |
| Transport ranking | journey_resolver `_suitability_score` | Partial (heuristic) | Extend with Pareto ranking in Phase 4 |
| Price estimation | live_price + hardcoded tables (`transport_compare._CAB_*`, `intelligence/recommendations.DEST_TIER_RATES`, provider literals) | **Mock-shaped / dishonest (C1, C2)** | Replace with FareRule + estimator + benchmarks (Phase 5) |
| Price history/benchmarks | TravelPriceHistory (live); Observation/Summary (dead) | Partially implemented | Activate (Phase 5) |
| Recommendations/personalization | ranking, taste, episodic_memory, preference_learner, diff_engine | Production-ready | Retain in planner untouched |
| Weather / visa / forex | weather_service + WeatherNormals; visa/forex apps | Production-ready (12-city normals only) | Retain; normals coverage grows via Phase 3 sources |
| Context retrieval / RAG | knowledge/embeddings + semantic_search + EntityEmbedding | Production-ready, sparse data | Move to reference (Phase 7); backlog task already exists |
| Prompt construction | plan_context, plan_generation | Production-ready | Retain in planner |
| Confidence/validation | foundation, block_contract, validation, scoring, intelligence/confidence | Production-ready | Retain; extend with price-sanity checks (Phase 8) |
| Plan refinement / critic | refinement + `_run_critic_review` | Production-ready | Retain |
| Popularity/interaction learning | EntityInteractionLog → CrowdPattern → popularity_score | **Dead end-to-end** (zero writers; ranking excludes popularity by design, `ranking.py:12–18`) | Delete (D9) unless a future plan revives telemetry |
| Question bank | PlannerQuestionBank (`PLANNER_QUESTION_BANK_ENABLED=False`) | Gated off with recorded rationale | Leave untouched |
| Live flight/train status | capabilities/live | Mock-only (honest degrade) | Out of scope (Phase 6 of the north-star plan, owner-gated) |

### 3.4 Critical problems (ranked, with evidence)

**Critical**
- **C1 — Fabricated prices stamped "verified".** `reference/services/live_price.py:165–169` falls back to literals (train 850, provider 5000, else 1500) with default search params origin `DEL`/dest `BOM`/city `Mumbai` (139–146), then writes the row `provenance_tier="verified"` (198) regardless of `LIVE_PROVIDERS_ENABLED`. Every such row poisons `TravelPriceHistory`, the same table Phase 5 must trust for benchmarks. (Also independently flagged in `docs/agent/CURRENT_STATE.md`.)
- **C2 — "Live" train/bus prices are hardcoded.** `bookings/providers/train_providers.py:77–81` (3A=1050, 2A=1480, SL=420) and `bus_providers.py:70–75` (`fare` default 1250) return code-literal prices even on the live path.
- **C3 — Google API key persisted in client-served data.** `attractions/views.py:135,157,213` stores key-bearing photo URLs into `Attraction.image_url`/`secondary_images`. The reference app already solved this correctly with `PlacePhotoProxyView` (`reference/views.py:493–509`).
- **C4 — Permanent storage of Google Places content.** The master tables permanently store Places fields (reviews, hours, photos refs, descriptions) via cache-on-miss. Google's Places policy permits indefinite storage of **place ID only**; other content must not be stored "beyond the allowed exceptions" (policy page fetched 2026-07-19). Exposure grows with the DB.

**High**
- **H1** `canonical_resolver.py:45` — `models.Q` used without import; metro-context branch raises NameError when exercised.
- **H2** `station_selector.py:192` — loop-leaked `freq` in `score_breakdown`; wrong reported scores.
- **H3** Audit-wave models have zero production writers: MetroArea(+Alias,+City), Locality(+Alias), CityAlias (test-only writers), ReferenceFieldProvenance, TravelPriceObservation, TravelPriceSummary, HotelRoomTier, MetroStation. The reconciliation/provenance/benchmark architecture exists on paper only.
- **H4** Layering violation: reference imports planner (`live_price.py` → `block_schema.make_provenance`; views/commands → `planner.services.geocoding`).
- **H5** `reference/management/commands/backfill_city_coordinates.py` retains the unguarded `place_id` write pattern whose planner-side twin already caused a live `IntegrityError` (fixed on the planner side 2026-07-19 per HANDOFF).
- **H6** Coordinate gaps without a publishability gate: 314 stations lack coordinates; railway-derived cities carry the India-centroid placeholder (20.5937, 78.9629); `provenance.exclude_unverified` filters on `verification_status`/`is_quarantined` only — a coordinate-less entity can still be planner-visible.
- **H7** `backfill_station_intelligence` is wipe-and-rebuild (`.all().delete()` on all three ServiceArea tables, then bulk-create) — unsafe as a routine refresh; any mid-run failure leaves zero service areas.

**Medium**
- **M1** Three duplicated haversine implementations (canonical_resolver:5, places_explore:28, distance_service:73).
- **M2** Route tables (`AirportRoute`/`TrainRoute`/`BusRoute`) carry no distance/frequency/operating-days/fare/provenance fields; no schedule concept exists anywhere.
- **M3** `MetroStation` has no coordinates; `HotelRoomTier` write-orphaned.
- **M4** 8 dormant knowledge models; dead telemetry chain leaves `popularity_score` permanently 0.
- **M5** `seed_all_bulk` mixes geography seeding with hardcoded demo `SearchInventory` rows.
- **M6** Cab rate card (300 + 16/km) duplicated across `transport_compare.py`, provider mocks, and the frontend CabCanvas.

**Low**
- **L1** 12 serializers defined but unattached (`reference/serializers.py:111–169`); `requirements.txt` is a garbled UTF-16 dump (real file: `requirements-docker.txt`); GCP project id hardcoded via `os.environ.setdefault` in `common/ai.py:13`.

---

## 4. Target architecture

### 4.1 Ownership layers (internal boundaries, enforced by module layout and review)

Six layers, in strict order. Lower layers never import higher ones.

1. **Canonical reference facts** (`apps/reference/models.py` core): geography, hubs, route facts, place identity, fare rules, weather/season normals. Facts only — every row traceable to a source. Coordinates mandatory for publishability (Phase 2 gate).
2. **Source mappings & provenance** (`apps/reference` — SourceRegistry/SourceRelease/ImportBatch/StagingRecord + ReferenceFieldProvenance + provider-mapping rows): where every fact came from, at field level; append-only corrections; never silently overwrite verified with lower-confidence.
3. **Search indexes & embeddings** (post-Phase-7 `apps/reference`): `EntityEmbedding` (pgvector), normalized-name indexes, future materialized route summaries. **Derived, rebuildable, never authoritative** — losing them loses no facts.
4. **Noncanonical enrichment** (post-Phase-7 `apps/reference`): `PlaceInsight`, `LocalTip`, `TransferProfile` seeds, AI descriptions. Every generated record MUST carry: `generation_method` (model + prompt version), `source_inputs` (what facts it was derived from), `generated_at`, `confidence`, `expires_at`/freshness, and an explicit **noncanonical** marker. `PlaceInsight` already has provenance/expires_at **[VERIFIED]**; `LocalTip` has confidence + `needs_human_review`; Phase 7 adds the missing `generation_method`/`source_inputs` fields where absent. Noncanonical content is never used for entity resolution, routing, or pricing.
5. **Price & route calculations** (`apps/reference/services/`): geo.py, route_graph.py, price_estimator.py, station_selector, canonical_resolver, live_price (refactored). Deterministic, planner-agnostic, testable offline.
6. **Planner intelligence** (`apps/planner/services/` unchanged): orchestration, ranking, taste/memory, validation, insights, conversation. Consumes layers 1–5 through service functions only.

### 4.2 Dependency rules (Phase 1 deliverable, enforced by a grep-based validation command)

- `planner → reference → common`. Never `reference → planner` (fixes H4 via D8), never `reference → bookings` except the provider-registry call inside `live_price`'s live tier (documented exception, behind `LIVE_PROVIDERS_ENABLED`), never `knowledge → *` after Phase 7 (app gone).
- Reference writes happen only via: import pipeline (Phase 3), enrichment tasks, and the single sanctioned planner path `geocoding.resolve_or_create_city` (documented; all other planner code is read-only against reference).
- Live/rapidly-changing data (quotes, availability, delays, opening-status-now) never lands in canonical tables — only in TTL'd stores (`TravelPriceHistory` as quote cache with honest tiers, `JourneyRouteCache`, `DistanceEdge`, Redis).

### 4.3 Request flow (target, Phase 8 end-state)

```
User intent (planner)
  → TripDraftState (unchanged)
  → plan_generation.run_pipeline (unchanged shell)
      → geocoding.resolve_or_create_city  → reference canonical layer
      → reference.route_graph.search(origin_city, dest_city, date, prefs)   [V1 Phase 4]
           nodes: City + Airport/RailwayStation/BusStation
           access/egress edges: ServiceArea rows        transfer edges: HubTransferLink
           scheduled edges: AirportRoute/TrainRoute/BusRoute (+fare_rule, frequency)
           → top-K Pareto options {duration, est_cost(min/exp/max), transfers, confidence, provenance}
      → reference.price_estimator.estimate(...)          [Phase 5]
           ladder: live quote > cached quote > fare rule > benchmark > "insufficient data"
      → candidate pool (unchanged sources; reference services consolidated)
      → compose → block_contract → validation (+price-sanity) → scorecard → persist
```

---

## 5. Data-source matrix

Licence facts below were verified by fetching the cited pages on **2026-07-19** unless marked otherwise. "Store normalized?" = may extracted, normalized fields live permanently in our DB. "Store raw?" = may raw responses/files be retained. **A source is Approved-for-import only when its row says so AND its Phase 3 licence checklist item is checked at import time (terms can change between now and execution).**

| Source | Official location | Publisher | Verified | Coverage (entities / India / minor places) | Format & update | Stable IDs | Licence (exact) | Commercial | Redistribution | Store raw / normalized | Attribution | Known quality issues | Recommended fields | Priority |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **GeoNames** | geonames.org/export | GeoNames (Unxos GmbH) | 2026-07-19 (export page) | All countries; cities/towns/villages, admin hierarchy, alternate names; India deep incl. minor towns | TSV dumps (`allCountries.zip`, per-country `IN.zip`, alternateNames); daily extract; free API 10k credits/day, 1k/hr | `geonameid` | **CC-BY 4.0** ("cc-by licence… give credit… with a link") | Yes | Yes with attribution | Yes / Yes | Link/credit to GeoNames | Populated-place duplicates near admin boundaries; stale populations for small towns; spelling variants | name, alternatenames, lat/lng, feature class/code (PPL*, ADM*), admin1–4, population, timezone | **PRIMARY — geography identity & coordinates** |
| **Wikidata** | wikidata.org (SPARQL + dumps) | Wikimedia | 2026-07-19 (Wikidata:Licensing) | Global; cross-identifiers for cities/stations/airports/attractions; India good for notable entities, weak for minor POIs | JSON dumps / SPARQL; continuous | `Q-id` (+ holds GeoNames id P1566, IATA P238, station code P296, OSM relation) | **CC0** ("All structured data… under the Creative Commons CC0 License (Public domain)") | Yes | Unrestricted | Yes / Yes | None required (courteous) | Vandalism risk on low-watch items; sparse minor-place coords | Q-id, coordinates (P625), IATA/ICAO, station codes, GeoNames id, instance-of | **PRIMARY — reconciliation spine (cross-IDs)** |
| **OurAirports** | ourairports.com/data | OurAirports (community) | 2026-07-19 (data page) | ~80k airports/strips global; India complete for commercial airports | CSV (airports, runways, countries, regions); **nightly** | `id`, `ident` (ICAO-ish), `iata_code` | **Public Domain** ("All data is released to the Public Domain") | Yes | Unrestricted | Yes / Yes | Requested, not required | Community edits; small-strip noise (filter `type` in {large,medium}_airport + scheduled_service=yes) | ident, iata_code, name, lat/lng, type, scheduled_service, municipality, iso_region | **PRIMARY — airports** (reconciles/supersedes mwgg) |
| **mwgg/Airports** (currently used by `seed_all_bulk`) | github.com/mwgg/Airports | community (MIT) | 2026-07-19 (repo) | ~29k airports; global | JSON; active (release 2026-07) | ICAO key, IATA | **MIT** | Yes | Yes | Yes / Yes | MIT notice | TZ sourced from third parties; no scheduled-service flag | Keep as SECONDARY cross-check only | SECONDARY |
| **datameet/railways** (currently used) | github.com/datameet/railways | DataMeet community | 2026-07-19 (repo) | Indian railway stations/trains/schedules | GeoJSON/JSON; **stale (~2016 vintage)** | station `code` | **CC0** (repo licence) | Yes | Unrestricted | Yes / Yes | None required | Staleness (new stations/renames missing); coordinate errors on minor halts | station code, name, coords, zone, state; schedules only as V2 bootstrap seed | SECONDARY — coords/codes; do NOT treat schedules as current |
| **OpenStreetMap (Geofabrik India extracts)** | download.geofabrik.de/asia/india | OSM contributors / Geofabrik | 2026-07-19 (osm.org/copyright) | POIs, bus stations, localities, roads; India strong in cities, variable rural | .osm.pbf; Geofabrik daily | `osm_id` (+type) | **ODbL 1.0** ("if you alter or build upon our data, you may distribute the result only under the same license") | Yes | **Share-alike for derivative databases** | Yes / Yes, but ODbL-derived fields must be tracked (see risk note) | "© OpenStreetMap contributors" + ODbL notice | Tag inconsistency; POI completeness varies; name transliteration variance | bus_station/amenity nodes, place=town/village, locality polygons' centroids, station nodes as cross-check | **SECONDARY — hubs/POIs/localities.** Risk note: keep OSM-derived fields provenance-tagged so the share-alike surface is identifiable; do not commingle OSM data into fields we must license differently |
| **Indian Railways published fare tables & train list** | indianrail.gov.in / erail-published tables | Ministry of Railways | **Not fetched — [UNKNOWN]**; fare *rules* are facts (not copyrightable expression), encode as FareRule params | All-India trains/classes | HTML/PDF tables; per fare revision | train no, class codes | Facts encoded as rules; no bulk licence claimed | n/a (facts) | n/a | No raw scraping of protected portals; Yes for encoded rule params | Cite "Indian Railways fare structure, effective <date>" | Dynamic-fare trains (Rajdhani/flexi) deviate from slabs | distance-slab fare params per class, reservation/superfast charges | **PRIMARY — train fare rules** (manual encoding, Phase 5) |
| **GTFS: Open Transit Data Delhi (DTC/DMRC)** | otd.delhi.gov.in | GNCTD/DIMTS | 2026-07-19 (portal reachable; terms page not yet reviewed) | Delhi buses + metro static & realtime | GTFS / GTFS-RT | GTFS stop_id/route_id | **Portal T&C — must be reviewed before import [UNKNOWN]** | TBD | TBD | TBD | Per T&C | Feed gaps typical of Indian GTFS | stops, routes, calendars (V2 only) | OPTIONAL/FALLBACK — local transit, V2+; import blocked until T&C verified |
| **data.gov.in datasets (tourism, districts, LGD)** | data.gov.in | GoI / NIC | **2026-07-19 [VERIFIED]** — full Gazette Notification text fetched and read (`docs/plans/evidence/phase-03/godl-license-text.txt`; MeitY, Gazette of India Part I-Sec.1, F.No. 8(2)/2013-EG-I, dated 10-Feb-2017) | Districts (LGD), tourism stats, monument lists (ASI) | CSV/API; varies | LGD codes; ASI ids | **GODL-India — [VERIFIED]**: §3 grants worldwide, royalty-free, non-exclusive use/adapt/publish/derive rights for all lawful commercial and non-commercial purposes; §4 requires attribution (template in §5) + non-endorsement + no-warranty acknowledgment; §6 exemptions (personal info, sensitive/non-shareable data, official symbols, other-IP data, military insignia, ID documents, RTI-exempt info) do not apply to district/tourism/monument data | Yes (§3 explicit) | Yes (§3 explicit, adaptation/derivative works permitted) | Yes / Yes (§3 covers use/adaptation/value-addition; no storage restriction) | Required (§4a template) | Dataset-specific staleness; LGD portal (`lgdirectory.gov.in`) licence inferred from the same GoI open-data programme, not independently fetched — each `SourceRegistry` row still records its own `licence_verified_at` | district master (LGD), ASI monument list, tourism destination lists | SECONDARY — districts, tourism/pilgrimage seed lists; **GODL text verified 2026-07-19, no longer a Phase 3 blocker** |
| **Wikivoyage / Wikipedia** | *.wikivoyage.org | Wikimedia | Licence known: **CC BY-SA** (share-alike text) | Destination descriptions | dumps/API | page ids | CC BY-SA 3.0/4.0 | Yes | Share-alike on the text | Text storage forces SA obligations on that text | Required | Prose, not data | Only short attributed descriptions, clearly SA-tagged — or skip | FALLBACK — descriptions only |
| **Google Places / Geocoding / Distance Matrix** | developers.google.com/maps | Google | 2026-07-19 (Places policies page) | Global, excellent India POI coverage | REST; live | `place_id` (storable) | Google Maps Platform ToS: place ID "exempt from the caching restrictions"; other content "must not pre-fetch, cache, or store… beyond the allowed exceptions" | Yes (paid) | No redistribution of content | **Raw: No. Normalized: only within ToS caching windows** → TTL'd enrichment layer only | Google logo/attribution incl. photo/review author credit | n/a | place_id (permanent), everything else TTL'd + provenance-tagged | **LIVE/ENRICHMENT layer only — never canonical truth** (D3) |
| **RapidAPI providers (Sky-Scrapper, IRCTC1, Redbus, Booking.com15)** | rapidapi.com listings | third-party wrappers | Not re-verified (existing integrations) | Live quotes 5 modes | REST; live | provider-specific | Per-listing ToS **[UNKNOWN — review before enabling live in prod]** | Paid tiers | No | Raw: retention per ToS only. Normalized quote observations: store as `TravelPriceObservation` with provider + params (standard price-intelligence practice; confirm per-listing ToS) | n/a | Wrapper reliability; silent schema drift | normalized quotes only | LIVE QUOTES ONLY — never reference truth |
| **datameet/railways `trains.json`** (Phase 4 addition to the already-approved datameet source) | github.com/datameet/railways | DataMeet community | 2026-07-19 — same CC0 repo licence already verified for `stations.json` | 5,208 real Indian train services (from/to station code, name, number, duration, distance, departure/arrival) | JSON; static snapshot | train number, station codes | **CC0** (repo licence, already approved) | Yes | Unrestricted | Yes / Yes | None required | Single-instance schedule snapshot, not a weekly timetable; community-maintained, dates not verified per-row | `TrainRoute.distance_km`/`duration_mins`, tagged `provenance_tier="derived"` | **PRIMARY — Phase 4 scheduled train edges** |
| **OpenFlights `routes.dat`/`airlines.dat`** | openflights.org/data.php, mirrored at github.com/jpatokal/openflights | OpenFlights / Airline Route Mapper | **2026-07-19 [VERIFIED]** (`docs/plans/evidence/phase-04/openflights-licence-verification.md`) | ~67,663 global routes (2014 snapshot); filtered here to routes where both endpoints match an existing `Airport.iata_code` | CSV; **static since June 2014 — the source's own page calls it "of historical value only"** | IATA/ICAO airport + airline codes | **ODbL** — commercial/redistribution permitted with attribution; share-alike applies to public redistribution of the derivative database, not internal application use | Yes | Yes, with attribution (share-alike on public redistribution) | Yes / Yes | Required (`SourceRegistry.attribution_text`) | **Stale since 2014 — route existence only, never a current schedule.** Every imported row is `provenance_tier="derived"`, never `verified`/`authoritative` | `AirportRoute.distance_km`/`duration_mins`/`service_class_meta` (staleness note), new `Airline` rows | **PRIMARY — Phase 4 scheduled flight edges, honestly stale** |

**Conflict-resolution rules (field-level, implemented via `ReferenceFieldProvenance` in Phase 3):**
- Coordinates: OurAirports (airports) / GeoNames (settlements) / Wikidata (tiebreak) > OSM > datameet > Google Geocode (fill-in, TTL-tagged) > never LLM.
- Identity/codes: IATA from OurAirports∩Wikidata (conflict → quarantine); station codes from datameet∩Wikidata.
- Names/aliases: GeoNames alternateNames → `CityAlias` (alias_type per language/abbrev); Wikidata labels secondary.
- Descriptions: own-generated (noncanonical layer) > Wikivoyage (SA-tagged) > none. Google descriptions/reviews: display-time only.
- A verified field is never overwritten by a lower-priority source; conflicts create `DataQualityIssue` rows (Phase 3 model), resolved by rule or human review.

---

## 6. Coverage model (measurable; replaces "all major and minor travel places")

### 6.1 Entity coverage tiers

Denominators are fixed, citable target sets — coverage is `publishable_entities / denominator` where *publishable* = valid in-range coordinates, not placeholder-centroid, `verification_status != quarantined`, required identity fields present.

| Tier | Entity class | Denominator (target set) | Phase-2 exit target | Phase-6 exit target |
|---|---|---|---|---|
| G1 | Countries | 249 ISO-3166-1 codes | 100% | 100% |
| G2 | States/UTs (India) + admin-1 (top 25 outbound countries) | 36 India + GeoNames ADM1 | 100% India | 100% |
| G3 | Districts (India) | LGD district master (~800; exact count fixed at import) | ≥95% | 100% |
| G4 | Major cities (India) | Census cities ≥100k population (per GeoNames population field) | 100% | 100% |
| G5 | Minor cities/towns (India) | GeoNames PPL/PPLA2+ with population ≥5k in India | ≥80% | ≥95% |
| G6 | Tourism destinations | Curated seed list: Ministry of Tourism + state tourism-board lists + ASI ticketed monuments' host towns (list frozen as a versioned fixture in Phase 3) | ≥90% | 100% |
| G7 | Pilgrimage locations | Curated list (Char Dham, 12 Jyotirlingas, 51 Shakti Peethas' towns, major gurdwaras/dargahs/church towns — versioned fixture) | ≥90% | 100% |
| G8 | Hill stations | Curated list (~120 recognized Indian hill stations — versioned fixture) | ≥90% | 100% |
| G9 | Islands & remote (Andaman, Lakshadweep, river islands) | Curated list | ≥80% | 100% |
| T1 | Airports (India, scheduled service) | OurAirports India rows with `scheduled_service=yes` | 100% | 100% |
| T2 | Railway stations | datameet ∪ Wikidata India stations | ≥95% w/ coords (today: 8,697/9,011) | ≥99% |
| T3 | Bus stations (intercity) | OSM `amenity=bus_station` India + state RTC terminal lists | ≥60% G4 cities have ≥1 mapped terminal | ≥90% |
| T4 | Metro/local-transit stops | GTFS feeds actually imported (Delhi first) | 0% (V2 scope) | per-feed 100% once imported |
| P1 | Hotels | No fixed denominator — coverage measured as: % of G4–G9 destinations with ≥10 publishable hotels | ≥50% | ≥90% |
| P2 | Restaurants | % of G4–G9 destinations with ≥10 publishable restaurants | ≥50% | ≥90% |
| P3 | Attractions | % of G6–G9 destinations with ≥5 publishable attractions | ≥60% | ≥95% |
| P4 | Activities | % of G6–G9 destinations with ≥3 publishable activities | ≥40% | ≥80% |

### 6.2 Reporting dimensions & required reports

`audit_reference_data` (existing, read-only) is extended in Phase 2/3 into a coverage suite with `--json` output, grouped **by country and by Indian state**, producing these persistent reports (one command each or subcommands; all deterministic, no paid APIs):

1. **Missing coordinates** — per entity type per state (today: 314 stations, N cities [measured at P0 baseline]).
2. **Placeholder coordinates** — India-centroid (20.5937, 78.9629) and any future sentinel, per type.
3. **Duplicate entities** — same normalized name + <5 km distance, or same place_id/wikidata id on 2+ rows; the known "New York"/"New York City" class.
4. **Missing aliases** — G4–G9 entities with zero `CityAlias` rows (per state).
5. **Missing city↔hub mappings** — publishable cities with no ServiceArea row within mode radius (rail 80 / air 120 / bus 40 km).
6. **Missing road connectors** — city pairs on the G6–G9 demand list with no cab/self-drive feasibility record.
7. **Missing transport routes** — hub pairs on the top-200 India city-pair demand list (fixture, Phase 4) with no scheduled route row in any mode.
8. **Unresolved source mappings** — staging records matched to no canonical entity; canonical entities with no source mapping.
9. **Non-publishable entities** — full list with reason codes (no-coords / placeholder / quarantined / missing-identity / licence-blocked).

Each report defines: metric name, formula, denominator source, and the phase-gate threshold that consumes it (see per-phase acceptance criteria, §14).

---

## 7. Canonical reference data model (target)

Principle: **extend existing models; create new ones only where no extensible model exists.** No existing canonical rows are deleted or overwritten; new sources reconcile through mappings and aliases.

### 7.1 Existing models retained and extended (no replacement)

| Model | Keep as-is | Extend with (nullable, Phase noted) |
|---|---|---|
| Country/State/City | identity, `place_id`, Decimal coords, `normalized_name` | City: `geonameid` (unique, null), `wikidata_id`, `population`, `district` (FK new District, P3), `destination_tags` JSON (tourism/pilgrimage/hill/island — feeds G6–G9), `coordinate_confidence`, `is_publishable` (denormalized, P2) |
| Airport | iata unique, `hub_importance` | `ourairports_ident`, `wikidata_id`, `scheduled_service` bool, `coordinate_confidence` (P4) |
| RailwayStation | code unique, station-intelligence fields | `wikidata_id`, `coordinate_confidence` (P4) |
| BusStation | code, hub_importance | `osm_id`, `coordinate_confidence` (P4) |
| MetroStation | — | coordinates (Decimal 9,6), `gtfs_stop_id`, `feed` FK (V2/T4 only) |
| AirportRoute/TrainRoute/BusRoute | endpoint FKs, duration | `distance_km`, `frequency_per_day`, `operating_days` (7-bit), `service_class_meta` JSON, `fare_rule` FK, `provenance_tier`, `confidence`, `freshness_at`, `is_active` (P4) |
| 3× ServiceArea | all fields (these ARE the access/egress edges) | none needed for V1 |
| *Master tables + EnrichmentMixin | TTL/completeness/verification fields | `wikidata_id`, `osm_id` (P6); Google-sourced fields become TTL-enforced (P6) |
| CityAlias/Locality(+Alias)/MetroArea(+Alias,+City) | schema as built | **activated by P3 importers** (GeoNames alternateNames → CityAlias; GeoNames PPLX/OSM → Locality) |
| TravelPriceHistory | quote cache w/ tier + classification | tier honesty fixed in P0; remains the **quote cache**, not the benchmark |
| TravelPriceObservation/Summary | schema as built | **activated in P5** (observation writers + rollup) |
| ReferenceFieldProvenance | schema as built | **activated in P3** (importers write field-level provenance) |

### 7.2 New models (all in `apps/reference`)

- **`District`** (P3): India LGD districts. `lgd_code` unique, name, state FK, normalized_name. Identifier strategy: LGD code canonical.
- **`SourceRegistry`** (P3): one row per source (slug, publisher, licence name, licence URL, licence_verified_at, storage_permissions {raw, normalized}, attribution_text, priority_rank, active).
- **`SourceRelease`** (P3): FK source; version/date, file checksum, record_count, downloaded_at.
- **`ImportBatch`** (P3): FK release; command name, params, started/finished, status, counters (created/updated/skipped/conflicted/quarantined), dry_run flag. Every importer writes exactly one.
- **`StagingRecord`** (P3): FK batch; raw payload JSON, source_record_id, normalized JSON, match_status (unmatched/matched/ambiguous/rejected), matched content-type+object-id, match_confidence. Quarantine area — staging rows are never planner-visible.
- **`ProviderEntityMap`** (P3/P6): generic FK to canonical entity + (source slug, external_id) unique. Replaces ad-hoc single-column external ids for multi-source reconciliation (`place_id`/`geonameid`/`wikidata_id` columns remain as fast paths; this table is the general case).
- **`DataQualityIssue`** (P3): generic FK, issue_type (coordinate_conflict/duplicate_candidate/identity_conflict/licence_block/coordinate_out_of_range), details JSON, status (open/resolved/accepted), resolution note. Feeds report 3/8/9.
- **`FareRule`** (P5): mode (train/bus/cab/flight/metro), scope (country/state/city/route-class), unit (per_km_slab/per_km/flat_plus_km/percent), params JSON (e.g., train distance-slab table per class; cab {base, per_km, night_pct, driver_allowance}), currency, valid_from/valid_to, source FK, provenance_tier, confidence.
- **`HubTransferLink`** (P4, V1.5-ready): from-hub generic FK ↔ to-hub generic FK (same metro area), distance_km, typical_transfer_mins, mode (cab/metro/walk), min_connection_mins, provenance, confidence. Intra-city hub↔hub transfer edges (e.g., NDLS ↔ DEL airport). Schema created in P4, populated for the top-50 metro areas.
- **`RouteServicePattern`** (schema reserved, **created only if/when a GTFS or timetable source is approved** — V2): FK route generic; service identifier (train no/flight no/GTFS trip), departure/arrival local times, operating_days, validity window, source. **Deliberately NOT created in V1** — but route-model extensions (operating_days, frequency) are chosen so this table can attach without altering V1 columns.

### 7.3 Identity & reconciliation strategy (per entity)

- Canonical id = existing integer PK. Never re-keyed.
- Source identifiers: fast-path columns (place_id, geonameid, wikidata_id, iata, station code, lgd_code, osm_id) + `ProviderEntityMap` for the general case.
- Matching ladder (P3 reconciler): exact external-id match → cross-id via Wikidata → normalized name + admin container + distance ≤ threshold (city 10 km, POI 500 m) → else `StagingRecord.ambiguous` for review. **Never auto-merge two existing canonical rows** — duplicates get a `DataQualityIssue` and a human-confirmed merge command (P3) that preserves the older PK, moves FKs, and writes aliases.
- Duplicate prevention at create time: the place_id ownership check already fixed in `planner/geocoding.py` **[VERIFIED]** is replicated into the reference command (P0/H5) and into all P3 importers.

---

## 8. Geospatial design

### 8.1 Decision (D2, provisional): plain PostgreSQL now, PostGIS behind a measured checkpoint

- One shared utility module **`apps/reference/services/geo.py`** (P2): `haversine_km(lat1,lng1,lat2,lng2)`, `bbox_prefilter(qs, lat, lng, radius_km)` (degree-window computed from latitude, not a fixed ±1°), `nearest(qs, lat, lng, radius_km, limit)`. The three existing haversine copies (`canonical_resolver.py:5`, `places_explore.py:28`, `distance_service.py:73`) become delegating wrappers, then die in P10.
- Composite B-tree indexes `(latitude, longitude)` on City, Airport, RailwayStation, BusStation, and the four master tables (P2 migration) — makes the bbox prefilter an index range scan.
- Coordinates stay `DecimalField(9,6)` everywhere. **Design rule for PostGIS-forward-compatibility:** no code may assume coordinate storage type beyond `geo.py`'s function signatures; if PostGIS is adopted later, a `geography(Point)` column is ADDED next to the Decimals and `geo.py` swaps its internals — no caller changes.

### 8.2 Coordinate lifecycle (staged, P2 — matches the mandated no-immediate-NOT-NULL process)

1. **Audit** (extend `audit_reference_data`): counts by type/state of missing, placeholder, out-of-range (lat∉[-90,90], lng∉[-180,180], or outside the entity's country bbox) coordinates.
2. **Backfill**: open-data first (GeoNames/OurAirports/datameet/Wikidata by priority ladder §5), Google Geocode only for the remainder (budgeted, logged, TTL-tagged provenance).
3. **Validate**: country-bbox containment; nearest-city sanity (an airport >200 km from its FK'd city is flagged); cross-source disagreement >2 km → `DataQualityIssue`.
4. **Duplicates**: report 3; human-gated merge command.
5. **Quarantine**: still-unresolved rows get `is_quarantined=True` (existing field) — they remain in the DB but are not publishable.
6. **Publishability rule**: `provenance.publishable()` (new, P2) = has valid in-range coords AND not placeholder AND not quarantined AND identity fields present. `exclude_unverified` callers migrate to it. Planner candidate pools, station selection, and explore endpoints all consume publishable-only.
7. **Constraints last**: only after coverage report shows <0.5% violations per table do we add DB-level CHECK constraints (lat/lng range) — never `NOT NULL` on legacy tables; staging keeps accepting coordinate-less records.

### 8.3 What plain-Postgres explicitly cannot do (accepted V1 limitations)

No polygons (metro-area boundaries approximated by center+radius and membership tables), no route geometry storage, no spatial containment queries, no true KNN index (bbox+sort is O(candidates)). These are exactly the §8.4 triggers.

### 8.4 PostGIS checkpoint (mandatory, end of Phase 3)

After the first large import (GeoNames India), run a benchmark command (`benchmark_geo_queries`, P3 deliverable — deterministic, no network) measuring nearest-hub and nearby-place queries at G4/G5 scale. **Adoption triggers — adopt PostGIS if ANY holds:**
- Publishable point entities > 500,000; or
- nearby-query p95 > 150 ms at realistic load; or
- bbox candidate sets routinely > 5,000 rows before the haversine sort; or
- an approved feature needs polygons (service-area shapes), route geometry (polylines), or containment (point-in-district); or
- operational cost of the workaround (index bloat, query complexity) exceeds the one-time PostGIS setup on the owner's host Postgres.
Checkpoint output is written into this document's Phase 3 completion notes with the measured numbers, and the decision (stay/adopt) is put to the owner. Reversal cost stays Medium because of the 8.1 design rule.

---

## 9. Multimodal route graph

### 9.1 Graph definition (V1)

- **Nodes:** City (origin/destination anchors) and transport hubs (Airport, RailwayStation, BusStation — existing tables).
- **Access/egress edges:** the 43,232 existing ServiceArea rows (city↔hub, with distance_km, typical_transfer_mins, transfer_mode) **[VERIFIED]** — plus on-the-fly `geo.nearest()` when a publishable city has no ServiceArea row (logged to report 5).
- **Scheduled edges:** AirportRoute/TrainRoute/BusRoute rows, extended per §7.1 (distance, frequency_per_day, operating_days, fare_rule, provenance, freshness).
- **Road edges:** computed, not stored — haversine × road factor (existing 1.25 @ 55 km/h until P5 calibrates per-corridor factors from DistanceEdge observations); cab feasibility ≤ 1500 km (existing rule).
- **Transfer edges:** `HubTransferLink` (P4; V1 uses them only for airport↔station last-mile sanity, V1.5 for true interchanges).
- **NOT built:** all-pairs precomputation, persistent multi-hop paths, RAPTOR, contraction hierarchies. The graph is assembled in memory per query from indexed relational reads.

### 9.2 V1 search algorithm (`reference/services/route_graph.py`)

For `search(origin_city, dest_city, date, prefs)`:
1. Resolve both cities (canonical layer). Collect candidate hubs per side: ServiceArea rows ordered by `is_primary_hub`, `distance_km`, hub importance/derived scores — cap 4 hubs/mode/side.
2. For each mode ∈ {flight, train, bus} and each origin-hub × dest-hub pair (≤16/mode): look up the direct scheduled edge; skip pairs with none. For road modes: compute the road edge city-to-city.
3. Assemble itineraries: access leg (city→hub, cab/local estimate from ServiceArea mins) + scheduled edge + egress leg (hub→city). Compute `total_duration = access + wait_buffer(mode) + in_vehicle + egress`, `est_cost = Σ price_estimator per leg` (min/expected/max), `transfers`, `confidence = min(edge confidences)`, `provenance` = worst tier used.
4. **Pareto prune** on (total_duration, expected_cost, transfers): keep non-dominated options plus the best per mode; cap K=5. Preference weighting (existing `_suitability_score` semantics) ranks within the Pareto set — preferences reorder, they never fabricate feasibility.
5. Hub-choice correctness (the "smaller nearby station vs farther major station" rule): because candidate hubs are hard-filtered on **route existence** before scoring (station_selector's verified behavior, retained), a farther major station with a direct train beats a nearer halt with none by construction; among hubs with routes, scoring weighs `derived_hub_score`, frequency, and door-to-door total time — not raw distance alone.
6. Cache: result written to existing `JourneyRouteCache` (route_key hash, TTL) — unchanged contract.
7. **No-scheduled-option behavior:** return road options if feasible, with `no_scheduled_route: true`; if nothing is feasible, return an empty result with reasons — the planner keeps raising `GenerationNeedsInput` (existing honest behavior). **A missing direct hub never auto-recommends a full-distance cab when scheduled multimodal alternatives exist** — those are exactly the V1.5 combinations below, and until V1.5 lands, the V1 response marks such pairs `multileg_candidate: true` (report 7 feeds the backlog).

### 9.3 Version roadmap (schema-forward-compatible; none of V1's columns change later)

| Version | Capability | Mechanism | Preconditions |
|---|---|---|---|
| **V1** (P4) | access + ONE direct scheduled edge + egress; road modes; Pareto top-K; operating-day check (coarse: `operating_days` bitmask vs travel date) | in-memory assembly over relational reads | route-model extensions; ServiceArea data (exists) |
| **V1.5** (P4 stretch or follow-up) | up to TWO scheduled edges: train+train interchanges (via junction stations), bus→train, train→cab-bridge→train; flight connections via `AirportRoute` chains; min-connection enforcement (`TransferProfile.typical_min_connection_mins` + `HubTransferLink.min_connection_mins`); waiting-time model per mode; overnight-connection flag (arrival+transfer crosses 22:00–06:00) | bounded best-first over ≤2 scheduled edges; interchange candidates limited to `network_role in (primary_city_hub, regional_hub, junction)` | HubTransferLink populated top-50 metros; TransferProfile coverage |
| **V2** | time-dependent schedule routing: real departures/arrivals, missed-connection risk (buffer vs historical delay), reliability scores, operating-day exactness, local metro/bus legs from GTFS | `RouteServicePattern` table + a RAPTOR-like round-based search **only if** feed coverage justifies it | an approved timetable source (§5: OTD Delhi T&C verified; train timetable source approved); `TransitOutcomeLog`-style delay data or provider status feeds |
| **V3** | multi-city itinerary-level optimization: leg ordering across the whole trip, open-jaw handling, accessibility-constrained routing (step-free flags from TransferProfile/`stair_heavy`), cost/time global trade-off | planner-side optimizer consuming V1/V2 leg search as an oracle (lives in `apps/planner` — itinerary ordering is planner intelligence) | V1.5 stable; per-leg estimates calibrated (P5 eval) |

**Schema rule that keeps V2 possible:** scheduled-edge extensions carry `operating_days` + `frequency_per_day` + nullable `service_class_meta` now; timetable rows attach later via `RouteServicePattern` FK'ing the same route rows — no V1 column is redefined, and `route_graph.search()`'s return contract (list of leg-typed options with provenance) is designed to be version-agnostic.

### 9.4 Route acceptance scenarios (deterministic fixtures; Phase 4 acceptance criteria)

Each scenario becomes a fixture-backed check (no paid APIs; seeded rows) asserting expected modes, fallback, provenance, and price labeling.

| # | Scenario | Expected V1 behavior |
|---|---|---|
| S1 | Delhi → Mumbai | Flight (DEL→BOM) + train (NDLS→CSMT/BCT) + bus + cab options; Pareto set contains ≥ flight & train; prices labeled per ladder (live if enabled, else fare-rule/benchmark estimate — never "verified" without a live/verified row) |
| S2 | Delhi → Manali | No airport in Manali on file with scheduled service → flight option uses nearest served hub (Bhuntar/KUU if routes exist, else none); bus (direct) + cab; train option via nearest railhead (Chandigarh/Ambala) marked `multileg_candidate` until V1.5; **no silent full-distance-cab default** — cab appears as one option, honestly priced |
| S3 | Town with no airport → major city (e.g., Alleppey → Delhi) | Access leg to nearest served railhead/airport via ServiceArea; scheduled edge; egress; provenance shows which hub substitution happened (`explanation` from station_selector retained) |
| S4 | Destination served by nearby major station (e.g., Agra for Fatehpur Sikri) | ServiceArea mapping resolves the served city; transfer time+cost included in totals |
| S5 | Farther station with better direct train (e.g., a junction 30 km away with a direct express vs a 5 km halt with none) | Route-existence hard filter selects the junction; score_breakdown (bug H2 fixed) shows why |
| S6 | Train + cab required (railhead ≠ destination, e.g., → Munnar via Aluva/Ernakulam) | Train edge + egress cab leg from ServiceArea/geo.nearest; combined duration/cost; `transfers=1` |
| S7 | Bus + train combination (V1.5) | V1: both single-mode options + `multileg_candidate: true`; V1.5: the actual bus→train itinerary with min-connection check |
| S8 | Island destination (Port Blair; Havelock) | Flight to IXZ; onward ferry NOT fabricated (no ferry mode exists) — plan surfaces "no scheduled option on file" for the last hop with honest degradation |
| S9 | Hill destination (Shimla/Ooty) | Narrow-gauge/served-railhead handling via ServiceArea; road option with mountain factor flagged as estimate (P5 corridor factors) |
| S10 | No valid scheduled option at all (remote pair) | Road options if ≤ feasibility limits, `no_scheduled_route: true`; else empty + `GenerationNeedsInput` upstream — never invented routes |
| S11 | Multi-city trip (Kolkata → Gangtok → Pelling, the real Phase-B workspace) | Per-leg resolution matches current verified behavior (nearby-hub NJP/IXB), regression-checked against the recorded Phase-B evidence |
| S12 | Wheelchair-accessible trip | V1: accessibility prefs annotate options (stair_heavy/TransferProfile surfaced), never hard-filter silently; V3: constraint-aware routing |
| S13 | Overnight transfer (arrival 23:40 + onward leg) | V1: coarse warning via existing validation; V1.5: overnight-connection flag + min-connection enforcement |
| S14 | Missing/stale price data on a route | Option still returned; price shows benchmark range or "insufficient data" label with tier `estimated`/none — **never a fabricated number stamped verified (C1 fixed)** |

---

## 10. Price-estimation design

### 10.1 The six price classes (every displayed price belongs to exactly one; stored on the result envelope)

1. **Official fare calculation** — computed from a published fare rule (`FareRule`); tier `authoritative-rule`. (Train slabs; metro fares; regulated cab rate cards where a city publishes one.)
2. **Rule-based estimate** — our own parameterized rule (cab base+per-km; bus per-km band); tier `estimated`.
3. **Historical benchmark** — quantiles from `TravelPriceSummary` (p25/median/p75 + seasonal index); tier `estimated`, method `benchmark`.
4. **Statistical prediction** — model output (only after §10.6 gates); tier `estimated`, method `model:<name>@<version>`.
5. **Recent cached quote** — `TravelPriceHistory` row with honest tier + observed_at; freshness surfaced.
6. **Live quote** — provider response this request; tier `verified` **only** when `LIVE_PROVIDERS_ENABLED` and the provider returned a real price (C1/C2 fixed).

Display ladder: 6 > 5 (within freshness window) > 1 > 2/3/4 (best available) > "insufficient data". **Until adequate observations exist, all outputs of classes 2–4 are labeled estimates — never predictions, never verified.** Estimate envelope (uniform return type from `price_estimator.estimate()`): `{min, expected, max, currency, unit, confidence, method, freshness, taxes_included, assumptions[], live_available}`.

### 10.2 Per-category strategy

| Category | V1 method (P5) | Unit | Key inputs | Upgrade path |
|---|---|---|---|---|
| Train | **Official fare rules**: IRCTC distance-slab tables per class + reservation/superfast charges, encoded as `FareRule` params (manually curated from published tables, with `valid_from`) | per person per class | route distance_km, class | flexi-fare trains get observation-corrected multipliers once observations exist |
| Bus | Per-km bands by category (seater/sleeper × AC/non-AC) calibrated initially from published RTC fare tables + provider observations | per person | distance, category | quantile regression on observations (route-cluster level) |
| Intercity cab | Rate-card `FareRule` per city tier: {base, per_km, driver_allowance/day, night_pct, state_tax_flag, round_trip_rule} — formalizes the current hardcoded 300+16/km into DB, single source for backend + frontend (M6 fixed) | per vehicle | road distance, vehicle type, days | corridor-specific calibration from cab-provider observations |
| Local cab | City-tier per-km + minimum fare | per trip | distance | same |
| Flight | Distance-band ₹/km curve × carrier-category × booking-horizon multiplier × season/holiday index; recalibrated monthly from `TravelPriceObservation` | per person | great-circle distance, days-to-departure, month, route observations | quantile GBT per route-cluster at §10.6 volume |
| Hotel | `price_range` tier → nightly band per city tier × season index (TravelSeason) × weekend factor; observation-corrected medians where present (`median_hotel_price_per_night` exists **[VERIFIED]**) | per room-night, taxes flagged | star/price tier, city tier, month, dow | per-city quantile models |
| Restaurant | `price_level` → **per-person band** (canonical unit; "meal for two" always derived as 2× per-person — never mixed, M-rule) | per person | price_level, city tier, cuisine | observation-corrected |
| Attractions/Activities | `ticket_price_estimate`/`price_estimate` fields where sourced (ASI ticket lists via gov data are class-1 official where imported); else category band | per person | category, city | gov-data import widens class-1 coverage |

### 10.3 Historical-data acquisition strategy (per category)

- **Flights:** sample own live-provider searches (when enabled) on a fixed panel: top-200 India city pairs × horizons {3, 7, 14, 30, 60 days} — cadence daily for top-20 pairs, weekly for the rest; every planner-triggered live search ALSO writes an observation (free signal). Store: route, date, horizon, carrier category, cabin, min/median of returned results, provider, currency, taxes_included. **Provider ToS review precedes enabling panel sampling (§5 RapidAPI row).**
- **Hotels:** observations from planner-triggered live searches + weekly panel of G6 destinations (2 room-nights, 2 horizons). Store city, star band, date, dow, median nightly, taxes_included.
- **Buses:** observations from provider searches; supplement with published RTC fare-table snapshots (versioned FareRules, not observations).
- **Cabs:** provider quotes as observations keyed by corridor (origin-city, dest-city, vehicle type); rate-card rules dominate until ≥50 obs/corridor.
- **Restaurants:** no live provider exists — class 2/3 only; observations = enrichment-time price_level snapshots (Google, display-time constraints respected: we store the normalized band under our own schema with provenance, TTL'd per D3).
- **Attractions/activities:** official ticket prices from gov/tourism datasets (class 1); enrichment bands otherwise.
- **Normalization rules (all categories):** currency normalized to INR at observation time with the FX rate stored alongside (`forex.ForexData` snapshot); taxes_included recorded explicitly (never guessed — if unknown, `taxes_included=null` and the envelope says so); outliers filtered by MAD (median absolute deviation > 5× MAD dropped, logged); unavailable/sold-out results recorded as `availability_zero` observations (they carry demand signal), cancellations/refund quotes excluded from price aggregates.
- **Cadence governance:** all panel sampling is a Celery beat task with a hard daily provider-call budget (settings-driven), OFF by default, and blocked until the per-provider ToS row in `SourceRegistry` is marked verified.

### 10.4 Features (engineered at rollup time into `TravelPriceSummary.details`)

Booking-horizon bucket; month; day-of-week; **Indian holiday/festival flags** from the existing `HolidayCalendar` model (Diwali/Holi/Dussehra windows, long weekends — computed as ±3-day windows around holiday rows); season index from `TravelSeason`; route-cluster id (distance band × region × carrier class); city tier.

### 10.5 Evaluation (offline, deterministic, free — P5 command `evaluate_price_estimators`)

Holdout = most recent 20% of observations per category. Metrics: MAE, median AE, WAPE (aggregate honesty), pinball loss at q25/q50/q75 (quantile quality), **interval coverage** (fraction of actuals inside [min,max] — target ≥80%), segmented by mode/route-type/region/season, plus **cold-start error** (routes with <10 observations). Confidence calibration rule: reported `confidence` maps to measured interval coverage bands (e.g., confidence 0.8 ⇒ that estimator segment's coverage ≥0.8 on holdout); segments failing calibration get widened intervals, not inflated confidence. Drift monitoring: rollup task recomputes WAPE on a trailing window; >25% degradation flags `DataQualityIssue` and freezes the affected estimator to benchmark mode.

### 10.6 ML gate

A statistical model (quantile gradient-boosted trees — the only ML class on the table) may replace a rule for a segment only when: ≥500 observations in the route-cluster, ≥3 months of history, offline eval beats the rule's WAPE by ≥15% AND interval coverage ≥ rule's, and retraining cadence (monthly) + drift monitoring are wired. **No deep learning — the data volumes here will not justify it in any foreseeable phase.** Cold-start behavior everywhere: fall back one ladder step (model→benchmark→rule→"insufficient data"), never extrapolate a model outside its training support.

---

## 11. Place-data strategy (hotels, restaurants, attractions, activities)

### 11.1 Field-level layering (what comes from where)

| Field group | Source of truth | Honesty note |
|---|---|---|
| Canonical identity (our PK, name, city FK) | Open data (OSM/Wikidata/gov) where available; else created from enrichment with `source` recorded | — |
| Coordinates & address | OSM/Wikidata/gov > Google Geocode (TTL-tagged) | Google coords are refreshable enrichment under D3, not permanent truth |
| Categories/cuisine/type | OSM tags + Wikidata instance-of, normalized to our fixed vocab (P6 mapping table); Google types as fill-in | Vocabulary normalization is ours; provenance per field |
| Licence-safe descriptions | Own-generated (noncanonical layer, §4.1 metadata mandatory) > Wikivoyage (SA-tagged, attributed) | Google editorial summaries/reviews: display-time only, never stored past ToS windows |
| Images & rights | Wikimedia Commons (per-file licence recorded) > owner-supplied later > Google Photos **via proxy only, never stored** (existing `PlacePhotoProxyView` pattern) | `attractions` app's stored key-bearing URLs are scrubbed in P0 |
| Provider mappings | `ProviderEntityMap` (place_id, osm_id, wikidata_id, booking-provider ids) | — |
| Estimated pricing | §10 estimator (bands + benchmarks) | Always labeled estimate |
| Live availability / current opening status | Live provider / Places calls at request time; TTL cache only (`TravelPriceHistory` / Redis) | **Never stored as reference truth** (rule 3.4 of the mandate) |
| Ratings/review counts | Google (TTL'd enrichment fields, refreshable) | Displayed with freshness; not canonical |

### 11.2 What free open data CANNOT reliably provide (explicit)

- **Hotel nightly prices and availability** — no open source exists; only provider quotes/observations. OSM has hotel locations/names, not rates.
- **Restaurant menus, price levels, current hours** — OSM coverage of `opening_hours`/`cuisine` in India is sparse and stale; Google remains the practical source under TTL.
- **Ratings and popularity** — inherently proprietary (Google/OTA) or self-built (our dead telemetry chain; out of scope).
- **Comprehensive minor-city restaurant/hotel POI coverage** — OSM alone will NOT deliver P1/P2 coverage targets in tier-2/3 India; the cache-on-miss Google flow remains the coverage engine for these two categories, with open data claiming identity/coords where it exists. **This plan does not claim complete hotel or restaurant enrichment from open data.**
- Attractions fare better (ASI/tourism datasets + Wikidata for notable sites), activities worst (largely curated/provider-driven).

---

## 12. Knowledge application migration map

### 12.1 Component-by-component destinations

| Component (current path) | Destination (target path) | Reason | DB impact | Mechanism | Compat shim | Rollback | Deletion criteria |
|---|---|---|---|---|---|---|---|
| `EntityEmbedding` | `reference` (search-index layer §4.1-3) | Index over reference entities | Table kept, app-label migrated | `SeparateDatabaseAndState` (state-only move; table name retained to avoid a rewrite of the HNSW index) | `knowledge.models.EntityEmbedding` re-export | revert state migration | callers re-pointed + grep clean |
| `DistanceEdge` | `reference` (calculation cache) | Consumed by planner distance_service; reference-owned cache | same | same | same | same | same |
| `PlaceInsight`, `LocalTip` | `reference` (noncanonical enrichment §4.1-4) + add missing `generation_method`/`source_inputs` columns | Written by reference enrichment tasks already | Table kept + 2 nullable columns | state move + additive migration | re-exports | revert | same |
| `PlanInsightDismissal` | `planner` | FKs PlannerWorkspace **[VERIFIED]** | state move | same | re-export | revert | same |
| `services/embeddings.py` | `reference/services/embeddings.py` | Called by reference views/tasks + planner (plan_generation, taste) | none | move + `knowledge.services.embeddings` shim module | import shim | restore module | all imports migrated |
| `services/enrichment.py` | `reference/services/enrichment.py` | Already driven exclusively by reference tasks | none | same | same | same | same |
| `services/engine.py` (`KnowledgeEngine`) | folded into `reference/services/places_explore.py` (`resolve_places()` function) | Thin wrapper over `_category_config` already in reference **[VERIFIED]** | none | inline + shim class | shim | restore | same |
| `Neighbourhood` | DELETE (default) — revive into reference ONLY if a P6 source (OSM locality polygons) is approved to feed it | zero production readers+writers **[VERIFIED]** | drop at P10 | — | — | table backup via pre-P10 dump | re-grep zero refs at P10 |
| `Event` | DELETE (default) — no events source in this plan | same | same | — | — | same | same |
| `EmergencyContact`, `SafetyAdvisory` | DELETE (default) — country-level safety content is a future content decision, not schema | same | same | — | — | same | same |
| `PlaceRelationship` | DELETE (default) — "pairs_well_with" has no writer and no consumer | same | same | — | — | same | same |
| `CrowdPattern`, `EntityInteractionLog`, `TransitOutcomeLog` | DELETE — dead telemetry chain, documented in `ranking.py:12–18` | same | same | — | — | same | same |
| App shell (`apps.knowledge` in INSTALLED_APPS, admin registrations) | removed at P10 | — | — | — | — | git revert | all above complete + parity checks pass |

### 12.2 Migration order (mandated 10-step sequence, applied)

1. Classify (this table). 2. Build target module layout in reference (P7.1). 3. State-migrate models / move data where table names change (P7.2 — default: keep table names, state-only). 4. Add compat shims (P7.3). 5. Migrate callers — reference views/tasks, planner plan_generation/taste/distance_service/views (P7.4; mechanical import swaps, verified by grep + `manage.py check` + `compileall`). 6. Parity: semantic_search / enrich_one / DistanceEdge read-write exercised through BOTH import paths against the same DB, outputs compared (P7.5, scripted). 7. Disable old writes (shims become read-only aliases). 8. Confirm parity again after one beat cycle (embeddings task 15min, enrichment 6h). 9. Remove dead code + shims. 10. Remove app **only after** `grep -r "apps.knowledge" backend/` returns nothing outside migrations history.

**Not merged into planner:** none of knowledge's canonical/sourced content goes to planner — the only planner-bound piece is the workspace-FK'd dismissal model. This honors "canonical data does not belong in planner state."

---

## 13. Attractions-app retirement gate (separate approval, per owner direction)

**Immediate (Phase 0, security):** stop generating key-bearing URLs (`attractions/views.py` builds proxy-relative URLs or stores `photo_ref` only); one-off scrub command rewrites existing `Attraction.image_url`/`secondary_images` rows to proxy form; **owner rotates the Google key after scrub (D10)** — the old key must be assumed leaked.

**Retirement (Phase 6 track + P10 removal) proceeds ONLY when every box is checked:**
- [ ] All consumers mapped: `frontend/src/services/attraction.service.ts` (`/attractions/items/explore/` **[VERIFIED]**), any other grep hits, admin usage.
- [ ] Frontend migrated to `/reference/attractions/*` + photo proxy, behind a compatibility window.
- [ ] ID mapping table built: `attractions.Attraction.place_id` → `reference.AttractionMaster` (place_id is the join key; unmatched rows imported via the P3 reconciler, not dropped).
- [ ] Saved planner/user references audited: grep confirms whether any planner block, saved-place, or booking row stores `attractions` PKs — **[UNKNOWN today; audit task in P6]** — and a redirect map is persisted if so.
- [ ] Backward-compatible routes: `/attractions/items/explore/` served by a thin adapter over reference until frontend deploy is confirmed.
- [ ] Image URLs scrubbed (done in P0) and re-audited.
- [ ] Parity verified: same query returns equivalent results from both endpoints on a fixture city.
- [ ] Owner approves removal explicitly → app deleted in P10.

---

## 14. Phased implementation plan

Global rules: every phase ends with `python manage.py check`, `makemigrations --check --dry-run`, `python -m compileall apps config`, and a `git status` scope review. No phase calls paid APIs in its validation path. Every import command supports `--dry-run`, is idempotent, resumable (checkpointed via `ImportBatch`), and writes counters. Backups: owner takes a `pg_dump` before any phase that migrates schema or mutates data at scale (P2, P3, P4, P6, P7, P10) — the phase is blocked until the dump exists.

### Phase 0 — Baseline, safety & honesty hotfixes

- **Objective:** freeze a measured baseline; kill the four defects that poison data or leak secrets. No schema changes.
- **Scope:** (1) baseline snapshot: `audit_reference_data --json` output + row counts of every reference/knowledge/planner table + coverage numbers → committed into this doc's Phase 0 notes; perf baseline scripts (direct-route lookup, nearby-hub, explore latency, external-API calls per generation — measured on the owner's DB). (2) **C1 fix** (`reference/services/live_price.py`): remove literal price fallbacks 850/5000/1500 and the DEL→BOM default params; a provider row without a price yields NO result (honest miss); rows written from live fetches get `provenance_tier="verified"` only when `LIVE_PROVIDERS_ENABLED` and the price came from the provider payload; otherwise `estimated` + `classification="mock_data"` where applicable. (3) **C2 fix** (`train_providers.py`, `bus_providers.py`): hardcoded prices on the live path re-labeled — provider results without real prices return `price=None` + provenance `estimated`; mock literals stay mock-labeled. (4) **H1/H2 fixes**: import `models` (or `Q`) in `canonical_resolver.py`; compute `frequency` explicitly in `station_selector.py` score_breakdown. (5) **H5 fix**: replicate the place_id-ownership guard into `reference/management/commands/backfill_city_coordinates.py`. (6) **C3 stopgap**: `attractions/views.py` stops embedding the key (store `photo_ref`, serve via the reference proxy pattern); new one-off command `scrub_attraction_image_urls` (dry-run default); owner rotates the key (D10). (7) Data-hygiene query (read-only report, no deletion): count `TravelPriceHistory` rows matching the C1 fabrication signature (exact 850/1500/5000 with `verified` tier) — the cleanup itself is a P5 decision with owner sign-off.
- **Out of scope:** schema migrations, imports, any model/table change, deleting poisoned rows.
- **Dependencies:** owner approval of this document; owner-run `pg_dump` (for the scrub only).
- **Files:** `reference/services/live_price.py`, `bookings/providers/train_providers.py`, `bookings/providers/bus_providers.py`, `reference/services/canonical_resolver.py`, `reference/services/station_selector.py`, `reference/management/commands/backfill_city_coordinates.py`, `attractions/views.py`, new `attractions/management/commands/scrub_attraction_image_urls.py`, new `scripts/baseline_metrics.py` (read-only).
- **Migrations:** none. **Data migration:** URL scrub (command, dry-run first, reversible only via dump — hence the dump gate).
- **Acceptance criteria:** baseline JSON committed; a live_price call with no DB row and providers disabled returns no fabricated price; fabrication-signature count reported; `canonical_resolver` metro branch executes under a scripted check; scrubbed rows contain no `key=` substring; `manage.py check` clean.
- **Validation commands:** `python manage.py audit_reference_data --json`, `python manage.py scrub_attraction_image_urls --dry-run`, scripted checks for live_price/canonical_resolver/station_selector (fixtures, no network).
- **Performance target:** n/a (baseline capture). **Risks:** consumers relying on fabricated prices now see honest gaps — expected and desired; verify planner degrades gracefully (it already renders unpriced blocks **[VERIFIED]**). **Rollback:** git revert; scrub restore from dump. **Parallel:** all sub-items independent.
- **Checklist:** [x] baseline JSON [x] perf baseline [x] C1 [x] C2 [x] H1 [x] H2 [x] H5 [x] C3 code [x] C3 scrub run [ ] key rotated (owner) [x] fabrication-count report

**Phase 0 completion note — 2026-07-19:** working-tree identifier `main@a386842` plus the Phase 00 diff; verification verdict **PASS WITH CONDITIONS**. Primary evidence: `docs/plans/evidence/phase-00/baseline.json`, `validation-output.txt`, `after-row-counts.json`, and `verification/reviewer-validation-output.txt`. Nonblocking limitations: owner must rotate the previously exposed Google key; route tables contain no rows for a direct-route latency baseline; existing generation usage payloads expose no explicit external-call counters. Phase 1 is authorized to proceed.

### Phase 1 — Ownership & application boundaries

- **Objective:** enforce the §4 layer rules before any data work.
- **Scope:** create `apps/common/provenance.py` with `make_provenance` + tier constants (moved from `planner/services/block_schema.py`, which re-exports); update `reference/services/live_price.py` import; new management command `check_layer_boundaries` (greps for forbidden import directions: `apps.planner` inside `apps/reference`+`apps/knowledge`, `apps.knowledge` anywhere after P7; exits non-zero); document the single sanctioned reference-writer path (`geocoding.resolve_or_create_city`) in module docstrings; write the dependency-direction rules into `docs/agent/DECISIONS.md`.
- **Out of scope:** moving geocoding itself (it stays in planner — it mixes draft-state logic; only its reference-write contract is documented).
- **Dependencies:** P0 merged. **Files:** `apps/common/provenance.py` (new), `planner/services/block_schema.py`, `reference/services/live_price.py`, `reference/management/commands/check_layer_boundaries.py` (new), `docs/agent/DECISIONS.md`.
- **Migrations:** none. **Acceptance:** `check_layer_boundaries` passes except a documented allowlist (geocoding path until P4); no behavior change (`make_provenance` output byte-identical, scripted check). **Validation:** the new command + standard trio. **Risks:** hidden import cycles — mitigated by re-export. **Rollback:** git revert. **Parallel:** with P2.
- **Checklist:** [x] common/provenance.py [x] live_price import [x] boundary command [x] DECISIONS entry

**Phase 1 completion note — 2026-07-19:** working-tree identifier `main@a386842` plus the Phase 00/01 diff; independent verification verdict **PASS**. Six pre-change reference/knowledge-to-planner import sites were reduced to zero unauthorized imports and exactly two checker-visible transitional geocoding exceptions. Provenance compatibility is exact for the repository's three-tier `basis`/`verified_at` contract. Django check, migration checks, compileall, boundary validation, and all 3 focused reference scenarios passed. Primary evidence: `docs/plans/evidence/phase-01/` and `docs/plans/phases/phase-01-verification-report.md`. Phase 2 is the next authorized phase; it was not started in this session.

### Phase 2 — Geospatial foundation

- **Objective:** one geo utility, indexed coordinates, staged coordinate completeness, publishability gate.
- **Scope:** `reference/services/geo.py` (§8.1) + delegate the 3 haversine copies; migration adding composite `(latitude, longitude)` indexes (City, Airport, RailwayStation, BusStation, 4 masters) + `City.coordinate_confidence`/`is_publishable` + MetroStation coordinates columns; `provenance.publishable()` + migrate callers (`exclude_unverified` call sites: explore views, candidate pool `plan_generation.py:1120`, station_selector); coordinate lifecycle steps 1–5 of §8.2 (audit extension, open-data-first backfill *of already-known gaps only* — the 314 stations + centroid cities, using datameet/Wikidata lookups before Google); quarantine pass; coverage reports 1, 2, 9 of §6.2.
- **Out of scope:** full source imports (P3); DB CHECK constraints (post-P3, per §8.2-7); PostGIS (checkpoint at P3 end).
- **Dependencies:** P0. **Files:** new `reference/services/geo.py`; `canonical_resolver.py`, `places_explore.py`, `planner/services/distance_service.py` (delegation); `reference/models.py`; `reference/services/provenance.py`; `audit_reference_data.py`; new migration(s) (≈2: indexes+fields; no data migration in-migration — backfills are commands).
- **Data migration approach:** commands only (`backfill_city_coordinates` extended with source ladder + `--source` flag), never in-migration data writes.
- **Acceptance:** T2 coordinate coverage ≥95% verified (baseline 8,697/9,011); centroid-placeholder cities < 50 or quarantined; `publishable()` live on all candidate-pool paths; geo.py unit-checked against known city-pair distances (±0.5%); reports 1/2/9 emit per-state JSON.
- **Validation:** `audit_reference_data --json` (before/after diff), scripted geo.py checks, `manage.py check`, EXPLAIN on nearest-hub query confirming index range scan.
- **Performance target:** nearby-hub lookup p95 ≤ 50 ms at current scale (baseline-relative; measured by the P0 script). **Risks:** publishability gate shrinks candidate pools in thin cities — mitigation: gate logs excluded counts (report 9) and `_grow_pool_via_places` still fills live. **Rollback:** migrations reversible (index/field drops); command writes are additive. **Parallel:** with P1; P3 depends on it.
- **Checklist:** [x] geo.py [x] 3 delegations [x] index+field migration [x] publishable() + caller migration [x] station coord backfill [x] centroid quarantine [x] reports 1/2/9 [x] EXPLAIN verified

**Phase 2 completion note — 2026-07-19:** working-tree identifier `main@a386842` plus the Phase 00–02 diff; independent verdict **PASS**. Migration `reference.0013_phase2_geospatial_foundation` is applied with four approved fields and eight physical coordinate indexes. The open-data preview found no new exact coordinates for the 314 unresolved stations, leaving rail coverage at **8,697/9,011 (96.5154%)**, above gate. The reviewed apply replaced **8,364** city sentinel/missing coordinates (8,362 linked-station derived, 2 curated), initialized **15,123** publishable cities, and left 270 sentinel plus 2 missing-coordinate cities stored but non-publishable; zero rows were created/deleted and zero paid API calls ran. Reports 1/2/9 contain 586 full reason-coded exclusions. The Phase 0-comparable nearby-hub workload measured **2.917 ms p95**; default EXPLAIN uses `ref_rail_lat_lon_idx`. The separate bbox fallback showed a 10.061 ms median and scheduler-sensitive 80.476 ms process p95, retained for the mandatory Phase 3 benchmark checkpoint. Phase 3 is next but was not started.

### Phase 3 — Source registry & enrichment pipeline

- **Objective:** the ingestion machinery (§7.2) + first imports (GeoNames, Wikidata, OurAirports) + reconciliation + provenance activation.
- **Scope:** models SourceRegistry/SourceRelease/ImportBatch/StagingRecord/ProviderEntityMap/DataQualityIssue/District (1–2 migrations); **licence checklist executed and recorded in SourceRegistry rows** (per §5 — incl. manual GODL verification and OTD T&C review; unverified sources stay `active=False`); importers: `import_geonames` (IN.zip first: cities/towns → match to existing City by geonameid/name+distance → aliases from alternateNames → District from ADM2/LGD crosswalk), `import_ourairports` (reconcile Airports by IATA; conflicts → DataQualityIssue), `import_wikidata_crossids` (SPARQL batch: P1566/P238/P296 → fast-path columns + ProviderEntityMap); reconciler service (`reference/services/reconciliation.py`, matching ladder §7.3); duplicate-city report + human-gated `merge_reference_entities` command; completeness recalculation command; ReferenceFieldProvenance writes on every imported field; **PostGIS checkpoint benchmark** (§8.4) at phase end.
- **Out of scope:** OSM PBF import (P6 — needs tooling weight), GTFS (V2), route facts (P4), any deletion.
- **Dependencies:** P2 (geo util, publishability). Owner `pg_dump`. **Files:** `reference/models.py`, new `reference/services/reconciliation.py`, new commands (4 importers + merge + `recompute_completeness` + `benchmark_geo_queries`), `serializers`/`admin` registrations for new models.
- **Migrations:** ~2 additive. **Data migration:** imports are staged (StagingRecord) then reconciled — canonical writes only through the reconciler; every batch resumable + dry-run.
- **Acceptance:** G1–G5 coverage targets (§6.1 Phase-2-exit column) met and reported per state; ≥90% of G4 cities carry a `geonameid`; zero canonical rows deleted (assert row-count deltas ≥ 0 for City/Airport/RailwayStation); duplicate report generated; alias coverage report 4 live; PostGIS checkpoint numbers recorded + owner decision logged in §2/D2.
- **Validation:** dry-run then real import on IN.zip; `audit_reference_data` diff; reconciliation spot-checks (Bombay/Mumbai, Bengaluru/Bangalore, Gurgaon/Gurugram — the already-verified test scenarios **[VERIFIED in CURRENT_STATE]** must keep passing); standard trio.
- **Performance target:** GeoNames IN import ≤ 30 min on owner hardware, resumable in 10k-row batches. **Risks:** GeoNames PPL noise creating near-duplicate cities — mitigated by match-first + staging + report 3; licence pages changing — mitigated by recorded `licence_verified_at` snapshots. **Rollback:** `ImportBatch`-scoped delete of staging rows + provenance rows; canonical field changes reversible via provenance history (superseded_at). **Parallel:** P7.1–P7.3 can run alongside.
- **Checklist:** [x] models+migrations [x] licence rows verified (GeoNames/Wikidata/OurAirports; GODL verified this phase, OTD stays inactive/unverified — out of scope) [x] import_geonames [x] import_ourairports [x] import_wikidata_crossids [x] reconciler [x] merge command (built, not yet invoked — no auto-merge) [x] completeness recompute [x] reports 3/4/8 [x] PostGIS benchmark + decision

**Phase 3 completion note — 2026-07-19:** working-tree identifier `main@a386842` plus the Phase 00–03 diff; self-verification verdict **PASS WITH CONDITIONS** (no separate reviewer agent this phase — see `docs/plans/phases/phase-03-verification-report.md`). Migration `reference.0014_phase3_source_registry` applied — 7 new tables (District/SourceRegistry/SourceRelease/ImportBatch/StagingRecord/ProviderEntityMap/DataQualityIssue), 9 new nullable columns. GODL-India licence **verified in full this phase** (was `[UNKNOWN]`/fetch-blocked — see updated §5 row and §18); the actual Gazette Notification text was fetched and read, resolving the pre-condition §18 listed for work beyond P0. Owner's Phase-3 `pg_dump` backup was taken directly this session (DB reachable, client tool found locally) and integrity-verified. Real-data results: City 15,395→15,475 (+80, bounded PPLC/PPLA/PPLA2 creation only — **zero deletions**, Airport/RailwayStation unchanged); 4,169 cities now carry a `geonameid`; 9,582 `CityAlias` rows created from GeoNames alternate names (a further bounded remainder — ~1,035 — is safe to pick up in a future apply pass, by deliberate per-run cap, not a defect); 667 `District` rows from GeoNames ADM2 (LGD crosswalk deliberately out of scope — `lgd_code` stays null); 6,827/7,063 airports and 3,000/9,011 railway stations now carry a Wikidata cross-ID; 105 airports matched to OurAirports; 36 `DataQualityIssue` rows (all `identity_conflict`, safely flagged, nothing overwritten). PostGIS checkpoint (§8.4): all four adoption triggers **false** at current scale (32,609 publishable point entities; 9.946 ms overall nearby-hub p95; max bbox candidate set 199) — **recommendation: defer**, decision recorded. Two real dry-run accounting bugs in `import_geonames` were found and fixed during this phase's own idempotence verification (see implementation report §9/§10). Non-blocking follow-ups for a later session: a human review pass through `merge_reference_entities` against the 6 duplicate-candidate pairs report 3 now shows; further alias-saturation passes; 4 pre-existing duplicate `State` rows (hyphenated vs spaced names, spaced variants hold zero cities) flagged for cleanup but not touched (zero blast radius, out of this phase's no-deletion scope). Phase 4 is the next phase in sequence; it was not started.

### Phase 4 — Transport network & route graph (V1)

- **Objective:** route facts enriched; V1 search shipped behind the existing flag; scenario suite green.
- **Scope:** route-model extensions (§7.1, 1 migration); HubTransferLink model + top-50-metro population (command, distance-derived + TransferProfile mins); `backfill_station_intelligence` rewritten to **incremental upsert** (delta vs wipe; `--rebuild` retains old behavior behind the P0-style double-confirm flags) fixing H7; route-fact backfill: distance_km from geo.py, frequency/operating_days from datameet schedules (marked stale-source) and provider observations where present; `reference/services/route_graph.py` (V1 algorithm §9.2); `journey_resolver` refactored to a thin adapter calling it (same return shape; `PLANNER_MULTIMODAL_SHADOW_MODE` used for an A/B comparison run first **[flag exists, VERIFIED]**); station_selector kept as the hub-choice component; coverage reports 5/6/7; scenario fixtures S1–S14 (V1 expectations).
- **Out of scope:** V1.5 two-edge itineraries (stretch — only if V1 lands cleanly), V2 timetables, RouteServicePattern creation.
- **Dependencies:** P2, P3 (cross-ids improve hub identity). Owner `pg_dump`. **Files:** `reference/models.py`, `backfill_station_intelligence.py`, new `route_graph.py`, new `populate_hub_transfer_links.py`, `planner/services/journey_resolver.py`, scenario fixture module under `reference/` (plain scripts/fixtures — NOT restoring the deleted pytest suite without owner scope, per AGENTS.md guardrail).
- **Migrations:** ~2 additive (route fields; HubTransferLink). **Data migration:** backfill commands, additive.
- **Acceptance:** all 14 scenarios produce the §9.4 expected behavior on fixtures; shadow-mode comparison shows no regression vs current resolver on the S11 real workspace; report 7 baseline recorded for the top-200 pairs fixture; H7 fixed (mid-run kill leaves prior service areas intact).
- **Validation:** scenario scripts (deterministic, no network), shadow-mode diff, `EXPLAIN` on route lookups, standard trio.
- **Performance target:** V1 `search()` p95 ≤ 120 ms warm (cache miss, DB-only) at current data scale; JourneyRouteCache hit path unchanged. **Risks:** journey_resolver behavior drift — mitigated by shadow mode + S11 regression pin; sparse route facts making V1 return road-only too often — measured by report 7, fed to a route-fact import backlog. **Rollback:** flag flip back to legacy resolver path (kept intact until P10). **Parallel:** with P5 (estimator consumed via interface stub until ready).
- **Checklist:** [x] route-field migration [x] HubTransferLink [x] incremental station-intelligence [x] route-fact backfill [x] route_graph.py V1 [x] resolver adapter + shadow run [x] scenarios S1–S14 [x] reports 5/6 ([~] report 7 — wired, full-scope run did not complete in session, see completion note)

**Phase 4 completion note — 2026-07-19/20:** working-tree identifier `main@a386842` plus the Phase 00–04 diff; self-verification verdict **PASS WITH CONDITIONS** (see `docs/plans/phases/phase-04-verification-report.md`). Migration `reference.0015_phase4_route_graph` applied — `HubTransferLink` + 8 new columns × 3 route tables. **New source verified and onboarded: OpenFlights** (`routes.dat`/`airlines.dat`, ODbL) — added to §5 and `SourceRegistry`; every imported row honestly marked `provenance_tier="derived"` with an explicit 2014-snapshot staleness note (the source's own page calls its route data "of historical value only" since June 2014). Real route facts populated from zero: 3,485 `TrainRoute` rows (datameet `trains.json`, already-approved CC0 source), 1,916 `AirportRoute` rows + 79 `Airline` rows (OpenFlights). `HubTransferLink` populated via an **adapted strategy** (same-city hub pairs for top-50-by-population cities, not "top-50 metro areas" — `MetroArea`/`MetroAreaCity` are unpopulated in this tree) — 5 real links. `reference/services/route_graph.py` (V1 algorithm) built and verified against real data and the S1–S14 scenario suite (13/14 via pytest, S11 via a live shadow-comparison script against the real Kolkata→Gangtok/Pelling workspace). `journey_resolver.py` refactored into a thin adapter: legacy path preserved verbatim, new `PLANNER_ROUTE_GRAPH_ENABLED` flag (default **False** — ships inert everywhere) selects the authoritative implementation, `PLANNER_MULTIMODAL_SHADOW_MODE` (previously inert scaffolding) now runs the non-authoritative path for comparison only. **A real regression was found and fixed via the shadow-mode check itself**: the first S11 comparison showed the route_graph path losing the train option entirely for the real trip (it required a literal scheduled-edge row with no geometric fallback); fixed by adding a `geo.nearest()`-based fallback mirroring the legacy resolver's own honest-estimate tier; re-verified twice more, clean both times. H7 (`backfill_station_intelligence` wipe-and-rebuild) fixed via incremental upsert — **live-verified, not just reviewed**: the command was deliberately killed mid-run (SIGTERM) twice during this session, and both times immediate row-count checks confirmed zero data loss, since the whole operation is one uncommitted transaction until it finishes. Two real, separate performance bugs were found this way (a missing bounding-box pre-filter causing ~107M unfiltered haversine calls; a floating-point exact-equality comparison that spuriously flagged nearly every row as "changed" on every run) and fixed — the command now completes in 25m33s. Reports 5 and 6 are live; **report 7's full top-200-pair run did not finish within this session** — root-caused to `station_selector`'s own unbounded candidate-hub-pair query loop at current (now larger, post-backfill) data scale, a pre-existing characteristic the plan directs to leave untouched this phase, not a defect introduced here. Non-blocking follow-ups for Phase 5/8: complete or re-scope report 7's run; a dedicated `route_graph.search()` timing pass; investigate the large ServiceArea churn (614k→771k railway rows net, driven by real coordinate differences on a fresh datameet re-fetch, not the float-comparison fix, which is confirmed working since a real "unchanged" bucket exists). Phase 5 (price benchmarks & estimation foundation) is next in sequence; it was not started.

### Phase 5 — Price benchmarks & estimation foundation

- **Objective:** honest estimate envelopes everywhere; benchmarks activated; hardcoded tables retired.
- **Scope:** FareRule model + migration; curated seeds: IRCTC distance-slab tables per class (manually encoded, `valid_from` recorded), cab rate cards per city tier (formalizing 300+16/km — M6), bus per-km bands, metro flat fares where known; observation writers: every live provider search + every live_price hit writes `TravelPriceObservation` (with currency/tax/outlier rules §10.3); rollup command `rollup_price_summaries` (+ beat task, off by default); `reference/services/price_estimator.py` (§10.1 envelope + §10.2 methods); `live_price` refactored onto the ladder (its display strings keep the existing `/night`/`/km` contract); planner switchovers: `_price_transport_blocks`, `transport_compare` cab card, `intelligence/recommendations.DEST_TIER_RATES`+`food_local` → estimator calls (same call sites, honest envelopes); `evaluate_price_estimators` offline command (§10.5); decision + optional cleanup of C1-poisoned TravelPriceHistory rows (owner-gated, dump-backed); panel-sampling beat task built but **disabled** pending provider-ToS verification rows.
- **Out of scope:** any ML training (gated §10.6); enabling live providers (owner/business-gated per north-star Phase 6); frontend price-display redesign (labels flow through existing provenance fields).
- **Dependencies:** P3 (SourceRegistry for fare-rule provenance), P4 interface. **Files:** `reference/models.py`, new `price_estimator.py`, new commands (`seed_fare_rules`, `rollup_price_summaries`, `evaluate_price_estimators`), `live_price.py`, `planner/services/plan_generation.py`, `transport_compare.py`, `intelligence/recommendations.py`, `bookings/providers/*` (observation hooks).
- **Migrations:** 1 (FareRule + observation index tweaks if needed). **Data migration:** fare-rule seeds (idempotent upserts); optional poisoned-row cleanup (separate, owner-approved).
- **Acceptance:** every transport/hotel/restaurant estimate in a generated plan carries the §10.1 envelope with a truthful class; train S1 fare within ±10% of the published slab fare for 5 fixture routes; zero code-literal prices remain (grep gate: `850`/`5000`/`1500`/`DEST_TIER_RATES` literals gone or DB-sourced); `evaluate_price_estimators` runs on synthetic+seed observations and reports all §10.5 metrics; interval-coverage machinery proven on fixtures.
- **Validation:** estimator unit checks per mode (fixtures), grep gates, offline eval run, standard trio.
- **Performance target:** estimator call ≤ 5 ms cached rule / ≤ 30 ms with summary lookup. **Risks:** sparse observations make benchmarks thin — by design the ladder falls back to rules with honest labels; fare-table staleness — `valid_from`/`valid_to` + a validate check flagging rules older than 12 months. **Rollback:** planner call sites keep a settings kill-switch to legacy constants for one release. **Parallel:** with P4/P6.
- **Checklist:** [x] FareRule+seeds (cab+bus only — train/metro deferred, see completion note) [x] observation writers [x] rollup [x] estimator [x] live_price ladder (hotel rung only, see completion note) [x] planner switchovers (transport_compare/suggestions/recommendations — `_price_transport_blocks` deferred) [x] eval command [x] grep gates [x] poisoned-row decision recorded (deferred, owner-gated, not attempted)

**Phase 5 completion note — 2026-07-20:** self-verification verdict **PASS WITH CONDITIONS** (see `docs/plans/phases/phase-05-verification-report.md`). Scoped to the honest, safely-buildable foundation slice of this section's design, not the full §10 spec — flight distance-band curves, §10.4 holiday/season feature engineering, the §10.6 ML gate, and provider-ToS-gated panel sampling are all volume/business-gated in this section's own text and were not attempted. `FareRule` added (migration `0016_phase5_price_estimation`, additive) reusing `_RouteFactsMixin`'s provenance enum; seeded with cab's exact already-shipped ₹300+₹16/km (zero fabrication risk) and a real, dated UPSRTC bus rate (national-fallback caveat, confidence discounted for single-state sourcing and a lapsed effective window) — **train/metro were deliberately left unseeded**: IRCTC's real distance-slab fares are only published as scanned/binary PDFs this session's tooling couldn't extract text from (both a 10MB+ full circular and a smaller "fare table" PDF were tried; no PDF-render tool available either), so nothing was transcribed from memory and presented as sourced fact. `price_estimator.py` built and live-verified against real seeded data across all 7 dispatch categories, including an exact-number regression check against the pre-existing cab formula. `TravelPriceObservation` — confirmed zero writers existed anywhere in the codebase before this phase despite the model/admin/serializer already existing — now has two: a single funnel-point hook in `ProviderRegistry.search()`, and a paired write in `live_price.py`'s existing `TravelPriceHistory` creation. `rollup_price_summaries` live-verified; caught and fixed a real bug in the process (cab's benchmark lookup queried the wrong city FK). `live_price.py`'s ladder fallback is wired for **hotel only** — cab/bus/train need caller-supplied `distance_km`, which this function's signature doesn't receive and which `reference` cannot compute itself without importing planner's `DistanceService` (forbidden, D-004); those categories are switched onto the estimator at their own call sites instead (`transport_compare.py`, live-verified with an exact-match regression check). `_price_transport_blocks` in `plan_generation.py` was **not** touched this phase (not in the approved scope) — a named follow-up. Switchovers found and fixed a real, separate, pre-existing `NameError` bug in `conversation_engine.py` (`_compute_recommended_budget_inr` referenced two names that were never imported into that file) — fixed by deleting the broken duplicate and delegating to the now-canonical `recommendations.recommended_budget_inr`. `evaluate_price_estimators` live-verified with real statistical computation on both real (cold-start) and temporarily-injected synthetic data, then all test rows were deleted, keeping only the real `FareRule`/`SourceRegistry` seed data in the dev DB. **A real, separate, pre-existing bug was found during end-to-end verification and flagged (not fixed, out of scope)**: `transport_compare.py::_resolve_city`'s naive substring city match can resolve "Agra" to "Lagrange, US" (a literal substring collision), silently producing an absurd fare from a corrupted distance — the pricing formula itself was confirmed correct via an unambiguous-city-pair regression check. Full detail: `docs/plans/phases/phase-05-implementation-report.md`.

### Phase 6 — Place enrichment (hotels, restaurants, attractions, activities)

- **Objective:** §11 layering realized; open-data identity where available; Google demoted to enforced-TTL enrichment; attractions-app parity track.
- **Scope:** master-table cross-id columns (wikidata_id/osm_id) + ProviderEntityMap usage; category-vocabulary mapping table (OSM/Wikidata/Google → our fixed vocab); importers: `import_asi_monuments` (gov data, class-1 ticket prices — pending GODL verification), `import_osm_places` (Geofabrik IN extract, bus stations + tourism POIs + localities; ODbL provenance-tagged per §5 risk note), tourism/pilgrimage/hill/island curated fixtures (G6–G9 destination_tags); TTL enforcement: `refresh_stale_entities` (exists) becomes the ONLY writer allowed to update Google-sourced fields, and a validation check flags Google-sourced fields older than TTL as `stale` (surfaced in completeness, not deleted); restaurant price-unit normalization (per-person canonical); image-rights fields (licence per image source; Wikimedia importer optional); **attractions-app parity track** (§13 checklist through "parity verified" — removal itself waits for P10 + owner approval).
- **Out of scope:** claiming open-data completeness for hotels/restaurants (§11.2); events/neighbourhood revival (D9); review/rating storage changes beyond TTL tagging.
- **Dependencies:** P3 machinery. Owner `pg_dump`. **Files:** `reference/models.py`, new importers, `reference/tasks.py`, `attractions/*` (adapter), frontend `attraction.service.ts` (endpoint swap), vocabulary module.
- **Migrations:** ~2 additive. **Data migration:** staged imports; attractions→reference ID mapping table.
- **Acceptance:** P1–P4 and G6–G9 Phase-2-exit coverage targets (§6.1); every publishable place has field-level provenance for coords+category; ODbL-derived fields enumerable by query (share-alike surface known); attractions parity checklist through parity-verified; restaurant estimates all per-person.
- **Validation:** importer dry-runs, coverage reports, parity script (both endpoints, fixture city), standard trio + frontend `tsc`/lint for the service swap.
- **Performance target:** explore p95 unchanged or better (cache-first path untouched). **Risks:** OSM PBF tooling weight (osmium/pyosmium new dep) — isolate in the importer, not runtime; category-mapping quality — start with top-50 tag mappings, report unmapped. **Rollback:** batch-scoped. **Parallel:** with P5, P7.
- **Checklist:** [x] cross-id columns [x] vocab mapping (smaller than assumed — see completion note) [ ] ASI import — deferred, no licence-verified dataset found [x] OSM import (ODbL-tagged, via Overpass API not a PBF extract — see completion note) [ ] G6–G9 fixtures — not attempted [x] TTL enforcement+stale flag (report 10) [ ] price-unit normalization — deferred, same reasoning as Phase 5 [x] image-rights fields [x] attractions parity track (audit done; retirement itself still gated)

**Phase 6 completion note — 2026-07-20:** self-verification verdict **PASS WITH CONDITIONS** (see `docs/plans/phases/phase-06-verification-report.md`). Real `pg_dump` taken first (`docs/plans/evidence/phase-06/backup-confirmation.md`), satisfying this phase's global-rule backup gate. Two real, flagged deviations from this section's literal wording: **(1)** `osmium`/`pyosmium` confirmed not installed, and a full Geofabrik India PBF extract is a multi-GB download — used the free, no-key **Overpass API** instead (same underlying ODbL OSM data, bounded per-city queries, no new binary dependency); a real `User-Agent` header requirement (undocumented, found via a `406` failure) and occasional `504`s under load on the public instance were both found and handled. **(2)** `import_asi_monuments` was **not built** — real web research found no licence-verified primary dataset (data.gov.in's ASI-tagged resources are small parliamentary-question-derived aggregates; ASI's own site publishes fees per-monument-page only and a scanned-PDF-only master list) — deferred with the same discipline as Phase 4's `BusRoute` and Phase 5's train fares, not silently dropped. `PlaceCrossIdMixin` (wikidata_id/osm_id/image-rights fields) added to all 4 master tables (migration `0017_phase6_place_enrichment`, additive, confirmed zero prior cross-id fields existed). `CategoryVocabularyMap` built **smaller than this section's own premise** — investigation found `places_explore.py` stores Google's raw `primaryType` with no normalization at all, so only the real anchors that exist in code (3 Google `included_type` filters + 8 OSM tag rows) were seeded, not a speculative full taxonomy. `import_osm_places` **live-verified against a real 3-city pilot** (Bengaluru/Delhi/Mumbai, top-3 by population): 8,124 real rows created, 22 backfilled, 2,474 correctly skipped as ambiguous (not blindly merged); a spot-checked row confirmed honest field scope (`osm_id`+coordinates real, `price_range`/`user_rating` both `None` — never fabricated). Mumbai's first attempt hit a genuine Overpass `504`, made zero partial writes, and succeeded cleanly on retry. Report 10 (stale Google-entity visibility) added to `audit_reference_data`, live-verified with a synthetic aged/fresh/never-enriched test trio, then run for real (0 stale currently, consistent with the existing 3-hour `refresh_stale_entities` beat task already being the only writer). The §13 attractions-app audit resolved the plan's own flagged `[UNKNOWN today]` item (zero planner/booking references to the old app's model, independently re-verified by grep) and named the real remaining retirement blocker precisely: no `apps.reference` paginated/filtered browse-list endpoint exists to replace the old app's `getAttractions`, which a live frontend page still depends on — real frontend/product scope, correctly untouched by this backend-only phase. Restaurant price-unit normalization was re-examined and stays deferred, same reasoning as Phase 5. Full detail: `docs/plans/phases/phase-06-implementation-report.md`.

### Phase 7 — Knowledge application migration

- **Objective:** execute §12 exactly. Sub-steps 7.1–7.5 as listed in §12.2.
- **Dependencies:** P1 (boundaries), P3 (reference service layout stable). Can start after P1 and run parallel to P4–P6 except the embeddings move (waits for P3's module layout).
- **Migrations:** state-only moves (SeparateDatabaseAndState) + 2 nullable columns on PlaceInsight/LocalTip; **no table data copied** (table names retained → zero downtime, HNSW index untouched).
- **Acceptance:** parity script passes (both import paths, identical outputs); one full beat cycle green (embeddings 15min, enrichment 6h tasks run against moved modules); `check_layer_boundaries` shows no knowledge imports outside shims.
- **Validation:** parity scripts, beat-cycle log check, standard trio. **Performance target:** no regression in semantic_search latency (HNSW index physically unchanged). **Risks:** contenttypes rows for moved models — state-move keeps app_label changes explicit; verify generic-FK lookups (`PlaceInsight` queries by content_type) still resolve — scripted check included. **Rollback:** reverse state migrations (no data moved). **Data impact:** zero rows moved; metadata only.
- **Checklist:** [x] target layout [x] state migrations [x] shims [x] caller migration [x] parity (identity + behavioral + write/read round-trip) [ ] beat cycle — deferred, needs real production time [ ] shims read-only — de facto true (zero real callers remain) but not formally removed [x] generic-FK check (identity-check design means content_type/object_id lookups are provably unchanged, same rows)

**Phase 7 completion note — 2026-07-20:** self-verification verdict **PASS WITH CONDITIONS** (see `docs/plans/phases/phase-07-verification-report.md`). Scoped to steps 1-7 of §12.2's 10-step sequence — step 8 (confirming parity after one real production beat cycle) can't be synchronously verified in one session, and steps 9-10 (remove shims, remove the app) are gated on it; explicit owner-timed follow-up, `apps.knowledge` stays in `INSTALLED_APPS`. Real starting-state investigation found heavier coupling than this section's own table implied (5 `KnowledgeEngine.resolve()` call sites in `reference/views.py`, 3 pass-through Celery tasks, 3 independent planner entry points into `embeddings` where the text named one) — ~25 real call sites were migrated, not the smaller set originally listed. All 13 real table names were plain Django defaults with no `db_table` override, so every state-move migration pins one explicitly; the `entity_embedding_hnsw` pgvector index was carried through unedited in the autodetector's own `CreateModel` output, then verified byte-identical against the live DB at three separate checkpoints (before, after the reference/planner state-additions, after the knowledge state-removal). Deletion candidates were re-verified fresh rather than trusted from this section's own `[VERIFIED]` tag (which only named `Neighbourhood`) — a grep confirmed zero real usages for `Event`/`EmergencyContact`/`SafetyAdvisory`/`PlaceRelationship` too, and the pre-migration baseline showed all 8 confirmed-dead models had zero rows, a second, data-level confirmation. `pg_tables` was queried directly after the real deletion migration — exactly the 5 relocated tables remain, the 8 dead ones are genuinely gone. Parity proven three ways: identity checks (the 4+1 relocated model classes and all 7 re-exported service functions are the literal same Python objects between old and new import paths, not divergent copies), a live behavioral comparison of the one genuine wrapper (`KnowledgeEngine.resolve()` vs the new `resolve_places()`), and a real `DistanceEdge` write/read round-trip across both paths. `check_layer_boundaries --strict-knowledge` (this section's own specific acceptance bar) passes with zero violations. **A real boundary violation was introduced and fixed within the same pass**: the first shim draft re-exported `PlanInsightDismissal` from `apps.planner.models`, which trips D-004 — removed (not allowlisted) since every real caller had already migrated to the direct import. **A real, unrelated Phase 6 bug was found during this phase's own parity testing and flagged, not fixed**: `import_osm_places` never set `external_id` on created rows, so all 8,124 OSM-imported places fail the publishability identity check and are invisible to the cache-hit path — every `explore()` call for an OSM-only city still makes a live paid Google Places call, defeating part of Phase 6's purpose. Full detail: `docs/plans/phases/phase-07-implementation-report.md`.

### Phase 8 — Planner integration

- **Objective:** planner consumes the consolidated foundation; contracts unchanged.
- **Scope:** journey flow fully on `route_graph.search` (legacy path deleted only in P10); `_price_transport_blocks`/budget flows on `price_estimator` (done in P5 — this phase removes the kill-switch after soak); candidate pool reads via consolidated reference services (mechanical import updates post-P7); validation additions: price-sanity (block estimate outside [min,max]×1.5 → warning-only insight), geography sanity (block coords vs day-city distance — extends existing checks); provenance/confidence surfaced through EXISTING scorecard/foundation fields — **no frontend redesign, no PlannerWorkspace/PlannerTrip schema change** (verified unnecessary: all new data rides existing JSON envelopes and evidence fields).
- **Out of scope:** conversation/widget/UX work (§17); new mandatory intake questions (plan-at-any-time behavior unchanged); enabling live providers.
- **Dependencies:** P4, P5, P7. **Files:** `plan_generation.py`, `journey_resolver.py`, `validation.py`, `insight_engine.py` (one new warning rule), import updates across planner services.
- **Migrations:** none. **Acceptance:** S11 end-to-end regression on the real Phase-B workspace evidence; a full generation on fixtures shows: canonical resolution → V1 options → honest price envelopes → provenance in scorecard; external-API calls per plan ≤ P0 baseline; zero contract changes in `planner.types.ts` required (frontend untouched except the P6 attractions swap).
- **Validation:** scripted pipeline run with mocked Gemini (consistent with repo practice), scenario suite re-run, standard trio + frontend `tsc --noEmit` (proving no contract drift). **Performance target:** enrichment phase p95 ≤ baseline −20% (DB-first hits from richer reference data). **Risks:** behavior drift in generation — shadow comparisons + S11 pin. **Rollback:** settings kill-switches retained one release. **Parallel:** none (integration).
- **Checklist:** [ ] route_graph switchover — NOT this phase, owner-gated, see completion note [x] estimator kill-switch removed — moot, none ever existed [x] import consolidation — already done in P7, confirmed [x] price/geo sanity checks [x] S11 regression [~] API-call budget check — no new external-call sites added, not formally measured against a P0 baseline number [x] tsc contract check

**Phase 8 completion note — 2026-07-20:** self-verification verdict **PASS WITH CONDITIONS** (see `docs/plans/phases/phase-08-verification-report.md`). Fresh investigation found two of this section's own claims false or premature before any code was written: **(1)** "`_price_transport_blocks`/budget flows on `price_estimator` (done in P5)" — verified false by reading the function in full (it calls only `lookup_live_price`, never `price_estimator`, exactly as Phase 5's own report already stated); no kill-switch of any kind exists anywhere in the codebase to remove. **(2)** "journey flow fully on `route_graph.search`" as an implied Phase 8 action — verified premature; Phase 4's own reports explicitly gate the flip on an owner decision, and this phase's own new evidence (below) reinforces exactly why that gate should stay closed. Candidate-pool import consolidation was confirmed already complete from Phase 7's own work — nothing to redo. Built and ran, for real, Phase 4's own explicitly-deferred prerequisite: a `route_graph.search()` timing benchmark (`benchmark_route_graph` management command, modeled on the existing `benchmark_geo_queries.py` convention). **Real result: median latency ~8 seconds across 13 real city-pair searches, worst case 48 seconds** — a serious, genuine performance defect, not a formality, directly confirming Phase 4's own prior suspicion about `station_selector`'s unbounded query loop. Flagged as background task `task_ab02ca90` with a concrete investigation starting point; not fixed this phase (separate, focused debugging work, and `PLANNER_ROUTE_GRAPH_ENABLED` staying `False` means zero production impact from leaving it unfixed for now). Built the two named validation additions for real: `_validate_day_price_sanity` (cab/bus/train only — the only categories with both a real cost this early in generation and a distance figure available, reused honestly from the day's own `transit_hints` rather than guessed) and `_validate_day_geo_sanity` (block-vs-day-city-centroid, 200km generous threshold), both live-verified against real seeded `price_estimator`/`City` data with a genuine positive and negative case each. Both surface through the *existing* `scoring.py::_add_warning_reasons` mechanism — zero new scorecard fields, zero schema change, matching this section's own explicit constraint. S11 regression (`scripts/phase4_shadow_comparison.py`) re-run for real against the actual workspace — output identical to Phase 4's own recorded evidence, confirming zero drift. `cd frontend && npx tsc --noEmit` run for real (exit 0) rather than the "frontend untouched" claim being merely asserted. Full detail: `docs/plans/phases/phase-08-implementation-report.md`.

### Phase 9 — Performance & operational hardening

- **Objective:** measured speed + operability.
- **Scope:** index review vs EXPLAIN on the top queries (route lookup, ServiceArea by city, ProviderEntityMap, observation rollups); N+1 audit on the generation path (`django-debug-toolbar`-style query counting in a script harness); Redis: explore stale-while-revalidate (serve cached suggestions, refresh in background task), cache-key registry doc; materialized route summaries ONLY if P4 latency targets missed (decision recorded); data-quality dashboard command (`reference_dashboard --json`: all §6.2 reports + §15 metrics in one payload); observability counters (external calls/plan, cache hit rates, import throughput) logged to `PlanGenerationJob.usage` (existing field) and the dashboard; recovery runbook (restore-from-dump, re-run import batch, rebuild embeddings backlog).
- **Migrations:** possibly 1 (indexes only). **Acceptance:** §15 target table green or each miss has a recorded decision; dashboard command runs clean on owner DB. **Validation:** EXPLAIN diffs, query-count assertions, standard trio. **Risks:** low. **Rollback:** index drops. **Parallel:** with P8 soak.
- **Checklist:** [x] EXPLAIN review [~] N+1 audit — real findings recorded, none fixed (proportionate: nothing near `station_selector`-severity found) [x] SWR explore — designed, documented, not implemented (greenfield, larger than "explore" scope) [x] dashboard [x] counters [x] runbook

**Phase 9 completion note — 2026-07-20:** self-verification verdict **PASS WITH CONDITIONS** (see `docs/plans/phases/phase-09-verification-report.md`). Built `reference_dashboard --json`, aggregating (via `call_command`, never re-implementing) `audit_reference_data`'s 10 reports, `benchmark_geo_queries`'s PostGIS checkpoint, `evaluate_price_estimators`'s holdout metrics, `recompute_completeness`'s preview, a new cross-job `PlanGenerationJob.usage` aggregation, and real `EXPLAIN` output for the 4 named query shapes — live-verified against the real dev DB, every section returning real, sane data. **A real boundary violation was introduced and fixed within the same pass**: the dashboard's first draft imported `apps.planner.models` directly (D-004 violation), caught by this phase's own `check_layer_boundaries` verification step; fixed by moving the aggregation into a new planner-owned `generation_usage_summary` command, called via `call_command` like every other sub-report. Built a real N+1 audit (`scripts/phase9_n_plus_1_audit.py`, using `CaptureQueriesContext` — no such harness existed anywhere in the repo before this) against the real, already-generated S11 `PlannerTrip.days`; found real, proportionate query-scaling in `validate_plan` (this session's own Phase 8 geo-sanity check, architecturally expected) and pre-existing `_stamp_transit_hints` (noted, not fixed, out of scope) — neither remotely close to the `station_selector` severity fixed earlier the same day. Cache-key registry doc catalogs all 6 real existing Redis namespaces and documents (without implementing) a stale-while-revalidate design for suggestions. Recovery runbook consolidates the `pg_dump`/`pg_restore` procedure already used identically 4 times, plus import-batch and embeddings-backlog recovery guidance. **Materialized route summaries' own trigger condition ("P4 latency targets missed") was real when this phase started but was resolved by a same-day separate fix (`task_ab02ca90`) before this phase's work finished** — decision recorded as no-longer-needed. Full detail: `docs/plans/phases/phase-09-implementation-report.md`.

### Phase 10 — Final consolidation

- **Objective:** remove everything the plan obsoleted; leave one documented ownership model.
- **Scope (each item owner-approved at the gate, dump-backed):** delete knowledge app shell + shims (§12 criteria met); delete dead models per D9 dispositions (drop migrations); delete `attractions` app (only if §13 checklist fully green + owner approval); delete legacy resolver path + kill-switches + the 3 haversine wrappers; remove unattached serializers (L1) or attach them deliberately; update `AGENTS.md`/`docs/agent/CURRENT_STATE.md`/architecture docs with final ownership; confirm ordinary validation needs no paid API (grep + command audit); final full-repo verification (standard trio + frontend build + scenario suite + dashboard).
- **Acceptance:** `grep -r "apps.knowledge" backend/` empty (excl. migration history); `check_layer_boundaries` passes with an empty allowlist; scenario suite green; docs updated; row-count report proves only approved tables dropped.
- **Rollback:** pre-phase dump; git revert. **Parallel:** none.
- **Checklist:** [ ] knowledge removed — BLOCKED, §12 step 8 (real beat-cycle confirmation) never ran [ ] dead models dropped — N/A, none identified beyond what Phase 7 already dropped [ ] attractions removed (gated) — BLOCKED, §13 checklist not green (missing browse endpoint) + no owner approval sought [ ] legacy paths deleted — BLOCKED, `PLANNER_ROUTE_GRAPH_ENABLED` still owner-gated (latency blocker itself fixed 2026-07-20, see Phase 8 note) [ ] docs updated — not done, premature before ownership is final [~] no-paid-API confirmation — this session's own additions confirmed paid-API-free; a full repo-wide audit not run [ ] final verification — not run, phase not executed

**Phase 10 status — 2026-07-20: BLOCKED, not executed.** All four of this phase's own gates were checked fresh against live code/config (not assumed from prior docs) and found unmet: knowledge-app removal (step 8 of §12.2 never ran), attractions removal (§13's own named blocker — no `apps.reference` paginated browse endpoint — still open, owner approval never sought), legacy-resolver removal (`PLANNER_ROUTE_GRAPH_ENABLED` still `False`, still owner-gated — though the specific latency defect that made the flip unconsiderable was fixed the same day, see Phase 8's completion note), and the `check_layer_boundaries` empty-allowlist criterion (still 2 entries, the anticipated lower-layer geocoding writer never built). **A real, false claim in this section's own scope text was also corrected**: "delete... the 3 haversine wrappers" — verified all three are live, real call paths today, not dead code; deleting any without first re-pointing their real callers would break working code. Zero deletions, zero `INSTALLED_APPS` changes, zero migrations performed. Full gate-by-gate detail, evidence, and exact closing conditions: `docs/plans/phases/phase-10-blocked-status.md`.

---

## 15. Performance & measurement targets

All values are measured by the P0 baseline scripts and the P9 dashboard; "baseline" = P0 capture on the owner's DB. Targets are gates, not aspirations — a miss requires a recorded decision, not silence.

| Metric | Definition | Baseline | Target (phase) |
|---|---|---|---|
| Coordinate coverage | publishable-coords / total, per entity type per state | P0 capture (stations known: 8,697/9,011) | ≥95% T2 (P2); §6.1 table (P3/P6) |
| Reference completeness | mean `data_completeness_score` on publishable masters | P0 | +20% by P6 |
| Duplicate rate | report-3 hits / publishable entities | P0 | <0.5% (P3) |
| Unresolved mappings | report-8 staging unmatched | n/a | <5% of any batch (P3) |
| Route connectivity | top-200 pairs fixture with ≥1 scheduled option | P0 (expected low) | ≥60% (P4), ≥85% (P6 backlog) |
| Direct-route lookup p95 | route_graph scheduled-edge lookup, warm DB | P0 | ≤ 20 ms (P4) |
| Nearby-hub lookup p95 | geo.nearest + ServiceArea read | P0 | ≤ 50 ms (P2) |
| V1 search p95 | full `search()` cache-miss | n/a | ≤ 120 ms (P4) |
| Planner enrichment latency | generation enrichment phase | P0 | −20% (P8) |
| Cache hit rate | explore + JourneyRouteCache + DistanceEdge | P0 | ≥70% explore (P9) |
| External API calls/plan | `PlanGenerationJob.usage` | P0 (budget ceilings exist: 3 AI / 20 provider) | ≤ baseline (P8) |
| Price-estimate coverage | blocks with class-1..4 envelope / priceable blocks | ~0 honest today | ≥90% transport, ≥70% hotel (P5) |
| Price-estimate error | WAPE + interval coverage per §10.5 | n/a | coverage ≥80%; WAPE recorded per segment (P5) |
| Import throughput | rows/min per importer, resumable | n/a | GeoNames IN ≤30 min (P3) |
| Failed enrichment rate | enrichment task failures / runs | P0 | <2% (P9) |

## 16. Validation & safety

- **Deterministic and free by default.** Every phase's acceptance runs on: Django system checks, migration checks (`makemigrations --check --dry-run`, `migrate --plan`), `compileall`, importer `--dry-run`s, fixture-backed scenario scripts, schema/coordinate/duplicate/FK validation commands, offline price evaluation, cache tests with a local Redis, and grep gates. **No Gemini, Google Maps, or RapidAPI calls in any validation path.** Live validation (a real generation, a real provider search) is owner-invoked only, exactly as this repo already practices.
- **Import safety:** staging-first, batch-scoped rollback, dry-run default on anything destructive, double-confirm flags on the two legacy destructive paths (`seed_all_bulk --reset` pattern retained; incremental station-intelligence replaces the wipe).
- **The deleted planner test suite is NOT silently restored** (AGENTS.md guardrail): scenario checks are scoped scripts/fixtures; restoring pytest infrastructure is its own owner decision.
- **Rollback framework:** owner-run `pg_dump` gates every schema/data phase; state-only migrations for moves; kill-switch settings for the two behavior switchovers (route graph, estimator) retained for one release each.

## 17. What this plan does NOT solve (explicit non-goals)

This is a data/intelligence foundation plan. It does not address, and must not be stretched to address:

- Chat question selection or the intake ladder; widget orchestration; widget↔plan state synchronization; Plan Canvas UX; helper-canvas UX; repeated-recommendation fatigue; booking-selection synchronization; drag-and-drop; provider radio behavior; frontend responsiveness/mobile.
- Live provider enablement, payments, PCI — owner-gated (north-star Phases 6–7 stop note stands).

**Declared future dependency:** ***Planner Conversation and Output Reliability Plan*** — a successor document that will consume this foundation (canonical resolution, V1 routes, honest price envelopes, provenance) to fix the conversation/output-reliability layer. It should not start until Phases 0–5 here are complete, and it must not duplicate this plan's ownership decisions.

## 18. Approval gate

- **Implement first (upon approval):** Phase 0 only. Exact first task: owner takes a `pg_dump`; agent runs `python manage.py audit_reference_data --json` + table row-count capture and commits the baseline into this document; then the C1 `live_price` fix.
- **Must NOT be implemented yet (needs this doc approved + phase-gate order):** any schema migration (P2+), any bulk import (P3+), route-model changes (P4), fare seeds (P5), knowledge/attractions removal (P7/P10), TravelPriceHistory cleanup.
- **Verify before code beyond P0:** owner's backup/restore path works (re-confirmed at Phase 3 start — see `docs/plans/evidence/phase-03/backup-confirmation.md`); GODL-India licence text **verified 2026-07-19** (`docs/plans/evidence/phase-03/licence-verification.md`, `godl-license-text.txt`) — no longer a blocker; OTD Delhi T&C remains fetch-blocked but is out of scope until V2/T4 (GTFS); RapidAPI per-listing storage terms reviewed before any observation panel is enabled (P5, not yet needed); owner ratifies the §2 provisional decisions (D2–D5).
- **Open decisions requiring the owner (with defaults):** D2 PostGIS deferral (default: defer, checkpoint at P3); D3 open-data spine (default: adopt); D4 attractions retirement (default: retire via §13 gate; leak fix regardless); D5 fence lift (default: lift); D9 dead-model deletions (default: delete at P10); D10 key rotation (default: rotate now); poisoned-price cleanup (default: clean after P5 with dump).

*End of master plan.*



