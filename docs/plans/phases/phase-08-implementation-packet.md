# Phase 8 Implementation Packet — Planner integration

- Date: 2026-07-20, Asia/Calcutta
- Agent/platform: Claude Code (Sonnet 5)
- Source: `docs/plans/reference-foundation-and-planner-intelligence-master-plan.md` §14, Phase 8 section (line 603).
- Trigger: owner said "execute phase 8" after Phase 7 closed.

## Scope correction: two of this section's own claims were false or premature

Fresh investigation before writing this packet found:

1. **False**: *"`_price_transport_blocks`/budget flows on `price_estimator` (done in P5 — this phase removes the kill-switch after soak)"*. Read `_price_transport_blocks` in full — it calls only `lookup_live_price`, never `price_estimator`, exactly as Phase 5's own report already stated. No kill-switch of any kind exists in settings or code to remove.
2. **Premature**: *"journey flow fully on `route_graph.search`"*. `PLANNER_ROUTE_GRAPH_ENABLED` defaults `False`; Phase 4's own reports are explicit the flip is an owner decision gated on more evidence than existed at the time this phase started — including a still-open prerequisite Phase 4 itself named: *"a dedicated `EXPLAIN`/timing pass is recommended before Phase 8 integration."* That specific piece is real, unbuilt, and legitimately this phase's to do — see below, and it turned up a serious real finding.

## In scope (executed)

1. **`route_graph.search()` timing benchmark** (`benchmark_route_graph` management command) — Phase 4's own deferred prerequisite. **Does not flip `PLANNER_ROUTE_GRAPH_ENABLED`.**
2. **Price-sanity validation check** (`_validate_day_price_sanity` in `validation.py`) — compares priced cab/bus/train blocks against `price_estimator`'s envelope for the same distance, warning-only outside a `[min/1.5, max*1.5]` tolerance.
3. **Geography-sanity validation check** (`_validate_day_geo_sanity`) — flags a block implausibly far (>200km) from its day's city centroid, warning-only.
4. **Both surfaced through the existing scorecard `reasons` mechanism** (`scoring.py::_add_warning_reasons`'s `labels` dict) — no new scorecard field, no schema change.
5. **S11 regression** (`scripts/phase4_shadow_comparison.py`) re-run for a sanity check that nothing in the (untouched) journey-resolution path drifted.
6. **Verification**: standard trio, `check_layer_boundaries --json`, frontend `tsc --noEmit`, a real scoped script exercising both new validation checks.

## Explicitly deferred (documented, not silently dropped)

- `PLANNER_ROUTE_GRAPH_ENABLED` flip — stays `False`, owner-gated. This phase's own benchmark finding (below) makes the case for NOT flipping it even stronger than Phase 4 left it.
- Wiring `_price_transport_blocks`'s core pricing logic onto `price_estimator` — the "done in P5, remove kill-switch" framing was false; actually building this would be new integration work, not cleanup, and is left for a future, deliberately-scoped pass.
- Deleting the legacy journey-resolver path — explicitly a P10 action.

## A real, serious finding from the benchmark

`route_graph.search()`'s real median latency across 13 real city-pair calls was **~8 seconds**, with a worst case of **48 seconds** — completely unacceptable for a synchronous request path. This directly validates (with real numbers, not a guess) Phase 4's own suspicion about `station_selector`'s unbounded query loop. Flagged as background task `task_ab02ca90` with a concrete investigation starting point; not fixed in this phase (root-causing and fixing a performance defect in Phase 4's own code is a separate, focused piece of work, not part of Phase 8's validation-addition scope).

Full detail is in `phase-08-implementation-report.md`.
