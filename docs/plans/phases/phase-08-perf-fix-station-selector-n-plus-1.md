# `route_graph.search()` latency fix — `station_selector` N+1 (task_ab02ca90)

- Status: **Fixed and re-benchmarked**. Resolves Phase 4's own deferred item
  ("`route_graph.search()` p95 not formally benchmarked in isolation... a
  dedicated `EXPLAIN`/timing pass is recommended before Phase 8 integration",
  `phase-04-verification-report.md` §11/§15) and Phase 8's flagged
  `task_ab02ca90` (`phase-08-implementation-report.md` §1,
  `phase-08-verification-report.md`).
- Does **not** change `PLANNER_ROUTE_GRAPH_ENABLED` — that remains an explicit
  owner decision. This removes the specific latency blocker that made the
  decision unconsiderable.

## Root cause

Profiled a single slow call directly (`route_graph.search(delhi, kolkata)`,
`CaptureQueriesContext`) rather than guessing from the benchmark numbers
alone. Result: **8,994 queries** (Django's own query-log cap — the true count
was higher), **8,983** of them to `reference_trainroute`, wall-clock
**53.6s**, of which only **4.9s** was actual DB execution time — the rest was
pure per-query round-trip overhead.

`apps/reference/services/station_selector.py::select_optimal_hubs()` loaded
**every** `RailwayStationServiceArea` row for each city with no limit (Delhi:
172 rows, Kolkata: 280 rows), then ran a nested Python loop over the full
cross product — up to 172×280 ≈ 48,160 pairs — issuing one
`TrainRoute.objects.filter(source=ohub, destination=dhub)` query **per
pair**. A second, smaller N+1 did the same thing for the per-pair
`ServiceArea` distance/transfer lookup used in scoring. This is exactly the
"`station_selector`'s own unbounded per-hub-pair query loop" Phase 4's report
already named as a suspect, and structurally the same shape as two
performance bugs Phase 4 found and fixed elsewhere: a missing bounding-box
pre-filter (`backfill_station_intelligence`, ~107M unfiltered haversine
calls) and a per-row query pattern that should have been bulk/bounded.

Note `route_graph.py`'s own `_candidate_hubs()` already bounds its hub
candidates to `MAX_HUBS_PER_SIDE=4` — the unbounded path was entirely inside
`station_selector.select_optimal_hubs()`, which `route_graph._mode_options()`
calls separately (only consuming `score_breakdown` from the result) and
which does its own, unrelated hub-candidate resolution from scratch.

## Fix

`apps/reference/services/station_selector.py`:

1. **Bound candidate hubs per side.** New `MAX_CANDIDATE_HUBS_PER_SIDE = 8`.
   Both the `ServiceArea`-backed path and the "no ServiceArea yet, fall back
   to all city hubs" path now order by `-is_primary_hub, distance_km` and
   slice, mirroring `route_graph._candidate_hubs()`'s own bounding
   convention. (A 3x buffer is pulled before the Python-side
   `is_publishable_instance` filter, since that filter runs after the slice.)
2. **Bulk route-eligibility query.** Replaced the per-pair
   `Route.objects.filter(source=ohub, destination=dhub)` inside the nested
   loop with one `Route.objects.filter(source_id__in=origin_ids,
   destination_id__in=dest_ids)` query, grouped into a dict keyed by
   `(source_id, destination_id)` in Python.
3. **Bulk ServiceArea prefetch for scoring.** Replaced the per-valid-pair
   `ServiceArea.objects.filter(station=ohub, city=origin_city).first()` with
   one prefetch query keyed by origin hub id, built once before the scoring
   loop.

No change to scoring weights, output contract (`recommended` /
`alternatives` / `score_breakdown` / `explanation` shape), or the
route-existence hard filter's semantics — only how the same eligibility
check and scores are computed.

## Verification

- `apps/reference/tests/test_reference_scenarios.py` (incl.
  `test_station_selector_route_eligibility`) and
  `apps/reference/tests/test_route_graph_scenarios.py` (incl.
  `test_s5_route_existence_hard_filter_prefers_junction`, which specifically
  exercises hub-pair preference) — **19/19 passed**, no behavior change.
- `python manage.py check` — clean.
- Re-profiled `search(delhi, kolkata)` with `CaptureQueriesContext`:
  **8,994 → 41 queries**, **53.6s → 56.5ms** (~950x).
- Re-ran `python manage.py benchmark_route_graph --json` (same 13-real-city,
  30-pair convention as the original finding):

| Metric | Before | After | Improvement |
|---|---|---|---|
| p50 | ~8,051 ms | 54.76 ms | ~147x |
| p95 | ~19,149 ms | 77.69 ms | ~246x |
| p99 | — | 133.05 ms | — |
| min | 45 ms | 42.03 ms | — |
| max | ~48,291 ms (Delhi→Kolkata) | 133.05 ms | ~363x |
| pairs succeeded | 30/30 | 30/30 | — |

Raw run: 15 cities considered, 30/30 pairs succeeded, 0 errors.

## What this does not resolve

- `PLANNER_ROUTE_GRAPH_ENABLED` flip — still explicitly owner-gated,
  independent of this fix.
- Report 7's full-scope run and the `HubTransferLink` thinness noted in
  `phase-04-verification-report.md` §13/§15 — unrelated, out of scope here.
- This was a targeted N+1 fix, not a general audit of `station_selector.py`
  or `route_graph.py` for other latent performance issues.
