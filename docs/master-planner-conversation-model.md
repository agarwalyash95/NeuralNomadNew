# NeuralNomad — The Master Planner Conversation Model

**The 10-year north star for how the AI talks, thinks, and builds trips**
**Status:** Authoritative for conversation *flow*. Amends §2.2, §3, §4 of `ai-orchestration-architecture.md` (retires the composite optional form; supersedes the slot-ladder with cluster-based progressive composition).
**Date:** 2026-07-15

---

## 0. The problem this fixes

Today the assistant collects preferences by showing **one big form** (`optional_trip_details`) that asks 8 unrelated things at once — budget, class, amenities, interests, pace, time window… It behaves like an intake form, not a planner. That is the single biggest thing standing between NeuralNomad and "best travel planner in the world."

**The correction (your vision, made precise):**

> The AI first **understands intent**, then **gives value** (a recommendation/insight), then **asks — but only the questions that belong together**, as one connected cluster. It may show several widgets *if they serve one decision*. It proactively grows the trip (nearby attractions, a cab, how you're getting there) as **optional** layers. The plan can be created at any moment from what's known and edited forever afterward — all in one continuous conversation.

This document specifies exactly how.

---

## 1. The core law — the Three-Beat Turn

Every AI turn, pre-plan or post-plan, obeys one rhythm:

```
     ┌────────────┐     ┌────────────┐     ┌──────────────────────────┐
     │ 1. UNDERSTAND │ →  │  2. GIVE   │ →  │ 3. ASK (one cluster only) │
     └────────────┘     └────────────┘     └──────────────────────────┘
     reflect intent      deliver value       one connected question set
     + context           BEFORE asking       (may be several widgets,
                                              but all about ONE decision)
```

1. **Understand** — silently or in one line, reflect what the user wants (intent + any context just learned). "Goa for a beach stay — nice choice."
2. **Give** — deliver something valuable *before* asking anything: a named recommendation, a price ballpark, a seasonal fact, a proactive suggestion. **A turn that only extracts and asks, without giving, is a bug.**
3. **Ask** — at most **one decision cluster**. Inside a cluster, multiple connected fields/widgets are allowed and encouraged (they're coherent). Across clusters, never mix.

The law kills the two failure modes at once: it forbids the scattered mega-form (only one *cluster* per turn) **and** the robotic one-question-at-a-time drip (a cluster *can* be several connected things).

---

## 2. Connected Clusters — the unit of asking

A **cluster** is one real-world decision. Questions inside a cluster belong together and render as **one coherent widget group** (a titled card), not scattered fields. Clusters are the replacement for the flat slot list.

### 2.1 The cluster taxonomy

| Cluster | The decision it resolves | Fields (rendered as ONE connected card) |
| --- | --- | --- |
| **Intent** | *What are you trying to do?* | intent (almost always inferred, rarely asked) |
| **Stay** | *Where/how will you sleep?* | style/vibe, dates (check-in/out), budget, area |
| **Journey** | *How do you get there?* | origin, mode, date/time, class |
| **Party** | *Who's going & why?* | travelers, purpose |
| **Getting-around** | *How do you move locally?* | airport transfer, cabs, local transport |
| **Experience** | *What will you do?* | interests, pace, must-dos |
| **Prep** | *What do you need to travel?* | visa, forex, passport, SIM (international only) |

**Rule:** one cluster per turn. A cluster may contain multiple widgets — e.g. the Stay card shows a style-chooser + a date range + a budget slider **together**, because they're one decision ("book me the right stay"). That is the "multiple connected widgets" you asked for. What never happens again: a Stay-budget question next to a flight-class question next to a food-preference question.

### 2.2 The essential vs. optional split (per cluster, per intent)

Every intent has **one primary cluster** whose *essentials* must be resolved before a plan can render, and a set of **optional** clusters the AI offers proactively but never blocks on.

Your hotel example, exactly:

```
Intent: hotel_only
  PRIMARY cluster = Stay
     essentials  → style/kind, dates, budget          (asked, as ONE Stay card)
     optional    → area, star rating, amenities        (offered inside the card, pre-filled, skippable)
  PROACTIVE clusters (offered one at a time, optional, never block):
     Getting-around → "Want me to add an airport→hotel cab?"
     Experience     → "3 top beaches are within 10 min of this area — pin them?"
     Party          → only asked if it changes the recommendation (family vs solo)
     Journey        → offered only if the AI infers they haven't booked travel
```

**The master rule you stated:** *the main questions are always the user's intent.* The primary cluster is derived from intent; everything else is proactive and optional. The AI never leads with an optional cluster.

### 2.3 Intent → cluster priority map (deterministic)

The order in which clusters are offered is fixed per intent (this is the new "ladder," but over clusters, not slots):

| Intent | Primary (essentials) | Then proactive, in order |
| --- | --- | --- |
| `hotel_only` | **Stay** | Getting-around → Experience → Party |
| `flight_only` | **Journey** | Party → (arrival transfer) Getting-around |
| `train_only`/`bus_only` | **Journey** | Party |
| `cab_only` | **Getting-around** (pickup/drop/time) | Party |
| `full_trip` | **Stay + Journey + Party** (the trip spine) | Experience → Getting-around → Prep(intl) |
| `activities_only` | **Experience** | Getting-around → Party |
| `food_and_dining` | **Experience** (dining) | Getting-around |

Determinism note: the *order* is Python-owned (never the model's choice); the *phrasing* and *which value to recommend* are the model's.

---

## 3. The Trip Graph — the substrate that makes this unbeatable

The AI does not fill a flat form. It **grows a graph.** This is the core technical moat: a graph lets the AI reason about **completeness** and **coherence**, which no form-based or linear-chat planner can do.

### 3.1 Nodes and edges

```
Nodes:   Intent · Stay · Journey · Transfer · Place(attraction|food|activity) · Day · Traveler
Edges:   near(Stay↔Place)      connects(Transfer: Airport↔Stay)     on_day(Place→Day)
         precedes(node→node)   belongs_to(node→Intent)              serves(Journey→Trip)
```

Example after a hotel turn:

```
[Intent: hotel_only]
        │
     [Stay: "beachfront, Calangute, Aug 10–14, ₹8k/night"]
        │ near
     [Place: Calangute Beach] [Place: Baga Beach] [Place: Tito's Lane]
        ↑ connects (MISSING — no Transfer node from arrival to Stay)
```

The plan the user sees is just a **rendered view** of this graph. Editing the plan edits the graph; the conversation edits the graph. One source of truth.

### 3.2 Why the graph wins

- **Completeness reasoning:** the AI diffs the graph against a *trip template* (§4) and sees what's missing — "Stay exists, Transfer missing" → proactively offer a cab.
- **Coherence reasoning:** edges carry constraints — a hotel check-in `near` an arrival Transfer must be *after* it (this is exactly what the existing `checkin_mismatch` insight checks, now first-class).
- **Proactive value:** `near` edges let the AI surface attractions/food *around the actual booked stay*, not generic city lists.
- **Local edits, not rebuilds:** changing one node re-renders only its neighborhood (the minimal-diff proposal, §7 of the master spec).

---

## 4. The Proactive Completeness Engine — the "+1" principle

This is what makes the assistant a **master planner** instead of a question bot.

### 4.1 Trip templates (the shape of a complete trip)

Each intent has a canonical template — the node types a *complete, coherent* trip of that kind contains:

```
full_trip template:  Journey(arrival) → Transfer → Stay → Experience(daily) → Getting-around → Journey(departure)
hotel_only template: Stay [+ optional Transfer, + optional nearby Experience]
flight_only template: Journey [+ optional arrival Transfer]
```

### 4.2 The +1 loop

After each turn the engine:

```
1. Diff current graph  vs  intent template  →  ordered list of missing/weak nodes
2. Rank by value × relevance-to-what-just-happened
3. Surface the SINGLE most valuable missing piece as an OPTIONAL suggestion,
   phrased as a connected follow-on to the last thing added.
4. Accept → add node to graph.   Ignore/skip → conversation flows on, never blocked.
```

**"+1" not "+8":** one proactive suggestion at a time, always connected to context. Right after the Stay is set in Calangute → "Want an airport→hotel cab? It's ~₹900 and saves the taxi-rank haggle." Not a wall of five upsells.

### 4.3 Optionality is sacred

Every proactive layer is skippable and **never gates plan creation**. The user can say "just the hotel" and get a plan with one node. The engine keeps the +1 offers gentle and stops pushing a category once declined (rejected-set memory).

---

## 5. Plan-at-any-time & the one continuous thread

### 5.1 No gathering→create gate

The moment a primary cluster's essentials exist, a **live draft plan** materializes in the workspace and **keeps updating** as the conversation continues. There is no "collecting… now generating" wall.

- "Create Plan" is **not a gate** — it's a *bookmark* meaning "this draft is good enough to save/name." The plan already exists as a live graph view before the user taps it.
- Everything the user said becomes plan content immediately; anything not yet said is left as an open, obviously-editable slot ("add dates," "pick a hotel").

### 5.2 One thread, forever editable

Pre-plan chat and post-plan Floating AI are **the same assistant, same graph, same memory.** Creating the plan changes nothing about how you talk to it. "Actually make it 3 nights" works identically before and after. Post-bookmark edits flow through proposals (reversible); pre-bookmark edits update the live draft directly. The user never perceives a mode switch.

### 5.3 Edit-first plans

Every node the AI creates is provisional and labeled as such. The plan is born editable: tap any block to change it, or just tell the chat. Nothing the AI decides is final until the user confirms — the AI's job is to give you a *great starting draft*, instantly, then refine with you.

---

## 6. Worked example — your hotel scenario, turn by turn

```
User: "I need a hotel in Goa"

Turn 1  UNDERSTAND  intent=hotel_only, destination=Goa (confidence high, no confirm)
        GIVE        "Goa in August is green-season — fewer crowds, better rates, the odd
                     shower. For a beach stay I'd point you to Calangute or Candolim."
        ASK (Stay)  → ONE Stay card: [vibe: beachfront/boutique/party/quiet]
                                      [dates: Aug __–__]
                                      [budget: slider, pre-set ~₹8k/night]
        (all three together — one connected decision, not a scattered form)

User: picks "beachfront", Aug 10–14, ₹8k

Turn 2  UNDERSTAND  Stay essentials satisfied → live draft plan renders NOW
        GIVE        "Locked a beachfront stay in Calangute, Aug 10–14. Taj Holiday Village
                     fits at ₹7,800 — pool, 3-min walk to the sand." (DB-backed, named)
        +1 (Getting-around, OPTIONAL)
                    "Want me to add an airport→hotel cab? ~₹900, skips the taxi-rank scrum."
        [Add cab] [No thanks]

User: "no, I'll sort transport"

Turn 3  UNDERSTAND  Getting-around declined → stop offering it
        GIVE        "Done. Also — Calangute Beach, Baga, and Tito's Lane are all within
                     10 minutes of you."
        +1 (Experience, OPTIONAL)
                    "Pin these 3 to your plan so they're on the map?"  [Pin all] [Skip]

User: taps "Pin all"  →  3 Place nodes added, near-edges to the Stay

        Plan now: Stay + 3 nearby Places, on a map, fully editable.
        The user never saw an 8-field form. Every turn gave value first.
        A plan existed from Turn 2. It'll keep growing as long as they talk.
```

---

## 7. Why no planner beats this for 10 years — the moats

1. **Graph-native reasoning.** Completeness/coherence checks (missing transfer, check-in before arrival, attractions *near the booked stay*) are impossible on flat forms or linear chat. Competitors would need to rebuild their core to match — years of work.
2. **Cluster-based progressive composition.** Never overwhelms, always coherent. It is the opposite of the industry-standard "long booking form" and the opposite of dumb one-Q-at-a-time bots. Retrofitting it onto an existing form product is a ground-up rewrite.
3. **Give-before-ask discipline.** Every turn delivers expert value. The assistant *feels* like a top human agent, not an intake screen. This is a product-culture moat, enforced structurally (the Three-Beat law).
4. **Proactive +1 completeness.** The AI anticipates needs (cab, nearby sights, prep) — the master-planner behavior — without ever nagging. Anticipation that's also calm is rare and hard to copy.
5. **One continuous, always-live, always-editable thread.** No plan/edit mode split, no generation gate. The plan is a living document you converse with. Most planners have a hard "form → result" seam; erasing it is architectural.
6. **DB-grounded honesty.** Real prices, real places, honest degradation on visa/safety. Trust compounds into a moat competitors can't fake and won't risk.
7. **Reinforcement learning loop.** Which cluster orders and +1 offers actually convert gets learned per intent+destination (existing `PlannerQuestionBank` / `PlannerIntentFlow`). The product gets sharper with every trip — a compounding data moat.

The combination — not any single item — is what's uncatchable. Each moat is individually hard; together they require a competitor to rebuild conversation, data, and product culture simultaneously.

---

## 8. Build plan (concrete, mapped to the codebase)

Ordered so each phase ships value and nothing regresses. Anchors are real files.

### Phase 1 — Kill the mega-form, introduce clusters *(highest-impact, do first)*
- **Retire** `optional_trip_details` as a single 8-field dump. Replace with **cluster micro-widgets**: `stay_card`, `journey_card`, `party_card`, `getting_around_offer`, `experience_offer`.
- Change `_determine_widget` (conversation_engine.py) from a slot-ladder to a **cluster-ladder** driven by the §2.3 intent→cluster map.
- Enforce the **Three-Beat law** in the response contract: post-validate that every turn's reply gives value before it asks, and emits ≤1 *primary* cluster (proactive `+1` offers are separate, optional widgets).

### Phase 2 — The Trip Graph
- Introduce a graph model behind `TripDraftState`/`PlannerTrip` (nodes/edges as JSON to start; a real table later). The plan view is derived from it.
- Migrate the live draft to render from graph nodes so **plan-at-any-time** works (a Stay node → an instant one-card plan).

### Phase 3 — Proactive Completeness Engine
- Add **trip templates** per intent and a graph-diff that yields the ranked missing pieces.
- Implement the **+1 loop**: one optional, context-connected suggestion per turn, with rejected-set suppression.
- Reuse the existing insight substrate (`PlanInsightEngine`) for the coherence checks (check-in vs arrival, near-edges).

### Phase 4 — One continuous thread
- Remove the hard gathering→generate gate; `create_plan` becomes a *bookmark* over the live draft.
- Unify pre-plan chat and Floating AI (`DockedChat`) onto the same orchestrator + graph so editing is identical before/after (ties into master-spec §8).

### Phase 5 — Proactive nodes as real content
- Wire `+1` accepts to real graph nodes: cab → Transfer node (DB-backed fare), "pin beaches" → Place nodes with `near` edges and map pins.
- Post-bookmark edits flow through `PlanProposal` (reversible); pre-bookmark edits mutate the live draft directly.

### Phase 6 — Learning & polish
- Feed cluster-order and +1-acceptance outcomes into `PlannerQuestionBank`/`PlannerIntentFlow` so the product self-tunes per intent+destination.

---

## 9. What this changes vs. the existing master spec

| Master spec (`ai-orchestration-architecture.md`) | This model |
| --- | --- |
| §2.2 composite `optional_trip_details` form | **Retired.** Replaced by per-cluster micro-widgets (§2 here) |
| §3.1 `next_slot` single-slot ladder | Generalized to a **cluster ladder** (§2.3); a cluster may be several connected widgets |
| §3 one-question cap | Refined to **one-*cluster* cap** — multiple connected widgets allowed within a cluster |
| §1.0 gathering→ready→generate states | Softened: **plan-at-any-time**, "create" is a bookmark (§5) |
| Draft as flat slot bag | **Trip Graph** substrate (§3) |
| Insights as a post-plan panel | Promoted to **proactive +1 completeness** during the whole conversation (§4) |

Everything else in the master spec (provenance-honesty, DB-or-nothing pricing, proposals-as-write-channel, determinism ledger, streaming contract) **still holds** — this model rides on top of it.

---

*The assistant is not a form and not a chatbot. It is a master planner that understands you first, gives before it asks, asks only what belongs together, quietly completes the trip around your intent, and hands you a living plan you can shape forever — in one unbroken conversation.*
