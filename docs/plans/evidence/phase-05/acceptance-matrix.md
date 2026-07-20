# Phase 05 Acceptance Matrix

Evidence in this folder was captured on 2026-07-20 as a **retroactive backfill**: the phase-05 implementation and verification reports (`docs/plans/phases/phase-05-*.md`) describe live-verification that was done but never saved as evidence files, unlike phases 00–04. Every row below was **freshly re-run** against the real dev DB (`localhost:5433`) for this pass, not copied from the reports' prose — see the linked JSON files for raw output.

| Criterion | Verdict | Evidence |
|---|---|---|
| `FareRule` model + additive migration | Passed | `0016_phase5_price_estimation.py` on disk; `manage.py check`/`makemigrations --check` both clean — `validation-trio-and-boundaries.json` |
| `price_estimator.estimate()` — all 7 categories dispatch correctly | Passed | `price_estimator_dispatch.json` — cab/bus/restaurant/hotel/food_daily/trip_day_budget all return real, correctly-shaped envelopes against real seeded data; train honestly returns `insufficient_data` (no FareRule seeded) |
| `seed_fare_rules` idempotent on re-run | Passed | `seed_fare_rules_run.json` — re-run reports `unchanged=3`, no duplication |
| Train/metro `FareRule` seeding | **Deferred, not a defect** | IRCTC's real distance-slab fares are only published as scanned/binary PDFs this session's tooling can't extract text from; `estimate_train()` correctly returns `insufficient_data` rather than a guessed number |
| `TravelPriceObservation` writer activates a previously-zero-writer model | Passed, live-demonstrated | `observation_writer_and_rollup.json` — a real `provider_registry.search('cab', ...)` call took the row count 0 → 2 |
| `rollup_price_summaries` produces a real `TravelPriceSummary` | Passed | `observation_writer_and_rollup.json` step 3 — 2 observations → 1 summary row |
| Cab benchmark origin_city/destination_city bug fix | Passed, re-proven directly | `observation_writer_and_rollup.json` step 4 — `estimate('cab', ..., city=<New Delhi>)` returns `method: "benchmark"`, confirming the summary row (keyed on `origin_city`) is now found |
| `live_price.py` hotel ladder fallback | Passed | `regression_checks.json` — unmatched destination now returns a real price-range-band envelope instead of `None` |
| `transport_compare.py` cab call-site switchover — no regression | Passed | `regression_checks.json` — New Delhi→Jaipur cab fare (₹4,885 for 286.54 km) exactly matches the old hardcoded formula's output |
| `conversation_engine.py` `NameError` bug fix | Passed | `regression_checks.json` — `recommended_budget_inr()` runs cleanly; grep confirms the dead duplicate/undefined names are gone from the file |
| `evaluate_price_estimators` — cold-start honesty | Passed | `evaluate_price_estimators.json` — real n=2 cab data correctly reports `cold_start`, not fabricated metrics |
| `evaluate_price_estimators` — "evaluated" branch math | **Not re-run this pass; code-reviewed instead** | `evaluate_price_estimators.json` — synthetic-volume injection needed to exercise this branch was blocked by the permission classifier as a bulk/fabricated write; source code read in full instead, confirms the statistics are computed for real (no stub) |
| Grep gate — all retired literals/constants absent | Passed | `grep-gate.json` — 5/5 patterns clean across the 4 touched files |
| `check_layer_boundaries` clean | Passed | `validation-trio-and-boundaries.json` — zero new violations, same 2 pre-existing Phase-1 allowlist entries |
| No paid API calls | Passed | UPSRTC fare page is a free public tariff notification; no Google/paid calls in any Phase 5 code path |
| Migration additive only | Passed | `0016_phase5_price_estimation.py` — new `FareRule` table + FK, no drops |
| Dev-DB hygiene | Passed | All test/synthetic rows created during this evidence pass deleted afterward — `evaluate_price_estimators.json` final-state block confirms `0`/`0`; only the real 3 `FareRule` + 9 `SourceRegistry` rows remain |
| A real, separate bug found while generating this evidence | N/A (not a formal criterion, recorded for completeness) | `apps/reference/services/live_price.py::_resolve_observation_fk`'s cab branch has the same unguarded `name__icontains` substring-collision pattern the Phase-5 report flagged (and a separate session already fixed) in `transport_compare.py` — see `regression_checks.json`'s `separate_pre_existing_bug_confirmed_still_present` block. Not fixed here; flagged as a follow-up. |

## Not independently re-verified by a second agent

Same caveat as phases 03–05's own reports: this backfill pass is self-verified, run by the same agent type (Claude Code) that built the phase. The owner may still want an independent review of the judgment calls documented in the implementation report (bus rate national-fallback, restaurant per-two unit scoping).
