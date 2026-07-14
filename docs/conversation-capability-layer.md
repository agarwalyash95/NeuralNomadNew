# NeuralNomad — Conversation Capability Layer

**An additive extension to the conversation system. Modifies nothing.**
**Status:** New section. Complements `ai-orchestration-architecture.md` and `master-planner-conversation-model.md` without changing either. Where those docs define *how the AI talks and asks*, this doc defines *what the AI can do* inside the conversation.
**Date:** 2026-07-15

---

## Conversation Capability Layer

### 0. Why this layer exists

The existing architecture makes the AI a great **interviewer and planner** — it understands intent, gives value, asks connected clusters, and grows a trip. This layer makes it a great **operator**: an assistant that can *search, monitor, explore, explain, navigate, and visualize* live travel reality inside the same conversation.

**The reframe:** a conversation widget is not only an input control. It is a **reusable AI capability** — a power the AI invokes when reasoning tells it the user would benefit, rendered inline, governed by a uniform lifecycle. Collectively these capabilities turn the chat from a form into an **AI operating system for travel**.

This layer is **strictly additive**:
- It rides the existing `widgets` SSE event as informational payloads (the same channel the master spec's Family-C info widgets already use). No new required protocol.
- Capabilities never collect a required slot, so they are **exempt from the one-cluster rule** — a turn may show a primary cluster *and* one or more capabilities.
- It obeys every existing invariant: DB-or-nothing on prices, honest degradation on live/visa/safety, proposals as the only plan-write channel, provenance on everything.

### 1. Capability vs. input widget

| | Input widget (existing) | Capability (this layer) |
| --- | --- | --- |
| Job | collect an answer | search / show / monitor / explain live reality |
| Drives conversation? | advances the cluster ladder | never; it's additive value |
| Invocation | deterministic ladder | AI reasoning + user request + background triggers |
| Lifetime | one turn (until answered) | governed lifecycle (ephemeral / pinned / background) |
| Writes planner memory? | yes (slots) | usually no; only "recently viewed" / on explicit "add to plan" |
| Count per turn | one cluster | multiple, capped for calm (§2.6) |

### 2. The shared capability model (stated once, applies to all)

To keep this document usable rather than 1,500 repeated line-items, every capability is specified against **one template** and **shared conventions**. Per capability we then state only what differs. This is how a real design system scales — uniform behavior is defined once.

#### 2.1 The capability spec template (the 15 attributes)

`Purpose · When to invoke · Trigger conditions · Required context · Data source · UI layout (Desktop/Tablet/Mobile) · Interaction model · Memory updates · Workspace interaction · Refresh rules · Cache policy · Lifecycle · Transitions · Examples.`

One **reference capability per group** is fully specified against all 15. The rest are given as a dense table of the *differentiating* attributes; the non-differentiating ones (UI layout, interaction, transitions) inherit the group's **shared UI conventions** below.

#### 2.2 Shared UI conventions (per render archetype)

Every capability renders as one of five archetypes. UI layout / interaction / transitions are defined by the archetype, not repeated per capability:

| Archetype | Desktop | Tablet | Mobile | Interaction | Transition |
| --- | --- | --- | --- | --- | --- |
| **Result-List** (searches) | card list (max ~480px) + optional side map | list, map toggles below | full-bleed list, sticky map peek | tap → detail; "add to plan" per row | list staggers in 40ms/row |
| **Status-Card** (live info) | compact card, one headline metric + delta | same | full-width card | tap → expand detail; refresh affordance | crossfade on update (no reflow) |
| **Detail-Panel** (place intel) | rich panel, hero media + sections | panel | full-screen sheet | scroll sections; "add"/"directions" CTAs | slide-up 200ms |
| **Map-Surface** (navigation) | inline map, pins + route line | inline map | full-bleed map, sheet overlay | pan/zoom/pin tap; "start"/"add stop" | fade-in; route draws 300ms |
| **Insight-Note** (AI intelligence) | slim accented card, one message + optional expand | same | same | tap → explanation; accept/dismiss | fade+rise 180ms |

All archetypes obey the master spec's standard loading (skeleton), empty (one-line + recovery), error (inline non-blocking), and a11y (keyboard, roles, live-region, reduced-motion, ≥4.5:1) conventions.

#### 2.3 Invocation model — automatic vs. manual

Every capability declares an **invocation mode**:

- **Automatic** — the AI invokes it proactively when trigger conditions fire (e.g. it shows Weather when dates + destination are set and season matters). Governed by reasoning; never spams (novelty + relevance gates from insights §6 apply).
- **User-triggered** — invoked only on explicit request ("show me the map", "what's the flight status") or a tap on a suggestion chip.
- **Background** — runs without a visible card until it has something worth surfacing (Monitoring group). Surfaces as a Status-Card or a proposal when a threshold trips.

Most capabilities support **both** automatic and user-triggered; the table states the *default* mode.

#### 2.4 Replace vs. beside

- **Beside (default):** a capability appears alongside the reply and any input cluster. Informational; doesn't compete for the answer.
- **Replace:** a capability *updates in place* when the same capability re-fires with new data (same instance id) — e.g. Flight Status refreshing, or a Search re-running with a tighter filter. New instance only when the *kind* changes.
- A capability **never replaces an input cluster** — clusters own the answer channel.

#### 2.5 Lifecycle & pinning

Three lifetimes:

- **Ephemeral** (default): visible for the turn it was shown and the immediate follow-ups; scrolls away with chat history. Re-invocable.
- **Pinned:** the user (or the AI, for high-value live data) pins it to a persistent rail so it stays visible across turns — e.g. a monitored flight's status, the trip map, the currency rate during a booking. Unpinned returns it to ephemeral.
- **Background:** no card until threshold; then surfaces (Monitoring).

**Auto-pin policy:** the AI may auto-pin only *live, decision-critical* capabilities during the relevant window (flight status on travel day; forex during a foreign booking) and must auto-unpin when the window closes.

#### 2.6 Calm cap (per turn)

At most **2 capabilities** surfaced per turn (info/status/map/insight), plus the primary input cluster. Extra results live behind "show more" or in the pinned rail. This preserves the master model's calm principle.

#### 2.7 Cache & refresh tiers

Every capability declares a **freshness tier**:

| Tier | TTL | Refresh | Examples |
| --- | --- | --- | --- |
| **Static** | ∞ (until source changes) | manual | place history, entry fees, sunrise tables |
| **Slow** | hours–days | on view / on stale | opening hours, forex daily, visa rules, reviews |
| **Live** | seconds–minutes | polling while visible/pinned | flight status, train running, traffic, AQI |
| **Derived** | recomputed per plan-version | on trip change | route/distance/time, budget analysis, crowd prediction |

**Honesty rule (hard):** Live-tier capabilities with no wired real-time source **degrade honestly** ("live status isn't available for this train yet — check the operator") rather than fabricate. Static/Slow place data may use the existing cache-on-miss enrichment (write-through to master tables); **prices are DB-or-nothing.**

#### 2.8 Memory & Workspace interaction (default)

- **Planner memory:** capabilities do **not** write slots. They write **Context Memory** only (`recently_viewed`, `rejected`). The exception is an explicit **"add to plan"** action (add a searched hotel/place/cab), which files a `PlanProposal` (post-plan) or a graph node (pre-plan) — never a silent mutation.
- **Workspace:** capabilities may send **non-mutating commands** (`highlight_block`, `focus_day`, `open_canvas`, `scroll_to`, `pin_to_rail`) — the same command channel the master spec §7.7 defines. They mutate the plan only via proposals.

#### 2.9 Reusability across intents

Most capabilities are **cross-intent** (Weather, Map, Currency work for any trip). Some are **intent-scoped** (Platform/Gate Info → train/flight intents). The per-group tables mark reusability; the §11 matrix is authoritative.

---

### 3. Group — Search & Discovery

**Group purpose:** find real places and services, on-map and in-list, and optionally add them to the plan.
**Shared data source:** reference master tables (`HotelMaster/RestaurantMaster/AttractionMaster/ActivityMaster`) first → cache-on-miss enrichment (place-details) → external Places API where wired. **Archetype:** Result-List. **Default freshness:** Slow (place data) with Static entry facts.

#### 3.1 Reference capability — **Nearby Search** (fully specified)

- **Purpose:** surface real places of a type near an anchor point (a stay, a station, "here", a pinned place).
- **When to invoke:** when the user asks ("what's around", "hotels near the station") or when a graph node gains a location and nearby context adds value (a Stay just set → nearby attractions).
- **Trigger conditions:** an anchor with coordinates exists (Stay/Place/Journey node, current location, or a named place) **and** a category is known or requestable.
- **Required context:** anchor lat/lng (or resolvable place), category, radius (default 2km walk / 5km drive), party context (to filter, e.g. family→skip nightlife).
- **Data source:** master tables filtered by city + category + haversine radius (`distance_service`) → enrichment on thin results → Places API where wired.
- **UI layout:** Result-List archetype. *Desktop:* card list + side mini-map with pins. *Tablet:* list with map toggle. *Mobile:* full-bleed list, sticky map peek; tap pin ↔ card sync.
- **Interaction model:** tap card → Place Details (§5); "add to plan" per card → node/proposal; filter chips (category, open-now, price).
- **Memory updates:** Context `recently_viewed += results`; no slot writes. "Add" → graph node (pre-plan) or `PlanProposal` (post-plan).
- **Workspace interaction:** hovering a card can `highlight_block`/pin on the plan map; "add" reflects into the itinerary.
- **Refresh rules:** re-run on anchor change, radius/category change, or "search this area" after pan. Not auto-polled.
- **Cache policy:** Slow — results cached per (anchor, category, radius); enrichment writes through to masters.
- **Lifecycle:** Ephemeral; pinnable ("keep these beaches handy").
- **Transitions:** results stagger in; map pins drop 40ms staggered; "add" animates a fly-to-plan.
- **Examples:** "food near my hotel"; auto after a Stay is set → "3 top beaches within 10 min — pin them?"

#### 3.2 The rest of Search & Discovery

*(Inherit Result-List archetype + Slow freshness. Columns: Invoke = default mode; R/B = replace-or-beside; Life = lifecycle; Mem = writes memory?; WS = workspace effect; X-Intent = reusable across intents.)*

| Capability | Purpose | Trigger | Data source | Invoke | R/B | Life | Auto-upd | Mem | WS | X-Intent |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Destination Search | pick a city/place | destination unknown (input-adjacent) | City ref | user | beside | ephem | no | slot (dest) | — | all |
| Search Hotels | find stays | stay intent / "hotels in X" | HotelMaster→API | both | beside | ephem·pin | no | ctx; add→node | map pins | all (opt) |
| Search Restaurants | find dining | food intent / "where to eat" | RestaurantMaster | both | beside | ephem | no | ctx; add→node | pins | all |
| Search Attractions | find sights | explore / gaps in plan | AttractionMaster | both | beside | ephem·pin | no | ctx; add→node | pins | all |
| Search Activities | find things to do | activities intent | ActivityMaster | both | beside | ephem | no | ctx; add→node | pins | all |
| Search Cafes | find cafes | "coffee near…" | RestaurantMaster (cafe) | user | beside | ephem | no | ctx | pins | all |
| Search Shopping | find markets/malls | "shopping", souvenir | AttractionMaster (retail) | user | beside | ephem | no | ctx | pins | all |
| Search Airports | find/resolve airports | flight intent, transfers | ref (airports) | auto | beside | ephem | no | ctx | — | flight, trip, cab |
| Search Railway Stations | resolve stations | train intent | ref (stations) | auto | beside | ephem | no | ctx | — | train, trip |
| Search Bus Stations | resolve terminals | bus intent | ref (bus) | auto | beside | ephem | no | ctx | — | bus, trip |
| Search Hospitals | nearest care | emergency, safety, family | Places API/ref | user·auto(emergency) | beside | ephem·pin | no | ctx | pins | all |
| Search Pharmacies | nearest meds | health need | Places API | user | beside | ephem | no | ctx | pins | all |
| Search ATMs | cash points | "need cash", arrival | Places API | user | beside | ephem | no | ctx | pins | all |
| Search Fuel Stations | petrol/diesel | road trip, car rental | Places API | user·auto(road) | beside | ephem | no | ctx | pins | car, cab, trip |
| Search Parking | parking near X | car rental, driving | Places API | user·auto(car) | beside | ephem | no | ctx | pins | car, cab |
| Search EV Charging | chargers on route | EV road trip | Places API | user | beside | ephem·pin | no | ctx | route pins | car, trip |
| Search Public Transport | metro/bus options | urban movement | ref/transit | user·auto(urban) | beside | ephem | no | ctx | — | all |
| Search Everything Nearby | mixed POIs around a point | "what's around here" | all masters + API | user | beside | ephem·pin | no | ctx | pins | all |

---

### 4. Group — Live Travel Information

**Group purpose:** answer "what's happening *right now*" for a journey or destination.
**Shared data source:** external live APIs where wired (flight/train status, traffic, AQI, weather, forex); `live_status.py` service; ref data for terminals/platforms. **Archetype:** Status-Card. **Default freshness:** Live (poll while visible/pinned) — **honest-degrade when unwired.**

#### 4.1 Reference capability — **Flight Status** (fully specified)

- **Purpose:** live status of a specific flight (on-time/delayed/gate/terminal/ETA).
- **When to invoke:** user names a flight; a booked/added flight's travel day approaches; a Monitor Flight background job trips.
- **Trigger conditions:** a resolvable flight identifier (number + date) exists in the message or the plan.
- **Required context:** flight number, date; optionally origin/dest airport.
- **Data source:** external flight-status API where wired; else honest-degrade to schedule from `TravelPriceHistory`/ref + "live status unavailable."
- **UI layout:** Status-Card. Headline = status + delta (e.g. "Delayed 25m"); secondary = gate/terminal/ETA; timeline bar. Same across breakpoints (full-width mobile).
- **Interaction model:** tap → expand (full timeline, airport info link); pin; "add buffer" → proposal to shift dependent blocks.
- **Memory updates:** Context `recently_viewed`; no slots. Delay may drive an insight ("your cab is now too early").
- **Workspace interaction:** on travel day, auto-pin; a confirmed delay can file a proposal to re-time the arrival transfer (via §7.4 edit path).
- **Refresh rules:** poll every 60–120s while visible/pinned; stop when unpinned or flight lands.
- **Cache policy:** Live; short TTL; last-known shown with a "as of HH:MM" stamp.
- **Lifecycle:** Ephemeral off-day; auto-pinned on travel day; auto-unpin after landing.
- **Transitions:** crossfade on each poll (no layout jump); status color animates.
- **Examples:** "is 6E-2401 on time?"; auto-pin morning of departure.

#### 4.2 The rest of Live Travel Information

*(Status-Card archetype; Live freshness unless noted; honest-degrade mandatory.)*

| Capability | Purpose | Trigger | Data source | Invoke | R/B | Life | Auto-upd | Mem | WS | X-Intent |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Train Running Status | live train position/delay | train named / travel day | rail API* | both·bg | replace | ephem·auto-pin | yes (live) | ctx | re-time proposal | train, trip |
| Metro Status | line status | urban transit | transit API* | user | replace | ephem | yes | ctx | — | all |
| Bus Status | operator/route status | bus route | operator API* | both | replace | ephem | yes | ctx | — | bus, trip |
| Airport Delays | airport-wide delays | airport in plan | status API* | auto·bg | replace | ephem·pin | yes | ctx | insight | flight, trip |
| Platform Information | platform # | station arrival day | rail API* | auto | replace | ephem·pin | yes | ctx | — | train |
| Gate Information | gate # | flight day | flight API* | auto | replace | ephem·pin | yes | ctx | — | flight |
| Terminal Information | terminal | flight day | ref/API | auto | beside | ephem | no | ctx | — | flight, cab |
| Traffic | live congestion on a leg | cab/road timing | maps traffic* | both·bg | replace | ephem·pin | yes | ctx | re-time insight | cab, car, trip |
| Road Closures | closures/passes | road/hill route | advisories* | auto·bg | beside | ephem·pin | yes | ctx | reroute proposal | car, cab, trip |
| Weather | current + window conditions | dest+dates set | weather API/`TravelSeason` | auto | replace | ephem·pin | yes | ctx | packing/heat insight | all |
| Air Quality | AQI + advisory | health-relevant dest | AQI API* | auto | replace | ephem | yes | ctx | insight | all |
| Rain Alerts | imminent rain | outdoor block soon | weather API* | auto·bg | beside | ephem·pin | yes | ctx | re-time insight | trip, activities |
| Local Time | dest clock + offset | cross-tz planning | tz db | user | beside | ephem·pin | yes (clock) | ctx | — | all |
| Sunrise/Sunset | golden-hour times | photo/outdoor timing | astro calc | auto | beside | ephem | no (static/day) | ctx | timing insight | trip, activities |
| Emergency Alerts | official emergencies | flagged region | gov feeds* | bg·auto | replace | pin | yes | ctx | safety insight | all |
| Travel Advisories | country advisory | international | advisories* | auto | beside | ephem | slow | ctx | prep insight | intl trip, visa |
| Visa Updates | rule changes | visa in prep / monitored | ref/gov* | bg·user | beside | ephem·pin | slow | ctx | prep insight | visa, intl |
| Forex Rates | current rate | foreign budget/booking | forex API | auto | replace | ephem·pin | slow(daily) | ctx | budget insight | intl, forex, trip |
| Exchange Calculator | convert amounts | "how much is X" | forex + math | user | beside | ephem·pin | on rate | ctx | — | intl, forex |

\* external live source; where unwired → honest-degrade to schedule/ref + "live unavailable."

---

### 5. Group — Place Intelligence

**Group purpose:** everything worth knowing about *one* place before you go.
**Shared data source:** master tables + cache-on-miss enrichment (the existing `_enrich_and_cache_activity` path: rating, coords, `ai_tip`, `local_tip`, logistics, photos) + `opening_hours`. **Archetype:** Detail-Panel. **Default freshness:** Slow (hours/reviews) + Static (history/fees) + Derived (visit time).

#### 5.1 Reference capability — **Place Details** (fully specified)

- **Purpose:** the canonical panel for a single place — media, rating, hours, fees, tips, nearby, "add to plan."
- **When to invoke:** user taps a search result / plan block / map pin, or asks about a named place.
- **Trigger conditions:** a resolvable place (master row or enrichable name + city).
- **Required context:** place id or (name + city).
- **Data source:** master row → enrichment on miss (write-through) → opening-hours resolver.
- **UI layout:** Detail-Panel. *Desktop/Tablet:* hero media + sectioned panel (overview, hours, fees, tips, nearby). *Mobile:* full-screen sheet, sticky "add"/"directions".
- **Interaction model:** scroll sections; "add to plan"; "directions" → Navigation; "nearby" → Search; photo gallery.
- **Memory updates:** Context `recently_viewed`; "add" → node/proposal.
- **Workspace interaction:** "add" inserts a Place block; "directions" opens Map-Surface; can `highlight_block` if already in plan.
- **Refresh rules:** hours/reviews on view if stale; static facts cached.
- **Cache policy:** Slow+Static; enrichment write-through; **photos must not leak the Maps key** (known debt — serve via proxy/stored URL).
- **Lifecycle:** Ephemeral; pinnable while comparing.
- **Transitions:** slide-up; sections lazy-load with skeletons.
- **Examples:** tap "Victoria Memorial" → full panel with hours + fee + AI summary + nearby.

#### 5.2 The rest of Place Intelligence

*(Detail-Panel sections or slim cards; inherit place data source.)*

| Capability | Purpose | Trigger | Data source | Invoke | R/B | Life | Auto-upd | Mem | WS | X-Intent |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Opening Hours | when it's open | place shown / scheduling | `opening_hours` | auto | beside(section) | ephem | slow | ctx | conflict insight | all |
| Best Time To Visit | ideal season/hour | destination/place intel | `TravelSeason`/tips | auto | beside | ephem | static | ctx | timing insight | trip, attraction |
| Crowd Prediction | busy-ness forecast | scheduling a visit | telemetry(K5)*/heuristic | auto | beside | ephem | derived | ctx | crowd insight | trip, attraction |
| Reviews | rating + snippets | evaluating a place | masters/API | user | beside(section) | ephem | slow | ctx | — | all |
| Photos | visual proof | place/destination shown | enrichment/API | auto | beside(section) | ephem | static | ctx | — | all |
| Videos | short clips | inspiration | API* | user | beside | ephem | static | ctx | — | trip, explore |
| Nearby Attractions | sights around | place intel / gaps | AttractionMaster | auto | beside | ephem | slow | ctx; add→node | pins | all |
| Nearby Restaurants | food around | place intel | RestaurantMaster | auto | beside | ephem | slow | ctx; add→node | pins | all |
| Nearby Hotels | stays around | "stay near X" | HotelMaster | user | beside | ephem | slow | ctx; add→node | pins | all |
| Nearby Shopping | retail around | place intel | AttractionMaster | user | beside | ephem | slow | ctx | pins | all |
| Nearby Parking | parking around | driving to place | Places API | auto(car) | beside | ephem | slow | ctx | pins | car, cab |
| Accessibility | wheelchair/step-free | accessibility need | ref/enrich | auto(a11y) | beside | ephem | static | ctx | — | all |
| Entry Fees | cost to enter | budgeting a visit | ref/enrich | auto | beside | ephem | static | ctx | budget line | trip, attraction |
| Tickets | booking link/availability | ready to book | provider* | user | beside | ephem | live | ctx | booking handoff | attraction, activities |
| Estimated Visit Time | how long to allow | scheduling | ref/heuristic | auto | beside | ephem | derived | ctx | pacing insight | trip, attraction |
| AI Summary | one-paragraph brief | place shown | enrichment (`ai_tip`) | auto | beside | ephem | static | ctx | — | all |
| Historical Information | context/story | culture interest | enrichment | user | beside | ephem | static | ctx | — | trip, attraction |
| Local Tips | insider know-how | place/area shown | enrichment (`local_tip`) | auto | beside | ephem | static | ctx | — | all |

---

### 6. Group — Navigation

**Group purpose:** show where things are and how to move between them.
**Shared data source:** maps/routing API; `distance_service`/`LocationDistanceCache`; graph node coords. **Archetype:** Map-Surface. **Default freshness:** Derived (recompute on plan change) + Live (traffic overlay).

#### 6.1 Reference capability — **Interactive Map** (fully specified)

- **Purpose:** the spatial view of the conversation/plan — pins, routes, clusters.
- **When to invoke:** any geo answer, nearby results, "show me on a map", or to visualize a day's route.
- **Trigger conditions:** ≥1 place/route with coordinates in context.
- **Required context:** coordinates of the points/route to display; optional day filter.
- **Data source:** node coords + routing API; distance cache for legs.
- **UI layout:** Map-Surface. *Desktop:* inline map with side legend. *Tablet:* inline map. *Mobile:* full-bleed with a bottom sheet of stops.
- **Interaction model:** pan/zoom; tap pin → Place Details; "add stop"; day toggle; "directions" → Route.
- **Memory updates:** Context only; selecting a pin can `focus_day`/`highlight_block`.
- **Workspace interaction:** shares the plan's map state; adding a stop files a node/proposal.
- **Refresh rules:** re-render on plan change; traffic overlay polls if enabled.
- **Cache policy:** Derived; tiles cached; legs from `LocationDistanceCache`.
- **Lifecycle:** Ephemeral inline; **pinnable as the trip map** (a common auto-pin during planning).
- **Transitions:** fade-in; pins drop; route draws 300ms.
- **Examples:** "map of day 2"; auto after pinning nearby beaches.

#### 6.2 The rest of Navigation

| Capability | Purpose | Trigger | Data source | Invoke | R/B | Life | Auto-upd | Mem | WS | X-Intent |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Route | line + turn steps A→B | "how to get from…" | routing API | user | replace | ephem | derived | ctx | add-transfer proposal | all |
| Distance | km/mi between points | quick "how far" | `distance_service`/cache | auto | beside | ephem | derived | ctx | — | all |
| Travel Time | duration incl. traffic | scheduling legs | routing+traffic | auto | beside | ephem | live | ctx | pacing insight | all |
| Walking Route | on-foot path | short legs, walk-load | routing(walk) | auto | replace | ephem | derived | ctx | walk-load insight | trip, hotel |
| Driving Route | car path | car/cab legs | routing(drive) | user | replace | ephem | live | ctx | — | car, cab, trip |
| Public Transport Route | transit path | urban movement | transit routing* | user | replace | ephem | live | ctx | — | all |
| Multi-stop Route | ordered day route | a day with ≥3 stops | routing+optimizer | auto | replace | ephem·pin | derived | ctx | route-optimize proposal | trip |
| Nearby Map | pins around a point | nearby search results | maps + masters | auto | beside | ephem | slow | ctx | pins | all |
| Map Preview | tiny static map thumb | place/leg reference | static tiles | auto | beside(inline) | ephem | static | ctx | tap→Interactive Map | all |
| Street View | ground-level look | "what does it look like" | street imagery API* | user | replace | ephem | static | ctx | — | trip, hotel, attraction |

---

### 7. Group — Exploration

**Group purpose:** open-ended inspiration — help the user *discover* what they didn't know to ask for.
**Shared data source:** curated masters + `TravelSeason`/`HolidayCalendar` + enrichment; ranked by relevance to intent/party/season. **Archetype:** Result-List (rich, editorial). **Default freshness:** Slow/Static.

#### 7.1 Reference capability — **Destination Explorer** (fully specified)

- **Purpose:** an editorial overview of a destination — themes, top experiences, areas, seasonal notes — as a launchpad.
- **When to invoke:** early ("tell me about Goa"), undecided users, or to enrich a chosen destination.
- **Trigger conditions:** a destination known or being considered.
- **Required context:** destination; optional party/purpose/season for filtering.
- **Data source:** masters + season + enrichment; grouped into themes.
- **UI layout:** Result-List (editorial cards by theme). Responsive per archetype.
- **Interaction model:** tap theme → filtered Search/Explorer; "add" experiences; "plan a trip here" → seeds intent.
- **Memory updates:** Context; picking a theme can set interest inferences (visible, correctable).
- **Workspace interaction:** "add" seeds graph nodes; "plan here" sets destination.
- **Refresh rules:** static; seasonal section recomputes by travel month.
- **Cache policy:** Slow; enrichment write-through.
- **Lifecycle:** Ephemeral; pinnable as an inspiration board.
- **Transitions:** editorial cards fade in; theme filter animates.
- **Examples:** "what's Goa like in August" → themes: beaches, green-season deals, nightlife, food.

#### 7.2 The rest of Exploration

| Capability | Purpose | Trigger | Data source | Invoke | R/B | Life | Auto-upd | Mem | WS | X-Intent |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Area Explorer | neighborhoods of a city | "where to stay/base" | masters/enrich | user | beside | ephem | slow | ctx·infer(area) | pins | trip, hotel |
| Food Explorer | cuisines/dishes/spots | food interest | RestaurantMaster+tips | user·auto(food) | beside | ephem | slow | ctx; add→node | pins | food, trip |
| Activity Explorer | experiences to do | activities interest | ActivityMaster | user·auto | beside | ephem | slow | ctx; add→node | pins | activities, trip |
| Festival Explorer | events/festivals in window | date overlap | `HolidayCalendar`/events | auto | beside | ephem | slow | ctx | surprise insight | trip, activities |
| Nightlife Explorer | bars/clubs | nightlife interest (non-family) | masters/enrich | user | beside | ephem | slow | ctx | pins | trip, activities |
| Nature Explorer | parks/treks/scenery | nature interest | AttractionMaster | user·auto | beside | ephem | slow | ctx | pins | trip, activities |
| Hidden Gems | off-beat spots | "avoid tourist traps" | enrichment/tips | user | beside | ephem·pin | slow | ctx | pins | trip, explore |
| Trending Places | popular now | "what's hot" | telemetry*/curation | user | beside | ephem | slow | ctx | pins | trip, explore |
| Seasonal Recommendations | best-for-this-month | season-aware planning | `TravelSeason` | auto | beside | ephem | static | ctx | timing insight | trip |
| Weekend Ideas | short-trip options | "quick getaway" | curation+distance | user | beside | ephem | slow | ctx·infer | — | trip |
| Family Ideas | family-friendly picks | family purpose | masters(family) | auto(family) | beside | ephem | slow | ctx; add→node | pins | trip, activities |
| Kids Activities | for children | kids in party | masters(kids) | auto(kids) | beside | ephem | slow | ctx; add→node | pins | trip, activities |
| Adventure Ideas | thrill activities | adventure interest | ActivityMaster | user·auto | beside | ephem | slow | ctx; add→node | pins | activities, trip |

---

### 8. Group — AI Intelligence

**Group purpose:** turn data into judgment — the AI's *opinion*, always with reasoning and provenance.
**Shared data source:** the reasoning frame + constraints + insight engine + recommendation engine over real trip/graph data (never a bare LLM guess). **Archetype:** Insight-Note (expandable). **Default freshness:** Derived (recompute per plan-version).

#### 8.1 Reference capability — **AI Recommendation** (fully specified)

- **Purpose:** state the AI's single best pick for a decision, with a named option, price, and *why*.
- **When to invoke:** whenever the user faces a choice the AI can resolve (which flight/hotel/train/area) — proactively, per the give-before-ask law.
- **Trigger conditions:** a decision context + candidate options (DB-backed) exist.
- **Required context:** the decision (slot/cluster), candidates, party/purpose/budget.
- **Data source:** Recommendation Engine over `TravelPriceHistory`/masters (DB-backed) → heuristic defaults (`PURPOSE_DEFAULTS`) with provenance.
- **UI layout:** Insight-Note → expands to a rich card (option + rationale + provenance chip + one action). Responsive per archetype.
- **Interaction model:** "accept" → add/select (node/proposal); "see alternatives" → AI Comparison; "why?" → AI Explanation.
- **Memory updates:** Context (accepted/rejected); accept → node/proposal.
- **Workspace interaction:** accept reflects into the plan via proposal (post-plan) or node (pre-plan).
- **Refresh rules:** recompute if inputs change (budget/party/dates).
- **Cache policy:** Derived; tied to plan-version.
- **Lifecycle:** Ephemeral; the accepted pick persists as plan content.
- **Transitions:** fade+rise; expand animates; provenance chip always visible.
- **Examples:** "For 2 in Calangute I'd book Taj Holiday Village at ₹7,800 — pool, 3-min to sand." [Accept] [Alternatives] [Why?]

#### 8.2 The rest of AI Intelligence

*(Insight-Note archetype; Derived freshness; every item carries provenance + is interrogable.)*

| Capability | Purpose | Trigger | Data source | Invoke | R/B | Life | Auto-upd | Mem | WS | X-Intent |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AI Insight | contextual advisory | insight rule fires post-action | `PlanInsightEngine` | auto | beside | ephem·pin | derived | ctx | actionable→proposal | all |
| AI Explanation | "why this?" | user asks / non-obvious pick | reasoning frame | user | beside | ephem | derived | — | — | all |
| AI Comparison | side-by-side options | ≥2 comparable candidates | rec engine | both | beside | ephem | derived | ctx; pick→node | — | all |
| AI Alternatives | other viable picks | "what else" / rejected pick | rec engine | user | beside | ephem | derived | ctx | pick→proposal | all |
| Pros & Cons | balanced trade-off | evaluating one option | reasoning | user | beside | ephem | derived | — | — | all |
| Budget Analysis | cost breakdown vs budget | plan/booking cost known | constraints+prices | auto | beside | ephem·pin | derived | ctx | over-budget insight | all |
| Time Analysis | day pacing/timing | scheduled day | insight engine | auto | beside | ephem | derived | ctx | pacing insight | trip |
| Risk Analysis | what could go wrong | tight connections/weather | constraints | auto | beside | ephem | derived | ctx | risk insight | trip, flight, transit |
| Weather Impact | weather × plan | forecast × outdoor blocks | weather+insight | auto | beside | ephem | live | ctx | re-time insight | trip, activities |
| Travel Tips | contextual how-tos | destination/leg context | enrichment | auto | beside | ephem | static | — | — | all |
| Packing Tips | what to bring | weather+activities known | derived | auto | beside | ephem·pin | derived | ctx | packing checklist | all |
| Safety Tips | stay-safe guidance | flagged region/solo/night | advisories/tips | auto | beside | ephem | slow | ctx | — | all |
| Optimization Suggestions | make the plan better | slack/route/budget slack | optimizer+insight | auto | beside | ephem | derived | ctx | optimize proposal | trip |

---

### 9. Group — Monitoring

**Group purpose:** watch something over time and alert when it changes — the assistant working *while the user isn't looking*.
**Shared data source:** the corresponding Live capability's source, polled by a background job (the existing price-watch / standing-task pattern). **Archetype:** Background → surfaces as Status-Card or proposal. **Default freshness:** Live/Slow via scheduled polling.

#### 9.1 Reference capability — **Monitor Flight** (fully specified)

- **Purpose:** track a flight from booking to boarding; alert on delay/gate/cancellation.
- **When to invoke:** user asks to watch it, or the AI auto-arms it once a flight is added/booked.
- **Trigger conditions:** a flight node with number+date exists.
- **Required context:** flight id, date, dependent blocks (transfer) for impact analysis.
- **Data source:** flight-status API (background poll); honest-degrade if unwired.
- **UI layout:** invisible while nominal; surfaces a Status-Card (pinned) or an Insight-Note/proposal on change.
- **Interaction model:** arm/disarm; on alert → "adjust plan" (proposal) / dismiss.
- **Memory updates:** a standing monitor record; Context on surface.
- **Workspace interaction:** a tripped threshold files a proposal (e.g. re-time the arrival cab); never silent.
- **Refresh rules:** poll on a schedule that tightens near departure; stop after landing.
- **Cache policy:** Live; last-known + timestamp.
- **Lifecycle:** Background from arm → auto-pin on travel day → auto-retire post-flight.
- **Transitions:** silent → slide-in alert on change.
- **Examples:** auto-armed when a flight is booked; pings "Delayed 40m — shift your cab?" [Adjust] [Ignore].

#### 9.2 The rest of Monitoring

*(Background archetype; each is the "watch" form of a Live capability; alerts surface as Status-Card or proposal — never silent, never spammy.)*

| Capability | Purpose | Trigger | Data source | Invoke | R/B | Life | Auto-upd | Mem | WS | X-Intent |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Monitor Train | watch train status | train added/booked | rail API* | auto·user | surface→pin | bg→pin | yes | monitor rec | re-time proposal | train, trip |
| Monitor Weather | watch forecast shifts | outdoor plan + dates | weather API | auto | surface | bg | yes | ctx | re-time/packing insight | trip, activities |
| Monitor Traffic | watch a leg's congestion | timed cab/drive leg | traffic API* | auto·user | surface·pin | bg | yes | ctx | leave-earlier insight | cab, car, trip |
| Monitor Forex | watch rate for a threshold | foreign budget/booking | forex API | user | surface | bg | slow | monitor rec | budget insight | intl, forex |
| Monitor Visa Changes | watch rule changes | visa prep pending | ref/gov* | user | surface | bg | slow | ctx | prep insight | visa, intl |
| Monitor Local Events | watch new events in window | dates+dest set | events/`HolidayCalendar` | auto | surface | bg | slow | ctx | surprise insight | trip, activities |
| Monitor Delays | any transit delay in plan | plan has timed transit | multi API* | auto·bg | surface·pin | bg | yes | ctx | re-time proposal | trip, flight, train, bus |
| Monitor Route Changes | closures/reroutes on a route | road route in plan | advisories* | auto | surface | bg | yes | ctx | reroute proposal | car, cab, trip |
| Monitor Price (context) | fare/room price drop | option shortlisted | `TravelPriceHistory`/watch | user | surface | bg | slow | price-watch rec | book-now proposal | flight, hotel, train, bus |

\* honest-degrade when the live source is unwired; the monitor stays armed and explains it can't yet see live data.

---

### 10. Group — Planning Helpers

**Group purpose:** meta-capabilities that operate on the *plan and the session itself* rather than the outside world.
**Shared data source:** the graph/plan, chat history, `TravelerProfile`, saved items. **Archetype:** mixed (Timeline/List/Note). **Default freshness:** Derived (plan) / Static (saved).

#### 10.1 Reference capability — **Trip Progress** (fully specified)

- **Purpose:** show how complete/coherent the plan is — the confidence ring + what's missing + coherence flags.
- **When to invoke:** user asks "what's left", after major additions, or as a gentle nudge toward completeness.
- **Trigger conditions:** a draft/plan exists.
- **Required context:** the graph vs the intent's trip template (the completeness diff, §master-model §4).
- **Data source:** `_calculate_confidence` + graph-vs-template diff + insight flags.
- **UI layout:** Insight-Note/compact card — ring + missing-cluster chips + coherence warnings. Responsive.
- **Interaction model:** tap a missing chip → jump to that cluster/capability; tap a warning → the relevant insight.
- **Memory updates:** none (read-only view).
- **Workspace interaction:** tapping a block-related flag can `highlight_block`.
- **Refresh rules:** recompute on every plan change.
- **Cache policy:** Derived; per plan-version.
- **Lifecycle:** Ephemeral; pinnable during active planning.
- **Transitions:** ring animates to new value; chips update in place.
- **Examples:** "you're 80% there — add dates and a return leg to finish."

#### 10.2 The rest of Planning Helpers

| Capability | Purpose | Trigger | Data source | Invoke | R/B | Life | Auto-upd | Mem | WS | X-Intent |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Calendar | month view of the trip | date-spanning talk | plan dates | user | beside | ephem·pin | derived | — | focus_day | trip, all |
| Timeline | day/hour block timeline | referencing the schedule | plan days | user | beside·pin | ephem·pin | derived | — | focus/highlight | trip |
| Conversation Summary | restate known facts | re-grounding/recovery | draft+graph | auto·user | beside | ephem | derived | — | — | all |
| Memory Viewer | show what the AI remembers | "what do you know about me" | `TravelerProfile`+draft | user | beside | ephem | slow | edit/delete facts | — | all |
| Recent Searches | prior queries this session | session start/empty | Context history | auto | beside | ephem | derived | — | — | all |
| Favorites | user-favorited items | "my favorites" | saved store | user | beside | ephem·pin | static | add→node | — | all |
| Saved Places | user-saved places | "add from saved" | saved store | user | beside | ephem | static | add→node | pins | all |
| History | past trips | "like my last trip" | prior workspaces | user | beside | ephem | static | clone→seed | — | trip, all |
| Continue Planning | resume a session | returning/dormant workspace | workspace state | auto | beside | ephem | derived | — | reopen workspace | all |

---

### 11-pre. Group — Utilities

**Group purpose:** self-contained tools that need little context — instant, cross-intent conveniences.
**Shared data source:** local computation + small reference/forex/tz tables + document parsing. **Archetype:** compact Status-Card / Detail-Panel. **Default freshness:** Static/Slow.

#### 10.3 Reference capability — **Currency Converter** (fully specified)

- **Purpose:** convert an amount between currencies at the live/daily rate.
- **When to invoke:** user asks; a foreign price is shown; budgeting an international trip.
- **Trigger conditions:** an amount + two currencies (currencies inferable from origin/destination).
- **Required context:** amount, from/to currency.
- **Data source:** forex API/daily table + math.
- **UI layout:** compact Status-Card — input amount, from/to, result, rate + "as of". Responsive full-width mobile.
- **Interaction model:** edit amount/currencies live; pin during a booking.
- **Memory updates:** Context only.
- **Workspace interaction:** none (pure tool); result may inform a budget line.
- **Refresh rules:** rate refresh daily/on view.
- **Cache policy:** Slow (rate cached per day).
- **Lifecycle:** Ephemeral; pinnable during foreign bookings.
- **Transitions:** result animates on input change.
- **Examples:** "how much is €200 in rupees" → ₹18,050 (rate as of today).

#### 10.4 The rest of Utilities

| Capability | Purpose | Trigger | Data source | Invoke | R/B | Life | Auto-upd | Mem | WS | X-Intent |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Unit Converter | km/mi, °C/°F, kg/lb | mixed-unit context | math | user | beside | ephem | no | — | — | all |
| Timezone Converter | time across zones | cross-tz scheduling | tz db | user | beside | ephem | clock | — | — | intl, all |
| Language Helper | key phrases | foreign destination | phrasebook/API | user | beside | ephem·pin | static | — | — | intl |
| Translation | translate text | "what does this say" | translate API* | user | beside | ephem | on demand | — | — | intl |
| Emergency Contacts | local emergency numbers | emergency/safety/arrival | ref (per country) | auto(emergency)·user | beside·pin | ephem·pin | static | — | — | all |
| SOS | one-tap help + location | user distress | device + contacts | user | replace·pin | pin | live(loc) | — | — | all |
| Document Viewer | view attached docs | doc attached | uploaded file | user | beside | ephem | no | parsed facts | — | all |
| Passport Checker | validity/blank-page rules | international prep | ref rules | auto(intl)·user | beside | ephem | slow | ctx | prep insight | passport, intl |
| Visa Checklist | steps/docs for a visa | visa intent/prep | ref (honest-degrade) | auto(intl)·user | beside·pin | ephem·pin | slow | ctx | prep insight | visa, intl |
| Packing Checklist | what to pack | pre-trip, weather known | derived (weather+activities) | auto | beside·pin | ephem·pin | derived | ctx | — | all |

---

### 11. Conversation Capability Matrix

Maps every **travel intent** (rows) to every **capability** (columns). Because a single 13×110 grid is unreadable, the matrix is presented as (a) a **group-rollup** and (b) **per-group** matrices. Both are authoritative; the per-group tables win on conflict.

**Legend:**
- **R** = Required (the intent essentially needs it)
- **O** = Optional (offered proactively; skippable)
- **A** = Automatic (AI shows it without being asked, when triggers fire)
- **U** = User-triggered (only on explicit request)
- **B** = Background (runs unseen; surfaces on threshold)
- **—** = Disabled / not relevant for this intent

A cell often combines *offer-strength* and *invocation*, e.g. **O/A** = optional & shown automatically; **O/U** = optional & only on request; **R/A** = required & automatic.

Intents (rows) used throughout: **Hotel · Flight · Train · Bus · Cab · Trip(full) · Restaurant · Attraction · Activities · Visa · Forex · Passport · Emergency.** (Insurance/Travel-Pass/SIM behave like Visa's prep column.)

#### 11.1 Group-rollup matrix (intent × capability group)

| Intent | Search & Discovery | Live Info | Place Intel | Navigation | Exploration | AI Intelligence | Monitoring | Planning Helpers | Utilities |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Hotel | R/A | O/A | R/A | O/A | O/U | R/A | O/B | O/A | O/U |
| Flight | R/A | R/A | O/U | O/A | — | R/A | R/B | O/A | O/U |
| Train | R/A | R/A | O/U | O/A | — | R/A | R/B | O/A | O/U |
| Bus | R/A | O/A | O/U | O/A | — | O/A | O/B | O/A | O/U |
| Cab | R/A | O/A | O/U | R/A | — | O/A | O/B | O/U | O/U |
| Trip (full) | R/A | R/A | R/A | R/A | R/A | R/A | R/B | R/A | O/A |
| Restaurant | R/A | O/A | R/A | O/A | O/A | O/A | — | O/U | O/U |
| Attraction | R/A | O/A | R/A | O/A | O/A | O/A | — | O/U | O/U |
| Activities | R/A | O/A | R/A | O/A | R/A | O/A | O/B | O/U | O/U |
| Visa | O/U | O/A | — | — | — | O/A | O/B | O/U | R/A |
| Forex | O/U | R/A | — | — | — | O/A | O/B | — | R/A |
| Passport | — | O/U | — | — | — | O/A | — | — | R/A |
| Emergency | R/A | R/A | O/A | R/A | — | O/A | O/B | O/U | R/A |

#### 11.2 Search & Discovery (intent × capability)

| Intent | Nearby | Hotels | Restaurants | Attractions | Activities | Airports | Stations | Bus Stns | Hospitals | ATMs | Fuel | Parking | Public Transit |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Hotel | O/A | R/A | O/A | O/A | O/U | — | — | — | O/U | O/U | — | — | O/U |
| Flight | O/U | O/U | — | — | — | R/A | — | — | — | O/U | — | — | O/U |
| Train | O/U | O/U | — | — | — | — | R/A | — | — | O/U | — | — | O/U |
| Bus | O/U | O/U | — | — | — | — | — | R/A | — | O/U | — | — | O/U |
| Cab | O/A | — | — | — | — | O/A | O/A | O/A | O/U | O/U | O/U | O/A | — |
| Trip | O/A | R/A | O/A | R/A | O/A | O/A | O/A | O/A | O/U | O/U | O/U | O/U | O/A |
| Restaurant | O/A | O/U | R/A | O/A | — | — | — | — | — | O/U | — | O/U | O/U |
| Attraction | O/A | O/U | O/A | R/A | O/A | — | — | — | — | O/U | — | O/U | O/U |
| Activities | O/A | O/U | O/A | O/A | R/A | — | — | — | O/U | O/U | — | O/U | O/U |
| Visa/Forex/Passport | O/U | — | — | — | — | — | — | — | — | O/U | — | — | — |
| Emergency | R/A | O/U | — | — | — | O/A | O/A | O/A | R/A | O/A | O/U | — | O/A |

#### 11.3 Live Travel Information (intent × capability)

| Intent | Flight Status | Train Status | Metro/Bus | Airport Delays | Platform/Gate | Traffic | Weather | AQI | Advisories | Forex | Local Time |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Hotel | — | — | O/U | — | — | O/U | O/A | O/A | O/U | O/U | O/U |
| Flight | R/A | — | O/U | O/A | R/A(gate) | O/U | O/A | O/U | O/A(intl) | O/U | O/A(intl) |
| Train | — | R/A | O/U | — | R/A(platform) | O/U | O/A | O/U | — | — | O/U |
| Bus | — | — | O/A | — | — | O/A | O/A | O/U | — | — | O/U |
| Cab | — | — | — | — | — | R/A | O/A | O/U | — | — | O/U |
| Trip | O/A | O/A | O/A | O/A | O/A | O/A | R/A | O/A | O/A(intl) | O/A(intl) | O/A(intl) |
| Restaurant | — | — | O/U | — | — | O/A | O/A | O/U | — | — | O/U |
| Attraction | — | — | O/U | — | — | O/A | R/A | O/A | — | — | O/U |
| Activities | — | — | O/U | — | — | O/A | R/A | O/A | O/U | — | O/U |
| Visa | — | — | — | — | — | — | — | — | R/A | O/U | O/U |
| Forex | — | — | — | — | — | — | — | — | O/U | R/A | O/U |
| Passport | — | — | — | — | — | — | — | — | O/A | — | — |
| Emergency | O/A | O/A | O/A | O/A | — | R/A | R/A | O/A | R/A | O/U | R/A |

#### 11.4 Navigation & Place Intel (condensed — intent × key capability)

| Intent | Interactive Map | Route | Distance | Travel Time | Multi-stop | Place Details | Opening Hours | Best Time | Crowd | Entry Fees |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Hotel | O/A | O/U | O/A | O/A | — | R/A | O/A | O/A | — | — |
| Flight | O/U | O/U | O/A | O/A | — | O/U | — | — | — | — |
| Train | O/U | O/U | O/A | O/A | — | O/U | — | — | — | — |
| Bus | O/U | O/U | O/A | O/A | — | O/U | — | — | — | — |
| Cab | R/A | R/A | R/A | R/A | O/U | O/U | — | — | O/U | — |
| Trip | R/A | O/A | O/A | O/A | R/A | R/A | R/A | R/A | O/A | O/A |
| Restaurant | O/A | O/U | O/A | O/A | — | R/A | R/A | O/A | O/A | — |
| Attraction | O/A | O/U | O/A | O/A | O/U | R/A | R/A | R/A | R/A | R/A |
| Activities | O/A | O/U | O/A | O/A | O/U | R/A | R/A | O/A | O/A | R/A |
| Emergency | R/A | R/A | R/A | R/A | — | O/A | — | — | — | — |

*(Visa/Forex/Passport rows are — across Navigation & Place Intel.)*

#### 11.5 AI Intelligence, Monitoring, Helpers, Utilities (condensed — intent × key capability)

| Intent | AI Recommend | AI Insight | Budget Analysis | Optimization | Monitor (relevant) | Trip Progress | Timeline/Calendar | Currency Conv | Emergency Contacts | Checklists |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Hotel | R/A | O/A | O/A | O/U | O/B(price) | O/A | O/U | O/U | O/U | O/U(packing) |
| Flight | R/A | O/A | O/A | O/U | R/B(flight) | O/A | O/U | O/U(intl) | O/U | O/U |
| Train | R/A | O/A | O/A | O/U | R/B(train) | O/A | O/U | — | O/U | O/U |
| Bus | O/A | O/A | O/A | O/U | O/B | O/A | O/U | — | O/U | O/U |
| Cab | O/A | O/A | O/A | O/U | O/B(traffic) | O/U | — | — | O/U | — |
| Trip | R/A | R/A | R/A | R/A | R/B(delays) | R/A | R/A | O/A(intl) | O/A | O/A |
| Restaurant | O/A | O/A | O/U | — | — | O/U | — | O/U(intl) | O/U | — |
| Attraction | O/A | O/A | O/U | O/U | — | O/U | O/U | — | O/U | — |
| Activities | O/A | O/A | O/A | O/U | O/B(weather) | O/U | O/U | — | O/U | O/U(packing) |
| Visa | O/A | O/A | — | — | O/B(visa) | O/U | — | — | O/U | R/A(visa) |
| Forex | R/A | O/A | O/A | — | O/B(forex) | — | — | R/A | O/U | — |
| Passport | O/A | O/A | — | — | — | — | — | — | O/U | R/A |
| Emergency | O/A | O/A | — | — | O/B | O/U | — | O/U | R/A | O/U |

---

### 12. Closing — the AI operating system for travel

With this layer, a conversation turn can simultaneously: understand intent, give a recommendation, ask one connected cluster, **search** real places, **show** them on a map, **surface** live weather and flight status, **explain** its reasoning, and **arm a monitor** — all inline, all governed by one lifecycle, all honest about provenance. The chat stops being a form and becomes a **console**: every travel action the user could want is a capability the AI can reach for the moment reasoning says it helps.

Nothing in the existing architecture changed. This layer sits on top of it — capabilities ride the existing widget channel, obey the existing calm/honesty/proposal invariants, and reuse the existing engines (insight, recommendation, constraints, distance, enrichment) as their data sources. It is the difference between an assistant that *asks you about travel* and one that can *actually operate travel with you.*
