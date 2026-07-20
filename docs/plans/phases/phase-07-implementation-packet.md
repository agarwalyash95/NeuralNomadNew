# Phase 7 Implementation Packet — Knowledge application migration

- Date: 2026-07-20, Asia/Calcutta
- Agent/platform: Claude Code (Sonnet 5)
- Source: `docs/plans/reference-foundation-and-planner-intelligence-master-plan.md` §12, Phase 7 section (line 592).
- Trigger: owner said "execute phase 7" after Phase 6 closed.

## Scope: steps 1–7 of the master plan's mandated 10-step sequence (§12.2)

Step 8 ("confirm parity again after one full beat cycle — embeddings 15min, enrichment 6h") requires waiting for real production Celery beat cycles to complete, which can't happen synchronously in one session. Steps 9–10 (remove shims, remove the app) are gated on step 8 passing. This session executes steps 1–7 — real relocation, real caller migration, real parity verification against the live DB — and stops there, leaving 8–10 as an explicit, owner-timed follow-up.

## Real starting state (fresh investigation, not the plan doc's assumptions)

Nothing had been pre-migrated: `apps.reference.services.embeddings`/`enrichment` didn't exist in any form; `resolve_places()` didn't exist; no knowledge model was duplicated into `reference`. Coupling was heavier than the plan's own §12.1 table implied: `apps/reference/views.py` had 5 separate `KnowledgeEngine.resolve()` call sites, `apps/reference/tasks.py` had 3 tasks that were pure delegating wrappers into `apps.knowledge`, and `apps/planner` had 3 independent entry points into `apps.knowledge.services.embeddings` (the plan's text only names one).

All 13 real table names were plain Django defaults (`knowledge_entityembedding`, etc., confirmed against Postgres) — every state-move migration needed an explicit `Meta.db_table` pin. `EntityEmbedding` has a real pgvector HNSW index (`entity_embedding_hnsw`) that must never be rebuilt.

Deletion candidates were re-verified fresh (D-002, evidence-first): a grep for `Event`/`EmergencyContact`/`SafetyAdvisory`/`PlaceRelationship` outside `apps/knowledge/` found zero real usages (confirming the master plan's own `[VERIFIED]` tag, which only named `Neighbourhood` explicitly) — all 4, plus the already-known-dead `CrowdPattern`/`EntityInteractionLog`/`TransitOutcomeLog` trio, were genuinely safe to delete. The pre-migration row-count baseline additionally confirmed **all 8 had zero rows** — a second, data-level confirmation beyond the code-level one.

## Plan executed

1. Real `pg_dump` backup (Phase 7 is on the master plan's backup-required list).
2. Model relocation via `SeparateDatabaseAndState`: `EntityEmbedding`/`DistanceEdge`/`PlaceInsight`/`LocalTip` → `apps.reference`; `PlanInsightDismissal` → `apps.planner`; 8 confirmed-dead models deleted for real.
3. Service relocation: `embeddings.py`/`enrichment.py` → `apps.reference.services`; `KnowledgeEngine.resolve()` folded into a new `resolve_places()` in `places_explore.py`.
4. Compat shims in `apps.knowledge` (re-exports / delegating class).
5. Every real caller (~25 call sites, more than the plan's own consumer list) migrated to the new import paths.
6. Parity verification: identity checks (relocated names are the exact same Python objects, not divergent copies) plus a live behavioral comparison of `resolve_places()` vs the `KnowledgeEngine` shim, plus a real `DistanceEdge` write/read round-trip across both paths.
7. `check_layer_boundaries --strict-knowledge` — zero violations.

Full detail of what was actually built, verified, and found along the way is in `phase-07-implementation-report.md`.
