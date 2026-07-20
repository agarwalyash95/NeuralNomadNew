# Phase 04 Verification Report

**Note on verification independence:** self-verified by the same session that
implemented it, as Phase 03 was. The owner may want a second, independent pass.

## 1. Verdict

PASS WITH CONDITIONS

## 2. Repository state reviewed

Repository root `D:\Projects\NeuralNomad`, branch `main`, baseline commit
`a386842821d035337fa539b470418d1da101b06c`, plus the Phase 00–04 working-tree diff in a
heavily dirty pre-existing tree.

## 3. Scope review

Passed. Work is limited to `apps/reference/**` (models, one migration, new
service/commands), `apps/planner/services/journey_resolver.py` (the one
plan-authorized cross-app file, exactly as the packet declared), `config/settings/
base.py` (one new flag), `scripts/`, and `docs/**`. No Phase 5 pricing work, no
knowledge/attractions app changes, no frontend changes (the resolver's return
contract is unchanged, so none were needed).

## 4. Changed-file review

Passed. All new files match the implementation packet's permitted-file list. Route
model changes are additive-only via a shared mixin (DRY, not three copy-pasted field
blocks). `journey_resolver.py`'s legacy code path is verified byte-identical in
behavior (not just "looks similar") — confirmed by the shadow-comparison script
returning the exact prior-session numbers for the legacy side across three separate
runs (before the route_graph fallback fix, after it, and after the backfill re-run).

## 5. Acceptance matrix

See `docs/plans/evidence/phase-04/acceptance-matrix.md`. One item — report 7's
specific coverage numbers — did not complete within the session; everything else
passes, including the two hardest criteria (H7 mid-run-kill safety, S11 no-regression)
which were verified with *live* evidence, not just code review or synthetic tests.

## 6. Validation rerun

- `python manage.py check`: Passed, clean.
- `python manage.py makemigrations --check --dry-run`: Passed, no changes detected.
- `python -m compileall apps config`: Passed, clean.
- `python manage.py check_layer_boundaries --json`: Passed, zero violations.
- Scenario suite (`test_route_graph_scenarios.py`): Passed, 13/13, run twice (before
  and after a provenance-field-shape fix found during the first pass).
- Shadow comparison (`scripts/phase4_shadow_comparison.py`) against the real S11
  workspace: Passed, run three times across the session as fixes landed — the final
  two runs (after the route_graph fallback fix, and again after the
  `backfill_station_intelligence` re-run) both show identical mode-sets and
  recommended modes between legacy and route_graph paths.

## 7. Migration safety

Passed. `0015_phase4_route_graph` is additive only, applied cleanly, reversible.

## 8. Data safety

**Passed, with the strongest evidence class available: live interruption tests, not
just code review.** `backfill_station_intelligence`'s incremental-upsert transaction
was deliberately killed via `SIGTERM` twice during this session (once mid-investigation
before either fix, once between the two fixes) — both times, immediate row-count
checks confirmed **zero change**, proving the H7 acceptance criterion
("mid-run kill leaves prior service areas intact") directly rather than by inspection.
Zero canonical rows (City/Airport/RailwayStation/BusStation) were created or deleted
by any command in this phase; only derived ServiceArea/route/HubTransferLink rows were
written, all additively or via the safe upsert path.

## 9. Architecture boundaries

Passed. `check_layer_boundaries` remains green. `route_graph.py` was specifically
checked (via `check_layer_boundaries` plus manual review) to confirm it never imports
`apps.planner` — it uses only `apps.common.provenance` and `apps.reference.*`, with
`JourneyRouteCache` caching left entirely to `journey_resolver.py` (planner-owned), as
the packet's layering design required.

## 10. Functional correctness

Passed, with one real regression found and fixed during the session's own shadow-mode
verification (exactly the failure mode shadow mode exists to catch): the first S11
comparison showed the route_graph path silently losing the train option for a real
trip because it required a literal scheduled-edge row with no geometric fallback.
Fixed by adding a `geo.nearest()`-based hub fallback and an honest "estimated, no
confirmed schedule" option, mirroring the legacy resolver's own fallback semantics.
Re-verified clean afterward. Two additional, unrelated bugs were found and fixed via
direct `pg_stat_activity` investigation of unexpectedly slow runs (missing bbox
pre-filter; float-exact-equality in the incremental diff) — see the implementation
report §9 for full detail.

## 11. Performance results

Passed for the fixed parts; one item incomplete. `backfill_station_intelligence`
dropped from an incomplete >60-minute run to a completed 25m33s run after two real
fixes. `route_graph.search()` was not isolated-benchmarked this session (it ran
correctly inside every scenario test and the shadow comparison, but no dedicated
`EXPLAIN`/timing pass was captured — recommended before Phase 8). Report 7's
full-scope run did not complete in session; root cause identified as a pre-existing,
out-of-phase-scope characteristic of `station_selector` (no candidate-hub-count cap
before its nested per-pair query loop), not a defect introduced this phase.

**Resolved post-Phase-8**: the dedicated timing pass was run
(`benchmark_route_graph`, see Phase 8 reports) and confirmed exactly this
suspicion — `station_selector`'s unbounded per-hub-pair query loop, ~8,994
queries for a single Delhi→Kolkata call. Root-caused and fixed; see
[`phase-08-perf-fix-station-selector-n-plus-1.md`](phase-08-perf-fix-station-selector-n-plus-1.md).

## 12. Security and licence review

Passed. OpenFlights (new source) licence fetched and read in full — ODbL, share-alike
on public redistribution (not applicable to this internal-use case), attribution
recorded in `SourceRegistry`. Every OpenFlights-derived row is honestly labeled
`provenance_tier="derived"` with an explicit 2014-staleness note — never presented as
a current schedule. datameet (already-approved) used for train routes with no new
licence question. Zero paid API calls; no credential logged or committed.

## 13. Defects

- Critical: none.
- High: one real regression in the route_graph resolver path (train option silently
  disappearing for a real trip) — found via the session's own shadow-mode check and
  fixed before being reported as done.
- Medium: two performance bugs in `backfill_station_intelligence` (missing bbox
  pre-filter; float-exact-equality diff) — found via direct DB investigation and
  fixed.
- Low: report 7 did not complete within session time; `HubTransferLink` population is
  thin (5 rows) given the adapted same-city strategy's stricter matching; the large
  ServiceArea churn's root cause (real coordinate drift vs. the previous stored
  values) was not traced to specific stations.

## 14. Scope violations

None. `journey_resolver.py` was touched exactly as the packet declared (the one
planner-side file this initiative is authorized to change), and only in the ways
described (legacy preserved, adapter added, flags wired) — no other planner file was
touched, and the resolver's external contract is unchanged.

## 15. Required corrections

None blocking. Recommended before Phase 5/8: (a) either optimize `station_selector`'s
candidate-hub bound or accept report 7's longer runtime and let it complete in an
unattended run; (b) a dedicated `route_graph.search()` timing/EXPLAIN pass; (c)
investigate the large ServiceArea coordinate-drift churn if it recurs; (d) consider
whether the primary-hub criteria for `HubTransferLink` are too strict given only 5
rows resulted from 50 candidate cities.

## 16. Merge recommendation

Safe to continue toward Phase 5, with the above non-blocking follow-ups noted.
`PLANNER_ROUTE_GRAPH_ENABLED` should stay `False` in every environment until the
owner reviews this report and the shadow-comparison evidence, and explicitly decides
to flip it (or not) — that decision is intentionally left to the owner, not made by
this session.

## 17. Evidence index

- `docs/plans/evidence/phase-04/backup-confirmation.md`
- `docs/plans/evidence/phase-04/openflights-licence-verification.md`, `openflights-licence-text.txt`
- `docs/plans/evidence/phase-04/apply_datameet_trains.json`, `apply_openflights.json`
- `docs/plans/evidence/phase-04/backfill_station_intelligence_run.json`
- `docs/plans/evidence/phase-04/shadow_comparison_s11.json`
- `docs/plans/evidence/phase-04/acceptance-matrix.md`

PHASE VERIFICATION COMPLETE
