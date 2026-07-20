# Phase 9 Implementation Packet — Performance & operational hardening

- Date: 2026-07-20, Asia/Calcutta
- Agent/platform: Claude Code (Sonnet 5)
- Source: `docs/plans/reference-foundation-and-planner-intelligence-master-plan.md` §14, Phase 9 section.
- Trigger: owner said "execute remaining phases" (Phase 9 + Phase 10) after Phase 8 closed.

## Scope

Phase 9's own text calls this "Risks: low" — additive tooling, not structural change. Investigation before writing found every sub-item has a clear, real starting point already in the codebase (an EXPLAIN precedent in `benchmark_geo_queries.py`, a rich `PlanGenerationJob.usage` field never aggregated, 10 existing coverage reports never combined into one payload, a `pg_dump`/`pg_restore` procedure already used identically 4 times) — this phase consolidates and extends what exists rather than inventing new infrastructure wholesale.

## Built

1. `reference_dashboard --json` — one payload combining `audit_reference_data` (reports 1-10), `benchmark_geo_queries` (PostGIS adoption triggers), `evaluate_price_estimators` (holdout metrics), `recompute_completeness` (dry-run preview), a new cross-job `PlanGenerationJob.usage` aggregation, and real `EXPLAIN` output for the 4 named query shapes.
2. `generation_usage_summary` (planner-owned) — the usage-aggregation logic, separated into its own planner command after a real boundary-check failure showed the dashboard's first draft importing `apps.planner.models` directly; `reference_dashboard` now calls it via `call_command`, respecting D-004.
3. `scripts/phase9_n_plus_1_audit.py` — real query-count profiling of `validate_plan`/`score_plan`/`_stamp_transit_hints`/`_price_transport_blocks` against the real S11 workspace's already-generated `PlannerTrip.days`, comparing 8-day vs. 1-day query counts.
4. `docs/runbooks/cache-key-registry.md` — catalogs all 6 real existing Redis cache-key namespaces, plus a documented (not built) SWR design for suggestions and a recorded decision against materialized route summaries.
5. `docs/runbooks/recovery-runbook.md` — consolidates the pg_dump/restore procedure (proven identically 4 times already), re-run-import-batch guidance, and embeddings-backlog rebuild guidance.

## Deferred, decisions recorded

- **Materialized route summaries**: trigger condition ("P4 latency targets missed") was true when this phase started, but a same-session fix (`task_ab02ca90`) resolved the underlying latency defect before this phase's own work was done — decision recorded as no-longer-needed, not built.
- **Redis SWR for suggestions**: genuinely greenfield; design documented in the cache-key registry, not implemented — a materially larger change than one phase's "explore" scope.

Full detail in `phase-09-implementation-report.md`.
