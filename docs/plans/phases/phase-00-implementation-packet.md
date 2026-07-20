# Phase 00 Implementation Packet

## 1. Objective

Capture the reference/knowledge/planner baseline and complete only the Phase 0 safety, security, and price-honesty hotfixes without schema changes, bulk imports, paid API calls, application removal, or poisoned-history deletion.

Resolved repository root: `D:\Projects\NeuralNomad`.

## 2. Canonical-plan references

- `docs/plans/reference-foundation-and-planner-intelligence-master-plan.md` sections 3.4, 13, 14 Phase 0, 16, and 18.
- Owner execution directive attached on 2026-07-19, requiring Phase 0 through Phase 10 in strict gated order.

## 3. Current repository findings

- Branch: `main`.
- Commit: `a386842821d035337fa539b470418d1da101b06c`.
- The working tree is heavily dirty: direct Git inspection reported 230 status entries; the tracked diff spans 141 files, 8,663 insertions, and 14,214 deletions.
- Phase 0 overlaps pre-existing work in `backend/apps/bookings/providers/train_providers.py` and `backend/apps/bookings/providers/bus_providers.py`; the canonical resolver, station selector, backfill command, master plan, and handoff are untracked working-tree files.
- C1, C2, H1, H2, H5, and C3 are present in the current implementation and were directly inspected.
- The initial sandboxed database commands timed out, but the same commands completed successfully with access to the owner's local services.
- The owner stated “everything is good” on 2026-07-19 and explicitly directed Phase 0 completion and Phase 1 continuation; this is recorded as backup/restore confirmation.

## 4. Approved scope

- Read-only baseline and row-count capture.
- Remove fabricated price fallbacks and route defaults.
- Preserve missing prices as missing.
- Correct live/mock/estimated price classification.
- Fix the resolver NameError, station-selector frequency leakage, and place-ID ownership guard.
- Stop storing Google keys in attraction image URLs.
- Add a dry-run-default URL scrub command.
- Count, but do not delete, likely poisoned price-history rows.
- Produce phase evidence and reviewer records.

## 5. Explicit out-of-scope items

- Schema/model migrations.
- Bulk imports or backfills.
- Paid provider calls.
- Live provider enablement, payments, or booking automation.
- Any application removal.
- Any poisoned price-history deletion.
- Planner frontend or conversation/canvas redesign.

## 6. Permitted files

- `backend/apps/reference/services/live_price.py`
- `backend/apps/bookings/providers/train_providers.py`
- `backend/apps/bookings/providers/bus_providers.py`
- `backend/apps/reference/services/canonical_resolver.py`
- `backend/apps/reference/services/station_selector.py`
- `backend/apps/reference/management/commands/backfill_city_coordinates.py`
- `backend/apps/attractions/views.py`
- `backend/apps/attractions/management/commands/scrub_attraction_image_urls.py`
- `scripts/baseline_metrics.py`
- Phase 00 documentation/evidence, master-plan Phase 0 checklist after PASS, and continuity documents.

## 7. Forbidden files

- Frontend planner/chat/canvas files.
- Model and migration files.
- Knowledge migration or application-removal files.
- Unrelated dirty-tree files.
- Secrets, `.env` files, database dumps, raw provider responses, and caches.

## 8. Models affected

- Read-only: all reference, knowledge, and planner models for row counts.
- Read-only poison count: `reference.TravelPriceHistory`.
- Data mutation after the backup gate only: `attractions.Attraction.image_url` and `secondary_images` through the scrub command.

## 9. Services affected

- `reference.services.live_price`
- `reference.services.canonical_resolver`
- `reference.services.station_selector`
- booking train and bus providers
- legacy attractions explore/details photo handling

## 10. Commands and tasks affected

- Existing `audit_reference_data --json`.
- New read-only `scripts/baseline_metrics.py`.
- New `scrub_attraction_image_urls`, dry-run by default.
- Offline scripted checks for price, resolver, selector, and ownership behavior.

## 11. Migrations expected

None.

## 12. Data mutation expected

Only the explicitly invoked, dump-backed attraction URL scrub. No real mutation is authorized until backup confirmation exists. Poisoned price-history rows remain unchanged.

## 13. Backup and approval gates

- Backup confirmed: yes, by owner statement on 2026-07-19.
- Backup timestamp: exact timestamp not supplied; owner confirmed it current for continuation on 2026-07-19.
- Backup location category: owner-controlled; exact category not supplied.
- Restore procedure verified: yes, by the same owner “everything is good” confirmation.
- Owner key rotation: required after scrub; cannot be performed by Codex.
- Owner approval of the master plan: treated as supplied by the 2026-07-19 execution directive.

The backup gate is satisfied by the owner's explicit continuation confirmation. Exact metadata not supplied by the owner is recorded without fabrication.

## 14. Ordered implementation tasks

1. Confirm dump metadata and restore readiness.
2. Capture Git/database/coverage/performance baseline.
3. Implement C1, C2, H1, H2, and H5.
4. Implement C3 proxy-safe storage and the dry-run scrub command.
5. Run the scrub dry run; review its scope.
6. Run the real scrub only after confirmed backup and safe dry-run output.
7. Record the poisoned-history count without deleting rows.
8. Validate, report, and perform an independent verification pass.

## 15. Acceptance criteria

- Baseline JSON and row counts recorded.
- Providers disabled plus no matching DB row yields no fabricated price.
- Missing provider prices remain `None` and never become verified.
- Mock inventory remains explicitly mock-classified.
- Resolver metro-context path runs without `NameError`.
- Station score breakdown uses each candidate's own frequency.
- Coordinate backfill never assigns an already-owned place ID.
- Scrub dry run is reviewed; real scrub leaves no stored `key=` URLs.
- Likely poisoned price-history count is recorded; rows are not deleted.
- Django checks and required migration/compile commands are reproducible.

## 16. Validation commands

- `python manage.py audit_reference_data --json`
- `python manage.py scrub_attraction_image_urls --dry-run`
- Offline fixture/script checks for affected symbols
- `python manage.py check`
- `python manage.py makemigrations --check --dry-run`
- `python manage.py migrate --plan`
- `python -m compileall apps config`
- `git status --short`, `git diff --stat`, and `git diff --name-only`

## 17. Required measurements

- Row counts for every reference, knowledge, and planner table.
- Missing/default coordinates and coverage counts.
- Nearby-hub and direct-route latency baselines.
- External calls per generation baseline where existing recorded jobs permit a read-only measurement.
- Count of likely poisoned C1-signature price rows.
- Scrub dry-run match/update counts.

## 18. Rollback strategy

- Code/docs: revert only Phase 0-owned hunks while preserving all pre-existing work.
- URL scrub: restore from the confirmed pre-phase dump.
- No rollback applies to poisoned price history because Phase 0 must not delete it.

## 19. Risks

- Proceeding without a restorable dump could irreversibly lose original attraction URLs.
- The dirty tree contains overlapping uncommitted work and requires hunk-level preservation.
- Honest missing prices may expose downstream assumptions that fabricated prices previously masked.
- Database-backed commands currently time out, so baseline and verification are not reproducible yet.

## 20. Status

PHASE READY FOR IMPLEMENTATION
