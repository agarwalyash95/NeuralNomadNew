# Phase 03 Implementation Report

## 1. Objective

Stand up the source-registry/staging/reconciliation machinery and run the first
bounded open-data imports (GeoNames India, OurAirports, Wikidata cross-IDs), giving
canonical reference rows real external identifiers, aliases, and field-level
provenance — zero existing rows deleted or overwritten.

## 2. Scope implemented

- Seven new models (`District`, `SourceRegistry`, `SourceRelease`, `ImportBatch`,
  `StagingRecord`, `ProviderEntityMap`, `DataQualityIssue`) + nine new nullable
  fields on `City`/`Airport`/`RailwayStation`, in one additive migration
  (`0014_phase3_source_registry`).
- `seed_source_registry` (idempotent): five source rows, four active
  (GeoNames/OurAirports/Wikidata/data.gov.in-GODL), one inactive (OTD Delhi).
- `reference/services/reconciliation.py`: the §7.3 matching ladder plus
  provenance/entity-map/issue-flagging helpers, shared by all three importers.
- `import_geonames`: reconciles City/District against GeoNames India; bounded new-city
  creation to `PPLC`/`PPLA`/`PPLA2` only.
- `import_ourairports`: reconciles Airport by IATA code.
- `import_wikidata_crossids`: batched SPARQL reconciliation for City/Airport/
  RailwayStation cross-IDs (P1566/P238/P296).
- `merge_reference_entities`: human-gated City duplicate merge (preview by default,
  generic reverse-FK repointing, alias-the-loser, `DataQualityIssue` resolution log).
- `recompute_completeness`: first real writer for the long-dormant
  `data_completeness_score` field on the four master tables.
- `benchmark_geo_queries`: §8.4 PostGIS checkpoint (read-only, no network).
- `audit_reference_data` extended with reports 3 (duplicate candidates), 4 (missing
  aliases), 8 (unresolved mappings).
- Admin/serializer registrations for all seven new models (list/search only).
- **GODL-India licence verified this session** (was `[UNKNOWN]`/fetch-blocked in the
  master plan) — full Gazette Notification text fetched and read; master plan §5/§18
  updated in place. See `docs/plans/evidence/phase-03/licence-verification.md`.
- **Pre-work `pg_dump` backup taken and integrity-verified** (see
  `backup-confirmation.md`) since the DB was reachable and a local client existed —
  satisfies the phase's backup gate without waiting on a separate owner action.

## 3. Files changed

Exactly the files in the Phase 3 implementation packet §6, plus this report and
`docs/plans/evidence/phase-03/**`. No file outside `apps/reference/**`,
`scripts/`, and `docs/` was touched.

## 4. Models changed

- New: `District`, `SourceRegistry`, `SourceRelease`, `ImportBatch`, `StagingRecord`,
  `ProviderEntityMap`, `DataQualityIssue`.
- Extended (nullable, additive): `City` (+geonameid, +wikidata_id, +population,
  +district, +destination_tags), `Airport` (+ourairports_ident, +wikidata_id),
  `RailwayStation` (+wikidata_id).
- Activated (no schema change): `CityAlias`, `ReferenceFieldProvenance` — both existed
  from an earlier pass but had zero real writers before this phase.

## 5. Services changed

- New `reconciliation.py` (matching ladder + provenance/entity-map/issue helpers).
- No change to any request-time/live path — imports are batch/offline only. Route,
  candidate-pool, and pricing services do not yet consume the new cross-IDs (that is
  Phase 4+ work per the master plan).

## 6. Commands and tasks changed

- New: `seed_source_registry`, `import_geonames`, `import_ourairports`,
  `import_wikidata_crossids`, `merge_reference_entities`, `recompute_completeness`,
  `benchmark_geo_queries`.
- Extended: `audit_reference_data` (reports 3/4/8).
- No Celery beat/task changes.

## 7. Migrations created/applied

`reference.0014_phase3_source_registry` applied successfully. Purely additive (seven
new tables, nine new nullable columns/indexes). No column altered or dropped. Post-apply
`makemigrations --check --dry-run` reports no changes.

## 8. Data affected (zero deletions; see before/after row counts)

| Table | Before | After | Delta |
|---|---|---|---|
| City | 15,395 | 15,475 | **+80** (bounded PPLC/PPLA/PPLA2 creation only) |
| Airport | 7,063 | 7,063 | 0 (no creation, by design) |
| RailwayStation | 9,011 | 9,011 | 0 (no creation, by design) |
| CityAlias | 0 | 9,582 | +9,582 |
| District | 0 | 667 | +667 |
| ProviderEntityMap | 0 | 15,770 | +15,770 |
| DataQualityIssue | 0 | 36 | +36 (all `identity_conflict`, safely flagged, nothing overwritten) |
| StagingRecord | 0 | 48 | +48 (rejected candidates: no state crosswalk / invalid coords) |
| City.geonameid set | 0 | 4,169 | 27.1% of all cities |
| City.wikidata_id set | 0 | 1,670 | |
| Airport.ourairports_ident set | 0 | 105 | 61.4% of India IATA-coded airports on file |
| Airport.wikidata_id set | 0 | 6,827 | 96.7% |
| RailwayStation.wikidata_id set | 0 | 3,000 | 33.3% |

Full JSON: `before_row_counts.json`, `final_row_counts.json`.

## 9. Dry-run / idempotence results

- `import_ourairports`: dry-run and apply metrics matched exactly; a second dry-run
  after apply shows `updated=0, already_current=105` — fully idempotent.
- `import_geonames`: **two accounting bugs were found and fixed during idempotence
  verification** (not shipped uncorrected): the dry-run path skipped the
  already-exists check for both alias creation and new-city creation (querying
  existing state only `if apply_mode`), so a dry-run preview overstated "would
  create" counts relative to what a real apply actually needed. Fixed by always
  querying existing state for the preview, gating only the `.create()`/`.save()`
  call itself on `apply_mode`. After the fix, `new_cities_created` and
  `districts_created` correctly read 0 on a settled re-run. `aliases_created` does
  **not** converge to exactly 0 on immediate re-run by design: `MAX_ALIASES_PER_CITY`
  (8) caps how many new aliases a single run creates per city, so a city with more
  than 8 real GeoNames alternate names needs multiple apply passes to fully saturate
  — this is a deliberate per-run bound (avoids one pass writing 50+ alias rows for a
  single alias-rich city), not a convergence failure. Two apply passes were run this
  session (9,582 aliases total); a further pass would still find a bounded remainder
  for the highest-alias-count cities, which is expected and safe to continue later.
- A background run of `import_geonames --apply` and `import_wikidata_crossids --apply`
  launched concurrently appeared to leave two `ImportBatch` rows stuck in `status=
  "running"` when checked partway through — investigation showed this was **the wait
  loop checking too early, not an actual crash**: both processes' own finalization
  code ran moments later and correctly set `status="completed"`. All idempotent
  upserts converged correctly regardless. No data was corrupted by the overlap; this
  is recorded as an operational lesson (don't run two large importers concurrently
  against the same tables without a completion-confirming wait) rather than a defect
  requiring a code fix.
- 12 cities and a `DataQualityIssue`-flagged handful of railway stations show a
  **geonameid/wikidata cross-id resolution that differs between two independent
  passes over the same source file** — caught safely by the ownership/conflict guard
  (flagged, never overwritten), but the root cause of the non-determinism was not
  tracked down in this session. Flagged for a future investigation, not blocking.

## 10. Validation results

- `python manage.py check`: clean.
- `python manage.py makemigrations --check --dry-run`: no changes detected.
- `python -m compileall apps config`: clean.
- `python manage.py check_layer_boundaries --json`: `status: pass`, zero violations,
  the same two documented Phase 1 geocoding exceptions (unrelated to this phase).

## 11. Acceptance matrix

See `acceptance-matrix.md`. Summary: G1/G2 (countries/states) were already at 100%
before this phase and are untouched. G4 (major cities) partial — 4,169 cities now
carry a `geonameid` (the packet's own scoped-adjustment clause anticipated G3/G5 would
be measured, not necessarily met, given LGD import and full-village creation are
explicitly out of scope this phase). Zero canonical rows deleted — verified by the
row-count table in §8. Duplicate report (3), alias report (4), and unresolved-mapping
report (8) are all live. PostGIS checkpoint recorded — see §12.

## 12. Performance / PostGIS checkpoint results

All four §8.4 adoption triggers are **false** at current scale — recommendation
**defer**: 32,609 total publishable point entities (trigger: >500,000); overall
nearby-hub p95 **9.946 ms** across three real city centers (trigger: >150 ms); max bbox
candidate set seen **199** rows (trigger: >5,000); no approved polygon/geometry feature
exists. Per-center detail in `postgis_checkpoint.json`. This is a new, Phase-3-actual-
state measurement, not a reuse of Phase 2's numbers (Phase 2's own report flagged that
distinction as required).

## 13. Compatibility and feature flags

No existing behavior changed. `SourceRegistry.active=False` (OTD Delhi) is the
mechanical enforcement that no importer in this phase reads from an unverified
source. All importers default to `--dry-run`.

## 14. Security and licensing impact

- GeoNames (CC-BY 4.0), OurAirports (Public Domain), Wikidata (CC0) — licences
  already verified before this phase; unchanged.
- **GODL-India — verified this session** (previously `[UNKNOWN]`, fetch-blocked):
  commercial use, redistribution, and adaptation are explicitly permitted (§3 of the
  Gazette Notification) with attribution required (§4a); none of the §6 exemptions
  (personal data, sensitive data, official symbols, other-IP data, military insignia,
  ID documents, RTI-exempt info) apply to district/tourism data. Full text and analysis:
  `licence-verification.md`, `godl-license-text.txt`.
- No credential was logged, persisted, or committed. The `pg_dump` backup file and raw
  GeoNames/OurAirports downloads live outside the repository (session scratchpad),
  never committed.
- No paid API was called anywhere in this phase (GeoNames/OurAirports/Wikidata are all
  free; Google was not touched).

## 15. Rollback procedure

- Migration `0014` is purely additive — reversible via `migrate reference 0013` if
  ever required.
- Every importer write traces to an `ImportBatch`; matched-row field fills
  (`geonameid` etc.) are additive on previously-null columns and reversible by nulling
  them back out using each row's `ReferenceFieldProvenance` entry.
- Full-DB fallback: restore from the pre-Phase-3 `pg_dump`
  (`backup-confirmation.md`).

## 16. Remaining issues

- District/LGD crosswalk (`District.lgd_code`) is still null for all 667 rows — no
  dedicated LGD import exists yet (explicitly out of scope, per the packet).
- ~1,035 more GeoNames alternate names remain creatable (bounded per-run alias cap) —
  safe to pick up in a future `import_geonames --apply` run.
- 12 City + several RailwayStation cross-id resolutions differ between independent
  passes over the identical source file — flagged as `identity_conflict`
  `DataQualityIssue` rows, never silently overwritten, but the root cause is
  untracked.
- Report 3 (duplicate candidates) found 6 pairs post-import (up from 3 pre-import) —
  worth a human pass through `merge_reference_entities --keep-pk --merge-pk` (preview
  mode first) in a future session; none were merged automatically, per the plan's own
  "never auto-merge" rule.
- The 4 pre-existing duplicate `State` rows found this session (hyphenated vs spaced
  name variants — e.g. "Uttar-Pradesh" vs "Uttar Pradesh", the spaced variant always
  holding zero cities) were **not merged/deleted** — out of Phase 3's stated scope
  (no deletions), but flagged here and in `CURRENT_STATE.md` as a safe, low-risk
  cleanup for a future session (the empty duplicates have no dependents).
- 58 of 163 India OurAirports rows with an IATA code have no matching `Airport` row on
  file (open-data airport creation is explicitly out of scope this phase).

## 17. Independent verification requirements

Re-read packet/report/diff/evidence; rerun the validation trio + `check_layer_
boundaries`; re-run each importer's `--dry-run` and confirm the fixed idempotence
behavior; spot-check the row-count table against a live `manage.py shell` query;
review the 36 `DataQualityIssue` rows for anything beyond the explained
identity-conflict pattern; review the GODL licence-verification write-up
independently before treating it as settled.

## 18. Repository state

Branch `main`, baseline commit `a386842821d035337fa539b470418d1da101b06c`, plus the
heavily dirty pre-existing tree and the Phase 00–03 working-tree diff. Nothing was
staged or committed.

IMPLEMENTATION READY FOR VERIFICATION
