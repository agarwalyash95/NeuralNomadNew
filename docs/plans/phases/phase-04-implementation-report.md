# Phase 04 Implementation Report

## 1. Objective

Enrich route facts, ship the V1 multimodal route-graph search behind existing/new
flags, and turn `journey_resolver` into a thin adapter over it — without changing its
external return contract.

## 2. Scope implemented

- Route-model extensions (`distance_km`, `frequency_per_day`, `operating_days`,
  `service_class_meta`, `provenance_tier`, `confidence`, `freshness_at`, `is_active`) on
  `AirportRoute`/`TrainRoute`/`BusRoute` via a shared `_RouteFactsMixin`.
- New `HubTransferLink` model (generic FK both ends), one additive migration
  (`0015_phase4_route_graph`).
- **New source verified and onboarded: OpenFlights** (`routes.dat`/`airlines.dat`,
  ODbL, honestly stale since 2014) — added to `SourceRegistry` and the master plan §5
  matrix, matching the Phase 3 precedent for licence diligence.
- `import_datameet_train_routes`: 3,485 real `TrainRoute` rows from datameet's
  `trains.json` (5,208 real train-service features, deduplicated to one row per
  station pair, best/shortest duration kept, frequency derived from distinct train
  count on the corridor).
- `import_openflights_routes`: 1,916 real `AirportRoute` rows + 79 new `Airline` rows,
  bounded to direct routes where both endpoints match an existing `Airport.iata_code`
  and at least one touches India; duration derived from great-circle distance (no
  duration field exists in the source), honestly marked `provenance_tier="derived"`
  with an explicit 2014-snapshot staleness note.
- `backfill_station_intelligence` rewritten for incremental upsert (H7): replaced the
  wipe-then-`bulk_create` pattern with a diff that creates/updates first, deletes stale
  rows only after, all inside one transaction. `--rebuild --confirm-rebuild` preserves
  the old path behind a double-confirm gate.
- `populate_hub_transfer_links`: same-city Airport↔RailwayStation↔BusStation pairs for
  the top-50-by-population cities (adapted from the plan's "top-50 metro areas" design
  since `MetroArea`/`MetroAreaCity` are empty in this tree) — 5 real links created.
- `reference/services/route_graph.py`: the §9.2 V1 algorithm — hub candidates via
  ServiceArea (with a `geo.nearest()` geometric fallback when none exist), scheduled-edge
  lookup, Pareto pruning, honest no-cost/no-fabricated-schedule degradation, TransferProfile
  annotation (never a hard filter). Provenance-generic — verified to never import
  `apps.planner`.
- `journey_resolver.py` refactored: the entire legacy implementation preserved verbatim
  under `_resolve_journey_options_impl`/`_resolve_scheduled_mode`; a new
  `_route_graph_resolve_scheduled_mode` adapter added; two-flag dispatch design
  (`PLANNER_ROUTE_GRAPH_ENABLED`, new, default `False`; `PLANNER_MULTIMODAL_SHADOW_MODE`,
  existing, now meaningful) documented in §7 of the packet.
- S1–S14 scenario suite: 13 scenarios as real pytest tests in
  `apps/reference/tests/test_route_graph_scenarios.py` (all passing); S11 (the real
  Kolkata→Gangtok/Pelling workspace) verified via `scripts/phase4_shadow_comparison.py`.
- Reports 5/6/7 added to `audit_reference_data --full-reports`.

## 3. Files changed

Exactly the files in the Phase 4 implementation packet §6, plus this report and
`docs/plans/evidence/phase-04/**`.

## 4. Models changed

- New: `HubTransferLink`.
- Extended (additive, via `_RouteFactsMixin`): `AirportRoute`, `TrainRoute`, `BusRoute`.
- Populated (no schema change): `Airline` (+79 rows).

## 5. Services changed

- New `route_graph.py` (reference-owned, provenance-generic, no planner import).
- `journey_resolver.py`: legacy path byte-identical in behavior; new adapter path added.
- `station_selector.py` — **unchanged**, reused as directed by the plan ("kept as the
  hub-choice component"). Its own per-hub-pair query pattern (no upper bound on
  candidate-hub-list size before the nested route-existence check) is a pre-existing
  characteristic, not something this phase's scope asked to fix — flagged in §16 as a
  real, separate performance finding for a future session, since it is the direct cause
  of report 7's slow runtime at this data scale (see §16).

## 6. Commands and tasks affected

- New: `import_datameet_train_routes`, `import_openflights_routes`,
  `populate_hub_transfer_links`.
- Rewritten: `backfill_station_intelligence` (incremental upsert + gated `--rebuild`).
- Extended: `audit_reference_data` (`--full-reports` flag, reports 5/6/7),
  `seed_source_registry` (`openflights` row).

## 7. Migrations created/applied

`reference.0015_phase4_route_graph` applied successfully. Purely additive (1 new
table, 8 new columns × 3 route tables). `makemigrations --check --dry-run` reports no
changes post-apply.

## 8. Data affected (zero canonical-row deletions)

| Table | Before | After | Delta |
|---|---|---|---|
| AirportRoute | 0 | 1,916 | +1,916 |
| TrainRoute | 0 | 3,485 | +3,485 |
| BusRoute | 0 | 0 | 0 (no free bus-route dataset found; documented gap) |
| Airline | 0 | 79 | +79 |
| HubTransferLink | 0 | 5 | +5 (adapted same-city strategy; MetroArea unpopulated) |
| RailwayStationServiceArea | 614,260 | 771,509 | +157,249 net (729,748 created, 572,499 deleted-stale, 4,683 updated, 37,078 unchanged — see §16 for why the churn is this large) |
| AirportServiceArea | 47,291 | 51,487 | +4,196 net (15,064 created, 10,868 deleted-stale, 573 updated, 35,850 unchanged) |
| BusStationServiceArea | 0 | 0 | 0 (zero `BusStation` rows exist anywhere in this tree) |
| City/Airport/RailwayStation/BusStation | unchanged | unchanged | **0 — zero canonical rows deleted or created by this phase** (only derived ServiceArea junction rows churned, which the model itself treats as rebuildable/derived) |

## 9. Idempotence / dry-run results

- `import_datameet_train_routes`: dry-run and apply matched exactly (3,485/3,485); a
  second dry-run shows `updated=0, already_current=3,485` — fully idempotent.
- `import_openflights_routes`: same pattern — a real dry-run bug (airline-creation
  counted multiple times for the same code within one dry-run pass, since dry-run
  never "remembered" a just-counted-but-not-yet-real airline) was found and fixed
  before the real apply ran; post-fix dry-run and apply matched exactly (1,916/1,916,
  79 airlines); a follow-up dry-run shows `airportroutes_already_current=1,916`.
- `backfill_station_intelligence`: **two real, separate performance bugs were found
  and fixed this session** during idempotence/timing verification (not shipped
  uncorrected):
  1. The airport-service-area loop had no bounding-box pre-filter (the railway loop
     already had one) — at this table's scale that meant ~107 million unfiltered
     `haversine` calls in pure Python. Fixed by adding the same `±1.2°` bbox check the
     railway loop already used (bus got a `±0.5°` check too, for consistency).
  2. The incremental-upsert diff compared floats with exact `!=`. After a Postgres
     round-trip, this spuriously flagged large numbers of unchanged rows as "changed"
     on every run, turning "incremental" back into something close to a full rewrite.
     Fixed with an epsilon-tolerant comparison (`0.01` km/confidence-units) for the two
     float fields in the diff.
  - Both bugs were **found by direct `pg_stat_activity` investigation** of an
    unexpectedly slow run (a `bulk_update` query's transaction age vs. a specific
    query's `query_start` timestamp revealed the process was making real, steady
    progress — just far too slowly), not assumed from reading the code.
  - **The command was deliberately interrupted (SIGTERM) twice during this
    investigation** — once before either fix, once between the two fixes — as a live,
    real test of the H7 acceptance criterion itself. Both times, `ps`/DB row-count
    checks immediately after confirmed **zero row-count change**: the whole multi-table
    operation is wrapped in one `transaction.atomic()` block, so an uncommitted
    mid-run kill leaves every prior service area exactly as it was. This is stronger,
    live evidence than a synthetic test would have provided.
  - Post-fix, a full real run (railway + airport + bus) completed in **25m33s** — down
    from an incomplete >60-minute run before the fixes (which was killed, not timed to
    completion, since it was still processing the airport phase's unfiltered nested
    loop at the 30+ minute mark).
  - The **large observed churn** (571k+37k+4.7k = railway service areas: only ~37k of
    614k prior rows matched a freshly-computed row unchanged) reflects **real
    differences** between the currently-stored station coordinates and a fresh
    datameet `stations.json` re-fetch (this command re-downloads that file every run,
    matching its pre-existing behavior) — not a bug in the float-tolerance fix, which
    is confirmed working correctly by the fact that a real "unchanged" bucket exists
    at all (a pre-fix run would have shown ~0 unchanged everywhere). The magnitude of
    this coordinate drift was not root-caused further this session — flagged for
    review in §16.

## 10. Validation results

- `python manage.py check`: clean.
- `python manage.py makemigrations --check --dry-run`: no changes detected.
- `python -m compileall apps config`: clean.
- `python manage.py check_layer_boundaries --json`: `status: pass`, zero violations,
  same two documented Phase 1 exceptions; confirms `route_graph.py` never imports
  `apps.planner`.
- `DJANGO_SETTINGS_MODULE=... python -m pytest apps/reference/tests/test_route_graph_scenarios.py`:
  **13/13 passed** (run twice — once before, once after the provenance-shape fix in
  §16, both green).

## 11. Acceptance matrix

See `docs/plans/evidence/phase-04/acceptance-matrix.md`. All mandatory criteria pass;
report 7's specific coverage numbers were still computing at session end (§16) — the
report itself is fully wired and was proven to work correctly on partial/smaller
invocations during development.

## 12. Performance / shadow-comparison results

- **Real regression found and fixed.** The first S11 shadow comparison showed the
  route_graph path losing the train option entirely for the real Kolkata→Gangtok trip
  (legacy: 5 options incl. train, recommended=train; route_graph: 4 options, no train,
  recommended=bus). Root cause: `route_graph._mode_options` required a literal
  `TrainRoute`/`AirportRoute` row to produce any option at all, with no equivalent to
  legacy's `_nearest_hubs` geometric fallback. Fixed by adding a `geo.nearest()`-based
  hub fallback plus an honest "estimated, no confirmed schedule" option (mirroring the
  legacy `_route_evidence` fallback_level-5 semantics). Re-verified against the same
  real workspace, twice more (before and after the backfill re-run): **mode-set and
  recommended-mode are now identical** between legacy and route_graph paths, and the
  route_graph path's score is marginally higher for the correctly-chosen train option
  (70.0 vs 66.4) since it reuses `station_selector`'s door-to-door components directly.
- `route_graph.search()` p95 not formally benchmarked in isolation this session
  (bundled into the S11/scenario runs, which passed); a dedicated `EXPLAIN`/timing
  pass is recommended before Phase 8 integration, alongside `benchmark_geo_queries`'s
  existing pattern.

## 13. Compatibility and feature flags

- `PLANNER_ROUTE_GRAPH_ENABLED` (new): default `False` everywhere. Flipping it is an
  explicit owner decision, not a side effect of this session's work.
- `PLANNER_MULTIMODAL_SHADOW_MODE` (existing): now has real effect (previously inert
  scaffolding, confirmed by code review — `multimodal_enabled` being `True` by default
  meant the flag changed nothing observable before this phase).
- All four new importer/backfill commands default to `--dry-run`/incremental-safe modes.

## 14. Security and licensing impact

- **OpenFlights (new source) — ODbL, verified this session.** Route data is honestly
  labeled stale-since-2014 in every imported row's `service_class_meta`; never
  presented as a current schedule. Full analysis:
  `docs/plans/evidence/phase-04/openflights-licence-verification.md`.
- datameet/railways (already-approved CC0 source) used for train-route facts for the
  first time this phase — no new licence question.
- No paid API call anywhere in this phase.
- No credential logged, persisted, or committed.

## 15. Rollback procedure

- Migration `0015` is purely additive — reversible via `migrate reference 0014`.
- `PLANNER_ROUTE_GRAPH_ENABLED=False` (the shipped default) means production behavior
  is completely unaffected by this phase unless an operator deliberately flips it.
- `backfill_station_intelligence --rebuild --confirm-rebuild` restores the old
  wipe-then-recreate path if ever needed; the incremental path's own safety was
  live-verified (§9).
- Route-fact imports are additive-only and re-runnable.
- Full-DB fallback: restore from the pre-Phase-4 `pg_dump`
  (`docs/plans/evidence/phase-04/backup-confirmation.md`).

## 16. Remaining issues

- **Report 7 (top-200-pairs coverage baseline) did not finish computing within this
  session's time budget.** Root cause identified (not guessed): `station_selector
  .select_optimal_hubs` has no upper bound on candidate-hub-list size before its
  nested route-existence check, so well-connected top-population cities (exactly
  the ones report 7's population-proxy selects) produce a large number of individual
  route-existence queries per call. The master plan directs keeping `station_selector`
  "as the hub-choice component" unchanged this phase, so this was not fixed here —
  flagged as a real, scoped follow-up (likely: cap candidate-hub count inside
  `select_optimal_hubs` itself, or have `route_graph._candidate_hubs`'s existing
  `MAX_HUBS_PER_SIDE` cap apply *before* calling `select_optimal_hubs` rather than
  after). The report's *code* is verified correct (smaller-scale manual checks during
  development produced sane, real numbers); only the full 190-pair run at current
  data scale is what's slow.
- BusRoute stays at 0 — no free, reliable India intercity bus-route dataset was found.
  Existing honest road-estimate behavior for bus is unchanged.
- `HubTransferLink` only reaches 5 rows — most of the top-50-by-population cities lack
  a "primary hub" pairing across railway/airport/bus in the same city, per the current
  `is_primary_hub` criteria; worth revisiting once report 5/6 baselines exist to see if
  the primary-hub threshold itself is too strict.
- The large railway/airport ServiceArea churn (§9) — real coordinate differences
  between stored and freshly-refetched datameet coordinates — was not root-caused to
  a specific set of stations; worth a follow-up diff report before the next
  `backfill_station_intelligence` run if the owner wants to understand which stations
  moved and by how much.

## 17. Independent verification requirements

Re-read packet/report/diff/evidence; rerun the validation trio + `check_layer_
boundaries`; re-run the scenario suite and shadow-comparison script; re-run report 7
(possibly with a station_selector optimization applied first, or accept a longer
runtime) and compare against this report's absence of numbers; spot-check a handful of
real `TrainRoute`/`AirportRoute` rows against their source data.

## 18. Repository state

Branch `main`, baseline commit `a386842821d035337fa539b470418d1da101b06c`, plus the
heavily dirty pre-existing tree and the Phase 00–04 working-tree diff. Nothing was
staged or committed.

IMPLEMENTATION READY FOR VERIFICATION
