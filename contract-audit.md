# NeuralNomad Planner — Backend ↔ Frontend Contract Audit

**Date:** 2026-07-13
**Scope:** DRF API responses (`backend/apps/*`) vs. Next.js/TypeScript interfaces (`frontend/src/*`) for the planner and its 11 helper canvases.
**Status:** Findings only — nothing fixed. Ordered by blast radius.

---

## 0. Executive summary

| Area | Verdict |
|------|---------|
| Planner workspace / draft / chat schema | Mostly aligned; a few dead/missing fields (`intent`, `active_canvases`) and untyped envelopes (`command_results`). |
| Plan Canvas trip model (`PlannerTrip` / `TripActivity` / `TripCity` / `TripDay`) | **Significantly out of sync** with what `plan_generation.py` actually writes. `planTransform.ts` papers over it with `any` access + fallbacks. |
| Booking canvases (Flight/Hotel/Train/Bus/Cab) | The five `*Meta` shapes have **zero serializer enforcement** — they live entirely inside a `JSONField`. |
| Explore canvases (Restaurant/Attraction/Activity/Hotel) | `Suggestion` envelope is well-aligned, but the frontend runs **client-side recommendation engines that fabricate facts** (Q3 violation). |
| Visa / Forex | Field names align; **every `DecimalField` is a string on the wire but typed `number`** in TS (systemic). |
| Decision logic in canvases (Q3) | Violated by the explore recommendation engines; no formal `PlanCommand` type exists. |
| Loading/error standards (Q4) | Backend emits a tier signal (`source`) that the frontend **discards**; errors are swallowed into empty states. Standard defined in §5. |

---

## 1. Cross-cutting issue: DecimalField → string (affects most money/geo fields)

`backend/config/settings/base.py:147` sets `REST_FRAMEWORK` but does **not** set `COERCE_DECIMAL_TO_STRING`, so it defaults to `True`. **Every `DecimalField` serializes as a JSON string**, e.g. `"1234.00"`, not `1234.0`.

The frontend is inconsistent about this — some fields correctly type as `string`, most type as `number`:

| Model.field | Backend | TS type | File | Correct? |
|-------------|---------|---------|------|----------|
| `TripDraftState.budget_amount` | Decimal → string | `string \| null` | planner.types.ts:76 | ✅ |
| `PlannerTrip.total_budget` / `spent_budget` | Decimal → string | `number` | planner.types.ts:183-184 | ❌ (coerced later via `Number()` in planTransform.ts:236) |
| `VisaInfo.fees` | Decimal → string | `number \| null` | types/visa.ts:8 | ❌ |
| `ForexRate.exchange_rate` | Decimal → string | `number` | types/forex.ts:3 | ❌ |
| `ForexVendor.rating` / `latitude` / `longitude` | Decimal → string | `number` / `number\|null` | types/forex.ts:24-26 | ❌ |
| `VendorCurrencyInventory.exchange_rate` / `quantity_available` | Decimal → string | `number` / `number\|null` | types/forex.ts:12-13 | ❌ |
| `ForexDeliveryRequest.amount` / `exchange_rate` / `converted_amount` | Decimal → string | `number` | types/forex.ts:41-43 | ❌ |
| `Booking.amount` | Decimal → string | (see booking.ts) | booking serializers.py:17 | ❌ likely |

**Impact:** arithmetic on these values (`a + b`, `.toFixed()`) silently concatenates strings or `NaN`s. It works today only where a `Number()`/`parseFloat` coercion happens to sit in the path (e.g. planTransform, priceParser).

**Decision needed:** either set `COERCE_DECIMAL_TO_STRING = False` globally (one line, makes wire match the `number` types) **or** flip all the affected TS types to `string`. Recommend the former for consistency with the `number` typing already assumed everywhere.

---

## 2. Planner core schema (Q1)

Source: `backend/apps/planner/serializers.py`, `backend/apps/planner/models.py` ↔ `frontend/src/services/planner.types.ts`.

### 2.1 `TripDraftState`
| Issue | Detail |
|-------|--------|
| **`intent` missing from serializer** | `TripDraftStateSerializer` (serializers.py:12-37) does **not** list `intent`, but the model has it (models.py:155) and the frontend declares `intent?: string` (planner.types.ts:67). The field is **always `undefined`** on the client despite driving the whole intent-based slot-filling flow. |
| **`destination_city` semantic collision** | In `TripDraftStateSerializer` it's a plain FK → serializes to the City **UUID** (`string`). In `TripSerializer.get_destination_city` (serializers.py:226) the *same field name* returns the city **name**. Frontend types it as `string \| null` (planner.types.ts:68) — technically satisfied by both, but two endpoints give the field two different meanings. |
| Missing `created_at`/`updated_at` | Serializer omits them; frontend doesn't declare them. Consistent, no action. |

### 2.2 `PlannerWorkspace`
| Issue | Detail |
|-------|--------|
| **`active_canvases` is a dead field** | `get_active_canvases` (serializers.py:68-69) is hardcoded `return []`. Frontend types it `CanvasType[]` (planner.types.ts:54) and could branch on it. Either wire it or drop it. |
| Pagination truncation | `PlannerWorkspaceViewSet` uses the default `PageNumberPagination` (`PAGE_SIZE: 20`, base.py:160-161). `listWorkspaces` (planner.service.ts:28-32) unwraps `.results` but there is **no "load more"** — a user with >20 trips silently loses the rest. |
| `lifecycle`/`bucket`/`next_action` | Server-computed `SerializerMethodField`s; align with the TS optionals. ✅ |

### 2.3 Chat contract
| Issue | Detail |
|-------|--------|
| **`command_results` is untyped on the backend** | `ChatResponseSerializer.command_results = serializers.ListField()` (serializers.py:134) — no child schema. Frontend declares a precise `{ type, status, result?, error? }[]` (planner.types.ts:111-116). The shape is enforced only by convention in `ConversationService`, not by the serializer. |
| `widgets` / `commands` | Both are raw `JSONField`s (models.py:258-259) typed loosely as `WidgetData`/`CommandData` = `{ type, data/payload: Record<string, unknown> }`. No enforced schema — see Q3 §4. |
| SSE `done` / `state` events | `_stream_chat_response` (views.py:673-696) emits `suggested_replies`, `detected_intent`, `confidence_score` that have **no counterpart** in `chat/types.ts`. The SSE envelope is typed ad-hoc in `chatStream.ts`; worth a shared type. |

---

## 3. The 11 canvas data models (Q2)

### 3.1 Plan Canvas trip model — **largest divergence**

The plan is stored as raw JSON (`PlannerTrip.days` / `.cities`, models.py:287-288) and emitted through `PlannerTripSerializer` → `upcast_trip_payload`. The **authoritative shape is whatever `plan_generation.py` writes**, and it does not match `TripActivity` / `TripCity` / `TripDay` in planner.types.ts.

**`TripActivity` (planner.types.ts:123-156) vs. `_candidate_block` / `_transport_block` (plan_generation.py:645-711):**

| TS field | Required? | Emitted by generator? | Note |
|----------|-----------|-----------------------|------|
| `duration_minutes: number` | required | ❌ never | Phantom required field |
| `distance_km: number \| null` | required | ❌ never | Phantom |
| `travel_time_minutes: number \| null` | required | ❌ never | Phantom |
| `transport_mode: string` | required | ❌ never | Phantom (transport data lives in `metadata.transport`) |
| `order: number` | required | ❌ never | Phantom |
| `weather_info: Record` | required | ❌ never | Phantom (weather is on the *day*, `weather_normal`) |
| `estimated_cost: number` | required | emits `null` often | Type says non-null number; wire is frequently `null` |
| `status` | `'planned'\|'booked'\|'completed'\|'cancelled'` | emits `'pending'` / `'inactive'` / `'booked'` | **Enum mismatch** — `'pending'`/`'inactive'` are not in the TS union |
| `rating`, `image_url`, `ai_tip`, `_aiInsights` | — | ✅ emitted | **Present on the wire but absent from the interface** (read via `any` in planTransform.ts:77-88) |

**`TripCity` (planner.types.ts:167-177) vs. `_assemble_itinerary` (plan_generation.py:830-842):**
- Generator emits only `name, country, order, nights, arrival_date, departure_date`.
- Frontend **requires** `id: string`, `latitude: number`, `longitude: number` — **none are emitted**. `planTransform.ts:177` synthesizes a fake `id` (`city-segment-N`); lat/lng are simply absent.

**`TripDay` (planner.types.ts:158-165) vs. generator day dict (plan_generation.py:620-628):**
- Generator emits `day_number, date, title, day_type, city, activities` — **no `id`**. Frontend requires `id: string`; `planTransform.ts:128` falls back to `day-${day_number}`.
- `day.city` and `day.transit_hints` / `day.weather_normal` are emitted but not in `TripDay`.

**`ItineraryItem.type` union** (plan-canvas/types.ts:22) is `'flight'|'taxi'|'hotel'|'food'|'attraction'|'train'|'bus'|'activity'` — but transport blocks use category **`'cab'`** (plan_generation.py:657), which is **not in the union**. `planTransform.ts:63` passes `a.category.toLowerCase()` straight through, so `'cab'` leaks as an invalid `type`.

**Root cause / mitigation:** `planTransform.ts` is doing the real reconciliation with `any`-typed reads and fallbacks. The interfaces in `planner.types.ts` describe an *aspirational* activity model (looks like an older ORM-backed `TripActivity`) that no longer matches the JSON pipeline. **Recommend regenerating `TripActivity`/`TripCity`/`TripDay` from the actual generator output**, marking the phantom fields optional or removing them, and adding `rating`/`image_url`/`ai_tip`.

### 3.2 Booking canvases — Flight / Hotel / Train / Bus / Cab

Source: `SearchInventorySerializer` (bookings/serializers.py:23-39) ↔ `TravelSearchResult` (types/search.ts:82-98).

| Issue | Detail |
|-------|--------|
| **The five `*Meta` shapes are unenforced** | `FlightMeta`, `TrainMeta`, `HotelMeta`, `BusMeta`, `CabMeta` (search.ts:26-78) describe the contents of `SearchInventory.meta`, which is a bare `JSONField` (bookings/models.py:112). **No serializer validates it.** The TS types are aspirational; a malformed seed row breaks the canvas with no backend guardrail. |
| `providers` shape unenforced | Same — `providers` is a `JSONField` (models.py:115); frontend expects `ProviderOffer[]` (`{provider, price, deeplink}`). No validation. |
| `is_active` leaks | Serializer returns `is_active` (serializers.py:38); `TravelSearchResult` omits it. Harmless but the search endpoint should filter inactive rows server-side rather than shipping them. |
| `meta` typed as an **intersection of all five** | `meta: FlightMeta & TrainMeta & HotelMeta & BusMeta & CabMeta` (search.ts:96) — lets a flight result be indexed for `.rooms`/`.cab_types` with no type error. Should be a discriminated union keyed on `service_type`. |
| IDs | `id` is a UUID `string` both sides. ✅ |

### 3.3 Explore canvases — Restaurant / Attraction / Activity / Hotel

Source: `to_suggestion` (reference/services/suggestions.py:200-228) ↔ `Suggestion` (plan-canvas/types.ts:177-195). **This is the best-aligned contract in the codebase** — one envelope, provenance-tagged, honest gaps (`null`) rather than fabricated defaults.

| Issue | Detail |
|-------|--------|
| `details` is a catch-all | `SuggestionDetails` ends with `[key: string]: any` (types.ts:174). Intentional, but means per-category fields (room_tiers, dietary_accommodations, accessibility_detail) are unverified against the serializer. Minor. |
| **Two competing "attraction" contracts** | The standalone `apps.attractions.AttractionSerializer` (attractions/serializers.py:13-52) returns a *totally different* shape (`destination` object, `ticket_price`, `is_featured`, `serves_beer/wine`, `reviews`, …) than the reference `Suggestion`. The planner AttractionsCanvas consumes the `Suggestion` one; the legacy attractions app/type is a separate, drifting contract. Confirm which is canonical and retire the other. |
| `source` field discarded | `explore` returns `{ source, results }` (reference/views.py:148/173/198/223) but `reference.service.ts:59-74` returns **only `res.results`**, dropping the tier signal. See Q4. |

### 3.4 Visa canvas
Source: `VisaDataSerializer` (visa/serializers.py) ↔ `VisaInfo` (types/visa.ts). **Field names align 1:1.** Issues:
- `fees` decimal → string vs `number | null` (see §1).
- `entry_type` union includes `''` on both sides ✅.

### 3.5 Forex canvas
Source: `ForexDataSerializer` / `ForexVendorSerializer` / `VendorCurrencyInventorySerializer` / `ForexDeliveryRequestSerializer` (forex/serializers.py) ↔ types/forex.ts. Field names align. **Only issue is decimal-as-string** across `exchange_rate`, `rating`, `latitude/longitude`, `amount`, `converted_amount`, `quantity_available` (see §1).

### 3.6 Booking (commitment) canvas
Source: `BookingSerializer` (bookings/serializers.py:9-20) + planner ledger/commitment endpoints. `amount` decimal → string (§1). The planner-side `BlockCommitment`/`TripLedger` types (planner.types.ts:269-287) are served by hand-built dict responses (`compute_ledger`, views.py:390-400) — not a serializer, so they're enforced only by convention.

---

## 4. Canvas statelessness / decision logic (Q3)

**Finding: the structural pattern is right, but the explore canvases embed fabricated decision logic, and there is no formal `PlanCommand` type.**

### 4.1 What's correct
- `planTransform.ts` is the single, documented place where trip JSON becomes a view model and back (planTransform.ts:1-10). Canvases don't mutate the plan directly — they route changes up via `onAddToPlan(item)` / proposal endpoints. Good.
- Plan mutations flow through the backend proposal/commitment endpoints (`/proposals`, `/blocks/transition`, `/optimize-route`) — the AI never mutates directly (views.py:404-542). Good.

### 4.2 Violations
1. **Client-side recommendation engines fabricate decision data.**
   `sightRecommendationEngine.ts`, `activityRecommendationEngine.ts`, `mealRecommendationEngine.ts` (helper-canvases/explore/services/) synthesize — from **name/category keyword heuristics** — crowd levels, entry fees (`'Free'` if the name contains "park"/"temple"/"lake", sightRecommendationEngine.ts:277), best-time windows, warnings, `confidence`, and a 6-axis `ExperienceQualities` score.
   This is *decision/enrichment logic living in the canvas*, and it **invents facts the backend deliberately refuses to invent** — `suggestions.py` and `places_explore.py` go out of their way to leave honest `null` gaps (e.g. attraction duration/ticket suppressed, suggestions.py:56-83; activity price/difficulty forced to `None`, places_explore.py:171-187). The canvas then back-fills those very gaps with guesses, contradicting the provenance discipline (`block_schema.py` trust grammar). The real, provenance-tagged channel already exists: `details.insights` and `details.local_tips` (suggestions.py:148-197). **These heuristics belong in the backend Knowledge Engine, tagged `suggested` tier — not in the canvas.**

2. **No `PlanCommand` type exists.** The task assumes canvases "purely render PlanCommand output," but the codebase has no such type. What exists:
   - `commands: CommandData[]` where `CommandData = { type: string; payload: Record<string, unknown> }` (planner.types.ts:91-94) — completely untyped payloads.
   - `onAddToPlan(item: ItineraryItem)` callbacks that **construct the `ItineraryItem` client-side** (e.g. AttractionsCanvas.tsx:234-248).
   There is no enforced schema for what a canvas may emit back to the Plan Canvas, and no discriminated `PlanCommand` union. This is the missing contract that would let canvases be provably "stateless renderers."

3. **Hotel canvas derivations** (`tripFit.ts`, `itineraryImpact.ts`) compute a "Trip Fit" from `tripContext`. These are pure functions of passed-in props (acceptable as presentation), but they are *business logic* that can silently drift from any future backend fit signal. Lower priority than #1, but note it belongs behind a shared, testable contract.

**Recommendation:** (a) move the recommendation engines' factual outputs to backend enrichment with provenance; keep only pure presentation on the client. (b) Define a `PlanCommand` discriminated union (e.g. `{ kind: 'add_block'|'replace_block'|'remove_block'|'open_canvas', … }`) as the one contract canvases emit, replacing the untyped `CommandData.payload` and the ad-hoc `ItineraryItem` construction.

---

## 5. Standards (Q4)

### 5.1 The tier signal already exists — and is thrown away
The backend labels every explore response with `source ∈ { 'cache', 'google_places', 'database', 'error' }` (reference/views.py:148,173,198,223) and every plan block with a provenance `tier ∈ { 'verified', 'estimated', 'suggested' }` (block_schema.py:25-27). But `reference.service.ts` returns only `res.results` (reference.service.ts:59-74), so **canvases never see which tier resolved** and fall back to a single boolean `loading` + skeletons (AttractionsCanvas.tsx:43,389-394). The three-tier concept in the task maps cleanly onto signals we already emit:

| Tier | Meaning | Real backend signal |
|------|---------|---------------------|
| **Tier 1 — instant** | Served from our DB cache | explore `source: 'cache'` / `'database'`; block provenance `verified`/`estimated` |
| **Tier 2 — rule-based** | Reference-table join / heuristic / historical price | plan_generation candidate pools; `lookup_live_price` history; provenance `estimated` |
| **Tier 3 — Gemini fallback** | LLM generation / live Places fetch | plan-generation `understanding`/`composing` phases; explore `source: 'google_places'` (5 s live call, places_explore.py:320) |

### 5.2 ONE loading standard

> **Loading is rendered from the resolving tier, not a boolean.** Every data-fetching canvas reads the tier signal (thread `source` through `reference.service.ts`; keep provenance on blocks) and shows:
>
> - **Tier 1 (instant / cache):** no spinner. Render immediately; if a network round-trip is unavoidable, show at most a subtle shimmer for <300 ms. A small **"Saved data"** / verified badge.
> - **Tier 2 (rule-based):** **skeleton cards** (the existing `*CardSkeleton` components) with an **"Estimated"** tier chip once loaded. Expected sub-second-to-2 s.
> - **Tier 3 (Gemini / live fetch):** **phased progress**, never an indefinite spinner. The gold-standard pattern already exists — `PlanGenerationJob` + `plan/status` polling with real `phases[]`, `progress`, and per-phase `detail` (plan_generation.py:60-101, views.py:198-208). Long live calls must expose the same shape (phase label + timeout). Show a **"Live"/"AI-generated"** chip and the honest basis on the result.
>
> **Rule:** the tier badge shown while loading must equal the provenance tier shown on the resolved item — loading state and trust grammar are the same axis. Skeleton count should match the last known result count to avoid layout jump.

### 5.3 ONE error standard

Current anti-pattern: explore errors are swallowed — `referenceService.exploreAttractions(...).catch(() => [])` (AttractionsCanvas.tsx:92-93) turns a 500/timeout into an **empty list that renders as "No attractions found"** (AttractionsCanvas.tsx:435-443). A failed request and a genuinely empty city are indistinguishable to the user. Define three distinct terminal states:

> - **Empty (success, zero results):** the backend resolved but has nothing (`results: []`, `source` present). Show the neutral empty state ("No X here yet — try another location"). **Never reached via `.catch`.**
> - **Error (request failed):** DRF error or network failure. Surface it, don't swallow. Standard DRF error envelope is `{ "detail": "..." }` (used throughout views.py) or field errors `{ field: ["..."] }` from `is_valid(raise_exception=True)` (e.g. views.py:188, 437); `handleError` in api.ts:162-190 already normalizes these to `{ message, status, code }`. Render an inline error card with a **Retry** button. For **DRF validation errors** on forms (forex delivery, passenger details), map `{ field: [msg] }` back onto the field.
> - **Timeout / Gemini unavailable:** distinct copy + retry. The backend already models this: plan generation reports `status: 'failed'` with a human `error` and a 90 s stale-guard (`serialize_job`, plan_generation.py:178-195) and even ships a curated skeleton fallback (plan_generation.py:156-166). Explore's live Places call has a hard 5 s timeout (places_explore.py:320) that currently collapses into `'error'` then an empty list — it must surface as a timeout, not "no results".
>
> **Rule:** empty ≠ error ≠ timeout. A swallowed error that renders as empty is a trust bug (it tells the user "nothing exists here" when the truth is "we failed"). The tier that failed determines the copy: Tier 1/2 failures say "couldn't load, retry"; Tier 3 failures say "AI/live lookup timed out — showing cached results" and fall back to cache when available (the backend already returns cache on live-fetch failure, places_explore.py:322-325).

---

## 6. Prioritized fix list (when we act)

1. **P0 — Plan Canvas model realignment (§3.1).** Regenerate `TripActivity`/`TripCity`/`TripDay` from actual generator output; fix the `status` enum, `estimated_cost` nullability, the `'cab'`/`'taxi'` type leak, and the phantom required fields. Highest bug surface.
2. **P0 — Decimal-as-string (§1).** Set `COERCE_DECIMAL_TO_STRING = False` (or retype). One-line backend change fixes money math across forex/visa/booking.
3. **P1 — Move fabricated recommendation logic to backend enrichment (§4.2.1).** Trust-critical: the canvas currently invents data the backend intentionally withholds.
4. **P1 — Thread the `source`/tier signal to the frontend and implement the loading/error standards (§5).** Stop swallowing errors into empty states.
5. **P2 — Define the `PlanCommand` discriminated union (§4.2.2)** to formalize what canvases emit.
6. **P2 — Add `intent` to `TripDraftStateSerializer`; wire or remove `active_canvases` (§2).**
7. **P2 — Enforce booking `*Meta`/`providers` shapes** with nested serializers or validation (§3.2); resolve the dual attraction contract (§3.3).
