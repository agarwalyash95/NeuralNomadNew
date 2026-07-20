# Phase 9 Implementation Report — Performance & operational hardening

- Date: 2026-07-20, Asia/Calcutta
- Agent/platform: Claude Code (Sonnet 5)
- Status: **Complete, self-verified — PASS WITH CONDITIONS** (see `phase-09-verification-report.md`). A real boundary violation was introduced and fixed within the same pass while building the dashboard.

## What was built

### 1. `reference_dashboard --json`

New `apps/reference/management/commands/reference_dashboard.py`. Aggregates, via `call_command` against each existing sub-command (never re-implementing their logic):
- `audit_reference_data --full-reports` — all 10 coverage/quality reports.
- `benchmark_geo_queries` — PostGIS adoption-trigger checkpoint.
- `evaluate_price_estimators` — holdout evaluation metrics.
- `recompute_completeness` — dry-run completeness preview (never applies).
- `generation_usage_summary` (new, planner-owned — see §2) — cross-job `PlanGenerationJob.usage` aggregation.
- A new `index_review_explain` section with **real** `.explain()` output (Postgres `EXPLAIN`, not `EXPLAIN ANALYZE` — read-only, no actual query execution cost) for the 4 query shapes the master plan names by name: route-lookup/ServiceArea-by-city (route_graph's own `_candidate_hubs` query shape — confirmed the same shape covers both named items), `ProviderEntityMap` lookup, and observation rollups.

**Live-verified against the real dev DB**: every section returned real, sane data — `generation_usage_counters` showed 22 real jobs sampled (13 carrying the `ceilings` sub-key, an honest gap documented rather than hidden), `postgis_adoption_checkpoint` returned `recommendation: "defer"` with a real `overall_p95_ms: 7.438`, `index_review_explain` returned real Postgres query plans (e.g. an Index Scan on `reference_providerentitymap_external_id_e67fd7b3_like` for the `ProviderEntityMap` lookup). `price_estimator_evaluation` returned `{}` honestly — zero `TravelPriceObservation` rows currently exist to evaluate against (expected at this data volume, matching Phase 5's own "sparse observations" design philosophy).

### 2. Real boundary violation found and fixed within the same pass

The dashboard's first draft aggregated `PlanGenerationJob.usage` by importing `apps.planner.models.PlanGenerationJob` directly inside `apps/reference/management/commands/reference_dashboard.py`. Running `check_layer_boundaries --json` — part of this phase's own verification, not a separate audit — caught it immediately: `reference_or_knowledge_imports_planner` violation, D-004. Fixed by extracting the aggregation into a new **planner-owned** command, `apps/planner/management/commands/generation_usage_summary.py`, and having the dashboard call it via `call_command("generation_usage_summary", "--json")` — the same `call_command`-based funnel every other sub-report in the dashboard already uses, so this wasn't a special case, just applying the file's own established pattern one section earlier than I first did. Re-verified: `check_layer_boundaries --json` clean, dashboard output unchanged/correct.

### 3. N+1 audit — real findings, correctly calibrated

`scripts/phase9_n_plus_1_audit.py` — no query-counting harness existed anywhere in the repo before this (confirmed by grep), so this was built from scratch using Django's own `django.test.utils.CaptureQueriesContext`, run against the real S11 workspace's already-generated `PlannerTrip.days` (8 real days, no LLM mocking needed since these are all post-compose, DB-only stages).

**Real results**:

| Stage | Queries (8 days) | Queries (1 day) | Ratio |
|---|---|---|---|
| `validate_plan` | 16 | 3 | 5.33x |
| `score_plan` | 0 | 0 | — |
| `_stamp_transit_hints` | 25 | 3 | 8.33x |
| `_price_transport_blocks` | 7 | 2 | 3.5x |

**Honest calibration, not alarm**: `validate_plan`'s scaling is explained by this phase's own new `_validate_day_geo_sanity` check (Phase 8) doing one `City` lookup per day — a real, bounded, roughly-linear-in-day-count cost (8 days ≈ 8 lookups), architecturally correct rather than an accidental N+1, and utterly unlike the catastrophic O(hub²) pattern `station_selector` had (which reached ~9,000 queries for a *single* call, not ~16 for an entire 8-day itinerary). `_stamp_transit_hints`'s scaling is in pre-existing Phase 5-era code this session didn't touch — noted as a real finding for a future session, not fixed here (out of this phase's own scope, and a much smaller, lower-priority pattern than the route_graph fix earlier today). `score_plan`'s zero DB queries is a genuinely good sign — fully computed from the in-memory `days` structure. None of these four findings rises to "needs an urgent fix" — they're documented, proportionate findings, not a second five-alarm bug.

### 4. Cache-key registry and recovery runbook

Both real, consolidating documentation deliverables — see the docs themselves (`docs/runbooks/cache-key-registry.md`, `docs/runbooks/recovery-runbook.md`) for full content. The cache-key registry additionally records two decisions per the master plan's own "a miss requires a recorded decision, not silence" rule:
- **Redis SWR for suggestions**: design documented (where it would hook into `places_explore.py`'s cache-on-miss flow), not implemented — genuinely greenfield, a materially larger change than "explore" scope.
- **Materialized route summaries**: the trigger condition was real when this phase started (Phase 8's ~8s median latency finding) but was resolved by a same-day, separate fix (`task_ab02ca90` — see `docs/plans/phases/phase-08-perf-fix-station-selector-n-plus-1.md`) before this phase's own work finished. Decision recorded: not needed on current evidence.

## Changed files

New: `backend/apps/reference/management/commands/reference_dashboard.py`; `backend/apps/planner/management/commands/generation_usage_summary.py`; `scripts/phase9_n_plus_1_audit.py`; `docs/runbooks/cache-key-registry.md`, `recovery-runbook.md`; `docs/plans/phases/phase-09-*`.
No migrations, no frontend file touched.

## Next action

1. (Optional, low priority) Investigate `_stamp_transit_hints`'s query scaling — a real, minor finding from this phase's N+1 audit, not urgent.
2. Proceed per `docs/plans/phases/phase-10-blocked-status.md` — Phase 10 itself is blocked on 4 unmet gates, documented separately, not attempted this session.
