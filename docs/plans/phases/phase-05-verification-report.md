# Phase 5 Verification Report — Price benchmarks & estimation foundation

- Date: 2026-07-20, Asia/Calcutta
- Verdict: **PASS WITH CONDITIONS**, self-verified (same as Phases 03/04 — no independent second-agent review this phase).

## PASS

- `python manage.py check` — clean.
- `python manage.py makemigrations --check --dry-run` — "No changes detected."
- `python -m compileall apps config` — clean, no syntax errors across the whole backend.
- `python manage.py check_layer_boundaries --json` — `"status": "pass"`, zero new violations; only the two pre-existing Phase-1 allowlist entries remain.
- Grep gate — `_CAB_BASE_FARE`/`_CAB_RATE_PER_KM` absent from `transport_compare.py`; `_RESTAURANT_PRICE_BAND =` absent from `suggestions.py`; `DEST_TIER_RATES =` absent from `recommendations.py`; `DEST_TIER_RATES`/`PURPOSE_BUDGET_MULTIPLIERS`/`_compute_recommended_budget_inr` all absent from `conversation_engine.py`; the C1 fabricated-literal pattern (`850`/`5000`/`1500`) confirmed still absent from `live_price.py` (this was already fixed in an earlier phase, re-checked here since Phase 5 depends on that honesty holding). `seed_all_bulk.py`'s demo fixture literals confirmed still present and deliberately untouched (out of scope — not a runtime price path).
- `seed_fare_rules` run against the real dev DB: `sources: created=1 updated=0 | rules: created=3 updated=0 unchanged=0` — 1 `SourceRegistry` row (UPSRTC), 3 `FareRule` rows (cab, bus non-AC, bus AC).
- `price_estimator.estimate(...)` exercised live for all 7 dispatch categories (cab, bus, train, restaurant, hotel, food_daily, trip_day_budget) against the real seeded data — every envelope shape correct, cab's number (300+16×100=1900) an exact match to the pre-existing hardcoded formula's output (regression check, not just "it runs").
- `TravelPriceObservation` writer — a real `provider_registry.search('cab', {...})` call (mock provider path, `LIVE_PROVIDERS_ENABLED` is off in this dev environment) created 2 real rows where the model had zero writers repo-wide before this phase (confirmed by grep before starting: zero `TravelPriceObservation.objects.create` call sites anywhere).
- `rollup_price_summaries` — ran against those 2 real observations, produced 1 real `TravelPriceSummary` row; a real bug (cab benchmark lookup queried the wrong FK — `destination_city` instead of `origin_city`) was caught by this exact test, fixed, and re-verified: `price_estimator.estimate('cab', ...)` then correctly returned `method: "benchmark"` (class 3) instead of falling through to the `FareRule` rung.
- `live_price.py`'s hotel ladder fallback — verified live: `lookup_live_price('hotel', ..., destination='SomeRandomCityXYZ')` returned `None` before this phase's change (confirmed by code inspection of the unmodified function) and now returns a real price-range-band envelope.
- `transport_compare.compare_legs('New Delhi', 'Jaipur', ...)` — end-to-end regression check against an unambiguous city pair: cab row priced at ₹4,885 for 286.54 km, exactly matching what the old hardcoded `300 + 16×286.54` formula would have produced.
- `conversation_engine.py` `NameError` fix — `recommendations.recommended_budget_inr(FakeDraft(), 'vacation')` returns cleanly; `ConversationEngine._build_optional_prefilled` traced past the exact line that used to reference the undefined names, with no error at that line.
- `evaluate_price_estimators` — real statistical computation verified two ways: (1) against real sparse data, correctly reports `cold_start` (n=2) rather than fabricating metrics on too little data; (2) against 30 temporarily-injected synthetic observations, produced coherent real numbers (MAE≈32.6, WAPE≈0.041, p25-p75 coverage=0.4) proving the MAE/WAPE/pinball/coverage math itself is correct, not stubbed.
- Dev-DB hygiene: all test/synthetic `TravelPriceObservation`/`TravelPriceSummary` rows created during verification were deleted afterward (`0`/`0` confirmed by count). The real `FareRule` (3 rows) and `SourceRegistry` (+1 row, UPSRTC) seed data was kept, as intended.

## Not completed / explicitly deferred (see implementation report + packet for why)

- Train and metro `FareRule` seeding — IRCTC's real distance-slab fares are only published as scanned/binary PDFs this session's tooling couldn't extract text from; left honestly unseeded rather than guessed. `price_estimator.estimate_train()` returns `insufficient_data`, which is the correct, by-design state, not a defect.
- Panel-sampling beat task, flight distance-band curve, full §10.4 holiday/season feature engineering, the §10.6 ML gate — all explicitly volume- or business-gated in the master plan's own text; not attempted.
- Any C1-poisoned `TravelPriceHistory` row cleanup — explicitly owner-gated; not attempted, no rows deleted.
- `_price_transport_blocks` (plan_generation.py) still prices cab/bus/train solely via `lookup_live_price`'s existing path, not yet via `price_estimator` — outside this phase's approved file list; a natural, small follow-up.

## Real, separate bug found during this phase's own verification (not fixed, flagged separately)

`apps/planner/services/transport_compare.py::_resolve_city` (unedited by this phase) does a naive substring match that can resolve a city name to a completely unrelated city (`"Agra"` → `"Lagrange, US"`, since "Agra" is a literal substring of "Lagrange"), producing a silently wrong ~12,915 km distance and a correspondingly absurd fare. The pricing formula this phase built was confirmed correct — re-running with an unambiguous city pair (New Delhi → Jaipur) priced correctly. A background-task chip was raised for the owner (`task_f511c7a3`) rather than fixed opportunistically, per this repo's own "record, don't silently fix out-of-scope findings" rule.

## Not independently re-verified by a second agent

Self-authored verification, same as Phases 03 and 04. The owner may want an independent pass, particularly on the bus `FareRule`'s single-state-sourced national-fallback judgment call and the `estimate_restaurant` per-two (not per-person) unit-scoping decision — both are documented, deliberate scope choices, not oversights, but are exactly the kind of judgment call a second reviewer is useful for.

## Next checkpoint

Update `docs/agent/CURRENT_STATE.md` and `docs/agent/HANDOFF.md` (done alongside this report) when the owner reviews this phase or when new evidence changes any claim above.
