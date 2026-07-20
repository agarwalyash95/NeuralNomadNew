# Phase 02 Implementation Packet

## 1. Objective

Create the shared geospatial foundation, indexed coordinate storage, deterministic
publishability gate, bounded open-data backfill, and coordinate coverage reports required
before Phase 3 ingestion work.

## 2. Canonical-plan references

- Master plan §6.2 reports 1, 2, and 9.
- Master plan §8.1 shared utility and plain-PostgreSQL index decision.
- Master plan §8.2 coordinate lifecycle steps 1–6.
- Master plan Phase 2 at §14.

## 3. Current repository findings

- Baseline: 15,395 cities, 7,063 airports, 9,011 railway stations, zero bus and
  metro stations, and 1,646 rows across the four place-master tables.
- Railway coordinate coverage is 8,697/9,011 (96.515%), already above the 95% gate;
  314 station rows remain unresolved after the existing DataMeet pass.
- 8,634 cities use the India centroid `(20.5937, 78.9629)` and two cities have missing
  coordinates.
- `City` has no generic quarantine field although §8.2 calls it existing. The approved
  `City.is_publishable` field is therefore the city quarantine gate; no unplanned second
  quarantine column will be introduced.
- The existing station-intelligence command downloads DataMeet coordinates but also
  rebuilds service areas. It must not be reused for this coordinate-only pass.
- Three Haversine implementations remain in canonical resolver, places explore, and
  planner distance service.
- Reference migration history is applied cleanly through `0012`.
- Relevant model/planner files contain extensive pre-existing edits. Phase 2 owns narrow
  hunks only.

## 4. Approved scope

- Add `apps/reference/services/geo.py` with Haversine, latitude-aware bounding-box,
  queryset prefilter, and nearest helpers.
- Delegate the three existing Haversine APIs to the shared implementation.
- Add composite latitude/longitude indexes to City, Airport, RailwayStation, BusStation,
  HotelMaster, RestaurantMaster, AttractionMaster, and ActivityMaster.
- Add `City.coordinate_confidence`, `City.is_publishable`, and MetroStation coordinates.
- Add queryset/object publishability helpers and keep `exclude_unverified` as a
  compatibility alias.
- Apply publishability to explore, planner candidate pools, and station selection.
- Extend the audit command with per-state missing, placeholder, and non-publishable
  reports, including optional row-level reason output.
- Add a dry-run-first coordinate command targeting only missing stations and
  missing/placeholder cities, using DataMeet, Wikidata, curated values, and linked-station
  coordinates. Google support may remain explicit and gated but will not be called.
- Apply the additive migration and approved command after dry-run evidence.

## 5. Explicit out-of-scope items

- Phase 3 source registry, bulk GeoNames/OurAirports imports, reconciliation, and aliases.
- PostGIS, country polygon/bbox storage, DB coordinate CHECK constraints, or NOT NULL.
- Service-area rebuilds, route facts, graph search, model deletion, or frontend work.
- Paid Google/API calls and full canonical city deduplication.

## 6. Permitted files

- `backend/apps/reference/services/geo.py` (new)
- `backend/apps/reference/services/canonical_resolver.py`
- `backend/apps/reference/services/places_explore.py`
- `backend/apps/planner/services/distance_service.py`
- `backend/apps/reference/services/provenance.py`
- `backend/apps/reference/services/station_selector.py`
- `backend/apps/planner/services/plan_generation.py`
- `backend/apps/reference/models.py`
- `backend/apps/reference/migrations/0013_phase2_geospatial_foundation.py` (new)
- `backend/apps/reference/management/commands/audit_reference_data.py`
- `backend/apps/reference/management/commands/backfill_reference_coordinates.py` (new)
- `backend/apps/reference/tests/test_geo.py` (new)
- `backend/apps/reference/tests/test_reference_scenarios.py` (publishable-hub fixture only)
- `scripts/phase2_geo_metrics.py` (new, read-only)
- Phase 02 plan/evidence and required continuity documents.

## 7. Forbidden files

All frontend files, provider integrations, route models/services, Phase 3 importer models,
and unrelated dirty-tree files.

## 8. Models affected

- City: nullable coordinate confidence, indexed boolean publishability, composite
  coordinate index.
- MetroStation: nullable Decimal(9,6) latitude and longitude.
- Airport, RailwayStation, BusStation, and four master models: composite coordinate
  index only.

## 9. Services affected

- Shared coordinate math and bbox/nearest lookup.
- Canonical resolution, explore sorting, and planner distance compatibility wrappers.
- Generic reference-row publishability.
- Hub selection and candidate-pool reads.

## 10. Commands and tasks affected

- `audit_reference_data`: deterministic coverage reports 1/2/9.
- `backfill_reference_coordinates`: dry-run-first, bounded coordinate repair and city
  publishability recomputation. No task queue change.

## 11. Migrations expected

One additive migration after `reference.0012`; no in-migration data writes. Reversal drops
only the new fields/indexes.

## 12. Data mutation expected

- Additive station latitude/longitude updates for unresolved rows found in approved open
  datasets.
- Replacement of missing/centroid city coordinates only when a curated or linked-station
  coordinate is available.
- City confidence/publishability recalculation. No row creation or deletion.

## 13. Backup and approval gates

The owner previously confirmed the Phase 0 backup/restore gate and explicitly authorized
Phase 2. The mutation remains dry-run-first and bounded to reversible/additive fields.
Google requires an explicit paid-call flag and will not be used in this execution.

## 14. Ordered implementation tasks

1. Capture baseline audit/counts.
2. Add shared geo utility and unit checks.
3. Add fields/indexes and exact migration.
4. Add publishability and migrate callers.
5. Add reports 1/2/9.
6. Add coordinate command; run dry-run; inspect proposed IDs/counts.
7. Apply migration, run open-data command, rerun audit.
8. Measure nearest-query plan and p95.
9. Run standard/scenario checks and independent verification.

## 15. Acceptance criteria

- Shared geo distances match known pairs within ±0.5%.
- All three compatibility Haversine APIs delegate to shared code.
- Eight composite coordinate indexes and approved fields exist after migration.
- Railway coordinates remain at least 95% complete.
- Every centroid/missing city is excluded by the city publishability gate; fewer than 50
  may remain publishable with placeholder coordinates (target zero).
- Explore, planner pool, and hub selection consume publishable rows.
- Reports 1/2/9 emit per-state JSON and row-level reasons on request.
- Nearest-hub p95 is at most 50 ms and EXPLAIN proves the composite index is usable.

## 16. Validation commands

- `python manage.py audit_reference_data --json`
- `python manage.py audit_reference_data --json --details`
- `python manage.py backfill_reference_coordinates --dry-run`
- `python manage.py backfill_reference_coordinates --apply`
- `python manage.py check`
- `python manage.py makemigrations --check --dry-run`
- `python manage.py migrate --plan`
- `python -m compileall apps config`
- focused geo and existing reference scenario pytest files.
- scripted EXPLAIN and latency measurement; `check_layer_boundaries --json`.

## 17. Required measurements

- Before/after missing and placeholder coordinate counts per entity/state.
- Railway coordinate coverage percentage.
- City publishable/non-publishable counts and reasons.
- Coordinate updates by entity/source.
- Nearby-hub p50/p95/max and bbox candidate count.
- Default and diagnostic EXPLAIN plans for the indexed bbox query.

## 18. Rollback strategy

Reverse migration `0013`; restore coordinate/publishability fields from the owner backup
if command writes must be undone. The command creates/deletes no rows. Compatibility
wrappers permit code-hunk rollback without caller changes.

## 19. Risks

- A publishability gate can shrink thin-area pools; reports expose exact excluded counts
  and live place growth remains available.
- Open endpoints can be unavailable; failure leaves unresolved rows unchanged.
- Composite indexes may not be chosen for tiny tables; default and forced diagnostic
  plans will distinguish planner cost choice from index usability.
- Linked-station coordinates are approximations for city centers and therefore receive
  derived confidence below curated/source coordinates.

## 20. Status

PHASE READY FOR IMPLEMENTATION
