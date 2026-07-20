# Agent Handoff

## Latest handoff (reference-foundation Phase 09 complete; Phase 10 blocked)

- Updated: **2026-07-20, Asia/Calcutta**
- Agent/platform: Claude Code (Sonnet 5)
- Requested outcome: owner said "execute remaining phases" — Phase 9 and Phase 10, the last two in the master plan's sequence. Entered plan mode, found Phase 9 genuinely buildable but Phase 10 blocked on all 4 of its own gates (verified fresh, not assumed), got owner approval for a plan that executes Phase 9 for real and documents Phase 10's block honestly instead of forcing gated deletions.
- Status: Phase 9 **Complete, self-verified — PASS WITH CONDITIONS**. Phase 10 **BLOCKED, zero deletions performed**, documented in full.

### Completed — Phase 9

- **`reference_dashboard --json`** — one payload aggregating (via `call_command`, never re-implementing) `audit_reference_data` (10 reports), `benchmark_geo_queries` (PostGIS checkpoint), `evaluate_price_estimators` (holdout metrics), `recompute_completeness` (preview), a new cross-job `PlanGenerationJob.usage` aggregation, and real `EXPLAIN` output for the master plan's 4 named query shapes. Live-verified against the real dev DB — every section returned real, sane data (e.g. `postgis_adoption_checkpoint.overall_p95_ms: 7.438`, real Postgres query plans in the EXPLAIN section).
- **Real boundary violation introduced and fixed within the same pass**: the dashboard's first draft imported `apps.planner.models.PlanGenerationJob` directly — a real D-004 violation, caught by this phase's own `check_layer_boundaries --json` verification step. Fixed by extracting the aggregation into a new planner-owned `generation_usage_summary` command, called via `call_command` — the same pattern the dashboard already used for every other sub-report. Re-verified clean.
- **N+1 audit** (`scripts/phase9_n_plus_1_audit.py`) — no query-counting harness existed anywhere in the repo before this; built using `django.test.utils.CaptureQueriesContext` against the real, already-generated S11 `PlannerTrip.days`. Real findings: `validate_plan` and `_stamp_transit_hints` both show query counts scaling roughly with day count — correctly calibrated as expected/architectural (this session's own Phase 8 geo-sanity check does one City lookup per day) or pre-existing-and-minor, **not** remotely comparable to the `station_selector` O(hub²) severity (~9,000 queries for one call) fixed earlier the same day.
- **Cache-key registry** (`docs/runbooks/cache-key-registry.md`) — catalogs all 6 real existing Redis cache-key namespaces; documents (without implementing) a stale-while-revalidate design for suggestions, genuinely greenfield.
- **Recovery runbook** (`docs/runbooks/recovery-runbook.md`) — consolidates the `pg_dump`/`pg_restore` procedure already used identically 4 times, plus import-batch and embeddings-backlog recovery guidance.
- **Materialized route summaries decision**: the trigger condition ("P4 latency targets missed") was real when this phase started, but a same-day separate fix (`task_ab02ca90` — landed via a background session mid-way through this work) resolved the underlying `route_graph.search()` latency defect first. Decision recorded: not needed on current evidence, not built.

### Completed — Phase 10 (blocked-status documentation, no deletions)

- Verified all 4 of Phase 10's own gates fresh, with direct evidence: `apps.knowledge` still in `INSTALLED_APPS` and all shims present (knowledge-app removal blocked, §12 step 8 never ran); `apps.attractions` still a full live app, still routed (attractions removal blocked, §13's own named blocker unresolved, owner approval never sought); `PLANNER_ROUTE_GRAPH_ENABLED` still `False`, both resolver implementations still coexist (legacy-path removal blocked, though the specific latency defect that made the flip unconsiderable was fixed the same session — see below); `check_layer_boundaries`'s allowlist still has its original 2 entries (empty-allowlist criterion blocked, the anticipated lower-layer geocoding writer never built).
- **Corrected a real false claim in Phase 10's own scope text**: "delete... the 3 haversine wrappers" — verified all three are live, real call paths with real callers today, not dead code as the plan's text assumed.
- Wrote `docs/plans/phases/phase-10-blocked-status.md` — full gate-by-gate evidence and the exact concrete condition that would close each one, so a future session can act the moment any gate clears without re-deriving this investigation.
- **Zero deletions, zero `INSTALLED_APPS` changes, zero migrations.** Did not touch `AGENTS.md`/architecture docs' "final ownership" section — meaningless before ownership is actually final.

### A real, separate, positive development this same session (not this agent's own work)

A background session the owner started earlier (`task_ab02ca90`, Phase 8's flagged `route_graph.search()` latency finding) completed **during** this Phase 9/10 work: root-caused to a `station_selector.py` N+1 (unbounded hub-candidate list driving a nested-loop per-pair query, ~9,000 queries for one Delhi→Kolkata call), fixed with a candidate-hub cap plus two bulk queries. Re-benchmark: p50 8,051ms → 54.76ms (~147x), p95 19,149ms → 77.69ms (~246x), max 48,291ms → 133.05ms (~363x), all 19 existing reference tests still passing. See `docs/plans/phases/phase-08-perf-fix-station-selector-n-plus-1.md`. This was factored into both Phase 9 (materialized-route-summaries decision reversed) and Phase 10 (gate 3's status updated) rather than left stale in either doc. **`PLANNER_ROUTE_GRAPH_ENABLED` remains unchanged (`False`) and explicitly owner-gated** — this fix only removes the latency blocker that made the flip decision unconsiderable.

### Changed files

New: `backend/apps/reference/management/commands/reference_dashboard.py`; `backend/apps/planner/management/commands/generation_usage_summary.py`; `scripts/phase9_n_plus_1_audit.py`; `docs/runbooks/cache-key-registry.md`, `recovery-runbook.md`; `docs/plans/phases/phase-09-*`, `phase-10-blocked-status.md`. No migrations, no frontend file touched. `docs/plans/reference-foundation-and-planner-intelligence-master-plan.md` (Phase 9 + Phase 10 checklists and completion/status notes).

### Verification

- PASS — `python manage.py check`, `makemigrations --check --dry-run`, `python -m compileall apps config`, `check_layer_boundaries --json`: all clean (after the D-004 fix above).
- PASS — `reference_dashboard --json` run for real, every section inspected directly.
- PASS — N+1 audit run for real against real data.
- PASS — Phase 10's two re-runnable acceptance checks (`grep`, `check_layer_boundaries`) run fresh, output quoted directly in the blocked-status doc.
- **Not independently re-verified by a second agent** — self-authored, same as Phases 03-08.

### Remaining work / risks

- Phase 10 remains blocked on all 4 gates — see `docs/plans/phases/phase-10-blocked-status.md` for exactly what closes each one. Gate 3 (legacy resolver) is closest — it now only needs an owner decision + soak period, not further engineering.
- `_stamp_transit_hints`'s query-count scaling (Phase 9's N+1 audit) — real, minor, not investigated further.
- All previously-open follow-ups from Phases 5-8 remain open (OSM `external_id` gap being worked by a background session; IRCTC fare data; ASI monuments; attractions browse-endpoint gap).

### Next action

1. There is no "next phase" — the master plan's 00-10 sequence has been fully worked through (9 complete, 1 blocked). Next action is the owner's: close one of Phase 10's 4 gates, or direct a different priority.
2. (Optional) Decide on the `PLANNER_ROUTE_GRAPH_ENABLED` flip now that its latency blocker is fixed — Gate 3 is the closest of the four to resolvable.

---

## Prior handoff (reference-foundation Phase 08 complete)

- Updated: **2026-07-20, Asia/Calcutta**
- Agent/platform: Claude Code (Sonnet 5)
- Requested outcome: owner said "execute phase 8" against the reference-foundation master plan. Entered plan mode, found two of the master plan's own Phase 8 claims were false/premature before writing any code, got owner approval for a corrected, scoped plan, then executed in full — including a real performance benchmark that surfaced a serious finding.
- Status: **Complete, self-verified — PASS WITH CONDITIONS** (see `docs/plans/phases/phase-08-verification-report.md`). A real, serious performance defect in Phase 4's `route_graph.search()` was found and flagged, not fixed.

### Completed

- **Corrected two false/premature master-plan claims before building anything**: (1) "`_price_transport_blocks`/budget flows on `price_estimator`, done in P5" — verified false by reading the function in full (it calls only `lookup_live_price`); no kill-switch exists anywhere to remove. (2) "journey flow fully on `route_graph.search`" — verified premature; Phase 4's own reports explicitly gate that flip on an owner decision, not an automatic Phase 8 action.
- **Built and ran, for real, Phase 4's own explicitly-deferred prerequisite**: a `route_graph.search()` timing benchmark (new `benchmark_route_graph` management command, modeled on the existing `benchmark_geo_queries.py` Phase 3 convention). **Real, serious finding: median latency ~8 seconds across 13 real city-pair searches, worst case 48 seconds** — confirms, with real numbers, Phase 4's own prior suspicion about `station_selector`'s unbounded query loop. Flagged as background task `task_ab02ca90` with a concrete investigation starting point; not fixed this phase (separate, focused debugging work — `PLANNER_ROUTE_GRAPH_ENABLED` stays `False`, so zero production impact from leaving it unfixed for now).
- **Price-sanity validation check** (`_validate_day_price_sanity`, `apps/planner/services/validation.py`) — scoped to cab/bus/train (the only categories with both a real cost this early in generation and a distance figure available, reused honestly from the day's own `transit_hints` computed data rather than guessed). Compares against `price_estimator`'s real envelope, warning-only outside `[min/1.5, max*1.5]`. Live-verified: a real ₹50,000 cab block against a real ~₹1,900 envelope correctly fired; the same trip at the correct price correctly didn't.
- **Geography-sanity validation check** (`_validate_day_geo_sanity`) — flags a block >200km from its day's real city centroid (same `City.objects.filter(name__iexact=...)` pattern `insight_engine.py` already uses). Live-verified: a block at real Mumbai coordinates tagged to a Jaipur day (~900km away) correctly fired; a block near Jaipur's real centroid correctly didn't.
- **Both surfaced through the existing scorecard `reasons` mechanism** (`scoring.py::_add_warning_reasons`'s `labels` dict) — zero new scorecard field, zero schema change, matching the plan's own explicit constraint. Live-verified the reason strings render correctly.
- **S11 regression re-run for real** (`scripts/phase4_shadow_comparison.py`) — output identical to Phase 4's own recorded evidence, confirming this phase's changes (confined to `validation.py`/`scoring.py`) introduced no drift in the separate, untouched journey-resolution path.
- **Frontend `tsc --noEmit` run for real** (exit 0) to directly verify the plan's "frontend untouched, zero contract drift" claim rather than asserting it.

### Changed files

New: `backend/apps/reference/management/commands/benchmark_route_graph.py`; `docs/plans/phases/phase-08-*`. Extended: `backend/apps/planner/services/validation.py` (2 new rule functions + wiring into `validate_plan()`), `backend/apps/planner/services/scoring.py` (2 new label entries). No migrations this phase (confirmed via `makemigrations --check --dry-run`). No frontend file touched. `docs/plans/reference-foundation-and-planner-intelligence-master-plan.md` (Phase 8 checklist + completion note, correcting the two false/premature claims).

### Verification

- PASS — `python manage.py check`, `makemigrations --check --dry-run`, `python -m compileall apps config`, `check_layer_boundaries --json`: all clean.
- PASS — `cd frontend && npx tsc --noEmit`: exit 0.
- PASS — real `route_graph.search()` benchmark run against the live dev DB (13 real city pairs).
- PASS — both new validation checks live-verified with a genuine positive and negative case each, against real seeded `price_estimator`/`City` data.
- PASS — S11 regression re-run, identical to Phase 4's recorded evidence.
- **Not independently re-verified by a second agent** — self-authored, same as Phases 03-07. Given the real performance finding has real product consequences, the owner may specifically want a second opinion on the benchmark methodology.

### Remaining work / risks

- `route_graph.search()`'s ~8s median latency is unfixed — flagged as `task_ab02ca90`. Blocks any real consideration of the `PLANNER_ROUTE_GRAPH_ENABLED` flip (which stays owner-gated regardless).
- `_price_transport_blocks`'s core pricing logic still doesn't use `price_estimator` — the master plan's "done in P5" claim was false; genuinely wiring this would be new integration work, left for a future, deliberately-scoped pass.
- Phase 7's steps 8-10 (beat-cycle confirmation, shim removal, app removal) remain an owner-timed follow-up.
- The OSM-row `external_id` gap (Phase 6/7 finding, `task_a0b7a620`) — a background session has been working this independently.

### Next action

1. Proceed to Phase 09 (performance & operational hardening) once the owner reviews this phase's self-verification — or request an independent verification pass first, same standing option as every prior phase.
2. (Optional) Prioritize `task_ab02ca90` (route_graph latency) given its real product implications.

---

## Prior handoff (reference-foundation Phase 07 complete)

- Updated: **2026-07-20, Asia/Calcutta**
- Agent/platform: Claude Code (Sonnet 5)
- Requested outcome: owner said "execute phase 7" against the reference-foundation master plan. Entered plan mode, did fresh investigation of `apps.knowledge`'s real current state (found heavier coupling than the master plan's own §12.1 table implied), got owner approval for a plan scoped to steps 1-7 of the mandated 10-step migration sequence, then executed in full.
- Status: **Complete, self-verified — PASS WITH CONDITIONS** (see `docs/plans/phases/phase-07-verification-report.md`). Steps 8-10 (real beat-cycle confirmation, shim removal, app removal) are an explicit owner-timed follow-up. One real, unrelated Phase 6 bug was found and flagged, not fixed.

### Completed

- **Real `pg_dump` backup** taken first (Phase 7 is on the master plan's backup-required list), plus a full pre-migration row-count + HNSW-index-definition baseline for all 13 `apps.knowledge` tables — `docs/plans/evidence/phase-07/backup-confirmation.md`.
- **Model relocation via Django's `SeparateDatabaseAndState` recipe**: `EntityEmbedding`/`DistanceEdge`/`PlaceInsight`/`LocalTip` → `apps.reference`; `PlanInsightDismissal` → `apps.planner` — real tables (`knowledge_entityembedding`, etc.) untouched, `db_table` pinned explicitly on each new model class since none had an override before. **8 confirmed-dead models deleted for real** (`Neighbourhood`/`Event`/`EmergencyContact`/`SafetyAdvisory`/`PlaceRelationship`/`CrowdPattern`/`EntityInteractionLog`/`TransitOutcomeLog`) — re-verified fresh by grep (not trusted from the master plan's own `[VERIFIED]` tag, which only named `Neighbourhood`) *and* confirmed zero rows in every one of them before deletion, a second, data-level confirmation beyond the code-level one.
- **Live-verified data integrity at three separate checkpoints** (before the move, after the reference/planner state-additions, after the knowledge state-removal): all 5 relocated tables' row counts (830/42/1129/87/24) and the `entity_embedding_hnsw` pgvector index definition were byte-identical every time. `pg_tables` was queried directly after the deletion migration — exactly the 5 relocated tables remain under `knowledge_*`, the 8 dead ones are genuinely gone.
- **Service relocation**: `apps/knowledge/services/embeddings.py` (172 lines) and `enrichment.py` (423 lines) moved to `apps/reference/services/` verbatim (only internal model imports repointed); `KnowledgeEngine.resolve()` folded into a new `resolve_places()` in `places_explore.py` — a mechanical fold, since the class was already a thin wrapper over that file's own `explore_places`/`_category_config`.
- **Compat shims** in `apps.knowledge` (re-exports for models/embeddings/enrichment, a delegating `KnowledgeEngine` class) so anything still importing the old paths keeps working.
- **~25 real call sites migrated** — more than the master plan's own consumer list named. Real starting-state investigation found `apps/reference/views.py` alone had 5 separate `KnowledgeEngine.resolve()` call sites, `apps/reference/tasks.py` had 3 Celery tasks that were pure delegating wrappers, and `apps/planner/services/taste.py` had 3 independent entry points into the embeddings module (the plan's text only named one).
- **Real, separate boundary violation found and fixed within the same pass**: the first draft of the `apps.knowledge.models` shim re-exported `PlanInsightDismissal` from `apps.planner.models`, tripping `check_layer_boundaries`'s D-004 rule (reference/knowledge must not import planner). Since every real caller of `PlanInsightDismissal` had already been migrated to import from `apps.planner.models` directly, the shim re-export was simply unnecessary — removed rather than adding a new allowlist exception, which would have weakened the architectural rule instead of respecting it.
- **Parity verified three ways, live**: (1) identity checks — the relocated model classes and all 7 re-exported service functions are confirmed the literal same Python objects between old and new import paths (`is` comparisons all `True`), the strongest possible parity evidence since it's not behavioral similarity but a single shared object; (2) behavioral comparison of the one genuine wrapper, `KnowledgeEngine.resolve()` vs `resolve_places()`, against real DB-backed data — see the real finding below; (3) a real `DistanceEdge` write/read round-trip across both import paths, confirmed same row, test artifact deleted after.
- **`check_layer_boundaries --strict-knowledge --json`** (Phase 7's own specifically named acceptance bar) passes with zero violations, verified after the boundary-violation fix above.
- **Real, unrelated Phase 6 bug found during this phase's own parity testing — flagged, not fixed** (out of scope): while comparing `KnowledgeEngine.resolve()` against `resolve_places()` for Bengaluru hotels (529 real rows imported by Phase 6's OSM importer), the first call unexpectedly returned `source='google_places'` — a live paid API call — instead of `source='cache'`. Root cause: `import_osm_places` (Phase 6) never set `external_id` on the rows it created, and `apps/reference/services/provenance.py::publishable()`'s identity check requires `place_id` OR `external_id` to be non-empty — so all 8,124 OSM-imported rows fail that check and are invisible to the cache-hit path. Practical effect: every `explore()` call for an OSM-only city still makes a live paid Google Places call, undermining part of what Phase 6 was for. Reproduced live, flagged as background task `task_a0b7a620` with the exact fix (set `external_id=osm_id` on creation, backfill the 8,124 existing rows), not fixed opportunistically since it's a Phase 6 defect, not this phase's.

### Changed files

New: `docs/plans/evidence/phase-07/backup-confirmation.md`; `docs/plans/phases/phase-07-*`; `backend/apps/reference/services/embeddings.py`, `enrichment.py`; migrations `knowledge/migrations/0005_phase7_knowledge_migration.py`, `reference/migrations/0018_phase7_knowledge_migration.py`, `0019_phase7_placeinsight_localtip_columns.py`, `planner/migrations/0021_phase7_knowledge_migration.py`. Extended: `backend/apps/reference/models.py` (4 relocated models + 2 new nullable columns on PlaceInsight/LocalTip), `admin.py`; `backend/apps/planner/models.py` (`PlanInsightDismissal`); `backend/apps/reference/services/places_explore.py` (`resolve_places()`). Rewritten to shims: `backend/apps/knowledge/models.py`, `admin.py`, `services/embeddings.py`, `services/enrichment.py`, `services/engine.py`. Caller migrations across `backend/apps/planner/services/distance_service.py`, `plan_generation.py`, `taste.py`, `views.py`, `backend/apps/reference/services/suggestions.py`, `tasks.py`, `views.py`. `docs/plans/reference-foundation-and-planner-intelligence-master-plan.md` (Phase 7 checklist + completion note). `apps.knowledge` stays in `INSTALLED_APPS`; no frontend file was touched (backend-only phase).

### Verification

- PASS — `python manage.py check`, `makemigrations --check --dry-run`, `python -m compileall apps config`: all clean, checked at every migration checkpoint.
- PASS — row-count + HNSW-index-identity checks at 3 separate checkpoints across the migration.
- PASS — real deletion confirmed via a direct `pg_tables` query (not just trusting the migration ran).
- PASS — `check_layer_boundaries --json` and `--strict-knowledge --json`: both `"status": "pass"`, 0 violations.
- PASS — identity parity (11 objects checked, all `is`-identical), behavioral parity (real comparison, real data), write/read round-trip (real row, both paths).
- **Not independently re-verified by a second agent** — self-authored, same as Phases 03-06.

### Remaining work / risks

- Master plan step 8 (confirm parity after a real production Celery beat cycle) hasn't run yet — can't be synchronously verified in one session. Steps 9-10 (remove shims, remove the app) are gated on it.
- The OSM-row `external_id` gap (see above) remains unfixed — a background-task chip is showing for the owner (`task_a0b7a620`).
- `PLANNER_ROUTE_GRAPH_ENABLED` (Phase 4) remains untouched, still `False`.

### Next action

1. Proceed to Phase 08 (planner integration) once the owner reviews this phase's self-verification — or request an independent verification pass first, same standing option as every prior phase.
2. Once a real production beat cycle has run (embeddings 15min, enrichment 6h), confirm parity held, then remove the `apps.knowledge` shims and the app itself (steps 9-10).
3. (Optional) Decide whether to fix the OSM `external_id` gap now or let the spun-off background task handle it.

---

## Prior handoff (reference-foundation Phase 06 complete)

- Updated: **2026-07-20, Asia/Calcutta**
- Agent/platform: Claude Code (Sonnet 5)
- Requested outcome: owner said "execute phase 6" against the reference-foundation master plan. Entered plan mode, scoped Phase 6 (place enrichment) after real research showed two of the plan's literal sub-tasks weren't cleanly buildable as written (see below), got owner approval, then executed the scoped plan in full including a required pre-work `pg_dump` backup.
- Status: **Complete, self-verified — PASS WITH CONDITIONS** (see `docs/plans/phases/phase-06-verification-report.md`). ASI monuments deferral and the attractions-app frontend gap are the two open items.

### Completed

- **Real `pg_dump` backup** taken first — required per the master plan's own global rule for any phase mutating data at scale. Non-interactive via a scratch-file-piped `PGPASSWORD` (never printed to any log), verified via `pg_restore --list` (909 TOC entries). `docs/plans/evidence/phase-06/backup-confirmation.md`.
- **`PlaceCrossIdMixin`** (`wikidata_id`/`osm_id`/`image_license`/`image_attribution`/`image_source`) added to `HotelMaster`/`RestaurantMaster`/`AttractionMaster`/`ActivityMaster` (migration `reference.0017_phase6_place_enrichment`, additive) — confirmed by grep before starting that none of the four tables had any cross-id field.
- **Two real, flagged deviations from the plan's literal wording**, both because real research showed the literal path wasn't cleanly buildable this session:
  1. **`import_osm_places` uses the Overpass API, not a Geofabrik PBF extract.** `osmium`/`pyosmium` confirmed not installed; a full India PBF extract is a multi-GB download — real new operational risk. Overpass is free, no-key, same underlying ODbL data, bounded per-city queries. **Found and fixed a real, undocumented requirement**: the public instance 406s requests with no/generic `User-Agent` header — not mentioned in Overpass's own quickstart docs, found via direct testing.
  2. **`import_asi_monuments` was not built.** Real web research (data.gov.in, asi.nic.in, Wikidata) found no licence-verified name+coordinates+price dataset — data.gov.in's ASI-tagged resources are all small parliamentary-question-derived aggregates; ASI's own site publishes fees per-monument-page only and its master list is a scanned/PDF-only document. Deferred, documented — same discipline as Phase 4's `BusRoute` and Phase 5's train fares.
- **`import_osm_places` live-verified against a real 3-city pilot** (Bengaluru, Delhi, Mumbai — top-3 Indian cities by population): dry-run first, then a real `--apply` run. **8,124 real rows created** (1,177 hotels, 6,694 restaurants, 253 attractions), **22 rows backfilled** with `osm_id`/coordinates, **2,474 elements correctly skipped as ambiguous** (not blindly matched). A spot-checked created row ("The Ambassador," Delhi) directly confirms the honesty design goal: real `osm_id`+coordinates, `price_range=None`, `user_rating=None` — never a fabricated price/rating. Mumbai's first attempt hit a genuine Overpass `504 Gateway Timeout`; the command made zero partial writes for that city and a retry succeeded cleanly with no duplicate-risk side effects.
- **`CategoryVocabularyMap` built smaller than the approved plan's own premise** — investigation while building the seed command found `places_explore.py` stores Google's raw `primaryType` string with **no normalization at all** (contrary to what the plan assumed existed). Seeded instead with the 11 real anchors that do exist in code (3 Google `included_type` filters + 8 OSM tag rows this phase's own importer dispatches on) — smaller but honest, documented rather than forcing a speculative taxonomy.
- **`reconciliation.match_place_by_name_distance`** — new POI-level matching-ladder helper (same matched/ambiguous/unmatched contract as the existing `match_city`), needed since the four master tables have no stored `normalized_name` column.
- **`audit_reference_data` report 10** (stale Google-sourced entity visibility) — confirmed `refresh_stale_entities` (Celery beat, every 3h) is already the only writer of Google-sourced fields, so this closes the plan's "flag stale" requirement with zero new write paths. Live-verified with a real synthetic aged/fresh/never-enriched test trio (created, checked, deleted), then run against the full real post-import dataset: `total_stale=0`.
- **Attractions-app §13 audit** (`docs/plans/phases/phase-06-attractions-audit.md`) — resolved the plan's own flagged `[UNKNOWN today]` item with real evidence: zero planner/booking references to `apps.attractions.Attraction` (independently re-verified by direct grep, not just trusted from earlier research). Named the real remaining retirement blocker precisely: `apps.reference` has no paginated/category-filtered browse-list endpoint equivalent to the old app's `getAttractions`, which a live frontend page (`attractions/[id]/page.tsx`) genuinely depends on. No code, frontend, or data change was made as part of this audit — retirement stays exactly as owner-gated as the plan says.

### Changed files

New: `backend/apps/reference/management/commands/seed_category_vocabulary.py`, `import_osm_places.py`; migration `reference/migrations/0017_phase6_place_enrichment.py`; `docs/plans/evidence/phase-06/backup-confirmation.md`; `docs/plans/phases/phase-06-*`. Extended: `backend/apps/reference/models.py` (`PlaceCrossIdMixin`, `CategoryVocabularyMap`), `admin.py`, `serializers.py`, `services/reconciliation.py` (`match_place_by_name_distance`), `management/commands/audit_reference_data.py` (report 10), `management/commands/seed_source_registry.py` (`osm_overpass` row). `docs/plans/reference-foundation-and-planner-intelligence-master-plan.md` (Phase 6 checklist + completion note). No Codex-fenced file outside this initiative's own new files was touched; no frontend file was touched (backend-only phase, matching Phase 5's own scope note).

### Verification

- PASS — `python manage.py check`, `makemigrations --check --dry-run`, `python -m compileall apps config`, `check_layer_boundaries --json`: all clean.
- PASS — real `pg_dump` + `pg_restore --list` integrity check, before any schema/data change.
- PASS — `import_osm_places --dry-run` then `--apply` against the real dev DB, with before/after row counts and a direct field-level spot-check of a created row's honesty.
- PASS — report 10's synthetic test (stale/fresh/never-enriched rows created, checked, deleted) plus a real full-dataset run.
- PASS — the §13 audit's central grep claim independently re-verified by this session's own direct grep, not just inherited from an earlier research pass.
- **Not independently re-verified by a second agent** — self-authored, same as Phases 03-05.

### Remaining work / risks

- `import_asi_monuments` remains unbuilt — needs either a newly-discovered licence-verified dataset or PDF OCR against the ASI's scanned master list.
- OSM coverage is a 3-city pilot only — scaling to more cities is a mechanical follow-up (the pipeline is proven).
- The attractions-app §13 blocker (missing paginated browse endpoint) needs a frontend/product decision before retirement can proceed further — not a backend decision.
- Restaurant price-unit normalization remains deferred, same reasoning as Phase 5.
- A separate background session (not this one) found the identical unguarded-`icontains` city-match pattern in this phase's own `live_price.py::_resolve_observation_fk` (cab branch) and flagged it as `task_8c7fcda3` — not investigated or touched by this Phase 6 session.
- `PLANNER_ROUTE_GRAPH_ENABLED` (Phase 4) remains untouched, still `False`.

### Next action

1. Proceed to Phase 07 (knowledge application migration) once the owner reviews this phase's self-verification — or request an independent verification pass first, same standing option as every prior phase.
2. (Optional) Scale `import_osm_places` to more cities.
3. (Optional) Decide the attractions-app §13 blocker's resolution path (build the missing endpoint, or retire the old browse page).

---

## Prior handoff (reference-foundation Phase 05 complete)

- Updated: **2026-07-20, Asia/Calcutta**
- Agent/platform: Claude Code (Sonnet 5)
- Requested outcome: owner said "let's start phase 5" against the reference-foundation master plan. Entered plan mode, scoped Phase 5 down from the master plan's full §10 design to an honest, safely-buildable foundation slice (deferring flight-curve/ML/panel-sampling/holiday-feature items that are explicitly volume- or business-gated in the plan's own text), got owner approval, then executed the scoped plan in full.
- Status: **Complete, self-verified — PASS WITH CONDITIONS** (see `docs/plans/phases/phase-05-verification-report.md`). Train/metro fare data and one unrelated pre-existing bug (flagged, not fixed) are the two open items.
- **Evidence backfill (2026-07-20, same day, later session):** the implementation/verification reports above described live-verification that was never saved as evidence files, unlike Phases 00–04's `docs/plans/evidence/phase-0X/` folders. `docs/plans/evidence/phase-05/` now exists — every check re-run fresh against the real dev DB (not copied from this report's prose): `acceptance-matrix.md` plus 6 supporting JSON files (`validation-trio-and-boundaries.json`, `grep-gate.json`, `seed_fare_rules_run.json`, `price_estimator_dispatch.json`, `observation_writer_and_rollup.json`, `regression_checks.json`, `evaluate_price_estimators.json`). One item from the original report could not be re-proven this pass: the `evaluate_price_estimators` "evaluated" branch's synthetic-data test was blocked by the permission classifier as a bulk/fabricated write — code-reviewed instead of re-run; see `evaluate_price_estimators.json` for detail. One **new** bug was found while regenerating this evidence: `live_price.py::_resolve_observation_fk`'s cab branch has the same unguarded `name__icontains` substring-collision pattern the `_resolve_city` bug below already had — flagged as background task `task_8c7fcda3`, not fixed.

### Completed

- **`FareRule` model** (migration `reference.0016_phase5_price_estimation`, additive) — reuses `_RouteFactsMixin`'s provenance enum, per that mixin's own docstring which had explicitly deferred fare data to this phase.
- **`reference/services/price_estimator.py`** (new) — one `estimate(service_type, **params)` envelope ladder for cab/bus/train/hotel/restaurant/food_daily/trip_day_budget, live-verified against real seeded data for all 7 categories, including an exact-number regression check against the pre-existing cab formula.
- **`seed_fare_rules`**: cab seeded with the exact already-shipped ₹300+₹16/km (zero fabrication risk — it's literally today's live number, now DB-sourced instead of a Python constant); bus seeded with a real, dated UPSRTC published rate (national-fallback caveat, confidence deliberately discounted). **Train/metro deliberately left unseeded** — IRCTC's real distance-slab fares are only published as scanned/binary PDFs (a 10MB+ circular that exceeded the fetch tool's size limit, and a smaller 3.5MB "fare table" PDF that fetched but contained no extractable text; no PDF-render tool available either) — nothing was transcribed from memory and presented as a sourced fact.
- **`TravelPriceObservation` writers** — confirmed via grep that this model had **zero writers anywhere in the codebase** before this phase despite already being fully modeled/admin-registered/serialized. Added two: a single hook in `ProviderRegistry.search()` (the funnel point all 3 existing search call sites already pass through), and a paired write alongside `live_price.py`'s existing `TravelPriceHistory` creation. **Live-verified**: a real mock-provider search created 2 real rows; test rows deleted after verification.
- **`rollup_price_summaries`** — live-verified; caught and fixed a real bug in the process (the cab benchmark lookup queried `TravelPriceSummary.destination_city` when cab observations actually resolve to `origin_city` — found by testing against real rolled-up data, not a unit mock, then re-verified correct).
- **`live_price.py` ladder refactor** — a `price_estimator` fallback rung wired for **hotel only** (the one category servable without caller-supplied `distance_km`, which this function's signature never receives and which `reference` cannot compute itself without importing planner's `DistanceService`, forbidden by D-004). Live-verified: a case that used to return `None` now returns a real price-range-band estimate.
- **Planner switchovers**: `transport_compare.py` (cab row — live-verified exact-match regression against the old hardcoded formula), `suggestions.py` (restaurant band), `recommendations.py` (destination-tier/food fallback, `DEST_TIER_RATES`/`PURPOSE_BUDGET_MULTIPLIERS`/`_dest_base_per_day` moved into `price_estimator.py` as the one canonical home).
- **Real, separate bug found and fixed**: `conversation_engine.py::_compute_recommended_budget_inr` referenced `DEST_TIER_RATES`/`PURPOSE_BUDGET_MULTIPLIERS`, neither ever imported into that file — a live `NameError` waiting to fire. Found while tracing the exact logic this phase was already switching over, not gone looking for separately. Fixed by deleting the broken duplicate and delegating to `recommendations.recommended_budget_inr` (the same function, now fixed). Live-verified past the previously-crashing line.
- **`evaluate_price_estimators`** (§10.5 offline holdout backtest) — live-verified with real statistical computation on both real (cold-start, n=2) and temporarily-injected synthetic (30 rows, real MAE/WAPE/pinball/coverage numbers) data; all test rows deleted afterward, keeping only the real `FareRule`/`SourceRegistry` seed data in the dev DB.
- **Real, separate, pre-existing bug found during end-to-end verification — flagged, not fixed** (out of this phase's scope): `transport_compare.py::_resolve_city` (never touched by this phase) does a naive substring city match that resolved `"Agra"` to `"Lagrange, US"` (a literal substring collision), silently producing an absurd fare from a corrupted ~12,915 km distance. The pricing formula itself was confirmed correct via a follow-up regression check against an unambiguous city pair (New Delhi → Jaipur, priced correctly). A background-task chip was raised for the owner (`task_f511c7a3`) rather than fixed opportunistically, per this repo's "record, don't silently fix out-of-scope findings" rule.

### Changed files

New: `backend/apps/reference/services/price_estimator.py`; migration `reference/migrations/0016_phase5_price_estimation.py`; commands `seed_fare_rules.py`, `rollup_price_summaries.py`, `evaluate_price_estimators.py`; `docs/plans/phases/phase-05-*`. Extended: `backend/apps/reference/models.py` (`FareRule`), `admin.py`, `serializers.py`, `services/live_price.py`, `apps/bookings/providers/registry.py`. Rewritten call sites: `apps/planner/services/transport_compare.py`, `apps/reference/services/suggestions.py`, `apps/planner/services/intelligence/recommendations.py`, `apps/planner/services/conversation_engine.py` (bug fix). `docs/plans/reference-foundation-and-planner-intelligence-master-plan.md` (Phase 5 checklist + completion note). No Codex-fenced file outside this initiative's own new files was touched; no frontend file was touched (backend-only phase, matching the plan's own scope note).

### Verification

- PASS — `python manage.py check`, `makemigrations --check --dry-run`, `python -m compileall apps config`, `check_layer_boundaries --json`: all clean.
- PASS — grep gate: all retired literals (`_CAB_BASE_FARE`/`_CAB_RATE_PER_KM`, `_RESTAURANT_PRICE_BAND`, `DEST_TIER_RATES`, the broken `conversation_engine.py` names) confirmed absent from the touched files; the C1 fabricated-literal pattern in `live_price.py` re-confirmed still absent (an earlier phase's fix, re-checked since this phase depends on it); `seed_all_bulk.py`'s demo fixtures confirmed still present and deliberately untouched.
- PASS — every live-verification claim above was run against the real dev Postgres DB (`localhost:5433`), not mocked at the DB layer; all test/synthetic rows created during verification were deleted afterward, confirmed by count.
- **Not independently re-verified by a second agent** — self-authored, same as Phases 03/04.

### Remaining work / risks

- Train/metro `FareRule` rows are unseeded — a future session should OCR the IRCTC fare-slab PDF (URLs in the Phase 5 implementation report) or find an HTML-published equivalent, then re-run `seed_fare_rules`.
- The UPSRTC bus rate's stated effective window has lapsed (2025-02-28) — worth a re-verification pass.
- `_price_transport_blocks` (plan_generation.py) still prices cab/bus/train solely via the pre-existing `lookup_live_price` path, not yet via `price_estimator` — out of this phase's approved scope, a natural small follow-up.
- The `_resolve_city` substring-match bug (see above) was fixed in a separate session (`apps/planner/services/transport_compare.py::_resolve_city` now tries `name__iexact` first) — confirmed by direct code read during the 2026-07-20 evidence backfill. The identical pattern remains unfixed in this phase's own `live_price.py::_resolve_observation_fk` (cab branch) — background-task chip `task_8c7fcda3` showing for the owner.
- `PLANNER_ROUTE_GRAPH_ENABLED` (Phase 4) is untouched by this phase, still `False`.

### Next action

1. Proceed to Phase 06 (place enrichment) once the owner reviews this phase's self-verification — or request an independent verification pass first, same standing option as every prior phase.
2. (Optional) OCR/re-source the IRCTC fare-slab table and re-run `seed_fare_rules`.
3. (Optional) Decide whether to fix `_resolve_city`'s substring-match bug now or let the spun-off background task handle it.

---

## Prior handoff (reference-foundation Phase 04 complete)

- Updated: **2026-07-20, Asia/Calcutta**
- Agent/platform: Claude Code (Sonnet 5)
- Requested outcome: owner said "execute phase 4" against the reference-foundation master plan. Wrote and executed the Phase 4 implementation packet (transport network & route graph V1).
- Status: **Complete, self-verified — PASS WITH CONDITIONS** (see `docs/plans/phases/phase-04-verification-report.md`). One item (report 7's full-scope run) did not finish within the session; everything else is done and live-verified.

### Completed

- **Discovered the real starting state was worse than the plan assumed**: `AirportRoute`, `TrainRoute`, `BusRoute`, `HubTransferLink`, `MetroArea` were all at zero rows — Phase 4 was "populate from scratch," not "enrich sparse data." Documented this explicitly rather than silently absorbing it.
- **Onboarded a new data source with full licence diligence**: OpenFlights (`routes.dat`/`airlines.dat`, ODbL). Its own page states the route data "ceased [updating]... in June 2014" and is "of historical value only" — every imported row is honestly marked `provenance_tier="derived"` with an explicit staleness note, never presented as a live schedule. Added to master plan §5 and `SourceRegistry`.
- Populated real route facts: 3,485 `TrainRoute` rows (datameet `trains.json`, already-approved CC0 source — first use of its train-service data, previously only its station coordinates were used), 1,916 `AirportRoute` + 79 `Airline` rows (OpenFlights, bounded to routes touching an existing Airport and India).
- Added route-model extensions (`distance_km`/`frequency_per_day`/`operating_days`/`service_class_meta`/`provenance_tier`/`confidence`/`freshness_at`/`is_active`) via a shared mixin, plus a new `HubTransferLink` model — migration `0015_phase4_route_graph`, additive only.
- Built `reference/services/route_graph.py` (the V1 search algorithm, §9.2) — reference-owned, provenance-generic, confirmed to never import `apps.planner`.
- Refactored `journey_resolver.py` into a thin adapter: the entire legacy implementation preserved verbatim; a new `PLANNER_ROUTE_GRAPH_ENABLED` flag (default **False**, ships inert) selects which implementation is authoritative; `PLANNER_MULTIMODAL_SHADOW_MODE` (existing flag, previously dead code — `multimodal_enabled`'s own default already made it a no-op) now does real work, running the non-authoritative path for comparison only.
- **Found and fixed a real regression via the shadow-mode check itself** — exactly what shadow mode exists for: the first real-workspace comparison (S11, Kolkata→Gangtok/Pelling) showed the new route_graph path silently losing the train option entirely, because it required a literal scheduled-edge row with no geometric fallback the way the legacy `_nearest_hubs` path has. Fixed by adding a `geo.nearest()`-based hub fallback plus an honest "estimated, no confirmed schedule" option. Re-verified clean against the same real workspace twice more (including after a full data refresh).
- **H7 fixed and live-verified, not just reviewed**: rewrote `backfill_station_intelligence` for incremental upsert (create/update first, delete stale rows only after, one transaction). Then actually killed the running command mid-execution via SIGTERM — twice — and confirmed via immediate row-count checks that zero data was lost either time, directly proving "a mid-run kill leaves prior service areas intact" rather than asserting it.
- **Found and fixed two real, separate performance bugs** while investigating why that same command was taking an excessively long time (root-caused via direct `pg_stat_activity` inspection, not guessed): (1) the airport-service-area loop had no bounding-box pre-filter the way the railway loop already did, causing ~107 million unfiltered `haversine` calls; (2) the new incremental-upsert diff compared floats with exact `!=`, which after a Postgres round-trip spuriously flagged nearly every row as "changed" every run. Both fixed; the command now completes in 25m33s (previously incomplete past 60+ minutes).
- Built the S1–S14 route-acceptance scenario suite: 13 as real pytest tests in `apps/reference/tests/test_route_graph_scenarios.py` (all passing, run twice), S11 via a dedicated `scripts/phase4_shadow_comparison.py` against the real workspace (not a synthetic fixture, since S11 is specifically about not regressing recorded real evidence).
- Added reports 5/6/7 to `audit_reference_data --full-reports`. Reports 5/6 ran clean; **report 7's full 190-pair run did not finish in session** — root-caused to `station_selector`'s own unbounded per-hub-pair query loop (a pre-existing characteristic the plan directs to leave untouched this phase), not a new defect.
- `populate_hub_transfer_links`: adapted the plan's "top-50 metro areas" design to same-city hub pairs (top-50 by population) since `MetroArea`/`MetroAreaCity` are unpopulated — 5 real links created.

### Changed files

New: `backend/apps/reference/services/route_graph.py`; commands `import_datameet_train_routes.py`, `import_openflights_routes.py`, `populate_hub_transfer_links.py`; `backend/apps/reference/tests/test_route_graph_scenarios.py`; `scripts/phase4_shadow_comparison.py`; migration `reference/migrations/0015_phase4_route_graph.py`; `docs/plans/phases/phase-04-implementation-packet.md`, `-implementation-report.md`, `-verification-report.md`; `docs/plans/evidence/phase-04/**`. Rewritten: `backend/apps/reference/management/commands/backfill_station_intelligence.py`. Extended: `backend/apps/reference/models.py`, `admin.py`, `serializers.py`, `management/commands/audit_reference_data.py`, `management/commands/seed_source_registry.py`, `backend/apps/planner/services/journey_resolver.py` (the one planner-side file this initiative is authorized to touch), `backend/config/settings/base.py` (new flag). `docs/plans/reference-foundation-and-planner-intelligence-master-plan.md` (§5 new OpenFlights row, Phase 4 checklist/completion note). No Codex-fenced file outside the declared scope was touched; no frontend file was touched.

### Verification

- PASS — `python manage.py check`, `makemigrations --check --dry-run`, `python -m compileall apps config`, `check_layer_boundaries --json`: all clean.
- PASS — S1–S14 scenario suite: 13/13, run twice (before/after a provenance-field-shape fix).
- PASS — S11 shadow comparison against the real workspace: run three times as fixes landed; final two runs show identical mode-sets and recommended modes between legacy and route_graph paths.
- PASS — H7 live-verified via two real mid-run SIGTERM kills, both confirmed zero data loss by direct row-count check.
- **Not completed** — report 7's full-scope (190-pair) run; root cause identified, not a defect in this phase's own code.
- **Not independently re-verified by a second agent** — self-authored verification, same as Phase 03.

### Next action

1. (Optional) Let report 7's full run complete in an unattended session, or scope `station_selector`'s candidate-hub bound down first.
2. (Optional) A dedicated `route_graph.search()` timing/EXPLAIN pass before Phase 8 integration.
3. (Optional) Investigate the large railway/airport ServiceArea churn (614k→771k railway rows net) if the owner wants to understand which stations' coordinates actually shifted.
4. Proceed to Phase 5 (price benchmarks & estimation foundation) once the owner reviews this phase's self-verification — or request an independent verification pass first. `PLANNER_ROUTE_GRAPH_ENABLED` stays `False` until the owner explicitly decides to flip it.

---

## Prior handoff (reference-foundation Phase 03 complete)

- Updated: **2026-07-19, Asia/Calcutta**
- Agent/platform: Claude Code (Sonnet 5)
- Requested outcome: owner said "check current state, verify and then start with phase 3" against the reference-foundation master plan. Verified Phase 0–2 were genuinely implemented (not just claimed) before proceeding: migration history applied through `0013`, `manage.py check`/`makemigrations --check` clean, and every C1/C2/C3/H1/H2/H5 fix present in the live tree exactly as the Phase 0–2 evidence describes. Then wrote and executed the Phase 3 implementation packet.
- Status: **Complete, self-verified — PASS WITH CONDITIONS** (no separate reviewer agent this phase; see `docs/plans/phases/phase-03-verification-report.md`).

### Completed

- **Resolved a real §18 gate blocker**: GODL-India licence text was `[UNKNOWN]`/fetch-blocked in the master plan. Fetched and read the actual Gazette of India Notification (MeitY, F.No. 8(2)/2013-EG-I, 2017-02-13) via a browser User-Agent (the bare WebFetch tool's default UA gets a 403 from data.gov.in; a plain `requests` call with `User-Agent: Mozilla/5.0` succeeds). Commercial use, redistribution, and adaptation are explicitly permitted (§3) with attribution required (§4a); none of the licence's exemptions (§6) apply to district/tourism data. Full text and analysis in `docs/plans/evidence/phase-03/`; master plan §5/§18 updated in place.
- **Took the Phase 3 `pg_dump` backup directly** (DB reachable at `localhost:5433`, `pg_dump.exe` found locally under `C:\Program Files\PostgreSQL\18\bin`) rather than waiting on a separate owner action — integrity-verified via `pg_restore --list` (788 TOC entries).
- Added 7 new models (`District`, `SourceRegistry`, `SourceRelease`, `ImportBatch`, `StagingRecord`, `ProviderEntityMap`, `DataQualityIssue`) + 9 new nullable fields on City/Airport/RailwayStation, one additive migration (`0014_phase3_source_registry`).
- Built `reconciliation.py` (the §7.3 matching ladder), `import_geonames`, `import_ourairports`, `import_wikidata_crossids`, `merge_reference_entities` (human-gated, not invoked), `recompute_completeness` (first real writer for the long-dormant `data_completeness_score` field), `benchmark_geo_queries` (§8.4 PostGIS checkpoint), and extended `audit_reference_data` with reports 3/4/8.
- **Ran the real imports** (dry-run first, then apply, per the packet): City 15,395→15,475 (+80 only, bounded to national-capital/state-capital/district-admin-seat rows — zero deletions, Airport/RailwayStation unchanged); 4,169 cities now carry a `geonameid`; 9,582 aliases created from GeoNames alternate names; 667 districts from GeoNames ADM2 (no LGD crosswalk yet — deliberately out of scope); 6,827/7,063 airports and 3,000/9,011 railway stations now carry a Wikidata cross-ID; 105 airports matched to OurAirports. PostGIS checkpoint: all 4 adoption triggers false at current scale — recommendation "defer".
- **Found and fixed two real dry-run accounting bugs in `import_geonames`** during its own idempotence check: the preview path skipped the existing-alias and existing-city checks unless `--apply` was set, so a dry-run overstated what a real apply would do. Fixed by always querying existing state for the preview, gating only the write itself on `--apply`.
- **Found (but did not fix) 4 pre-existing duplicate `State` rows** — e.g. "Uttar-Pradesh" (14 cities) vs "Uttar Pradesh" (0 cities), a hyphen-vs-space naming split. Worked around it inside `import_geonames`'s own state-resolution (prefer the duplicate with more attached cities) so this phase's own writes are correct, but did not merge/delete the duplicate `State` rows themselves — out of Phase 3's no-deletion scope. Flagged here and in `CURRENT_STATE.md`; the spaced duplicates have zero dependents, so this is a safe, low-risk cleanup for a future session.
- One operational lesson, no data damage: a concurrent background run of `import_geonames --apply` and `import_wikidata_crossids --apply` appeared to leave two `ImportBatch` rows stuck `status="running"` when checked via a `pgrep`-based wait loop that returned too early; both processes' own finalization code completed correctly moments later (confirmed by final DB state). All writes were idempotent upserts, so nothing was corrupted, but don't trust process-absence alone as a completion signal for a long-running background command — check the actual output/DB state.

### Changed files

`backend/apps/reference/models.py`, `admin.py`, `serializers.py`; new `backend/apps/reference/services/reconciliation.py`; new commands `seed_source_registry.py`, `import_geonames.py`, `import_ourairports.py`, `import_wikidata_crossids.py`, `merge_reference_entities.py`, `recompute_completeness.py`, `benchmark_geo_queries.py`; extended `audit_reference_data.py`; new migration `reference/migrations/0014_phase3_source_registry.py`; `docs/plans/reference-foundation-and-planner-intelligence-master-plan.md` (§5, §18, Phase 3 checklist/completion note); new `docs/plans/phases/phase-03-implementation-packet.md`, `phase-03-implementation-report.md`, `phase-03-verification-report.md`; new `docs/plans/evidence/phase-03/**`. No Codex-fenced file outside `apps/reference/**` was touched; no frontend file was touched.

### Verification

- PASS — `python manage.py check`, `makemigrations --check --dry-run`, `python -m compileall apps config`, `check_layer_boundaries --json`: all clean.
- PASS — idempotence: `import_ourairports --dry-run` after apply shows `updated=0`; `import_geonames --dry-run` after apply and the accounting-bug fix shows `new_cities_created=0`/`districts_created=0` (alias count does not reach exactly 0 by the deliberate per-run cap — documented, not a bug).
- PASS — row-count diff proves zero deletions across City/Airport/RailwayStation.
- **Not independently re-verified by a second agent** — this phase's verification report is self-authored, unlike Phase 00–02's Codex-verified reports. The owner may want a second pass before Phase 4.

### Next action

1. (Optional, before Phase 4) A human preview pass through `merge_reference_entities --keep-pk --merge-pk` against the 6 duplicate-candidate pairs report 3 now surfaces.
2. (Optional) One or two more `import_geonames --apply` passes to continue alias saturation for high-alias-count cities.
3. (Optional, low-risk cleanup) Merge/delete the 4 duplicate `State` rows found this session (the spaced-name duplicates have zero attached cities).
4. Proceed to Phase 4 (transport network & route graph V1) once the owner reviews this phase's self-verification — or request an independent verification pass first.

---

## Prior handoff (reference-foundation Phase 02 complete)

- Updated: **2026-07-19, Asia/Calcutta**
- Agent/platform: Codex
- Requested outcome: execute and close Phase 02 of the approved Reference Foundation and Planner Intelligence master plan.
- Status: **Complete and independently verified — PASS.** Phase 03 was not started.

### Completed

- Added shared reference-owned coordinate validation, sentinel detection, Haversine, latitude-aware bbox, indexed prefilter, and nearest lookup; preserved three compatibility wrappers.
- Added/applied `reference.0013_phase2_geospatial_foundation`: City confidence/publishability, MetroStation coordinates, and eight composite coordinate indexes.
- Added generic publishability and applied it to explore, planner candidate pools, station selection, and compatibility callers.
- Extended the audit with per-state reports 1/2/9 and a full deterministic reason list.
- Added dry-run-first open/linked coordinate repair and made the legacy Google entry point explicit, budgeted, paid-call-gated, and dry-run by default.
- Previewed DataMeet/Wikidata; neither supplied an exact new match for the 314 remaining stations. Applied the exact reviewed network-free city proposal.
- Repaired 8,364 city coordinates, initialized 15,123 publishable cities, left 272 unresolved/sentinel cities non-publishable, and confirmed idempotence.

### Changed files

- Exact code/model/migration/test/script files: `docs/plans/phases/phase-02-implementation-report.md` §3 and the Phase 02 implementation packet §6.
- Migration: `backend/apps/reference/migrations/0013_phase2_geospatial_foundation.py`.
- Evidence: `docs/plans/evidence/phase-02/**`.
- Continuity: master plan, `docs/agent/CURRENT_STATE.md`, and this handoff.

### Verification

- PASS — boundaries, Django check, migration drift/plan, and compileall.
- PASS — independent geo + existing reference scenarios: **6 passed in 63.20s**; final geo regression: **3 passed in 1.35s**.
- PASS — all eight physical indexes present; default EXPLAIN uses `ref_rail_lat_lon_idx`.
- PASS — rail coordinate coverage **96.5154%**; zero publishable placeholder cities; 586 reason-coded exclusions.
- PASS — Phase 0-comparable nearby-hub workload: **2.917 ms p95** against 50 ms target.
- PASS — post-apply dry run proposes zero writes; zero paid API calls and zero row creation/deletion.

### Remaining work / risks

- 314 station rows, 270 centroid cities, and 2 missing-coordinate cities remain non-publishable pending approved Phase 3 sources.
- Country-bbox validation needs the Phase 3 source/bbox registry.
- Indexed bbox fallback median is ~10 ms, but local process p95 varied to ~80 ms; repeat at Phase 3's mandatory PostGIS checkpoint.
- Phase 3 requires a fresh owner dump and source-licence checklist before imports.
- Phase 0's owner Google-key rotation remains outstanding.
- The repository remains heavily dirty; preserve unrelated hunks, including the pre-existing models whitespace warning.

### Next action

1. Obtain/record a fresh Phase 3 database dump and re-verify GeoNames, Wikidata, and OurAirports licence rows before writing the Phase 3 implementation packet or importing data.

---

## Prior handoff (reference-foundation Phases 00–01 complete)

- Updated: **2026-07-19, Asia/Calcutta**
- Agent/platform: Codex
- Requested outcome: record Phase 00 as completed after owner confirmation, then execute and close Phase 01.
- Status: **Complete.** Phase 00 is closed **PASS WITH CONDITIONS** and Phase 01 is closed **PASS**. Phase 02 was not started.

### Completed

- Recorded the owner's backup/restore confirmation and completed the Phase 00 baseline, honesty, provider, resolver/selector, place-id ownership, attraction-photo proxy, and scrub work.
- Applied the Phase 00 scrub to 35 attraction rows after a fully recoverable preview; post-apply checks found zero key-bearing URLs and zero pending scrub changes.
- Added common provenance ownership with planner compatibility re-exports; exact existing three-tier `basis`/`verified_at` output behavior is preserved.
- Migrated provenance consumers, removed the station-intelligence planner-distance dependency, documented the sanctioned geocoding writer, and added an AST boundary checker.
- Reduced six reference/knowledge-to-planner import sites to zero unauthorized sites and exactly two path-and-module allowlisted geocoding imports.
- Added D-004, completed both master-plan checklists, and produced implementation, evidence, and independent verification records for both phases.

### Changed files

- Phase 00 product files are enumerated in `docs/plans/phases/phase-00-implementation-report.md`.
- Phase 01 product files are enumerated in `docs/plans/phases/phase-01-implementation-report.md`.
- Phase reports: `docs/plans/phases/phase-00-*` and `phase-01-*`.
- Evidence: `docs/plans/evidence/phase-00/**` and `phase-01/**`.
- Continuity: this file, `docs/agent/CURRENT_STATE.md`, `docs/agent/DECISIONS.md`, and the master plan.

### Verification

- Phase 00: Django check, migration discovery/plan, compileall, targeted behavior checks, scrub idempotence, and two independent runs of 3 reference scenarios passed.
- Phase 01: boundary command passed with zero violations and two allowlisted imports; exact provenance compatibility passed; Django check, migration discovery/plan, and compileall passed.
- Phase 01 focused regression suite: **3 passed in 75.22s** on the independent run.
- Phase 01 targeted `git diff --check`: passed; raw import search matches the two allowlist entries only.
- No paid API was called during either phase. Phase 01 made no schema or data change.

### Remaining work / risks

- Owner must rotate the previously exposed Google key; this is Phase 00's only open operational condition.
- Phase 00 could not measure direct-route latency because route tables contain no rows, and existing generation usage payloads expose no explicit external-call counters.
- The two geocoding boundary exceptions are temporary debt: later approved consolidation must remove rather than expand them.
- The working tree remains heavily dirty with pre-existing changes. Continue preserving unrelated work and reviewing at hunk level.

### Next action

1. Start Phase 02 by re-auditing its geospatial contracts and writing its implementation packet; do not mutate schema or coordinate data before its migration/data gates are satisfied.

---

## Prior handoff (reference-foundation Phase 00 execution gate — resolved)

- Updated: **2026-07-19, Asia/Calcutta**
- Agent/platform: Codex
- Requested outcome: execute the approved Reference Foundation and Planner Intelligence master plan from Phase 0 through Phase 10, closing and verifying each phase before starting the next.
- Status: **Blocked at Phase 00 before production implementation.** The canonical plan requires an owner-confirmed `pg_dump` and verified restore path before the attraction URL scrub; no confirmation metadata was supplied or found. The execution directive requires a blocked packet and prohibits implementation when a required backup is unconfirmed.

### Completed

- Read the canonical agent context, full handoff, applicable decisions, workflow, attached execution directive, and full master plan.
- Confirmed repository root `D:\Projects\NeuralNomad`, branch `main`, commit `a386842821d035337fa539b470418d1da101b06c`.
- Re-audited all Phase 0 production files and their relevant callers without modifying them; confirmed C1, C2, H1, H2, H5, and C3 remain present in the current tree.
- Wrote the required Phase 00 implementation packet, blocker, implementation report, verification report, and evidence set.
- Preserved every pre-existing production-code change and left all database rows unchanged.

### Changed files

- `docs/plans/phases/phase-00-implementation-packet.md`: scoped Phase 00 and recorded `PHASE BLOCKED`.
- `docs/plans/phases/phase-00-execution-blocker.md`: exact backup/database blockers and safest resolution.
- `docs/plans/phases/phase-00-implementation-report.md`: records no production implementation or data mutation.
- `docs/plans/phases/phase-00-verification-report.md`: reviewer verdict `BLOCKED`.
- `docs/plans/evidence/phase-00/**`: timeout, acceptance, and scope evidence.
- `docs/agent/CURRENT_STATE.md`: active Phase 00 gate.
- `docs/agent/HANDOFF.md`: this handoff.

### Verification

- PASS — repository root/path checks: all required paths exist.
- PASS — backup-confirmation repository search: found requirements only, no confirmation metadata.
- FAIL — `python manage.py audit_reference_data --json`: no output before bounded timeout.
- FAIL — `python manage.py check`: no output before bounded timeout.
- NOT RUN — migration discovery/plan and compileall after the timeout; no production implementation was authorized.
- PASS — safety scope: no paid API, migration, application removal, production-code edit, data mutation, or poisoned-price deletion.

### Remaining work / risks

- Owner must confirm a current database dump with timestamp, location category, and verified restore procedure.
- Database-backed Django commands must complete reproducibly before Phase 00 can pass.
- The working tree remains heavily dirty and overlaps Phase 00 files; resume with hunk-level preservation.
- Google-key rotation remains an owner action after the future successful scrub.
- Phases 01–10 are unstarted.

### Next action

1. Owner supplies backup confirmation metadata and restores database command availability; resume Phase 00 at baseline capture.

---

## Prior handoff (reference-foundation & planner-intelligence master plan — audit + canonical plan document, NO code changes)

- Updated: **2026-07-19, Asia/Calcutta**
- Agent/platform: Claude Code (Fable 5)
- Requested outcome: owner commissioned a full audit-first architecture task (reference DB foundation, multimodal route graph, price estimation, knowledge-app retirement, planner integration) with an explicit "do not implement" constraint, then rejected the first outline-level plan and mandated 12 corrections (real canonical doc now, decision table with approval status, measurable coverage model, source-licence research completed up front, V1–V3 routing roadmap, canonical-vs-derived separation, price-class ladder, realistic place-data limits, PostGIS checkpoint not rejection, separately gated attractions retirement, 14 route acceptance scenarios, explicit non-goals).
- Status: **Done — document written, nothing implemented.** The canonical plan is at `docs/plans/reference-foundation-and-planner-intelligence-master-plan.md` (DRAFT v2, awaiting owner approval). Three parallel deep audits of reference/knowledge/planner/providers/infra/frontend contracts back every claim with file:line evidence; the two most load-bearing claims (live_price fabricated prices stamped "verified" at `reference/services/live_price.py:165–169,198`; Google API key persisted into stored URLs at `attractions/views.py:135,157,213`) were independently re-verified by direct grep. Source licences verified by live web fetch on 2026-07-19 (GeoNames CC-BY, OurAirports public domain, Wikidata CC0, datameet CC0, mledoze ODbL, mwgg MIT, OSM ODbL, Google place-id-only storage policy); GODL-India and OTD-Delhi terms were fetch-blocked and are flagged for manual review before any import.
- Key verdicts (all pending owner approval — see the doc's §2 decision table, D1–D10, including four decisions the owner selected as provisional defaults in a planning Q&A but directed be treated as unapproved): retire `knowledge` via staged migration; no new intelligence app; defer PostGIS behind a measured Phase-3 checkpoint; open-data spine with Google demoted to TTL'd enrichment; attractions app retired behind its own gate with the key-leak fixed in Phase 0; V1 bounded 3-leg route search with schema forward-compatible to timetable routing; rules-first pricing with a 6-class honesty ladder.
- Files changed this session: `docs/plans/reference-foundation-and-planner-intelligence-master-plan.md` (new), this handoff entry, one memory pointer file. **No backend/frontend code, models, migrations, or data were touched.**
- Verification: document-only session — standard code checks not applicable; audit claims spot-verified by grep as noted above; `git status` scope reviewed (only the files listed).
- Next action: **owner reviews and approves/amends the master plan document** (specifically the §2 decision table and §18 approval gate). Upon approval, the exact first task is Phase 0: owner takes a `pg_dump`, then baseline capture (`audit_reference_data --json` + row counts) committed into the doc, then the C1 `live_price` honesty fix. Do not start any schema migration, bulk import, or app removal before that approval.

---

## Prior handoff (hotel_return BlockContractViolation — real, generation-breaking regression fix)

- Updated: **2026-07-19, Asia/Calcutta**
- Agent/platform: Claude Code (Sonnet 5)
- Requested outcome: owner pasted a live Celery-worker ERROR log from real plan generation: `apps.planner.services.block_contract.BlockContractViolation` on every `hotel_return` block ("missing required field: currency_code; non-transport block missing metadata.master_ref{table,id} — ungrounded block"), for a real workspace. Diagnose and fix.
- Status: **Root-caused and fixed. This was a real, generation-breaking regression, not a cosmetic issue** — confirmed it fires on essentially any multi-day trip with a hotel (the exact condition `_append_hotel_return_anchors`, Phase 2g, targets). `manage.py check` clean; fix verified with the real block-builder functions run through the real validator.

### Root cause — a genuine gap between two pieces of prior work that never got cross-checked

- **Phase 0b** (an earlier session) introduced `rest`/`hotel_return` as **deliberately non-bookable** block categories — "no price, provenance, or master ref" by explicit design (`chat_edit_intents._build_rest_block`/`_build_hotel_return_block`, mirrored by the frontend's `createLightBlock`). Both builders correctly never set `currency_code` and leave `metadata={}`.
- **`block_contract.py`** (an even earlier module, predates the rest/hotel_return taxonomy entirely) requires `currency_code` **and** `metadata.master_ref{table,id}` on every block, with zero category exemption.
- These two pieces of code coexisted harmlessly until **Phase 2g** (this multi-phase session's earlier work, `_append_hotel_return_anchors` in `plan_generation.py`) became the first **generation-time** path to actually call `_build_hotel_return_block` and append its output directly into `days` — which then flows straight into `run_pipeline`'s `validate_days(days)` call (`plan_generation.py:560`), hitting `block_contract.validate_block` for the first time on this category. Every one of those calls fails, for every trip the anchor logic fires on.
- **Why this passed Phase 2's own verification:** Phase 2's handoff entry states it verified `_append_hotel_return_anchors`'s output "through the real `validate_plan` and `score_plan` functions" — a **different** validator (`services/validation.py`), not `block_contract.py`. `block_contract.validate_days` is a separate, third check that also runs inside `run_pipeline` and was never exercised by that test. A real gap in that phase's test coverage, now closed by this fix's verification against the actual `block_contract` module.

### Fix (`apps/planner/services/block_contract.py`)

Added a `_NON_BOOKABLE_CATEGORIES = {"rest", "hotel_return"}` set; `validate_block` now skips the `currency_code` requirement and the `master_ref` requirement for blocks in that category set — everything else (the 7 common required fields, and the requirement for every OTHER non-transport category) is unchanged. This is the root-cause fix (teaching the contract module about a taxonomy it predates), not a workaround — it does not fabricate a fake `currency_code`/`master_ref` for blocks that genuinely have neither.

### Verification

- PASS — a real `_build_hotel_return_block()` call (the actual function `_append_hotel_return_anchors` uses) passes `validate_block` cleanly.
- PASS — a real `_build_rest_block()` call also passes (same taxonomy, same fix).
- PASS — `validate_days([...])` on a day containing both block types raises nothing.
- PASS — **regression check**: a genuinely ungrounded *bookable* block (category=`restaurant`, no `currency_code`, no `master_ref`) still correctly raises `BlockContractViolation` with both messages — the fix narrows the exemption to exactly the two non-bookable categories, nothing else.
- PASS — `python manage.py check`: clean.

### Remaining work / risks

- **Not independently re-verified against `validate_plan`/`score_plan`** (Phase 2's original test target) in this pass — no reason to expect a regression there (this fix only touches `block_contract.py`, a module those don't call), but worth the owner keeping in mind if anything else surfaces.
- This is the second real, live-log-driven bug found in immediate succession (after the duplicate-city fix below) from actual generation runs — both were real regressions statically-verified-but-not-live-exercised work can miss. Given `docs/agent/CURRENT_STATE.md` already notes no automated planner test suite exists in this tree, **live/manual verification of a real generation run remains the owner's most valuable next check** on this whole session's work, not just this fix.
- No Codex-owned file was touched.

### Next action

1. Owner restarts/redeploys `celery_worker` to pick up the fix, then retries generation on a trip that previously hit this (or any new multi-day-with-hotel trip) and confirms no `BlockContractViolation` in the logs.

---

## Prior handoff (duplicate-city IntegrityError fix — post north-star-Phase-5 bugfix)

- Updated: **2026-07-19, Asia/Calcutta**
- Agent/platform: Claude Code (Sonnet 5)
- Requested outcome: owner pasted a live Celery-worker log from real plan generation showing `django.db.utils.IntegrityError: duplicate key value violates unique constraint "reference_city_place_id_key"` — diagnose and fix. Session had otherwise been explicitly stopped after Phase 5 (see prior entry below); this is a standalone bug-report response, not a continuation of the roadmap.
- Status: **Root-caused and fixed in `apps/planner` (planner-owned; no Codex-fenced file touched).** Reproduced the exact failure mode with a scoped script, confirmed the fix resolves it, `manage.py check` clean.

### Root cause

`reference_city.place_id` is `unique=True, null=True` (`apps/reference/models.py:37`) — Postgres allows multiple `NULL`s, so two `City` rows created from **different raw name strings for the same real place** (e.g. "New York" vs "New York City" — no `CityAlias` linking them, since nothing auto-creates one) can both start `place_id=None` without conflict. `apps/planner/services/geocoding.py::backfill_city_coordinates` (called from the Phase-3 pool-growth path, `plan_generation.py::_grow_pool_via_places` → `KnowledgeEngine.resolve` → `explore_places.resolve_city` → `resolve_or_create_city`, which **re-resolves the city by raw name a second time**, independently of the city already resolved earlier in the pipeline) set `city.place_id = geocode["place_id"]` and saved with **no check that another `City` row already owned that place_id**. When Google's Geocoding API — correctly — resolved both name-string rows to the identical real `place_id`, whichever row backfilled second crashed on the unique constraint. Caught by `_grow_pool_via_places`'s broad `except Exception` (logged as a warning, pool growth silently falls back to cached rows), which is why the Celery task still reported "succeeded" despite the traceback in the logs — a real defect, not a crash, but real, wasted, recurring log noise and a lost pool-growth opportunity on affected cities every time it fires.

### Fix (`apps/planner/services/geocoding.py`)

- `backfill_city_coordinates`: before assigning a fetched `place_id` to a row that doesn't have one, checks whether another `City` row already owns it (`City.objects.filter(place_id=...).exclude(pk=city.pk).exists()`). If so, leaves this row's `place_id` unset (lat/lng still backfill normally — no uniqueness constraint on those) and logs a warning naming both the collision and the likely-duplicate row, instead of crashing.
- `resolve_or_create_city`'s create-fallback: `resolve_canonical_city` only matches by name/alias text, never by `place_id`, so it can miss a genuine duplicate. Before creating a new row, now checks whether the geocoded `place_id` already belongs to an existing `City` row — if so, returns and backfills that row instead of attempting a second, colliding create. This is a real improvement beyond "don't crash": it converges future resolutions of either name spelling onto the same row instead of leaving two permanently-diverged duplicates.

### Verification

- PASS — `python manage.py check`: clean.
- PASS — scoped reproduction script (temp `City` rows, cleaned up in `finally`): two real rows created from different name strings, both `place_id=None`; first backfill claims a fake place_id normally; **second backfill on the colliding place_id no longer raises** — coordinates still save, `place_id` correctly left unset, warning logged; `resolve_or_create_city` given the second row's name resolves to the already-owned place_id and correctly returns the *first* row instead of attempting a duplicate create.

### Remaining work / risks

- **A second, independent instance of the identical unguarded-write pattern exists in `apps/reference/management/commands/backfill_city_coordinates.py` (Codex-fenced — not touched).** Same bug shape (`city.place_id = geocode["place_id"]; city.save()` with no ownership check), but it's a management command, not on the live Celery/generation path, so it wasn't the source of the reported log — flagging for the owner/Codex per this repo's "record, don't opportunistically fix across the fence" rule.
- **This fix prevents the crash and improves future convergence, but does not retroactively merge already-existing duplicate `City` rows** (e.g. an existing "New York" and "New York City" pair that already diverged before this fix). A one-time dedup pass (find `City` rows with matching normalized names/no alias but resolvable to the same real `place_id`, merge or alias them) would be a separate, larger, Codex-territory cleanup — not attempted here.
- The planner north-star roadmap status is unchanged by this fix — still stopped after Phase 5 per the owner's explicit direction; see the entry immediately below for that stop note (Phases 6–7 deferred pending live pricing/payment infrastructure).

### Next action

1. Owner restarts/redeploys the `celery_worker`/`celery_beat` containers to pick up the code change, then confirms the specific `reference_city_place_id_key` traceback no longer appears in logs during generation.
2. (Optional, Codex-owned) Apply the same ownership-check guard to `apps/reference/management/commands/backfill_city_coordinates.py`, and/or run a one-time duplicate-city dedup pass.

---

## Prior handoff (planner north-star Phase 5 — chat intake completeness)

- Updated: **2026-07-19, Asia/Calcutta**
- Agent/platform: Claude Code (Sonnet 5)
- Requested outcome: continuing "complete all the rest phases"; owner explicitly confirmed continuing through Phase 5 specifically (asked via a scoped check-in after Phases 3–4, given Phases 6–7 involve real payments/group-collaboration territory) against `docs/planner-north-star-audit-and-vision.md`. This session implements Phase 5 (M4 depth, "chat intake completeness") in full: dietary/accessibility now proactively ride the already-mandatory `trip_style` card for full trips, children's ages, an optional per-category budget split, and a free-text escape hatch for interests/purpose — all without adding a single new mandatory ladder step. Stayed entirely inside `apps/planner`/frontend planner chat surfaces.
- Status: **Done and verified.** 6 files changed (no new models, no migration — every new field is metadata-only, matching the existing `dietary`/`accessibility`/`special_notes` precedent). `manage.py check`, `compileall`, `makemigrations --check --dry-run` clean. Frontend `tsc --noEmit` + `eslint` clean (one real lint error caught and fixed — an unescaped apostrophe). Three scoped, real verification scripts confirm the core discipline the roadmap demands: **the ask-count genuinely does not rise**.

### Completed

- **Proactive dietary/accessibility on full trips, riding an existing card.** `INTENT_FULL_TRIP`'s ladder never included `dining`/`fine_tune` — dietary/accessibility previously reached a full-trip traveler only via the optional, collapsed-by-default `fine_tune` review-card expander (the audit's own §A1 finding). Added a `_TRIP_STYLE_FIELDS_BY_INTENT[INTENT_FULL_TRIP]` override (mirroring the existing `INTENT_ACTIVITIES_ONLY` pattern) so `trip_style` — already shown on every full trip — gains two more optional chip rows. **Critically, `_CLUSTER_ESSENTIALS["trip_style"]` was deliberately left as `["budget"]` only** — verified by direct test that the card still auto-skips on budget alone, so the new fields can never become a blocking ask. This is a real, structural difference from "just adding a cluster to the ladder," which the investigation confirmed would have made `fine_tune` mandatory every time (its essentials list is empty, so `cluster_satisfied` can never return true for it — a genuine footgun in the existing code that a naive fix would have hit).
- **Found and fixed a real, separate bug while surfacing accessibility: `FIELD_OPTIONS.accessibility` didn't exist.** `ClusterWidget.tsx`'s multi-select renderer already listed `accessibility` in `MULTI_SELECT_FIELDS`, but `fieldOptions.ts`'s `FIELD_OPTIONS` map had no `accessibility` key — so the field would have silently rendered as an empty button row, no matter how proactively it was surfaced. Added the 5 real options (mirroring the legacy `SpecialRequirementWidget`'s set, minus "Veg meals" — a direct duplicate of the adjacent `dietary` field on the same card that risked contradictory input).
- **Children's ages**, captured alongside the existing children-count stepper (not a separate ask) via a new `_PARTY_FIELDS_BY_INTENT[INTENT_FULL_TRIP]` override (same non-essential, purely-additive pattern as trip_style above). Frontend: age inputs dynamically match the child count and stay in sync as the stepper changes (verified this doesn't desync on increment/decrement). Backend: metadata-only (`children_ages`, no migration), reaches generation as a new top-level `PlanContext.children_ages` field (not buried in `prefs`, matching how `adults`/`children`/`infants` are already first-class) and a real compose-prompt line ("favor age-appropriate activities").
- **An optional per-category budget split**, deliberately scoped as **soft compose-prompt guidance, not a hard per-category cap** — confirmed via investigation that no per-category budget concept or enforcement exists anywhere downstream today (only a single scalar `budget_amount`/`budget_cap`), so building real enforcement would have been a materially larger, unrequested feature. Lives on the `fine_tune` card only (never proactive — the roadmap explicitly frames it as "optional split", unlike dietary/accessibility which it says to surface proactively).
- **A free-text escape hatch for interests/purpose** (`interests_other`/`visit_purpose_other`), reusing the exact existing `special_notes` textarea pattern — genuinely new UI was avoided by extending an already-proven one. At the `PlanContext` anti-leak boundary: `interests_other` is appended (deduped) into the normalized `interests` list rather than living as a disconnected side-channel; `visit_purpose_other`, being more specific than a fixed chip, wins over `visit_purpose` when both are present.
- **Verified — not rebuilt — that `dietary`/`accessibility` already had a complete backend write→generation path.** The investigation confirmed `_apply_optional_field_values` already wrote both correctly and `plan_context.py` already treated both as hard `must_honor` constraints. This phase's real gap was surfacing (ladder placement + the dead `FIELD_OPTIONS` entry), not backend plumbing — most of the "already fully wired end-to-end" pattern from Phase 4's vocabulary-bridge finding repeated here.

### Changed files

- `backend/apps/planner/services/intelligence/clusters.py` — `_TRIP_STYLE_FIELDS_BY_INTENT[INTENT_FULL_TRIP]`, new `_PARTY_FIELDS_BY_INTENT`, `fine_tune`'s fields extended, `cluster_fields()` restructured for the party override.
- `backend/apps/planner/services/conversation_engine.py` — `optional_meta_fields` gains `children_ages`/`budget_split`/`interests_other`/`visit_purpose_other`.
- `backend/apps/planner/services/plan_context.py` — `KNOWN_PREFERENCE_KEYS` gains all 4; new `PlanContext.children_ages` field; `interests_other`/`visit_purpose_other` folded into `interests`/`visit_purpose`; `budget_split` in `prefs`; `prefs_prompt_block` renders both new signals as real prompt lines.
- `frontend/src/features/planner/chat/widgets/fieldOptions.ts` — `accessibility` entry added (the dead-field fix).
- `frontend/src/features/planner/chat/widgets/ClusterWidget.tsx` — children's-ages inputs (synced to the stepper), budget-split inputs, `interests_other`/`visit_purpose_other` via `TEXT_FIELDS`, `buildValues()`/`summarize()` wired for all of it (fixed a would-be `[object Object]` bug in the confirmation summary text for `budget_split` while wiring `summarize()`).

### Verification

- PASS — `python manage.py check`, `python -m compileall apps config`, `makemigrations --check --dry-run`: clean (no schema change at all — every new field is metadata-only).
- PASS — `clusters.py` (7 assertions): `trip_style`/`party`/`fine_tune` field lists include the new fields for `full_trip`; **essentials for all three are byte-identical to before** (`["budget"]`, `["travelers", "origin"]`, `[]`); a non-`full_trip` intent (`hotel_only`) is completely unaffected by the new overrides; `cluster_satisfied` still correctly auto-skips `trip_style` on budget alone (the core "ask-count does not rise" claim, verified, not assumed) and still correctly does NOT skip when budget is genuinely missing (regression check).
- PASS — `PlanContextBuilder.build()` (7 assertions, fake draft with all 4 new metadata keys set): `children_ages` populated; `interests_other` appended into `interests` without dropping the original chips; `visit_purpose_other` correctly wins over the fixed-chip `visit_purpose`; `budget_split` reaches `prefs` unmodified; all 4 keys confirmed present in `KNOWN_PREFERENCE_KEYS` (the anti-leak enforcement list); `prefs_prompt_block` renders real, correct lines for both; an empty-metadata draft produces zero fabricated lines.
- PASS — `ConversationEngine._apply_optional_field_values`: all 4 new fields correctly written into `draft.metadata` from a real structured-value payload.
- PASS — `npx tsc --noEmit`: clean. `npx eslint` on the two touched frontend files: **caught a real error** (unescaped apostrophe in "Children's ages," `react/no-unescaped-entities`), fixed, re-verified clean.
- **Not run:** no live browser verification (standing instruction) and no live chat-turn/LLM extraction test (the AI-extraction Pydantic schema itself — `conversation_engine.py`'s structured-output field list — was not touched, since these new fields are captured via cluster-card UI submission, not free-text LLM extraction; only the already-existing structured-value application path was extended).

### Remaining work / risks

- **`budget_split` is soft guidance only, not enforced.** The compose LLM is told the traveler's preferred split and asked to "weight allocation toward this," but nothing validates the final itinerary's actual category-cost breakdown against it — building real enforcement would need a genuinely new validation/scoring dimension (a materially larger feature than "offer... as an optional split" asked for). If the owner wants real enforcement, that's a follow-up, not a silent scope expansion of this pass.
- **The AI-extraction (free-text chat) path does not yet recognize "my kids are 5 and 8" or "split my budget 40/30/30" as structured input** — these 4 new fields are captured only via their respective cluster-card UI (party/trip_style/fine_tune), the same reach every other `fine_tune`-only field (dietary/accessibility/special_notes) already had before this phase. Extending the Pydantic extraction schema to also catch these conversationally would be a reasonable, separately-scoped follow-up.
- **`interests`/`visit_purpose` chip sets themselves were not widened** (the roadmap's "widen interests/purpose with a free-text escape hatch" was read as "add an escape hatch alongside the existing chips," not "add more chips") — the 7/6 fixed options are unchanged.
- No Codex-owned file was touched.

### Next action — SESSION STOPPED HERE BY EXPLICIT OWNER DIRECTION

Owner reviewed this checkpoint and said: stop now — Phases 6 and 7 are deliberately deferred because there is **no live pricing system and no payment gateway in place yet**; those two phases depend on exactly that infrastructure (Phase 6's flip of live providers + real payment collection is explicitly business-gated in the roadmap; Phase 7's booking/recap work also assumes real priced inventory). Do not start Phase 6 or Phase 7 in a future session without the owner first confirming live pricing/payment infrastructure exists and greenlighting the business decisions that come with it (gateway choice, PCI scope, in-app collection vs. provider redirect).

**Planner north-star roadmap status: Phases 0–5 complete and verified. Phases 6–7 blocked on owner-side infrastructure (live pricing, payment gateway) — not started, not scoped further than the roadmap doc's own high-level bullets.**

1. Owner's next step (whenever ready): stand up a real live-pricing/payment integration, then re-open Phase 6 with a scoped implementation plan (this is a "propose a plan first" phase, not a "build silently" one, given the business/compliance decisions involved).

---

## Prior handoff (planner north-star Phase 4 — compounding personal memory)

- Updated: **2026-07-19, Asia/Calcutta**
- Agent/platform: Claude Code (Sonnet 5)
- Requested outcome: continuing "complete all the rest phases" against `docs/planner-north-star-audit-and-vision.md`. This session implements Phase 4 (M2, "compounding personal memory") in full: a real per-user taste vector with cosine retrieval, ± category-affinity learning extending the 3-kind `EditSignal` vocabulary, deterministic episodic trip memory, verification (not a rebuild — it was already wired) of the profile-vocabulary bridge, and a decisive revive-or-remove call on the two flagged dormant models. Stayed entirely inside `apps/planner`/`apps/knowledge` (additive only)/frontend planner surfaces; never touched Codex's `apps/reference/**`.
- Status: **Done and verified.** 13 files changed (2 new service files, 1 new migration file — not yet applied, see below). `manage.py check`, `python -m compileall apps config`, and `makemigrations --check --dry-run` all clean. Frontend `tsc --noEmit` + `eslint` clean. Seven scoped, real-DB-backed verification scripts (temp users/workspaces/trips, cleaned up in `finally`) — one of them caught and led to a fix for a real, separate bug (see below), not just confirmed the happy path.

### Completed

- **4a — Per-user taste vector + cosine retrieval.** Confirmed via whole-backend grep that no taste/user-embedding concept existed anywhere (`EntityEmbedding` is generic content-only, no user FK). Rather than a new model/migration, the taste vector is stored as an ordinary `TravelerProfile` fact (`taste_vector` key → `{vector: [768 floats], sample_count, embedding_version}`) — fully additive, inherits the same provenance/inspectability/deletion guarantees every other fact has, and is directly readable from `plan_context.profile_facts` (already a flat dict keyed exactly this way) with zero extra DB round-trips mid-generation. New `services/taste.py`: `update_taste_vector` blends a real place's embedding into the vector via a slow (0.85-decay) EMA — positive for kept/booked, negative for an explicit swap-away, and a negative update on a still-empty vector is a no-op (nothing to subtract from yet); `taste_candidates` retrieves real candidates by cosine similarity to the vector. Added `vector_search`/`embedding_for` to `apps/knowledge/services/embeddings.py` (additive siblings to the existing `semantic_search` — extracted, not duplicated, the shared query tail). Wired into `_build_candidate_pool` as a third candidate source (DB rows, M5's semantic-text retrieval, now taste-vector retrieval), tagged `_source_taste=True` only on genuinely taste-sourced rows, deduped by pk against the other two sources. `ranking.score_candidate` gives a bounded +0.08 bonus + a `why` reason ("matches your personal taste profile") to taste-tagged rows. Positive updates fire at `_persist_trip` for every real block in a freshly generated/regenerated plan (reusing the `choice_ids` list that function already computes for `recent_choice_ids` — no second pass over the itinerary). Positive+negative updates fire together at the one structurally unambiguous swap point in the whole app — `plan_mutations.select_item` (a canvas "Change" action): the old occupant gets −1, the new one gets +1.
- **4b — ± category-affinity learning, extending `diff_engine.py`'s 3-kind vocabulary to 4.** New `category_removed` `EditSignal`: trip-wide (not per-day, so a block simply moved to another day is never mistaken for a removal), fires only when ≥2 real, named places of the same category are present in the AI's original proposal but absent anywhere in the current plan — the day-level `day_thinned` signal already existed but is category-blind ("removed 2 restaurants" and "removed 2 attractions" look identical to it). `preference_learner.py` turns repeated occurrences into a running `category_affinity` fact (`{category: ±count}`, not a single-trip flag), read by `ranking.score_candidate` as a small, bounded (±0.12 max) nudge — and, distinctly, surfaced as a real sentence in the compose prompt via `_traveler_context_summary` ("Tends to remove/skip: restaurant — weight these lower"), so the signal shapes both which candidates are picked AND what the compose LLM is told directly.
- **4c — Episodic trip memory**, built to the audit's own literal example ("last Goa trip you loved the north beaches, skipped nightlife"). New `services/episodic_memory.py`: `record_trip_episode` derives real kept-vs-removed place TITLES (never an LLM narrative) from the exact same original/current day snapshot `diff_engine` already diffs, keyed per-destination (`episode.<city>`, most-recent-visit memory — a later trip to the same place overwrites the prior episode, not an unbounded log). Wired into the same best-effort call site as edit-learning (`views.py::_maybe_learn_from_edits`) — one real PATCH-diff, two derived facts. `episode_summary_line` retrieves it into a new generation's compose prompt via `_traveler_context_summary`, now destination-aware (`draft.destination_text` threaded through from its one call site in `_compose_days`).
- **4d — Unify profile vocabularies: verified already substantially done, not re-built.** Investigation found `intelligence/preferences.py::promote_draft_preferences_to_profile` — a documented bridge from raw `draft.metadata` fields to the exact canonical keys `ConstraintEngine`/`_traveler_context_summary` read (accessibility, pace, hotel tier) — is **already wired into `run_pipeline`, before `ConstraintEngine` is built**, contrary to the investigation's initial uncertainty about whether it was actually connected. Confirmed the second half (`tasks._infer_traveler_facts` → `_traveler_context_summary`) also already shares one vocabulary. The one real, remaining gap found: `ConstraintEngine` reads `avoid_red_eye` but **no UI path collects it** — the closest raw field (`time_window`, "Morning"/"Afternoon"/.../"Night") means "traveler prefers this window," not "traveler refuses a red-eye"; mapping non-"Night" selections to `avoid_red_eye=True` would be a fabricated inference feeding a *hard* candidate-exclusion filter, so this was deliberately left alone rather than force a shaky mapping — documented, not silently patched.
- **4e — Revive-or-remove `PlannerIntentFlow`/`PlannerQuestionBank`: a decisive call, not left as another audit finding.** `PlannerQuestionBank` is already correctly, deliberately gated off (`PLANNER_QUESTION_BANK_ENABLED=False` with an on-the-record CH-08 rationale: "success matching almost never fires — off by default until its value is actually measured") — left untouched; re-enabling it without new measurement would just be guessing again. `PlannerIntentFlow` is different: confirmed write-only dead (exhaustive grep, zero readers anywhere), **not even user-scoped** (keyed globally by `(intent, destination_text)`, so it structurally cannot serve Phase 4's "personal" memory goal even if revived), and its own `completion_rate` field is a fabricated heuristic (`+0.1` nudge every reuse, capped — every trip reaching this write path is by definition already "completed," so it can never measure real abandonment). Removed the model, its sole writer (`ConversationService._record_successful_flow`), and the call site — a real simplification (one fewer DB write on every single successful generation, forever, for a table nothing ever read) with zero functional loss.

### Changed files

- `backend/apps/knowledge/services/embeddings.py` — `vector_search`, `embedding_for` (additive; `semantic_search` now calls `vector_search` internally, logic unchanged).
- `backend/apps/planner/services/taste.py` — **new**.
- `backend/apps/planner/services/episodic_memory.py` — **new**.
- `backend/apps/planner/services/diff_engine.py` — `category_removed` signal + `_diff_category_removals`.
- `backend/apps/planner/services/preference_learner.py` — `category_affinity` handling.
- `backend/apps/planner/services/ranking.py` — `_source_taste` bonus, `category_affinity` nudge.
- `backend/apps/planner/services/plan_generation.py` — `_build_candidate_pool` taste-vector merge; positive taste updates in `_persist_trip`; `_traveler_context_summary` takes `destination_text`, adds category-affinity + episode lines, excludes `taste_vector`/`episode.*` from its generic fallback dump; `_compose_days` passes `draft.destination_text` through.
- `backend/apps/planner/services/plan_mutations.py` — `select_item` fires the swap-based taste update (found and fixed a real bug while verifying this: `current`/`copied_current` are the *same* dict object via a shared `find_block` call, so reading `current`'s metadata *after* the in-place `.clear()/.update()` swap silently returned the NEW block's ref, not the old one — fixed by capturing `old_master_ref` before the mutation).
- `backend/apps/planner/views.py` — `_maybe_learn_from_edits` also records the episodic-memory fact.
- `backend/apps/planner/models.py` — `PlannerIntentFlow` model removed.
- `backend/apps/planner/services/conversation_service.py` — `_record_successful_flow` removed, import cleaned up.
- `backend/apps/planner/migrations/0020_remove_planner_intent_flow.py` — **new, generated but NOT applied** (see Remaining work).

### Verification

- PASS — `python manage.py check`, `python -m compileall apps config`, `makemigrations --check --dry-run`: all clean after every backend edit.
- PASS — taste vector (9 assertions, real DB rows + mocked embeddings): no-embedding/unknown-category/nonexistent-pk all silently no-op without raising; first positive sample produces a correctly normalized unit vector; a negative update on a real second row measurably blends away from it; a negative update on an empty vector is a no-op; `taste_vector_from_facts` matches `get_taste_vector`; `taste_candidates` never calls `vector_search` with no vector, and correctly retrieves+city-filters when one exists.
- PASS — `_build_candidate_pool` integration: a taste-sourced row is merged in and tagged `_source_taste=True`; rows from other sources are never mis-tagged.
- PASS — `diff_engine` (3 assertions): `category_removed` fires correctly for 2 genuinely-removed same-category places and not for a kept one; a single removal stays below the ≥2 threshold; a block moved to another day (still present trip-wide) is never mistaken for a removal.
- PASS — `preference_learner`/`episodic_memory` against a real `TravelerProfile` (7 assertions): first `category_removed` signal writes `category_affinity={"restaurant": -1}`; a second occurrence nudges it to `-2` (running count, not overwritten); `record_trip_episode` writes real kept/removed titles; `episode_summary_line` produces a grounded sentence naming only real titles; a different, unvisited destination correctly gets no episode line.
- PASS — `ranking.score_candidate` (5 assertions): `_source_taste` adds a real positive bonus + reason; negative `category_affinity` lowers score + adds a reason; positive `category_affinity` raises score; affinity for a different category has zero effect; the nudge is bounded, not unbounded.
- PASS — `_traveler_context_summary` against a real profile with all three new fact kinds set: Goa-destination summary includes the category-affinity line and the real episode names, and — checked explicitly — the raw 768-float `taste_vector` never leaks into the generated text; a different destination gets no episode line but still gets category-affinity.
- PASS — `_maybe_learn_from_edits` end-to-end against a real `PlannerWorkspace`/`PlannerTrip`/`PlannerTripOriginal` (not mocked): one call writes both `episode.goa` and `category_affinity` correctly from a single real day-diff.
- PASS — `select_item` swap end-to-end against a real workspace/trip: **first attempt failed** (0 calls recorded) — traced to a genuine pre-existing aliasing bug in `select_item` itself (`current`/`copied_current` are the same dict object), fixed by capturing the old `master_ref` before the in-place mutation, then re-verified passing (negative update for the old place, positive for the new one, both with the correct real pks).
- PASS — `npx tsc --noEmit` and `npx eslint` on the one touched frontend file (`GenericNode.tsx`): both clean.
- **Not run:** no live browser verification (standing instruction) and no live Gemini/embedding API call (all AI-adjacent paths — `embedding_for`, `vector_search` — were exercised via mocking at the embeddings-module boundary, consistent with Phase 3's approach; the underlying `embed_text`/Gemini call itself is untouched code, not re-verified here).

### Remaining work / risks

- **`python manage.py migrate` has NOT been run.** The `0020_remove_planner_intent_flow` migration file exists and is correct (`makemigrations --check --dry-run` confirms it fully captures the model change) but dropping a database table is a destructive operation this agent does not perform without explicit direction — **the owner needs to run `python manage.py migrate` themselves** to actually drop the `planner_intent_flow` table. Until then the table exists but is fully orphaned (no model class references it), which is safe to leave indefinitely if preferred.
- **The taste vector's real impact today is bounded by the same embeddings-backlog sparsity Phase 3 already flagged** — `update_taste_vector`/`taste_candidates` are real and correctly wired, but a place with no `EntityEmbedding` row yet contributes/retrieves nothing (by design, never fabricated). Improves automatically as `compute_embeddings_backlog` (existing, untouched) covers more of the reference tables.
- **`avoid_red_eye` remains honestly unreachable** — no UI collects a real "avoid overnight flights" signal today; the closest existing field (`time_window`) would require a fabricated inference to bridge, which was deliberately not done. A future phase could add a real, explicit toggle to `TransportPreferencesWidget.tsx` if this is judged worth prioritizing.
- **`PlannerQuestionBank` deliberately left untouched** — already correctly gated with a clear, on-the-record rationale (CH-08); re-enabling it would need real usage measurement this pass didn't do, not another guess.
- No Codex-owned file was touched. `apps/knowledge/services/embeddings.py` was extended (additive functions only) — not a Codex-fenced path, and its existing `semantic_search`/`upsert_embedding`/`compute_embeddings_backlog` behavior is unchanged (confirmed by Phase 3's and this phase's own passing tests of `semantic_search`-adjacent behavior).

### Next action

1. Owner runs `python manage.py migrate` to apply the `PlannerIntentFlow` table drop (optional — safe to defer).
2. Owner (or the agent, per "complete all the rest phases") proceeds to Phase 5 — chat intake completeness (M4 depth): dietary/accessibility asked proactively on full trips (not just food-only intent), per-category budget split, children's ages, richer interests/purpose — folded into the existing lean ladder via auto-skip/`fine_tune`, without raising the ask-count.

---

## Prior handoff (planner north-star Phase 3 — expert reasoning shown)

- Updated: **2026-07-19, Asia/Calcutta**
- Agent/platform: Claude Code (Sonnet 5)
- Requested outcome: owner said "continue where you left off ... and complete all the rest phases" against `docs/planner-north-star-audit-and-vision.md`. This session implements Phase 3 (M5, "expert reasoning shown") in full: trade-off reasoning shown during planning (not just the reactive Explain button), real RAG/semantic retrieval wired into the candidate pool, and an LLM critic pass extending the deterministic self-critique loop. Stayed entirely inside `apps/planner`/`apps/knowledge` (read-only)/frontend planner surfaces; never touched Codex's `apps/reference/**` (confirmed — see Changed files).
- Status: **Done and verified.** 8 files changed. Backend `manage.py check` and `makemigrations --check --dry-run` clean (no new migration needed — purely additive JSONField keys). Frontend `tsc --noEmit` and a targeted `eslint` pass over all 8 touched files both clean, run isolated/sequentially. Five scoped verification scripts (not a restored test suite — none exists in this tree) exercise every new function against real Django model classes and, for the two LLM-backed paths, a mocked Gemini client — no fabricated "it works," each assertion checks real return values.

### Completed

- **Trade-offs shown inline, not just reactively (M5 "considered A, chose B because...").** `_aiInsights.candidates` (the up-to-2 runner-up alternatives every generated block already carried) was fully plumbed end-to-end but never rendered anywhere in the UI — confirmed by grep before touching anything. Rather than adding a new per-block LLM call (cost-unbounded, and a second source of possible hallucination the codebase's grounded-truth philosophy argues against), added `_tradeoff_sentence()` (`plan_generation.py`): a deterministic sentence built entirely from data already computed and stamped onto every candidate row by the existing `PreferenceScorer` (`_pref_reasons` — no re-scoring, no new AI call). Reordered `_candidate_block` so `why_reasons`/`why` are computed before the alternatives loop, then attached a `tradeoff` string to each alternative. Rendered on the card itself in `GenericNode.tsx` (a new small row under the AI-tip block, `Scale` icon) — visible the instant the plan renders, not gated behind the Explain click, satisfying the roadmap's explicit "not just on the reactive Explain button" acceptance bar.
- **RAG wired into the candidate pool (M5 "generation logs a semantic-retrieval step").** `knowledge/services/embeddings.py::semantic_search` (pgvector cosine similarity over `EntityEmbedding`) was confirmed dormant — referenced only by its own definition and one backend-only, frontend-unconsumed reference-search endpoint. Added `_semantic_query_text()` (builds a real, non-fabricated intent string only from actual `PlanContext` signal — interests, visit purpose, cuisine/dietary/ambiance for restaurants, property type/amenities for hotels, pace for attractions/activities; returns `None` — and skips the call entirely — when there's no real signal to search on) and `_semantic_candidates()` (calls `semantic_search`, filters hits to the same city being built, degrades to `[]` on any failure — embedding-API error, pgvector unavailable, no rows yet — and logs a `decision_trace` `semantic_retrieval` event with the query and hit count). Merged into `_build_candidate_pool`'s existing per-category loop, deduped by real primary key against the reference-DB-sourced rows, then scored/ranked by the same `PreferenceScorer` as before — semantic retrieval is a second candidate *source*, never a bypass of ranking, provenance, or rejection filtering (verified: a semantic hit from a rejected/wrong city is filtered exactly like a DB-sourced one).
- **A real LLM critic pass (M5), extending — not replacing — the deterministic self-critique loop.** The existing refinement loop (re-compose once if the 9-dimension `score_plan` scorecard falls below threshold) was already correct and untouched. Added `_run_critic_review()`: gated on the plan *still* being `flagged_for_review` after that deterministic refinement attempt, and on the same per-run `usage_budget.claim_ai()` ceiling every other Gemini call in the pipeline respects. Sends the actual finalized day-by-day itinerary (not the scorer's terse reason strings alone) to Gemini with a structured `CriticReview` schema (`summary` + `findings[{issue, day_number, severity}]`), explicitly instructed to reference only real days/blocks. **Deliberately does NOT trigger a second re-compose** — auto-applying a second AI opinion on top of an already-refined plan is a materially different, higher-risk feature (this is the roadmap's own separate "constraint-solver optimization" item, explicitly left out — see Remaining work). Result is attached to `itinerary["scorecard"]["critic_review"]` (additive JSONField key, no migration), passed through by `PlannerTripSerializer`, surfaced in the frontend's `qualityReview.criticReview` and rendered in the existing `CheckoutCanvas.tsx` quality banner (distinct sub-section, not conflated with the deterministic gaps list above it).

### Changed files

- `backend/apps/planner/services/plan_generation.py` — `_semantic_query_text`, `_semantic_candidates` (RAG); `_build_candidate_pool` now merges+dedups semantic hits, takes `usage_budget`; `_tradeoff_sentence`, reordered `_candidate_block` (inline trade-offs); `_run_critic_review`, wired after the scorecard is computed in `run_pipeline`.
- `backend/apps/planner/serializers.py` — `PlannerTripSerializer.to_representation` now passes through `scorecard.critic_review`.
- `frontend/src/services/planner.types.ts` — `TripActivity.why`, `_aiInsights.candidates[].tradeoff`, `PlannerTrip.scorecard.critic_review`.
- `frontend/src/features/planner/workspace/plan-canvas/types.ts` — `ItineraryItem.why`, `TripViewModel.qualityReview.criticReview`.
- `frontend/src/features/planner/workspace/services/planTransform.ts` — `activityToItem` now maps `why`; `qualityReview.criticReview`.
- `frontend/src/features/planner/workspace/services/blockMerge.ts` — `toRawActivity` now explicitly carries `why` from the new occupant (found and fixed a real, separate bug along the way: `why` was missing from the explicit place-specific field list, so swapping a block's occupant would silently keep showing the OLD place's reasoning text — same class of bug the file's own docstring warns about for `ai_tip`/`rating`/etc., just not yet applied to `why` since `why` didn't exist as a typed field before this phase).
- `frontend/src/features/planner/workspace/plan-canvas/nodes/GenericNode.tsx` — inline trade-off row.
- `frontend/src/features/planner/workspace/helper-canvases/booking/canvases/CheckoutCanvas.tsx` — critic-review sub-section in the existing quality banner.

### Verification

- PASS — `python manage.py check` and `makemigrations --check --dry-run`: both clean after all backend edits.
- PASS — `_tradeoff_sentence`: differing-top-reason case, same-top-reason case (no fabricated contrast), and no-data case all produce grounded, correct sentences (scoped script, not the deleted test suite).
- PASS — `_semantic_query_text`: returns `None` (no call made) with zero real signal; returns a query string containing every real signal field (city, interests, purpose, cuisine, dietary) with real signal, nothing invented.
- PASS — `_candidate_block`: alternative dicts carry a real `tradeoff` string referencing the correct alternative's name; `why` unaffected by the reorder.
- PASS — `_semantic_candidates`: a mocked `semantic_search` hit is returned and logged to `decision_trace`; a hit from a different city is filtered out; an induced exception degrades to `[]` without raising; a `PlanContext` with no real signal never calls `semantic_search` at all (assert `mock.called is False`).
- PASS — `_build_candidate_pool` integration: a genuinely new semantic hit is merged into the pool exactly once; a semantic hit that duplicates an existing DB-sourced row by primary key is not double-counted.
- PASS — `_run_critic_review`: a mocked structured Gemini response parses into the exact expected `{summary, findings}` shape; an induced client exception returns `None` without raising; an empty `response.parsed` returns `None` (never a fabricated empty review).
- PASS — `npx tsc --noEmit`: clean, run in isolation (hit and recovered from a transient `tsconfig.tsbuildinfo` write-lock error on the first attempt — same known Windows/incremental-cache issue Phase 0's handoff already documented; the second, isolated run was clean).
- PASS — `npx eslint` over all 8 touched frontend files: clean.
- **Not run:** no live browser verification (per standing instruction — memory: never start/stop dev servers via preview tools) and no live Gemini call (no test suite/live-provider harness exists in this tree; the two AI-backed functions were verified via mocked-client unit checks instead, consistent with how `explain_recommendation`'s own tests — now deleted — would have worked).

### Remaining work / risks

- **Deliberately not built:** "constraint-solver optimization beyond today's fixed linear scalarization" (the second half of the roadmap's Phase 3 critic-pass line item). The critic pass shows the user a second, independent AI opinion but never automatically re-optimizes against it — auto-applying a critic's suggestions would need its own re-compose-and-validate cycle, its own budget/cost model, and real evidence it doesn't thrash a plan the user already reviewed. Left for a dedicated, separately-scoped follow-up per the same judgment-call pattern Phase 2's 2f/2g used.
- The semantic retrieval path is real and wired, but its practical impact is currently bounded by how few `EntityEmbedding` rows exist in this DB today (the audit's own finding — the pgvector stack was never fed by generation before this phase). It will surface more real candidates as `compute_embeddings_backlog` (existing, untouched) is run against more of the reference tables; this phase does not itself backfill embeddings, since that's a data/ops decision, not a generation-pipeline one.
- The critic pass adds one more possible Gemini call per generation run (only when still-flagged after refinement, and only within the existing `max_ai_calls` ceiling) — no new cost-control mechanism was added beyond reusing the existing budget object, since it already exists exactly to bound this.
- No Codex-owned file was touched. Diff scope confirmed via this session's own edit list above: exactly `apps/planner/services/plan_generation.py`, `apps/planner/serializers.py`, and 6 frontend planner files. `apps/knowledge/services/embeddings.py` was read but not modified — `semantic_search` was called as-is, its existing contract respected.

### Next action

1. Owner (or the agent, per "complete all the rest phases") proceeds to Phase 4 — compounding memory (M2): per-user taste vector + cosine retrieval, ± affinity learning from edits/acceptances/rejections, episodic trip memory, unify the two profile vocabularies, revive-or-remove `PlannerIntentFlow`/`QuestionBank`.

---

## Prior handoff (planner north-star Phase 2 — living plan on the page)

- Updated: **2026-07-19, Asia/Calcutta**
- Agent/platform: Claude Code (Sonnet 5)
- Requested outcome: owner said "execute all phases now" against `docs/planner-north-star-audit-and-vision.md`. Implemented Phase 2 in full (all 7 sub-items, a–g), with real verification at each step. Stayed entirely inside `apps/planner`/frontend planner surfaces; never touched Codex/Antigravity's concurrent `apps/reference` work (confirmed disjoint diff below).
- Status: **Done and verified.** 17 files changed. Backend `manage.py check` clean throughout (multiple isolated runs). Frontend `tsc --noEmit` + `eslint` clean in a final isolated, sequential pass (4 warnings, all pre-existing and confirmed via diff to be outside every touched hunk). One real integration test runs the new generation-time logic through the actual `validate_plan`/`score_plan` pipeline, not just an isolated unit test.

### Completed (2a–2g)

- **2a — Pacing warnings now visible on the day.** `validation.py::_validate_day_travel_time` computed a real haversine-based "too tight to travel between these two blocks" warning at generation/edit time, but it was discarded every time — never persisted, never rendered. Rather than wiring it through the less-contextual `trip.metadata.validation_gaps` path, added it as a 7th rule (`TightTravelTimeWarning`) to the existing, already-live, already-per-day-rendered `PlanInsightEngine` (`insight_engine.py`) — the correct existing extension point, reusing the exact same threshold math so the two can never drift. Renders automatically via `TripIntelligenceTimeline.tsx`'s fully generic insight consumer — zero frontend changes needed. Verified the new rule agrees exactly with `validation.py`'s own computation on identical real-coordinate data.
- **2b — Wired all 3 dead compare trays.** Confirmed the real scope of the gap by tracing it, not guessing: `HotelCompareTray`/`SightCompareTray`/`RestaurantCompareTray` were fully built but never mounted anywhere, AND pinning was completely unreachable — the 3 detail panels destructured `isCompared`/`onCompareToggle` with underscore aliases specifically to satisfy the unused-var lint rule (nothing rendered them), and the 4 list cards (Hotel/Attraction/Activity/Restaurant) had no pin control at all. Fixed all three layers for all 4 place types: a real pin-toggle button on every list card, a real rendered toggle on every detail panel (top-right, symmetric with the existing back button), and the tray itself mounted as a sticky footer in each canvas. 11 files.
- **2c — Region-gated the forex domestic advisory.** `ForexCanvas.tsx`'s ATM/cash advisory was hardcoded to Manali/Kasol/Tosh/Kheerganga/Bhuntar and shown for ANY domestic destination — a Goa or Jaipur trip saw fabricated Himachal ATM guidance. Mirrored the exact region-gating pattern `VisaCanvas.tsx` already correctly applies to its Rohtang/altitude cards. Also de-regionalized the always-shown generic cash estimate's labels ("paragliding, trekking" → "Activities & experiences"), which were specific enough to mislead a non-mountain trip even though the estimate itself is universal.
- **2d — Enriched explore list cards from 1 fact chip to up to 2.** Attraction/Activity/Restaurant list cards computed a SINGLE fact via an if/else priority chain, forcing a detail-panel drill-down to see anything else. Found and fixed a real, separate bug along the way: the old attraction logic only ever showed "Free entry" — a real, priced entry fee ("₹200") was silently dropped. Restaurant cards also gained a real open-now/closed-now signal, reusing the exact `isOpenNow` helper the detail panel already computed (never a second copy).
- **2e — Hotel nightly price: built the safe version, documented the real blocker.** Confirmed via code trace: `lookup_live_price` (`apps/reference/services/live_price.py`, Codex-owned) *does* support a hotel-specific lookup, but `TravelPriceHistory` has only ~4 real hotel rows in the whole database today and live providers are off by default — so most checks will honestly come back empty regardless of what the planner side does. **Also found, but deliberately did NOT fix (out of scope, Codex-owned file):** `lookup_live_price` always stamps a live-provider hit as `provenance_tier="verified"` without checking whether `LIVE_PROVIDERS_ENABLED` was actually on — a real provenance-honesty question flagged below for the owner/Codex, not silently patched by me. Built the safe, buildable half: a new read-only `GET /planner/price-lookup/` endpoint (thin wrapper, does not touch or duplicate `live_price.py`'s logic) plus a manual, user-initiated "Check nightly rate" action in the hotel detail panel — deliberately NOT an automatic per-card fetch, which would be an unbounded number of backend calls with no real user intent behind most of them. As real price data grows (Codex's reference-data work), this lights up naturally.
- **2f — Investigated, did not build a separate activity canvas.** Confirmed `ActivityDetailPanel`/`ActivitySuggestionCard`/`activityRecommendationEngine` are already fully distinct components from their Attraction counterparts (difficulty meter, duration, booking-required — all activity-specific), already correctly auto-select the Activities tab when an activity node is clicked. Only the outer canvas shell is shared, which is a defensible, common UX pattern, not a bug. Building a fully separate canvas would have mostly duplicated already-working code for no clear benefit — documented judgment call, not a build.
- **2g — Rest/return-to-hotel emitted at generation time (hotel-return half).** Added `_append_hotel_return_anchors`, a deterministic, Python-only post-composition pass in `plan_generation.py`, called from inside `_compose_days` (so it runs identically on both the initial compose and any refinement re-compose) — appends an evening "Back to `<hotel>`" anchor to any day that has scheduled activities, is in a city with a real active hotel stay, and isn't a departure/transit day. Reuses the *exact same* block-construction helper (`chat_edit_intents._build_hotel_return_block`) the Phase 1 chat proposer already uses, so a generated anchor and a chat-added one are byte-identical in shape. **Deliberately NOT built:** automatic rest-block insertion or LLM-taught meal-spacing — see "Remaining work" below for why.

### Changed files

- `backend/apps/planner/services/insight_engine.py` — new `TightTravelTimeWarning` rule (2a).
- `backend/apps/planner/services/plan_generation.py` — new `_append_hotel_return_anchors`, called from `_compose_days` (2g).
- `backend/apps/planner/views.py`, `backend/apps/planner/urls.py` — new `price_lookup` endpoint (2e).
- `frontend/.../booking/canvases/HotelCanvas.tsx`, `hotel/HotelCard.tsx`, `hotel/HotelDetailSections.tsx` — compare tray (2b) + nightly-rate check (2e).
- `frontend/.../explore/{Attraction,Activity,Restaurant}{SuggestionCard,DetailPanel}.tsx`, `AttractionsCanvas.tsx`, `RestaurantsCanvas.tsx` — compare trays (2b) + enriched fact chips (2d).
- `frontend/.../travel-prep/forex/ForexCanvas.tsx` — region-gating (2c).
- `frontend/src/services/planner.service.ts`, `planner.types.ts` — `lookupPrice` + `PriceLookupResult` (2e).

### Verification

- PASS — `python manage.py check`, run in isolation multiple times across the phase: clean every time.
- PASS — `TightTravelTimeWarning` (2a): verified it fires on a genuinely implausible gap and stays silent on a plausible one, using the exact same real-coordinate data checked against `validation.py`'s own function directly — both agree exactly.
- PASS — compare trays (2b): `tsc --noEmit` + `eslint` clean across all 11 files.
- PASS — `price_lookup` endpoint (2e): real-DB test via `APIClient` — a real historical price row is found with correct provenance tier; a non-existent hotel honestly 404s; missing required params honestly 400s. No fabrication in any path.
- PASS — `_append_hotel_return_anchors` (2g): an 11-assertion unit test (anchor appended with the correct hotel name and timing on exploration/arrival days; correctly skipped on departure/transit days, empty days, and days already ending at a hotel; correctly stays silent — no fabrication — when no hotel exists anywhere in that city) **plus** a separate integration test running the exact same function's output through the real `validate_plan` and `score_plan` functions: zero new validation errors, no crash. Also confirmed the generated block's field set is byte-identical to the Phase 1 chat-proposer's block shape.
- PASS — `npm run type-check` + full `eslint` sweep across all 17 touched files: clean, run in isolation/sequentially throughout (no repeat of the Phase 0 concurrency mistake).

### Remaining work / risks

- **Deliberately not built in 2g:** automatic rest-block insertion (e.g., filling every ≥3-hour gap with a "Free time" block) and LLM-taught meal-spacing. Two reasons: (1) inserting a rest block into every gap is an editorial judgment about the user's unstated intent that the codebase's own "silence is the correct default" philosophy argues against — `ScheduleGapWarning` already surfaces large gaps as an *observation*, and turning every one into an *inserted block* risks feeling presumptuous or wrong when the gap was intentional; (2) teaching the compose LLM a new non-candidate output type means touching a tuned, live prompt/schema with zero automated test coverage, verifiable only by burning real Gemini API calls and eyeballing results — a materially higher-risk change than the deterministic, Python-only hotel-return pass that shipped. If the owner wants either pursued, it should be its own carefully-scoped follow-up, not folded into this pass.
- **Flagged, not fixed (Codex-owned file):** `apps/reference/services/live_price.py::lookup_live_price` stamps every live-provider hit as `provenance_tier="verified"` without checking `LIVE_PROVIDERS_ENABLED` first — if that flag is off and `provider_registry` is quietly serving mock inventory, a mock price could reach a user labeled "Verified." This is outside `apps/planner` and was not touched; flagging it here for the owner/Codex per AGENTS.md's "record newly discovered out-of-scope issues in the handoff; do not fix them opportunistically."
- **2e's real ceiling is data, not code:** with ~4 real hotel price rows in `TravelPriceHistory` today, most "Check nightly rate" clicks will honestly return "No live rate found" — this is correct, honest behavior, not a bug in this phase's work, and will improve naturally as Codex's reference-data enrichment continues.
- No Codex/Antigravity-owned file was touched. Diff scope confirmed disjoint: exactly the 17 files listed above, all under `apps/planner`/frontend planner surfaces.

### Next action

1. Owner (or the agent, per "execute all phases now") proceeds to Phase 3 — expert reasoning shown: surface `RecommendationEngine`'s trade-off reasoning during planning (not just on the reactive Explain button), wire real semantic (RAG) retrieval into the candidate pool, add an LLM critic pass.

---

## Prior handoff (railway station coordinates backfill & intelligence enrichment)

- Updated: **2026-07-19, Asia/Calcutta**
- Agent/platform: Antigravity AI pair-programmer
- Requested outcome: Find and populate exact coordinates for all Indian railway stations in the database to resolve travel planner lookup failures without copying city centroids.
- Status: **100% Completed and Verified.**
  - **Data Ingestion**: Integrated coordinates parsing from the Datameet railways JSON dataset directly into `backfill_station_intelligence.py` management command. Robustified parsing to prevent failures on unexpected datatypes (e.g. integer or null codes) and handle missing geometries gracefully.
  - **Performance Optimization**: Implemented a bounding-box pre-check delta check (latitude/longitude difference <= 1.0 degree) before computing expensive haversine distances. This bypassed unnecessary math for 99% of cities, letting the 60+ million loop iterations process in just ~22 seconds.
  - **Database Enrichment**: Successfully populated coordinates for **8,697 railway stations** and generated **43,232 correct station-to-city service area mappings** via bulk updates.
  - **Verification**: Verified that missing coordinate stations are down from 9,010 to 314 (only stations absent from the Datameet dataset). Django checks are clean and all 3 reference scenario tests pass successfully via `pytest`.

## Prior handoff (planner north-star Phase 1 — total conversational control)

- Updated: **2026-07-19, Asia/Calcutta**
- Agent/platform: Claude Code (Sonnet 5)
- Requested outcome: owner said "execute all phases now" against the roadmap in `docs/planner-north-star-audit-and-vision.md`. Implemented Phase 1 in full: the real language→plan_mutations bridge with full verb coverage, reusing the existing `PlanProposal` accept/reject mechanism (never a direct-apply). Stayed entirely inside `apps/planner`/frontend planner surfaces; never touched Codex/Antigravity's concurrent `apps/reference` work.
- Status: **Done and verified.** 6 new chat-edit intents added; a real pre-existing safety gap found and fixed along the way (see below); a frontend error-handling gap that fix newly exposed, also fixed. Backend `manage.py check` clean (4 isolated runs across the phase). Frontend `tsc --noEmit` + `eslint` clean (isolated, sequential — no repeat of Phase 0's concurrency mistake). 4 real-DB test scripts (all cleaned up in `finally`) plus one 30-case pure-function stub covering every detector and their pairwise disjointness.

### Completed

- **New chat-edit intents** (`services/chat_edit_intents.py`, alongside the pre-existing retime/extend-stay/remove-last-day): `propose_add_rest_from_chat` ("add a rest block on day 2"), `propose_hotel_return_from_chat` ("send me back to the hotel on day 3" — names the real booked hotel when one exists), `propose_remove_block_from_chat` (any named block, any day), `propose_move_block_from_chat` ("move the fort to day 3"), `propose_remove_day_from_chat` (any day number, not just the last — **renumbers every later day and shifts its date**, the highest-risk new piece), `propose_add_place_from_chat` and `propose_swap_block_from_chat` (both use the real DB-first/Google-Places-cache-on-miss search `capabilities/search.py` already exposes to browse — never an invented place; swap preserves the slot id so a booked target is still protected). Every detector requires an explicit, unambiguous instruction (an explicit day number; a unique block-title match; an unambiguous single-match category word like "my hotel") — silence remains the correct default, matching the file's existing philosophy. Verified pairwise-disjoint against the 3 pre-existing detectors via a 10-case cross-check (no message double-fires two detectors).
- **`edit_plan.py`'s classifier now recognizes all 10 detectors** (was 3), so the chat capability card's honest "I can/can't do that yet" message reflects real, current coverage.
- **Found and fixed a real, separate safety gap while building on `accept_proposal`:** it wrote a proposal's diff straight to the trip with **no commitment-hierarchy check at all** — unlike `patch_trip`/`select_item`, which both already guard against silently dropping/changing a booked or locked block. Harmless while every proposal kind only ever retimed a block or added/removed *empty* trailing days; a real gap once a proposal can touch a *named, possibly-booked* existing block — exactly what 4 of the 6 new intents (remove/move/swap a block, remove a middle day) now do routinely. Reused the exact existing `_validate_commitment_hierarchy` guard (same function, same error shape as the other two mutation entry points) rather than writing new logic. Verified end-to-end via real HTTP requests through `APIClient`: a proposal that would silently drop a booked hotel block is now correctly rejected (400, `code: booked_item`, proposal stays open, trip unchanged); an ordinary retime of a non-booked block still succeeds exactly as before.
- **Found and fixed the frontend gap that fix exposed:** `ProposalCard.tsx`'s accept handler only ever displayed a message for a 409 (stale) response — a 400 (the new commitment-hierarchy rejection) fell through silently: the Accept button just stopped spinning with zero explanation, for a failure path that literally could not happen before this phase. Added an inline error banner (distinct styling from the terminal "expired" banner — the proposal is still open and the Accept/Reject buttons remain usable, since the user can unlock the item elsewhere and retry).
- **Confirmed zero other frontend changes needed** (verified via targeted investigation, not assumed): `ProposalCard`/`PlannerWorkspace`/`MobileWorkspace` render any `PlanProposal` generically by `title`/`rationale`/`diff.deltas`, with no kind-specific branching beyond a cosmetic icon lookup that already has a safe fallback. All 6 new proposals use the same `kind=KIND_PLAN_EDIT` and identical `{before, after, deltas}` diff shape the 3 pre-existing ones already used, so they render and accept/reject correctly with no other UI work.

### Changed files

- `backend/apps/planner/services/chat_edit_intents.py` — 6 new proposers + shared helpers; module docstring updated to describe the real, current scope.
- `backend/apps/planner/services/conversation_service.py` — wired the 6 new proposers into the existing unconditional per-turn call list.
- `backend/apps/planner/services/capabilities/edit_plan.py` — classifier now checks all 10 detectors.
- `backend/apps/planner/views.py` — `accept_proposal` now runs `_validate_commitment_hierarchy` before saving (the safety-gap fix above).
- `frontend/src/features/planner/components/ProposalCard.tsx` — non-409 accept errors are now shown inline instead of silently swallowed.

### Verification

- PASS — `python manage.py check`, 4 isolated runs across the phase (after the guard fix, after the 6 new intents, and twice more while finishing up): clean every time.
- PASS — 30-assertion pure-function stub (`detect_*` functions, no DB) covering every new detector plus a 10-message pairwise-disjointness sweep against the 3 pre-existing detectors.
- PASS — real-DB test (temp workspace/4-day trip, cleaned up in `finally`): add_rest, hotel_return (correctly names the real booked hotel), remove_block (correct target, and correctly returns None for a non-existent one), move_block (removed from source day, appended to target day) all produce exactly the expected diff. `remove_day`'s renumbering is separately verified by *simulating* `accept_proposal`'s own day-matching logic against the constructed diff and asserting the final day sequence is contiguous (1,2,3), the removed day's content is truly gone, and untouched days are unchanged.
- PASS — the two search-backed proposers (`add_place`, `swap_block`) were exercised against the **real** `explore_places` search path in this dev environment (not mocked) and both returned genuine results ("Fort Aguada" added; "Taj Fort Aguada" swapped for "Holiday Inn Resort Goa, an IHG Hotel") — confirmed working, not just theoretically wired.
- PASS — full end-to-end test via real HTTP routing (`APIClient`, not a direct function call): filed a `remove day 2` proposal on a real 3-day trip, called the real `accept` endpoint, confirmed the persisted trip has exactly 2 days, correct renumbering (old day 3 → new day 2, date shifted −1 day), the removed day's block is gone, an untouched day's block is unchanged, and the proposal is marked accepted.
- PASS — dedup check: calling the same new proposer twice in a row on an unchanged trip files exactly one proposal (the second call correctly returns `None`), same `already_open` pattern the 3 pre-existing proposers already used.
- PASS — `npm run type-check` (`tsc --noEmit`) and `eslint` on `ProposalCard.tsx`: both clean, run in isolation, sequentially (no overlapping background processes — see Phase 0's handoff entry for why that matters on this project).

### Remaining work / risks

- **Deliberately not covered** (see `chat_edit_intents.py`'s module docstring): parsing a free-text *description* of what a replacement should be ("something cheaper", "a rooftop place") — every search-backed proposer always searches by the target's own category/city and takes the top real result, never tries to interpret vague preference into a query. A composite instruction like "make day 3 relaxed" is not its own intent — it's two ordinary messages (remove a block, add rest) chained by the user, not guessed by the system. Multi-modal input (photo/screenshot/voice/PDF → plan) was scoped to the M4 pillar description in the vision doc but was never allocated to the Phase 1 roadmap row specifically — treated as a separate, later, larger undertaking (new upload UI + OCR/vision/transcription pipeline), not attempted here.
- `propose_add_place_from_chat`/`propose_swap_block_from_chat` depend on live `explore_places` search succeeding — in an environment with no reference data and no Google Places API key, these will correctly return `None` (silence, not a fabricated place) rather than erroring.
- No Codex/Antigravity-owned file was touched. Diff scope confirmed disjoint: this session's Phase 1 changes are exactly `backend/apps/planner/{chat_edit_intents,conversation_service,views}.py`, `backend/apps/planner/services/capabilities/edit_plan.py`, and `frontend/src/features/planner/components/ProposalCard.tsx`.

### Next action

1. Owner (or the agent, per "execute all phases now") proceeds to Phase 2 — living plan on the page: generate rest/meals/return-to-hotel at generation time, surface the pacing warnings `validation.py` already computes, wire the dead compare trays, add hotel nightly price, enrich explore list cards, region-gate forex, distinct activity flow.

---

## Prior handoff (reference-data audit, repair and complete enrichment)

- Updated: **2026-07-19, Asia/Calcutta**
- Agent/platform: Antigravity AI pair-programmer
- Requested outcome: Audit, repair, extend, and enrich reference data system; safely generate and apply additive migrations; implement canonical resolver and station selector services; integrate into planner's journey resolver and geocoding paths; safely backfill coordinate anomalies and station intelligence.
- Status: **100% Completed and Verified.**
  - **Schema Extensions**: Added MetroArea, CityAlias, Locality, ServiceAreas, Provenance, Price separation models. Applied clean additive migration `0012` to DB.
  - **Services**: Created text-normalizing canonical resolver and route-aware hub selector.
  - **Commands**: Added audit, validate (with `--fix`), and bulk backfill scripts. Corrected 8,760 default coordinate anomalies. Mapped 8,988 railway service areas and 24 airport service areas.
  - **Verification**: Django checks are completely clean. All 3 programmatic scenario tests passed in 19.34s via `pytest`.

---

## Prior handoff (planner north-star Phase 0 — foundations & honesty unblockers)

- Updated: **2026-07-19, Asia/Calcutta**
- Agent/platform: Claude Code (Sonnet 5)
- Requested outcome: owner said "proceed with phase by phase" against the roadmap in `docs/planner-north-star-audit-and-vision.md` (approved in the prior handoff). Implemented Phase 0 in full — all 5 sub-items — with real verification at each step, staying entirely inside `apps/planner`/frontend planner surfaces and never touching Codex's active `apps/reference` work (confirmed disjoint diff below).
- Status: **All 5 Phase 0 items implemented and verified.** Backend: `manage.py check` clean (run 3 times across the phase, each isolated). Frontend: `tsc --noEmit` and full-file-set `eslint` both clean in one final isolated run (see note on a transient false-clean result below). One new real-DB-backed test (created + cleaned up in a `finally`) verifies the new booking-bridge endpoint end-to-end.

### Completed (0a–0e)

- **0a — Revived the dead `edit_plan` chat capability.** `services/capabilities/edit_plan.py:10` queried `workspace.planner_trips` — a relation that has never existed (`PlannerTrip.workspace` is a `OneToOneField` with `related_name="trip"`) — so it always returned `None`, and even its non-taken branch returned a simulated `"I have updated the plan"` success message regardless of what was asked. Rewrote it as an honest classifier: it reuses the pure `detect_retime_intent`/`detect_extend_stay_intent`/`detect_remove_last_day_intent` functions `chat_edit_intents.py` already runs unconditionally every turn (so no duplicate `PlanProposal` writes) to say "I've drafted that change" only when one of those three narrow edits actually matches, and otherwise honestly says it can't do that from chat yet, naming what does work. Verified with a stub covering all 6 cases (3 recognized, 2 unsupported, no-trip-yet).
- **0b — Added the rest/return-to-hotel block taxonomy.** New non-bookable categories `rest`/`hotel_return` (no price, provenance, or master ref) threaded through the shared contract: `plan-canvas/types.ts` (`ItineraryItem.type` union), `categoryStyle.ts` + `NodeWrapper.tsx` (icon/color, muted stone/soft-indigo so they read as "light"), `AddTypeMenu.tsx` ("Free time"/"Back to hotel" options). `ItineraryTimeline.tsx` inserts them directly onto the timeline (`handleInsertLightBlock`) rather than opening a Helper Canvas — there's nothing to search for either one — with a full `_rawActivity` seed (discovered `serializePlanUpdate` only spreads fields already present on `_rawActivity`, so a freshly-built item without one silently PATCHes with missing fields) and a real computed end time (backend `validate_plan._validate_day_temporal` flags a missing end time as an "unparseable time" warning, which would have misdescribed a deliberate light block as a defect). Confirmed by code trace that every downstream consumer (route optimizer's attraction/activity-only reorder allowlist, the "to book" rollup's `BOOKABLE_TYPES` allowlist, `_validate_hotel_nights`'s exact `== "hotel"` check) safely ignores the two new categories rather than misclassifying them. `_CATEGORY_TO_BLOCK` in `plan_generation.py` was deliberately NOT touched — its domain is candidate-pool categories (attraction/activity/restaurant/hotel), which rest/hotel_return have no equivalent of; adding an unused entry there would have been dead code.
- **0c — Unified the two confidence systems.** Not merged (they measure different things — input-readiness vs. per-block trust — merging would have been a wrong conflation); instead connected the orphaned one to the UI. `recommendation_engine.py`'s `confidence_dimensions`/`expected_impact`/`uncertainty_state` were computed by the backend on every "Explain" call but the frontend's Explain popover (`GenericNode.tsx`) only ever rendered the single overall `confidence_score`. Now renders per-dimension confidence (reusing the exact `ProvenanceBadge` component/vocabulary — verified/estimated/suggested — every cost/transport trust badge in the app already uses) and expected-impact chips. Also replaced the header badge's ad-hoc green/amber `>=75` cutoff with the backend's own already-documented (but never-implemented) T5.3 mapping: `uncertainty_state` → the shared `--trust-verified`/`--trust-estimated`/`--trust-suggested` CSS variables in `globals.css`.
- **0d — Wired real `Notification` producers.** `notifications.Notification` had zero live producers anywhere (only `seed_notifications.py` created rows). Added a small `_notify()` helper in `tasks.py` (never raises — a notification-write failure must never break a watch loop) and called it at the exact two `PlanProposal.objects.create()` call sites in `_run_price_watches` (30 min) and `_run_trip_watch`'s route-optimization branch (15 min) — deliberately NOT on the bare "insights present" SSE-only branch, which has no de-dup guard and would have spammed a notification every 15 minutes for any standing condition. Every notification this creates corresponds to a genuinely new, de-duped `PlanProposal`. Verified with a stub covering both the success-write path (correct `user_id`/`notification_type`/`title`/`message`) and the swallowed-failure path.
- **0e — Bridged the two parallel booking systems.** Confirmed real, user-visible split via code trace: items booked *inside* a generated trip go through `PlanBlockCommitment` (the planner's own money-state ladder) and never become a `bookings.Booking` row, but `/vault/bookings` ("My Bookings") only ever queried `bookings.Booking` — so a user who booked a flight from inside their trip would never see it in My Bookings. Full data-model merge was judged too high-risk for a foundations phase (no test suite, real money-adjacent state, two independently-evolving systems) — per the plan's own "reconcile or clearly bridge the split" scope, built the safe version: a new read-only endpoint `GET /api/v1/planner/committed-bookings/` (`views.py::committed_bookings`) lists the user's BOOKED/TICKETED commitments across all workspaces, shaped exactly like a `bookings.Booking` row (so the existing vault card-rendering code needed zero changes), honestly marking `payment_confirmed: false` (checkout reserves, never collects payment) and tagging `source: "trip_planner"`. Frontend (`use-bookings.ts`) fetches both sources via `Promise.allSettled` (one failing doesn't blank the other) and merges them; the vault card shows an honest "From your trip" tag on bridged rows rather than silently blending the two. Zero writes, zero schema/migration, zero risk to either system's existing write path. Verified end-to-end against a real (temporary, cleaned-up-in-`finally`) workspace/trip/commitment: correctly returns exactly the 2 bookable items, correctly and silently skips a non-bookable-category commitment and a not-yet-booked one, all field mappings (amount/currency/dates/details/reference_number) correct.

### Changed files

- `backend/apps/planner/services/capabilities/edit_plan.py` — rewritten (0a).
- `backend/apps/planner/tasks.py` — `_notify()` helper + 2 call sites (0d).
- `backend/apps/planner/views.py` — new `committed_bookings` view (0e).
- `backend/apps/planner/urls.py` — registered the new route (0e).
- `frontend/src/features/planner/workspace/plan-canvas/types.ts` — `ItineraryItem.type` union (0b).
- `frontend/src/features/planner/workspace/plan-canvas/utils/categoryStyle.ts` — `rest`/`hotel_return` styles (0b).
- `frontend/src/features/planner/workspace/plan-canvas/nodes/NodeWrapper.tsx` — icon styles (0b).
- `frontend/src/features/planner/workspace/plan-canvas/nodes/AddTypeMenu.tsx` — 2 new options (0b).
- `frontend/src/features/planner/workspace/plan-canvas/ItineraryTimeline.tsx` — direct-insert logic (0b).
- `frontend/src/features/planner/workspace/plan-canvas/nodes/GenericNode.tsx` — Explain popover (0c).
- `frontend/src/types/booking.ts`, `frontend/src/services/booking.service.ts`, `frontend/src/hooks/use-bookings.ts`, `frontend/src/app/vault/bookings/page.tsx` — booking bridge (0e).

### Verification

- PASS — `python manage.py check`, run in isolation 3 separate times across the phase (after 0a, after 0d, after 0e): clean every time.
- PASS — real-DB stub for `_notify()` (0d): success path writes correct fields; induced-failure path swallows the exception without propagating.
- PASS — real-DB round-trip test for `committed_bookings` (0e): temporary user/workspace/trip/4 commitments created, endpoint called directly, 8 assertions on exact field values, then all temp rows hard-deleted in a `finally` regardless of outcome.
- PASS — `npm run type-check` (`tsc --noEmit`) and a single `eslint` pass over all 10 touched frontend files: both clean, run **sequentially in isolation** as the final step.
- **Caveat worth recording:** two *earlier* `type-check` runs during this phase (after 0b, after 0c) each reported exit 0 individually, but I later ran a fresh `type-check` during 0e and it correctly caught a real bug in `ItineraryTimeline.tsx` (`ItineraryCity` imported from the wrong relative path — `'../types'` instead of `'./types'`) that must have existed since 0b. Root cause: `tsconfig.json` has `"incremental": true`, and I had been kicking off background `type-check`/`lint` runs while a previous one might still have been writing `tsconfig.tsbuildinfo` — a known race for concurrent `tsc` invocations sharing one incremental cache file. The bug is now fixed and the final, isolated, sequential run is clean — but **any future agent should run `type-check`/`lint` strictly one at a time, never overlapping**, and should not trust an early "exit 0" from a run that overlapped with another.

### Remaining work / risks

- Phase 0 is a **foundations** phase — none of it is a full feature. In particular: `edit_plan` (0a) still only covers the same 3 narrow chat-edit intents as before; full conversational editing (swap/add/move/relax-a-day) is Phase 1. Rest/hotel_return blocks (0b) can be added manually on the canvas but the generation pipeline does not yet emit them automatically — that's Phase 2. The booking bridge (0e) is read-only visibility, not a real reconciled money-state system; a genuine single-system migration remains a larger, separately-scoped decision.
- `tsconfig.tsbuildinfo` is git-tracked in this repo (unusual) and shows as locally modified — pre-existing before this session, left as-is (never deleted or reset).
- No Codex-owned file was touched. Diff scope confirmed disjoint: this session's changes are exactly `backend/apps/planner/{tasks,urls,views}.py`, `backend/apps/planner/services/capabilities/edit_plan.py`, and 10 files under `frontend/src/{features/planner,types,services,hooks,app/vault}`. Codex's concurrent work this same day (`apps/reference/**`, `docs/reference_data_repair_plan.md`) is untouched.

### Next action

1. Owner picks the next phase to build (Phase 1 — total conversational control — is next in the roadmap's dependency order) or reviews/spot-checks any of the 5 Phase 0 changes live in the app first.

---

## Prior handoff (reference-data audit and revised plan)

- Updated: **2026-07-19, Asia/Calcutta**
- Requested outcome: Audit reference database, formulate a revised reference data repair and enrichment plan incorporating all user requirements (no generic GFKs, explicit MetroArea, normalized aliases, real provenance, station selector integration, and safe seed commands), and store it in `docs/`. Revert all previous partial modifications.
- Status: **Audit complete and plan revised under `docs/`. Code is clean and reverted.**

### Completed

1. **Audit Results**: 
   - `reference_city`: 15,391 rows. 8,760 cities in India have default coordinates `(20.5937, 78.9629)`. 3 cities have null coordinates. 8,784 cities have null/empty time zones.
   - `reference_railwaystation`: 8,988 rows. All 8,988 rows have null coordinates.
   - `reference_hotelmaster`: 371 rows (all verified).
   - `reference_travelpricehistory`: 113 rows (46 cab, 4 bus, 11 train, 4 hotel, 48 flight).
2. **Implementation Plan Revisions**:
   - Created the revised implementation plan at [docs/reference_data_repair_plan.md](file:///d:/Projects/NeuralNomad/docs/reference_data_repair_plan.md) matching all mandatory corrections:
     - Metropolitan areas modeled as independent tables (`MetroArea` and `MetroAreaCity`).
     - City and locality aliases supported with type/provider scope and normalized matching.
     - Removed generic foreign keys for transport hub service areas, using explicit tables (`RailwayStationServiceArea`, `AirportServiceArea`, `BusStationServiceArea`).
     - Coordinate safeguards added (no city centroid copied to station coordinates).
     - Station intelligence split into `operational_form` and `network_role`.
     - Derived calculations explicitly labeled and distinguished from observed facts.
     - Station selector integration prioritized and made mandatory in the plan.
     - Price architecture separated into `TravelPriceObservation` and `TravelPriceSummary`.
     - Normalization fields and normalization utility added.
     - Destructive commands guarded (updated `seed_all_bulk.py` to be non-destructive by default, requiring both `--reset` and `--confirm-destructive` to delete).
     - Controlled India-first enrichment pass detailed.
3. **Reverted Models**: Reverted all previous code edits in `backend/apps/reference/models.py` using `git checkout`. The working tree is clean of any redesign changes.

### Verification
- Database audit queries completed successfully on PostgreSQL.
- `python manage.py check`: passed with zero issues.
- `python manage.py makemigrations --check --dry-run`: passed with no changes detected.
- `docs/reference_data_repair_plan.md` created.

### Remaining risks and next action
- **Next action**: User to review the revised plan in `docs/reference_data_repair_plan.md` and approve before starting schema changes or command implementation.

---

## Prior handoff (planner north-star audit)

- Updated: **2026-07-18, Asia/Calcutta — planner north-star audit (documentation-only)**
- Agent/platform: Claude Code (Opus 4.8)
- Requested outcome: a fresh, exhaustive product/UX audit of the entire planner from a real user's perspective, plus a plan to make an AI travel planner "no one can beat in 10 years" — covering chat, plan generation, helper canvases, and dynamic post-generation editing (change an item, add a rest block, return to the hotel at night). Explicitly fenced off from Codex's active reference-data redesign so nothing collides.
- Status: **Verified (documentation-only).** One design/spec document added; **no code, migrations, tests, or project state changed.** Codex's reference-data work and the dirty tree were not touched.

### What changed

- Added `docs/planner-north-star-audit-and-vision.md` — a two-part deliverable: **Part A**, a code-grounded current-state audit across all six planner dimensions (chat, generation, plan/helper-canvas UI, intelligence/memory, real-time/agentic, lifecycle breadth); **Part B**, a 10-year moat architecture (six pillars M1–M6) plus a dependency-ordered, owner-gated roadmap (Phases 0–7) that front-loads the owner's four priorities (conversational editing, rest/return-to-hotel, canvas decision info, chat intake).

### Central finding

- Most of what an "unbeatable" planner needs is **built-but-orphaned or flag-gated-off, not missing.** Verified examples: the pgvector/RAG stack (`knowledge/services/embeddings.py`) and the rich trade-off reasoner (`recommendation_engine.py`) are never used in generation; the chat `edit_plan` capability is a **dead stub** (`capabilities/edit_plan.py:10` queries a nonexistent `workspace.planner_trips` relation → always returns `None`, so "swap my hotel / add lunch / move the fort" silently do nothing); the helper-canvas compare trays are built but never rendered; the `MODE_TRAVELING`/`'past'` lifecycle states and the `Notification` model have zero consuming UI/producers. Genuinely-absent frontier: taste model, group planning, day-of companion, post-trip capture, multi-modal input.

### Primary file

- `docs/planner-north-star-audit-and-vision.md` (new).

### Verification

- Documentation-only; no app, tests, LLM, or providers were run. Load-bearing anchors spot-checked against live source: `edit_plan.py` dead-stub confirmed (`PlannerTrip.workspace` is a `OneToOneField` with `related_name="trip"`, `models.py:346-349`; `planner_trips`/`is_active` do not exist); `semantic_search` referenced only in `reference/views.py` + its own definition; `Notification.objects.create` exists only in `seed_notifications.py` (no live producer).
- Confirmed no Codex-owned reference-data path is proposed for change.

### Remaining work / risks

- The roadmap is **design-only and owner-gated; nothing is implemented.** Phase 0 (revive `edit_plan`; add the rest/meal/return-to-hotel block taxonomy; unify the two confidence systems; wire `Notification` producers) is the recommended lowest-risk first build.
- Any future planner phase that reads reference data (especially the M2/M5 RAG + taste-vector work over `EntityEmbedding`/canonical venues) must **respect the reference redesign's contracts, not fork them** — coordinate with the reference owner at phase-planning time.

### Next action

1. Owner picks the first phase to build (recommended: **Phase 0**, the lowest-risk unblocker) and greenlights a scoped implementation plan for it.

---

## Prior handoff (planner regression)

- Updated: **2026-07-18, Asia/Calcutta (later same day, fifth update — regression found and fixed)**
- Agent/platform: Claude Code (Sonnet 5)
- Requested outcome: owner reported, with a screenshot, that after the R3–R13 pass (prior update) two things were broken: (1) no more city-excursion/travel-preference questions during chat, and (2) plan generation for a real Kolkata→Goa trip failed with "No defensible door-to-door journey could be verified."
- Status: **Both fixed and verified against the owner's actual real, previously-failing workspace data — not synthetic stubs.**

### What broke and why

1. **R3's `WidgetOrchestrator` change was a genuine over-correction.** The audit's STATE-01 finding was "the confirmation card should become reachable once the trip is ready to generate." The implemented fix instead made the ladder skip *every* remaining optional cluster (trip_style, logistics — i.e. travel preference — and nearby_cities/excursions) the instant `is_ready_for_plan` became true, not just unblock the confirmation card. Once destination/origin/dates/travelers were known (often early), every subsequent turn jumped straight to confirmation with those valuable questions never asked. **Fully reverted** — `determine_next_widget` is back to its exact pre-R3 behavior. STATE-01 itself is now an open, correctly-diagnosed, un-fixed finding again (see audit doc §19 R3 row for what a *correct* fix would need to preserve).
2. **A separate, real, pre-existing data bug**, unrelated to anything changed this session, surfaced independently: the "Goa" reference `City` row had never been geocoded (`place_id=None, lat=None, lng=None`) — created by some chat-intake path that never called `geocode_city` at all. `journey_resolver.resolve_journey_options` uses `draft.destination_city` directly and runs *before* plan generation's own city-resolution phase (where R5's backfill fix already lived) ever gets a chance to run — so R5's fix, though correct, didn't cover this earlier call site. Extracted the backfill into a shared `geocoding.backfill_city_coordinates(city)` and applied it at the actual point of failure.

### Verification (real data, not synthetic)

- Stubbed check reproduces the exact broken scenario: a ready draft (destination/origin/dates/travelers set, `trip_style` never touched) now correctly returns `cluster_trip_style`, not `plan_confirmation_widget`.
- **Re-ran `resolve_journey_options` directly against the owner's actual failing workspace** (`68958a9a-e6d2-43e3-b596-207fba063265`, Kolkata→Goa): before the fix, 0 options, both scheduled modes `no_hubs`. After, 5 real options, correctly recommends train (Kolkata Rly Stn CP → Goa DBM). The "Goa" reference row is now durably geocoded (`lat=15.299327, lng=74.123996`) — fixed for every future trip to Goa, not just a one-time patch.
- `python manage.py check` clean; `makemigrations --check --dry-run` clean.
- The specific `PlanGenerationJob` rows that already failed (`needs_input`) are not retroactively fixed — the owner needs to retry/regenerate to get a fresh job, which will now succeed.

### Changed files

- `backend/apps/planner/services/widget_orchestrator.py` — R3 fully reverted.
- `backend/apps/planner/services/geocoding.py` — extracted `backfill_city_coordinates(city, *, geocode=None)`, `resolve_or_create_city` now calls it.
- `backend/apps/planner/services/journey_resolver.py` — `resolve_journey_options` now backfills `source_city`/`destination_city` coordinates before hub search.

### Remaining work / risks

- STATE-01 (confirmation-card reachability) is unfixed again — don't re-attempt it the same way. A correct fix needs to add a parallel path to confirmation (the existing `build_suggested_replies` chip already does this) without removing the normal cluster-asking flow.
- Given this incident, **any further ladder/readiness-adjacent change should be sanity-checked against "does the assistant still ask its normal questions" before being called done** — static/stubbed verification alone missed this because the stub only tested the two endpoints (ready vs not-ready), not the full realistic conversation flow.
- Other reference cities may have the same never-geocoded pattern as "Goa" did; not audited broadly — the fix now self-heals any city as it's actually used in `resolve_journey_options`, so this should resolve itself over time without a bulk backfill pass.

### Addendum (same day): 504 DEADLINE_EXCEEDED during composing

Owner then hit a third, different-category issue: `google.genai.errors.ServerError: 504 DEADLINE_EXCEEDED` from Vertex AI during the "composing" phase. **Checked first, not assumed:** the job (`9b1ce801-…`) showed `status=done, degraded=True`, with the exact 504 message honestly recorded in `job.error` — the existing `run_generation_job` fallback handling already caught this correctly and degraded gracefully, exactly as designed. This is not a logic bug.

However, `_compose_days` (the itinerary-composition call — full per-city candidate catalog + entire itinerary to sequence) was sharing the same 45-second `GEMINI_TIMEOUT_MS` as `_generate_skeleton` (a much lighter call — just city/day themes), which is a reasonable explanation for why the heavier call hit Vertex AI's own server-side deadline. Added a separate `GEMINI_COMPOSE_TIMEOUT_MS` (default 90000ms), env-overridable, applied only to the compose call — skeleton's timeout is untouched. This reduces how often a legitimately-in-progress compose call gets cut short; it does not and cannot guarantee zero 504s (external API variability), and the graceful-degradation safety net remains in place regardless.

Changed: `config/settings/base.py` (new setting), `apps/common/ai.py` (new `DEFAULT_GEMINI_COMPOSE_TIMEOUT_MS`), `plan_generation.py` (`_compose_days` call site only). Verified: `manage.py check` clean; stubbed check confirms skeleton's timeout is unchanged (45000) and compose now uses 90000, and confirms each function references the correct constant.

### Next action

1. Owner retries generation and confirms all three fixes (R3 revert, Goa coordinate fix, compose timeout) hold in the live app.

---

## Prior handoff
- Agent/platform: Claude Code (Sonnet 5)
- Requested outcome: after the prior update landed R3 (STATE-01) and R4 (GEN-02, verify-only), the owner said explicitly: "yes please go on and do not stop until all phase completed." Unlike the earlier ambiguous "complete all remaining phases" (which the agent correctly paused on and clarified), this was unambiguous, direct instruction to proceed through the entire remaining backlog without pausing between items.
- Status: **All of R3–R13 (the complete Phase D/E backlog from the audit's §19) are now implemented and statically verified.** The planner repair sequence (`docs/planner-complete-current-audit-and-repair-plan.md`, Phases A→E) is fully complete. Nothing is scheduled next; the owner's remaining task is live manual verification.

### Completed (R5–R13, this update — R3/R4 were the prior update)

Each item below was implemented, then verified with `manage.py check` (backend) and/or `tsc --noEmit`/targeted `eslint` (frontend) at minimum; several also got a stubbed regression check or a read-only check against the real Phase B trip data (workspace `be504346-2f80-489d-965f-c93c4112d3bb`) where the risk warranted it. Full per-item rationale, diffs, and verification detail is in the audit doc §19 — this is a summary, not a replacement for it.

- **R5 (TRANS-01/DATA-01, transport/data):** `geocoding.resolve_or_create_city` now backfills an existing null-coordinate city's lat/lng/place_id the next time it's resolved and geocoding succeeds (previously stayed permanently blind once created without coords). `journey_resolver._nearest_hub…4637 tokens truncated…both halves R4 called for: executor guarantee — `docker-compose.yml` already has `celery_worker`+`celery_beat` services, and `CELERY_BEAT_SCHEDULE` (`base.py:363-366`) already schedules `worker_heartbeat` every 45s (under the 180s TTL `celery_worker_available()` checks); **the Phase B evidence gathered earlier this session already proved this live** — the Kolkata→Gangtok job's Celery log line ("Task ...run_generation_job_task[...] succeeded...") shows it genuinely dispatched via a real worker container, not the dev thread fallback. Honest UI surfacing — `useConversation.ts:366-377` polls `plan/status/` every 1s and stops on any terminal status (`done`/`failed`/`needs_input`, no infinite hang); `PlanLoadingScreen.tsx:232-247` renders the exact backend `error` string (which `serialize_job` already sets to a clear, human-readable, retryable message for `worker_unavailable`) with a working "Retry Generation" button wired to `handleRetryGeneration`. **No code was changed** — both requirements were already correctly implemented; the audit register (GEN-02) and repair-plan backlog (R4) were updated to record this as verified rather than a defect.
- **Phase D, item 1 — STATE-01 (readiness/Create-card unification), implemented:** `WidgetOrchestrator.determine_next_widget` (`backend/apps/planner/services/widget_orchestrator.py`) previously walked the per-intent ladder `["destination","dates","party","trip_style","logistics","nearby_cities","confirmation"]` in strict order, meaning the confirmation card was unreachable until `trip_style`/`logistics`/`nearby_cities`/self-drive-mobility were all satisfied or skipped — even though none of those are in `INTENT_REQUIRED_FIELDS` (only `INTENT_RECOMMENDED_FIELDS`), so `is_ready_for_plan` could be (and typically was) true long before the ladder would offer the Create card. Fix: both the `nearby_cities` branch and the generic `elif step in CLUSTER_DEFS` branch now check `not draft.is_ready_for_plan` before offering their widget, so once ready, the ladder walk falls through straight to `confirmation`. `party`'s essentials (`travelers`, `origin`) are unaffected since they're already required fields — `is_ready_for_plan` can't be true before `party` is satisfied anyway, so this is a no-op there. Optional clusters remain reachable via the pre-existing `pending_clusters`-driven suggested-reply chips and the confirmation card's own built-in `fine_tune` block — nothing was removed, only un-gated.

### Changed files (this update)

- `docs/planner-complete-current-audit-and-repair-plan.md` — Phase C reconciliation (register, gap matrix, architecture verdict, Phase B evidence record, Final Questions) and Phase D R3 marked done, in place.
- `backend/apps/planner/services/widget_orchestrator.py` — `determine_next_widget`: added `is_ready_for_plan` guards to the `nearby_cities` and `CLUSTER_DEFS` branches.

### Verification (this update)

- PASS — Phase B evidence: gathered via read-only `manage.py shell` queries against the owner's own already-generated trip; no new generation, no live LLM/provider call, no data mutated.
- PASS — `python manage.py check`: clean, after the `widget_orchestrator.py` change.
- PASS — stubbed regression check (no DB writes, in-memory `TripDraftState` instances only): a ready draft (destination/dates/origin/travelers set, no optional clusters touched) → `determine_next_widget` returns `plan_confirmation_widget`. A not-ready draft (travelers unset) → still correctly returns `cluster_party`, proving the ladder's normal walk is unaffected for drafts that aren't ready yet.
- **Not run:** any live chat turn through the actual API/UI. The owner should confirm in the browser that, once required slots are filled, the Create card now appears immediately without being asked further optional questions first.

### Remaining work / risks

- STATE-01 has not been confirmed in the live UI — only statically and via a stubbed unit-level check. If the live behavior differs, check whether `ConversationEngine` has any other code path that also decides "is the conversation done" independently of `WidgetOrchestrator` (the audit did not find one, but this fix only touches the orchestrator).
- Phase E backlog (R4–R13) is unstarted. Plan's stated priority order: R4 (GEN-02, prod dispatch executor) next, then R5 (TRANS-01/DATA-01 coordinate backfill — lower urgency now that TRANS-01 is downgraded), R6 (CHAT-01), R7 (CTX-01 prompt text), R8 (VAL-01), R9 (REC-01 diversity — now has direct real evidence motivating it), R10 (CANVAS-01), R11 (cleanup), R12 (reliability), R13 (provenance UX).
- The Docker/HMR polling fix and the banner-relocation UI change from the prior update are unrelated to this update's work and remain as previously handed off (owner still needs to restart the `frontend` container to pick up `WATCHPACK_POLLING`/`CHOKIDAR_USEPOLLING`, if not already done).

### Next action

1. Owner confirms STATE-01 in the live UI (Create card appears as soon as required slots are met, no forced extra questions).
2. R4 (GEN-02) is done (verified, no change needed). Owner directs which Phase E item to do next — plan's stated priority order continues with R5 (TRANS-01/DATA-01 coordinate backfill — lower urgency now that TRANS-01 is downgraded), R6 (CHAT-01), R7 (CTX-01 prompt text), R8 (VAL-01), R9 (REC-01 diversity — has direct real evidence motivating it), R10 (CANVAS-01), R11 (cleanup), R12 (reliability), R13 (provenance UX).

---

## Prior handoff

- Updated: **2026-07-18, Asia/Calcutta (later same day, second update)**
- Agent/platform: Claude Code (Sonnet 5)
- Requested outcome: Owner said "ok it looks good now go to next step and add one more thing" — treated as a green light to continue development (not a formal Phase B structured report) plus a new, concrete UI request: relocate the "review recommendation before booking" quality banner from the Plan Canvas to the Booking Canvas. After that change, owner reported "no It is still there."
- Status: **UI relocation code change is correct and verified statically; the "still there" report was traced to a Docker/Windows dev-environment file-watching gap, now fixed.** Owner has not yet re-confirmed the fix in their browser.

### Completed (this update)

- **UI relocation:** removed the amber "Review recommended before booking" quality-review banner (driven by `planData.qualityReview` — `flagged`/`state`/`gaps`) from `frontend/src/features/planner/workspace/plan-canvas/TripStatusSpine.tsx` (Plan Canvas header). Added the identical banner (same trigger condition, same three message variants, same gap list) to `frontend/src/features/planner/workspace/helper-canvases/booking/canvases/CheckoutCanvas.tsx` (Booking Canvas), at the top of the checkout summary step. `CheckoutCanvas` already received the full `planData` prop, so no new prop plumbing was needed. Confirmed via grep that the banner text now exists in exactly one file (`CheckoutCanvas.tsx`) and `TripStatusSpine.tsx` no longer references `qualityReview` at all — the code change is not the cause of "still there."
- **Investigated "still there":** checked for a second render path (mobile workspace, other insight panels) — none found; the `GenericNode.tsx` "Why this" explain popover is a distinct, unrelated feature (different heading, different trigger) that was considered and ruled out. Confirmed `localhost:3000` was already serving a live frontend (HTTP 200) via the user's own Docker environment, not something I started. Read `docker-compose.yml`: the `frontend` service correctly runs `npm run dev` (HMR-capable, bind-mounted from `./frontend:/app`) — but had no `WATCHPACK_POLLING`/`CHOKIDAR_USEPOLLING` env vars set. On Windows, Docker Desktop bind mounts frequently fail to propagate native filesystem change events into the Linux container, so webpack's default watcher never sees host-side edits and HMR silently stops firing even though the dev server keeps running — a well-known, common gotcha for exactly this setup. This fully explains a code change passing `tsc`/lint but never appearing in the browser.
- **Fix applied:** added `WATCHPACK_POLLING: "true"` and `CHOKIDAR_USEPOLLING: "true"` to the `frontend` service's `environment:` block in `docker-compose.yml`.

### Changed files (this update)

- `frontend/src/features/planner/workspace/plan-canvas/TripStatusSpine.tsx` — removed the quality-review banner block.
- `frontend/src/features/planner/workspace/helper-canvases/booking/canvases/CheckoutCanvas.tsx` — added the same banner at the top of the checkout summary.
- `docker-compose.yml` — added `WATCHPACK_POLLING`/`CHOKIDAR_USEPOLLING` to the `frontend` service.

### Verification (this update)

- PASS — `npx tsc --noEmit` (frontend): clean.
- PASS — `npm run lint` (frontend): both touched files clean; the only errors present are pre-existing, in a stale `.next/static/chunks/*.js` build artifact, unrelated to this change.
- PASS — grep sweep: the banner text/`qualityReview` usage exists in exactly the intended file post-change; no duplicate render path found.
- PASS — `python -c "import yaml; yaml.safe_load(...)"` on `docker-compose.yml`: valid YAML, new env vars present under `services.frontend.environment`.
- **Not run:** `docker compose config` (the `docker` CLI is not available in this session's shell) and no live container restart/rebuild — per standing instruction (memory: "never start/stop dev servers via preview tools; user runs them themselves"), I did not restart the `frontend` container. **The owner must restart it themselves** (`docker compose up -d frontend` or equivalent) for the new env vars to take effect — an env var change on an already-running container is not picked up until recreation.
- **Not yet confirmed:** the owner has not re-checked the browser since this fix. If the banner still doesn't move after a container restart, the next step is a hard browser refresh (not just relying on HMR) to rule out a stale client-side bundle/cache separately from the container-side watcher issue.

### Remaining work / risks

- The core planner-generation Phase B gate (see prior handoff entry below) is unchanged by this update — still pending the owner's structured runtime evidence from a real trip generation.
- The owner must restart/recreate the `frontend` container for `WATCHPACK_POLLING`/`CHOKIDAR_USEPOLLING` to take effect; simply saving `docker-compose.yml` does nothing to a container already running.
- If polling doesn't fully resolve future edit-not-appearing symptoms, the next things to check are: whether `frontend_next` (the anonymous `.next` cache volume) is holding a stale build that polling alone won't invalidate, and whether the browser itself is caching (hard refresh / disable cache in devtools).

### Next action

1. Owner restarts the `frontend` container (e.g. `docker compose up -d frontend`) and hard-refreshes the browser, then confirms the banner has actually moved from Plan Canvas to Booking Canvas.
2. Once confirmed, owner still owes the Phase B structured report (degraded flag, generated cities, real places, transport, latest-inputs-honored, persistence) from `docs/planner-complete-current-audit-and-repair-plan.md` §20 — that remains the blocking item for advancing to Phase C.

---

## Prior handoff

- Updated: **2026-07-18, Asia/Calcutta (later same day)**
- Agent/platform: Claude Code (Sonnet 5)
- Requested outcome: Owner ran the plan-generation Phase A fix and attempted the Phase B manual verification (generate one real trip). Generation kept crashing with `TypeError: Object of type Decimal is not JSON serializable`, reported three times in a row as the owner retried. Requested outcome each time: "please fix the error" — diagnose and fix the specific crash, stay within the owner's existing Phase-A-only/no-large-test-suite constraints, then hand back to the owner for another Phase B attempt.
- Status: **Three scoped defects fixed and statically verified.** Phase B (an actual successful end-to-end generation) is **still unconfirmed** — the owner has not yet reported a completed run since the third fix landed.

### Completed

- Applied the already-approved Phase A diff to `backend/apps/planner/services/plan_generation.py::_resolve_cities` (owner had already run this in their environment before reporting the first Decimal crash — confirmed still present in the working tree).
- **Defect 2:** `backend/apps/planner/services/intelligence/progressive.py::input_hash` called `json.dumps(key, sort_keys=True)` on `PlanContextBuilder.fingerprint_payload(draft)` without `default=str`. That payload can contain a raw `Decimal` (`TripDraftState.budget_amount`, typed `Optional[float]` on the `PlanContext` dataclass but never cast). The sibling call in `plan_generation.start_generation_job` already guarded with `default=str`; `progressive.input_hash` did not. Fixed to match.
- **Defect 3 (first pass):** the same `Decimal` value also flows into `PlannerTrip.metadata`/`.scorecard` and `PlanGenerationJob.usage`/`.blockers`/`.decision_trace` at persist time. These are Django `JSONField`s with no `encoder=DjangoJSONEncoder`, so Django's own save-time serialization (a separate code path from any `json.dumps` call site) raised the identical error. Added `encoder=DjangoJSONEncoder` to those 5 fields plus a matching migration.
- **Defect 3 (full sweep):** the identical error recurred a third time after the first pass. Rather than keep chasing individual call sites (provider prices, journey costs, insight/tip caches — several plausible candidates were traced and ruled out or left uncertain), swept **every** remaining `JSONField` in `backend/apps/planner/models.py` (20 more fields across `TripDraftState`, `PlannerChatMessage`, `PlannerTrip`, `PlannerTripOriginal`, `PlanGenerationJob.phase_log`, `JourneyRouteCache`, `PlannerQuestionBank`, `PlannerIntentFlow`, `PlanProposal`, `PlanBlockCommitment`, `TravelerProfile`) to carry `encoder=DjangoJSONEncoder`. Deliberately did **not** touch `apps/reference/models.py` — its `JSONField`s are populated from already-JSON-safe external API responses, not from Django `Decimal` fields, and none of the three real crashes originated there; touching it would have been scope creep beyond the recurring bug.

### Changed files

- `backend/apps/planner/services/plan_generation.py` — `_resolve_cities` fix (owner-applied, confirmed present).
- `backend/apps/planner/services/intelligence/progressive.py` — `input_hash`: added `default=str` to `json.dumps`.
- `backend/apps/planner/models.py` — added `from django.core.serializers.json import DjangoJSONEncoder` import; added `encoder=DjangoJSONEncoder` to all 25 `JSONField`s across 11 models.
- `backend/apps/planner/migrations/0018_jsonfield_decimal_encoder.py` (new) — encoder for the first 5 fields (`PlannerTrip.metadata`/`.scorecard`, `PlanGenerationJob.usage`/`.blockers`/`.decision_trace`).
- `backend/apps/planner/migrations/0019_jsonfield_decimal_encoder_remaining.py` (new) — encoder for the remaining 20 fields.

### Verification

- PASS — `python manage.py check`: no issues.
- PASS — `python manage.py makemigrations --check --dry-run`: no changes detected after both new migrations; migration diffs matched exactly the fields edited, nothing extra.
- PASS — shell introspection: `PlannerTrip`/`PlanGenerationJob` fields exist and are wired (checked after the first pass).
- PASS — shell introspection (final): all 25 targeted `JSONField`s across 11 models report `.encoder is DjangoJSONEncoder` (checked after the full sweep).
- PASS — stubbed `json.dumps(..., default=str)` and `json.dumps(..., cls=DjangoJSONEncoder)` calls against a `Decimal`-bearing payload shaped like the real crash data — both serialize correctly.
- **Not run, and not claimed:** an actual live generation against the real database/LLM/Celery worker. All verification above is static (checks, migration discovery, field introspection, stubbed serialization) per the owner's explicit constraint against large test suites and automated live runs. Only the owner's manual Phase B attempt can confirm the pipeline now completes.

### Remaining work / risks

- **Primary unknown:** whether generation now succeeds end-to-end. Three fixes addressed the same bug class (`Decimal` reaching code/fields that assume JSON-safe data) as it was discovered incrementally; it is possible but unconfirmed that all instances on the live code path are now closed. A fourth occurrence is plausible if there's a `Decimal`-carrying value flowing through a path not yet exercised (e.g. a different intent type, a different provider response shape).
- If Phase B still fails, get the **full traceback (top frames included)** before making another change — the last two rounds were diagnosed from truncated tail-only logs, which cost extra investigation.
- `apps/reference/models.py` `JSONField`s were intentionally left unguarded (see Current focus in `CURRENT_STATE.md`) — reasoned to be low-risk today, but worth remembering if a future defect traces there.
- Once the owner confirms a real successful generation (or reports a further blocker), update `docs/planner-complete-current-audit-and-repair-plan.md` §19/§20 and `CURRENT_STATE.md` per the existing Phase B → Phase C gate — do not advance to Phase C or any backlog item without that owner-provided runtime evidence.

### Next action

1. Owner retries Phase B: generate one full trip (with a budget set) and report the six items from `docs/planner-complete-current-audit-and-repair-plan.md` §20 — degraded flag, generated cities, real places, transport, latest-inputs-honored, persistence. If it still crashes, provide the complete traceback.

---

## Prior handoff

- Updated: **2026-07-18, Asia/Calcutta**
- Agent/platform: Codex
- Requested outcome: Create a platform-neutral workflow that lets any coding agent understand what exists, where development stands, and how to resume without losing or overriding work.
- Status: **Verified** for the continuity workflow; application work remains owner-gated.

### Completed

- Added a canonical repository contract in `AGENTS.md`.
- Added shared current-state, workflow, decision-log, and handoff documents under `docs/agent/`.
- Added thin instruction adapters for common coding-agent platforms so they all load the same canonical files.
- Added `scripts/agent_context.py`, a read-only, cross-platform startup summary.
- Documented the dirty-tree warning and the planner's Phase B runtime-verification gate.

### Changed files

- `AGENTS.md`: canonical rules, startup order, source precedence, and repository guardrails.
- `docs/agent/*`: shared continuity system.
- `scripts/agent_context.py`: read-only context/status command.
- `CLAUDE.md`, `GEMINI.md`, `.cursorrules`, `.windsurfrules`, `.clinerules`, `.github/copilot-instructions.md`: platform entry adapters.
- `README.md`: visible “coding agents start here” link.

### Verification

- PASS — `python scripts/agent_context.py`: resolves the repository, branch, commit, live status summary, current state, and handoff.
- PASS — link/path review: every adapter points to the canonical repository files.
- PASS — scoped diff review: workflow files only; no application code changed.

### Remaining work / risks

- Each future agent must update this handoff when it stops; the process cannot enforce truthful notes by itself.
- The application remains paused at the manual Phase B planner verification described in `docs/agent/CURRENT_STATE.md` and the detailed audit.
- Platform adapters are intentionally minimal; if a platform ignores its adapter, the README and root `AGENTS.md` remain the manual entry points.

### Next action

1. Run the Phase B real-trip verification checklist in `docs/planner-complete-current-audit-and-repair-plan.md`, then update `CURRENT_STATE.md` and this handoff with the observed evidence before choosing another planner repair.
