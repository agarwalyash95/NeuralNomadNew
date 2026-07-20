# Phase 7 Verification Report — Knowledge application migration

- Date: 2026-07-20, Asia/Calcutta
- Verdict: **PASS WITH CONDITIONS**, self-verified (same as Phases 03–06 — no independent second-agent review this phase).

## PASS

- Real `pg_dump` taken before any schema change; integrity-verified via `pg_restore --list` (931 TOC entries); confirmation doc at `docs/plans/evidence/phase-07/backup-confirmation.md`, including a full pre-migration row-count + HNSW-index baseline.
- `python manage.py check` — clean, at every checkpoint (after each of the 4 applied migrations, and at the end).
- `python manage.py makemigrations --check --dry-run` — "No changes detected," confirming the hand-edited migrations exactly match the final model state.
- `python -m compileall apps config` — clean.
- **Data integrity across the state-move**: row counts on all 5 relocated tables (`DistanceEdge` 830, `EntityEmbedding` 42, `PlaceInsight` 1129, `LocalTip` 87, `PlanInsightDismissal` 24) and the `entity_embedding_hnsw` pgvector index definition were byte-identical before the move, after the `reference`/`planner` state-additions, and after the `knowledge` state-removal — checked at each of the three checkpoints, not just once at the end.
- **Real deletion confirmed**: `pg_tables` was queried directly after applying `knowledge.0005` — exactly the 5 relocated tables remain under the `knowledge_*` prefix; all 8 confirmed-dead tables (`crowdpattern`, `emergencycontact`, `entityinteractionlog`, `event`, `neighbourhood`, `placerelationship`, `safetyadvisory`, `transitoutcomelog`) are genuinely gone.
- `check_layer_boundaries --json` — `"status": "pass"`, 0 violations.
- `check_layer_boundaries --strict-knowledge --json` — `"status": "pass"`, 0 violations. This is Phase 7's specific named acceptance bar (§12: "check_layer_boundaries shows no knowledge imports outside migration history") and was verified with the strictest flag available, not the default-lenient check.
- **Parity — identity checks**: all 4 reference-relocated model classes, `PlanInsightDismissal`, and all 7 re-exported service functions confirmed `is`-identical (not just behaviorally similar) between the old `apps.knowledge` import path and the new one — the strongest form of parity evidence, since there is only one object, referenced by two names.
- **Parity — behavioral check on the one genuine wrapper**: `KnowledgeEngine.resolve()` vs `resolve_places()` compared live against real DB-backed data; after an initial run that (unexpectedly, honestly reported below) triggered a live API call, a clean re-comparison showed identical `source` and an identical 15-row result set (same PKs, same order).
- **Parity — real write/read round-trip**: a `DistanceEdge` row written via the new path and read via the old shim path resolved to the exact same row; the test row was deleted afterward, not left in the DB.
- Full caller migration: a final grep for `apps.knowledge` across the whole backend tree turned up zero real (non-comment, non-docstring, non-migration-history) import statements outside `apps/knowledge/` itself.

## Not completed / explicitly deferred (see implementation report + packet for why)

- Master plan step 8 (confirm parity after one real production beat cycle — embeddings 15min, enrichment 6h) — can't be synchronously verified in one session; an explicit owner-timed follow-up.
- Steps 9–10 (remove the shims, remove `apps.knowledge` itself) — gated on step 8 per the plan's own sequence; `apps.knowledge` remains in `INSTALLED_APPS`.

## Real findings from this phase's own work, noted honestly

- **A real boundary violation was introduced, then fixed, in the same pass**: the first version of the `apps.knowledge.models` shim re-exported `PlanInsightDismissal` from `apps.planner.models`, tripping `check_layer_boundaries`'s D-004 rule. Since no real caller needed that specific re-export (all were already migrated), the shim entry was removed rather than adding a new allowlist exception — verified clean by re-running both boundary checks after the fix.
- **A real, unrelated Phase 6 bug was found during this phase's parity testing**: OSM-imported place rows lack `external_id`, so they fail `publishable()`'s identity check and are invisible to the cache-hit path — meaning every `explore()` call for an OSM-only city still makes a live paid Google Places call. Reproduced live, flagged as `task_a0b7a620`, not fixed (out of Phase 7's scope).

## Not independently re-verified by a second agent

Self-authored verification, same as Phases 03–06. The owner may want an independent pass, particularly on the `SeparateDatabaseAndState` migration mechanics (the single highest-risk technique used this phase — getting `db_table`/state operations wrong could have silently lost data or broken the HNSW index) — though this report's row-count and index-definition checks at every checkpoint are exactly the kind of evidence that would surface such a mistake, and none was found.

## Next checkpoint

Update `docs/agent/CURRENT_STATE.md` and `docs/agent/HANDOFF.md` (done alongside this report) when the owner reviews this phase, when a real beat cycle confirms step 8, or when new evidence changes any claim above.
