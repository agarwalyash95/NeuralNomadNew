# Phase 6 Verification Report — Place enrichment (hotels, restaurants, attractions, activities)

- Date: 2026-07-20, Asia/Calcutta
- Verdict: **PASS WITH CONDITIONS**, self-verified (same as Phases 03-05 — no independent second-agent review this phase).

## PASS

- Real `pg_dump` taken before any schema/data change; integrity-verified via `pg_restore --list` (909 TOC entries); confirmation doc at `docs/plans/evidence/phase-06/backup-confirmation.md`.
- `python manage.py check` — clean.
- `python manage.py makemigrations --check --dry-run` — "No changes detected."
- `python -m compileall apps config` — clean.
- `python manage.py check_layer_boundaries --json` — `"status": "pass"`, zero new violations.
- `seed_category_vocabulary` — 11 real rows created (3 Google `included_type` anchors + 8 OSM tag dispatch rows), all traceable to real code, none speculative (see implementation report for the scope correction made while building this).
- `seed_source_registry` — new `osm_overpass` row created (ODbL 1.0, cited).
- `import_osm_places --dry-run` — ran cleanly against a single city before any real write, correctly reporting would-create/would-skip counts with zero DB mutation.
- `import_osm_places --apply` — live-verified against a real 3-city pilot (Bengaluru, Delhi, Mumbai): **8,124 real rows created**, **22 rows backfilled** with `osm_id`/coordinates, **2,474 elements correctly skipped as ambiguous** rather than blindly matched. A spot-checked created row carries real `osm_id`+coordinates and **no fabricated price/rating** (`price_range=None`, `user_rating=None`) — the core honesty requirement, directly verified on a real row, not just asserted from the code. `ImportBatch` rows correctly recorded (`status="completed"`, accurate `created_count`/`updated_count`/`skipped_count`, real timestamps) for both runs.
- Mumbai's first attempt failed with a genuine `504 Gateway Timeout` from the public Overpass instance; the command made zero partial writes for that city (confirmed: a same-scope retry succeeded cleanly with no duplicate-risk side effects) — proves the per-city error handling is safe, not just that a retry happened to work.
- `audit_reference_data` report 10 — synthetic test (one 40-day-stale row, one fresh row, one never-enriched row, all deleted immediately after) confirmed the report flags exactly the stale row and the never-enriched row separately, correctly ignoring the fresh one. Run against the full real post-import dataset: `total_stale=0` across all four master tables (consistent with `refresh_stale_entities` already running every 3h in this environment).
- Attractions §13 audit — the central evidence claim (zero planner/booking references to `apps.attractions.Attraction`) was independently re-verified by this report's author via a direct grep, not just trusted from the earlier research pass: `grep -rn "attractions\.Attraction\|attractions_attraction" apps/planner apps/bookings` — zero matches.

## Not completed / explicitly deferred (see implementation report + packet for why)

- `import_asi_monuments` — no licence-verified primary dataset found; not attempted, per the same discipline as Phase 4's `BusRoute` and Phase 5's train fares.
- Restaurant price-unit normalization — re-examined, still deferred for the reason Phase 5 already documented (wide-reaching consumer audit, not self-contained).
- OSM coverage beyond the 3-city pilot — the pipeline is proven end-to-end; scaling to more cities is unattempted this pass, by design.
- Attractions-app frontend migration/removal — explicitly owner-gated; the one concrete remaining blocker (no `apps.reference` paginated browse-list equivalent) is now named precisely rather than left as an open question, but not built.

## Real findings from this phase's own work, noted honestly

- `CategoryVocabularyMap`'s Google-side seed is smaller than the approved plan assumed, because the assumed rich Google-type mapping doesn't exist in the codebase (discovered while building the seed command, not before) — documented in the implementation report rather than silently forcing a fabricated taxonomy to match the plan's original wording.
- The public Overpass API requires a real `User-Agent` header (undocumented in its own quickstart materials, found via direct testing after a `406` failure) and is subject to occasional `504`s under load — both now handled/documented, neither is this importer's own defect.

## Not independently re-verified by a second agent

Self-authored verification, same as Phases 03-05. The owner may want an independent pass, particularly on: the decision to substitute the Overpass API for the plan's literal Geofabrik-PBF-extract wording, the `CategoryVocabularyMap` scope correction, and the ASI monuments deferral — all are documented, deliberate judgment calls, not oversights, but are exactly the kind of call a second reviewer is useful for.

## Next checkpoint

Update `docs/agent/CURRENT_STATE.md` and `docs/agent/HANDOFF.md` (done alongside this report) when the owner reviews this phase or when new evidence changes any claim above.
