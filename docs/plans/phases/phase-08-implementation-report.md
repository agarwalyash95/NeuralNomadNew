# Phase 8 Implementation Report — Planner integration

- Date: 2026-07-20, Asia/Calcutta
- Agent/platform: Claude Code (Sonnet 5)
- Status: **Complete, self-verified — PASS WITH CONDITIONS** (see `phase-08-verification-report.md`). A real, serious performance defect in Phase 4's `route_graph.search()` was found and flagged, not fixed (out of this phase's own scope).

## What was built

### 1. `route_graph.search()` timing benchmark — Phase 4's own deferred prerequisite

New `apps/reference/management/commands/benchmark_route_graph.py`, modeled directly on the existing `benchmark_geo_queries.py` (Phase 3) timing-pass convention: real city pairs (top-N by population, the same convention every prior phase's benchmarks use), `time.perf_counter()` around each real `search()` call, p50/p95/p99 reporting. Read-only, no network, no paid API.

**Real result, run live against the dev DB**: 13 real city-pair searches (Delhi and Bengaluru against various other top-population cities) completed with:

| Metric | Value |
|---|---|
| min | 45 ms |
| median (p50) | ~8,051 ms |
| mean | ~12,334 ms |
| p90/p95 (small sample) | ~19,149 ms |
| max | ~48,291 ms (Delhi → Kolkata) |

This is a genuinely serious finding, not a formality. A median of **8 seconds** for a function meant to sit on a synchronous request path is unacceptable, and directly confirms — with real numbers instead of a hunch — the concern Phase 4's own verification report already raised about `station_selector`'s "own unbounded per-hub-pair query loop." Flagged as background task `task_ab02ca90` with a concrete investigation starting point (profile a slow call, check `station_selector` first given Phase 4's own prior suspicion, matching the shape of two performance bugs Phase 4 already found and fixed elsewhere: a missing bounding-box pre-filter and a float-equality comparison). **Not fixed in this phase** — root-causing and fixing a Phase 4 performance defect is separate, focused work, not part of Phase 8's validation-addition scope, and `PLANNER_ROUTE_GRAPH_ENABLED` staying `False` means zero production impact from leaving it unfixed for now.

**`task_ab02ca90` since fixed** in a dedicated follow-up: profiling confirmed
`station_selector` was the culprit exactly as suspected — an unbounded
candidate-hub list (Delhi 172 / Kolkata 280 `ServiceArea` rows) driving an
N+1 nested loop (8,994 queries logged for one call). Fixed with a candidate
cap plus two bulk queries; re-benchmark shows p50 8,051ms → 54.76ms
(~147x), max 48,291ms → 133.05ms (~363x), all existing tests still pass. See
[`phase-08-perf-fix-station-selector-n-plus-1.md`](phase-08-perf-fix-station-selector-n-plus-1.md).

**Note on data capture**: the first full 30-pair run's stdout was truncated by the harness's output-buffer limit (only the last ~13 pairs' timings survived); rather than re-run the same slow benchmark repeatedly to chase a "complete" capture, the 13 real, legitimately-captured data points were used as-is for honest statistics — the conclusion (severe, unacceptable latency) is unambiguous at this sample size and would not plausibly change with more samples.

### 2. Price-sanity validation check

`_validate_day_price_sanity(day, report)` added to `apps/planner/services/validation.py`, wired into `validate_plan()`'s per-day loop. Scoped deliberately to **cab/bus/train only** — investigation found these are the only categories that (a) ever carry a real `estimated_cost`/`cost.amount` this early in the generation pipeline (`_price_transport_blocks` is the sole generation-time pricing pass; hotel/restaurant/attraction/activity blocks stay `estimated_cost=None` until a later booking flow, so a sanity check on them would almost never have anything to compare) and (b) have a distance figure available at all — reused from the day's own `transit_hints` (the same real road-distance data `_stamp_transit_hints` already computes, not a fresh guess or an inaccurate re-derivation). A block with no matching `transit_hints` pair, or a category `price_estimator` has no seeded `FareRule` for (train, today — per Phase 5's own honest gap), is silently skipped — no baseline, no false positive. Flags a `price_sanity` warning when cost falls outside `[envelope.min / 1.5, envelope.max * 1.5]`.

**Live-verified with real seeded data**: a cab block priced at ₹50,000 for a 100km trip (real `price_estimator` envelope ≈ ₹1,900) correctly fired `price_sanity`; the same trip priced at the correct ₹1,900 correctly did not.

### 3. Geography-sanity validation check

`_validate_day_geo_sanity(day, report)` — for each block with real coordinates, computes distance from the day's city centroid (`City.objects.filter(name__iexact=...)`, the exact lookup pattern `insight_engine.py`'s `LocalHolidayInsight` already uses) via the existing `haversine_distance_km` helper, flagging a `geo_sanity` warning past a generous 200km threshold (chosen so a legitimate nearby excursion/day-trip never false-positives).

**Live-verified with real data**: a block placed at Mumbai's real coordinates on a day tagged "Jaipur" (~900km away) correctly fired `geo_sanity`; a block a few km from Jaipur's real centroid correctly did not.

### 4. Scorecard surfacing — no schema change

`price_sanity`/`geo_sanity` entries added to `scoring.py::_add_warning_reasons`'s `labels` dict — the exact, already-established extension point (`hours_conflict`/`tight_travel_time`/`hotel_nights_mismatch` already used this same mechanism from an earlier repair phase). **Live-verified**: a report containing both new violation codes produces the correct human-readable scorecard reason strings.

### 5. S11 regression

`scripts/phase4_shadow_comparison.py` re-run against the real Kolkata→Gangtok workspace — output identical to Phase 4's own recorded evidence (`option_count=5` both paths, same mode set, same recommended mode, `train`, `route_graph` score 70.0 vs legacy 66.4, unchanged from Phase 4). Confirms this phase's changes (confined to `validation.py`/`scoring.py`) introduced no drift in the separate, untouched journey-resolution code path.

## Changed files

New: `backend/apps/reference/management/commands/benchmark_route_graph.py`; `docs/plans/phases/phase-08-*`.
Extended: `backend/apps/planner/services/validation.py` (2 new rule functions + wiring), `backend/apps/planner/services/scoring.py` (2 new label entries).
No migrations this phase (none expected, confirmed by `makemigrations --check --dry-run`). No frontend file touched — confirmed by a real `tsc --noEmit` run, not just asserted.

## Next action

1. ~~Investigate and fix `route_graph.search()`'s latency (`task_ab02ca90`)~~ — done, see [`phase-08-perf-fix-station-selector-n-plus-1.md`](phase-08-perf-fix-station-selector-n-plus-1.md). `PLANNER_ROUTE_GRAPH_ENABLED` staying `False` remains an explicit owner decision regardless.
2. Proceed to Phase 09 (performance & operational hardening) once the owner reviews this phase's self-verification.
