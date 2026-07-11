# NeuralNomad Planner — Product Reimagination Audit

> Full-product UX/trust/booking audit conducted 2026-07-11, grounded in the shipped code (every finding cites file:line).
> Mission: evolve the existing Planner — one trip, one timeline, planning and booking as one continuous experience — into something users trust enough to book. **No architecture restart.** The DOM timeline, block schema v2, provenance grammar, Suggestion envelope, and helper-canvas system all stay; this audit is about making them worthy of a booking.

**Legend** — Priority: P0 (breaks trust/money/correctness) · P1 (blocks the booking decision) · P2 (quality/polish) · P3 (later). Complexity: S (hours) · M (days) · L (1–2 wks) · XL (multi-week). UX gain: how much closer a finding's fix moves a user to confidently booking.

---

## 0. Executive summary

The Planner's bones are genuinely good: DB-first generation with real progress, a three-tier provenance grammar, server-authoritative booking transitions, proposal-reviewed AI changes, and a rich normalized Suggestion envelope. The redesign phases shipped real substance.

What stands between this and "the best AI travel planner" is not missing architecture — it's that **the product still lies in places, loses user context, and stops one step short of a booking decision** on almost every surface:

1. **Money/state corruption (P0)**: any edit marks inter-city transit "booked"; checkout totals include items never shown; "Pay & Confirm" books attractions and meals; fabricated fees/GST/PCI claims.
2. **Fake intelligence remnants (P0)**: hardcoded Himalaya "local tips" shown on every trip, fabricated flight fallbacks under a "Live search" label, fake IATA codes, Unsplash stock photos as place imagery.
3. **Context amnesia (P1)**: every edit snaps focus back to Day 1; stale insights survive replaces; ratings get floored (4.7→4).
4. **The booking decision is starved (P1)**: no dates/rates/cancellation on hotels, no transport-mode comparison, no time editing, one visible booking-state grammar out of three competing ones.
5. **Whole platforms missing (P1/P2)**: the workspace is effectively desktop-mouse-only — no mobile composition, near-zero keyboard/screen-reader support, no image gallery.

Scorecard (1–10, "bookable product" bar):

| Area | Score | One-line reason |
|---|---|---|
| Generation & data honesty (backend) | 7.5 | DB-first pipeline, provenance, cache-on-miss all real |
| Trust & money integrity | **3** | T1/T3/T4 corrupt state and money truth |
| Timeline editing UX | 5 | drag+delete exist; no times, no undo, focus resets |
| Booking flows | 4 | canvases search well but stop before the decision facts |
| Proactive intelligence | 4 | engine architecture ready, 2 rules live, stale after edits |
| Visual system | 5.5 | tokens exist, half the surfaces still bypass them |
| Performance | 5 | deep-clone-per-interaction, hover re-renders everything |
| Mobile | **1** | not designed, not usable |
| Accessibility | **2** | 9 aria/keyboard hits across the whole feature |

---

## 1. Findings — Trust & booking integrity (T)

### T1 — Every plan edit silently marks inter-city transit as **booked** ⚠ worst finding
- **Current**: `serializePlanUpdate` stamps `status: city.transitToNext.isInactive ? 'inactive' : 'booked'` unconditionally ([planTransform.ts:279](../frontend/src/features/planner/workspace/services/planTransform.ts)). On the next read, `transformTripData` maps `status === 'booked'` → `'Confirmed'` (planTransform.ts:59).
- **Problem**: dragging one activity anywhere in the trip PATCHes the whole plan, which flips an unbooked ₹8,000 flight to "Confirmed". `PlannerHeader` then counts it as **committed spend** (client fallback sums `status === 'Confirmed'`, PlannerHeader.tsx:79-84) and `hasBookedItems` unlocks "View Passes" for a ticket that doesn't exist.
- **Impact**: users see money as spent that isn't, see passes for unbought tickets, and lose the ability to tell real bookings from planned ones — the exact failure the provenance system was built to prevent.
- **Fix**: serialize transit status from actual state: `isInactive ? 'inactive' : (item.blockStatus === 'booked' ? 'booked' : 'pending')` — mirror the day-item branch at planTransform.ts:246-250. Add a snapshot test: PATCH round-trip must never escalate `status`/`block_status`. Longer-term: server should reject client-supplied status escalation (only `blocks/transition/` may promote).
- **Priority**: P0 · **Complexity**: S · **UX gain**: restores the entire trust grammar.

### T2 — Checkout total includes items that are never listed
- **Current**: `CheckoutCanvas` adds **every** priced, active item to `totalCost`, but only pushes hotels and transit into the visible lists ([CheckoutCanvas.tsx:73-95](../frontend/src/features/planner/workspace/helper-canvases/booking/canvases/CheckoutCanvas.tsx)). Attraction tickets and meals are charged invisibly.
- **Problem**: the "Fare Summary" doesn't reconcile with the line items above it. Any user who adds the visible prices will get a smaller number than the total.
- **Impact**: instant abandonment trigger — an unexplainable total at the payment step is the single most damaging place to surprise a user.
- **Fix**: one source of truth: build the item list first (all bookable categories, each with a line), derive the total from that list. Better: replace the client sum with the server `ledger/` (already computed per tier) so checkout, header budget bar, and wallet all agree.
- **Priority**: P0 · **Complexity**: S–M · **UX gain**: checkout becomes arithmetically honest.

### T3 — "Pay & Confirm" books every block in the trip, skipping the commitment ladder
- **Current**: `onConfirmBooking` collects **all** active, non-booked block ids — attractions, meals, everything — and transitions them straight to `booked` ([PlannerWorkspace.tsx:805-825](../frontend/src/features/planner/workspace/PlannerWorkspace.tsx)); the `priced → held → booked` ladder and the 409 `blocking_blocks` contract from the redesign plan (§4a) are bypassed client-side, and the trip-level `book/` 409 is swallowed with `console.warn` (PlannerWorkspace.tsx:830-834).
- **Problem**: "booking" a sunset viewpoint is meaningless, and blocks are promoted without ever being priced or held. The one strict state machine the backend enforces is being fed garbage transitions.
- **Impact**: Wallet fills with fake "bookings"; a partially-failed transition leaves the trip half-"booked" with no user-visible explanation.
- **Fix**: checkout operates only on bookable categories (`flight/train/bus/cab/hotel`) with per-item checkboxes; drive `priced → booked` per item; surface the 409 `blocking_blocks` payload as an actionable list ("2 items need pricing first — Verify now"). Attractions/meals appear in a separate non-charged "reservations & tickets" section (future ticketing).
- **Priority**: P0 · **Complexity**: M · **UX gain**: booking means booking.

### T4 — Fabricated charges and security claims at checkout
- **Current**: hardcoded ₹250 "Nomadic Booking Fee", `Math.round(totalCost * 0.05)` labeled "GST & Service Taxes (5%)" (code comment admits "mock GST"), a "PCI-DSS Compliant Secure Encrypted Connection" badge, and a "UPI / NetBanking / Cards — 1-Click Select" row that selects nothing (CheckoutCanvas.tsx:98-100, 216-230).
- **Problem**: invented taxes and false compliance claims are the adversarial audit's "fake payment enforcement" finding still alive. Legally risky, trust-fatal if noticed.
- **Fix**: until real payment rails exist, the honest framing is "**Booking commitment — no payment collected yet**": show base costs + "taxes & fees shown at provider checkout", remove PCI badge and the fee/GST lines. When payments land, compute fees server-side on the ledger.
- **Priority**: P0 · **Complexity**: S · **UX gain**: removes the most legally-exposed fake in the product.

### T5 — Hardcoded "Local Travel Tips" masquerade as intelligence on every trip
- **Current**: `AIInsightsPanel` ships a static per-category `localTip` — "Himalayan cab unions do not allow outside cabs", "Most riverside cafes accept GPay" — rendered under a "Local Travel Tip" header for **any** item on **any** trip ([AIInsightsPanel.tsx:72-137](../frontend/src/features/planner/workspace/plan-canvas/AIInsightsPanel.tsx)).
- **Problem**: a Goa or Jaipur trip gets Himalayan cab-union advice. This violates the product's own provenance rules (nothing synthesized client-side) on the most prominent "AI" surface, and it's precisely the "stale/irrelevant context" the Replace-experience mandate targets.
- **Fix**: delete the static map. Render only `details.local_tips` from the reviewed LocalTip pipeline (already flowing through RichHoverCard, RichHoverCard.tsx:109) — absent is the honest default. If a category-level fallback is wanted, it must come from the knowledge engine keyed by destination, with a provenance chip.
- **Priority**: P0 · **Complexity**: S · **UX gain**: the AI panel stops being provably wrong.

### T6 — Flight results fabricate price/seats/baggage under a "Live search" label
- **Current**: `price = flight.providers?.[0]?.price || cabinClass?.price || 4850`, `seats = … || '12 seats left'`, `baggage = … || '15 kg'` ([FlightCanvas.tsx:109-112](../frontend/src/features/planner/workspace/helper-canvases/booking/canvases/FlightCanvas.tsx)), all stamped `provenance: { tier: 'estimated', source: 'Live search' }`.
- **Problem**: "12 seats left" is a scarcity cue — fabricating it is a dark pattern; ₹4,850 is a made-up price entering the ledger.
- **Fix**: missing fact → absent UI ("price on request", no seat count), never a default. Provenance source must state the actual provider (or "mock inventory" in dev).
- **Priority**: P0 · **Complexity**: S · **UX gain**: scarcity/price signals become trustable.

### T7 — Fake IATA codes derived from string truncation
- **Current**: `TransportNode` renders `titleParts[0].substring(0, 3).toUpperCase()` as departure/arrival codes ([TransportNode.tsx:96-103](../frontend/src/features/planner/workspace/plan-canvas/nodes/TransportNode.tsx)) — "New Delhi to Manali" → **NEW → MAN** in airport-code styling.
- **Problem**: MAN is Manchester. Users who know codes will spot it instantly; users who don't are being taught wrong ones.
- **Fix**: render real codes when block metadata has them (generation knows the airports; stamp `origin_code`/`dest_code` during the pricing phase), otherwise show truncated **city names**, not code-styled tokens.
- **Priority**: P1 · **Complexity**: S (frontend) + S (stamp codes in `plan_generation.py` phase 6) · **UX gain**: transport cards read professional.

### T8 — Three competing booking-state vocabularies, none fully rendered
- **Current**: `status: 'Confirmed'|'Pending'|'Book Now'` (display), `blockStatus: idea|planned|priced|booked` (commitment ladder), `cost.provenance.tier` (price trust). Cards show only the provenance badge + "approx." prefix; `AIInsightsPanel` shows `status`; header counts `status`; checkout filters `blockStatus`.
- **Problem**: the user-facing question — *is this reserved, priced, or a suggestion?* — has no single answer anywhere. The mandate's "Confirmed / Available / Estimated / Unavailable + last updated" grammar exists in the data (`verified_at` is even in `CostProvenance`, types.ts:8) but never renders.
- **Fix**: one **BookingStateChip** component derived from `blockStatus` (Booked ✓ / Priced / Planned / Idea), rendered on every node, canvas card, checkout row, and wallet pass; provenance stays as the price-level badge with `verified_at` in the tooltip ("Verified 2h ago"). Deprecate display `status` (derive it, never store it).
- **Priority**: P1 · **Complexity**: M · **UX gain**: booking confidence becomes legible at a glance — the single highest-leverage UI unification available.

### T9 — Stock Unsplash photos presented as place imagery on map pins
- **Current**: `getFallbackImageUrl` returns generic Unsplash hotel/food/transit photos for pins without images ([PlannerMap.tsx:42-53](../frontend/src/features/planner/workspace/plan-canvas/PlannerMap.tsx)).
- **Problem**: a photo of *some* hotel on the pin of *your* hotel is fabricated data in miniature.
- **Fix**: category-glyph pins (the canvas-drawn colored pin already exists at PlannerMap.tsx:56+) for imageless places; photos only when they're the place's own.
- **Priority**: P2 · **Complexity**: S · **UX gain**: map stops implying photos it doesn't have.

### T10 — Traveler count regex-parsed from a display string at checkout
- **Current**: `planData.stats.match(/(\d+)\s+traveller/i)` (CheckoutCanvas.tsx:33-37) even though `planData.travelers` exists as a structured field — and types.ts:83 explicitly forbids parsing display strings.
- **Problem**: copy change → passenger form silently collapses to 1 traveler → booking for the wrong party size.
- **Fix**: `planData.travelers ?? 1`. Delete the regex.
- **Priority**: P1 · **Complexity**: S · **UX gain**: passenger form is always right.

---

## 2. Findings — Replace experience & internal consistency (R)

### R1 — Insights go stale the moment the plan changes
- **Current**: `handlePlanDataChange` invalidates ledger/workspace queries but **not** `plannerKeys.insights` ([PlannerWorkspace.tsx:299-303](../frontend/src/features/planner/workspace/PlannerWorkspace.tsx)); insights only refetch after a dismissal (usePlannerQueries.ts:88).
- **Problem**: delete the far-flung attraction that triggered "Day 3 covers 9 km on foot" and the warning stays, now describing a plan that doesn't exist. This is the mandate's core Replace-experience failure, in one missing invalidation.
- **Fix**: invalidate `insights` (and `proposals`) in `handlePlanDataChange` and after accept/reject/verify. Server side is already content-hash-scoped (dismissals key on `context_hash`), so recomputation is cheap and dismissals correctly resurrect when content actually changes.
- **Priority**: P0 · **Complexity**: S · **UX gain**: the planner stops contradicting itself after edits.

### R2 — Replace keeps the old occupant's alternatives and day context
- **Current**: `mergeReplacementItem` deliberately preserves `_aiInsights` slot alternatives (blockMerge.ts:93) — defensible — but those candidates' `aiTip`s were written relative to the *old* occupant, and nothing regenerates the **day title** ("Old Manali café crawl") or day-level narrative when its anchor item changes.
- **Problem**: swap the café crawl's centerpiece for a museum and the day is still titled and tipped as a café crawl. Partial consistency reads as carelessness.
- **Fix**: add a lightweight server hook `POST blocks/{bid}/replaced/` (or piggyback the PATCH) that: drops candidate aiTips referencing the old title, re-scores alternatives by distance to the new coords, and files a **proposal** to retitle the day when the replaced block was its anchor (AI proposes, user decides — reuse the existing proposal grammar).
- **Priority**: P1 · **Complexity**: M · **UX gain**: replace feels like the plan actually absorbed the change.

### R3 — Deleted items never leave the plan
- **Current**: deletion sets `isInactive: true`; items are filtered from view but serialized forever (`is_active: false`, planTransform.ts:245) with no purge and no way to see/restore them later.
- **Problem**: unbounded growth of ghost blocks in the `days` JSON; ledger/insight code must remember to filter them everywhere (checkout already had to); users can't recover something deleted 6 seconds ago.
- **Fix**: keep soft-delete for the 5s undo window, then **actually remove** the block on the next PATCH — and back the undo story with R4's real undo stack instead. If "recently removed" has product value, give it a surface (kebab → "Removed items"), not a hidden flag.
- **Priority**: P2 · **Complexity**: S–M · **UX gain**: data model matches what users see.

### R4 — No undo/redo for anything except the 5-second delete countdown
- **Current**: moves, replaces, time changes (once they exist), renames are irreversible; `PlannerTripOriginal` (pristine snapshot) exists server-side but "reset to original" is unbuilt.
- **Problem**: a drag mis-drop silently PATCHes; the user's only recourse is manual reconstruction. Editing confidence — a precondition for editing at all — is missing.
- **Fix**: client-side command stack over `TripViewModel` (every mutation already funnels through `handlePlanDataChange` — one choke point makes this cheap): Ctrl+Z/⌘Z + an undo toast after destructive ops. Debounce PATCHes ~1.5s so undo usually beats the network. Add "Reset to original plan" in the kebab, powered by `PlannerTripOriginal`.
- **Priority**: P1 · **Complexity**: M · **UX gain**: transforms editing from cautious to fearless.

### R5 — Focus snaps to Day 1 after every edit
- **Current**: the `useEffect` on `[planData]` unconditionally resets `activeCityId`/`focusedDayId` to the first city/day and re-triggers prefetch ([PlannerWorkspace.tsx:187-196](../frontend/src/features/planner/workspace/PlannerWorkspace.tsx)) — and `planData` is replaced on *every* mutation.
- **Problem**: edit Day 5, and the chips (plus every helper-canvas default context) jump back to Day 1. Users planning day-by-day get yanked to the top of the trip after each change.
- **Fix**: initialize focus only when the workspace id changes (or `focusedDayId` is null). Prefetch keyed by city name is already idempotent but should move to the same guard.
- **Priority**: P0 (it's a bug, not a polish item) · **Complexity**: S · **UX gain**: the planner stops fighting the user's place in the trip.

---

## 3. Findings — Timeline experience (TL)

### TL1 — No way to edit times; no durations
- **Current**: items carry `startTime`/`endTime` but no surface edits them; most non-transport items show a start time only.
- **Problem**: "planning" without time control isn't planning — you can't fix "restaurant closes before we arrive" even if the planner told you. All gap/conflict intelligence (IN2) is blocked on this.
- **Fix**: inline time editing on the node time gutter (click → time picker; drag-handle on end-time for duration later). PATCH via the existing serialize path. Show duration ("2h 30m") next to the range.
- **Priority**: P1 · **Complexity**: M · **UX gain**: unlocks both editing and the entire conflict-intelligence roadmap.

### TL2 — No day-part rhythm (Morning / Afternoon / Evening)
- **Current**: a day is a flat list; scanning position-in-day requires reading each time label.
- **Fix**: thin day-part separators computed from start times (no data change), giving the eye anchor rows; gaps ≥3h between parts render as a subtle "free window" row — which becomes the click target for gap suggestions (IN2).
- **Priority**: P2 · **Complexity**: S–M · **UX gain**: the timeline becomes scannable at a glance — biggest pure-readability win available.

### TL3 — Drag ergonomics: whole-card drag, silent cross-city rejection
- **Current**: dnd-kit `listeners` spread on the whole card (GenericNode.tsx:90-93) — every click risks a micro-drag, text can't be selected; dragging into another city is silently ignored (`if (activeInfo.cityIndex !== overInfo.cityIndex) return`, ItineraryTimeline.tsx:153,183) — the card just snaps back with zero explanation.
- **Fix**: dedicated grip handle (visible on hover, always on touch); cross-city drop either works (splice + PATCH — the data supports it) or shows a "Can't move between cities — use ⋯ → Move to day" hint. Add a "Move to day…" kebab action as the accessible/mobile path.
- **Priority**: P1 · **Complexity**: M · **UX gain**: the most common edit gesture stops feeling risky.

### TL4 — Nav chips track hover, not scroll
- **Current**: `activeCityId`/`focusedDayId` update on `onMouseEnter` of sections (ItineraryTimeline.tsx:306,322); scrolling doesn't update chips; moving the mouse across the list makes the chip row flicker through states.
- **Fix**: IntersectionObserver scroll-spy drives chips; hover drives only the map/insights preview. Keep click-to-scroll.
- **Priority**: P2 · **Complexity**: S · **UX gain**: navigation state becomes believable.

### TL5 — "Add" is attraction-shaped only
- **Current**: both add buttons hardcode `nodeType: 'activity'` → AttractionsCanvas (ItineraryTimeline.tsx:479-495, 506-521). Adding a meal, hotel, or cab to a day requires clicking an *existing* node of that type.
- **Fix**: "Add" opens a small type menu (Attraction · Restaurant · Hotel · Transport · Cab) routing to the right canvas with day context. Insert-between affordance on the connector line (the distance pill row is already there) for the common "add a stop between A and B".
- **Priority**: P1 · **Complexity**: S–M · **UX gain**: completes the "everything belongs to the timeline" promise.

### TL6 — Perpetually pulsing "Detour" pill
- **Current**: >12 km legs render an amber `animate-pulse` pill forever (ItineraryTimeline.tsx:389-397); the threshold is absolute regardless of trip scale (12 km is a detour in Old Manali, a normal hop in Delhi).
- **Fix**: static amber chip (pulse only on first appearance, respecting reduced motion); threshold relative to the day's median leg or city radius. Clicking it should offer the fix (reorder proposal / book cab), not just open the cab canvas.
- **Priority**: P2 · **Complexity**: S · **UX gain**: alerts read as information, not alarm.

### TL7 — Collapse state and scroll position are ephemeral
- **Current**: collapse maps live in component state; reload loses them; no "collapse others when I expand a day" mode.
- **Fix**: persist per-workspace UI state (localStorage), add day-focus mode (chip click = expand+scroll that day, collapse rest — one line once state is centralized).
- **Priority**: P3 · **Complexity**: S · **UX gain**: long trips stay manageable.

### TL8 — Day headers waste their prime slot
- **Current**: Day N + date + optional weather chip + title (DayHeaderNode.tsx). No cost subtotal, no item count, no walking load, no time span — all cheaply computable from data already on the client (`transitHints`, costs).
- **Fix**: right-aligned micro-stats on the day header: `₹4,200 · 5 stops · 6.2 km`, using the existing token/type scale. Doubles as the collapsed-state summary (collapsed days currently collapse to nothing but a title).
- **Priority**: P2 · **Complexity**: S · **UX gain**: collapsed timeline becomes an itinerary overview for free.

### TL9 — Booked/confirmed state invisible on the timeline
- **Current**: a booked block looks identical to a suggested one except the price prefix and a tiny provenance badge; `isVeryLastItem`-style visual bookkeeping exists but no state styling.
- **Fix**: BookingStateChip (T8) + a subtle left-edge accent on booked nodes (emerald hairline) so the "what's locked vs fluid" question is answerable by squint.
- **Priority**: P1 (rides on T8) · **Complexity**: S · **UX gain**: trip completeness becomes visible.

### TL10 — Magic-number geometry and off-token spine
- **Current**: `pl-[70px]`, `pl-[144px]`, `left-[38px]`, `bg-slate-800` spine hardcoded across timeline/nodes; the black spine is the heaviest element on a warm-paper page.
- **Fix**: extract gutter geometry to CSS vars alongside the token pass (VS1); spine to `--ink-900`/`--line-strong` at reduced weight.
- **Priority**: P2 · **Complexity**: S · **UX gain**: visual calm; enables gutter changes for mobile.

---

## 4. Findings — Booking flows & canvases (BK)

### BK1 — Hotel canvas omits every fact a hotel booking needs
- **Current**: text search + rating/price-level filters; cards show photos/rating/facts. **No** check-in/out dates, nights, rooms, guests; no nightly rate (known `HotelMaster` gap — the redesign plan's "on-select Booking.com rate check" is not wired into this UI); no cancellation policy; no price trend (backend `TravelPriceHistory` exists!); no distance-to-my-itinerary.
- **Problem**: the mandate's hotel card spec (photos ✓, rating ✓, reviews ✓, amenities ✓, distance ✗, cancellation ✗, price trend ✗, room types ✗, booking CTA ✗) is half-implemented; users must leave the product to decide, which is where they'll also book.
- **Fix**: (a) stay-context bar at the top of the canvas (dates/nights/guests auto-derived from the city the active node lives in, editable); (b) on expand, fire the live rate check → upgrade cost to verified with nightly × nights math; (c) "distance from your Day-N stops" chip (haversine vs the focused day's items — client-side, free); (d) price-trend sparkline from `TravelPriceHistory`; (e) split CTA "Add to trip / Add & book" like FlightCanvas already has.
- **Priority**: P1 · **Complexity**: L (a–c M; d–e M) · **UX gain**: hotels become decidable in-product — the single biggest booking-conversion lever.

### BK2 — Hotels are day-items, not stays
- **Current**: a hotel is an `ItineraryItem` inside one day; a 3-night stay has no span representation, no per-night cost logic, no check-in/out semantics.
- **Problem**: replace the Day-2 hotel and Days 3–4 still "stay" wherever they implicitly were; ledger counts a nightly price once.
- **Fix**: introduce a stay-span concept **within block schema v2 metadata** (`nights`, `check_in`, `check_out` on the hotel block; timeline renders a slim "staying at X" continuation ribbon on covered days). No new architecture — one block, richer metadata, one new render affordance.
- **Priority**: P1 · **Complexity**: L · **UX gain**: lodging stops being a fiction the ledger multiplies wrong.

### BK3 — No cross-mode transport comparison ("flight vs train vs bus for this leg")
- **Current**: Flight/Train/Bus/Cab are separate canvases; a transit block opens only its own type's canvas. Nothing answers the mandate's core Transport Intelligence question — *what's the right mode for this leg, and why*. Backend has the pieces: `TravelPriceHistory` per mode, `DistanceService`, route tables, `TransferProfile` (LLM-seeded hub notes — currently unused by any UI).
- **Fix**: a **TransportCompareCanvas** for inter-city legs: one row per feasible mode with duration, price band (history-estimated tier), comfort note, and a WHY line ("Train wins: 4h door-to-door vs 3h flight + 2h airport overhead" — `TransferProfile.typical_min_connection_mins` finally earns its keep). Deep-links into the mode's canvas for booking. Backend: one endpoint composing existing services (`GET /planner/legs/compare?from&to&date`).
- **Priority**: P1 · **Complexity**: L · **UX gain**: this is the "Google-Travel intelligence" differentiator, built from parts that already exist.

### BK4 — Trip-level transportation preferences don't exist post-generation
- **Current**: chat collects `trip_pace`, `priority` etc. into `TripDraftState` at draft time (models.py:226-230); after generation nothing exposes or applies preferences (Cheapest/Fastest exist only as per-canvas filter chips).
- **Fix**: preferences panel in the header kebab (Cheapest / Fastest / Comfort / Avoid flights / Avoid overnight / Minimal transfers — persisted to `TravelerProfile`, which already exists), consumed by (a) TransportCompareCanvas ranking, (b) canvas default sort, (c) generation prompt (already partially plumbed). Changing a preference files a **proposal** to re-rank affected transit blocks — never a silent rewrite.
- **Priority**: P2 · **Complexity**: M · **UX gain**: the planner starts feeling personal.

### BK5 — Cab flow exists only where a distance pill happens to render
- **Current**: pill needs both coords and >0.3 km (ItineraryTimeline.tsx:361-366); airport→hotel on arrival day, station→hotel etc. get no automatic transfer suggestion — the mandate's flagship examples.
- **Fix**: generation phase 5 already computes consecutive-pair distances; extend it to emit **transfer stubs** (suggested-tier cab blocks) for arrival/departure legs and >2 km gaps, rendered as ghost "Add transfer" rows the user can accept. Client-side fallback: synthesize the ghost row whenever a day's first item is >2 km from the previous anchor.
- **Priority**: P1 · **Complexity**: M · **UX gain**: transfers stop being the user's job to remember.

### BK6 — Checkout has no item-level control
- **Current**: all-or-nothing pay button; no per-item remove/defer; no partial booking; failure is a whole-screen error.
- **Fix**: checkbox per line item (default all bookable-and-priced), disabled-with-reason rows for unpriced items ("Verify price first" inline action). Partial success renders per-item outcomes, not a binary screen.
- **Priority**: P1 · **Complexity**: M · **UX gain**: booking becomes a decision, not a dare.

### BK7 — Ratings floored to integers when items enter the plan
- **Current**: `Math.floor(pendingItem.rating)` in HotelCanvas.tsx:127 and AttractionsCanvas.tsx:151 — a 4.9 hotel becomes "4" on its timeline card.
- **Fix**: keep one decimal (`Math.round(r * 10) / 10`); it's already displayed that way in SuggestionCard.
- **Priority**: P1 (it misrepresents real data) · **Complexity**: S · **UX gain**: small, but it's the difference between 4 and 4.9 stars.

### BK8 — Canvas context prefill parses display strings
- **Current**: FlightCanvas derives origin/destination by splitting subtitle/title on " to " with `from`-stripping heuristics (FlightCanvas.tsx:43-54); hardcoded `'Delhi (DEL)'`/`'Bhuntar (KUU)'` defaults; `', India'` suffixes and `nationality: 'Indian'` hardcoded across canvases.
- **Fix**: transit blocks should carry structured `origin`/`destination` (+codes, per T7) in metadata from generation; canvases read those. Market defaults move to one config (`market.ts`), not per-component literals.
- **Priority**: P2 · **Complexity**: M · **UX gain**: prefill stops guessing.

### BK9 — Search state resets and refetches on every keystroke
- **Current**: `useEffect(() => { fetchHotels(searchQuery); }, [searchQuery])` fires per keystroke with no debounce/abort (HotelCanvas.tsx:70, AttractionsCanvas.tsx:90-92); quick-filter tag selections (`Temples`, `Trekking`…) are collected but **never applied** to results in AttractionsCanvas (only Hotel's tags filter).
- **Fix**: 350 ms debounce + AbortController; wire the sight/activity tags into an actual filter (client-side keyword match now, server `type` param later). Dead filters are worse than no filters.
- **Priority**: P2 · **Complexity**: S · **UX gain**: search feels intentional; filters stop lying.

---

## 5. Findings — Intelligence & richness (IN)

### IN1 — The insight engine has an architecture and two rules
- **Current**: `PlanInsightEngine` runs `DailyWalkLoadWarning` + `HeatExposureWarning` (insight_engine.py:113); the docstring's own backlog (ClosesBeforeArrival, CrowdPeak, HotelTravelTimeSaving, TimeBudgetTradeoff…) is unimplemented. The mandate's marquee moments — "5-hour gap", "closes before you arrive", "check-in after arrival" — are all rules, all feasible on **existing data** (opening_hours live in details; times are on blocks; check-in conflicts need only the transit block's times).
- **Fix — next 4 rules, data-ready today**: ① `OpeningHoursConflict` (block start/end vs place opening_hours — needs TL1's times to be trustworthy), ② `ScheduleGap` (≥3h between consecutive items → suggestion with the day's cached candidate pool, `action` = insert proposal), ③ `CheckInMismatch` (arrival transit end vs hotel check-in from BK2 metadata), ④ `LateArrivalWarning` (inter-city transit ending after 22:00 with activities next morning before 09:00). Rules ② onward set `action` so they arrive as accept/reject proposals — the grammar already exists.
- **Priority**: P1 · **Complexity**: M per rule pair · **UX gain**: this is where "smart" stops being a gradient background and starts being true.

### IN2 — No destination-intelligence surface
- **Current**: seasonal weather chips + visa + forex are the only destination-level facts. The mandate's list (safety, scams, customs, packing, festivals, payments, sockets, emergency numbers, connectivity, apps) has a designed home — the Travel Intelligence roadmap's 12 domains (docs/travel-intelligence-implementation-roadmap.md) — but zero UI today. `LocalTip` (human-review-gated) already flows to place hovers.
- **Fix (phased, honest)**: a **City Briefing** section under each CityHeaderNode (collapsed by default): starts with what's real *now* — weather normals, reviewed LocalTips aggregated at city level, TravelSeason — and grows a domain at a time as the knowledge pipelines land. Every fact carries provenance; no domain renders until its pipeline is real (no placeholder "scam alerts").
- **Priority**: P2 (P1 for the briefing shell + the 3 real domains) · **Complexity**: M shell · **UX gain**: "feels alive" without a single invented fact.

### IN3 — No image gallery anywhere
- **Current**: photos render as tiny non-clickable strips (RichHoverCard h-14 thumbs, SuggestionCard h-24 scroll row); the only "gallery" match in the codebase is an unrelated explore panel. The mandate's fullscreen gallery (zoom/keys/swipe/attribution) doesn't exist.
- **Fix**: one shared `MediaLightbox` (portal, keyboard arrows + Esc, pinch/swipe on touch, caption + Google attribution — attribution is *required* by Places photo terms, which today's rendering likely violates), invoked from every photo strip. Lazy-load full-size only on open.
- **Priority**: P1 (attribution makes it partly a compliance item) · **Complexity**: M · **UX gain**: images shift from decoration to persuasion — hotels and attractions sell themselves.

### IN4 — Hover is the only door to rich details, and it's a nervous one
- **Current**: `RichHoverCard` renders inside the bottom-right panel on hover, remounting with a fade for **every node the pointer crosses** (AnimatePresence keyed by item.id, AIInsightsPanel.tsx:145-152). Sweep the mouse down the timeline and the panel strobes through items. Touch devices get nothing at all.
- **Fix**: 150 ms hover-intent delay before switching; pin-on-click (clicking a node pins its details; explicit unpin); this same click-pinned state is the mobile pathway (bottom sheet, MB1).
- **Priority**: P1 · **Complexity**: S–M · **UX gain**: the insight panel becomes readable instead of a slideshow.

### IN5 — Weather is seasonal-normal only, silently
- **Current**: day chips show `~24° · light rain season` from WeatherNormals with only a hover title distinguishing it from a forecast (DayHeaderNode.tsx:25).
- **Fix**: keep normals (honest, free) but label inline for trips within forecast range ("seasonal avg"); when a real forecast API lands (deferred debt), swap within the same chip with a provenance flip. Rain-driven reorder suggestions become an IN1 rule then.
- **Priority**: P3 · **Complexity**: S · **UX gain**: prevents the most predictable "the app said sunny" complaint.

### IN6 — Alternatives panel can't say *why* a recommendation is good
- **Current**: candidates render title/rating/price + generic aiTip (AIInsightsPanel.tsx:278-308); no comparison against the current occupant ("closer to your Day-2 cluster", "₹400 cheaper", "open on Monday when X is closed").
- **Fix**: compute 1-line comparative reasons client-side from data already in hand (distance delta vs day centroid, price delta, rating delta, hours). This is the mandate's "AI recommendation reason" delivered with zero LLM calls.
- **Priority**: P2 · **Complexity**: S–M · **UX gain**: swaps become reasoned decisions.

---

## 6. Findings — Performance (PF)

### PF1 — Hover re-renders the entire workspace
- **Current**: `hoveredItem` lives in `PlannerWorkspace` state; every node hover re-renders the whole tree — timeline (100+ nodes), map (pan/bounce per hover), insights panel remount. None of the node components are memoized.
- **Fix**: move hover into a context/zustand slice consumed only by map + insights; `React.memo` all node components (props are already stable shapes); pass stable callbacks (useCallback) from the timeline.
- **Priority**: P1 · **Complexity**: M · **UX gain**: buttery hover on long trips; prerequisite for a 3-week itinerary not chugging.

### PF2 — Deep-clone-per-interaction
- **Current**: `JSON.parse(JSON.stringify(planData))` on every mutation path — replace, drag-over (every crossed row!), delete, undo, verify (PlannerWorkspace.tsx:353,457; ItineraryTimeline.tsx:77,156,189,201…). Drag-over clones the whole trip repeatedly during a single drag.
- **Fix**: immer (`produce`) at the two choke points (`updateData`, `handlePlanDataChange`) — structural sharing, and memoized nodes (PF1) then actually skip re-rendering.
- **Priority**: P2 · **Complexity**: S–M · **UX gain**: drag stops stuttering on big trips.

### PF3 — Skeletons don't match the layout they precede
- **Current**: loading state is three generic pulsing blocks (PlannerWorkspace.tsx:536-549) — the real layout (header card, chip row, timeline gutter, split map) pops in with a full layout shift.
- **Fix**: skeleton mirrors the real composition (header rect + chip row + 3 node-shaped rows with the left gutter + right split). One-time cost, permanent polish.
- **Priority**: P2 · **Complexity**: S · **UX gain**: load feels engineered, not accidental.

### PF4 — Full-DOM raster PDF export
- **Current**: html2canvas screenshots the entire timeline at 2× into a single-page PNG-in-PDF (PlannerWorkspace.tsx:248-276) — enormous files, unselectable text, fonts/emoji at the mercy of canvas, long trips can exceed canvas limits.
- **Fix**: server-rendered export (or client `@react-pdf`) from the trip data: paginated days, real text, booking refs, map thumbnails. The PDF is a share artifact — one of the few things travelers show other people; it deserves data-driven layout.
- **Priority**: P2 · **Complexity**: M–L · **UX gain**: the shareable artifact stops embarrassing the product.

### PF5 — Duplicate canvas caches with no expiry
- **Current**: three parallel zustand stores (hotel/attraction/activity details) + React Query + a module-level `prefetchCache` (workspacePrefetch.ts) that holds results forever per session and isn't consumed by the canvases' fetch paths at all.
- **Fix**: consolidate on React Query (staleTime per category); delete the zustand detail stores and the orphan prefetch cache, or wire prefetch through `queryClient.prefetchQuery` so canvases actually hit it.
- **Priority**: P2 · **Complexity**: M · **UX gain**: canvases open warm; one cache to reason about.

---

## 7. Findings — Mobile (MB)

### MB1 — There is no mobile Planner
- **Current**: fixed-percentage split panes resized by `mousemove` only (PlannerWorkspace.tsx:202-222); the right panel (map/insights/canvases) is reachable **only** via hover or node click; 13 responsive-prefix classnames across the entire workspace; 70–144 px timeline gutters; 9–11 px type; dnd as the only reorder method. On a phone this renders as two crushed columns you cannot operate.
- **Problem**: the mandate is explicit — design mobile, don't shrink desktop. Today it's neither.
- **Fix (composition, reusing every existing component)**:
  - `<768px`: single-pane **timeline-first**; header condenses to title + budget bar; day chips become a horizontally-snapping day pager.
  - Node tap → **bottom sheet** = `RichHoverCard` + `AIInsightsPanel` content (they're already self-contained components; this is a re-housing, not a rewrite).
  - Helper canvases → full-screen sheets with sticky Add/Book CTA.
  - Map → toggle tab (Timeline ⇄ Map), not a simultaneous pane.
  - Reorder via "Move to day…" action (TL3) instead of drag; 44 px touch targets; DockedChat button avoids the thumb-zone CTA.
- **Priority**: P1 (P0 if mobile traffic matters commercially — for a travel product it does) · **Complexity**: XL · **UX gain**: the product exists on the device travelers actually carry.

---

## 8. Findings — Accessibility (AX)

### AX1 — The timeline is mouse-only in practice
- **Current**: 9 total aria/keyboard/role occurrences across the feature. Node cards get `role`/`tabIndex` incidentally from dnd-kit's `{...attributes}`, but Enter/Space engage **drag**, not the card's `onClick`; TransitNode/SuggestionCard/day-header toggles are plain clickable divs; kebab menu has no Escape/focus trap; no `aria-live` for save/book/optimize outcomes; no `prefers-reduced-motion` handling anywhere (perma-`animate-pulse` detour pills, bounce, framer transitions).
- **Fix (one pass, component by component)**: real `<button>`s for every interactive element; separate drag handle carrying the dnd attributes (also fixes TL3); `aria-expanded` on collapse toggles; `aria-live="polite"` region fed by the existing notice/saving states; `motion-safe:` variants + a framer `useReducedMotion` gate; focus-visible rings from the token system; audit 9–10 px text up to ≥11 px with AA contrast (ink-500-on-paper needs checking).
- **Priority**: P1 · **Complexity**: L (mechanical but wide) · **UX gain**: legally safer, keyboard-usable, and the drag-handle work pays UX dividends for everyone.

---

## 9. Findings — Visual system (VS)

### VS1 — Two design languages on one screen
- **Current**: header/hover-card/insight-strip speak the token language (`ink-*`, `paper-*`, `line-*`, trust tokens); the timeline, all nodes, and all canvases still hardcode `slate-*/rose-*/emerald-*/indigo-*` (the master-plan v2 token-enforcement pass, still pending).
- **Fix**: finish the sweep, file-by-file (nodes → timeline → canvases → checkout), with before/after screenshots per component as the redesign plan already prescribes.
- **Priority**: P2 · **Complexity**: M (mechanical) · **UX gain**: coherence — the "Notion consistency" bar.

### VS2 — Category colors disagree across surfaces
- **Current**: activity is rose on nodes, emerald in AIInsightsPanel; flight is violet on TransportNode, indigo in AIInsightsPanel; hotel indigo vs violet; map pins collapse activity+attraction into one rose. `--cat-*` tokens exist (`--cat-stay`, `--cat-food`…) and are used by none of these.
- **Fix**: one `CATEGORY` map (icon + token) imported by nodes, panels, canvases, map pins, checkout rows. Delete the per-file switch statements.
- **Priority**: P2 · **Complexity**: S–M · **UX gain**: the same object finally looks like the same object everywhere.

### VS3 — Emoji as system iconography
- **Current**: 📍 city chips, 📂/📁 collapse, 🚘 transit pills, 🛒 empty cart, 🏛️/⚡ tab labels — mixed with lucide icons, unthemeable, platform-inconsistent.
- **Fix**: lucide equivalents everywhere UI-functional; emoji reserved for AI-voice moments (chat).
- **Priority**: P2 · **Complexity**: S · **UX gain**: premium reads in the details.

### VS4 — Weight and case inflation flatten hierarchy
- **Current**: `font-black`/`font-extrabold` + uppercase-tracking micro-labels are the default voice everywhere, so nothing is emphatic; the type-scale tokens (display/title/body/caption/micro) shipped in Phase 4 are largely unused in these files.
- **Fix**: apply the scale during the VS1 sweep: node titles = title token (semibold), metadata = caption, micro-labels reserved for true labels. Prices always `tabular-nums`.
- **Priority**: P2 · **Complexity**: rolled into VS1 · **UX gain**: calm, scannable, Linear-grade text.

### VS5 — Off-brand moments at emotional peaks
- **Current**: "Checkout OS" as a user-facing title; the `!planData` empty state on `bg-slate-50` with an emoji globe (PlannerWorkspace.tsx:552-566); success screen `animate-bounce` check.
- **Fix**: checkout titled "Review & book"; empty state on paper tokens with a real CTA into the chat ("Describe your trip" button that opens DockedChat — see CH2); success state uses a drawn check animation honoring reduced motion.
- **Priority**: P2 · **Complexity**: S · **UX gain**: the beginning and end of the journey feel designed.

---

## 10. Findings — Chat & conversational editing (CH)

### CH1 — Chat can talk about the trip but not touch it
- **Current**: the docked chat is the same slot-filling/Q&A thread that built the trip; it cannot execute "move dinner earlier", "swap the museum for something indoors", "add a cab from the airport".
- **Fix**: intent → **proposal** bridge: a small set of plan-edit intents (move/replace/add/remove/re-time) that the engine converts into `PlanProposal`s rendered with the existing ProposalCard accept/reject grammar. The trust model is already built for exactly this; chat just needs to file into it.
- **Priority**: P1 · **Complexity**: L · **UX gain**: the "AI planner" claim becomes literally true post-generation.

### CH2 — The empty workspace tells users to talk to an AI it hides
- **Current**: "Tell the AI what kind of trip you want to plan…" copy, while the chat is a small sparkle FAB bottom-right (DockedChat) with no visual connection.
- **Fix**: empty state's primary button opens DockedChat directly (or embeds the chat input inline); the FAB gets a first-run label ("Trip chat").
- **Priority**: P2 · **Complexity**: S · **UX gain**: first-session activation.

---

## 11. Implementation roadmap (ordered by user impact)

Each wave is shippable alone; nothing replaces existing architecture. Verification bar per wave: `tsc --noEmit` + `next build` + backend tests green + a written before/after behavioral check like the redesign plan's §8.

### Wave 0 — Stop the lying (P0 correctness, ~2–4 days total, all S/M)
The trust grammar is the product's spine; these are spine fractures. Do these before any feature work.
1. **T1** transit status escalation on PATCH (planTransform.ts:279) + regression test.
2. **T2** checkout total = listed items only (or server ledger).
3. **T3** book only bookable+priced blocks; surface 409 `blocking_blocks`.
4. **T4** remove fabricated fee/GST/PCI/payment-select; honest "no payment collected" framing.
5. **T5** delete hardcoded local tips; render reviewed `local_tips` only.
6. **T6** no fabricated price/seats/baggage fallbacks.
7. **R5** stop focus reset on every edit.
8. **R1** invalidate insights/proposals on plan change.
9. **T10** travelers from structured field; **BK7** stop flooring ratings.

### Wave 1 — Make booking decidable (P1, ~2–3 weeks)
1. **T8/TL9** BookingStateChip + `verified_at` freshness — one grammar on every surface.
2. **BK1** hotel decision facts: stay-context bar, live rate check on expand, distance-to-itinerary, price-trend sparkline.
3. **BK6** per-item checkout with inline "verify price" unblocking.
4. **BK5** transfer stubs (airport→hotel etc.) as suggested-tier ghost blocks.
5. **T7/BK8** structured origin/destination(+codes) on transit blocks; kill string parsing.
6. **IN3** MediaLightbox with required photo attribution (partly compliance).
7. **IN4** hover-intent + pin-on-click details.

### Wave 2 — Make editing fearless (P1, ~2 weeks)
1. **TL1** inline time editing + durations (unblocks conflict rules).
2. **R4** undo/redo command stack + debounced PATCH + "Reset to original".
3. **TL3/AX-partial** drag handle, cross-city move or explicit "Move to day…", silent-rejection fix.
4. **TL5** typed Add menu + insert-between affordance.
5. **R2** replace → refresh day context server hook (proposal-based retitle).
6. **R3** real removal after undo window.

### Wave 3 — Make it actually intelligent (P1/P2, ~2–3 weeks)
1. **IN1** four new insight rules (OpeningHoursConflict, ScheduleGap→proposal, CheckInMismatch, LateArrival).
2. **BK3** TransportCompareCanvas + `legs/compare` endpoint (composes existing services; TransferProfile earns its keep).
3. **BK4** transport preference panel → TravelerProfile → ranking + re-rank proposals.
4. **IN6** comparative "why" lines on alternatives (client-computed).
5. **BK2** hotel stay-spans (nights metadata + continuation ribbon) — feeds CheckInMismatch and honest ledger math.
6. **CH1** chat-edit intents → proposals.

### Wave 4 — Make it feel premium (P2, ~2 weeks, parallelizable with Wave 3)
1. **VS1/VS4** finish the token + type-scale sweep (nodes → timeline → canvases → checkout).
2. **VS2** unified category map; **VS3** emoji → lucide; **VS5** empty/checkout/success states.
3. **TL2** day-part separators + free-window rows; **TL8** day-header micro-stats; **TL4** scroll-spy chips; **TL6** calm detour chip.
4. **PF1/PF2** hover state isolation + memoized nodes + immer.
5. **PF3** layout-true skeletons; **T9** honest map pins.
6. **IN2** City Briefing shell with the three already-real domains.

### Wave 5 — Make it universal (P1-scope, XL, its own track)
1. **MB1** mobile composition: timeline-first single pane, bottom-sheet details, full-screen canvas sheets, map toggle, move-to-day reorder, 44 px targets.
2. **AX1** accessibility pass riding the same component work (real buttons, drag handle split, aria-live, reduced motion, contrast).
3. **PF4** data-driven PDF export; **PF5** cache consolidation.
4. **IN5** forecast-ready weather chip.

### Explicitly not in scope (unchanged from redesign plan §9)
Graph-canvas timeline · payments rails · seat maps/fare families/room inventory · live visa/reservation APIs · metro routing. The audit found nothing that requires reopening these decisions.

---

## 12. What's already excellent (protect these)

Worth stating so the fixes don't regress them: the DB-first generation pipeline with hallucination rejection; real progress phases in the loading screen; the proposal accept/reject grammar; server-authoritative price verification with honest misses; provenance-tiered budget bar with hatched uncertainty; content-hash-scoped insight dismissals; the "no verified alternatives → offer real search" honesty path in AIInsightsPanel; `RichHoverCard`'s absent-by-default judgment lines; blockMerge's stale-metadata scrubbing on swap. The pattern that works: **absence over invention, proposals over silent changes, server truth over client guesses.** Every Wave above is that pattern applied to the places that still violate it.
