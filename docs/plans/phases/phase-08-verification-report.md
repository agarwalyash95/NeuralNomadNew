# Phase 8 Verification Report — Planner integration

- Date: 2026-07-20, Asia/Calcutta
- Verdict: **PASS WITH CONDITIONS**, self-verified (same as Phases 03–07 — no independent second-agent review this phase).

## PASS

- `python manage.py check` — clean.
- `python manage.py makemigrations --check --dry-run` — "No changes detected" (no migrations expected this phase, confirmed).
- `python -m compileall apps config` — clean.
- `check_layer_boundaries --json` — `"status": "pass"`, 0 violations.
- `cd frontend && npx tsc --noEmit` — exit code 0, clean. Directly verifies the master plan's own Phase 8 claim ("zero contract changes in `planner.types.ts` required, frontend untouched") rather than merely asserting it.
- **`route_graph.search()` timing benchmark run for real** against the live dev DB — 13 real city-pair searches, real `time.perf_counter()` measurements, not simulated. Satisfies Phase 4's own explicitly-deferred prerequisite ("a dedicated EXPLAIN/timing pass is recommended before Phase 8 integration").
- **Price-sanity check live-verified**: a real cab block priced 26x above `price_estimator`'s real envelope (seeded Phase 5 `FareRule` data) correctly fired `price_sanity`; the same trip at the correct price correctly did not.
- **Geo-sanity check live-verified**: a block at real Mumbai coordinates tagged to a Jaipur day (real `City` row, ~900km away) correctly fired `geo_sanity`; a block near Jaipur's real centroid correctly did not.
- **Scorecard reason wiring live-verified**: a report with both new codes produces the correct, readable reason strings via the existing `_add_warning_reasons` mechanism.
- **S11 regression re-run for real**: `scripts/phase4_shadow_comparison.py` against the real S11 workspace — output identical to Phase 4's own recorded evidence (same option counts, mode sets, recommended mode, scores). Confirms zero drift from this phase's changes.

## Not completed / explicitly deferred (see implementation report + packet for why)

- `PLANNER_ROUTE_GRAPH_ENABLED` flip — stays `False`, owner-gated; this phase's benchmark finding (below) reinforces rather than resolves the case for waiting.
- Wiring `_price_transport_blocks`'s core pricing onto `price_estimator` — the master plan's premise that this was already done in Phase 5 is false; treated as new, separately-scoped integration work, not attempted here.
- Deleting the legacy journey-resolver path — explicitly a P10 action.
- ~~Fixing the `route_graph.search()` latency defect found this phase~~ — flagged as `task_ab02ca90`, subsequently root-caused and fixed in a dedicated follow-up (see "Update" below and [`phase-08-perf-fix-station-selector-n-plus-1.md`](phase-08-perf-fix-station-selector-n-plus-1.md)).

## A real, serious finding from this phase's own work

`route_graph.search()`'s real median latency across 13 real city-pair calls was **~8 seconds**, worst case **48 seconds** — confirmed via `benchmark_route_graph`, run live, not estimated. This is unacceptable for a synchronous request path and directly validates, with real numbers, Phase 4's own prior suspicion about `station_selector`'s unbounded query loop. `PLANNER_ROUTE_GRAPH_ENABLED` staying `False` means zero production impact from this being unfixed; flagged as `task_ab02ca90` rather than fixed opportunistically, since it's a real, separate, potentially substantial debugging task outside this phase's own scope (adding validation checks), and rushing a fix without proper profiling risks a worse outcome than leaving the flag off with the defect documented.

**Update — `task_ab02ca90` fixed.** Profiling a single Delhi→Kolkata call
(`CaptureQueriesContext`) confirmed the suspicion exactly: `station_selector`
loaded all `ServiceArea` rows per city with no limit (Delhi 172, Kolkata 280)
and ran a nested-loop N+1 issuing one route-existence query per candidate
pair — **8,994 queries** logged (Django's cap; true count was higher),
**53.6s** wall-clock, only 4.9s of it real DB time. Fixed via a bounded
candidate-hub cap plus two bulk queries replacing the per-pair N+1s. Re-run
of `benchmark_route_graph` on the same convention: p50 **8,051ms → 54.76ms**
(~147x), p95 **19,149ms → 77.69ms** (~246x), max **48,291ms → 133.05ms**
(~363x). All 19 existing `reference` tests still pass, `manage.py check`
clean. Full writeup:
[`phase-08-perf-fix-station-selector-n-plus-1.md`](phase-08-perf-fix-station-selector-n-plus-1.md).
`PLANNER_ROUTE_GRAPH_ENABLED` remains explicitly owner-gated regardless — this
only removes the latency blocker that made the flip unconsiderable.

## Real, separate corrections made to the master plan's own Phase 8 text

- *"`_price_transport_blocks`/budget flows on `price_estimator` (done in P5)"* — verified false by reading the function in full; it calls only `lookup_live_price`. No kill-switch of any kind exists anywhere in the codebase to remove.
- *"journey flow fully on `route_graph.search`"* as an implied Phase 8 action — verified premature; Phase 4's own reports explicitly gate the flip on an owner decision and on evidence (including this phase's own benchmark) that wasn't complete until now.

## Not independently re-verified by a second agent

Self-authored verification, same as Phases 03–07. Given this phase's real finding (route_graph's severe latency) has real product consequences, the owner may specifically want a second opinion on the benchmark methodology (13-sample size, real city pairs vs a synthetic load test) before treating the ~8s median as fully representative — though the conclusion (this needs investigation before any flip is even considered) would very likely survive a larger sample.

## Next checkpoint

Update `docs/agent/CURRENT_STATE.md` and `docs/agent/HANDOFF.md` (done alongside this report) when the owner reviews this phase or when `task_ab02ca90` lands a fix with new benchmark numbers.
