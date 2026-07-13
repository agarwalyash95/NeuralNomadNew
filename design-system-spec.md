# NeuralNomad Planner — Design System Spec

**Date:** 2026-07-13
**Scope:** The live planner UI — sidebar, chat panel, plan-canvas workspace (timeline + header), map, AI insights panel, and all 11 helper/execution canvases.
**Companion doc:** [contract-audit.md](contract-audit.md) (§5 loading/error standards referenced throughout). Contract batches 1–3 are applied; this spec governs the *visual* layer on top of that data contract.
**Status:** Specification + as-built audit. No code changed. Every "current" claim is cited `file:line`.

---

## 0. The core problem: two design systems are live at once

The codebase contains **one canonical design system** (warm-paper tokens, defined in [globals.css:17-133](frontend/src/app/globals.css)) and a **second, undocumented one** that most helper canvases still paint in (raw Tailwind `slate-*` / `bg-white` / `blue-600`). They do not agree on color, elevation, radius, or type.

| System | Where it lives | Tokens used |
|--------|----------------|-------------|
| **A — Canonical "warm paper"** | Sidebar, PlannerWorkspace, PlannerMap, AIInsightsPanel, timeline nodes, ExploreStatusUI, ProvenanceBadge | `ink-*`, `paper-*`, `line`, `--color-*`, `--shadow-*`, `--motion-*`, `.text-*` scale |
| **B — Ad-hoc "slate/white"** | CanvasHeader, SuggestionCard, VisaCanvas, ForexCanvas, BookingResults, FlightCanvas header, DockedChat, MessageBubble | `slate-50…900`, `bg-white`, `blue-600→indigo-600`, raw `shadow-sm/md/xl`, hardcoded `#e5dfd2` |
| **C — `.helper-canvas-premium` override** | Explore canvases (opt-in via wrapper class) | Remaps `paper/ink/line` to a *cooler slate* palette ([globals.css:357-373](frontend/src/app/globals.css)) |

The single biggest consistency win available is **collapsing B and C into A.** Everything below assumes A is the target.

---

## 1. Color tokens

### 1.1 Canonical palette (the source of truth — [globals.css:49-91](frontend/src/app/globals.css))

**Surfaces (warm paper):**
| Token | RGB | Hex | Use |
|-------|-----|-----|-----|
| `--paper-0` | `246 244 239` | `#f6f4ef` | Page shell / app background |
| `--paper-1` | `251 250 247` | `#fbfaf7` | Panels, canvas backgrounds |
| `--paper-2` | `255 255 255` | `#ffffff` | Cards (also `.travel-card`) |
| `--line` | `226 221 210` | `#e2ddd2` | Hairline dividers |
| `--line-strong` | `221 215 202` | `#ddd7ca` | Borders |

**Ink (text):**
| Token | Hex | Use |
|-------|-----|-----|
| `--ink-900` | `#1e1e1a` | Headings |
| `--ink-700` | `#44403a` | Body |
| `--ink-500` | `#7a746b` | Muted / captions |
| `--ink-400` | `#9c957b` | Faint labels |

**Semantic color (color psychology — [globals.css:60-75](frontend/src/app/globals.css)). These are load-bearing meanings, not decoration:**
| Token | Color | RESERVED for — nothing else may use it |
|-------|-------|----------------------------------------|
| `--color-booking` | blue-600 | Booking & navigation & links ONLY |
| `--color-ai` | violet-600 | AI intelligence ONLY |
| `--color-caution` | amber-600 | Suggestions / warnings |
| `--color-confirmed` | emerald-600 | Booked / verified / success |
| `--color-error` | red-600 | Problems / delete |
| `--color-journey` | sand `200 184 154` | Selected / active state |
| `--color-support` | slate-500 | Metadata / captions |

**Trust grammar (maps 1:1 to ProvenanceBadge):**
`--trust-verified` emerald · `--trust-estimated` amber · `--trust-suggested` violet.

**Category accents (must match `categoryStyle.ts` on every surface):**
`--cat-transport` sky · `--cat-stay` indigo · `--cat-food` orange · `--cat-activity` rose · `--cat-attraction` emerald.

### 1.2 The rule

> **Blue means booking. Violet means AI. They are not interchangeable and neither is a "primary brand color."** A surface that is *thinking* (chat, insights, suggestions) is violet. A surface that is *transacting* (flight/hotel/checkout) is blue. A surface that is *selected* is sand.

### 1.3 Color violations found (ranked)

| # | Where | Problem | Fix |
|---|-------|---------|-----|
| C1 | **Chat** — [MessageBubble.tsx:28](frontend/src/features/planner/chat/MessageBubble.tsx), [DockedChat.tsx:141](frontend/src/features/planner/chat/DockedChat.tsx) | User bubbles + send button are `blue-600→indigo-600`. Chat is an **AI** surface; blue reads as "booking." | Recolor conversation UI to `--color-ai` (violet). The DockedChat FAB already leans indigo/purple — commit it fully to violet. |
| C2 | **VisaCanvas** — [VisaCanvas.tsx:150-156](frontend/src/features/planner/workspace/helper-canvases/travel-prep/visa/VisaCanvas.tsx) | Health advisory card is `blue-50/blue-900`. Blue is reserved for booking. | Use `--color-support` (slate) or `--color-caution` (amber) for advisories. |
| C3 | **Everywhere in system B** | Raw `slate-50…900` stands in for `ink/paper/line`. Slate is cooler than warm paper; side-by-side with the timeline it reads as a different app. | Replace slate ramp with `ink/paper/line`. |
| C4 | **SuggestionCard** — [SuggestionCard.tsx:26-75](frontend/src/features/planner/workspace/helper-canvases/shared/SuggestionCard.tsx) | Per-category palettes hardcoded (`orange-500`, `emerald-600`, `rose-400`, `indigo-600`) instead of `--cat-*` tokens. Drifts the moment a token changes. | Drive from `--cat-food/attraction/activity/stay`. |
| C5 | **Hardcoded hex** `#e5dfd2` for chat borders ([DockedChat.tsx:119,142,158,177](frontend/src/features/planner/chat/DockedChat.tsx), [MessageBubble.tsx:29](frontend/src/features/planner/chat/MessageBubble.tsx)) | Off-token border color; near but not equal to `--line`. | Use `border-line`. |

**Good citizens (leave alone):** ProvenanceBadge, TierBadge, AIInsightsPanel (correctly all-violet for AI, [AIInsightsPanel.tsx:131-136,367,380,432](frontend/src/features/planner/workspace/plan-canvas/AIInsightsPanel.tsx)), FlightCanvas *results* (correctly blue — it is a booking canvas), PlannerMap journey-sand controls.

---

## 2. Spacing scale

There is **no named spacing scale**; the code uses Tailwind's default 4px step directly. That is acceptable — but it must be *disciplined*, because canvases currently mix paddings freely (`p-2.5`, `p-3`, `p-4`, `p-5`, `p-8`).

**Adopt this as the documented scale (Tailwind step → role):**
| Step | px | Role |
|------|----|------|
| `1` / `1.5` | 4 / 6 | Icon–label gaps, chip inset |
| `2` / `2.5` | 8 / 10 | Intra-card element gaps, compact list rows |
| `3` | 12 | **Card inner padding (default)** |
| `4` | 16 | **Panel/section padding (default)**, gap between cards |
| `5` | 20 | Canvas gutter, generous panel padding |
| `6` | 24 | Header gutters (workspace), empty-state padding |
| `8` | 32 | Empty/error-state vertical breathing room |

**Rules:**
- Cards pad `3`; panels pad `4`; canvas gutters `4`–`6`. No `p-8` except centered empty/error states.
- Vertical rhythm between stacked cards: `gap-3` (12px). Between sections: `gap-4`.
- The extra Tailwind steps `128`/`144` ([tailwind.config.ts:106-109](frontend/tailwind.config.ts)) are for fixed panel widths only.

---

## 3. Typography scale

### 3.1 The scale exists ([globals.css:200-215](frontend/src/app/globals.css)) — and is almost never used

| Utility | Size / weight | Intended role |
|---------|---------------|---------------|
| `.text-hero` | 28px bold | Trip titles, city chapter headings |
| `.text-display` | 22px semibold | Section titles |
| `.text-title` | 15px semibold | Card / day titles |
| `.text-body` | 13px | Readable content |
| `.text-caption` | 11.5px | Metadata |
| `.text-micro` | 10px bold uppercase | Labels, eyebrows, badges |
| `.text-tabular` | tabular-nums semibold | Prices, times, distances |

**Problem:** components hardcode `text-sm`, `text-[13px]`, `text-[11px]`, `text-[10px]`, `text-xl lg:text-2xl font-black` instead ([AIInsightsPanel.tsx:299](frontend/src/features/planner/workspace/plan-canvas/AIInsightsPanel.tsx) uses `text-xl…font-black` — not in the scale; [SuggestionCard.tsx:146](frontend/src/features/planner/workspace/helper-canvases/shared/SuggestionCard.tsx) uses `text-base font-bold`). The result is at least four competing "title" sizes across canvases.

**Rule:** every text node maps to one of the seven utilities. `font-black` is banished — the heaviest weight in the system is `font-bold` (700), reserved for `.text-micro` and prices. Prices/times/distances **always** carry `.text-tabular` (several places use `tabular-nums` ad-hoc; standardize).

**Font:** Inter, loaded via `@import` ([globals.css:14](frontend/src/app/globals.css)). Note this is a render-blocking web font import inside the CSS — acceptable, but it is the one external dependency in the type system; keep the weight set to 300/400/500/600/700 (no 800/900, consistent with dropping `font-black`).

---

## 4. Elevation / shadow

### 4.1 Three levels only ([globals.css:98-100](frontend/src/app/globals.css))

| Token | Use |
|-------|-----|
| `--shadow-surface` | Resting cards — barely visible |
| `--shadow-hover` | Lifted / hovered card |
| `--shadow-modal` | Panels, dropdowns, floating map controls, lightbox |

### 4.2 Violations

- Helper canvases and chat use raw `shadow-sm` / `shadow-md` / `shadow-xl` / `shadow-2xs` ([DockedChat.tsx:52,66,119](frontend/src/features/planner/chat/DockedChat.tsx), [FlightCanvas.tsx:295](frontend/src/features/planner/workspace/helper-canvases/booking/canvases/FlightCanvas.tsx) `hover:shadow-md`, [SuggestionCard.tsx:127](frontend/src/features/planner/workspace/helper-canvases/shared/SuggestionCard.tsx) `hover:shadow-sm`). These don't match the three-token ramp.
- **Rule:** resting = `shadow-surface`; hover lift = `shadow-hover`; anything floating = `shadow-modal`. Delete every raw `shadow-*` in favor of these. The `.travel-card` utility already bundles surface shadow + `rounded-2xl` — prefer it.

### 4.3 Radius (currently unspecified, needs a rule)

Mixed: `.travel-card` = `rounded-2xl` (16px), helper cards = `rounded-xl` (12px), chips = `rounded-full`, buttons = `rounded-xl`. **Adopt:** cards `rounded-2xl`, controls/buttons/inputs `rounded-xl`, chips/badges/pills `rounded-full`, icon tiles `rounded-lg`. `--radius` (0.5rem) drives the shadcn primitives only.

---

## 5. Motion & transitions

### 5.1 Tokens ([globals.css:126-132](frontend/src/app/globals.css)) — well-designed, use them

`--motion-hover` 120ms · `--motion-card` 180ms · `--motion-panel` 280ms · `--motion-page` 320ms · `--motion-bar` 600ms. Easing: `--ease-ios`, `--ease-out`. **Nothing faster than 120ms.**

The plan-canvas surfaces already thread these correctly via inline `style={{ transition: 'all var(--motion-hover) var(--ease-out)' }}` (sidebar, map, insights). **Good.**

### 5.2 Issues

- Helper canvases use bare Tailwind `transition-all` / `transition-colors` with **no duration token** → they fall back to Tailwind's 150ms default, subtly out of step with the 120/180ms system ([FlightCanvas.tsx:295,363](frontend/src/features/planner/workspace/helper-canvases/booking/canvases/FlightCanvas.tsx), [SuggestionCard.tsx:127](frontend/src/features/planner/workspace/helper-canvases/shared/SuggestionCard.tsx), [DockedChat.tsx:83,108](frontend/src/features/planner/chat/DockedChat.tsx)).
- **Rule:** every `transition-*` names a `--motion-*` duration and an `--ease-*`. Framer `AnimatePresence` panel swaps should target `--motion-panel` (280ms).
- `prefers-reduced-motion` is honored globally ([globals.css:326-336](frontend/src/app/globals.css)) — good; keep new animations inside `motion-safe:` or the decorative classes it already neutralizes.

---

## 6. Interaction patterns

### 6.1 Hover
- **Cards:** lift via `shadow-surface → shadow-hover`, optional `y: -1`, 120–180ms. Never change layout size on hover.
- **List rows (sidebar, suggestions):** background tint `hover:bg-paper-1`, text `ink-500 → ink-900`. Icon color follows via `group-hover`. ([SidebarItem.tsx:87-95](frontend/src/features/planner/sidebar/components/SidebarItem.tsx) is the reference implementation.)
- **Alternatives/candidate rows (AI):** border tint to `--color-ai / 0.4` + `shadow-hover` ([AIInsightsPanel.tsx:398-405](frontend/src/features/planner/workspace/plan-canvas/AIInsightsPanel.tsx)).
- **Map markers:** grow 32→44/54px + bounce on hover ([PlannerMap.tsx:424-435](frontend/src/features/planner/workspace/plan-canvas/PlannerMap.tsx)).

### 6.2 Active / selected
- **Selected item** (sidebar row, day chip, map theme toggle): sand — `bg-white shadow-surface` + a 2.5px sand left-rail (`before:` bar) or `bg-[rgb(var(--color-journey)/0.18)]` fill. This is the single "you are here" language ([SidebarItem.tsx:81](frontend/src/features/planner/sidebar/components/SidebarItem.tsx), [PlannerMap.tsx:495](frontend/src/features/planner/workspace/plan-canvas/PlannerMap.tsx)). **Do not** use blue for selection anywhere.
- **Pressed:** `active:scale-95` on buttons, `whileTap={{ scale: 0.98 }}` on framer buttons.

### 6.3 Focus (accessibility)
- `FOCUS_RING_CLASS` + `clickableDivProps` exist and are used on sidebar rows and suggestion cards ([SidebarItem.tsx:79](frontend/src/features/planner/sidebar/components/SidebarItem.tsx), [SuggestionCard.tsx:130](frontend/src/features/planner/workspace/helper-canvases/shared/SuggestionCard.tsx)). **Rule:** every clickable non-`<button>` gets these; every icon-only button gets a `title`/`aria-label` (mostly done — audit the map controls and canvas headers).
- Destructive affordances must **not** be hover-only (unreachable on touch) — SidebarItem's delete is correctly `opacity-40 group-hover:opacity-100 focus-visible:opacity-100` and always in the DOM ([SidebarItem.tsx:131-146](frontend/src/features/planner/sidebar/components/SidebarItem.tsx)). Follow that pattern.

### 6.4 Transitions between states
- Panel/canvas swaps: `AnimatePresence mode="wait"` with opacity + small y (15px) ([PlannerWorkspace.tsx:1211-1266](frontend/src/features/planner/workspace/PlannerWorkspace.tsx)). Keep.
- Compare→decide inside a canvas: opacity crossfade ([AttractionsCanvas.tsx:315-505](frontend/src/features/planner/workspace/helper-canvases/explore/AttractionsCanvas.tsx)). Keep.

---

## 7. Loading states — the tier standard (contract-audit §5.2)

> **Loading is rendered from the resolving tier, not a boolean.** The tier badge shown *while loading* must equal the provenance tier shown *on the resolved item* — loading state and trust grammar are the same axis.

### 7.1 The three tiers → required UI

| Tier | Backend signal | Loading UI | Resolved badge |
|------|----------------|-----------|----------------|
| **1 — instant** | explore `source: 'cache' \| 'database'`; block provenance `verified`/`estimated` | No spinner. Immediate render; ≤300ms subtle shimmer if a round-trip is unavoidable | `From saved results` / Verified |
| **2 — rule-based** | candidate pools, `lookup_live_price` history; provenance `estimated` | **Skeleton cards** (`*CardSkeleton`), count = last known result count to avoid layout jump | Estimate chip |
| **3 — Gemini / live fetch** | plan-gen `understanding`/`composing`; explore `source: 'google_places'` (5s live call) | **Phased progress**, never an indefinite spinner — reuse the `PlanGenerationJob`/`plan/status` phase pattern (phase label + progress + timeout) | `Live from Google, just now` / AI suggested |

### 7.2 As-built compliance

| Surface | Loading today | Tier-correct? |
|---------|---------------|---------------|
| **PlannerWorkspace** (trip load) | Layout-true skeleton mirroring header/chips/timeline/map ([PlannerWorkspace.tsx:815-857](frontend/src/features/planner/workspace/PlannerWorkspace.tsx)) | ✅ **Gold standard.** This is the pattern to copy. |
| **AttractionsCanvas** | 3 skeleton cards, then `TierBadge` after load ([AttractionsCanvas.tsx:410-415,431-433](frontend/src/features/planner/workspace/helper-canvases/explore/AttractionsCanvas.tsx)) | ⚠️ Partial. Skeleton + post-load badge good, but (a) loading is a **boolean** — a live 5s Places call (Tier 3) shows the same static skeleton as a cache hit, no phased progress; (b) skeleton count is fixed at 3, not last-known count. |
| **FlightCanvas** | Indefinite spinner "Searching flights…" ([FlightCanvas.tsx:284-288](frontend/src/features/planner/workspace/helper-canvases/booking/canvases/FlightCanvas.tsx)) | ❌ Tier-3 live search rendered as spinner. No skeleton, no phase, no tier badge during load. |
| **BookingResults** | Spinner "Searching live inventory…" ([BookingResults.tsx:12-18](frontend/src/features/planner/workspace/helper-canvases/booking/forms/BookingResults.tsx)) | ❌ Same — indefinite spinner for a live call. |
| **VisaCanvas / ForexCanvas** | Spinner "Looking up visa info…" ([VisaCanvas.tsx:194-198](frontend/src/features/planner/workspace/helper-canvases/travel-prep/visa/VisaCanvas.tsx)) | ❌ Indefinite spinner. |
| **SuggestionCard** (detail expand) | `animate-spin` ring ([SuggestionCard.tsx:192-195](frontend/src/features/planner/workspace/helper-canvases/shared/SuggestionCard.tsx)) | ❌ Spinner where a content skeleton belongs. |
| **DockedChat** ("thinking…") | Spinner + text ([DockedChat.tsx:156-165](frontend/src/features/planner/chat/DockedChat.tsx)) | ⚠️ Acceptable as a chat typing indicator, but it's Tier-3 (Gemini) work with no phase/timeout — a stalled turn looks identical to a fast one. |
| **PlannerMap** | Spinner "Loading map…" ([PlannerMap.tsx:456-461](frontend/src/features/planner/workspace/plan-canvas/PlannerMap.tsx)) | ✅ Acceptable — SDK bootstrap, not a data tier. Keep. |

### 7.3 Consolidation

- The skeleton components (`AttractionCardSkeleton`, `HotelCardSkeleton`, `RestaurantCardSkeleton`) currently shimmer on `bg-slate-200` ([AttractionCardSkeleton.tsx:6](frontend/src/features/planner/workspace/helper-canvases/explore/AttractionCardSkeleton.tsx)). Switch to the `.animate-shimmer` token gradient (`paper-0 → paper-1 → paper-0`, [globals.css:314-323](frontend/src/app/globals.css)) so skeletons are warm-paper, not slate.
- **Every data-fetching canvas needs the same three-tier treatment the explore canvases got.** Booking + travel-prep were left on generic spinners. Thread the `source`/tier through their services the way `reference.service.ts` now does, and give live (Tier-3) calls the phased-progress shape.

---

## 8. Error states — empty ≠ error ≠ timeout (contract-audit §5.3)

> A swallowed error that renders as empty is a **trust bug** — it tells the traveler "nothing exists here" when the truth is "we failed."

### 8.1 The three terminal states

| State | Trigger | UI |
|-------|---------|-----|
| **Empty** (success, 0 results) | backend resolved, `results: []`, `source` present | Neutral empty card ("No X here yet — try another location"). **Never reached via `.catch`.** |
| **Error** (request failed) | DRF error / network failure | Inline error card + **Retry**. Map DRF field errors `{field:[msg]}` back onto form fields. |
| **Timeout / AI unavailable** | Gemini `status:'failed'`; Places 5s hard timeout | **Distinct** copy: "AI/live lookup timed out — showing cached results," fall back to cache when the backend returns it. |

### 8.2 As-built compliance

| Surface | Empty | Error | Timeout | Verdict |
|---------|-------|-------|---------|---------|
| **AttractionsCanvas** | ✅ distinct empty ([AttractionsCanvas.tsx:461-470](frontend/src/features/planner/workspace/helper-canvases/explore/AttractionsCanvas.tsx)) | ✅ `ExploreErrorCard` + Retry, per-tab error flag ([AttractionsCanvas.tsx:104-119,416-417](frontend/src/features/planner/workspace/helper-canvases/explore/AttractionsCanvas.tsx)) | ❌ folded into generic error | **Best in codebase.** Only missing the timeout variant. |
| **ExploreStatusUI** | — | ✅ `ExploreErrorCard` ([ExploreStatusUI.tsx:35-57](frontend/src/features/planner/workspace/helper-canvases/shared/ExploreStatusUI.tsx)) | ❌ no timeout variant | Add a `timeout` prop/variant: "showing cached results." |
| **FlightCanvas** | ✅ "No flights found" ([FlightCanvas.tsx:386-392](frontend/src/features/planner/workspace/helper-canvases/booking/canvases/FlightCanvas.tsx)) | ❌ **`catch` only logs** ([FlightCanvas.tsx:168-172](frontend/src/features/planner/workspace/helper-canvases/booking/canvases/FlightCanvas.tsx)) — a failed search renders as the empty state | ❌ | **The exact §5.3 anti-pattern.** Error is indistinguishable from empty. |
| **BookingResults** | ❌ returns `null` on 0 results ([BookingResults.tsx:21-23](frontend/src/features/planner/workspace/helper-canvases/booking/forms/BookingResults.tsx)) | ❌ none | ❌ | No empty state (silent blank), no error state at all. |
| **VisaCanvas** | ✅ "Search a country…" ([VisaCanvas.tsx:240-245](frontend/src/features/planner/workspace/helper-canvases/travel-prep/visa/VisaCanvas.tsx)) | ✅ inline red error ([VisaCanvas.tsx:199-200](frontend/src/features/planner/workspace/helper-canvases/travel-prep/visa/VisaCanvas.tsx)) | ❌ | Good empty+error; no timeout; error card is off-token (`red-*` raw). |
| **PlannerWorkspace** (no plan) | ✅ "Awaiting Trip Details" vs "Loading… + Refresh" ([PlannerWorkspace.tsx:859-893](frontend/src/features/planner/workspace/PlannerWorkspace.tsx)) | ⚠️ auto-poll every 4s, no hard-fail card | ⚠️ | Distinguishes empty vs retrying; a permanent failure never surfaces a terminal error. |

### 8.3 Rules

- **No `.catch(() => [])`, no `.catch` that only `console.error`s.** Every fetch sets an explicit error flag that renders the error card (AttractionsCanvas is the reference — copy it to Flight/Hotel/Train/Bus/Cab/Forex).
- **One error card component.** `ExploreErrorCard` should be promoted to a shared `CanvasErrorCard` with `variant: 'error' | 'timeout'` and used by *all* canvases. Today its amber styling is right; add the timeout copy.
- Empty states stay neutral and specific ("try another location"), never alarming.

---

## 9. Cockpit-metaphor audit — "render a decision, never make one"

The planner's promise: **the AI/backend decides; canvases render the decision and route the traveler's choice back up.** A canvas visually "making a decision" — inventing a fact, asserting an outcome, ranking by its own logic — breaks the metaphor and the trust grammar. Flags below, worst first.

### 🔴 9.1 AttractionsCanvas — client-side recommendation engine (contract-audit §4.2.1, still live)
[AttractionsCanvas.tsx:20-21,142-149](frontend/src/features/planner/workspace/helper-canvases/explore/AttractionsCanvas.tsx) still calls `getAttractionRecommendations` / `getActivityRecommendations`. The engine ([sightRecommendationEngine.ts](frontend/src/features/planner/workspace/helper-canvases/explore/services/sightRecommendationEngine.ts)) has been *softened* (real price → `'Varies'` when unknown, real distance/rating) — but it **still fabricates in the canvas**:
- `label: 'Must Visit' | 'Hidden Gem' | 'Well Rated'` from a client index/rating heuristic ([:49-55](frontend/src/features/planner/workspace/helper-canvases/explore/services/sightRecommendationEngine.ts)) — a **curatorial verdict**.
- `confidence: 'High' + "perfect for your route"` ([:73-82](frontend/src/features/planner/workspace/helper-canvases/explore/services/sightRecommendationEngine.ts)) — an **authority claim** the backend never made.
- `walkMins = (distance_km ?? 1.2) * 12` — invents a ~14-min walk when distance is unknown.
- `routePosition: "fits between A and B"` — an **itinerary-fit decision** rendered as fact.

The card also stamps `isTopPick={i === 0}` and the toolbar labels the default sort **"AI recommended"** ([AttractionsCanvas.tsx:350,437-457](frontend/src/features/planner/workspace/helper-canvases/explore/AttractionsCanvas.tsx)) — the canvas presents itself as the ranker. **This is the canvas deciding.** Move label/confidence/fit to backend enrichment tagged `suggested`, or drop them; the canvas should render provenance-tagged fields only.

### 🔴 9.2 AttractionsCanvas — "success" overlay asserts outcomes it didn't compute
[AttractionsCanvas.tsx:293-313](frontend/src/features/planner/workspace/helper-canvases/explore/AttractionsCanvas.tsx): on add, a full-screen overlay declares **"Walking time saved · Budget optimized · Timeline refreshed."** None of these were computed — they're a fixed reassurance string. This tells the traveler the canvas just *optimized their trip*, i.e. made a decision with consequences. Replace with an honest confirmation ("Added to Day N") and let real recomputation (insights/ledger) speak for itself.

### 🟡 9.3 AIInsightsPanel — mostly correct, one soft edge
Strong cockpit citizen: it explicitly **"never invents alternatives,"** renders only `_aiInsights.candidates` cached upstream, and degrades to an honest "No verified alternatives yet. Want me to find real options nearby?" ([AIInsightsPanel.tsx:166-185,444-462](frontend/src/features/planner/workspace/plan-canvas/AIInsightsPanel.tsx)). The one edge: `buildComparativeReason` computes "₹X cheaper / 0.3★ higher rated" client-side ([:36-58](frontend/src/features/planner/workspace/plan-canvas/AIInsightsPanel.tsx)). This is pure presentation of two real numbers (acceptable), but it's business logic that could drift from a future backend fit signal — keep it behind a shared, testable helper, not inlined judgment.

### 🟡 9.4 VisaCanvas — hardcoded destination-specific "facts"
[VisaCanvas.tsx:117-157](frontend/src/features/planner/workspace/helper-canvases/travel-prep/visa/VisaCanvas.tsx): the domestic branch hardcodes **Rohtang Pass permit details, ₹500/car, altitude/Diamox advice** for *any* Indian trip. These read as authoritative trip-specific guidance but are static, Manali-specific strings shown regardless of destination — the canvas asserting knowledge it doesn't have. Should come from the backend keyed on the actual destination, or be generalized honestly.

### 🟢 9.5 Booking canvases (Flight/Hotel/Train/Bus/Cab) — correct
FlightCanvas renders only real inventory, shows `null`/"Price on request" for missing data instead of fabricating, stamps honest provenance per result, and routes selection up via `ReplaceConfirmBar` → `onAddToPlan` (never mutates the plan itself) ([FlightCanvas.tsx:124-138,188-213,397-407](frontend/src/features/planner/workspace/helper-canvases/booking/canvases/FlightCanvas.tsx)). Selection = user decision, correctly. Keep as the reference for the other four.

### 🟢 9.6 Plan mutations are correctly server-authoritative
Every plan change flows through `handlePlanDataChange` → debounced PATCH, and booking/route-optimize go through proposal/transition endpoints ([PlannerWorkspace.tsx:528-535,647-661,982-986](frontend/src/features/planner/workspace/PlannerWorkspace.tsx)). The AI proposes; the traveler accepts/rejects via `ProposalCard`. The structural cockpit pattern is intact — the violations above are *presentational* fabrications inside otherwise-stateless canvases.

---

## 10. Prioritized remediation

1. **P0 — Kill the two fabrication points (§9.1, §9.2).** Move attraction/activity `label`/`confidence`/`routePosition` to backend enrichment (tagged `suggested`) or remove; replace the "Budget optimized / Timeline refreshed" success overlay with an honest confirmation. Highest trust risk.
2. **P0 — Stop swallowing errors (§8).** FlightCanvas/BookingResults must surface a real error card, not render failure as empty. Promote `ExploreErrorCard` → shared `CanvasErrorCard` with a `timeout` variant.
3. **P1 — Unify on the warm-paper token system (§0–4).** Migrate CanvasHeader, SuggestionCard, Visa/Forex, chat, BookingResults off `slate/blue/#e5dfd2` onto `ink/paper/line/--color-*`. Recolor chat + insights-adjacent surfaces to `--color-ai` violet.
4. **P1 — Tier-based loading everywhere (§7).** Give booking + travel-prep canvases the skeleton + post-load `TierBadge` treatment; give live (Tier-3) calls phased progress + timeout instead of indefinite spinners. Warm the skeleton shimmer.
5. **P2 — Enforce the type + shadow + motion tokens (§3-5).** Replace hardcoded `text-*`/`font-black`, raw `shadow-*`, and untimed `transition-*` with the seven type utilities, three shadow tokens, and `--motion-*` durations.
6. **P2 — Generalize VisaCanvas hardcoded guidance (§9.4)** to be destination-driven.
```
