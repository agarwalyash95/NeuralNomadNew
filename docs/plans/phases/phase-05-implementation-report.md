# Phase 5 Implementation Report — Price benchmarks & estimation foundation

- Date: 2026-07-20, Asia/Calcutta
- Agent/platform: Claude Code (Sonnet 5)
- Status: **Complete, self-verified — PASS WITH CONDITIONS** (see `phase-05-verification-report.md`). Train/metro fare data and one pre-existing unrelated bug are the two open items.

## What was built

### 1. `FareRule` model (`backend/apps/reference/models.py`, migration `0016_phase5_price_estimation.py`, additive)

`category` (train/bus/cab/metro), `scope`/`city`/`service_class` for granularity, `params` JSON, `unit`, `valid_from`/`valid_to`, `source` FK to `SourceRegistry` (nullable), and the exact same 6-value `provenance_tier`/`confidence`/`freshness_at`/`is_active` fields `_RouteFactsMixin` established for Phase 4's route models — one provenance vocabulary across the reference app, not a per-model reinvention. `_RouteFactsMixin`'s own docstring had explicitly deferred a `fare_rule` concept to this phase.

Registered in `admin.py` and `serializers.py` following the exact pattern every prior reference model uses.

### 2. `reference/services/price_estimator.py` (new)

One `estimate(service_type, **params)` dispatch returning a uniform envelope `{min, expected, max, currency, unit, confidence, method, freshness, taxes_included, assumptions[], live_available, provenance}` — `provenance` is an added convenience field using the app's existing 3-tier display vocabulary (`apps.common.provenance`) so callers can use the result exactly like a `live_price` result.

Per-category ladder, implemented and verified against real seeded data:
- **cab/bus**: `TravelPriceSummary` benchmark (class 3) first, then `FareRule` rate-card (class 1/2), then honest `insufficient_data`.
- **train**: same ladder shape, but with zero seeded `FareRule` rows this phase — honestly returns `insufficient_data` today (see §4 below for why).
- **hotel**: `TravelPriceHistory` DB-median first (same pattern `recommendations.median_hotel_price_per_night` already used, reimplemented here since reference cannot import planner — D-004), then a `price_range`-tier band.
- **restaurant**: the exact `price_level`→INR band `suggestions.py` used to own privately, now the estimator's home. Unit is `per_two` (matching the real shape of the existing data), not the master plan's per-person ideal — a deliberate, narrower scope than a full per-person unit migration, which would have required auditing every consumer of the field for a multiplier assumption. Documented, not silently done.
- **food_daily** / **trip_day_budget**: the exact ₹1500/day rule-of-thumb and 5-tier destination heuristic `recommendations.py` used to own privately (and `conversation_engine.py` half-owned, broken — see §4), now one source.

### 3. `seed_fare_rules` command

- **cab**: ₹300 base + ₹16/km — the exact number already live in `transport_compare.py`, moved into a `FareRule` row (zero fabrication risk, it's literally today's shipped number). `provenance_tier=derived`, `confidence=0.6`.
- **bus**: UPSRTC's own published fare-calculation page (`upsrtc.up.gov.in/en/article/fare-calculation`, fetched 2026-07-19), non-AC ₹1.30/km and AC (2x2) ₹1.94/km, applied as a **national fallback** since no all-India per-km bus rate exists. `confidence=0.35` (deliberately discounted: a single state's rate stands in for a national default, and the source page's own stated effective window, 2024-12-25 to 2025-02-28, has since lapsed without a re-check — both caveats are in the `FareRule.name` field and this report).
- **train**: **not seeded.** IRCTC's real distance-slab base fares (most recent rationalization: circular CC 11/2025, effective 2025-07-01) are only published as scanned/binary PDF documents. Both the circular PDF (10MB+, exceeded the fetch tool's size limit) and a smaller "fare table" PDF (3.5MB, fetched successfully but contains no extractable text — a scanned/image document) were tried; the PDF page-render tool (`pdftoppm`/poppler) isn't installed in this environment either. Rather than transcribe distance-slab figures from training-data memory into something presented as a sourced, dated fact, this was left unseeded. `price_estimator.estimate_train()` honestly returns `insufficient_data` until a future session either OCRs the PDF or finds an HTML-published equivalent.
- **metro**: not seeded — no clean, obviously-sourceable flat-fare table surfaced during the research pass; not a blocking item per the packet's own scope.

### 4. `TravelPriceObservation` writers — activating a model that had zero writers anywhere in the codebase

Confirmed via grep before starting: `TravelPriceObservation.objects.create` had **zero call sites** repo-wide, despite the model, its admin registration, and its serializer all existing already. Two writers added:
- `ProviderRegistry.search()` (`apps/bookings/providers/registry.py`) — the single funnel point all 3 existing call sites (`bookings/views.py`, `live_price.py`, `journey_resolver.py`) already pass through. One hook right after result normalization, tagging `source_type="live_api"`/`"provider_cache"` from the same live/mock distinction `live_price.py` already makes for `TravelPriceHistory`. Service-type aliases (`flights`→`flight`, `taxi`→`cab`, etc.) are normalized against the model's actual 5-value choice set; anything unrecognized (e.g. `journey_resolver`'s non-price modes like `walking`) is skipped rather than written with an invalid category.
- `live_price.py`'s existing `TravelPriceHistory.objects.create(...)` call now also writes a paired `TravelPriceObservation` — same event, two purposes (History is the display-facing cache; Observation feeds the rollup/benchmark ladder).

**Live-verified**, not just statically reviewed: a real `provider_registry.search('cab', {...})` call (mock provider, since `LIVE_PROVIDERS_ENABLED` is off in this environment) created 2 real `TravelPriceObservation` rows where before this phase there would have been none, ever. Test rows were deleted after verification — see the verification report.

### 5. `rollup_price_summaries` command

Python-side quantile grouping (appropriate at today's near-zero volume; a DB-side rewrite is a reasonable follow-up once real volume exists) by `(service_type, origin_city, destination_city, month)`. Confidence is deliberately capped low and scaled by sample size (`min(0.9, 0.2 + 0.05*n)`) — never inflated to look mature, per §10.5's calibration rule.

**Known limitation, not fixed this phase**: `TravelPriceSummary` (which predates Phase 5) has no `year` field alongside `month`, so same-month observations from different years would collapse together once real multi-year history exists. Flagged for whoever adds real seasonal history; not a Phase 5 regression.

**A real bug was found and fixed while wiring this up**: `price_estimator.estimate_cab()`'s benchmark lookup initially queried `TravelPriceSummary.destination_city`, but cab observations resolve their city FK to the *origin* (pickup city) per `_resolve_observation_fk`'s cab branch — so a real seeded cab summary was silently never found. Caught by testing against real rolled-up data (not just unit-level mocks), fixed to query `origin_city` for cab, re-verified.

### 6. `live_price.py` ladder refactor

A `price_estimator` fallback rung added at all 3 "give up" points inside `lookup_live_price` (`LIVE_PROVIDERS_ENABLED` off; live fetch returned nothing; live fetch returned no extractable price) — wired for **`hotel` only**. Cab/bus/train need caller-supplied `distance_km`, which `lookup_live_price`'s signature never receives and which `reference` cannot compute itself (`DistanceService` is planner-owned; D-004 forbids reference importing planner). Those categories are switched onto `price_estimator` at their own call sites instead, where distance is already known (see §7). `_price_transport_blocks` in `plan_generation.py` was deliberately **not** touched this phase (not in the approved plan's file list) — its cab/bus/train pricing still depends solely on `lookup_live_price`'s existing TravelPriceHistory/live-provider path, unchanged.

**Live-verified**: with `LIVE_PROVIDERS_ENABLED=False` and no matching history, `lookup_live_price('hotel', ..., destination='SomeRandomCityXYZ')` used to return `None`; it now returns a real price-range-band estimate (`{'price': 'Rs 3,000/night', ...}`).

### 7. Planner call-site switchovers

- **`transport_compare.py`**: the cab row's inline formula replaced with `price_estimator.estimate("cab", ...)`; `_CAB_BASE_FARE`/`_CAB_RATE_PER_KM` constants removed (now DB-sourced via the seeded `FareRule`). **Live-verified** against an unambiguous city pair (New Delhi → Jaipur): same formula, same number (₹4,885 for 286.54 km) as the old hardcoded constants would have produced — a true regression check, not just "it runs."
- **`suggestions.py`**: `_restaurant_fields` now calls `price_estimator.estimate("restaurant", ...)` instead of owning `_RESTAURANT_PRICE_BAND`/`_RESTAURANT_PRICE_LABEL` privately. Same numbers.
- **`recommendations.py`**: `DEST_TIER_RATES`, `PURPOSE_BUDGET_MULTIPLIERS`, and `_dest_base_per_day` removed from this file (moved to `price_estimator.py`, the one now-canonical home); `recommended_budget_inr`'s food-fallback and destination-tier-fallback branches now call `price_estimator.estimate(...)`. The international/domestic classification text is now computed directly from `price_estimator.DEST_TIER_RATES` (checked before the purpose multiplier is applied) rather than inferred from the post-multiplier number, preserving the original decision logic exactly regardless of purpose.
- **Real, separate bug fixed**: `conversation_engine.py::_compute_recommended_budget_inr` referenced `DEST_TIER_RATES` and `PURPOSE_BUDGET_MULTIPLIERS`, **neither of which was ever imported into that file** (only `PURPOSE_DEFAULTS` was) — a live `NameError` waiting to fire the first time `_build_optional_prefilled` ran on a draft with no `budget_inr` in metadata. Found while tracing this exact logic for the Phase 5 switchover, not gone looking for it separately. Fixed by deleting the broken duplicate entirely and calling `recommendations.recommended_budget_inr(draft, purpose)[0]` — the same, now-fixed, canonical function — instead of re-implementing it a third time. **Live-verified**: `recommended_budget_inr(FakeDraft(), 'vacation')` returns a clean `(50000, [...], False)` tuple with no error; `ConversationEngine._build_optional_prefilled` was traced past the previously-crashing line without incident.

### 8. `evaluate_price_estimators` command

A real, deterministic holdout backtest (80/20 date split) of the ladder's statistical rung (class 3 — the same city-segment quantile method `rollup_price_summaries` produces), reporting MAE, median AE, WAPE, pinball loss at q25/q50/q75, and p25-p75 interval coverage. Deliberately does **not** backtest the FareRule rate-card formulas (classes 1/2) — those are deterministic parameters, not fitted predictions, so a holdout/MAE evaluation isn't the right tool for them (this scoping choice is stated in the command's own docstring, not left implicit).

**Live-verified with real statistical computation**, not a stub: with real (sparse) data, correctly reports `cold_start` (n=2, below the 10-observation floor). To prove the "evaluated" branch itself works, 30 synthetic cab observations were injected temporarily, producing real, sane numbers (MAE≈32.6, WAPE≈4%, coverage 0.4 — close to the ~0.5 statistically expected for a p25-p75 band by construction) — then deleted, along with all other test/synthetic observation rows, before finishing (see verification report; only the real `FareRule`/`SourceRegistry` seed data was kept in the dev DB).

## A real, separate, pre-existing bug found during verification (not fixed — out of scope, flagged)

While regression-testing `transport_compare.compare_legs` end-to-end, `compare_legs('Delhi', 'Agra', ...)` produced an absurd ₹206,936 cab fare. Root cause: `_resolve_city('Agra')` (unrelated, unedited code) resolves via a plain `City.objects.filter(name__icontains=name).first()` — a substring match with no ranking — and "Agra" is a literal substring of "Lagrange" (L-**AGRA**-NGE), so it matched **Lagrange, US** instead of Agra, India, producing a ~12,915 km "distance." The pricing *formula* was correct throughout; the corrupted upstream distance is what produced a corrupted-looking-plausible number. Confirmed unrelated to this phase (the function was never touched here) by re-running with an unambiguous pair (New Delhi → Jaipur), which priced correctly. Flagged as a standalone background-task suggestion (chip shown to the owner) rather than fixed opportunistically, per this repo's "record newly discovered out-of-scope issues, don't fix them silently" rule.

## Changed files

New: `backend/apps/reference/services/price_estimator.py`; migration `reference/migrations/0016_phase5_price_estimation.py`; commands `seed_fare_rules.py`, `rollup_price_summaries.py`, `evaluate_price_estimators.py`; `docs/plans/phases/phase-05-*`.
Extended: `backend/apps/reference/models.py` (`FareRule`), `admin.py`, `serializers.py`, `services/live_price.py` (observation writer + hotel ladder fallback), `apps/bookings/providers/registry.py` (observation-writer hook).
Rewritten call sites: `apps/planner/services/transport_compare.py`, `apps/reference/services/suggestions.py`, `apps/planner/services/intelligence/recommendations.py`, `apps/planner/services/conversation_engine.py` (bug fix).
No Codex-fenced file outside this initiative's own new files was touched; no frontend file was touched (this phase is backend-only, matching the plan's own scope note).

## Next action

1. A future session should either OCR the IRCTC fare-slab PDF (`docs/plans/phases/phase-05-implementation-report.md` above has both URLs tried) or find an HTML-published equivalent, then run `seed_fare_rules` again to add real train `FareRule` rows.
2. (Optional, low-risk) Re-verify the UPSRTC bus rate against a current page — its stated effective window has lapsed.
3. (Optional, Codex- or owner-directed) Fix the `_resolve_city` substring-match bug flagged above — a chip is already showing for the owner to spin off as its own session.
4. Run `rollup_price_summaries` on a recurring basis (not yet a beat task — deliberately deferred, see packet) once real observation volume exists from live traffic.
5. `PLANNER_ROUTE_GRAPH_ENABLED` (Phase 4) remains untouched by this phase, still `False`.
