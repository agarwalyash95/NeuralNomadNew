# Phase 03 Implementation Packet

## 1. Objective

Stand up the source-registry/staging/reconciliation machinery (§7.2) and run the first
bounded open-data imports (GeoNames India, OurAirports, Wikidata cross-IDs) that give
canonical reference rows real external identifiers, aliases, and field-level provenance
— without deleting or overwriting any existing verified row.

## 2. Canonical-plan references

- Master plan §5 data-source matrix (GeoNames, OurAirports, Wikidata, data.gov.in/GODL).
- Master plan §7.2 new models; §7.3 identity/reconciliation strategy.
- Master plan §8.4 PostGIS checkpoint (executed at this phase's end).
- Master plan §6.1 coverage tiers G1–G5 (Phase-2-exit column is this phase's target).
- Master plan Phase 3 at §14. Licence status update: `docs/plans/evidence/phase-03/licence-verification.md`.

## 3. Current repository findings

- Phase 0–2 verified complete in this session: migration history applied through
  `reference.0013_phase2_geospatial_foundation`; `manage.py check` and
  `makemigrations --check --dry-run` both clean; C1/C2/C3/H1/H2/H5 fixes present in the
  live tree exactly as the Phase 0 evidence describes; `check_layer_boundaries` and
  `apps/common/provenance.py` exist (Phase 1); `apps/reference/services/geo.py` and
  `apps/reference/services/provenance.py::publishable` exist and are wired into
  `canonical_resolver`, `station_selector`-adjacent paths, and the audit command
  (Phase 2). Key rotation (D10) remains the one open owner action from Phase 0.
- Live DB (`neuralnomad`, PostgreSQL 18.4, `localhost:5433`) counts at this phase's
  start: 15,395 cities, 7,063 airports, 9,011 railway stations (8,697 with coordinates,
  96.515%), 1,976 states, 250 countries, 0 bus/metro stations, 0 airport/train/bus
  routes.
- `City`, `Airport`, `RailwayStation` carry **no** `geonameid`/`wikidata_id`/
  `ourairports_ident` columns yet — confirmed absent by direct model inspection. This
  phase adds them.
- `CityAlias` and `ReferenceFieldProvenance` already exist with the exact schema §4.1/§7.1
  describe (built in an earlier, pre-Phase-0 pass) — Phase 3 activates them (real
  writers), it does not create them.
- `District`, `SourceRegistry`, `SourceRelease`, `ImportBatch`, `StagingRecord`,
  `ProviderEntityMap`, `DataQualityIssue` do not exist anywhere in the tree — confirmed
  by grep. All seven are new in this phase.
- Network reachability confirmed this session (see §16): GeoNames `IN.zip` (15.7 MB),
  OurAirports `airports.csv` (3.9 MB), and the Wikidata SPARQL endpoint are all directly
  reachable from the execution host. GODL-India licence text fetched and read in full
  (`docs/plans/evidence/phase-03/godl-license-text.txt`); previously [UNKNOWN], now
  [VERIFIED] — see licence-verification.md for the exact clauses relied on.
- Backup taken this session before any Phase 3 write: `pg_dump` custom-format archive,
  17,403,255 bytes, integrity-checked via `pg_restore --list` (788 TOC entries, no
  errors) — see `docs/plans/evidence/phase-03/backup-confirmation.md`.
- The working tree remains heavily dirty with pre-existing, unrelated planner/knowledge
  edits (172+ status entries historically). Phase 3 owns only the files in §6.

## 4. Approved scope

- Add seven new models to `apps/reference/models.py`: `District`, `SourceRegistry`,
  `SourceRelease`, `ImportBatch`, `StagingRecord`, `ProviderEntityMap`,
  `DataQualityIssue`, exactly per §7.2's field lists. One additive migration.
- Add `City.geonameid` (unique, null), `City.wikidata_id` (null), `City.population`
  (null), `City.district` (FK to new `District`, null), `City.destination_tags` (JSON,
  default dict); `Airport.ourairports_ident` (null), `Airport.wikidata_id` (null);
  `RailwayStation.wikidata_id` (null). Same migration as above.
- Seed `SourceRegistry` rows for GeoNames, OurAirports, Wikidata, and data.gov.in/LGD
  (all `active=True`, `licence_verified_at` set to this phase's fetch date) and OTD Delhi
  (`active=False`, licence unverified) — a one-off data migration or idempotent
  management-command seed, not a schema change.
- `apps/reference/services/reconciliation.py`: the §7.3 matching ladder as a reusable
  function — exact external-id match → cross-id via `ProviderEntityMap`/Wikidata →
  normalized name + admin container + distance threshold → else `StagingRecord`
  `ambiguous`. Never auto-merges two existing canonical rows.
- `import_geonames` (new command): downloads/reads `IN.zip` (cities/admin file +
  `alternateNames`), stages every row as a `StagingRecord`, reconciles cities
  (`feature_class=P`) against existing `City` rows by `geonameid` first, then
  normalized-name + state + ≤10 km distance; writes `geonameid`/`population` onto
  matched rows; writes `CityAlias` rows from `alternateNames` (language-coded, one
  `is_primary` per city max); creates `District` rows from `feature_code=ADM2` entries
  (name + state FK + normalized_name; `lgd_code` left null — no LGD crosswalk source is
  imported in this phase, see §5); creates new `City` rows only for unmatched
  `feature_code` in `{PPLC, PPLA, PPLA2}` (national capital / state capitals / district
  admin seats) — all other unmatched populated places are staged as
  `StagingRecord(match_status="unmatched")` for a later, separately-scoped bulk pass
  rather than auto-created in this run (blast-radius bound, see §19). Writes one
  `ImportBatch` row per run; `--dry-run` default; resumable via batch checkpointing;
  idempotent (safe to re-run).
- `import_ourairports` (new command): reconciles `Airport` rows by `iata_code`; writes
  `ourairports_ident`; conflicting/unmatched IATA codes become `DataQualityIssue` rows
  (`issue_type="identity_conflict"`); no new `Airport` rows are created in this phase
  (Airport creation from open data is out of scope — see §5). `--dry-run` default.
- `import_wikidata_crossids` (new command): batched SPARQL query for
  `P1566` (GeoNames ID), `P238` (IATA), `P296` (station code) against Q-ids already
  reachable via the geonameid/iata_code fast paths just populated; writes
  `City.wikidata_id`/`Airport.wikidata_id`/`RailwayStation.wikidata_id` plus a
  `ProviderEntityMap` row per match. `--dry-run` default.
- `merge_reference_entities` (new command): human-gated, takes two explicit PKs of the
  same model, requires `--confirm`, preserves the older PK, re-points FKs, writes an
  alias for the losing name, logs to `DataQualityIssue(status="resolved")`. No automatic
  invocation in this phase — this phase only produces the duplicate-candidate report
  (report 3) that a human uses to call it.
- `recompute_completeness` (new command): recalculates each publishable row's existing
  `data_completeness_score` field (already present on the four master tables and used
  elsewhere) to reflect the new `geonameid`/`wikidata_id`/alias signals. Additive only.
- `benchmark_geo_queries` (new command, §8.4): deterministic, no-network EXPLAIN +
  timing harness over nearest-hub and nearby-place queries at current scale; records the
  four adoption-trigger metrics and appends a decision note to the master plan.
- Extend `audit_reference_data` with reports 3 (duplicate-candidate), 4 (missing-alias),
  and 8 (unresolved-mapping) alongside the existing 1/2/9.
- Admin/serializer registrations for all seven new models (list/search only, no new API
  surface — the master plan does not ask for one in Phase 3).

## 5. Explicit out-of-scope items

- LGD (Local Government Directory) crosswalk import. `District.lgd_code` is schema-ready
  but left null in this phase — no LGD-specific importer is built; `lgdirectory.gov.in`
  reachability was confirmed but its dataset export format was not inspected. A
  dedicated follow-up import is required before `lgd_code` is populated or the G3
  district coverage target is measured.
- Full-India populated-place bulk creation. Only `PPLC`/`PPLA`/`PPLA2` unmatched rows are
  auto-created; the remaining unmatched GeoNames populated places (expected: tens of
  thousands, mostly small towns/villages already covered structurally by the existing
  15,395-city base or destined for G5 in a later, explicitly-scoped bulk pass) are staged,
  not created. This keeps the first real `--apply` run's new-row count bounded and
  reviewable.
- `import_asi_monuments`, `import_osm_places`, OSM PBF tooling, GTFS/OTD Delhi — all P6/V2
  per the master plan; untouched.
- Route facts, `HubTransferLink`, route graph (P4); price estimation (P5); knowledge-app
  migration (P7); any deletion of existing rows (P10); PostGIS adoption itself — this
  phase only runs the checkpoint benchmark and records the decision, it does not install
  PostGIS regardless of the outcome (that would be a separately-approved infra change).
- Any frontend change. Any paid Google API call (all sources this phase touches are free
  open data).

## 6. Permitted files

- `backend/apps/reference/models.py`
- `backend/apps/reference/migrations/0014_phase3_source_registry.py` (new)
- `backend/apps/reference/admin.py`
- `backend/apps/reference/serializers.py`
- `backend/apps/reference/services/reconciliation.py` (new)
- `backend/apps/reference/management/commands/import_geonames.py` (new)
- `backend/apps/reference/management/commands/import_ourairports.py` (new)
- `backend/apps/reference/management/commands/import_wikidata_crossids.py` (new)
- `backend/apps/reference/management/commands/merge_reference_entities.py` (new)
- `backend/apps/reference/management/commands/recompute_completeness.py` (new)
- `backend/apps/reference/management/commands/benchmark_geo_queries.py` (new)
- `backend/apps/reference/management/commands/seed_source_registry.py` (new, idempotent)
- `backend/apps/reference/management/commands/audit_reference_data.py` (reports 3/4/8)
- `scripts/phase3_import_metrics.py` (new, read-only aggregator for evidence)
- Phase 03 plan/evidence files and required continuity documents
  (`docs/agent/HANDOFF.md`, `docs/agent/CURRENT_STATE.md`, `docs/agent/DECISIONS.md`).

## 7. Forbidden files

All frontend files; `apps/planner/**`; `apps/knowledge/**`; provider integrations
(`apps/bookings/providers/**`); route-graph/price-estimator files (P4/P5 territory);
`attractions/**`; any existing migration file (`0001`–`0013`); any file not listed in §6.

## 8. Models affected

- New: `District`, `SourceRegistry`, `SourceRelease`, `ImportBatch`, `StagingRecord`,
  `ProviderEntityMap`, `DataQualityIssue`.
- Extended (nullable, additive only): `City` (+`geonameid`, `+wikidata_id`,
  `+population`, `+district`, `+destination_tags`), `Airport` (`+ourairports_ident`,
  `+wikidata_id`), `RailwayStation` (`+wikidata_id`).
- Activated, not schema-changed: `CityAlias`, `ReferenceFieldProvenance`.

## 9. Services affected

- New `reconciliation.py` matching ladder, consumed only by the three importers and the
  merge command in this phase (not yet wired into live request-time paths — that is
  Phase 4+'s job when route/candidate services consume cross-IDs).

## 10. Commands and tasks affected

- Three new importers, one merge command, one completeness recompute, one PostGIS
  benchmark, one registry seeder — all listed in §6. No Celery beat/task changes.

## 11. Migrations expected

One additive migration (`0014_phase3_source_registry`): seven new tables + nine new
nullable columns/indexes across `City`/`Airport`/`RailwayStation`. No column removal, no
`NOT NULL`, no data migration inside the schema migration (all data writes happen through
the importer commands, per the plan's standing rule).

## 12. Data mutation expected

- New rows: seven new tables populated from imports (bounded per §4); `District` rows
  from GeoNames ADM2; `CityAlias` rows from GeoNames `alternateNames`;
  `ProviderEntityMap`/`DataQualityIssue`/`StagingRecord`/`ImportBatch` rows as the
  importers' own bookkeeping.
- Updated existing rows: `City.geonameid`/`wikidata_id`/`population` and
  `Airport.ourairports_ident`/`wikidata_id` and `RailwayStation.wikidata_id` set on
  **matched** rows only — no existing `name`, `latitude`/`longitude`,
  `coordinate_confidence`, or `is_publishable` value is overwritten by this phase.
- New `City` rows: bounded to `PPLC`/`PPLA`/`PPLA2` unmatched entries only (§5).
- **Zero deletions.** Acceptance requires an assert that every touched table's
  row-count delta is `>= 0` for pre-existing tables (City/Airport/RailwayStation).

## 13. Backup and approval gates

- Owner instruction this session ("check current state, verify and then start with
  phase 3") is treated as the explicit authorization to proceed past the master plan's
  standing "owner approval of this document" gate for this specific phase, consistent
  with how Phase 1 and Phase 2 were each authorized in their own implementation packets.
- Backup: satisfied this session — see `docs/plans/evidence/phase-03/backup-confirmation.md`
  (pg_dump taken directly since the DB was reachable and the client tool was found
  locally; integrity-verified via `pg_restore --list`).
- Licence gate: GeoNames (CC-BY), OurAirports (Public Domain), and Wikidata (CC0) were
  already [VERIFIED] in the master plan before this session. GODL-India (data.gov.in) is
  newly [VERIFIED] this session (§3, §16). OTD Delhi remains unverified but is out of
  Phase 3 scope (§5).
- `SourceRegistry.active=False` is the mechanical enforcement for any source whose
  licence checklist item is not checked — no importer in this phase reads from an
  inactive source.

## 14. Ordered implementation tasks

1. Add the seven models + nine fields to `apps/reference/models.py`; generate and
   review the migration; apply it.
2. Register new models in `admin.py`/`serializers.py` (list/search only).
3. `seed_source_registry` — idempotent upsert of the five source rows (four active, one
   inactive); re-runnable without duplication.
4. `reconciliation.py` — matching ladder + unit-style scripted checks against known
   pairs (Mumbai/Bombay, Bengaluru/Bangalore, Gurgaon/Gurugram — the same fixtures prior
   phases used).
5. `import_ourairports --dry-run`; inspect projected match/conflict counts; `--apply`;
   re-audit.
6. `import_wikidata_crossids --dry-run` (IATA/geonameid fast paths populated by steps
   3–5 first where possible); inspect; `--apply`.
7. `import_geonames --dry-run`; inspect projected city-match, alias, District, and
   bounded-new-city counts before any write.
8. `import_geonames --apply` once dry-run counts are reviewed and bounded as designed.
9. `import_wikidata_crossids --dry-run`/`--apply` a second pass now that `geonameid` is
   populated (captures cross-IDs the first pass couldn't reach without it).
10. Duplicate-candidate report (3), missing-alias report (4), unresolved-mapping report
    (8) via `audit_reference_data` extension.
11. `recompute_completeness`.
12. `benchmark_geo_queries` — PostGIS checkpoint; record the decision in the master
    plan's §2/D2 row.
13. Standard trio (`check`, `makemigrations --check --dry-run`, `compileall`) +
    `check_layer_boundaries`; full before/after row-count diff proving zero deletions.

## 15. Acceptance criteria (from §14 of the master plan, Phase 3)

> G1–G5 coverage targets (§6.1 Phase-2-exit column) met and reported per state; ≥90% of
> G4 cities carry a `geonameid`; zero canonical rows deleted (assert row-count deltas
> ≥ 0 for City/Airport/RailwayStation); duplicate report generated; alias coverage
> report 4 live; PostGIS checkpoint numbers recorded + owner decision logged in §2/D2.

**Scoped adjustment, stated explicitly (not silently narrowed):** because District/LGD
import and full-India populated-place creation are out of scope this phase (§5), the G3
(districts) and G5 (minor towns) coverage numbers will be **measured and reported**, not
necessarily met at their Phase-3 target this run — the packet's acceptance check
substitutes "G3/G5 numbers reported with an honest gap analysis" where the full target
depends on the deferred LGD/bulk-creation follow-up. G1/G2/G4 (countries, states,
major cities) are expected to hit their stated targets since they are the bounded
creation classes this phase actually writes.

## 16. Validation commands

- `python manage.py check`
- `python manage.py makemigrations --check --dry-run`
- `python manage.py migrate --plan`
- `python -m compileall apps config`
- `python manage.py check_layer_boundaries --json`
- `python manage.py seed_source_registry --json`
- `python manage.py import_ourairports --dry-run --json` / `--apply --json`
- `python manage.py import_wikidata_crossids --dry-run --json` / `--apply --json`
- `python manage.py import_geonames --dry-run --json` / `--apply --json`
- `python manage.py audit_reference_data --json --details` (before/after)
- `python manage.py recompute_completeness --json`
- `python manage.py benchmark_geo_queries --json`
- Network reachability already confirmed this session:
  `HEAD https://download.geonames.org/export/dump/IN.zip` → 200 (15,744,161 bytes);
  `HEAD https://ourairports.com/data/airports.csv` → 200 (3,872,624 bytes);
  `GET https://query.wikidata.org/sparql` (test query) → 200.

## 17. Required measurements

- Before/after row counts: City, Airport, RailwayStation, CityAlias, District,
  SourceRegistry/SourceRelease/ImportBatch/StagingRecord/ProviderEntityMap/
  DataQualityIssue.
- `geonameid` coverage on City (target ≥90% of G4 major cities).
- Cross-ID coverage on Airport/RailwayStation (count with `wikidata_id` set).
- Duplicate-candidate count (report 3); missing-alias count (report 4); unresolved
  staging-match count (report 8), each as a fraction of the relevant batch.
- Import throughput (rows/min) per importer, and whether each run stayed resumable
  (`ImportBatch` counters: created/updated/skipped/conflicted/quarantined).
- PostGIS checkpoint: publishable point-entity count, nearby-query p95, bbox candidate
  set size distribution — compared against the four §8.4 adoption triggers.

## 18. Rollback strategy

- Migration `0014` is purely additive (new tables + nullable columns) — reversible by
  `migrate reference 0013` if ever required; no existing column is altered or dropped.
- All importer writes are `ImportBatch`-scoped: a batch's staging rows and the
  provenance/cross-ID rows it wrote can be deleted by `ImportBatch` FK without touching
  unrelated data. Matched-row field updates (`geonameid` etc.) are additive fills on
  previously-null columns, reversible by nulling them back out per the batch's recorded
  before-values (captured in each matched row's `ReferenceFieldProvenance` entry).
- Full-DB fallback: restore from `docs/plans/evidence/phase-03/backup-confirmation.md`'s
  dump if anything beyond the above is ever needed.

## 19. Risks

- **Blast radius of `import_geonames`.** The full GeoNames India populated-place file is
  large; auto-creating every unmatched settlement in one run would be a five-figure
  write with limited per-row review. Mitigated by the §4/§5 scope bound (only
  `PPLC`/`PPLA`/`PPLA2` auto-create; the rest stage for a follow-up decision) and by
  running `--dry-run` before any `--apply`.
- **False-positive city matching** (matching a GeoNames row to the wrong existing
  `City` by name collision — the plan's own "New York"/"New York City" class of bug).
  Mitigated by the §7.3 ladder requiring geonameid-exact or name+state+≤10 km distance
  before treating two rows as the same place; anything softer becomes a staged
  `ambiguous` record for report 8, never an automatic merge.
- **LGD/District incompleteness** is a known, stated gap (§5), not a hidden one — G3
  coverage will read low until a dedicated LGD import lands.
- **Wikidata SPARQL rate/timeout behavior** at batch scale is unverified beyond a single
  test query; the importer must batch conservatively and degrade to "no cross-ID this
  pass" on any endpoint error, never block City/Airport import on Wikidata availability.
- **PostGIS checkpoint numbers will look different from Phase 2's** because Phase 3 adds
  more publishable rows — the benchmark must be re-run at Phase 3's actual end state, not
  reused from Phase 2's report.

## 20. Status

PHASE READY FOR IMPLEMENTATION
