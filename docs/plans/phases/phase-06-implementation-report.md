# Phase 6 Implementation Report — Place enrichment (hotels, restaurants, attractions, activities)

- Date: 2026-07-20, Asia/Calcutta
- Agent/platform: Claude Code (Sonnet 5)
- Status: **Complete, self-verified — PASS WITH CONDITIONS** (see `phase-06-verification-report.md`). ASI monuments deferral and the attractions-app frontend gap are the two open items; a transient Overpass 504 on the first attempt (retried successfully) is noted as an operational characteristic, not a defect.

## What was built

### 1. Pre-work: real `pg_dump` backup

Taken directly via `pg_dump.exe` (same tool/path Phases 3-4 used), non-interactive via a scratch-file-piped `PGPASSWORD` (never printed to any log), verified via `pg_restore --list` (909 TOC entries). `docs/plans/evidence/phase-06/backup-confirmation.md`. Satisfies the master plan's own global rule that Phase 6 is blocked until a backup exists.

### 2. `PlaceCrossIdMixin` + `CategoryVocabularyMap` (migration `0017_phase6_place_enrichment`, additive)

`wikidata_id`/`osm_id`/`image_license`/`image_attribution`/`image_source` added to `HotelMaster`/`RestaurantMaster`/`AttractionMaster`/`ActivityMaster` via a shared abstract mixin (mirroring `_RouteFactsMixin`'s Phase 4 convention — one cross-id vocabulary, not four separate reinventions). Confirmed via grep before writing that none of the four tables had any cross-id field previously — purely additive.

`CategoryVocabularyMap`: **built smaller than the packet's initial premise, and said so.** Investigation while building the seed command found `places_explore.py`'s field mappers store Google's raw `primaryType` string directly with **no normalization at all** — there's no rich Google-subtype → our-vocab dict to port, contrary to the master plan's assumption. Seeded instead with the real anchors that do exist in code: the three `included_type` request-filter values from `_category_config()` (google rows) and the OSM tags `import_osm_places` actually dispatches on (osm rows) — 11 rows total, all real and used by real code, none speculative.

### 3. `reconciliation.match_place_by_name_distance`

Same three-way (matched/ambiguous/unmatched) contract as the existing `match_city`, adapted for POI-level matching: normalized-name comparison done in Python (the four master tables have no stored `normalized_name` column, unlike `City`) against an already city-scoped queryset, disambiguated by a tight 0.3km threshold (vs. `match_city`'s 10km) since same-named POIs within one city are common (chain outlets) and a wrong match at POI granularity silently merges two different real places.

### 4. `import_osm_places` — Overpass API, not a Geofabrik PBF extract

**Adapted strategy, flagged in the approved plan before building:** `osmium`/`pyosmium` confirmed not installed in this environment, and a full India PBF extract is a multi-GB download — real new operational risk. Used the free, no-key Overpass API instead: same underlying OSM data (ODbL), bounded per-city radius queries. New `SourceRegistry` row (`osm_overpass`, ODbL 1.0, share-alike noted).

**A real, undocumented operational requirement was found and fixed during testing**: the public Overpass instance returns `406 Not Acceptable` for requests with no/generic `User-Agent` header (basic bot hygiene on their end) — not mentioned anywhere in Overpass's own quickstart docs I'd consulted. Fixed by adding a real, identifying `User-Agent`.

**Live-verified against real, substantial data** — dry-run first (Mumbai: 1827 elements, 1601 would-create), then a real `--apply` run across the 3-city pilot (Bengaluru, Delhi, Mumbai — the top-3 Indian cities by population):

| City | Elements | Created | Matched | Notes |
|---|---|---|---|---|
| Bengaluru | 6,274 | 4,500 | 0 | zero pre-existing rows for this city in this dev DB |
| Delhi | 3,129 | 2,290 | 7 backfilled | |
| Mumbai (1st attempt) | — | — | — | **504 Gateway Timeout** from the public Overpass instance |
| Mumbai (retry) | 1,833 | 1,334 | 15 already-current | succeeded cleanly on retry, zero side effects from the failed attempt |

**Total: 8,124 new rows created** (1,177 hotels, 6,694 restaurants, 253 attractions) **+ 22 rows backfilled** with `osm_id`/coordinates, **2,474 elements correctly skipped as ambiguous** (multiple same-named candidates within a city, not blindly merged) across the pilot. A spot-checked sample row ("The Ambassador," Delhi) confirms the honesty design goal directly: real `osm_id`/coordinates, `price_range=None`, `user_rating=None` — never a fabricated price or rating Google would normally supply, `verification_status="verified"` (a real published open dataset, same tagging convention Phase 3/4 used for GeoNames/OpenFlights-derived rows).

The Mumbai 504 is recorded here as a real, honest operational characteristic of the free public Overpass endpoint under load — not a defect in this command (which correctly recorded the per-city error, made zero partial writes for the failed city, and let a clean retry proceed with no duplicate risk).

### 5. `audit_reference_data` report 10 — stale-entity visibility

Confirmed `refresh_stale_entities` (Celery beat, every 3h) is already the only writer of Google-sourced fields on the four master tables — the real gap was visibility, not enforcement, so this report adds zero new write paths. **Live-verified with a real synthetic test**: created one artificially-aged row (`last_enriched_at` 40 days old against a 30-day TTL), one fresh row, and one never-enriched row — the report correctly flagged exactly the aged row as `stale=1` and the never-enriched row separately as `never_enriched=1`, ignoring the fresh row; test rows deleted immediately after. Run against the full real dataset post-OSM-import: `total_stale=0` across all four tables (recently-seeded/refreshed data, as expected).

### 6. Attractions-app §13 audit (`phase-06-attractions-audit.md`)

Resolved the master plan's own flagged `[UNKNOWN today]` item with real evidence: a fresh grep confirms **zero** planner/booking references to `apps.attractions.Attraction` — verified directly (not just trusted from the earlier research pass) via `grep -rn "attractions\.Attraction\|attractions_attraction" apps/planner apps/bookings`, zero matches. Also found and named the actual remaining blocker precisely: `apps.reference.AttractionMasterViewSet` has no paginated/category-filtered browse-list endpoint equivalent to the old app's `getAttractions`, which a real, live frontend page (`attractions/[id]/page.tsx`) depends on — real frontend/product scope, correctly left untouched by this backend-only phase. No code, frontend, or data change was made as part of this audit.

## Real, separate finding noted but not investigated further (out of scope)

While this session was running, the earlier-flagged `_resolve_city` substring-match bug (Phase 5's finding) was fixed by a separate background session, which also found the identical unguarded-`icontains` pattern in this phase's own `live_price.py::_resolve_observation_fk` (cab branch, `City.objects.filter(name__icontains=origin).first()`) and flagged it as a new background task (`task_8c7fcda3`) rather than fixing it silently. Noted here for continuity; not investigated or touched by this Phase 6 session.

## Changed files

New: `backend/apps/reference/management/commands/seed_category_vocabulary.py`, `import_osm_places.py`; migration `reference/migrations/0017_phase6_place_enrichment.py`; `docs/plans/evidence/phase-06/backup-confirmation.md`; `docs/plans/phases/phase-06-*`.
Extended: `backend/apps/reference/models.py` (`PlaceCrossIdMixin`, `CategoryVocabularyMap`), `admin.py`, `serializers.py`, `services/reconciliation.py` (`match_place_by_name_distance`), `management/commands/audit_reference_data.py` (report 10), `management/commands/seed_source_registry.py` (`osm_overpass` row).
No Codex-fenced file outside this initiative's own new files was touched; no frontend file was touched (backend-only phase).

## Next action

1. Scale `import_osm_places` to more cities (mechanical follow-up — the pipeline is proven; each additional city is one more Overpass query + the same matching/create logic).
2. A future session should retry the ASI monuments dataset search (or attempt PDF OCR against `asi.nic.in/pdf/CPM_List.pdf` / the March-2025 district-wise list) if the owner wants official ticket prices imported.
3. Frontend/product decision needed on the attractions-app §13 blocker (build a paginated `apps.reference` browse endpoint, or retire the old browse page) before retirement can proceed further.
4. (Optional) Investigate `task_8c7fcda3` (the `_resolve_observation_fk` unguarded-icontains pattern) — flagged by a separate session, not by this one.
