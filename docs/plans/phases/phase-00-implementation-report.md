# Phase 00 Implementation Report

## 1. Objective

Capture the repository/database baseline and remove Phase 0 price-fabrication, classification, resolver, selector, coordinate-backfill, and attraction-image security defects from repository root `D:\Projects\NeuralNomad`.

## 2. Scope implemented

- Captured table, coordinate, poison-signature, generation-usage, direct-route, and nearby-hub baselines.
- Removed DEL/BOM/Mumbai default provider parameters and the 850/1500/5000 price fallbacks.
- Made providers-disabled and provider-price-missing paths return an honest miss.
- Kept mock inventory explicitly classified as `mock_data`/`estimated`.
- Removed live train fare literals and live bus fare defaults.
- Fixed canonical resolver metro-context `Q` usage.
- Fixed station-selector score breakdown to use candidate-local frequency.
- Added the place-ID ownership guard to the reference coordinate command.
- Replaced stored key-bearing attraction photo URLs with backend proxy URLs.
- Added and applied a dry-run-default scrub command after an expected 35-row preview.
- Counted likely poisoned price-history rows; zero matched and none were deleted.

## 3. Files changed

- `backend/apps/reference/services/live_price.py`
- `backend/apps/bookings/providers/train_providers.py`
- `backend/apps/bookings/providers/bus_providers.py`
- `backend/apps/reference/services/canonical_resolver.py`
- `backend/apps/reference/services/station_selector.py`
- `backend/apps/reference/management/commands/backfill_city_coordinates.py`
- `backend/apps/attractions/views.py`
- `backend/apps/attractions/management/__init__.py`
- `backend/apps/attractions/management/commands/__init__.py`
- `backend/apps/attractions/management/commands/scrub_attraction_image_urls.py`
- `scripts/baseline_metrics.py`
- `docs/plans/phases/phase-00-implementation-packet.md`
- `docs/plans/phases/phase-00-execution-blocker.md`
- `docs/plans/phases/phase-00-implementation-report.md`
- `docs/plans/phases/phase-00-verification-report.md`
- `docs/plans/evidence/phase-00/**`
- `docs/agent/CURRENT_STATE.md`
- `docs/agent/HANDOFF.md`

## 4. Models changed

None.

## 5. Services changed

- `lookup_live_price`: honest provider gate, explicit payload-price extraction, live/mock classification.
- Live train/bus provider adapters: missing fare stays missing; mock prices remain mock-labeled.
- Canonical resolver and station selector: Phase 0 correctness fixes.
- Legacy attraction endpoint: server-side photo proxy and safe stored URLs.

## 6. Commands and tasks changed

- Added `scrub_attraction_image_urls` with dry-run default and explicit `--apply`.
- Added read-only `scripts/baseline_metrics.py`.
- Updated `backfill_city_coordinates` ownership safety.

## 7. Migrations created

None. `makemigrations --check --dry-run` reports no changes; `migrate --plan` reports no operations.

## 8. Data affected

- Before: 35 attraction rows; all 35 primary URLs and 17 secondary URLs required safe conversion.
- After: 35 attraction rows; zero primary/secondary stored URLs contain `key=`.
- No attraction rows inserted or deleted.
- `TravelPriceHistory`: 123 before and after; zero poison-signature matches; zero deletions.

## 9. Dry-run results

Initial preview: 35/35 rows affected, 35 primary and 17 secondary URLs convertible, zero unrecoverable URLs. Post-apply preview: zero rows requiring changes.

## 10. Validation results

- Baseline audit: Passed.
- Baseline metrics: Passed.
- Targeted Phase 0 behavior check: Passed.
- Scrub dry run/apply/idempotence: Passed.
- `python manage.py check`: Passed.
- `python manage.py makemigrations --check --dry-run`: Passed.
- `python manage.py migrate --plan`: Passed.
- `python -m compileall apps config`: Passed.
- Existing reference scenario tests: Passed, 3 tests.
- Paid API validation: Not run, by design.

## 11. Acceptance matrix

- Baseline JSON: Passed — `docs/plans/evidence/phase-00/baseline.json`.
- Performance baseline: Passed with a documented no-route-data limitation.
- C1/C2/H1/H2/H5/C3: Passed — code diff and validation output.
- Scrubbed URLs contain no key: Passed — after counts and shell query.
- Poison signature reported without deletion: Passed — count 0.
- Django checks: Passed.

## 12. Performance results

- Nearby-hub lookup: median 2.101 ms, p95 3.45 ms, max 12.825 ms over 25 reads.
- Direct-route lookup: not measurable because all three route tables currently have zero rows.
- Generation external-call baseline: 50 jobs sampled; current usage payloads contain no explicit call-count fields.

## 13. Compatibility and feature flags

- `LIVE_PROVIDERS_ENABLED=False` now guarantees no provider lookup through `live_price`.
- Existing result envelopes remain compatible; missing prices stay missing.
- Legacy attraction clients continue receiving image URL strings, now pointing to the backend proxy.

## 14. Security and licensing impact

- Google keys are no longer persisted in newly generated legacy attraction URLs.
- Existing 35 rows were scrubbed with zero unrecoverable images.
- Google key rotation remains an owner action and is recorded as such.
- No paid API or licence-gated import was used.

## 15. Rollback procedure

- Revert only the Phase 0-owned code hunks while preserving pre-existing work.
- Restore original attraction URLs from the owner-confirmed dump if rollback is required.
- No price-history rollback is needed because no row was deleted.

## 16. Remaining issues

- Owner must rotate the previously exposed Google key.
- Direct-route latency has no baseline until route rows exist.
- Generation usage rows do not currently expose external-call counters.
- The 8,634 India-centroid city rows are a Phase 2 geospatial task, not Phase 0 mutation scope.

## 17. Independent verification requirements

- Re-read the packet/report/diff/evidence.
- Rerun Django checks, migration checks, compile, targeted behavior checks, scrub idempotence, secret grep, and scope review without modifying production code.

## 18. Repository state

- Branch: `main`.
- Commit: `a386842821d035337fa539b470418d1da101b06c`.
- Working tree remains heavily dirty with substantial pre-existing work.
- Phase 0-owned product changes are limited to the exact files listed in section 3.
- Generated evidence is under `docs/plans/evidence/phase-00/`.

IMPLEMENTATION READY FOR VERIFICATION
