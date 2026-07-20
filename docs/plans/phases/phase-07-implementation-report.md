# Phase 7 Implementation Report — Knowledge application migration

- Date: 2026-07-20, Asia/Calcutta
- Agent/platform: Claude Code (Sonnet 5)
- Status: **Complete, self-verified — PASS WITH CONDITIONS** (see `phase-07-verification-report.md`). Steps 8–10 of the master plan's 10-step sequence are an explicit, owner-timed follow-up (see packet). One real, unrelated Phase 6 bug was found and flagged, not fixed.

## What was built

### 1. Pre-work: real `pg_dump` backup

Same direct-take approach as Phases 3/4/6, non-interactive via a scratch-file-piped `PGPASSWORD` (never printed to any log). Verified via `pg_restore --list` (931 TOC entries). Pre-migration row counts and the HNSW index definition were recorded for all 13 `apps.knowledge` tables before any change — `docs/plans/evidence/phase-07/backup-confirmation.md`.

### 2. Model relocation (migrations `knowledge.0005`, `reference.0018`, `planner.0021`, all applied together)

Used Django's documented "moving a model between apps" recipe: `makemigrations` first (which proposed plain, real `DeleteModel`/`CreateModel` pairs — a real drop+recreate, wrong for the 5 live models), then hand-edited:
- **`reference.0018`/`planner.0021`**: the auto-generated `CreateModel` bodies (fields, `db_table`, the HNSW index definition) were used **verbatim, unedited** — confirming the model classes I wrote matched the real schema exactly — wrapped in `SeparateDatabaseAndState(state_operations=[...], database_operations=[])`.
- **`knowledge.0005`**: hand-written, not autodetector output — 8 real `DeleteModel` operations for the confirmed-dead models, plus one `SeparateDatabaseAndState` block forgetting the 5 relocated models from `knowledge`'s state (again, empty `database_operations`).

**Live-verified at every step, not just reviewed**: row counts (`DistanceEdge` 830, `EntityEmbedding` 42, `PlaceInsight` 1129, `LocalTip` 87, `PlanInsightDismissal` 24) and the HNSW index definition (`CREATE INDEX entity_embedding_hnsw ... USING hnsw (embedding vector_cosine_ops) WITH (m='16', ef_construction='64')`) were re-checked against the live DB after applying `reference.0018`+`planner.0021` (byte-identical to baseline) and again after `knowledge.0005` (still byte-identical) — and the 8 dead tables were confirmed **actually gone** from `pg_tables`, not just believed gone from reading the migration.

A separate, ordinary additive migration (`reference.0019`) then added `generation_method`/`source_inputs` (both nullable) to `PlaceInsight`/`LocalTip` — kept deliberately apart from the state-only move, per the plan.

### 3. Service relocation

`apps/knowledge/services/embeddings.py` (172 lines) and `enrichment.py` (423 lines) moved to `apps/reference/services/` verbatim, with only their internal `apps.knowledge.models` imports repointed to `apps.reference.models` (same tables). `KnowledgeEngine.resolve()` — already a thin wrapper over `explore_places`/`_category_config`, both defined in `places_explore.py` — folded into a new `resolve_places()` function in that same file; the fold was mechanical, not a rewrite.

### 4. Compat shims

`apps/knowledge/models.py`, `services/embeddings.py`, `services/enrichment.py` re-export the relocated names; `services/engine.py`'s `KnowledgeEngine.resolve()` now delegates to `resolve_places()`. `apps/knowledge/admin.py` and `apps/reference/admin.py` were updated to match (the 4 reference-bound models are now registered in `reference/admin.py`; `PlanInsightDismissal` follows `apps.planner`'s existing convention of having no admin registrations at all — that app has no `admin.py` file, and none was added).

**A real boundary violation was found and fixed during this step**: the first version of the `apps.knowledge.models` shim re-exported `PlanInsightDismissal` from `apps.planner.models`, which trips `check_layer_boundaries`'s `reference_or_knowledge_imports_planner` rule (D-004: reference/knowledge must not import planner). Since every real caller of `PlanInsightDismissal` had already been migrated to import from `apps.planner.models` directly (see §5), the shim re-export was unnecessary — removed entirely rather than adding a new boundary-checker allowlist exception, which is both simpler and doesn't weaken the architectural rule the rest of the codebase already respects.

### 5. Caller migration (~25 real call sites — more than the master plan's own consumer list named)

`apps/planner/services/distance_service.py` (`DistanceEdge` ×2), `plan_generation.py` (`semantic_search`, `KnowledgeEngine.resolve`→`resolve_places`), `taste.py` (`embedding_for`, `EMBEDDING_VERSION`, `vector_search` — 3 independent entry points the plan's own text only named one of), `views.py` (`needs_enrichment`, `PlanInsightDismissal` ×3, now same-app imports); `apps/reference/services/suggestions.py` (`PlaceInsight`, `LocalTip`, now same-app), `tasks.py` (4 tasks' delegating imports repointed), `views.py` (`needs_enrichment`, `KnowledgeEngine.resolve`→`resolve_places` ×5, `LocalTip`, `semantic_search`, now mostly same-app). Stale docstrings/comments referencing the old module paths were updated alongside the real import fixes for accuracy.

### 6. Parity verification — real, not just code review

- **Identity checks** (the strongest possible proof for the 4+1 re-exported names): `apps.knowledge.models.EntityEmbedding is apps.reference.models.EntityEmbedding` and the equivalent for `DistanceEdge`/`PlaceInsight`/`LocalTip`/`PlanInsightDismissal`, plus every re-exported service function (`semantic_search`, `vector_search`, `embedding_for`, `compute_embeddings_backlog`, `enrich_one`, `needs_enrichment`, `run_enrichment_pass`) — all `True`. These aren't behaviorally-similar copies; they're the literal same Python objects, so parity is guaranteed by construction, not just tested.
- **Behavioral parity for the one genuine wrapper** (`KnowledgeEngine.resolve()` vs `resolve_places()`, which are different call signatures on the same underlying logic): called both against real DB-backed data (Bengaluru hotels). **A real, unplanned finding along the way**: the first comparison call returned `source='google_places'` (a live API call) instead of the expected `source='cache'`, despite Bengaluru having 529 real OSM-imported hotel rows from Phase 6 — see §7 below for the root cause. Re-ran the comparison after that call populated real Google-sourced cache rows: both paths then returned identical `source='cache'` and an identical 15-row result set (same PKs, same order) — confirmed behavioral parity.
- **A real `DistanceEdge` write/read round-trip**: wrote a row via `apps.reference.models.DistanceEdge.objects.create(...)`, read it back via `apps.knowledge.models.DistanceEdge.objects.get(pk=...)` — same physical row, confirmed, then deleted (test artifact, not left in the DB).

### 7. `check_layer_boundaries` — both variants pass clean

- `check_layer_boundaries --json`: `"status": "pass"`, 0 violations (after the fix in §4).
- `check_layer_boundaries --strict-knowledge --json`: `"status": "pass"`, 0 violations — the phase's specific acceptance bar (§12's requirement that the checker shows no knowledge imports outside migration history), verified with the strictest flag this tool has, not just the default check.

## A real, unrelated bug found during this phase's own verification (not fixed, flagged)

While running the `resolve_places()`/`KnowledgeEngine.resolve()` parity comparison, discovered that Phase 6's `import_osm_places` command never set `external_id` (or `place_id`) on the rows it created. `apps/reference/services/provenance.py::publishable()`'s identity check requires `place_id` OR `external_id` to be non-empty for models that have both fields — so all 8,124 OSM-imported rows from Phase 6 fail this check and are invisible to `explore_places()`'s cache-hit path. Practical effect: every `explore()` call for a city whose only data is OSM-sourced still makes a live paid Google Places API call, defeating a real part of Phase 6's purpose. Reproduced live (Bengaluru: 529 OSM hotel rows, but the first `resolve_places('hotel', 'Bengaluru')` call still hit Google, not cache). Flagged as a background-task suggestion (`task_a0b7a620`) with the exact fix (set `external_id=osm_id` on creation, plus a backfill for the 8,124 existing rows) rather than fixed opportunistically — out of this phase's scope, a Phase 6 defect.

## Changed files

New: `docs/plans/evidence/phase-07/backup-confirmation.md`; `docs/plans/phases/phase-07-*`; `backend/apps/reference/services/embeddings.py`, `enrichment.py`; migrations `knowledge/migrations/0005_phase7_knowledge_migration.py`, `reference/migrations/0018_phase7_knowledge_migration.py`, `0019_phase7_placeinsight_localtip_columns.py`, `planner/migrations/0021_phase7_knowledge_migration.py`.
Extended: `backend/apps/reference/models.py` (4 relocated models + 2 new columns), `admin.py`; `backend/apps/planner/models.py` (`PlanInsightDismissal`); `backend/apps/reference/services/places_explore.py` (`resolve_places()`).
Rewritten to shims: `backend/apps/knowledge/models.py`, `admin.py`, `services/embeddings.py`, `services/enrichment.py`, `services/engine.py`.
Caller migrations: `backend/apps/planner/services/distance_service.py`, `plan_generation.py`, `taste.py`, `views.py`; `backend/apps/reference/services/suggestions.py`, `tasks.py`, `views.py`.
`apps.knowledge` stays in `INSTALLED_APPS`; no frontend file was touched (backend-only phase).

## Next action

1. Owner-timed follow-up: confirm parity after a real production beat cycle (embeddings 15min, enrichment 6h — master plan step 8), then remove the shims and the app (steps 9–10).
2. (Optional, flagged separately) Fix the OSM-row `external_id` gap (`task_a0b7a620`).
3. Proceed to Phase 08 (planner integration) once the owner reviews this phase's self-verification.
