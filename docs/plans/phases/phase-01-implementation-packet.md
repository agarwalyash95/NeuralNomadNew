# Phase 01 Implementation Packet

## 1. Objective

Enforce the approved dependency direction `planner -> reference -> common`, centralize provenance construction in common, retain planner compatibility, and add reproducible boundary validation without changing runtime behavior.

Resolved repository root: `D:\Projects\NeuralNomad`.

## 2. Canonical-plan references

- Master plan sections 2 D8, 4.2, and 14 Phase 1.
- Phase 00 verification report: PASS WITH CONDITIONS; Phase 1 continuation authorized.

## 3. Current repository findings

- Branch `main`, commit `a386842821d035337fa539b470418d1da101b06c`, heavily dirty pre-existing tree.
- `make_provenance` and tier constants currently live in planner `block_schema.py`.
- Reference `live_price.py` and `suggestions.py`, plus knowledge `enrichment.py`, import planner solely for provenance.
- `backfill_station_intelligence.py` imports planner distance math even though equivalent reference-owned math exists.
- Two geocoding imports remain transitional: reference place exploration and coordinate backfill call planner geocoding. The plan explicitly keeps geocoding in planner and permits a documented temporary allowlist until later consolidation.

## 4. Approved scope

- Add `apps/common/provenance.py` with byte-compatible tiers and `make_provenance`.
- Re-export those names from planner `block_schema.py`.
- Move reference/knowledge provenance imports to common.
- Remove the station-intelligence reference-to-planner distance import.
- Add `check_layer_boundaries` with a narrow, documented geocoding allowlist and optional strict post-Phase-7 knowledge enforcement.
- Document the sanctioned reference writer and dependency direction.

## 5. Explicit out-of-scope items

- Moving geocoding out of planner.
- Geo utility consolidation (Phase 2).
- Knowledge model/service migration (Phase 7).
- Model/schema/data changes, imports, frontend work, paid APIs, or application removal.

## 6. Permitted files

- `backend/apps/common/provenance.py`
- `backend/apps/planner/services/block_schema.py`
- `backend/apps/planner/services/geocoding.py`
- `backend/apps/reference/services/live_price.py`
- `backend/apps/reference/services/suggestions.py`
- `backend/apps/reference/services/places_explore.py`
- `backend/apps/reference/management/commands/backfill_city_coordinates.py`
- `backend/apps/reference/management/commands/backfill_station_intelligence.py`
- `backend/apps/reference/management/commands/check_layer_boundaries.py`
- `backend/apps/knowledge/services/enrichment.py`
- `docs/agent/DECISIONS.md`
- Phase 01 records/evidence, master-plan Phase 1 checklist, and continuity documents.

## 7. Forbidden files

- Models, migrations, frontend, provider implementations, planner UX/conversation, and unrelated dirty-tree files.

## 8. Models affected

None.

## 9. Services affected

- Shared provenance construction and its compatibility export.
- Reference live price/suggestions provenance imports.
- Knowledge enrichment provenance import.
- Reference station-intelligence distance dependency.
- Geocoding/reference-writer documentation only.

## 10. Commands and tasks affected

- New `python manage.py check_layer_boundaries`.
- Optional future `python manage.py check_layer_boundaries --strict-knowledge` after Phase 7.

## 11. Migrations expected

None.

## 12. Data mutation expected

None.

## 13. Backup and approval gates

No Phase 1 schema or data mutation; no new backup gate. Phase 0 backup confirmation remains recorded.

## 14. Ordered implementation tasks

1. Add common provenance definitions.
2. Convert planner block schema to compatibility re-exports.
3. Migrate provenance consumers in reference/knowledge.
4. Remove station-intelligence's planner distance import.
5. Document transitional geocoding ownership and allowlist.
6. Add boundary command and durable decision.
7. Validate behavior and boundaries.

## 15. Acceptance criteria

- Common and compatibility import paths produce identical outputs.
- Reference/knowledge no longer import planner for provenance or distance.
- Only the two documented geocoding imports remain allowlisted.
- `check_layer_boundaries` passes and reports the allowlist.
- Standard backend validation passes with no migration.
- Behavior remains unchanged.

## 16. Validation commands

- `python manage.py check_layer_boundaries`
- Scripted provenance parity check.
- Import/startup checks for every migrated module.
- `python manage.py check`
- `python manage.py makemigrations --check --dry-run`
- `python manage.py migrate --plan`
- `python -m compileall apps config`
- Reference scenario tests.
- Git status/diff scope review.

## 17. Required measurements

- Forbidden-import count before and after.
- Allowlisted-import count and exact paths.
- Provenance output parity cases.

## 18. Rollback strategy

Revert Phase 1-owned imports/modules/command/decision hunks. Compatibility re-export prevents caller breakage during rollback or mixed deployments.

## 19. Risks

- Hidden import cycles; mitigated by common's dependency-free module and startup checks.
- Boundary false positives/negatives; mitigated by AST parsing and exact module-prefix checks.
- Transitional geocoding direction could become permanent; allowlist output makes the debt visible and Phase 4/7 can remove it.

## 20. Status

PHASE READY FOR IMPLEMENTATION
