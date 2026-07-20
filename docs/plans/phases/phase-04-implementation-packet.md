# Phase 04 Implementation Packet

## 1. Objective

Enrich route facts, ship the V1 multimodal route-graph search behind existing/new
flags, and turn `journey_resolver` into a thin adapter over it — without changing its
external return contract, so `plan_generation.py` and every downstream consumer need
zero changes.

## 2. Canonical-plan references

- Master plan §7.1 route-model extensions; §7.2 `HubTransferLink`.
- Master plan §9 (multimodal route graph: §9.1 graph definition, §9.2 V1 algorithm,
  §9.3 version roadmap, §9.4 the 14 acceptance scenarios).
- Master plan §6.2 reports 5/6/7.
- Master plan Phase 4 at §14. H7 (`backfill_station_intelligence` wipe-and-rebuild).

## 3. Current repository findings (materially different from what the plan assumed)

- **`AirportRoute`, `TrainRoute`, `BusRoute`, `HubTransferLink`(new), `MetroArea`,
  `MetroAreaCity`, `TransferProfile` are all at zero rows.** The plan's Phase 4 scope
  text ("route-fact backfill... frequency/operating_days from datameet schedules...")
  reads as enrichment of sparse-but-existing data; the reality is these tables have
  **never been populated at all** — confirmed by direct count and by grep showing no
  seeder anywhere ever wrote to them. This changes Phase 4 from "enrich" to "populate
  from scratch," and is documented here rather than silently absorbed.
- `RailwayStation.code` is 100% populated (9,011/9,011) — a solid join key.
- `AirportServiceArea` (47,291 rows) and `RailwayStationServiceArea` (614,260 rows)
  exist and are populous (Phase 0-era backfill) — access/egress edges for §9.1 already
  exist; only scheduled edges are the gap.
- **`MetroArea`/`MetroAreaCity` being empty means `HubTransferLink`'s planned
  population strategy ("top-50 metro areas") has no metro-area substrate to key off.**
  Adapted design (§5 below): same-city Airport↔RailwayStation↔BusStation pairs for the
  top-N cities by population (Phase 3's `City.population`), not metro areas.
- Two free, real route-fact sources were identified and verified this session:
  - **datameet/railways `trains.json`** (already `[VERIFIED]` CC0 in master plan §5,
    used today only for station coordinates): 5,208 real train-service features, each
    with `from_station_code`/`to_station_code`/`name`/`number`/`duration_h`/
    `duration_m`/`distance`/`departure`/`arrival`. This is genuinely usable for
    `TrainRoute` — no new licence question, but it is honestly stale (repo README
    calls it community-maintained, last broad update years old; treated as `derived`
    tier, never `verified`).
  - **OpenFlights `routes.dat`/`airlines.dat`** — **new source, not in the master
    plan's §5 matrix.** Licence fetched and read this session
    (`openflights.org/data.php`): Airport/Airline/Plane/Route databases are under the
    **Open Database License (ODbL)** — share-alike on redistributed derivatives,
    attribution required; route data specifically "is maintained by and imported
    directly from Airline Route Mapper" and **the source that fed it "ceased providing
    updates in June 2014" — the page's own words are "of historical value only."**
    Usable for `AirportRoute`, but every imported row must carry `provenance_tier=
    "derived"` (never `verified`/`authoritative`) and an explicit staleness note —
    exactly the honesty discipline C1/C2 established in Phase 0. Added as a new §5 row
    and a new `SourceRegistry` entry, not silently used.
- No free, reliable open dataset for India intercity **bus routes** was found this
  session (§5's own OSM row covers bus *stations*, not routes). `BusRoute` stays at
  zero new rows this phase — the existing, already-honest behavior
  (`journey_resolver._resolve_bus_mode` estimates via the road/cab leg, never claims a
  scheduled bus service) is preserved unchanged, not faked.
- `PLANNER_MULTIMODAL_SHADOW_MODE` exists (`config/settings/base.py:302`, default
  `"0"`) but has **no real effect today** — `plan_generation.py:451`'s
  `multimodal_enabled or shadow_mode` condition is already true via
  `multimodal_enabled` (default `True`), so the flag is inert scaffolding. This phase
  gives it real meaning (§7).
- `apps/reference` must not import `apps/planner` (`check_layer_boundaries`,
  D-004). `route_graph.py` therefore cannot use `apps.planner.services.foundation
  .evidence()` — it returns a provenance-generic structure built on
  `apps.common.provenance.make_provenance`; `journey_resolver.py` (planner-side) adapts
  that into the existing `evidence()`-shaped per-option dicts. This is exactly why the
  plan calls `journey_resolver` a "thin adapter," not a deletion.

## 4. Approved scope

- **Route model extensions** (1 migration, additive): `AirportRoute`/`TrainRoute`/
  `BusRoute` gain `distance_km` (float), `frequency_per_day` (nullable int),
  `operating_days` (7-char `"1111111"`-style bitmask string, Mon–Sun, default all-days
  since that's the honest default for a single-instance schedule snapshot),
  `service_class_meta` (JSON), `provenance_tier` (reusing the same choices as
  `ReferenceFieldProvenance`), `confidence` (float), `freshness_at` (datetime),
  `is_active` (bool, default True). **`fare_rule` FK is deliberately deferred to Phase
  5**, where the `FareRule` model is actually created — adding a nullable FK to it now
  would require a stub model; the correct sequencing is to add the column alongside
  its target.
- **New model `HubTransferLink`** (§7.2): generic FK pair (`from_content_type`/
  `from_object_id`, `to_content_type`/`to_object_id`) so it can link any two of
  Airport/RailwayStation/BusStation; `distance_km`, `typical_transfer_mins`, `mode`,
  `min_connection_mins`, `provenance_tier`, `confidence`. Schema created this phase;
  population uses the adapted same-city strategy (§3) for the top ~50 cities by
  population, not metro areas (which don't exist yet).
- **New `SourceRegistry` row**: `openflights` (ODbL, `active=True` — the licence is
  clear and the data is free; staleness is handled via row-level `provenance_tier`/
  `freshness_at`, not by refusing the source).
- **New commands**: `import_datameet_train_routes` (trains.json → `TrainRoute`,
  dry-run default), `import_openflights_routes` (routes.dat/airlines.dat → `Airline` +
  `AirportRoute`, dry-run default), `populate_hub_transfer_links` (same-city pairs,
  dry-run default).
- **`backfill_station_intelligence` rewritten for incremental upsert** (H7): replace
  `Model.objects.all().delete()` + `bulk_create` with a diff (`update_or_create` per
  natural key, delete only rows no longer implied by the current pass, and only after
  the new/updated rows are written — never a delete-then-create window with zero rows
  in between). `--rebuild` flag preserves the old wipe-then-recreate behavior, gated
  behind the same double-confirm pattern Phase 0's C3 scrub established
  (`--rebuild --confirm-rebuild`).
- **`reference/services/route_graph.py`**: the §9.2 V1 algorithm exactly — hub
  candidate collection (cap 4/mode/side), scheduled-edge lookup, access/egress
  assembly, Pareto prune (cap K=5), `JourneyRouteCache`-compatible cache key
  (unchanged contract, cache writes stay planner-owned), honest no-scheduled-option
  degradation. Provenance-generic — no `apps.planner` import.
- **`journey_resolver.py` refactor**: preserve every existing function verbatim under
  `_legacy_*` names (zero behavior change to the legacy path); add a new
  route_graph-backed path with the identical per-option return shape; two settings
  flags select behavior (§7).
- **Scenario fixtures S1–S14** (§9.4) as pytest tests in
  `apps/reference/tests/test_route_graph_scenarios.py`, following the exact style
  `test_reference_scenarios.py` already established (seeded rows, `@pytest.mark.
  django_db`, no fixture files, no restoration of the deleted *planner* pytest suite —
  this stays a `reference`-owned test module exercising `route_graph.search()`
  directly, per the plan's own file list).
- **Reports 5/6/7** added to `audit_reference_data.py`. Report 7's "top-200 India
  city-pair demand list" is built live from `City.population` (top ~20 cities,
  ~190 pairs) since no real travel-demand dataset exists — explicitly labeled a
  population-based proxy, not real search/booking volume, in the report output itself.
  Report 6 (G6–G9 curated destination lists) is wired but will read near-zero today —
  `City.destination_tags` is schema-ready (Phase 3) but the G6–G9 curated fixtures
  themselves are explicitly **Phase 6** scope; the report says so in its own output
  rather than fabricating a placeholder list.
- **`scripts/phase4_shadow_comparison.py`** (new, read-only): runs both the legacy and
  route_graph-backed resolver against the real S11 workspace (Kolkata→Gangtok/Pelling,
  the same one Phase-B evidence used) and reports a diff — the shadow-mode regression
  check the acceptance criteria require.

## 5. Explicit out-of-scope items

- V1.5 two-edge itineraries, V2 timetables, `RouteServicePattern` creation.
- Any bus-route dataset (none free/reliable found) — `BusRoute` stays empty; existing
  honest road-estimate behavior for bus is unchanged.
- `MetroArea`/`MetroAreaCity` population (no approved metro-area source identified this
  session) — `HubTransferLink` uses the adapted same-city strategy instead, documented
  as a deviation, not silently substituted.
- `FareRule` FK on route tables (Phase 5, when the model exists).
- Flipping `PLANNER_ROUTE_GRAPH_ENABLED` to `True` in any deployed environment — this
  phase ships the new path *available* and shadow-comparable; making it authoritative
  by default is an owner decision after reviewing the shadow-comparison evidence.
- Any deletion of existing rows (service areas, routes, or otherwise).
- Frontend changes — `journey_resolver`'s return contract is unchanged, so none are
  needed.

## 6. Permitted files

- `backend/apps/reference/models.py`
- `backend/apps/reference/migrations/0015_phase4_route_graph.py` (new)
- `backend/apps/reference/admin.py`, `serializers.py` (HubTransferLink registration)
- `backend/apps/reference/services/route_graph.py` (new)
- `backend/apps/reference/management/commands/import_datameet_train_routes.py` (new)
- `backend/apps/reference/management/commands/import_openflights_routes.py` (new)
- `backend/apps/reference/management/commands/populate_hub_transfer_links.py` (new)
- `backend/apps/reference/management/commands/backfill_station_intelligence.py`
  (rewritten)
- `backend/apps/reference/management/commands/audit_reference_data.py` (reports 5/6/7)
- `backend/apps/reference/management/commands/seed_source_registry.py` (add
  `openflights` row)
- `backend/apps/reference/tests/test_route_graph_scenarios.py` (new)
- `backend/apps/planner/services/journey_resolver.py`
- `backend/config/settings/base.py` (new `PLANNER_ROUTE_GRAPH_ENABLED` flag)
- `scripts/phase4_shadow_comparison.py` (new, read-only)
- `docs/plans/reference-foundation-and-planner-intelligence-master-plan.md` (§5 new
  OpenFlights row; Phase 4 checklist/completion note)
- Phase 04 plan/evidence and required continuity documents.

## 7. `journey_resolver` flag design (resolving the plan's ambiguity explicitly)

The plan names `PLANNER_MULTIMODAL_SHADOW_MODE` as the vehicle for "an A/B comparison
run first" but does not fully specify which implementation is authoritative when.
Resolved as follows, matching the plan's own rollback promise ("flag flip back to
legacy resolver path, kept intact until P10"):

- **`PLANNER_ROUTE_GRAPH_ENABLED`** (new, default `False`): selects the *authoritative*
  implementation returned to callers. `False` → the preserved legacy logic (byte-
  identical behavior to today). `True` → the new `route_graph.search()`-backed logic.
- **`PLANNER_MULTIMODAL_SHADOW_MODE`** (existing, default `False`, now meaningful):
  when `True`, the resolver *additionally* computes the non-authoritative
  implementation purely for comparison, logs a diff to `DecisionTrace`, and never lets
  it affect the returned value. Works in either direction (shadow-run route_graph
  while legacy is live, or shadow-run legacy while route_graph is live).
- Ships with `PLANNER_ROUTE_GRAPH_ENABLED=False` — the legacy path stays authoritative
  in every environment until the owner reviews `scripts/phase4_shadow_comparison.py`'s
  output and flips it deliberately.

## 8. Models affected

- New: `HubTransferLink`.
- Extended (nullable/defaulted, additive): `AirportRoute`, `TrainRoute`, `BusRoute`
  (+`distance_km`, `+frequency_per_day`, `+operating_days`, `+service_class_meta`,
  `+provenance_tier`, `+confidence`, `+freshness_at`, `+is_active`).
- Populated (not schema-changed): `Airline` (new rows from OpenFlights, filtered to
  those with a route touching an existing Airport row).

## 9. Services affected

- New `route_graph.py` (reference-owned, provenance-generic).
- `journey_resolver.py`: legacy path preserved verbatim; new adapter path added;
  return contract unchanged either way.
- `station_selector.py` unchanged (kept as the hub-choice component per the plan).

## 10. Commands and tasks affected

- New: `import_datameet_train_routes`, `import_openflights_routes`,
  `populate_hub_transfer_links`.
- Rewritten: `backfill_station_intelligence` (incremental upsert + gated `--rebuild`).
- Extended: `audit_reference_data` (reports 5/6/7), `seed_source_registry`
  (`openflights` row).
- No Celery beat/task changes.

## 11. Migrations expected

One additive migration (`0015_phase4_route_graph`): one new table
(`HubTransferLink`) + 8 new columns/defaults across 3 existing route tables. No
column altered or dropped.

## 12. Data mutation expected

- New `TrainRoute` rows from datameet (bounded by real station-code matches — no
  fabricated pairs).
- New `Airline` + `AirportRoute` rows from OpenFlights (bounded to routes where BOTH
  endpoints match an existing `Airport.iata_code`).
- New `HubTransferLink` rows for the top-N cities by population.
- `backfill_station_intelligence`'s normal (non-`--rebuild`) run from now on updates
  existing `*ServiceArea` rows in place rather than wiping the tables — a **behavior
  change to an existing command**, called out explicitly as the H7 fix, not a silent
  edit.
- **Zero deletions** of existing canonical rows anywhere in this phase (service-area
  upserts may remove *stale* service-area rows no longer implied by current data, but
  never touch City/Airport/RailwayStation/BusStation themselves).

## 13. Backup and approval gates

- Owner instruction "execute phase 4" is treated as authorization to proceed, matching
  how Phase 3 was authorized directly in conversation.
- A fresh `pg_dump` will be taken before any `--apply`/migration work in this phase
  (same direct-backup approach used in Phase 3, since the DB and client tool are both
  locally reachable).
- OpenFlights licence (ODbL) verified this session — see §3; ODbL's share-alike
  obligation applies to *redistributing* the database, not to internal application
  use, and every imported row is attributed via `SourceRegistry`.

## 14. Ordered implementation tasks

1. Add `HubTransferLink` model + route-table field extensions; generate/apply
   migration.
2. Register new model in admin/serializers.
3. Add `openflights` `SourceRegistry` row.
4. Build `route_graph.py` (V1 algorithm), unit-checked against known fixtures before
   any resolver wiring.
5. Build `import_datameet_train_routes`; dry-run; inspect; apply.
6. Build `import_openflights_routes`; dry-run; inspect; apply.
7. Rewrite `backfill_station_intelligence` for incremental upsert; dry-run-equivalent
   inspection (compare proposed vs current), then run; verify no zero-row window
   (H7 acceptance).
8. Build `populate_hub_transfer_links`; dry-run; apply for top-N cities.
9. Refactor `journey_resolver.py`: legacy preserved, new adapter added, flags wired.
10. Build the S1–S14 pytest scenario suite against real seeded fixtures; iterate until
    green.
11. Add reports 5/6/7 to `audit_reference_data`.
12. Build and run `scripts/phase4_shadow_comparison.py` against the real S11 workspace.
13. Standard trio + `check_layer_boundaries`; full before/after row-count diff proving
    zero canonical-row deletions.

## 15. Acceptance criteria (from §14 of the master plan, Phase 4)

> all 14 scenarios produce the §9.4 expected behavior on fixtures; shadow-mode
> comparison shows no regression vs current resolver on the S11 real workspace;
> report 7 baseline recorded for the top-200 pairs fixture; H7 fixed (mid-run kill
> leaves prior service areas intact).

**Scoped adjustments, stated explicitly:** several S1–S14 scenarios describe specific
real-world routes (Delhi↔Mumbai, Munnar via Aluva) — these are tested against
*seeded fixture rows*, not asserted to already exist in the live imported data (the
datameet/OpenFlights imports are real but incomplete coverage; a scenario passing on
seeded fixtures proves the *algorithm* is correct per §9.4, which is what the plan
asks Phase 4 to prove — full live-data coverage of every named city pair is not
claimed).

## 16. Validation commands

- `python manage.py check`
- `python manage.py makemigrations --check --dry-run`
- `python manage.py migrate --plan`
- `python -m compileall apps config`
- `python manage.py check_layer_boundaries --json`
- `python manage.py import_datameet_train_routes --dry-run --json` / `--apply --json`
- `python manage.py import_openflights_routes --dry-run --json` / `--apply --json`
- `python manage.py backfill_station_intelligence --json` (incremental) /
  `--rebuild --confirm-rebuild --json` (legacy path, not run this phase)
- `python manage.py populate_hub_transfer_links --dry-run --json` / `--apply --json`
- `python manage.py audit_reference_data --json` (reports 5/6/7)
- `DJANGO_SETTINGS_MODULE=config.settings.development python -m pytest apps/reference/tests/test_route_graph_scenarios.py -q`
- `python scripts/phase4_shadow_comparison.py`

## 17. Required measurements

- Before/after row counts: `AirportRoute`, `TrainRoute`, `BusRoute`, `Airline`,
  `HubTransferLink`, all four `*ServiceArea` tables.
- `route_graph.search()` p95 at current data scale (target ≤120 ms warm, DB-only).
- Shadow-comparison diff summary (option count / recommended-mode agreement) for the
  real S11 workspace.
- Report 7's top-200-pair fixture: fraction with ≥1 scheduled route in any mode.

## 18. Rollback strategy

- Migration `0015` is purely additive — reversible via `migrate reference 0014`.
- `PLANNER_ROUTE_GRAPH_ENABLED=False` is the ship default — reverting to legacy
  behavior in production requires no code change, just confirming the flag stays off.
- Route-fact imports are additive-only and re-runnable; `backfill_station_intelligence`
  keeps `--rebuild` as an explicit, double-confirm-gated escape hatch back to the old
  (also still-present) full-rebuild code path.
- Full-DB fallback: restore from this phase's pre-work `pg_dump`.

## 19. Risks

- OpenFlights route data is stale (2014) — mitigated by honest `provenance_tier=
  "derived"` + `freshness_at` + explicit staleness note in `service_class_meta`, never
  presented as current/live.
- HubTransferLink's adapted same-city strategy is a lower-fidelity substitute for the
  plan's "top-50 metro area" design — documented, not hidden; upgradable once
  `MetroArea` is ever populated (no phase currently schedules that).
- `journey_resolver` behavior drift on the new path — mitigated by the two-flag design
  keeping legacy authoritative by default, plus the S11 shadow-comparison script.
- Real imported route coverage will likely be thin relative to the full transport
  network — measured honestly by report 7, feeding a future route-fact-import
  backlog rather than being papered over.

## 20. Status

PHASE READY FOR IMPLEMENTATION
