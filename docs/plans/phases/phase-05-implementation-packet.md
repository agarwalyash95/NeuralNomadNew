# Phase 5 Implementation Packet — Price benchmarks & estimation foundation

- Date: 2026-07-20, Asia/Calcutta
- Agent/platform: Claude Code (Sonnet 5)
- Source: `docs/plans/reference-foundation-and-planner-intelligence-master-plan.md` §10, Phase 5 section (line 564).
- Trigger: owner said "let's start phase 5" after reviewing the Phase 04 handoff, whose own next action named Phase 5 as next in sequence.

## Scope decision: a foundation slice, not the full §10 spec

The master plan's full §10 design (flight distance-band curves recalibrated monthly, holiday/season feature engineering, an ML gate, provider-ToS-gated panel sampling) assumes real observation volume and business decisions that don't exist yet in this repository — the plan's own text says so ("sparse observations make benchmarks thin — by design the ladder falls back to rules with honest labels"; panel sampling "built but disabled pending provider-ToS verification"). This packet scopes Phase 5 to the **honest, safely-buildable foundation slice**: the parts that don't require fabricating data or an unmade owner business decision. Deferred items are named explicitly below, not silently dropped — matching how Phase 4's own report handled its "not completed" items (report 7's full run).

## In scope

1. `FareRule` model + additive migration (reuses `_RouteFactsMixin`'s provenance enum, per that mixin's own docstring deferring fare data to this phase).
2. `reference/services/price_estimator.py` — the §10.1 six-class ladder as one `estimate()` dispatch, per-category strategies for cab/bus/train/hotel/restaurant/food_daily/trip_day_budget.
3. `seed_fare_rules` — cab (exact numbers already shipped), bus (real UPSRTC published rate, cited, national-fallback caveat), train/metro left unseeded (no confidently-extractable public table found this session — see implementation report).
4. `TravelPriceObservation` writers: a single hook in `ProviderRegistry.search()` (the funnel point for all 3 existing call sites) plus a paired write in `live_price.py`'s existing `TravelPriceHistory` creation path.
5. `rollup_price_summaries` — quantile rollup into `TravelPriceSummary`.
6. `live_price.py` ladder refactor — a `price_estimator` fallback rung, wired for `hotel` only (the one category servable without caller-supplied distance).
7. Planner call-site switchovers: `transport_compare.py` (cab), `suggestions.py` (restaurant), `recommendations.py` (destination-tier/food fallback), plus a real `NameError` bug fix in `conversation_engine.py` found while touching the same logic.
8. `evaluate_price_estimators` — offline §10.5 holdout backtest of the benchmark (class-3) method.
9. Grep gate on the retired literals in the touched files.

## Explicitly deferred

- Panel-sampling beat task (provider-ToS gated).
- Flight distance-band curve, full holiday/season feature engineering, the ML gate (§10.6) — all volume/business-gated in the plan text itself.
- Any C1-poisoned `TravelPriceHistory` row cleanup — owner-gated, not attempted.
- Train/metro `FareRule` seeding — no confidently-sourced table found this session (IRCTC's real slab table is only published as scanned/binary PDF circulars this session's tooling couldn't extract text from).

Full detail of what was actually built, and what was found along the way, is in `phase-05-implementation-report.md`.
