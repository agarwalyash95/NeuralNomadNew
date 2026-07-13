# Planner refinement + 10-year defensibility plan

> **Part I** (Workstreams 1–7) is the near-term "make it feel alive" refinement from the current discussion.
> **Part II** (Workstream 0 + 8–13) is the defensibility audit: what turns this from a good planner into one competitors can't catch for a decade. It opens with Workstream 0 (the identity prerequisite everything else stands on), then an honest scorecard and six moat workstreams. Read Part II's audit scorecard first if you want the strategic case before the tactical one.

---

## Planner refinement: alive tips, alive timeline, enforced meals/rest, alive chat

## Context

The planner (itinerary generation, Helper Canvas booking, chat intake) is already shipped and functional. This round fixes four specific ways it currently feels static/incomplete rather than "alive":

1. Swapping an item on a Helper Canvas (hotel/flight/train/bus/cab) silently drops the AI tip and nothing regenerates one.
2. The day timeline has drag-reorder and a basic distance pill, but no live guidance on transport mode, no "something interesting is between these two stops" nudge, and no one-click day-level reflow feel.
3. Meals and rest time are only a loose LLM prompt suggestion — nothing enforces they exist, and deleting the last lunch/dinner/rest block just leaves a hole.
4. Chat is a deterministic slot-filling intake flow (destination → dates → details) built on Gemini structured extraction. It stops being useful the moment the plan is generated — there's no way to ask it "skip the museum on day 2" or "what's good for dinner near the hotel," and no live-status widget shell for flight/train info.

Investigation (3 parallel Explore passes + 1 Plan pass, cross-checked by reading `block_schema.py`, `chat_edit_intents.py`, and `blockMerge.ts` directly) found real, reusable infrastructure for most of this — the fix is mostly *wiring existing patterns further*, not inventing new ones: the `PlanProposal`/`insight_engine.py` rule pattern, the `useTransitDistances.ts` debounced-batch-resolve hook pattern, and the `chat_edit_intents.py` "propose, never mutate directly" pattern. One correction from the original assumption: enrichment (`enrich_place` Celery task) writes `PlaceInsight` rows, not `editorial_summary` — there is currently **no path at all** that writes an AI tip back onto an already-saved trip block. That gap is what Workstream 1 actually closes.

User decisions locked in for this round:
- Tip regeneration on replace: **async with a loading shimmer**, not a blocking wait.
- Timeline tags (transport mode, reorg hints, interesting-stop): **always-on/live**, rendered as **tags/pills, not proposal cards** — advisory, not interruptive.
- Meals/rest: must become **effectively non-skippable** (auto-reinsert on delete, not just advisory).
- Chat: extend to a **full post-plan assistant mode** (freeform Q&A + safe plan actions), reusing `PlanProposal` for any mutation.
- Live flight/train status: **build the widget shell + backend plumbing only**, clearly labeled as preview/mock data — no real third-party integration this round (no API chosen/credentialed).

---

## Executive summary

1. **Tips** — swapping a hotel/flight/place currently wipes the AI tip and nothing regenerates it. Fix: async regeneration + shimmer, delivered via a new live channel.
2. **Timeline** — add always-on transport-mode tags, an "interesting stop between" tag, and reuse the existing route-optimizer hint — all rendered as pills, not interruptive cards.
3. **Meals/rest** — make them structurally enforced (generation-time fill, edit-time auto-fix, delete-guard auto-reinsert) instead of a loose prompt suggestion nothing checks.
4. **Chat** — extend beyond intake into a freeform post-plan assistant that proposes changes (never mutates directly) and gets a labeled preview live-status widget shell.
5. **Feel-alive layer** — one real-time SSE backbone instead of three separate pollers, plus a consistent motion/trust visual language (layout animations, cost ticker, provenance decay, activity feed).
6. **Day 0 trip prep** — auto-surface visa/passport/forex guidance using existing `apps.visa`/`apps.forex` infrastructure that's currently disconnected from the planning flow.
7. **Map export** — per-day Google Maps links (respecting the real ~10-waypoint URL limit) plus a whole-trip KML download for full distance/visual overview.

---

## Roadmap / order of delivery

| Phase | Workstream | Why here |
|---|---|---|
| **Phase 0** | Real-time backbone (new §Workstream 5, technical half) | Everything async in Phases 2/3/5 gets pushed through this instead of inventing its own poll loop — build the pipe before the water. |
| **Phase 1** | Meals & rest enforcement (Workstream 3) | No dependency on Phase 0. Must land before Phase 3 so `route_optimizer.py` correctly treats `rest`/`restaurant` as fixed, not movable, stops. |
| **Phase 2** | AI tip regeneration on replace (Workstream 1) | Depends on Phase 0's channel for push delivery (falls back to polling if channel isn't ready yet, so this can also ship before Phase 0 if needed). |
| **Phase 3** | Always-on live timeline tags (Workstream 2) | Depends on Phase 1 (rest category) and benefits from Phase 0 (waypoint suggestions pushed, not polled). |
| **Phase 4** | Feel-alive visual layer (Workstream 5, visual half) | Cross-cutting polish — sequenced after 1-3 so there's real live state (tips arriving, tags appearing, blocks reflowing) for the animations/shimmer/ticker to actually animate. |
| **Phase 5** | Chat plan-assistant mode + live-status widget shell (Workstream 4) | Loosely independent; richer answers benefit from Phase 1's insight rules existing first. Live-status shell has zero dependencies and can be built anytime in parallel. |
| **Phase 1b** (parallel with Phase 1) | Day 0 trip prep — visa/passport/forex (Workstream 6) | No dependency on any other workstream; reuses existing `apps.visa`/`apps.forex` models and `VisaCanvas`'s existing domestic-vs-international logic. Safe to build alongside Phase 1. |
| **Anytime, fully parallel** | Export to Google Maps / KML (Workstream 7) | Pure frontend utility on data already assembled for PDF export; zero backend dependency, zero dependency on any other workstream. |

Recommended build order: **0 → {1, 1b} → 2 → 3 → 4 → 5**, with Workstream 7 (map export) doable at any point.

---

## Workstream 1 — AI tip regenerates on replace (async + shimmer)

**Root cause** (confirmed by reading `blockMerge.ts`): `HotelCanvas.tsx::handleSelectHotel` and its Flight/Train/Bus/Cab siblings build a fresh `ItineraryItem` with no `aiTip`. `mergeReplacementItem` in [blockMerge.ts](frontend/src/features/planner/workspace/services/blockMerge.ts:88) deliberately drops the old tip (correct — it describes the old venue) and `toRawActivity` (line 62) serializes `ai_tip: item.aiTip ?? null`, PATCHing `null` to the backend. Nothing regenerates it: `_trigger_enrichment_for_trip_blocks` only warms the shared reference-table `PlaceInsight` cache, never writes back into `PlannerTrip.days`.

**Backend**
- New `backend/apps/planner/services/tip_sync.py`: `mark_pending_tip(trip, block_id)` and `apply_generated_tip(workspace_id, block_id, tip_text)` (fresh re-fetch + `select_for_update`, locate via `block_schema.find_block`, set `ai_tip` + `metadata.ai_tip_status="ready"`, save with `update_fields=["days","updated_at"]`).
- New `backend/apps/planner/tasks.py`: Celery task `generate_block_tip(workspace_id, block_id, category, object_id)` — cheap path synthesizes from existing `PlaceInsight` rows if present, else one trimmed `gemini-2.5-flash` call; calls `tip_sync.apply_generated_tip`.
- Extend `_trigger_enrichment_for_trip_blocks` in [views.py](backend/apps/planner/views.py:20): when a block has `master_ref` and empty `ai_tip`, call `mark_pending_tip` and enqueue `generate_block_tip.delay(...)` on commit.
- New lightweight poll action on `PlannerWorkspaceViewSet`: `GET /workspaces/{id}/plan/tips/?block_ids=...` → `{block_id: {ai_tip, ai_tip_status}}` only (avoid re-fetching the full plan every poll tick) — **fallback path** if Phase 0's live channel (Workstream 5) isn't ready yet; once it exists, `apply_generated_tip` also emits a `tip_ready` event on it instead of relying purely on the client to poll.

**Frontend**
- Add `aiTipStatus?: 'pending'|'ready'` to `ItineraryItem` (plan-canvas `types.ts`).
- `blockMerge.ts`: when a merged item has a `masterRef`/`place_id` but no `aiTip`, set `aiTipStatus: 'pending'` optimistically.
- New hook `frontend/src/features/planner/workspace/hooks/usePendingTips.ts`: subscribes to `tip_ready` events on the Workstream 5 live channel when available; falls back to polling the `/plan/tips/` endpoint every ~3s (stop after ~30s or first "ready") when it isn't. Modeled on [useTransitDistances.ts](frontend/src/features/planner/workspace/hooks/useTransitDistances.ts)'s batch-resolve pattern either way.
- Render a shimmer line on the tip in the timeline card when `aiTipStatus === 'pending'` (shared shimmer component — see Workstream 5).
- `PlannerWorkspace.tsx::handleAddToPlan`: register the swapped block id with `usePendingTips` after a successful replace PATCH.

**Note on side effect**: this write bumps `trip.updated_at`, which can expire other open `PlanProposal`s (staleness guard). Consider excluding `updated_at` from the tip-write `update_fields` if this proves disruptive in testing — flag it during verification.

---

## Workstream 2 — Always-on live timeline tags

**Design**: client-side primary, server round-trip only where genuinely needed (spatial query), to keep this free of new Gemini/Distance-Matrix cost.

- **Route-reorg hint**: already exists as the "saves ~Xm" hint via `routeOptimizer.ts::optimizeDayRoute` in [ItineraryTimeline.tsx](frontend/src/features/planner/workspace/plan-canvas/ItineraryTimeline.tsx:427) — no new backend call, pure client math, recomputed on `day.items` change.
- **Transport-mode tag** (walk / cab / "rental may be worth it"): new pure function `classifyLegMode(distanceKm, stopCount)` in `routeOptimizer.ts`, applied to the **already-resolved** distance from `useTransitDistances` (no new data source). Rendered as a second pill next to the existing distance pill in `ItineraryTimeline.tsx` (~505-585) — advisory only, click-through opens the existing Helper Canvas (`CabCanvas` etc.), no `PlanProposal` filed.
- **Interesting-stop-between tag**: the one piece needing a real spatial query — `places_explore.py` today only does single-point radius search. Add `find_waypoints_between(origin, dest, corridor_km=1.5, limit=3)` to [places_explore.py](backend/apps/reference/services/places_explore.py), reusing the bounding-box/haversine approximation `_scenic_score` already uses (no real polyline geometry — don't over-engineer). New endpoint `POST /workspaces/{id}/plan/waypoint-suggestions/`, new cache table `knowledge.WaypointSuggestionCache` (mirrors `DistanceEdge` shape/TTL, ~60 days). New frontend hook `useWaypointSuggestions.ts` (same shape as `useTransitDistances.ts`, but 2000ms debounce, batched per-day not per-leg) renders a "✨ X on the way" tag; clicking opens the relevant canvas pre-filtered. Once Workstream 5's live channel exists, the request/response can move behind a `waypoint_ready` event instead of a plain request/response round trip, so the tag can appear mid-typing-pause rather than only after the debounce fully elapses.
- **Cost control**: transport-mode + reorg tags are zero marginal network cost (reuse in-memory/cached data). Waypoint tag makes zero Gemini calls and zero Maps API calls — pure DB geo-query with its own cache.

**Sequencing note**: land after Workstream 3's `rest` category exists, so `route_optimizer.py`'s `_OPTIMIZABLE_CATEGORIES` can be checked/confirmed to exclude `rest`/`restaurant` from permutation-reordering (a fixed-time lunch or rest block shouldn't get treated as a movable stop).

---

## Workstream 3 — Meals and rest become effectively non-skippable

**Schema** (additive only, no version bump — `block_schema.py` has no closed category enum): new `category: "rest"`, and `metadata.meal_type: "breakfast"|"lunch"|"dinner"` on restaurant blocks, `metadata.rest_type` on rest blocks. Document new values in `block_schema.py`'s module docstring (it explicitly claims to be "the ONLY place that defines the mapping").

**Three enforcement layers**:
1. **Generation-time** — extend `_compose_days`'s prompt in [plan_generation.py](backend/apps/planner/services/plan_generation.py:499) to require lunch/dinner + a rest block for busy days, then add a post-processing function `_ensure_meals_and_rest(days_out, pool)` (called after the existing hallucination-rejection join loop, ~582-620) that guarantees compliance by heuristic-filling any day the LLM missed, reusing the same `_heuristic_pick` fallback already used for hallucinated candidate ids. This guarantees every *new* plan is compliant without depending on the LLM getting it right.
2. **Edit-time nudge** — add `MissingMealWarning` and `MissingRestWarning` to `insight_engine.py`'s `RULES`, following the existing `InsightRule`/`ScheduleGapWarning` pattern (extract a shared `_find_gaps` helper both can use). These are the two rules in the engine that carry a mechanically-correct auto-fix (re-run the same heuristic-fill), rendered as small always-visible "Add lunch"/"Add rest" chips inline in the timeline (not gated behind the Insights panel), going through the same `PlanProposal` accept flow as everything else.
3. **Delete-guard** — in the block deactivate path (`views.py`'s plan PATCH handler), if deactivating the *last* remaining meal-of-that-type or rest block for a day: auto-run the corresponding insight rule synchronously and auto-accept the reinsertion so the slot never actually disappears — user can always remove/swap the *specific place*, but the *slot* refills with a placeholder they can then swap via the normal canvas flow. This is the "non-skippable but not annoying" mechanism.

**Files**: `plan_generation.py` (`_compose_days` + new `_ensure_meals_and_rest`), `insight_engine.py` (two new rules + shared gap helper), `block_schema.py` (docstring only), `views.py` (delete-guard hook), `route_optimizer.py` (confirm `_OPTIMIZABLE_CATEGORIES` excludes `rest`), `ItineraryTimeline.tsx` (distinct compact node style for `rest` blocks — it's downtime, not a bookable place — plus the inline add-chips).

---

## Workstream 4 — Chat becomes a full post-plan assistant

**Routing**: reuse the existing `PlannerWorkspace.mode` field (already flips to `MODE_PLANNING` once a trip is generated) as the mode gate inside `ConversationService.send_message` — no new endpoint. Once in planning mode, route to a new engine instead of the intake `ConversationEngine`. Because freeform mode operates on `PlannerTrip` and intake operates on `TripDraftState`, the "never re-ask an already-answered question" property holds automatically — there's nothing to re-ask once intake is done.

**New engine** `backend/apps/planner/services/plan_assistant_engine.py` — deliberately narrow, generalizing the exact pattern already proven safe in [chat_edit_intents.py](backend/apps/planner/services/chat_edit_intents.py) (confirmed: "silence is the correct default; a wrong guess that silently edits someone's trip is far worse than not being clever enough"):
1. One Gemini call with a structured-output schema for intent classification + target resolution only: `{intent, target_block_fragment, day_number, reply}` — never raw plan mutation.
2. Target resolution reuses `chat_edit_intents.py::_find_unique_active_block`; ambiguous/no match → clarifying question in `reply`, no proposal filed.
3. On a unique match: `skip_block` → `PlanProposal` (`KIND_PLAN_EDIT`, same diff shape `route_optimizer.py` already produces); `retime` → delegate straight to existing `propose_retime_from_chat`; `suggest_swap`/query-style ("what's good for dinner near the hotel") → route through existing `places_explore.explore_places()` scoped to the relevant block's coordinates, return as conversational text — no proposal needed since nothing changes until the user acts.
4. Every proposal renders through the existing `ProposalCard.tsx` accept/reject UI — no new review surface.

**Live-status widget shell** (mock data, clearly labeled, per your decision):
- New `backend/apps/planner/services/live_status.py`: single function `get_live_status(block)` returning deterministic mock data (seeded by block id, not random per-poll), explicitly commented as the entire integration contract for swapping in a real provider later.
- New widget type `live_status_tracker`, registered exactly like the existing intake widgets in `widgetRegistry.ts`, emitted via the same `widgets=[{type, data}]` shape from either engine.
- New `frontend/src/features/planner/chat/widgets/LiveStatusWidget.tsx` — renders status + a visible "Preview data — live tracking coming soon" label.

**Cost note**: freeform chat now runs for the entire trip lifetime, not just intake — recommend using `gemini-2.5-flash` for the intent-classification step and reserving `gemini-2.5-pro` for the actual conversational reply, mirroring the existing pro/flash cost split, plus considering a per-workspace daily message cap.

---

## Workstream 5 — Making the planner feel alive (technical backbone + visual layer)

This is the cross-cutting workstream that ties 1-4 together into one coherent "alive" feel instead of four separately-bolted-on features. Split into a technical half (Phase 0, build first) and a visual half (Phase 4, build after 1-3 exist so there's real state to animate).

### Technical half — one real-time channel instead of three pollers

The plan as drafted has three independent polling hooks (`usePendingTips`, `useWaypointSuggestions`, and an implicit one for insight-engine proposals) — three different laggy timers reinventing the same pattern. Replace with one backbone:

- New SSE endpoint `GET /workspaces/{id}/live/` in `views.py`, extending the exact pattern already proven in `workspace_chat_stream`/`lazy_chat_stream`'s `_stream_chat_response` (this repo already knows how to hold an SSE connection open and emit typed events — reuse it, don't invent a second mechanism). Emits typed events: `tip_ready`, `waypoint_ready`, `insight_created`, `proposal_created`, `price_refreshed`.
- Backend emit points: `tip_sync.apply_generated_tip` (Workstream 1), the new waypoint-suggestions endpoint (Workstream 2), `PlanInsightEngine.run` when it creates a new proposal (Workstream 3), any live-price refresh path already in `views.py::verify_block`.
- New frontend hook `frontend/src/features/planner/workspace/hooks/useLiveWorkspaceEvents.ts` — one `EventSource` per open workspace, dispatches typed events to whichever feature-specific hook cares (`usePendingTips`, `useWaypointSuggestions`, an insight-proposal listener). Each feature-specific hook keeps its polling fallback for when the channel drops, but the channel is the primary path.
- **Activity feed**: a small persistent panel (or toast stream) in the workspace UI that renders a human-readable line for each event as it arrives — "Found a rest stop for Day 2", "Refreshed pricing for Taj Hotel", "New AI tip for Marina Beach". This is the single highest-leverage "feels alive" change: background AI work becomes visible instead of invisible, which is most of what "static" vs "alive" actually means to a user.

### Visual half — a consistent motion/trust language, not one-off animations

- **Layout animations**: reorder/insert/delete on the timeline should glide (e.g. framer-motion `layout` prop or FLIP), not snap. Applies to `ItineraryTimeline.tsx` drag-reorder, the meal/rest auto-reinsert from Workstream 3, and new tags/pills appearing from Workstream 2.
- **One shared shimmer/skeleton component**, used by tip generation (Workstream 1), waypoint search (Workstream 2), and any live price refresh — replacing three bespoke loading states with one visual vocabulary.
- **Live cost ticker**: the trip total should count up/down smoothly when a block's cost changes (swap, delete, price refresh) instead of jumping to a new number instantly.
- **Provenance-tier visual language**: `block_schema.py` already has a real trust grammar (`verified`/`estimated`/`suggested`) sitting inert in JSON. Give it an actual visual treatment — distinct color/icon per tier, and a subtle "freshness decay" indicator (e.g., a price verified 20+ days ago visibly fades) so the existing trust data becomes something the user *sees*, not just something the backend tracks.
- **Staggered reveal**: when a day or full plan first loads, cards should stagger in rather than all appear at once.
- **Animated route line**: `PlannerMap.tsx` (confirmed existing) redraws its route polyline with a smooth transition when stops are reordered/added/removed, instead of an instant jump-cut.
- **Rotating micro-copy**: the chat's `TypingIndicator.tsx` already varies its "thinking" text — generalize that one small pattern to other loading/working states (tip shimmer, waypoint search, insight scan) instead of static "Loading..." everywhere.

---

## Workstream 6 — Day 0: trip prep (visa, passport, forex)

Real infrastructure already exists for this and is currently disconnected from the planning flow: `apps.visa.models.VisaData` (country, visa_required, visa_type, processing_time, fees, required_documents, exemptions, `official_link`) and `apps.forex.models.ForexData`/`ForexVendor`/`VendorCurrencyInventory` are fully-modeled Django apps, and `frontend/.../travel-prep/visa/VisaCanvas.tsx` already has domestic-vs-international detection logic ("all Indian cities" = domestic → shows a documents checklist instead of visa info). `reference.models.py` has `Country`/`City` FK relations, so destination-country lookup doesn't need new geocoding. `conversation_engine.py` already deliberately instructs Gemini to **never ask about visa** during chat intake (line ~816) — the product intent was clearly always to surface this computed, not asked. Today, none of it is wired together automatically: a user has to manually open the Visa/Forex helper canvases.

**What Day 0 actually is**: not a literal calendar day — a prep summary card rendered above Day 1 in the plan canvas the moment a plan is generated (or the destination changes), computed automatically from data already in the trip.

**Backend**
- New `backend/apps/planner/services/trip_prep.py::compute_trip_prep(trip)`: resolve destination city → `Country` via the existing `reference.models.City`/`Country` FK; compare against the user's home country (default India, matching `VisaCanvas`'s existing "domestic = Indian cities" convention — confirm this default is still correct rather than hardcode blindly). If international: look up `VisaData` for the destination country (visa_required, processing_time, required_documents, `official_link`) and `ForexData`/nearest `ForexVendor` for the local currency and current rate. Always include a generic, non-fabricated passport-validity reminder (e.g. "many countries require 6+ months' passport validity beyond your return date — no per-country passport data exists in this system, so this stays a general heuristic, not a specific claim").
- **Trust-grammar requirement**: `VisaData`/`ForexData` rows are seed/reference data, not a live government-source lookup — memory of a prior audit flagged fabricated-looking visa data as a real trust risk. The Day 0 card must present this with the same provenance discipline as the rest of the app (`block_schema.py`'s verified/estimated/suggested language) — label it clearly as reference information with a "confirm at [official_link]" CTA using the field that already exists on `VisaData` for exactly this purpose, not as verified fact.
- New read action on `PlannerWorkspaceViewSet` (or computed inline on plan load) exposing `trip_prep` alongside the existing plan payload.

**Frontend**
- New `frontend/src/features/planner/workspace/plan-canvas/TripPrepCard.tsx`, rendered above Day 1 (near `TripStatusSpine.tsx`'s existing header conventions). Shows: visa requirement + processing time + "confirm officially" link, local currency + current rate + a CTA into the existing `ForexCanvas` (arrange delivery/pickup — already fully built), and the generic passport reminder.
- If visa is required and unresolved, this can reuse the Workstream 3 "non-skippable but not annoying" pattern — a persistent, dismissible banner/chip rather than a blocking gate, consistent with how meal/rest gaps are surfaced.
- Deep-links reuse the **existing** `VisaCanvas`/`ForexCanvas` components — this workstream is purely "detect + surface automatically," not a rebuild of visa/forex UI.

**Chat synergy**: `plan_assistant_engine.py` (Workstream 4) should route "do I need a visa for Japan" / "how much forex should I carry" style questions through `trip_prep.compute_trip_prep` rather than letting Gemini answer from its own knowledge — same discipline as `chat_edit_intents.py`, prefer a real lookup over a plausible-sounding guess.

---

## Workstream 7 — Export the trip to Google Maps / KML

**Constraint that shapes the design**: a plain Google Maps directions URL (`google.com/maps/dir/?api=1&origin=...&waypoints=...`) caps out around 9-10 waypoints. A multi-day, multi-city trip will exceed that, so a single "whole trip" Maps link would silently break past a handful of stops — not proposing that. Two complementary exports instead:

1. **Per-day "Open in Google Maps"**: build a directions URL from one day's active blocks' lat/lng (already present on every block — no new data needed) — realistic given the waypoint cap, gives real turn-by-turn/distance for that day directly in the Google Maps app or web.
2. **Whole-trip KML download**: generate a `.kml` file (placemarks grouped into folders per day, across the entire trip) client-side — no waypoint limit, importable into Google My Maps or Google Earth for a full multi-day visual/distance overview. This is the actual answer to "whole trip distance calculating."

**Implementation**: new `frontend/src/features/planner/workspace/utils/exportMaps.ts`, mirroring [exportPdf.ts](frontend/src/features/planner/workspace/utils/exportPdf.ts)'s exact shape — pure frontend, data-driven from the same `TripViewModel` already assembled for PDF export, no new backend endpoint. Add "Open Day in Google Maps" and "Download full trip (KML)" options next to wherever the existing Export-PDF action lives (`PlannerWorkspace.tsx`/`PlannerHeader.tsx`).

---

# PART II — 10-year defensibility audit

## The honest scorecard

Audited the running codebase across the eight dimensions that actually separate a category-defining travel planner from a nice demo. Scores are deliberately harsh — the point is to find the moat, not to feel good.

| Dimension | Current state (verified in code) | Score |
|---|---|---|
| **Local-knowledge depth** | `PlaceInsight` enrichment (noise profile, guest-fit, dish mentions, occasion fit) + editorial summaries is genuinely strong and hard to copy. | **Strong** |
| **Trust / provenance grammar** | `block_schema.py` has a real verified/estimated/suggested trust ladder — but the adversarial audit's P0s (fabricated-looking visa data, fake payment enforcement, mock data labeled "Live search") are still open. The grammar exists; enforcement doesn't. | **Partial** |
| **Feasibility ("does the plan actually work")** | `opening_hours` is stored on all 4 master tables and **never checked** against scheduled times. Meals aren't enforced (Part I WS3 fixes that). Travel time is computed but not validated against gaps. Plans can schedule closed venues. | **Weak** |
| **Compounding personalization** | `TravelerProfile.facts` + `upsert_fact` exist, but it's shallow prompt-injection of ~5 facts, and the code admits "engine does not yet prefill from TravelerProfile facts." Each trip still starts mostly cold. | **Weak–moderate** |
| **Real-world reactivity** | `PriceWatch` model exists but has no beat task watching prices (Celery installed-but-unwired per project memory). No weather, no closure/disruption awareness. The plan is a static artifact. | **Weak** |
| **Collaboration** | Essentially none. Travel is social; the tool is single-user (and the audit flagged a shared anonymous identity as a P0). | **Missing** |
| **Travel-day companion** | None. The plan is a *planning* artifact, not a *travel* artifact — no day-of view, offline access, live re-routing, or Remember phase. The ecosystem north star (Dream→Plan→Book→Travel→Remember) is only half-built. | **Missing** |
| **Explainability** | AI tips exist, but no "why this order / why this choice" reasoning. Users can't tell a good recommendation from a confident guess. | **Weak–moderate** |

## The strategic thesis

The moat is **not** "add 20 features." It is two moves:

1. **Turn inert data into enforced constraints and compounding intelligence.** You already collected `opening_hours`, `accessibility_detail`, `TravelerProfile` facts, `PriceWatch` rows, and a provenance grammar — and then didn't *use* most of it. Competitors' LLM planners hallucinate confident, infeasible itineraries. A planner that **provably never schedules a closed venue, never lies about a price, and gets measurably better every trip** is genuinely uncopyable — not because the features are secret, but because the discipline and the per-user data compound.
2. **Complete the lifecycle loop.** Reactivity + collaboration + a travel-day companion are the three things wholly missing, and they're what convert a one-time planning session into a durable, social, multi-trip relationship — the retention moat.

Seven workstreams follow (WS0 + WS8–13). Each is grounded in infrastructure that already exists; almost none is greenfield.

---

## Workstream 0 — Real per-user identity (the prerequisite everything else stands on)

**Why it's first**: this isn't a moat — it's the foundation the moats require. Verified in code: a real email-based `User` model and `UserPreference` exist in `apps.accounts` (with proper `IsAuthenticated` viewsets), **but the entire planner is wide open** — `PlannerWorkspaceViewSet` and every module-level planner view use `permission_classes = [AllowAny]`, and `get_planner_user(request)` (views.py:78) falls back to a single shared account, `planner-demo@neuralnomad.local`, for *every* unauthenticated request. So today every anonymous visitor **is the same user**: all workspaces, `TravelerProfile` facts, `PriceWatch` rows, and saved plans commingle under one demo identity.

**This is the exact P0 the adversarial audit flagged, and it silently breaks two moats before they start**: WS9 (compounding personalization) learns one blended profile across all humans, and WS11 (collaboration) is meaningless without distinct identities. It also undermines WS13's trust story — you can't honestly show a user "their" data when it's everyone's data.

**Build**:
- Wire the existing `apps.accounts` auth (the `User` model + email auth already exist — this is connection work, not a new auth system) into the planner: real login/session, `request.user` populated for planner requests.
- Flip planner endpoints from `AllowAny` to `IsAuthenticated` (with a deliberate, clearly-scoped guest/anonymous-session mode if you want frictionless "try before signup" — but a *distinct* per-session identity, never the shared demo account).
- Retire `get_planner_user`'s shared-account fallback; migrate/partition existing demo-account data so real users don't inherit the commingled blob.
- Backfill ownership scoping on every planner query (workspaces, profiles, watches) so one user can never read another's trip — this is also the WS11 access-control substrate.

**Reuse**: `apps.accounts.User`/`UserPreference`, existing `IsAuthenticated` viewset patterns already used elsewhere in accounts. **Scope note**: this is real work with security and data-migration implications; it's called out as its own workstream precisely because burying it inside a feature would be dishonest about its weight. **Everything in WS9/WS11, and the integrity of WS13, depends on this landing first.**

---

## Workstream 8 — The Feasibility Engine (the "it actually works" moat)

**Why it wins**: the single most common failure of every AI trip planner (including this one today) is producing a plan that looks beautiful and doesn't work — museum scheduled on the day it's closed, 90 minutes of activities crammed into a 40-minute gap, a beach-then-dinner-then-across-town sequence no human could physically do. Guaranteeing feasibility is a hard, unglamorous moat that LLM-first competitors structurally can't match, because it requires real constraint data + real validation, not fluent text.

**Current state (verified)**: `opening_hours` (JSONField) exists on `HotelMaster`/`RestaurantMaster`/`AttractionMaster`/`ActivityMaster` (reference/models.py lines 159/215/256/293) and is completely unused by planning. `distance_service.py` computes real travel times but nothing validates them against schedule gaps. `insight_engine.py` is the right home — it's already the rule-based plan-checker.

**Build**:
- New `backend/apps/planner/services/feasibility.py`: pure functions checking each block against three hard constraints — (a) is the venue *open* at the block's scheduled time (parse `opening_hours` for that weekday, derived from the day's real date); (b) does the real travel time from the previous block (via existing `distance_service`) *fit* the gap; (c) a simple stamina/pace model (configurable, and later personalized via WS9) — e.g. flag >N hours of continuous high-exertion activity with no rest block.
- New `insight_engine.py` rules `ClosedVenueWarning`, `ImpossibleTransitWarning`, `OverpackedDayWarning` — but these are **actionable, not advisory**: each carries a `PlanProposal` auto-fix (shift the block to an open window / into the next feasible slot), reusing the exact `PlanProposal` + heuristic-fill machinery Part I WS3 establishes.
- Generation-time: extend `plan_generation.py`'s post-processing (the same `_ensure_meals_and_rest` join point) to reject/repair infeasible placements before the plan is ever shown — a feasibility pass, not just a meal pass.
- **Enrichment dependency**: `opening_hours` is only as good as its backfill. Where a master row has empty hours, the feasibility check must degrade honestly (flag as "hours unknown — verify," never assume open) and enqueue enrichment — reusing the WS1 async/`enrich_place` pattern.

**Reuse**: `opening_hours` fields, `distance_service`, `insight_engine` RULES, `PlanProposal`, WS1 shimmer for "checking feasibility." **New data**: none. **Migration**: none.

---

## Workstream 9 — Compounding Traveler Intelligence (the personalization moat)

**Why it wins**: a planner that starts cold every time is a commodity. A planner that *knows you* — your pace, your dietary rules, that you always delete the 8am starts, that you swapped away from every chain restaurant last trip — and gets sharper every trip, is a data moat that literally cannot be copied, because the asset is per-user history a competitor doesn't have.

**Current state (verified)**: `TravelerProfile.facts` + `upsert_fact(key, value, source_trip)` exist and are populated from chat intake (home_origin, party size, budget_tier, interests). `plan_generation.py::_traveler_profile_facts` injects them into the prompt. But: it's ~5 explicit facts, the intake does **not** prefill from them (code comment admits this), and nothing captures *implicit* signals (what the user kept/deleted/swapped). `PlannerQuestionBank` is a second, separate learning layer already in the codebase.

**Build**:
- **Explicit profile depth**: extend the `facts` vocabulary with structured, high-value preferences the plan can honor as soft constraints — dietary (feeds WS8/WS3 meal picks), mobility/`accessibility_detail` (feeds WS8 hard constraints), pace, typical wake time, must-haves / never-agains. Surface a lightweight, optional "Traveler DNA" editor (not a wall of forms) — reuse the `OptionalDetailsWidget` pattern.
- **Prefill intake from profile** — close the gap the code comment names: `conversation_engine`'s "ALREADY COLLECTED" block should seed from `TravelerProfile` so a returning user is never re-asked their home city, budget tier, or dietary rules (this also directly serves the user's original ask: "should not ask questions already answered" — extended across trips, not just within one).
- **Implicit learning loop** — the compounding part: a post-trip (and on-edit) signal extractor that watches the diff between generated plan and final plan — blocks deleted, categories swapped away from, times consistently shifted — and writes inferred facts (`upsert_fact` with a `confidence` + `source=inferred`). Provenance discipline applies: inferred facts are suggestions, weighted below explicit ones, and decay if contradicted.
- Feed both into `plan_generation.py` (already wired for facts — just richer) and into WS8's stamina/pace defaults.

**Reuse**: `TravelerProfile`/`upsert_fact`, `PlannerQuestionBank`, `_traveler_profile_facts`, `OptionalDetailsWidget`, WS4 chat for conversational profile edits. **Migration**: none (facts is JSON) beyond possibly a `confidence` convention.

---

## Workstream 10 — The Living Plan: real-world reactivity (the "never stale" moat)

**Why it wins**: every itinerary a competitor produces is dead the moment it's generated. A plan that watches the real world — price drops, weather, closures, delays — and proactively adapts is a fundamentally different product category: a companion, not a document.

**Current state (verified)**: `PriceWatch` model exists (block_id, threshold, last_price) but is unwired to any scheduler. `apps.notifications` exists. No weather or closure awareness anywhere. WS5 (Part I) builds the live SSE channel this rides on.

**Build**:
- **Wire PriceWatch**: a Celery beat task that re-checks watched blocks via the *existing* `live_price.lookup_live_price` path, updates `last_price`, and on a threshold crossing emits a `price_refreshed`/`price_dropped` event through WS5's channel + `apps.notifications`. (Depends on Celery beat actually running — see hard-truths; project memory flags Celery as installed-but-unwired, so standing up the worker is a real prerequisite, not an assumption.)
- **Weather awareness**: integrate a real forecast API (honestly labeled, provenance-tiered like everything else) keyed to each day's city+date; a new `insight_engine` rule flags outdoor-heavy days with bad forecasts and proposes an indoor reshuffle via `PlanProposal`. Defer the *provider choice* the same way Part I defers live flight status — build the shell + one real integration point, clearly labeled, swappable.
- **Closure/disruption**: reuse `opening_hours` + (later) event/holiday data to flag "closed on your date" — overlaps WS8's feasibility check, sharing the same rule surface.
- All of it surfaces through WS5's activity feed ("Flight to Goa dropped ₹1,200", "Rain forecast Day 3 — want an indoor plan?") so reactivity is *visible*, which is the whole point.

**Reuse**: `PriceWatch`, `live_price.lookup_live_price`, `apps.notifications`, WS5 SSE channel + activity feed, `insight_engine`/`PlanProposal`. **New**: one weather-provider integration point + a Celery beat schedule.

---

## Workstream 11 — Group & collaborative planning (the social moat)

**Why it wins**: most real trips involve more than one person, and every solo-only planner hemorrhages those users to a shared Google Doc. Collaboration is a network-effect moat — each invited co-traveler is a new user acquired inside the product, with switching costs that rise as the group commits.

**Current state (verified)**: essentially none — and the adversarial audit flagged a *shared anonymous identity* as a launch-blocking P0. **This workstream has a hard prerequisite: real per-user identity/auth must be fixed first.** It cannot be built on the current anonymous-identity foundation.

**Build** (after the identity P0 is resolved):
- Multi-member workspace: invite co-travelers (email/link), roles (owner/editor/viewer).
- **Voting on proposals**: `PlanProposal` already has an accept/reject lifecycle — generalize "accept" into per-member votes; a proposal applies on a quorum/owner-decision rule. This reuses the single most load-bearing pattern in the whole app rather than inventing group state.
- **Cost splitting**: `apps.wallet` exists — per-person share of the running trip total, settle-up view.
- **Preference merge**: when members have conflicting `TravelerProfile` constraints (one vegetarian, one wants a 6am start), the plan honors the *union* of hard constraints and surfaces the conflicts explicitly rather than silently picking a winner — provenance/honesty discipline applied to group dynamics.

**Reuse**: `PlanProposal` → voting, `apps.wallet` → splits, per-member `TravelerProfile` (WS9). **Hard dependency**: **Workstream 0 (real per-user identity)** — now an explicit prerequisite workstream in this plan, must land before WS11.

---

## Workstream 12 — Travel-day companion (completes Dream→Plan→Book→Travel→Remember)

**Why it wins**: the product north star (in project memory) is a full lifecycle loop, and today it stops at "Plan." A tool you use *during* the trip — offline, day-of, adapting in real time — is what earns the next trip and the word-of-mouth. It's the difference between a planning website and a travel app.

**Current state (verified)**: none. The plan is export-to-PDF/Maps (Part I WS7) and then the app's job is done.

**Build**:
- **Day-of view**: a stripped, "what's now / what's next" mobile surface driven by the current time against the itinerary — reusing the same `TripViewModel`.
- **Offline access**: PWA/service-worker caching of the active trip so it works with no signal (the exact situation travelers are in). The data-driven exports (WS7) already prove the trip serializes cleanly for offline use.
- **Live re-planning**: "you're running 40 min behind — reflow the rest of the day?" — reuses WS8 feasibility + `PlanProposal`, just triggered by *real elapsed time* instead of an edit.
- **Navigation handoff**: WS7's per-day Maps links become the day-of turn-by-turn.
- **Remember phase**: a lightweight post-block journal / photo capture that (a) becomes the trip memory and (b) feeds WS9's implicit-learning loop — closing the lifecycle into a flywheel where traveling improves the next plan.

**Reuse**: `TripViewModel`, WS7 exports, WS8 feasibility, WS9 profile loop, WS10 reactivity, `PlanProposal`. **Note**: PWA/offline is the one genuinely new frontend capability here.

---

## Workstream 13 — Provenance enforcement & the anti-hallucination guarantee (the credibility moat)

**Why it wins**: in the LLM era, everyone ships a confident-sounding trip planner and they all quietly lie — fake "live" prices, invented visa rules, plausible-but-wrong hours. A planner that **provably never presents unverified data as fact** is an uncopyable *brand* position, because the moat is institutional discipline, not a feature. This is also the direct resolution of the adversarial audit's still-open P0s.

**Current state (verified)**: the `block_schema.py` trust grammar (verified/estimated/suggested) is the right foundation, but project memory records unresolved P0s — fabricated-looking visa data, fake payment enforcement, mock data labeled "Live search." The grammar is declared and inconsistently honored.

**Build**:
- **Enforce the grammar everywhere**: every user-facing price, fact, and "live" claim must carry and display honest provenance. Part I WS6 already does this for visa/forex — generalize the rule to all surfaces.
- **A provenance lint / test gate**: a test-time (ideally CI) check that *fails the build* if a user-facing surface renders unverified data without a provenance tier, or uses the word "live" on a mock/cached path. This converts "don't lie" from a code-review hope into a mechanical guarantee — which is exactly what makes it a durable moat rather than a value statement.
- **Retire the open P0s deliberately**: mock-labeled-as-live, fake payment enforcement, fabricated visa — each gets fixed or honestly relabeled. (These trace to `docs/planner-adversarial-audit.md` and the product-audit doc in project memory.)
- **User-visible trust surface**: a small, consistent "how we know this" affordance on any estimated/suggested datum, with the `official_link`-style confirm CTA (already modeled in WS6).

**Reuse**: `block_schema.py` provenance grammar, WS6's visa/forex labeling precedent, the audit docs. **Note**: this is partly a *policy/discipline* workstream, and its lint gate should land early so every other workstream is built under it.

---

## Part II roadmap & dependencies

Two things pin the order: **WS0 (identity) is the hard prerequisite** for the personalization/collaboration/trust moats, and **WS10 (The Living Plan) is the chosen flagship** — the most visibly "alive," most marketable moat, sequenced and resourced first among the moat features. WS13's lint gate still lands early and cheaply so everything after is built honest.

| Order | Workstream | Depends on | Greenfield? |
|---|---|---|---|
| **0 — Prerequisite** | 0 (real per-user identity) | — (external to Part I, but gates WS9/11/13) | No — wires existing `apps.accounts` auth |
| **Early / cheap** | 13 (provenance lint gate) | — | No — extends existing grammar; land the gate early so all later work inherits it |
| **★ Flagship** | 10 (living plan) | Part I WS5 (SSE channel) + Celery beat standing up | Mostly no (one weather provider) |
| **Then** | 8 (feasibility) | Part I WS3 (rest category, PlanProposal machinery) | No |
| **Then** | 9 (traveler intelligence) | **WS0 (real identity)** + WS8 (feeds stamina/pace) | No |
| **Parallel** | 12 (travel-day companion) | 8, 9, 10, Part I WS7 | Partly (PWA/offline is new) |
| **After WS0** | 11 (collaboration) | **WS0 (real identity)** + apps.wallet + PlanProposal | New surface, reuses existing patterns |

**Flagship note (WS10)**: because it's the flagship, its two dependencies are promoted to first-class prerequisites rather than assumptions — Part I WS5's SSE channel and a genuinely-running Celery beat worker (project memory flags Celery as installed-but-unwired) both need to land as part of the flagship push, not be discovered mid-build.

## Hard truths — what "unbeatable in 10 years" actually requires

Being straight with you, because a plan that only lists upside isn't worth much:

- **"Nobody can beat this" is execution, not architecture.** This plan gives you defensible *positions* (feasibility guarantee, compounding per-user data, provenance discipline, lifecycle completeness). Holding them for a decade depends on relentless data quality and follow-through, not on any single feature shipping.
- **The identity/auth P0 gates the social moat — and it's now Workstream 0.** WS11 and WS9 (and honestly the trust story generally) can't stand on the shared `planner-demo` identity every anonymous visitor currently shares. It's promoted to an explicit prerequisite workstream, but be clear-eyed: it carries real security and data-migration weight and must be resourced as such, not treated as a quick flag-flip.
- **Reactivity and weather mean real, ongoing API cost and real infra** (Celery beat, a forecast provider, price-check volume). The moat is real but it isn't free; these need a cost model, not just an integration.
- **The knowledge base is the true moat and needs continuous investment.** `PlaceInsight`/enrichment depth is what a competitor genuinely can't clone overnight. Feasibility, personalization, and reactivity all ride on that data being broad and fresh — underfunding enrichment quietly undermines every workstream above.
- **Provenance discipline is a cost you pay forever.** The lint gate (WS13) will occasionally block shipping something that "looks fine." That friction *is* the moat — but only if it's honored under deadline pressure, which is a cultural commitment as much as a technical one.

---

## Cross-cutting guardrails (apply across all workstreams)

A few things I think this plan needs that don't belong to any single workstream:

- **Reduced motion**: every animation added in Workstream 5 (layout glide, cost ticker count-up, staggered reveal, route-line redraw) must respect `prefers-reduced-motion` — fall back to instant state changes, not just a shorter animation. Easy to ship without this and easy to regret.
- **SSE channel security**: the new `/workspaces/{id}/live/` endpoint (Workstream 5) is new attack surface — it must verify the requesting user owns/has access to that specific workspace before subscribing, and must not leak another workspace's events. Verify this explicitly in testing, don't assume the existing auth middleware covers a long-lived streaming connection the same way it covers a normal request.
- **SSE reconnection + multi-tab**: needs exponential-backoff reconnect on drop, and must work correctly if a user has the same workspace open in two tabs (both should receive events independently, no "first tab wins" consumption bug).
- **Shared delete-guard choke point**: Workstream 3's auto-reinsert-on-delete (last meal/rest block) must fire on *every* path that deactivates a block — the direct PATCH path AND `PlanProposal` acceptance. This matters because Workstream 4's freeform chat ("skip the museum on day 2") also ends in a `PlanProposal` acceptance — if that accepted proposal happens to remove the last lunch block for a day, the guard must still catch it. Worth an explicit integration test crossing Workstreams 3 and 4, not just a UI-level check on the manual delete button.
- **Rate limiting on new endpoints**: `/plan/tips/`, `/plan/waypoint-suggestions/`, and `/live/` are all new, and two of them are poll/stream-shaped rather than one-off requests — confirm DRF's existing throttle config actually covers this pattern rather than assuming it does.
- **Telemetry on the new "alive" surfaces**: log accept/dismiss on the meal/rest auto-fix chips, click-through on waypoint-suggestion tags, and click-through on transport-mode tags. Without this there's no way to tell post-launch whether these features are actually useful or just visual noise — worth the few lines of logging now rather than guessing later.

---

## Sequencing

See the **Roadmap / order of delivery** table above (Phase 0 → 1 → 2 → 3 → 4 → 5). Key dependency notes not already captured there:

- Workstream 1's `tip_sync.py` "patch one block after an async job resolves" primitive is reused conceptually by Workstream 3's delete-guard auto-reinsert.
- Workstream 3 before Workstream 2 because a `rest` category changes what counts as an optimizable/movable stop.
- Workstream 4's basic skip/retime path has no hard dependency on 2/3, but richer answers (e.g. "skip the museum, what should I do with the freed time") benefit from `insight_engine.py`'s gap/rest rules already existing.

## New DB migrations

- `knowledge.WaypointSuggestionCache` (Workstream 2).
- No migration needed for Workstreams 1 and 3 — new fields live inside existing `JSONField`s (`days`/`metadata`), schema stays v2.
- Workstream 4: none, assuming `PlannerWorkspace.mode` is safe to reuse as the freeform gate (quick grep for other code depending on `mode` before wiring — flagged as a to-verify, not yet confirmed).

## Verification plan

- Workstream 1: on an active workspace, swap a hotel/flight/train/bus/cab in a Helper Canvas; confirm the card shows a shimmer immediately and a real AI tip appears within ~30s without a manual refresh; confirm other open proposals on the trip don't unexpectedly vanish from the staleness bump.
- Workstream 2: drag-reorder a day, confirm transport-mode pills and (where applicable) a waypoint "✨ on the way" tag appear without a page reload, and that no new Distance Matrix calls fire beyond the existing debounced batch (check network tab / logs).
- Workstream 3: generate a new plan and confirm every day has lunch, dinner, and (for busy days) a rest block; delete the only lunch block in a day and confirm a placeholder reappears rather than leaving a gap.
- Workstream 4: after a plan exists, chat "skip the museum on day 2" and confirm a reviewable `PlanProposal` appears (not a silent edit); chat "what's good for dinner near the hotel" and confirm a conversational answer with real nearby suggestions; chat something ambiguous and confirm it asks for clarification instead of guessing; open the live-status widget and confirm it's clearly labeled as preview data.
- Workstream 5: confirm the SSE channel survives a tab staying open across a tip-generation + waypoint-suggestion + insight-creation cycle without falling back to polling; confirm the activity feed shows a human-readable line for each; confirm layout animations, the cost ticker, and the map route-line redraw all run without jank on a plan with a full day of blocks (~8-10 items).
- Workstream 6: create an international-destination trip and confirm the Day 0 card shows correct visa/forex info sourced from `VisaData`/`ForexData` with a visible "confirm officially" link, not presented as verified fact; create a domestic (India-only) trip and confirm the card either doesn't show or clearly indicates no visa is needed; confirm chat answers "do I need a visa for X" using the real lookup, not a freeform LLM guess.
- Workstream 7: export a single day to Google Maps and confirm it opens with the correct stops in order; download the full-trip KML and confirm it opens correctly in Google My Maps/Earth with all days present as separate groups.

## Note on persistence

This plan currently lives only at the plan-mode scratch path. Once you approve and execution begins, the first action will also save a copy into the project under `docs/` (matching the existing pattern of `docs/planner-product-audit-2026-07.md`, `docs/planner-production-plan.md`, etc.) so it's version-controlled alongside the code it describes.
