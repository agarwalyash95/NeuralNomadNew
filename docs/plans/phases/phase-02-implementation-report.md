# Phase 02 Implementation Report

## 1. Objective

Deliver the shared, indexed, publishability-gated geospatial foundation required by the
approved Phase 2 plan.

## 2. Scope implemented

- Shared coordinate validation, placeholder detection, Haversine, latitude-aware bbox,
  queryset prefilter, and nearest lookup.
- Three compatibility delegations.
- Four additive fields and eight composite indexes in migration `0013`.
- Generic queryset/object publishability with a compatibility alias.
- Publishability applied to explore, planner candidate pools, and hub selection.
- Per-state reports 1/2/9 with optional full row-level reasons.
- Dry-run-first open-data/linked-coordinate command and safely gated legacy entry point.
- Applied coordinate/publishability repair and read-only performance evidence.

## 3. Files changed

Exact product/test/script files are those permitted by the implementation packet, plus
this report and `docs/plans/evidence/phase-02/**`.

## 4. Models changed

- City: `coordinate_confidence`, `is_publishable`, composite coordinate index.
- MetroStation: nullable latitude/longitude.
- Airport, RailwayStation, BusStation, and four place-master models: composite coordinate
  index only.

## 5. Services changed

- New `reference.services.geo` owns coordinate math/storage abstraction.
- Existing resolver/explore/planner Haversine APIs are compatibility wrappers.
- Reference provenance now owns publishability filtering.
- Station selection excludes non-publishable hubs.

## 6. Commands and tasks changed

- `audit_reference_data` emits reports 1/2/9.
- New `backfill_reference_coordinates` is dry-run-first and open-data-only.
- `backfill_city_coordinates` exposes the source ladder and gates Google behind four
  explicit conditions. No task queue changed.

## 7. Migrations created/applied

`reference.0013_phase2_geospatial_foundation` applied successfully. It is additive and
has no data operation. Post-apply discovery and plan are empty.

## 8. Data affected

- 8,364 city coordinate repairs: 8,362 linked-station derived, 2 curated.
- 15,123 cities marked publishable with confidence initialized.
- 270 placeholder and 2 missing-coordinate cities remain stored but non-publishable.
- Zero station, service-area, route, or row-count change.

## 9. Dry-run results

Preview and apply counts matched. Post-apply preview proposes zero coordinate and
publishability updates. Google preview made zero requests.

## 10. Validation results

- Boundary, Django, migration drift/plan, compileall: Passed.
- Geo plus existing reference scenarios: 6 passed.
- Full reports and physical index inventory: Passed.
- Legacy/open command previews: Passed and idempotent.

## 11. Acceptance matrix

All mandatory Phase 2 acceptance criteria passed. See `acceptance-matrix.md`.

## 12. Performance results

The exact Phase 0-comparable service-area nearby-hub workload produced 1.57 ms median,
2.917 ms p95, and 3.467 ms max against the 50 ms gate. The separate 80 km bbox fallback
produced a 10.061 ms median but a scheduling-sensitive 80.476 ms process-level p95;
PostgreSQL nevertheless chose `ref_rail_lat_lon_idx` by default. This diagnostic is
recorded as an operational tail-risk observation, not substituted for the plan's explicit
baseline-relative workload.

## 13. Compatibility and feature flags

- All old Haversine function names remain callable.
- `exclude_unverified` remains as a publishability compatibility alias.
- No feature flag changed.
- Google coordinate writes now require `--source google --apply --allow-paid-api` and a
  positive `--max-google-calls`; none ran.

## 14. Security and licensing impact

No credential was logged or persisted. DataMeet and Wikidata were read only during the
preview; both are approved open sources. The apply used no network. No paid API ran.

## 15. Rollback procedure

Reverse migration `0013` for schema/index rollback. Use the owner-confirmed backup to
restore exact pre-repair city coordinate values if needed. Code can be reverted by owned
hunks; no row deletion recovery is necessary.

## 16. Remaining issues

- 314 stations remain coordinate-less because neither approved open endpoint supplied an
  exact match; coverage is nevertheless 96.5154%, above the gate.
- 270 centroid and 2 missing-coordinate cities remain non-publishable for later Phase 3
  reconciliation.
- Country-bbox validation awaits an approved bbox registry in Phase 3; global range and
  sentinel checks are live now.
- Indexed geo-fallback median latency is healthy, but its local process-level p95 showed
  scheduler-driven variance; Phase 3's mandatory benchmark checkpoint should repeat it.
- The dirty models file contains a pre-existing trailing-space warning outside Phase 2
  hunks; it was preserved.

## 17. Independent verification requirements

Re-read packet/report/diff/evidence; rerun boundaries, Django/schema/compile checks,
focused tests, idempotence, audit/detail metrics, performance/EXPLAIN, migration review,
and scope review without production edits.

## 18. Repository state

Branch `main`, baseline commit `a386842821d035337fa539b470418d1da101b06c`, plus the
heavily dirty pre-existing tree and Phase 00–02 working-tree diff. Nothing was staged or
committed.

IMPLEMENTATION READY FOR VERIFICATION
