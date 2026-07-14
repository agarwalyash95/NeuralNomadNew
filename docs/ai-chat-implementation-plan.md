# NeuralNomad AI Chat — Final Implementation Plan (for Sonnet execution)

**Purpose:** the single, build-ready plan that consolidates everything designed in the AI-chat workstream into an executable sequence. Sonnet should implement from this document top-to-bottom.
**Consolidates:** `ai-orchestration-architecture.md` (orchestration), `master-planner-conversation-model.md` (intent-first clusters), `conversation-capability-layer.md` (capabilities), and the live gap analysis.
**Date:** 2026-07-15
**Golden rule:** extend the existing stack; do not rewrite it. Every phase must keep the current chat working and pass existing tests (`test_conversation_api`, `test_chat_stream`, `test_lifecycle_api`).

---

## 0. What we are building (the two modes, one conversation)

The planner chat must serve two intertwined modes in **one** thread:

1. **PLAN mode** — the user wants to build/edit a trip. The AI is a *master planner*: understands intent → gives value → asks **one connected cluster** (not a scattered form) → grows an editable plan the user can create at any time.
2. **BROWSE / LIVE mode** — the user just wants to look something up: search hotels/places nearby, check a flight's status, see the weather, open a map, convert currency. The AI invokes **capabilities** inline; no plan is required, nothing is forced into the itinerary.

A single turn can be **both** (e.g. "hotels near Calangute" → recommend + show a search capability + offer to add to plan). The **Turn Router** (§4) decides per turn.

### The non-negotiable behaviors (the user's mandates, distilled)

- **Intent first.** Detect what the user wants before asking anything.
- **Give before ask.** Every turn delivers value (a recommendation/fact/result) before any question.
- **One connected cluster, never a scattered mega-form.** Multiple widgets per turn are fine *only if they serve one decision*. Kill the 8-field `optional_trip_details` dump.
- **Proactive but optional.** The AI suggests nearby attractions, a cab, how you're travelling — one `+1` at a time, always skippable, never blocking.
- **Plan any time, edit forever.** The moment essentials exist, a live editable plan renders. "Create Plan" is a bookmark, not a gate. Same assistant before and after.
- **Capabilities = reusable AI powers.** Search, live status, maps, converters work in any intent, inline, governed by one lifecycle.
- **Honest & grounded.** DB-or-nothing on prices; honest-degrade on live/visa/safety; the AI writes the plan only via proposals (post-plan) or graph nodes (pre-plan) — never silently.

---

## 1. Current state (verified against code)

| Area | Status | Anchor |
| --- | --- | --- |
| Turn pipeline (extract → merge → widget → reply) | ✅ works | `conversation_engine.py ConversationEngine.process` |
| Deterministic confidence + widget ladder | ✅ works | `_calculate_confidence`, `_determine_widget` |
| Intent detection + sticky arbitration | ✅ works | `ExtractedTripData`, `_merge_ai_data` |
| SSE stream `state/token/widgets/done/error` | ✅ works (token = **faked** 4-word chunks) | `views.py _stream_chat_response ~778` |
| 5 input widgets + registry | ✅ works | `chat/widgetRegistry.ts` |
| Proposals (diff/accept/reject/expire, staleness guard) | ✅ built | `PlanProposal`, `views.py ~488` + `ProposalCard.tsx` |
| Insights (9 rules) + REST + panel | ✅ built | `PlanInsightEngine`, `views.py ~646`, `AIInsightsPanel.tsx` |
| Floating AI shell | ✅ exists | `chat/DockedChat.tsx` |
| Chat re-time edit → proposal | ✅ narrow only | `chat_edit_intents.propose_retime_from_chat` |
| Recommendation engine | ✅ wired for **card explainability** only | `recommendation_engine.generate_recommendation`, `views.py:965` |
| **Cluster-based widgets** | ❌ not built (still mega-form) | — |
| **Capabilities (search / live / map / etc. in chat)** | ❌ not built | — |
| **Turn router (plan vs browse)** | ❌ not built | — |
| **Trip Graph / plan-anytime** | ❌ not built | — |
| **Proactive +1 engine** | ❌ not built | — |
| **Per-turn insights/proposals/commands SSE events** | ❌ not emitted on chat stream | — |
| **Real token streaming, intent_confidence, memory_delta** | ❌ not present | — |
| **Provenance/locking on draft slots** | ❌ not present (only on traveler facts/blocks) | — |

**Correction to earlier notes:** the recommendation engine is **not dormant** — it is used for per-card explainability. This plan repurposes it for conversational recommendations too.

---

## 2. Target architecture (one page)

```
                              ┌────────────── ONE TURN ──────────────┐
 user msg / widget submit ─▶  │  Orchestrator.run_turn(workspace,…)  │
                              └───────────────────┬──────────────────┘
                                                  ▼
   ┌────────────────────────────── 1. UNDERSTAND ──────────────────────────────┐
   │ intent detection (+confidence) · load memory · build ReasoningFrame        │
   └───────────────────────────────────┬───────────────────────────────────────┘
                                        ▼
                      ┌──────────── 2. TURN ROUTER (§4) ────────────┐
                      │  classify request → {PLAN, BROWSE, BOTH}    │
                      └───────┬───────────────────────────┬─────────┘
              PLAN branch     ▼                           ▼   BROWSE/LIVE branch
   ┌────────────────────────────────────┐   ┌──────────────────────────────────────┐
   │ cluster ladder → next cluster       │   │ capability selection → invoke 1–2     │
   │ recommend (give) · ask ONE cluster  │   │ (search/live/map/convert…) · degrade   │
   │ grow live plan (graph)              │   │ honestly · offer "add to plan"         │
   └──────────────┬─────────────────────┘   └──────────────────┬───────────────────┘
                  └───────────────┬───────────────────────────┘
                                  ▼
   ┌────────── 3. SYNTHESIZE (LLM) ──────────┐  reply (give-before-ask) + which widgets/caps
   └───────────────────┬─────────────────────┘
                       ▼
   ┌──── 4. VALIDATE + EMIT ────┐  post-validate (≤1 cluster, give-before-ask, no re-ask,
   │ stream events · persist    │  DB-only prices) → SSE: state/token/widgets/(caps)/(insights)/
   └────────────────────────────┘  (proposals)/(commands)/done
```

Only step 3 calls the LLM. Everything else is deterministic (testable). A step-3 failure falls back to a deterministic reply + rule-selected widget (existing behavior).

---

## 3. Contracts to freeze first (Phase 0)

All later phases depend on these. Implement them before feature work so nothing churns.

### 3.1 TurnResult (backend, returned by the orchestrator)

```python
@dataclass
class TurnResult:
    reply: str
    state: dict          # {intent, intent_confidence, confidence_score, missing_slots,
                         #  ready_for_plan, mode, memory_delta}
    widgets: list[dict]  # input clusters: [{type, data}]  (≤1 primary cluster)
    capabilities: list[dict]  # browse/live: [{cap, data}]  (≤2, additive)
    insights: list[dict]      # post-plan advisory: [{rule, severity, message, related_block_ids, action}]
    proposals: list[dict]     # plan edits: [{id, kind, title, rationale, diff}]
    commands: list[dict]      # non-mutating UI: [{cmd, ...}]  (highlight_block/focus_day/pin_to_rail…)
    suggested_replies: list[str]
```

### 3.2 SSE events (additive — do NOT change existing five)

Keep `state / token / widgets / done / error`. **Add** optional events, ignored by old clients:

```
event: capabilities  data: [ {cap, data} ]
event: insights      data: [ {rule, severity, message, related_block_ids, action} ]
event: proposals     data: [ {id, kind, title, rationale, diff} ]
event: commands      data: [ {cmd, ...} ]
```

Extend `state` payload with `intent_confidence`, `mode`, `memory_delta` (additive keys).
Frontend `chatStream.ts`: add optional `onCapabilities / onInsights / onProposals / onCommands`; existing handlers unchanged.

### 3.3 Widget & capability envelope (frontend)

- Input clusters keep the existing contract: `{ widget:{type,data}, onSubmit(message, structuredValue) }`, `structuredValue = {field, value}` consumed by `_apply_structured_value`.
- Capabilities: new registry `CAPABILITY_REGISTRY[cap] = Component`, props `{ capability:{cap,data}, onAction(action) }` where `onAction` handles `add_to_plan / pin / follow_up / refresh`. **No `onSubmit`** (capabilities don't fill slots).
- Add `CapabilityRenderer.tsx` mirroring `WidgetRenderer.tsx`.

### 3.4 Cluster definition (backend, replaces flat optional list)

```python
CLUSTERS = {
  "stay":     ["style", "dates", "budget", "area?", "star_rating?", "amenities?"],
  "journey":  ["origin", "mode", "date_time", "class?"],
  "party":    ["travelers", "purpose?"],
  "around":   ["airport_transfer?", "local_transport?"],
  "experience": ["interests?", "pace?", "must_dos?"],
  "prep":     ["visa?", "forex?", "passport?"],   # international only
}
INTENT_PRIMARY_CLUSTER = { "hotel_only":"stay", "flight_only":"journey", ... , "full_trip":["journey","stay","party"] }
INTENT_PROACTIVE_ORDER = { "hotel_only":["around","experience","party"], ... }  # §2.3 of master-planner model
```

Essentials = non-`?` fields of the primary cluster; the rest are proactive/optional. **Retire** `INTENT_OPTIONAL_FIELDS` as a single mega-form input; keep it only as a reference of which optional fields exist.

### 3.5 Trip Graph (minimal, Phase 4 — define shape now)

```
node = {id, type: intent|stay|journey|transfer|place|day|traveler, data, provenance}
edge = {from, to, rel: near|connects|on_day|precedes|belongs_to}
```
Store as JSON on `TripDraftState.metadata["graph"]` first (no migration); promote to a table later. The rendered plan is a **view** of the graph.

### 3.6 Slot provenance (backend)

Draft slots gain `{value, provenance, locked}`; provenance order `user_stated > user_confirmed > widget_submitted > inferred > heuristic_default`; never overwrite higher with lower; `context_updates` set `locked=true`. Store in `metadata["slot_meta"]`.

---

## 4. The Turn Router (Phase 3 — the heart)

Deterministic classifier that runs after intent detection, before synthesis. Decides the branch(es):

```
classify_turn(message, draft, trip) -> set[{PLAN, BROWSE}]:
  BROWSE if message matches a capability trigger:
     - search verbs / nouns ("find", "nearby", "hotels near", "restaurants", "atm", "map of")
     - live-status nouns ("status", "delay", "weather", "traffic", "aqi", "forex", "convert")
     - explicit "show me / look up / check"
  PLAN if:
     - a required/optional slot is present or missing (still gathering), OR
     - an edit verb on an existing plan ("move/add/replace/remove/optimize"), OR
     - default when no capability trigger and intent needs building
  BOTH when a browse request also advances the plan
     (e.g. "find me a hotel in Goa" → search capability + stay cluster + recommend)
```

Routing outcomes:
- **PLAN only** → cluster ladder + recommend + (maybe) grow plan.
- **BROWSE only** → invoke capabilities; no cluster; offer "add to plan" where sensible; do not nag about missing slots.
- **BOTH** → recommend + one capability + the primary cluster (still ≤1 cluster, ≤2 capabilities).

The router is **model-assisted but deterministic-final**: the LLM may hint (`live_info_requests`, `operation`), but the Python classifier decides and the post-validator enforces the caps.

---

## 5. Phased build plan

Each phase ships independently, keeps existing tests green, and has a hard Definition of Done (DoD).

### Phase 0 — Contracts & scaffolding *(do first, no user-visible change)*
- Add `TurnResult`, additive SSE events, `capabilities` field plumbing (backend emits empty lists).
- Add `CAPABILITY_REGISTRY` + `CapabilityRenderer.tsx`; wire `chatStream.ts` optional handlers.
- Add `metadata["graph"]` and `metadata["slot_meta"]` scaffolding (unused yet).
- **DoD:** stream emits the new (empty) events; old chat behaves identically; all existing tests pass.

### Phase 1 — Cluster widget system (kill the mega-form) *(highest impact)*
- Define `CLUSTERS`, `INTENT_PRIMARY_CLUSTER`, `INTENT_PROACTIVE_ORDER`.
- Rewrite `_determine_widget` → `_determine_cluster`: returns the next **cluster** (a group of connected fields) instead of the flat `optional_trip_details`.
- Build cluster micro-widgets (frontend), each rendering its connected fields as ONE card:
  `stay_card`, `journey_card`, `party_card`, plus proactive `around_offer`, `experience_offer`. Register in `widgetRegistry.ts`.
- Retire `optional_trip_details` as the default (keep the component temporarily behind a flag for rollback).
- Enforce **give-before-ask** + **≤1 cluster** in a post-validator on the reply.
- **DoD:** a hotel request shows a single Stay card (style+dates+budget together), never the 8-field form; flight shows Journey card; a plan can still be created; screenshots verified in preview.

### Phase 2 — Capability layer MVP (browse + live status) *(normal chat)*
Build the **highest-value capabilities only**, behind the registry (defer the long tail):
- **Search & Discovery:** `nearby_search`, `search_hotels`, `search_restaurants`, `search_attractions` (data: master tables → enrichment; `distance_service` for radius).
- **Live Info:** `weather`, `flight_status`, `train_running_status`, `forex` + `exchange_calculator` (honest-degrade where the live source is unwired — return "live unavailable" not fabrication).
- **Navigation:** `interactive_map`, `distance`, `route`.
- **Place Intelligence:** `place_details` (reuse `_enrich_and_cache_activity` + `opening_hours`).
- Each capability: backend producer (`services/capabilities/*.py`) returning the envelope; frontend component (Result-List / Status-Card / Map-Surface / Detail-Panel archetypes from the capability doc §2.2); freshness tier + cache per §2.7.
- `onAction("add_to_plan")` files a graph node (pre-plan) or `PlanProposal` (post-plan).
- **DoD:** "hotels near Calangute", "weather in Goa", "is 6E-2401 on time", "convert €200 to INR", "show me a map" all work inline without requiring a plan; unwired live sources degrade honestly.

### Phase 3 — Turn Router (unify plan + browse)
- Implement `classify_turn` (§4); wire into `Orchestrator.run_turn`.
- Route PLAN / BROWSE / BOTH; enforce caps (≤1 cluster, ≤2 capabilities) in the post-validator.
- Repurpose `recommendation_engine` for conversational recommendations (headline pick feeding the reply), in addition to card explainability.
- **DoD:** "find me a hotel in Goa" yields recommend + search capability + Stay cluster in one turn; "what's the weather" yields only a Weather capability with no cluster nag; browsing never blocks planning and vice-versa.

### Phase 4 — Trip Graph + plan-anytime
- Introduce the graph in `metadata["graph"]`; make the live draft/plan a **view** of graph nodes.
- Remove the hard gather→generate gate: the moment a primary cluster's essentials exist, render a live draft plan; `create_plan` becomes a **bookmark** that promotes the live draft (keep `PlannerTripOriginal` snapshot).
- Unify pre-plan chat and `DockedChat` on the same orchestrator so editing is identical before/after.
- **DoD:** a Stay node renders an instant one-card plan; conversation continues to grow it; "create plan" no longer feels like a wall; post-create edits use the same chat.

### Phase 5 — Proactive +1 engine + inline insights
- Add per-intent **trip templates** and a graph-vs-template diff → ranked missing pieces.
- Implement the **+1 loop**: one optional, context-connected suggestion per turn (cab, nearby beaches, prep), with rejected-set suppression.
- Emit post-plan `insights` on the chat stream (reuse `PlanInsightEngine.run`); surface warnings inline as `ai_insight`, keep info in the existing panel; actionable insights → proposals.
- **DoD:** after a Stay is set, the AI offers exactly one relevant +1 (e.g. airport cab), skippable; day-level insights (overloaded/heat/gap) appear after plan edits.

### Phase 6 — Monitoring (background) + pinning
- Add the pinned rail (`pin_to_rail` command) and `Monitor Flight/Train/Weather/Traffic/Price` as background jobs (reuse the price-watch/standing-task pattern).
- Auto-pin live decision-critical capabilities in-window (flight status on travel day); auto-unpin after.
- Threshold trips → proposal (re-time dependent block) or Status-Card alert; never silent.
- **DoD:** a booked flight auto-arms a monitor; a simulated delay surfaces a "shift your cab?" proposal.

### Phase 7 — Learning, provenance, polish
- Slot provenance + locking (`metadata["slot_meta"]`) so inference never stomps a user-stated value.
- Feed cluster-order and +1-acceptance outcomes into `PlannerQuestionBank` / `PlannerIntentFlow`.
- Real token streaming from the model (replace the 4-word fake chunking in `_stream_chat_response`) — optional, do last.
- **DoD:** correcting "make it 2 people" locks the value; learning tables update on successful plans.

---

## 6. Capabilities to build in the MVP (prioritized)

Build these ~14 first (behind `CAPABILITY_REGISTRY`); everything else in `conversation-capability-layer.md` §3–§10 is deferred to the same pattern:

`nearby_search · search_hotels · search_restaurants · search_attractions · weather · flight_status · train_running_status · forex · exchange_calculator · interactive_map · distance · route · place_details · emergency_contacts`

Each ships with: backend producer, freshness tier, cache, one archetype component, and the `add_to_plan`/`pin`/`follow_up` actions where relevant.

---

## 7. Deterministic vs. model (freeze this split)

**Python owns (never the model):** intent-change arbitration · turn routing (PLAN/BROWSE/BOTH) · next cluster · which capability + caps enforcement · `confidence_score` · `is_ready_for_plan` · which prices are real (DB rows only) · proposal diff + staleness guard · provenance precedence · ≤1-cluster / ≤2-capability enforcement.
**Model owns:** reply prose · tone-to-purpose · which fact/tip/recommendation to voice · phrasing of the one question · capability hints (`live_info_requests`) · edit-operation hints · natural pivots.

---

## 8. Global acceptance criteria (every turn must satisfy)

1. Give-before-ask: the reply delivers value before any question.
2. ≤1 input cluster and ≤2 capabilities emitted per turn.
3. No known slot re-asked; `context_updates` apply silently + lock.
4. Every stated price traces to a DB row; no fabricated fares.
5. Live/visa/safety capabilities degrade honestly when unwired.
6. The AI mutates the plan only via graph nodes (pre-plan) or proposals (post-plan) — never silently.
7. The turn always completes on `done`, even if the LLM failed (deterministic fallback).
8. Browsing works without a plan; planning works without browsing; both compose cleanly.
9. Existing tests stay green; old clients (no new SSE handlers) still work.

## 9. Guardrails — do NOT

- Do **not** reintroduce the multi-field mega-form.
- Do **not** ask two unrelated questions or stack two input clusters in one turn.
- Do **not** invent prices, visa rules, or live status.
- Do **not** write the plan directly from chat (proposals/nodes only).
- Do **not** break the five existing SSE events or the `structuredValue` contract.
- Do **not** redesign the Workspace, planner blocks, itinerary layout, or booking UI.

## 10. Execution notes for Sonnet

- Work **phase by phase**, in order; open a branch per phase; keep each PR-sized.
- After each phase: run the planner test suite and verify the chat in the preview (drive a real hotel + a browse query + a live-status query).
- Prefer editing the named files/functions in §1; add new capability producers under `apps/planner/services/capabilities/` and new frontend components under `chat/capabilities/`.
- When a live data source is unwired, ship the capability with honest degradation now; wire the real API later — the envelope stays the same.
- Reference the three design docs for detail: orchestration contracts, cluster/graph/+1 semantics, and the full capability catalog + matrix.

---

*This plan turns the planner chat into a master planner that builds trips through connected intent clusters and a browse/live console that answers "search / show / monitor / explain" inline — one honest, always-editable conversation.*
