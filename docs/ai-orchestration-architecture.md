# NeuralNomad — AI Conversation & Orchestration Architecture

**Master Implementation Specification · v1.0**
**Owner:** Lead AI Product Architect
**Audience:** The implementing model (Gemini 2.5 Flash / Claude Sonnet) and human engineers
**Status:** Authoritative. Where this document and ad-hoc code disagree, this document wins for the *intelligence layer* only.

---

## 0. How to read this document

This is the specification for the **intelligence layer** of NeuralNomad — how the AI thinks, remembers, asks, reasons, selects widgets, produces insights, and drives the existing Workspace. It is **not** a redesign of the Workspace, planner blocks, itinerary layout, booking UI, pages, or React components. Those are assumed complete and are treated here as a **target surface the AI commands through a fixed contract** (§7, §8).

### 0.1 Grounding — this spec extends real code, it does not invent a greenfield

NeuralNomad already ships a working conversation stack. This specification is written as the **evolution of that stack**, not a replacement. The mapping:

| Concept in this spec | Where it lives today | What this spec asks of it |
| --- | --- | --- |
| Orchestrator | `apps/planner/services/conversation_engine.py` (`ConversationEngine`) | Generalize from "pre-plan slot-filling" into a full turn orchestrator that also runs post-plan (Floating AI) |
| Turn transport | `apps/planner/services/conversation_service.py` (`ConversationService.send_message`) | Keep as the transactional shell; add insight + proposal emission per turn |
| Streaming contract | `chat/services/chatStream.ts` events `state / token / widgets / done / error` | Fixed. Every new capability rides these five events |
| Structured extraction | `ExtractedTripData` Pydantic schema | Extend fields, never break existing ones |
| Deterministic confidence | `ConversationEngine._calculate_confidence` | Keep deterministic; extend weights |
| Widget selection | `ConversationEngine._determine_widget` | Generalize into the Widget Selection Engine (§1.11) |
| Widget library | `chat/widgets/*` + `chat/widgetRegistry.ts` (5 widgets today) | Expand to the full library (§2) via the same registry pattern |
| Workspace sync | `PlanProposal` (`diff` / `accept` / `reject`, `base_trip_updated_at` staleness guard) | The **only** channel by which the AI mutates a generated plan |
| Insights | `apps/planner/services/insight_engine.py` (`PlanInsightEngine`, 9 rules) | The substrate for the Insight Engine (§6); add conversational surfacing |
| Chat edits | `apps/planner/services/chat_edit_intents.py` (`propose_retime_from_chat`) | The prototype for the Correction/Edit → Proposal path; generalize (§7.4) |
| Traveler memory | `TravelerProfile.upsert_fact` | The durable cross-session memory tier (§5.5) |
| Learning loop | `PlannerQuestionBank`, `PlannerIntentFlow` | The reinforcement layer for question/widget selection (§3.11) |
| Recommendation engine | `apps/planner/services/recommendation_engine.py` (**dormant** — referenced only in `views.py:965`) | Activate as the Recommendation Engine (§1.8) |
| Constraints | `apps/planner/services/constraints.py` (`ConstraintEngine`, used in `plan_generation`) | Promote to a first-class reasoning input (§1.6) |

**Design mandate carried from the product audits:** activate dormant intelligence and make every behavior *provenance-honest* (never present inferred or invented data as fact). This is a hard rule, restated in §6 and §9.

### 0.2 The five-event contract (never violate this)

Every turn — pre-plan or post-plan, chat or Floating AI — emits exactly this ordered event stream over SSE:

```
event: state    data: { intent, intent_confidence, confidence_score, missing_slots, ready_for_plan, memory_delta }
event: token    data: { t: "<text chunk>" }          (repeated, streams the reply)
event: widgets  data: [ { type, data }, ... ]          (exactly once; may be [])
event: insights data: [ { rule, severity, message, related_block_ids, action } ]  (optional; post-plan)
event: proposals data: [ { id, kind, title, rationale, diff } ]  (optional; when the turn files an edit)
event: done     data: { message_id, workspace_id, suggested_replies, mode }
event: error    data: { detail }                       (terminal; client falls back to classic POST)
```

`insights` and `proposals` are **additive** events introduced by this spec. Clients that do not understand them ignore them; the turn still completes on `done`. This preserves backward compatibility with today's `chatStream.ts`.

### 0.3 Glossary

- **Draft** — `TripDraftState`, the pre-plan slot bag (destination, dates, intent, metadata JSON).
- **Trip** — `PlannerTrip`, the generated plan (cities, days, activities/blocks). Exists only after `create_plan`.
- **Block** — one activity inside a day (`{id, category, title, start_time, ...}`). The atomic unit the AI manipulates.
- **Proposal** — `PlanProposal`, a proposed diff to the Trip the user accepts/rejects. The AI's only write channel to a generated plan.
- **Slot** — a single piece of trip information (a memory cell). Required or optional per intent.
- **Turn** — one user message (or widget submission) → one AI response cycle.
- **Surface** — a place the AI communicates: the docked pre-plan chat, the Floating AI, a conversation widget, or an insight node.

---

## 1. Deliverable 1 — AI Orchestration Architecture

### 1.0 The orchestration loop (one turn, end to end)

The orchestrator is a **deterministic pipeline with one probabilistic step** (the LLM call). Determinism wraps the model so behavior is predictable, testable, and never regresses on things the model is bad at (arithmetic, slot bookkeeping, widget ordering). This mirrors the existing `ConversationEngine.process` and generalizes it.

```
                        ┌─────────────────────────── ONE TURN ───────────────────────────┐
 user message ─▶ 1 Ingest ─▶ 2 Intent Detection ─▶ 3 Memory Load ─▶ 4 Reasoning Assembly
                                                                              │
                                                                              ▼
      8 Emit ◀─ 7 Insight Pass ◀─ 6 Response Synthesis (LLM) ◀─ 5 Inference + Recommendation
        │
        └─▶ persist (ConversationService), stream state/token/widgets/insights/proposals/done
```

| # | Stage | Deterministic? | Component | Existing anchor |
| --- | --- | --- | --- | --- |
| 1 | Ingest & normalize | Yes | Conversation Manager | `ConversationService.send_message` |
| 2 | Intent Detection + Confidence | Model-assisted, rule-clamped | Intent Detection Engine (§1.1) | `ExtractedTripData.detected_intent`, `_merge_ai_data` intent logic |
| 3 | Memory Load | Yes | Memory subsystem (§5) | `_call_gemini` "already known" builder, `_load_learned_context` |
| 4 | Reasoning Assembly | Yes | Reasoning Engine (§1.5) | `_intent_field_rules`, real-options DB block |
| 5 | Inference + Recommendation | Yes (rules) + Model | Inference Engine (§1.7), Recommendation Engine (§1.8) | `_build_optional_prefilled`, `PURPOSE_DEFAULTS`, dormant `recommendation_engine` |
| 6 | Response Synthesis | **Model** | Response Synthesizer (§1.9) | Gemini structured call in `_call_gemini` |
| 7 | Insight Pass | Yes | Insight Engine (§6) | `PlanInsightEngine.run` |
| 8 | Emit & Persist | Yes | Conversation Manager + Widget Manager | `ConversationService`, SSE view |

**Invariant:** stages 1–5, 7, 8 never call the LLM. Only stage 6 does. A stage-6 failure falls back to a deterministic reply + the rule-selected widget (exactly as `ConversationEngine.process`'s `except` branch does today). The turn *always* completes.

### 1.1 Intent Detection

**Purpose:** classify the user's *primary travel goal* for this turn into one of the 11 canonical intents, and decide whether it changed.

Canonical intents (fixed — from `models.py`): `full_trip, hotel_only, flight_only, train_only, bus_only, cab_only, cruise_only, car_rental, transit_only, activities_only, food_and_dining`.

**Two-layer detection:**

1. **Deterministic keyword pre-classifier** (runs first, cheap, no LLM). A keyword table (already encoded in the `detected_intent` field description) maps trigger words → intent. If exactly one intent matches with high specificity (e.g. "flight to X" → `flight_only`), it becomes the **prior**.
2. **Model classification** (stage 6 output field `detected_intent`), constrained to the 11 values, receives the prior as a hint.

**Intent-change arbitration** (deterministic, post-model — exactly the rule in `_merge_ai_data`):

```
if draft has no intent yet:                    adopt model intent
elif model intent != full_trip:                adopt it (a specific service always wins)
elif user text contains an explicit full-trip phrase
     ("full trip", "entire trip", "whole trip", "full itinerary"):  set full_trip
else:                                           KEEP the established single-service intent
```

This prevents the classic failure where a `flight_only` session drifts to `full_trip` because the user said "and what about the weather there". The intent is **sticky** unless deliberately changed.

**Post-plan intent (Floating AI):** once a Trip exists, intent detection switches vocabulary from *trip-shape* intents to *operation* intents (§8.2): `modify_block, replace_block, add_block, remove_block, reorder, optimize_route, explain, answer_question, surface_live_info, rebook`. These never mutate `draft.intent`; they route to the proposal/answer machinery.

### 1.2 Intent Confidence

**Purpose:** a 0–100 measure of *how sure the classifier is*, distinct from `confidence_score` (which measures *how complete the trip profile is*). Both exist; do not conflate them.

| Signal | Weight | Source |
| --- | --- | --- |
| Deterministic keyword prior matched exactly one intent | +40 | pre-classifier |
| Model intent == keyword prior | +30 | agreement |
| Explicit service noun present ("flight", "hotel", "train") | +20 | tokenizer |
| Intent unchanged from previous turn | +10 | memory |
| Model intent == `full_trip` with no keywords (default) | cap at 55 | fallback |

**Behavioral thresholds:**

- `intent_confidence ≥ 75`: act on the intent silently. No confirmation.
- `50 ≤ intent_confidence < 75`: act, but **name the intent inside the reply** so a wrong guess is self-correcting ("Let's get your *flight* to Bareilly sorted — …"). No extra question.
- `intent_confidence < 50`: ask **one** disambiguating question via a **Quick Choice Widget** (§2) offering the top 2 candidate intents. Never a free-text "what do you want".

`intent_confidence` is emitted on the `state` event so the UI can, e.g., show a subtle intent chip.

### 1.3 Conversation State

The finite conversation state machine. State is derived, never stored as a mutable enum the model can corrupt — it is recomputed each turn from Draft + Trip + metadata (same philosophy as `is_ready_for_plan` and `missing_slots` being `@property`).

```
        ┌──────────┐   destination+dates+required set    ┌──────────┐
  ──▶   │ GATHERING │ ───────────────────────────────▶   │  READY   │
        └────┬─────┘                                      └────┬─────┘
             │ correction / new slot                          │ create_plan
             ▼                                                 ▼
        ┌──────────┐                                     ┌──────────┐
        │ GATHERING │  (loops, one slot per turn)         │GENERATING│ (async job)
        └──────────┘                                     └────┬─────┘
                                                              ▼
   ┌───────────┐   edit / question / optimize        ┌──────────────┐
   │  REFINING  │ ◀────────────────────────────────  │ PLAN_ACTIVE  │  (Floating AI)
   └─────┬─────┘   proposal accepted → re-enter        └──────┬───────┘
         │                                                    │ user books
         ▼                                                    ▼
   ┌──────────────┐                                     ┌──────────┐
   │ PLAN_ACTIVE   │                                     │ BOOKING  │ → TRAVELING → COMPLETED
   └──────────────┘                                     └──────────┘
```

State ↔ existing enums: `PlannerWorkspace.status` (`draft/active/…`) and `.mode` (`planning/exploring/booking/review/traveling/completed`) are the persisted projection of this machine. `GATHERING/READY/GENERATING` map to `status=draft`; `PLAN_ACTIVE/REFINING` map to `status=active, mode=planning`; the rest map straight through.

**State determines the tool palette** (which widgets/operations are legal). E.g. `optional_trip_details` is only offerable in `GATHERING`; `optimize_route` only in `PLAN_ACTIVE/REFINING`.

### 1.4 Conversation / Planner / Context Memory — pointer

The three memory tiers are fully specified in **§5**. In the orchestration loop they appear as stage 3 (load) and a `memory_delta` computed at stage 8 (what changed this turn, emitted on `state` for optimistic UI). Summary:

- **Conversation Memory** — message history (`PlannerChatMessage`), last 10 turns fed to the model.
- **Planner Memory** — Draft slots (pre-plan) + Trip blocks (post-plan). The source of truth for "what the plan is".
- **Context Memory** — volatile per-turn facts: live info just fetched, rejected suggestions, pending question, current widget on screen.

### 1.5 Reasoning Engine

**Purpose:** assemble the *deterministic decision context* the model reasons over, and make the decisions that must never be left to the model.

The Reasoning Engine produces a **Reasoning Frame** each turn — a structured object handed to the Response Synthesizer as system context. It is the generalization of today's hand-built system prompt in `_call_gemini`.

```
ReasoningFrame = {
  today, intent, intent_label, intent_confidence,
  known_slots:      [ {slot, value, provenance} ],      # "ALREADY COLLECTED"
  missing_slots:    [ slot ],                            # ordered by ask-priority
  next_slot:        slot | null,                         # THE single thing to ask (Reasoning decides, not model)
  intent_field_rules: str,                               # DO / DO NOT per intent (_intent_field_rules)
  real_options:     [ {mode, provider, code, price, duration, ...} ],  # DB-backed truth (real_options_block)
  recommendations:  [ {slot, value, rationale} ],        # from Recommendation Engine
  constraints:      [ {type, message, severity} ],       # from ConstraintEngine
  learned_patterns: [ {widget, proven_question} ],       # _load_learned_context
  rejected:         [ {suggestion, turn} ],              # do NOT re-suggest
  trip_snapshot:    {cities, days, open_proposals} | null,  # post-plan only
}
```

**Decisions the Reasoning Engine owns (never the model):**

1. `next_slot` — the single next thing to ask (§3.1). The model may *phrase* the ask; it may not *choose* it.
2. Widget selection (delegated to §1.11, but final say is deterministic).
3. Whether the trip is `ready` (`is_ready_for_plan`).
4. `confidence_score` (deterministic, §1.10 / `_calculate_confidence`).
5. Which real options are true (only DB rows; never model-invented prices — the existing `real_options_block` rule, hardened in §6.1).

**Decisions the model owns:** phrasing, tone adaptation to `visit_purpose`, which *fact/tip* to share, ordering of prose, whether a soft nearby-city nudge fits naturally.

### 1.6 Constraints as a reasoning input

`ConstraintEngine` (`services/constraints.py`, today used inside `plan_generation`) is promoted to a per-turn input. It evaluates hard/soft constraints against the current Draft/Trip and returns violations that the Reasoning Engine injects into the frame:

- **Hard constraints** (block progress, must be resolved): dates in the past, end < start, destination unreachable by the chosen mode, traveler count ≤ 0.
- **Soft constraints** (advisory, surfaced as insight or gentle reply note): budget too low for destination tier, single-day international trip, honeymoon on a hostel budget.

Hard-constraint violations **force** the next question (override `next_slot` ordering). Soft ones become a reply aside or a post-plan insight.

### 1.7 Inference Engine

**Purpose:** fill slots *without asking*, from cheap signals. Every inference carries **provenance = inferred** and is overridable. This is the single most important lever for "never ask unnecessary questions" (§Fundamental Rules).

Inference sources, in priority order:

| Source | Example | Existing anchor |
| --- | --- | --- |
| Explicit text this turn | "3 adults" → travelers=3 | regex in `_merge_ai_data` |
| Semantic phrase table | "me and mom"→2, "solo"→1, "couple"→2 | `_merge_ai_data` phrase list |
| Visit-purpose defaults | purpose=honeymoon → budget=premium, class=1AC | `PURPOSE_DEFAULTS` |
| Destination tier | "Paris" → international_premium base rate | `DEST_TIER_RATES` |
| Traveler profile (cross-session) | home_origin=Delhi from last trip | `TravelerProfile` facts |
| Interest inference from destination | beach destination → interests=[beach,nature] | `_intent_field_rules` full_trip note |
| Recommendation defaults | recommended budget INR | `_compute_recommended_budget_inr` |

**Inference rule:** an inferred value **pre-fills** the relevant widget and **suppresses the question**, but is shown to the user (in the reply or the pre-filled form) so they can correct it. Inference never silently commits a value the user can't see. A user correction (§Correction Handling) upgrades provenance from `inferred` → `user_confirmed` and locks it.

### 1.8 Recommendation Engine (activate the dormant module)

`services/recommendation_engine.py` exists but is referenced only from `views.py:965`. This spec **activates it as a first-class per-turn producer.**

**Purpose:** for the current intent + known slots, produce *specific, DB-grounded* recommendations the reply should state **proactively** ("I'd suggest X because Y"), not ask about.

**Contract:**

```
RecommendationEngine.recommend(draft_or_trip, intent, slot=None) -> [
  { slot, value, rationale, provenance, source_ref }
]
```

Rules:

1. **Prefer DB truth.** If `real_options` has matching rows (flights/trains/hotels for the route+date), recommend a *named specific* option ("IndiGo 6E-2401, 08:15, direct, ₹4,200"). Never invent a competitor.
2. **Fall back to structured heuristics** when no DB row exists: purpose defaults, tier rates, class-by-purpose (`hometown→Sleeper`, `business→2AC`, `honeymoon→1AC`). These carry `provenance=heuristic`.
3. **One headline recommendation per turn**, plus at most one alternative ("…or the afternoon flex slot"). More than two options becomes a **Comparison Widget** (§2), not prose.
4. Recommendations feed the Reasoning Frame; the model must weave the headline into the reply (enforced by the response contract §1.9).

### 1.9 Response Synthesizer (the one LLM step)

**Model:** `gemini-2.5-pro` for plan generation and complex turns; `gemini-2.5-flash` acceptable for lightweight enrichment/answer turns (matches current model split). Structured output via a Pydantic response schema, `response_mime_type="application/json"`.

**The synthesizer receives** the Reasoning Frame (§1.5) as system context and the last 10 messages as chat history. **It returns** a superset of today's `ExtractedTripData`:

```
SynthResult = ExtractedTripData + {
  reply: str,                    # persona-driven prose (streamed as tokens)
  slot_extractions: {...},       # destination/dates/etc (existing fields)
  context_updates: {...},        # corrections (existing)
  chosen_widget: str | null,     # model PREFERENCE; Reasoning Engine has final say
  live_info_requests: [str],     # e.g. ["weather","flight_status:6E-2401"] — triggers info widgets
  operation: {...} | null,       # post-plan: {op, target_block, params} for proposal building
  suggested_replies: [str],      # 2-3 tap-ahead chips
}
```

**Persona contract (from `_call_gemini` system prompt — keep verbatim in spirit):** the assistant is "Priya," a world-class human consultant. Rules that are **mandatory and enforced by post-validation**:

- Respect intent strictly (flight_only stays about flights).
- One question maximum per turn; never two.
- Never re-ask anything in `known_slots`.
- Value-driven inquiry: every question is paired with a reason/tip.
- Name specific DB-backed services/prices; never fabricate.
- Tone adapts to `visit_purpose` (business=efficient, honeymoon=romantic, hometown=warm, emergency=calm+fast).
- No corporate filler ("Certainly!", "Absolutely!", "I'd be happy to help").

**Post-validation (deterministic, after the model returns):** count question marks in `reply`; if >1 distinct question, keep only the one aligned to `next_slot` (truncate the rest). Strip any mention of a `known_slot`. Replace `chosen_widget` with the Reasoning Engine's selection if they disagree on a *prerequisite* violation (the exact guard in `ConversationEngine.process` lines 371–384).

### 1.10 Confidence Score (trip completeness) — keep deterministic

Unchanged in philosophy from `_calculate_confidence`: a 0–100 completeness score computed in Python, **never** the model's estimate. Mandatory base (destination 20, dates 20, required-origin 10), visit_purpose +15, then weighted optionals. Emitted on `state`; drives the UI progress ring and the "you're all set" affordance. Extend the weight table when new slots are added; never let the model author this number.

### 1.11 Widget Manager & Widget Selection Engine

**Widget Manager** owns widget *lifecycle*: show, hide, replace, reuse, update. **Widget Selection Engine** owns *which* widget, if any.

**Selection algorithm (deterministic, generalizes `_determine_widget`):**

```
1. Model proposes chosen_widget (a preference).
2. Validate against a prerequisite gate:
     - a widget whose inputs aren't ready is rejected (e.g. origin_search before destination known)
     - a widget for an already-filled slot is rejected
3. If model widget invalid OR null → fall through to the deterministic priority ladder:
     destination? → origin (if required)? → dates? → optional_details (unless emergency)? → nearby_cities (full_trip 3+ days)? → none
4. Post-plan turns use the operation→widget map (§8.4), not the ladder.
5. Emit EXACTLY ONE conversation widget per turn (info widgets are exempt — see below).
```

**One-widget rule** applies to *interaction* widgets (things that collect an answer). **Information widgets** (weather, flight status, map — §2 family C) are exempt: a turn may show one interaction widget *and* one or more info widgets, because info widgets don't compete for the user's answer. The manager caps info widgets at **2 per turn** to avoid clutter.

**Reuse vs replace:** if the same widget type would be shown two turns running with new data (e.g. an updated Comparison), the manager **updates in place** (same widget id) rather than stacking a new card. New widget id only when the *kind* changes.

### 1.12 Knowledge Engine

**Purpose:** the read side of all non-conversational travel truth — the DB-first knowledge layer the Reasoning/Recommendation/Insight engines query. It is a façade over existing reference data and enrichment.

Sources (all existing): `TravelPriceHistory` (real fares), `HotelMaster/AttractionMaster/RestaurantMaster/ActivityMaster` (places, cache-on-miss via `_enrich_and_cache_activity`), `City/Country`, `HolidayCalendar`, `TravelSeason` (phenomena), `LocationDistanceCache`, opening hours.

**Contract:** synchronous, cached, **never invents**. On a miss it either (a) returns "unknown" (honest degradation) or (b) triggers the existing cache-on-miss enrichment (Gemini place-details → write-through to master tables) *only* for place details, never for prices. Prices are DB-or-nothing.

### 1.13 Workspace Synchronization — pointer

Fully specified in **§7**. The one rule to internalize here: **the AI never writes the Trip directly.** It emits a `PlanProposal` (diff + rationale) and the user accepts. The staleness guard (`base_trip_updated_at`) means a proposal computed against an old plan **expires** rather than mis-merging (the exact guard in `accept_proposal`, `views.py:530`).

### 1.14 Floating AI Context — pointer

Fully specified in **§8**. It reuses this entire orchestration loop with a post-plan intent vocabulary and a `trip_snapshot` in the Reasoning Frame.

### 1.15 Planner Handoff

The transition `READY → GENERATING → PLAN_ACTIVE` (the existing `create_plan`). At handoff:

1. The Draft is frozen into a Trip (`_generate_itinerary_with_ai`) and a pristine copy saved (`PlannerTripOriginal`) so "revert to original" is always possible.
2. Durable traveler facts are recorded (`_record_traveler_facts`) with `provenance=inferred`.
3. The successful conversation shape is recorded (`_record_successful_flow` → `PlannerIntentFlow`) for learning.
4. The orchestrator switches to the post-plan vocabulary; Context Memory is reset (pending questions cleared) but Conversation and Planner memory persist.

### 1.16 Correction Handling

Two paths, both already prototyped:

- **Slot correction (pre-plan):** "actually make it 3 people", "change to business class", "no, Aug 10". Detected as `context_updates` (existing `ContextUpdates` schema). Applied **silently** (no widget), confirmed in prose ("Updated to 3 travelers — noted!"), provenance upgraded to `user_confirmed`, and the slot **locked** against further inference.
- **Plan edit (post-plan):** "move dinner to 8pm", "swap the museum for the market". The narrow, safe subset (re-time) is already `propose_retime_from_chat`; §7.4 generalizes it to move/replace/remove/add via block resolution + candidate search, each producing a `PlanProposal`. Ambiguity → propose nothing and ask one clarifying question (never guess a wrong-block edit).

**Correction never rebuilds the plan.** It edits the minimal set of blocks (§7.5).

### 1.17 Clarification Strategy

Ask only when *all* are true: (a) the slot is required or high-value, (b) it cannot be inferred with acceptable confidence, (c) getting it wrong is costly. Otherwise infer + show + let the user correct. When you must ask:

- Exactly one question.
- Paired with a reason (value-driven inquiry).
- Backed by the *cheapest sufficient* widget (a Quick Choice beats a free-text; a pre-filled form beats N separate questions).
- Never ask two turns in a row without delivering value in between.

### 1.18 Fallback Strategy

Layered, each layer strictly more degraded but always functional (mirrors `ConversationEngine.process` except-branch and `_skeleton_fallback`):

1. **Model returns malformed/empty** → use deterministic reply (`_fallback_reply`) + rule-selected widget.
2. **Model call fails entirely** → same as (1); log, don't surface the error to the user.
3. **Streaming fails mid-turn** → client falls back to the classic POST endpoint (existing `chatStream.ts` contract: throw → caller retries non-streaming).
4. **Plan generation fails** → deterministic skeleton itinerary (`_skeleton_fallback`) with honest "draft" labeling.
5. **Knowledge miss** → "I don't have live data for that right now" — never fabricate.

### 1.19 Recovery Strategy

After any fallback or user frustration signal ("that's wrong", repeated correction, "start over"):

- **Re-ground:** restate the known slots ("So far: Goa, Aug 10–15, 2 adults — is that right?") using a **Conversation Summary Widget** (§2).
- **Offer a reset scope:** correct one slot / rebuild plan / start fresh — as a Quick Choice, not a wall of text.
- **Never lose memory silently.** A "start over" confirms before clearing; traveler profile facts survive.

---

## 2. Deliverable 2 — Conversation Widget Library

### 2.0 What a Conversation Widget is (and isn't)

A Conversation Widget is a **reusable interaction/information component the AI chooses to render inside the chat stream** to communicate more efficiently than prose. It is **not** a planner block, **not** a booking interface, and it **never drives the conversation** — the AI decides when it appears, updates, or dies. Widgets are registered exactly like today's `widgetRegistry.ts` (`type` string → React component) and delivered on the `widgets` SSE event as `{ type, data }`.

Today's 5 (`destination_search, origin_search, date_range_picker, optional_trip_details, nearby_cities_recommendation`) are the **input family** and remain canonical. This section defines the full library across five families.

### 2.1 The widget spec template (every widget below is fully specified against this)

Every widget is documented with: **Purpose · Use when · Don't use when · Inputs · Outputs · Memory writes · AI reasoning · Interaction · Visual hierarchy · Desktop · Tablet · Mobile · Loading · Empty · Error · Animation · Accessibility · Transitions · Common follow-ups.** To keep the document usable, shared conventions are stated once here and referenced as "standard" per widget:

- **Standard loading:** skeleton shimmer matching final layout, 1 accessible "Loading …" live-region announcement.
- **Standard empty:** a single-line explanation + one recovery action; never a dead end.
- **Standard error:** inline, non-blocking, "couldn't load — retry / continue without" — the conversation proceeds regardless.
- **Standard a11y:** full keyboard operability, roles/labels, focus moves *to* the widget on show and *back to composer* on submit, respects `prefers-reduced-motion`, ≥4.5:1 contrast, live-region for async results.
- **Standard transitions:** enter = fade+rise 180ms; update-in-place = crossfade content, keep frame; exit = fade 120ms. Only one interaction widget on screen at once.
- **Standard responsive:** Desktop = inline card max-width ~560px; Tablet = full chat-column width; Mobile = full-bleed with 16px gutters, sticky primary action, thumb-reachable controls.
- **Output shape:** every submitting widget calls `onSubmit(message, structuredValue)` where `structuredValue = { field, value }` — the exact contract the backend `_apply_structured_value` consumes.

Below, only widget-specific deviations from these standards are called out.

### 2.2 Family A — Input / Slot-collection widgets

These collect required or high-value slots. Exactly one per turn. All write to Draft (pre-plan).

#### A1. Destination Widget — `destination_search` *(exists)*
- **Purpose:** capture the destination city/place.
- **Use when:** `destination_text` is empty. Always the first widget.
- **Don't use when:** destination already known, or the user just stated it in text (advance to next widget — the exact guard in `_call_gemini` widget rules).
- **Inputs:** `{}` (autocomplete queries the City reference API).
- **Outputs:** `{ field:"destination", value:{ id, name, country } }`.
- **Memory writes:** `draft.destination_text`, `draft.destination_city` (FK if matched, else null — `_apply_structured_value`).
- **AI reasoning:** none needed to select; it's the ladder root.
- **Interaction:** typeahead, keyboard-navigable results, enter to select.
- **Visual hierarchy:** search field primary; 4–6 suggestion rows with country + region.
- **Loading:** typeahead spinner in-field. **Empty:** "No match — type the city name." **Error:** allow free-text destination (backend accepts unmatched text).
- **Animation:** results stagger-in 40ms each.
- **Follow-ups:** OriginWidget (transit intents) or DateRangeWidget.

#### A2. Current Location Widget — `current_location`
- **Purpose:** one-tap "use my location" for origin/pickup (cab, transit, "near me").
- **Use when:** origin/pickup needed *and* device geolocation is plausibly useful (cab_only, nearby_* queries).
- **Don't use when:** origin already known; international flight origin (city typeahead is clearer).
- **Inputs:** `{ purpose:"origin"|"pickup" }`.
- **Outputs:** `{ field:"origin"|"pickup", value:{ lat, lng, name } }` (reverse-geocoded).
- **Memory writes:** `metadata.origin` / `metadata.pickup` + coords.
- **AI reasoning:** offered alongside OriginWidget as a shortcut, never instead of it (permission may be denied).
- **Interaction:** single primary button → permission prompt → resolved chip.
- **Loading:** "Finding you…" **Empty/denied:** silently fall back to OriginWidget. **Error:** same.
- **A11y:** button, not auto-triggered (never request geolocation without a tap).
- **Follow-ups:** DateRangeWidget / TimeWidget.

#### A3. Origin Widget — `origin_search` *(exists)*
- **Purpose:** departure city for transit intents.
- **Use when:** intent ∈ {flight, train, bus, cab, car_rental, transit} and `metadata.origin` empty (the `INTENT_REQUIRED_FIELDS` "origin" gate).
- **Don't use when:** origin not required (hotel_only, activities, food, full_trip already knows or infers it).
- **Inputs:** `{ destination, intent }`. **Outputs:** `{ field:"origin", value:{ id, name } }`.
- **Memory writes:** `metadata.origin`.
- **AI reasoning:** selected by the ladder only after destination known.
- **Follow-ups:** DateRangeWidget.

#### A4. Date Widget / A5. Flexible Date Widget — `date_range_picker` *(exists)* + `flexible_dates`
- **Purpose:** travel dates. `date_range_picker` = exact range; `flexible_dates` = "±3 days / this weekend / next month / cheapest week".
- **Use when:** dates missing. Choose `flexible_dates` when the user signals flexibility ("sometime in August", "a weekend") — it unlocks cheapest-day insights; else exact picker.
- **Don't use when:** both dates known/inferred.
- **Inputs:** `{ intent, destination, origin }`. **Outputs:** `{ field:"travel_dates", value:{ start_date, end_date, flexible?:bool, window?:days } }`.
- **Memory writes:** `draft.start_date/end_date`; transit intents auto-set end=start if single-day (the guard in `_determine_widget`).
- **AI reasoning:** pairs the picker with a seasonal/price reason (value-driven inquiry).
- **Visual:** calendar range; flexible variant shows a week-strip with price hints when `real_options` present.
- **Follow-ups:** OptionalDetailsWidget or NearbyCities.

#### A6. Time Widget — `time_picker`
- **Purpose:** a clock time (cab pickup, restaurant reservation, flight window).
- **Use when:** intent needs a time-of-day and it's unset (cab_only pickup, food reservation).
- **Don't use when:** the coarse `time_window` chips (morning/afternoon/evening) suffice — prefer Quick Choice then.
- **Inputs:** `{ context:"pickup"|"reservation", date }`. **Outputs:** `{ field:"time", value:"HH:MM" }`.
- **A11y:** native time semantics; spinner + text entry both.

#### A7. Duration Widget — `duration_picker`
- **Purpose:** trip/rental length when dates are anchored one-sided ("5 days from the 10th").
- **Use when:** start known, end unknown, user thinks in duration.
- **Outputs:** `{ field:"travel_dates", value:{ start_date, end_date(derived) } }`.
- **AI reasoning:** convert duration→end_date deterministically; confirm in reply.

#### A8. Travelers Widget — `travelers_picker`
- **Purpose:** adults/children/infants counts.
- **Use when:** party size matters and can't be inferred; usually folded into OptionalDetails, standalone only on correction.
- **Outputs:** `{ field:"travelers", value:{ adults, children, infants } }` (exact `_apply_structured_value` shape).
- **Memory writes:** `draft.adults/children/infants`.

#### A9. Budget Widget — `budget_picker`
- **Purpose:** tier + amount. Slider (INR) with tier labels (budget/mid_range/premium).
- **Use when:** budget unset and material to recommendations.
- **Inputs:** `{ recommended_budget_inr, purpose_defaults }` (from `_compute_recommended_budget_inr`). **Outputs:** `{ field:"budget", value:{ tier, amount, currency } }` or `{ budget_inr }`.
- **AI reasoning:** pre-position the slider at the recommended value; state the recommendation first ("For 7 days in Bali I'd suggest ~₹2.5L…").

#### A10. Trip Purpose Widget — `purpose_chips`
- **Purpose:** visit_purpose (vacation/business/hometown/family/honeymoon/solo/event/emergency).
- **Use when:** purpose undetected and it would materially change tone/defaults; often inferred instead (§1.7) so widget is a fallback.
- **Outputs:** `{ field:"visit_purpose", value }`. **Memory writes:** `metadata.visit_purpose` → cascades `PURPOSE_DEFAULTS`.
- **AI reasoning:** detecting purpose unlocks a whole defaults cascade, so it's high-value; still one tap, never a question wall.

#### A11–A20. Preference widgets (folded into `optional_trip_details`)
`optional_trip_details` *(exists)* is a **composite** widget rendering the intent's optional fields (`INTENT_OPTIONAL_FIELDS`) as one pre-filled form: Accommodation Preference (star_rating, amenities, property_type), Transportation Preference (train_class, flight_class, cabin_class, car_type, vehicle_type, bus_type, preferred_mode, transmission, non_stop), Interest (multi-select), Food Preference (meal_type, cuisine, dietary, ambiance), Trip Pace/Intensity, Time Window, Accessibility, Language, Currency.
- **Purpose:** collect *all remaining optionals in one shot*, pre-filled from inference/defaults, so the user confirms rather than answers N questions.
- **Use when:** all mandatory slots done, `optional_submitted` false, intent has optionals, not emergency.
- **Don't use when:** emergency (skip → ready), or already submitted.
- **Inputs:** `{ fields, intent, prefilled, destination, duration_days }` (exact `_build_widget_payload_for_type` shape). **Outputs:** `{ field:"optional_trip_details", value:{...all fields} }` → sets `optional_submitted=true`.
- **AI reasoning:** this widget is the embodiment of "infer + confirm". The reply states the headline recommendation; the form carries every pre-filled default with provenance chips.
- **Visual:** grouped sections, each field defaulted, "looks good" primary CTA, per-field edit.
- **Mobile:** accordion sections, sticky "Confirm" bar.
- **Follow-ups:** NearbyCities (full_trip 3+ days) or ready-to-plan.

### 2.3 Family B — Choice / Guidance widgets

#### B1. Quick Choice Widget — `quick_choice`
- **Purpose:** disambiguate with 2–4 tappable options (intent disambiguation, yes/no, either/or).
- **Use when:** a single decision with a small closed set (intent_confidence<50; "morning or afternoon?"; "add this or skip?").
- **Don't use when:** the set is open (use search) or >4 options (use Comparison/Recommendation).
- **Inputs:** `{ prompt, options:[{id,label,sublabel}] }`. **Outputs:** `{ field:<contextual>, value:<option id> }`.
- **Interaction:** chips/buttons; keyboard arrows; enter selects.
- **Animation:** chips pop-in 60ms stagger. **Follow-ups:** whatever the chosen branch needs.

#### B2. Recommendation Widget — `recommendation`
- **Purpose:** present the AI's headline pick as a rich card (specific option + rationale + one action).
- **Use when:** Recommendation Engine has a strong single pick worth showing visually (a named flight/hotel/train with price).
- **Don't use when:** ≥3 comparable options (→ Comparison) or a pure text nudge suffices.
- **Inputs:** `{ title, subtitle, price, rating, rationale, provenance, action }`. **Outputs:** `{ field, value:"accept"|"see_alternatives" }`.
- **AI reasoning:** provenance chip is mandatory ("from live fares" vs "typical for this route"). Never a fabricated price.
- **Follow-ups:** Comparison ("see alternatives") or advance.

#### B3. Comparison Widget — `comparison`
- **Purpose:** side-by-side of 2–4 options across shared dimensions (price/duration/class/rating).
- **Use when:** transit_only route compare, flight options, hotel shortlist — the "Train 4h ₹800 vs Bus 5h ₹400" moment (`_intent_field_rules` transit).
- **Don't use when:** one clear winner (→ Recommendation) or >4 (→ scrollable list, still capped).
- **Inputs:** `{ dimensions:[...], options:[{...}], recommended_id }`. **Outputs:** `{ field, value:<chosen id> }`.
- **Visual:** columns desktop, stacked cards mobile with a "best value" ribbon on the recommended one.
- **A11y:** table semantics; each option a labeled group.

#### B4. Nearby Cities Widget — `nearby_cities_recommendation` *(exists)*
- **Purpose:** suggest 2–3 nearby excursions for multi-day full trips.
- **Use when:** intent=full_trip, destination+dates known, 3+ days, none added yet, model produced suggestions (exact gate in `_determine_widget`).
- **Outputs:** `{ field:"add_nearby_city", value:{ city }|{ cities:[...] } }` → appended to `metadata.nearby_cities`, later distributed across days in generation (`_generate_itinerary_with_ai` multi-city logic).
- **Interaction:** add/skip per suggestion; multi-add supported.
- **Follow-ups:** ready-to-plan.

#### B5. AI Insight Widget — `ai_insight`
- **Purpose:** surface a contextual insight inline in chat (price trend, peak season, crowd, weather, packing, time-saver). The conversational face of §6.
- **Use when:** an insight rule fires *and* the moment is relevant to the current turn (post an important answer).
- **Don't use when:** generic advice (banned) or the insight has a concrete diff (→ Proposal path instead).
- **Inputs:** `{ severity, message, related_block_ids?, source }`. **Outputs:** dismiss / "tell me more" (→ follow-up turn).
- **Visual:** subtle accent by severity (info/warning), icon, one-line message, optional expand.

#### B6. AI Explanation Widget — `ai_explanation`
- **Purpose:** "why did you recommend this?" — expose the rationale/provenance behind a pick or a plan choice (transparency principle §9).
- **Use when:** user asks why, or a non-obvious recommendation warrants proactive justification.
- **Inputs:** `{ decision, factors:[{factor, weight, value}], sources }`. Read-only.
- **A11y:** disclosure pattern; fully readable.

### 2.4 Family C — Live Information widgets (informational, non-booking)

All Family C widgets are **informational**: they never collect a slot, are exempt from the one-widget rule (§1.11, cap 2/turn), read from the Knowledge Engine (§1.12), and **degrade honestly** ("no live data" beats fabrication). All triggered by `live_info_requests` in the synth result. Common shape: `Inputs = {query-specific}`, `Outputs = none (informational)`, `Memory writes = Context Memory only (recently_viewed)`.

| Widget | `type` | Purpose | Use when | Data source | Loading / Empty / Error |
| --- | --- | --- | --- | --- | --- |
| Weather | `weather` | current + trip-window conditions | destination/date known & relevant; packing/season talk | weather source / `TravelSeason` normals | standard / "no forecast this far out" / retry |
| Forecast | `forecast` | multi-day forecast strip | trip within forecast horizon | same | standard |
| Air Quality | `air_quality` | AQI + advisory | health-relevant destinations, user asks | AQI source | honest degrade |
| Traffic | `traffic` | live congestion on a leg | cab/road-trip timing | maps/traffic | degrade |
| Road Condition | `road_condition` | closures/passes | road_trip, hill routes | advisories | degrade |
| Flight Status | `flight_status` | live status of a named flight | user names a flight / booked flight day | status source | "flight not found" |
| Train Running Status | `train_running_status` | live train position/delay | user names a train / booked train | rail source | degrade |
| Airport Info | `airport_info` | terminals, transit, amenities | airport named | reference | degrade |
| Railway Station Info | `station_info` | platforms, facilities | station named | reference | degrade |
| Metro Status | `metro_status` | line status/map | urban transit query | reference | degrade |
| Bus Status | `bus_status` | operator/route status | bus route named | reference | degrade |
| Distance | `distance` | distance + travel time A→B | any two known points | `LocationDistanceCache`/haversine | cached |
| Route | `route` | route line + steps | "how do I get from…" | maps | degrade |
| Map | `map` | map with pins | any geo answer; nearby results | maps | degrade |
| Local Time | `local_time` | destination clock + offset | cross-tz planning | tz db | instant |
| Currency / Forex | `forex` | rate + converted amount | budget in foreign currency | forex source | degrade |
| Nearby Places | `nearby_places` | POIs near a point | "what's around X" | place masters + enrich | empty→widen radius |
| Nearby Hotels | `nearby_hotels` | stays near a point (info) | "hotels near the station" | `HotelMaster` | empty→enrich |
| Nearby Restaurants | `nearby_restaurants` | food near a point | food_and_dining, "eat near here" | `RestaurantMaster` | empty→enrich |
| Nearby Attractions | `nearby_attractions` | sights near a point | activities, gaps in plan | `AttractionMaster` | empty→enrich |
| Visa | `visa` | requirement by passport/destination | international, visa intent | reference | **honest-degrade mandatory** (never invent visa rules) |
| Passport | `passport` | validity/blank-page rules | international prep | reference | degrade |
| Festival / Events | `events` | dated local events/holidays | date overlap | `HolidayCalendar`/events | degrade |
| Safety Advisory | `safety_advisory` | official advisories | flagged destinations | advisories | degrade |
| Emergency | `emergency_contacts` | local emergency numbers/embassy | emergency intent, safety | reference | always show generic if specific missing |
| Local Tips | `local_tips` | curated local know-how | destination context | enrich/tips | degrade |
| Packing | `packing` | packing checklist from weather+activities | pre-trip, weather insight | derived | derived |
| Travel Advisory (composite) | `travel_advisory` | visa+safety+health rollup | international full_trip | rollup | degrade |

**Visa/Passport/Safety honesty rule (hard):** these three **must** show provenance and last-updated, and **must** degrade to "verify with the official source" rather than assert an unverified rule. This directly answers the adversarial-audit finding "fabricated visa data." No exceptions.

### 2.5 Family D — Structural / Session widgets

| Widget | `type` | Purpose | Use when | Outputs |
| --- | --- | --- | --- | --- |
| Timeline | `timeline` | compact day/hour timeline preview in chat | referencing the plan mid-conversation | tap block → focus in Workspace |
| Calendar | `calendar` | month view of the trip | date-spanning discussion | tap day |
| Progress | `progress` | the confidence ring + missing slots | user asks "what else do you need" | none |
| Conversation Summary | `conversation_summary` | restate known slots for re-grounding (§1.19) | recovery, "what do you have so far" | confirm / correct-a-slot |
| Continue Planning | `continue_planning` | resume a prior session | returning user, dormant workspace | resume / new |
| Recent Searches | `recent_searches` | prior destinations/queries | session start, empty state | pick |
| Favorites / Saved Places | `saved_places` | user's saved items | "add from my saved" | select |
| History | `history` | past trips | "like my last trip" | clone-as-basis |
| Gallery | `gallery` | destination photos | inspiration, destination reveal | none |
| Review / Rating | `reviews` | ratings for a place | evaluating an option | none |
| Confirmation | `confirmation` | confirm a consequential action | before plan rebuild, before clearing memory | confirm / cancel |
| Upload / Document | `document_upload` | attach passport/ticket/PDF | doc-assist, prep | file → parsed facts |
| Voice | `voice_input` | speech-to-text entry | hands-free / accessibility | transcript → normal turn |

**Structural widget rules:** these are mostly read-only or session-level; they do **not** count against the interaction one-widget rule unless they submit a slot (`conversation_summary` correction, `saved_places` select, `document_upload`). `confirmation` is mandatory before any irreversible/expensive action (plan rebuild, memory clear, booking).

### 2.6 Widget → follow-up graph (selection determinism)

The Widget Selection Engine walks this graph (pre-plan). Each node lists its natural successor(s); the engine picks the first whose prerequisites are met:

```
destination_search
   └─▶ [transit intent] origin_search ──▶ date_range_picker
   └─▶ [non-transit]                       date_range_picker
date_range_picker
   └─▶ optional_trip_details        (unless emergency)
optional_trip_details
   └─▶ [full_trip, 3+ days] nearby_cities_recommendation
   └─▶ ready → (none; offer Create Plan)
[any turn] ai_insight / live-info widgets  — additive, don't advance the ladder
[low intent confidence] quick_choice (intent)  — inserted before destination
[correction] silent context_update — no widget
```

Post-plan follow-ups are governed by the operation→widget map in §8.4.

---

## 3. Deliverable 3 — Conversation Intelligence (how the AI thinks)

This is **reasoning, not a decision tree.** There is no scripted flowchart of "if user said X go to node Y." There is a Reasoning Frame (§1.5) recomputed every turn and a set of policies the orchestrator applies to it. The intelligence is emergent from these policies.

### 3.1 How the AI chooses the next question

A single deterministic function `next_slot(frame)` decides *what* to ask; the model only phrases it.

```
Priority order (first unsatisfied wins):
  1. Hard constraint violation      → must resolve (e.g. dates in past)
  2. Required slot missing          → destination → origin(if req) → dates   (INTENT_REQUIRED_FIELDS order)
  3. High-value uninferred optional → visit_purpose (unlocks defaults), then budget
  4. Remaining optionals            → folded into ONE composite form (optional_trip_details), not asked serially
  5. Enrichment nudge               → nearby cities (only full_trip 3+ days)
  6. Nothing                        → ready; stop asking
```

**Key rule:** never ask for a slot in priorities 3–4 individually if it can be batched into the composite form. Serial single-slot questions are reserved for required slots and corrections. This is why the live system has exactly one "questiony" widget (`optional_trip_details`) rather than eight.

### 3.2 How the AI chooses the next widget

Delegated to the Widget Selection Engine (§1.11) — model preference validated against a prerequisite gate, else the deterministic ladder (§2.6). The pairing rule: **the widget is chosen for `next_slot`, and the reply is phrased to introduce that widget.** Widget and prose are always coherent because both derive from the same `next_slot`.

### 3.3 How the AI skips unnecessary questions

Three suppressors, checked before any question is emitted:

1. **Known** — slot in `known_slots` (never re-ask; enforced by the "ALREADY COLLECTED" block + post-validation strip).
2. **Inferable** — Inference Engine (§1.7) can fill it with acceptable confidence → infer + show + don't ask.
3. **Irrelevant to intent** — slot not in this intent's required/optional set (the `_intent_field_rules` "NEVER ask about…" clauses). flight_only never asks about hotels.

A question survives only if it passes all three.

### 3.4 How the AI infers missing information

Per §1.7, in priority order: explicit text → semantic phrases → purpose defaults → destination tier → traveler profile → interest-from-destination → recommendation defaults. Every inference is provenance-tagged and pre-filled, never silently committed. Inference is *aggressive but visible*: fill everything you reasonably can, show it all, let one correction fix any miss.

### 3.5 How the AI detects uncertainty

Uncertainty signals, each lowering the confidence to act and biasing toward "show + let correct" or "one Quick Choice":

- `intent_confidence < 50` (ambiguous goal).
- Inference sources conflict (text says 2 but profile says 4).
- A constraint is soft-violated (budget too low → uncertain the plan will satisfy).
- The model's extraction and the deterministic regex disagree.
- User signals doubt ("I think", "maybe", "not sure").

Response to uncertainty is **never** more questions in bulk — it's one targeted clarification or a visible assumption the user can veto.

### 3.6 How the AI decides enough information exists

`ready = is_ready_for_plan` — deterministic: all `INTENT_REQUIRED_FIELDS` satisfied. That's the **floor** to allow plan creation. But the AI keeps *offering* value (optionals, nearby cities) past the floor without blocking. The user can create the plan the moment `ready` flips true; everything after is enhancement, framed as optional. Emergency intent shortcuts straight from `ready` to plan (skips optionals).

### 3.7 How the AI revisits previous answers

The Draft is the single source of truth; any turn can update any slot via `context_updates`. Revisiting is not special-cased — a correction is just an extraction that targets a filled slot. The "ALREADY COLLECTED" context ensures the model knows what exists so it can confirm-and-change rather than re-ask. Post-plan, revisiting a *plan* decision routes through the proposal path (§7).

### 3.8 How the AI handles corrections

Per §1.16: pre-plan slot corrections apply silently + confirm in prose + lock the slot; post-plan plan corrections become proposals. The lock (provenance `user_confirmed`) prevents a later inference from stomping a value the user explicitly set — a real failure mode this closes.

### 3.9 How the AI changes direction naturally

Intent-change arbitration (§1.1) is sticky-but-yielding: a specific new intent wins immediately; a drift toward `full_trip` is resisted unless explicit. When direction genuinely changes ("actually, forget the flight, plan me the whole trip"), the orchestrator: (a) switches intent, (b) preserves compatible slots (destination, dates, origin carry over), (c) recomputes `missing_slots` for the new intent, (d) acknowledges the pivot in prose. No memory is discarded on a pivot — only re-scoped.

### 3.10 How the AI avoids repetitive questions

- **Known-slot strip** (post-validation) removes any re-ask.
- **Rejected set** (Context Memory) — a suggestion the user declined is not re-offered this session (e.g. declined nearby city).
- **One-question cap** — structurally impossible to stack questions.
- **Learned patterns** — `PlannerQuestionBank` biases toward phrasings that *worked*, away from ones that stalled.
- **No two question-turns in a row** without intervening value.

### 3.11 How the AI learns (reinforcement across sessions)

Two existing tables close the loop:

- **`PlannerQuestionBank`** — records `(intent, destination, widget_type, question_text)` with `occurrence_count` and `success_count`. On a successful widget submission, the preceding assistant question's `success_count` increments (`ConversationService.send_message` step 1). Proven questions are fed back as *tone inspiration* (`_load_learned_context`) — never copied verbatim.
- **`PlannerIntentFlow`** — on plan creation, the ordered widget sequence is recorded with running `avg_messages_to_complete` and `completion_rate` (`_record_successful_flow`). Future sessions for the same intent+destination can prefer the proven flow shape.

This is bandit-style reinforcement: exploit proven flows, explore when data is thin. The learning is **advisory** — it biases the deterministic ladder and the model's phrasing, never overrides hard rules.

### 3.12 How the AI explains recommendations

Every recommendation carries `rationale` + `provenance` + `source_ref`. The AI Explanation Widget (§2 B6) exposes the factor breakdown on demand. Proactive explanation fires when a pick is non-obvious (a pricier option chosen for a reason). Rule: **a recommendation the user can't interrogate is not allowed** — transparency is a hard UX principle (§9).

### 3.13 How the AI balances asking vs inferring

The governing trade: **cost of a wrong inference vs cost of a question.** Formalized:

```
ask  if:  slot is required AND not inferable-with-confidence
          OR wrong value is expensive/irreversible (dates for booking, passport)
infer if: slot is optional OR inferable-with-confidence
          AND wrong value is cheap to correct (visible + one tap to fix)
```

Default bias is **infer** (the product mandate: "never ask unnecessary questions; infer whenever possible"). Asking is the exception, earned by required-ness or cost.

---

## 4. Deliverable 4 — Intent Flows

Each flow is expressed as a **reasoning profile**, not a script: goal, reasoning stance, conversation strategy, widget progression (the natural ladder), memory writes, branches, inference opportunities, workspace interaction points, recovery. All flows share the orchestration loop (§1.0); they differ only in the Reasoning Frame's `intent_field_rules`, required/optional slots, and recommendation stance. The per-intent DO/DO-NOT rules are the authoritative `_intent_field_rules` text.

### 4.0 Flow anatomy (shared by all)

```
Goal → Detect intent (§1.1) → Load memory → next_slot ladder → infer+recommend → ask ONE (if needed)
     → deliver value each turn → ready → [plan flows: create_plan] / [single-service: present options]
     → post-plan: Floating AI refinements (§8)
```

### 4.1 Full Trip — `full_trip`
- **Goal:** an end-to-end multi-day itinerary.
- **Stance:** the flagship consultant flow. Share destination + seasonal context + budget ballpark immediately on first destination mention.
- **Required:** destination, dates. **Optional:** visit_purpose, travelers, budget, interests, origin, trip_pace.
- **Widget progression:** destination → dates → optional_details → (3+ days) nearby_cities → ready.
- **Inference:** interests from destination keywords; origin from traveler profile; budget from tier×purpose×days×travelers (`_compute_recommended_budget_inr`).
- **Branches:** multi-city (nearby cities → distributed days in generation); short trip (skip nearby); international (adds visa/forex info widgets + advisory).
- **Workspace points:** `create_plan` builds cities/days/blocks; post-plan every insight rule applies.
- **Recovery:** if budget soft-violates destination tier, surface it as an insight, don't block.

### 4.2 Hotel — `hotel_only`
- **Goal:** a stay.
- **Stance:** 100% accommodation; recommend neighborhood by purpose (business→business district, honeymoon→beachfront, family→central+safe). Never ask flights/origin/activities.
- **Required:** destination, dates(check-in/out). **Optional:** visit_purpose, travelers, budget, star_rating, amenities, property_type.
- **Widgets:** destination → dates → optional_details(hotel fields) → present hotel Recommendation/Comparison.
- **Generation:** single-day plan listing hotel options (`_generate_itinerary_with_ai` hotel_only branch).

### 4.3 Flight — `flight_only`
- **Goal:** air travel to a destination.
- **Stance:** origin required; fare-range estimate the moment origin+destination known; name a specific DB flight; morning for business, upgrade pitch for honeymoon. Never ask hotels/activities/trip length.
- **Required:** destination, origin, dates. **Optional:** travelers, flight_class, time_window, non_stop, budget.
- **Widgets:** destination → origin → dates → optional → Comparison(flights) / Recommendation.
- **Live info:** flight_status once a flight is chosen/booked.

### 4.4 Train — `train_only`
- **Stance:** name the specific train (Rajdhani/Shatabdi/Vande Bharat) on the route; journey duration + fare upfront; class by purpose (hometown→Sleeper/3AC, business→2AC/1AC, honeymoon→1AC); surface Tatkal if date ≤4 days. Never ask hotels/flights/seat-preference.
- **Required:** destination, origin, dates. **Optional:** train_class, tatkal, meal_preference, time_window, travelers, budget.
- **Live info:** train_running_status; station_info.

### 4.5 Bus — `bus_only`
- **Stance:** recommend overnight sleeper for >8h routes; duration upfront. Never suggest train/flight alternatives (respect intent).
- **Required:** destination, origin, dates. **Optional:** bus_type, journey_timing, travelers, budget.

### 4.6 Cab / Airport Transfer — `cab_only`
- **Stance:** fare + toll estimate as soon as pickup+drop known; Sedan for 1–3, SUV for 4+. Never ask stay duration.
- **Required:** destination(drop), origin(pickup), date+time. **Optional:** vehicle_type, return_trip, travelers.
- **Widgets:** current_location/origin (pickup) → destination (drop) → time_picker → vehicle Quick Choice.
- **Airport transfer** is a cab_only sub-mode: pickup/drop is an airport; offer flight_status linkage.

### 4.7 Cruise — `cruise_only`
- **Stance:** recommend Balcony for couples; ports of call + duration upfront. Never ask origin/flights-to-port (separate intent).
- **Required:** destination/port, sailing dates. **Optional:** cabin_class, dining_package, travelers, budget.

### 4.8 Car Rental — `car_rental`
- **Stance:** SUV for 4+ or hills; 4WD note for hill stations; self-drive only (redirect driver requests → cab_only).
- **Required:** pickup(origin), destination, dates. **Optional:** car_type, transmission, travelers, budget.

### 4.9 Transit (Mixed) — `transit_only`
- **Stance:** proactively present a route Comparison ("Train 4h ₹800 vs Bus 5h ₹400"). Never ask hotels/attractions.
- **Required:** destination, origin, date. **Optional:** preferred_mode, priority, travelers, budget.
- **Signature widget:** `comparison`.

### 4.10 Activities & Experiences — `activities_only`
- **Stance:** suggest top 2–3 activities immediately; filter by purpose (family→skip nightlife). Never ask flights/hotels/how-they-arrive.
- **Required:** destination, dates. **Optional:** interests, intensity_level, travelers, budget.

### 4.11 Food & Dining — `food_and_dining`
- **Stance:** name-drop a must-try dish immediately; reservations for premium. Never ask hotels/transport.
- **Required:** destination, date. **Optional:** meal_type, cuisine, dietary, ambiance, travelers, budget.
- **Live info:** nearby_restaurants.

### 4.12 Trip archetypes (purpose-shaped variants of full_trip)
These are **not** separate intents; they are `full_trip` + a `visit_purpose` that cascades `PURPOSE_DEFAULTS` and a tone. The flow is 4.1 with defaults/tone from the table:

| Archetype | visit_purpose | Defaults cascade | Tone |
| --- | --- | --- | --- |
| Business Trip | business | premium, 1 traveler, morning, efficiency | efficient, terse |
| Family Trip | family | mid_range, 4 travelers, SUV, child-safe | warm, safety-first |
| Solo Trip | solo | budget, 1, adventure, hostels | encouraging, budget-savvy |
| Honeymoon | honeymoon | premium, 2, romantic, balcony/1AC | romantic |
| Backpacking | solo/budget | budget, adventure | rugged, thrifty |
| Weekend Trip | vacation (2-day) | mid_range, skip nearby cities | brisk |
| Road Trip | vacation + car_rental | SUV, road_condition info | scenic, logistics-aware |
| International Trip | any + intl destination | adds visa/forex/advisory | prep-heavy, honest on requirements |

### 4.13 Prep & information intents (mostly info-widget flows)
Visa, Forex, Insurance, Travel Pass, SIM/eSIM, Passport Guidance, Travel Advisory — these are **advisory flows** that terminate in Family-C info widgets, not a plan. Reasoning: identify the destination + traveler passport/context, surface the honest, provenance-tagged info widget, and (for full_trip) attach it as a prep insight. **Hard rule:** visa/passport/advisory degrade honestly (§2.4). SIM/eSIM and insurance recommend named options only if DB-backed.

### 4.14 Live-status intents
Flight Status, Train Running Status, Weather, Nearby Places, Local Recommendations — single-turn info flows: parse the entity (flight number, train, place), fetch via Knowledge Engine, render the matching info widget, offer a natural follow-up ("want me to add a buffer before this flight?"). No slot-filling.

### 4.15 Emergency Help — `emergency` purpose / `emergency_contacts`
- **Stance:** calm + fast. Fastest transit options only, no upsells, no tourism (`_generate_itinerary_with_ai` emergency tone). Skip optional_details entirely (`_determine_widget` emergency short-circuit). Surface emergency_contacts info widget proactively.
- **Reasoning:** minimize turns to `ready`; infer aggressively; one question only if truly blocking.

---

## 5. Deliverable 5 — Conversation Memory Model

Three tiers, each with a distinct lifetime, owner, and provenance discipline.

### 5.1 The memory tiers

| Tier | Lifetime | Store | Owner | Contents |
| --- | --- | --- | --- | --- |
| **Conversation Memory** | this session | `PlannerChatMessage` rows | Conversation Manager | full message history; last 10 fed to model |
| **Planner Memory** | this workspace | `TripDraftState` (pre-plan) + `PlannerTrip` (post-plan) | Reasoning Engine | slots, intent, blocks, cities, days, open proposals |
| **Context Memory** | this turn (+short TTL) | in-request object + `metadata` cache keys | Orchestrator | live info just fetched, rejected suggestions, pending question, on-screen widget, memory_delta |
| **Traveler Memory** (cross-session) | across all trips | `TravelerProfile` facts | Handoff + profile page | home_origin, typical_party_size, budget_tier, interests, recent_trip_budget |

### 5.2 What the AI always knows (the memory contract)

Every turn, the Reasoning Frame guarantees these are populated (from the tiers above): current intent + confidence, destination, trip status/state, dates, budget (tier+INR), travelers, preferences (all optional slots), past answers (known_slots), rejected suggestions, accepted suggestions, current conversation (history), current planner state (draft/trip snapshot), recently-viewed live info, pending question, resolved questions, live info fetched this turn, and any context changes (memory_delta). This is the literal union of the "already known" builder (`_call_gemini`), `metadata`, and the trip snapshot.

### 5.3 Provenance on every memory cell

Each slot value carries provenance: `user_stated` (typed in chat) > `user_confirmed` (accepted/edited a widget) > `widget_submitted` > `inferred` > `heuristic_default`. Precedence: a higher-provenance value is never overwritten by a lower one (an inference can't stomp a user_confirmed value — the lock from §3.8). The profile page shows inferred facts and lets the user delete them; nothing inferred applies silently without being visible (the mandate from `_record_traveler_facts`).

### 5.4 How memory evolves during a session (worked example)

```
Turn 1  user: "flight to Bareilly next Friday"
        Δ intent=flight_only(conf 90, user_stated)  destination=Bareilly(user_stated)
          start=<next Fri>(inferred from "next Friday")  end=start(rule: transit single-day)
          missing=[origin]   → ask origin (value: fare estimate teased)
Turn 2  widget: origin=Delhi
        Δ origin=Delhi(widget_submitted)   real_options loaded (IndiGo 6E-2401 ₹4,200)
          missing=[]  ready=true  → recommend named flight + optional_details(flight fields)
Turn 3  user: "make it 2 people, business class"
        Δ travelers=2(user_stated)  flight_class=Business(context_update, user_stated, LOCKED)
          confirm in prose; no widget
Turn 4  create_plan
        Δ Trip created; PlannerTripOriginal snapshot; TravelerProfile.home_origin=Delhi(inferred)
          state → PLAN_ACTIVE; Context Memory reset; Floating AI online
Turn 5  (Floating AI) user: "what's the weather there?"
        Δ Context: recently_viewed += weather(Bareilly); no plan mutation
```

### 5.5 Traveler Memory (cross-session)

`TravelerProfile.upsert_fact(key, value, source_trip)` records durable facts at handoff (`_record_traveler_facts`): home_origin, typical_party_size, budget_tier, recent_trip_budget, interests. These seed the Inference Engine on future sessions ("Delhi again? and the usual 2 of you?"). All are `inferred`, user-visible, user-deletable. Never used to silently pre-commit a booking-relevant slot without showing it.

### 5.6 Rejected & accepted suggestions

- **Rejected** (Context Memory, session-scoped): declined nearby cities, dismissed recommendations, rejected proposals (`PlanProposal.STATUS_REJECTED` + `rejection_reason`). Never re-offered this session; a rejection reason feeds the next recommendation ("not that one — too far; here's a closer option").
- **Accepted:** applied proposals, chosen options — folded into Planner Memory as the current state.

### 5.7 Pending vs resolved questions

The orchestrator tracks at most **one** pending question (the one-question invariant). It resolves when the next user message addresses it (answer or correction) or when the user changes direction. An unresolved question is re-surfaced *rephrased* (learned patterns) if the user's message didn't address it, never repeated verbatim.

---

## 6. Deliverable 6 — AI Insights System

### 6.1 Principles

- **Contextual only.** Every insight is computed against *this* trip's real data. Generic travel advice is banned. (This is the `PlanInsightEngine` design: rules evaluate real, already-computed trip data — never a fresh LLM call per rule.)
- **Provenance-honest.** Insights fire only on real DB rows / computed facts, never invented (`LocalHolidayInsight`/`NaturalPhenomenonInsight` only fire on real `HolidayCalendar`/`TravelSeason` rows, and phenomena always carry their variability window).
- **Advisory vs actionable.** An insight with a single mechanically-correct fix sets `action` to a `PlanProposal`-shaped dict (accept flows through the normal proposal path). An insight with no single correct fix leaves `action=None` and renders as a plain informational node — never a fake accept button.
- **Value after every important action.** The trigger cadence (§6.4) fires after material user actions, not on every keystroke.

### 6.2 The rule substrate (existing + roadmap)

Implemented in `PlanInsightEngine.run` (each rule `evaluate(trip)→[insight]`, one rule's bug never breaks the batch):

| Rule | Fires on | Severity | Action? |
| --- | --- | --- | --- |
| `daily_walk_load` | day's inter-stop walking ≥6km | info | advisory |
| `heat_exposure` | outdoor stop 11am–3pm on ≥32°C day | warning | advisory |
| `schedule_gap` | ≥3h gap between stops | info | advisory |
| `checkin_mismatch` | hotel check-in before transit arrival | warning | advisory |
| `late_arrival` | transit lands ≥22:00, next day starts <9:00 | warning | advisory |
| `opening_hours_conflict` | stop scheduled when master `opening_hours` says closed | warning | advisory |
| `overloaded_day` | ≥5 sightseeing stops in a day | warning | advisory |
| `local_holiday` | real public holiday in trip window | info | advisory |
| `natural_phenomenon` | seasonal phenomenon overlaps trip months | info | advisory |

**Roadmap rules** (add when their K5 data lands — crowd telemetry, golden-hour, TravelerProfile injection, events): CrowdPeakWarning, SunriseAdjustedTiming, OnRouteOpportunity, HotelTravelTimeSaving, PreferenceMatch, ReviewRecencyDrop, FreeEntryToday, RouteClosureConflict, HolidayClosureConflict, TimeBudgetTradeoff. Each must state its provenance and degrade honestly.

### 6.3 Insight categories mapped to rules/sources

Price trends & peak season (TravelPriceHistory, TravelSeason) · Crowd levels (K5, roadmap) · Weather & heat (weather normals, `heat_exposure`) · Distance & travel time (`daily_walk_load`, LocationDistanceCache) · Nearby recommendations (`OnRouteOpportunity`, place masters) · Local events/holidays (`local_holiday`, events) · Packing (derived from weather+activities → `packing` widget) · Safety (advisories) · Time-saving (`schedule_gap`, `checkin_mismatch`, `late_arrival`) · Budget optimization (constraints + tier) · Route optimization (`route_optimizer` → proposal) · Alternatives (Recommendation Engine) · Travel tips (enrichment `ai_tip`/`local_tip`).

### 6.4 When to show an insight (the gating rules)

Show iff **all**:

1. A rule fired against real data (not speculative).
2. It is **relevant to the current moment** — after the user did something the insight bears on (created the plan, moved a block, added a day, chose dates). Not a firehose on load.
3. It is **novel** — not already shown-and-dismissed this session (Context Memory rejected set).
4. Its severity clears the surface's threshold: post-plan panel shows info+warning; inline chat `ai_insight` shows only warning+ (info stays in the panel to avoid chattiness).
5. At most **N=3** insights surfaced per turn, ranked by severity then recency; the rest live in the insights panel.

**Actionable insights** additionally require a valid, non-stale diff (`base_trip_updated_at` current) or they downgrade to advisory.

### 6.5 Surfacing channels

- **`insights` SSE event** (post-plan turns) → the Workspace insights panel + inline `ai_insight` widgets for warnings.
- **Proposal** (actionable insights) → `proposals` event → accept/reject in place.
- **Conversational** — the Floating AI weaves a relevant insight into a reply when the user's question invites it ("is day 3 too packed?" → `overloaded_day`).

---

## 7. Deliverable 7 — Workspace Synchronization

### 7.1 The one rule

**The AI never mutates a generated Trip directly.** It proposes; the user disposes. All plan changes flow through `PlanProposal` (diff + rationale + accept/reject). Direct writes are reserved for `create_plan` (handoff) alone. This is the trust boundary that makes an autonomous AI editor safe.

### 7.2 Proposal anatomy

```
PlanProposal {
  kind,            # KIND_PLAN_EDIT | KIND_INSIGHT | KIND_ROUTE | ...
  title,           # human summary ("Move 'Dinner' to 20:00")
  rationale,       # why (shown to user)
  diff: { before:{days:[...]}, after:{days:[...]}, deltas:{...} },
  status,          # OPEN → ACCEPTED | REJECTED | EXPIRED
  created_by,      # "agent" | "user"
  base_trip_updated_at,   # staleness anchor
  rejection_reason,
}
```

### 7.3 When to create / update / replace / remove a block (decision table)

| User/AI situation | Operation | Mechanism |
| --- | --- | --- |
| Add a stop/day/booking | **create** block | proposal `after` adds a block to a day |
| Re-time / rename / re-cost a stop | **update** block | proposal patches one block's field(s) (`propose_retime_from_chat` pattern) |
| Swap a stop for a better option | **replace** block | proposal removes A, inserts B (needs candidate search §7.4) |
| Drop a stop | **remove** block | proposal marks block inactive (`is_active=false`) — soft, reversible |
| Reorder within a day | **reorder** | proposal reorders `activities` array |
| Optimize a day/route | batch update | `route_optimizer.propose_route_optimization` → one proposal |
| Whole-trip re-plan | regenerate | explicit user confirm (Confirmation widget) → new Trip, keep `PlannerTripOriginal` |

**Never rebuild the whole plan for a local edit.** Minimal-diff is mandatory (§7.5).

### 7.4 Chat/edit → proposal (generalizing the prototype)

`propose_retime_from_chat` is the safe prototype: recognized verb + explicit parseable value + exactly one confidently-matching active block → proposal; any ambiguity → nothing. Generalize to the full operation set with the **same safety discipline**:

```
1. Detect operation (move/rename/replace/remove/add/reorder) — model `operation` field or regex.
2. Resolve target block(s) — must resolve to a UNIQUE active block; ambiguity → ask one clarifying question, propose nothing.
3. Resolve the new value:
     - move/rename/recost: explicit value required
     - replace: run candidate search (Recommendation/Knowledge Engine) for a concrete replacement
     - add: build the new block from the request + enrichment
4. Build the minimal diff; attach base_trip_updated_at.
5. File PlanProposal (OPEN). Emit on `proposals` event.
6. NEVER apply automatically. NEVER raise into the chat turn (best-effort, additive).
```

**Wrong-block safety:** a silent wrong-block edit is far worse than not being clever. When resolution is ambiguous, the AI asks ("which museum — the Prince of Wales or the CSMVS?") rather than guessing.

### 7.5 Minimal-diff & staleness

- **Minimal diff:** the proposal touches only the affected block(s)/day; `before`/`after` carry just those days. The accept handler merges `after.days` into the trip by day (`accept_proposal`), leaving everything else untouched.
- **Staleness guard (hard):** at accept time, if `trip.updated_at > proposal.base_trip_updated_at`, the proposal **expires** instead of merging (the exact guard, `views.py:530`). A proposal computed against a plan that has since changed can't silently clobber newer edits. The user re-triggers to get a fresh proposal.

### 7.6 How planner memory stays synchronized

The Trip (`PlannerTrip.days`) is the single source of truth. After any accepted proposal: the trip's `updated_at` bumps (invalidating older proposals), insights re-run live against the new state (rules are pure functions of trip state — no separate event needed, per `OverloadedDayWarning` note), and downstream propagation (overlap bumps, day retitle) files *further* proposals rather than mutating silently (`_maybe_propagate_plan_changes`, `_maybe_propose_day_retitle`). Conversation memory references blocks by id, so it survives edits.

### 7.7 How conversation and workspace stay in sync

Both read the same Trip. The chat references blocks by id and title; when it highlights/explains a block, it sends a focus command (not a mutation) the Workspace consumes. The `commands` field on `PlannerChatMessage` (already present, currently empty) is the channel for non-mutating UI directives: `highlight_block`, `focus_day`, `open_canvas`, `scroll_to`. These are additive to the SSE `done` payload.

---

## 8. Deliverable 8 — Floating AI

### 8.1 What it is

The persistent post-plan assistant. It **is the same orchestrator** (§1.0) running with: (a) a post-plan intent vocabulary, (b) a `trip_snapshot` in the Reasoning Frame, (c) the proposal path as its write channel, (d) the insights substrate for proactive value. It always knows the current plan because it reads the live Trip every turn.

### 8.2 Post-plan intent vocabulary

`modify_block, replace_block, add_block, remove_block, reorder, optimize_route, explain, answer_question, surface_live_info, rebook, compare, summarize`. Detected exactly like pre-plan intents (§1.1) but routed to answer/proposal machinery, never to `draft.intent`.

### 8.3 Capabilities (each mapped to a mechanism)

| Capability | Mechanism |
| --- | --- |
| Answer questions about the trip | read trip_snapshot + Knowledge Engine → prose (no mutation) |
| Modify plans | operation → minimal-diff proposal (§7.4) |
| Replace recommendations | candidate search → replace proposal |
| Add suggestions | add-block proposal or `ai_insight` |
| Explain decisions | AI Explanation Widget (§2 B6) + rationale from memory |
| Optimize routes | `route_optimizer` → proposal |
| Update plans | proposals; staleness-guarded |
| Surface live information | `live_info_requests` → Family-C widgets |
| Continue naturally | full Conversation + Planner + Traveler memory persists across the handoff |

### 8.4 Operation → widget/response map

```
answer_question      → prose (+ optional info widget)      no proposal
explain              → ai_explanation widget                no proposal
surface_live_info    → Family-C widget(s)                   no proposal
compare              → comparison widget                    no proposal (until user picks)
modify/replace/add/
  remove/reorder     → PlanProposal (proposals event)       accept/reject
optimize_route       → route_optimizer proposal             accept/reject
summarize            → conversation_summary/timeline widget  no proposal
rebook               → hand to booking flow (Workspace)      out of AI scope
```

### 8.5 Context preservation across handoff

At `create_plan`, Conversation + Planner + Traveler memory persist; only Context Memory (pending question, on-screen widget) resets. The Floating AI opens already knowing everything the pre-plan chat learned — the user never re-explains. A reference like "make *that* dinner earlier" resolves against block ids the plan already carries.

---

## 9. Deliverable 9 — UX Principles

Every AI conversation must satisfy all of these. They are acceptance criteria, not aspirations.

1. **Calm.** One thing at a time. One question, one primary action per turn. No walls of text, no widget stacks.
2. **Natural.** Consultant voice ("Priya"), never chatbot. No corporate filler. Prose first, widget second.
3. **Minimal.** The cheapest sufficient interaction: infer over ask, chip over form, form over interrogation.
4. **Helpful.** Value after every important answer (§6). A turn that only extracts and asks, without giving, is a failure.
5. **Context-aware.** Never re-ask a known slot; adapt tone to purpose; remember rejections.
6. **Proactive.** State recommendations ("I'd suggest X because Y"), don't pose open-ended questions when you can recommend.
7. **Transparent.** Every recommendation is interrogable (provenance + rationale). Inferred facts are visible and deletable.
8. **Non-repetitive.** One-question cap; rejected set; learned phrasings; no two question-turns without value between.
9. **Explainable.** "Why?" always has an answer (AI Explanation Widget).
10. **Human-like.** Warmth, specificity (named trains/hotels/prices), seasonal/local knowledge.
11. **Trustworthy.** DB-or-nothing on prices; honest degradation on visa/safety/live-info; never fabricate. Proposals, not silent edits.
12. **Efficient.** Fewest turns to value; batch optionals; infer aggressively; emergency short-circuits.
13. **Reversible.** Every plan change is a proposal (rejectable) or soft (inactive, not deleted); `PlannerTripOriginal` always allows revert.
14. **Provenance-honest** *(added).* Nothing inferred or invented is ever presented as fact. This overrides cleverness everywhere.
15. **Respectful of intent** *(added).* flight_only stays about flights. Never expand scope the user didn't ask for.
16. **Graceful under failure** *(added).* Every fallback still completes the turn; the user never sees a raw error or a dead end.

---

## 10. Deliverable 10 — Implementation Blueprint

This section makes the spec buildable without further product decisions. It restates every contract as an implementable interface and orders the work.

### 10.1 Backend module plan (extends existing `apps/planner/services/`)

| Module | State today | Action |
| --- | --- | --- |
| `conversation_engine.py` | slot-filling engine | refactor into an `Orchestrator` that runs the §1.0 loop; keep `ExtractedTripData`, `_calculate_confidence`, `_determine_widget`, `_merge_ai_data`, `_intent_field_rules`, `_build_optional_prefilled` as-is; add `ReasoningFrame` assembly and post-plan branch |
| `conversation_service.py` | transactional shell | add per-turn insight + proposal emission; keep learning writes (`PlannerQuestionBank`, `PlannerIntentFlow`) |
| `recommendation_engine.py` | **dormant** | implement `recommend(...)` (§1.8); wire into ReasoningFrame |
| `constraints.py` | used in generation | expose `evaluate(draft_or_trip)→[violation]` for per-turn use (§1.6) |
| `insight_engine.py` | 9 rules | add surfacing metadata (severity thresholds, novelty key); add roadmap rules as K5 data lands |
| `chat_edit_intents.py` | retime only | generalize to move/replace/remove/add/reorder with unique-block resolution + candidate search (§7.4) |
| `route_optimizer.py` | proposal producer | unchanged; called by `optimize_route` operation |
| `knowledge` (new façade) | scattered reads | thin `KnowledgeEngine` over reference models + enrichment (§1.12) |

### 10.2 The turn contract (implementable signature)

```python
class Orchestrator:
    def run_turn(self, workspace, message, structured_value=None) -> TurnResult: ...

@dataclass
class TurnResult:
    reply: str                      # streamed as tokens
    state: dict                     # intent, intent_confidence, confidence_score,
                                    # missing_slots, ready_for_plan, memory_delta, mode
    widgets: list[dict]             # [{type, data}] — one interaction + ≤2 info
    insights: list[dict]            # post-plan; [{rule, severity, message, related_block_ids, action}]
    proposals: list[dict]           # [{id, kind, title, rationale, diff}]
    commands: list[dict]            # non-mutating UI directives [{cmd, ...}]
    suggested_replies: list[str]
```

`ConversationService.send_message` maps `TurnResult` onto the SSE events (§0.2) and persists a `PlannerChatMessage`.

### 10.3 SSE event schemas (frozen)

```
state:     { intent:str, intent_confidence:int, confidence_score:int,
             missing_slots:[str], ready_for_plan:bool, mode:str, memory_delta:{slot:value} }
token:     { t:str }
widgets:   [ { type:str, data:object } ]
insights:  [ { rule:str, severity:"info"|"warning", message:str,
               related_block_ids:[str], action:object|null } ]
proposals: [ { id:str, kind:str, title:str, rationale:str, diff:object } ]
commands:  [ { cmd:"highlight_block"|"focus_day"|"open_canvas"|"scroll_to", ...args } ]
done:      { message_id:str, workspace_id:str, suggested_replies:[str], mode:str }
error:     { detail:str }
```

`chatStream.ts` gains `onInsights`, `onProposals`, `onCommands` handlers alongside the existing five; all optional (backward compatible).

### 10.4 Widget contract (frozen)

- Registration: `WIDGET_REGISTRY[type] = Component` (existing pattern).
- Props: `{ widget: {type, data}, onSubmit(message, structuredValue) }`.
- Submit shape: `structuredValue = { field, value }`, consumed by `_apply_structured_value` (extend its `field` switch for new submitting widgets).
- Info widgets: no `onSubmit` (read-only); may expose `onFollowUp(query)` to trigger a normal turn.
- Every widget implements the standard loading/empty/error/a11y/transition conventions (§2.1).

### 10.5 Provenance & memory contract (frozen)

- Slot value = `{ value, provenance, source_ref?, locked:bool }`.
- Provenance order (never overwrite higher with lower): `user_stated > user_confirmed > widget_submitted > inferred > heuristic_default`.
- `context_updates` upgrade provenance to `user_confirmed` and set `locked=true`.
- Traveler facts via `TravelerProfile.upsert_fact` at handoff, provenance `inferred`, user-visible & deletable.

### 10.6 Determinism vs adaptivity ledger (what must never be the model's call)

**Deterministic (Python):** intent-change arbitration · `next_slot` · widget selection final say · `confidence_score` · `is_ready_for_plan` · which prices are real · proposal diff construction · staleness guard · insight rule evaluation · one-question enforcement (post-validation) · provenance precedence.
**Adaptive (model):** reply prose · tone-to-purpose · which fact/tip to share · phrasing of the one question · soft nearby-city nudge fit · candidate ranking hints · natural direction-change acknowledgement.

### 10.7 Build order (dependency-ordered)

1. **Refactor** `ConversationEngine` → `Orchestrator` with `ReasoningFrame`; keep all existing behavior green (regression tests: `test_conversation_api`, `test_chat_stream`).
2. **Activate** `RecommendationEngine`; wire into frame; add `recommendation`/`comparison` widgets.
3. **Add** additive SSE events (`insights`, `proposals`, `commands`) + client handlers; keep fallbacks.
4. **Surface insights** post-plan (panel + inline `ai_insight`) using existing `PlanInsightEngine`.
5. **Generalize** `chat_edit_intents` → full operation set with safe resolution; Floating AI operations.
6. **Expand** widget library family by family (A→B→C→D), each behind the registry.
7. **Wire** `ConstraintEngine` per-turn; hard violations override `next_slot`.
8. **Harden** provenance/locking + Traveler Memory inference seeding.
9. **Roadmap insights** as K5 data lands.

### 10.8 Acceptance criteria (per-turn invariants — testable)

A turn is correct iff: exactly ≤1 interaction widget and ≤2 info widgets emitted · ≤1 question in the reply · no known slot re-asked · every stated price traces to a DB row · every recommendation carries provenance · no direct Trip mutation (only proposals) · the turn completes on `done` even if the model failed · `confidence_score` is Python-computed · intent didn't drift to `full_trip` without an explicit trigger · every inferred value is visible to the user.

### 10.9 Non-goals (explicit)

Not redesigning: Workspace, planner blocks, itinerary layout, booking UI, pages, React component structure. Not building: real-time collaboration, a booking engine, payment. Not inventing: prices, visa rules, safety data — DB-or-honest-degradation only.

---

*End of specification. Every architectural decision, widget, reasoning rule, transition, memory update, and interaction above is intended to be implementable directly, with determinism where correctness demands it and adaptivity where it adds warmth.*
