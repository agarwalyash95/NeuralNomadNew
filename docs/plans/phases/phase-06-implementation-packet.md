# Phase 6 Implementation Packet — Place enrichment (hotels, restaurants, attractions, activities)

- Date: 2026-07-20, Asia/Calcutta
- Agent/platform: Claude Code (Sonnet 5)
- Source: `docs/plans/reference-foundation-and-planner-intelligence-master-plan.md` §6/§11/§13, Phase 6 section (line 576).
- Trigger: owner said "execute phase 6" after Phase 5 closed.

## Scope decision: Overpass API instead of a Geofabrik PBF extract, ASI monuments deferred

Fresh code inspection before writing this packet confirmed the real starting state: `HotelMaster`/`RestaurantMaster`/`AttractionMaster`/`ActivityMaster` have zero cross-id fields and zero image-rights fields; `places_explore.py`'s cache-on-miss path goes straight to Google with no open-data step at all; `refresh_stale_entities` already TTLs whole rows but nothing surfaces which rows are currently stale.

Two real research findings changed this phase's approach from the master plan's literal wording:

1. **OSM import**: the plan names a Geofabrik PBF extract processed with `osmium`/`pyosmium`. That library is confirmed not installed, and a full India extract is a multi-GB download — real new operational risk for one session. Used the **Overpass API** instead — same underlying OSM data (ODbL), free, no key, real-time bounded per-city queries, no new binary dependency. A real, working importer, at smaller scale than a country-wide parse.
2. **ASI monuments**: real web research (data.gov.in, asi.nic.in, Wikidata) found no clean, licence-verified, name+coordinates+price dataset. data.gov.in's ASI-tagged resources are all small parliamentary-question-derived aggregates. ASI's own site publishes fees per-monument-page only, and its master list is a scanned/PDF-only document. **Deferred**, not attempted — same discipline as Phase 4's `BusRoute` and Phase 5's train fares.

## In scope

1. Real `pg_dump` backup (required per the master plan's global rule for any phase mutating data at scale) — taken directly, confirmed via `pg_restore --list` (909 TOC entries), `docs/plans/evidence/phase-06/backup-confirmation.md`.
2. `PlaceCrossIdMixin` (`wikidata_id`, `osm_id`, `image_license`, `image_attribution`, `image_source`) added to all four master tables — additive migration `0017_phase6_place_enrichment`.
3. `CategoryVocabularyMap` model + `seed_category_vocabulary` command.
4. `reconciliation.match_place_by_name_distance` — a new matching-ladder helper for POI-level (not city-level) matching.
5. `import_osm_places` (Overpass API) — dry-run-first, idempotent (`ImportBatch`/`SourceRelease` checkpointed like every Phase 3/4 importer), new `SourceRegistry` row for `osm_overpass` (ODbL).
6. `audit_reference_data` report 10 — stale Google-sourced entity visibility.
7. Attractions-app §13 audit (`phase-06-attractions-audit.md`) — real evidence resolving the plan's own flagged unknown, no code/frontend changes.

## Explicitly deferred

- `import_asi_monuments` — no licence-verified dataset found.
- Restaurant price-unit normalization — re-examined, still deferred per Phase 5's own documented reasoning (wide-reaching consumer audit, not self-contained).
- Full-scale OSM coverage beyond the pilot city set.
- Attractions-app frontend migration/removal — owner-gated, and now blocked on a concretely named gap (no `apps.reference` equivalent to the old app's paginated/filtered browse endpoint) rather than an open question.

Full detail of what was actually built and verified is in `phase-06-implementation-report.md`.
