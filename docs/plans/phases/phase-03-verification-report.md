# Phase 03 Verification Report

**Note on verification independence:** unlike Phase 00–02, this phase's verification
was performed by the same session that implemented it (no separate reviewer agent was
invoked). Every check below was re-run after the implementation was complete, but the
owner should treat this as a self-check, not an independently-authored review, and may
want a second pass.

## 1. Verdict

PASS WITH CONDITIONS

## 2. Repository state reviewed

Repository root `D:\Projects\NeuralNomad`, branch `main`, baseline commit
`a386842821d035337fa539b470418d1da101b06c`, plus the Phase 00–03 working-tree diff in a
heavily dirty pre-existing tree.

## 3. Scope review

Passed. Work is limited to `apps/reference/**` (models, one migration, new services/
commands), `scripts/` was not touched this phase, and `docs/**` continuity files. No
Phase 4 route-graph work, no Phase 5 pricing work, no knowledge/attractions app changes.
District/LGD crosswalk and full-village city creation were deliberately left out of
scope, as the packet stated in advance (not a silent scope-narrowing discovered after
the fact).

## 4. Changed-file review

Passed. All new files match the implementation packet's permitted-file list exactly
(§6). `apps/reference/models.py`, `admin.py`, and `serializers.py` carry additive-only
diffs (new classes/fields appended, nothing removed or restructured).

## 5. Acceptance matrix

See `docs/plans/evidence/phase-03/acceptance-matrix.md`. Two items are "Partial"/
"Measured, not targeted" rather than "Passed" — G4-specific coverage and G3/G5 targets —
exactly as the packet's own scoped-adjustment clause (§15) anticipated before any code
was written.

## 6. Validation rerun

- `python manage.py check`: Passed, clean.
- `python manage.py makemigrations --check --dry-run`: Passed, no changes detected.
- `python -m compileall apps config`: Passed, clean.
- `python manage.py check_layer_boundaries --json`: Passed, zero violations.
- Idempotence re-run of `import_ourairports --dry-run`: Passed, `updated=0`.
- Idempotence re-run of `import_geonames --dry-run` (post-fix): Passed for
  `new_cities_created`/`districts_created` (both 0); alias count does not reach 0 by
  design (see implementation report §9) — this is a documented, deliberate bound, not
  a failure.

## 7. Migration safety

Passed. `0014_phase3_source_registry` is additive only (7 new tables, 9 new nullable
columns/indexes), applied cleanly, and is reversible without any data-loss risk beyond
the new tables/columns themselves.

## 8. Data safety

Passed with a noted operational incident. Row-count diff proves zero deletions
(`before_row_counts.json` vs `final_row_counts.json`): City +80 only (bounded
creation), Airport/RailwayStation unchanged. One operational incident occurred and is
fully explained, not hidden: a concurrent background run of `import_geonames --apply`
and `import_wikidata_crossids --apply` appeared to leave two `ImportBatch` rows stuck
mid-run when checked partway through; both processes' own finalization code completed
correctly moments later (confirmed by final DB state — both batches ended
`status="completed"` with a real `finished_at`), and every write involved was an
idempotent upsert, so no data was corrupted by the overlap. Recorded as an operational
lesson (verify completion by output content, not merely process-absence, before
declaring a background command finished) rather than a data-safety defect.

## 9. Architecture boundaries

Passed. `check_layer_boundaries` remains green with the same two Phase-1-documented
geocoding exceptions; no new import from `apps.reference` into `apps.planner` or
`apps.knowledge` was introduced. All new services/commands are self-contained within
`apps/reference`.

## 10. Functional correctness

Passed, with two real bugs found and fixed during this phase's own idempotence
verification (not shipped uncorrected): `import_geonames`'s dry-run path under-queried
existing state for both alias-creation and new-city-creation checks, causing its
preview counts to overstate what a real apply would do. Both were fixed by always
querying existing state regardless of `--dry-run`/`--apply`, gating only the actual
write on `--apply`. Verified via a clean re-run after the fix (§6). A second, smaller
finding — 4 pre-existing duplicate `State` rows under different name-punctuation
conventions, discovered while building the GeoNames admin1-code crosswalk — was fixed
within `import_geonames`'s own state-resolution logic (prefer the duplicate with more
attached cities) so this phase's District/City-state assignment is correct, but the
underlying duplicate `State` rows themselves were **not** merged or deleted (out of
scope; flagged for a future cleanup in the implementation report §16 and
`CURRENT_STATE.md`).

## 11. Performance results

Passed. PostGIS checkpoint (§8.4): 32,609 total publishable point entities, 9.946 ms
overall p95 across three real city-center benchmarks, max bbox candidate set 199 rows —
all four adoption triggers false, recommendation "defer". This is a fresh Phase-3-actual
measurement (not reused from Phase 2), as Phase 2's own report required.

## 12. Security and licence review

Passed. GODL-India licence fetched and read in full this session (previously
`[UNKNOWN]`) — commercial use, redistribution, and adaptation are explicitly permitted
with attribution required; none of the licence's exemptions apply to the data this
plan uses. GeoNames/OurAirports/Wikidata licences were already verified before this
phase and are unchanged. No credential was logged or committed; the `pg_dump` backup
and raw source downloads live outside the repository. Zero paid API calls.

## 13. Defects

- Critical: none.
- High: none.
- Medium: two dry-run accounting bugs in `import_geonames` (found and fixed this
  session, verified via idempotence re-run — see §10).
- Low: 12 City + several RailwayStation cross-id resolutions differing between
  independent passes over the identical source file (safely flagged as
  `identity_conflict`, root cause not tracked down); 4 pre-existing duplicate `State`
  rows (flagged, not merged, zero blast radius since the duplicates hold no cities);
  ~1,035 GeoNames aliases remain creatable under the deliberate per-run cap.

## 14. Scope violations

None. District/LGD crosswalk and full-village city creation were pre-declared
out-of-scope in the implementation packet, not discovered-and-narrowed after the fact.

## 15. Required corrections

None blocking. Recommended before Phase 4: (a) a human pass through
`merge_reference_entities --keep-pk --merge-pk` (preview mode) against the 6
duplicate-candidate pairs in report 3; (b) one or two more `import_geonames --apply`
passes to continue alias saturation; (c) investigate the 12-city/railway-station
cross-id non-determinism if it recurs at larger scale; (d) a separately-scoped cleanup
of the 4 duplicate `State` rows (safe — the duplicates have zero attached cities).

## 16. Merge recommendation

Safe to continue toward Phase 4, with the above non-blocking follow-ups noted. Phase
0's owner key-rotation condition remains open and unrelated to this phase.

## 17. Evidence index

- `docs/plans/evidence/phase-03/backup-confirmation.md`
- `docs/plans/evidence/phase-03/licence-verification.md`, `godl-license-text.txt`
- `docs/plans/evidence/phase-03/before_row_counts.json`, `final_row_counts.json`
- `docs/plans/evidence/phase-03/audit_before_phase3.json`, `audit_after_phase3_final.json`
- `docs/plans/evidence/phase-03/apply_ourairports.json`, `apply_geonames.json`,
  `apply_geonames_pass2.json`
- `docs/plans/evidence/phase-03/recompute_completeness.json`
- `docs/plans/evidence/phase-03/postgis_checkpoint.json`
- `docs/plans/evidence/phase-03/acceptance-matrix.md`

PHASE VERIFICATION COMPLETE
