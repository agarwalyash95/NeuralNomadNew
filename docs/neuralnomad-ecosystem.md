# NeuralNomad — The One-Product Ecosystem

> Written 2026-07-11, one altitude above `planner-master-plan.md`. That doc makes the planner
> perfect; this one makes the *product* whole. The brief: the six pillars — Planner, Booking,
> Travel Knowledge, AI, Community, Maps — must stop feeling like six things and start feeling
> like one companion. Explicitly tuned to lift the three weakest dimensions in the owner's own
> scorecard: Exploration (7.5), Emotional Experience (8), and the "Never leave NeuralNomad"
> goal (7).

---

## 0. The reframe

Today the six pillars are **places you go**: a planner page, a booking flow, a knowledge base,
an AI chat, a community section, a map. A product that feels like one thing doesn't work that
way. In one product, the pillars are **capabilities that show up wherever you are** — the AI is
present whether you're dreaming or mid-trip; the map is the substrate under every surface;
knowledge enriches a place whether you're browsing it or standing in front of it.

The organizing idea that unifies all six is the **travel lifecycle**. NeuralNomad's ambition is
to own the *entire arc* of a trip, not just the planning slice in the middle:

> **Dream → Plan → Book → Travel → Remember** — and *Remember* feeds the next traveller's *Dream*.

That closing loop is not decoration. It is simultaneously the **Community flywheel** and the
**"never leave" engine**: the product has a reason to exist for you before you have a trip in
mind, during the trip itself, and after you're home — not only in the plan-and-book window where
it lives today.

Two of those five stages barely exist in the product right now — **Dream** and **Travel** — and
they map precisely onto the two lowest non-loop scores (Exploration, Emotional). That is not a
coincidence; it's the diagnosis.

---

## 1. The lifecycle loop

| Stage | What the traveller does | Powered by | The surface | The feeling |
|---|---|---|---|---|
| **Dream** ⟡ *new* | Wanders, gets inspired, saves places and ideas with no trip yet | Community + Knowledge + Maps + AI | **Discover** (new home) | curiosity, possibility |
| **Plan** | Turns intent into a real day-by-day itinerary | Planner + AI + Knowledge + Maps | the Workspace (master-plan doc) | momentum, confidence |
| **Book** | Locks flights, stays, transfers into the plan | Booking + AI | the helper canvases + Checkout | relief, commitment |
| **Travel** ⟡ *new* | Lives the trip with the plan in their pocket | Maps + Knowledge + AI + Booking | **Companion** (new in-trip mode) | presence, reassurance |
| **Remember** | Keeps the trip as a memory; it becomes a proven template | Community + AI | **Recap** → the corpus | pride, generosity |

⟡ = a stage the product does not meaningfully have yet. Building these two is where the largest
score gains live.

**The loop closes here:** a traveller's *Remember* (their finished, anonymized trip) is the raw
material for the next traveller's *Dream* (a proven recommendation in Discover). Every completed
trip makes the top of the funnel better. This is the community corpus from the master plan,
seen from the product's altitude rather than the database's.

---

## 2. The shared spine — what makes it *technically* one product

Cohesion isn't a coat of paint. Six pillars feel like one product when they all read and write a
**small set of shared core objects**, and no pillar keeps a private copy of another pillar's
object. Everything visible is a **lens on the same underlying thing.**

| Core object | Owned by | Every pillar's relationship to it |
|---|---|---|
| **Place** | Knowledge (`reference` catalog + `knowledge` enrichment) | Planner, Booking, Maps, Discover all reference the *same* place by `place_id`. A place is enriched once and that richness shows up everywhere it appears. |
| **Trip** | Planner (`PlannerTrip`, block-schema-v2) | Booking commits blocks *into* it; Community derives templates *from* it; the Travel companion reads it *live*. One trip object, many views. |
| **Traveller** | a first-class Traveller identity (`TravelerProfile` promoted) | The AI's memory, preferences, wishlist, and history are one profile, known on every surface — Discover greets you by it, Plan is shaped by it, Companion travels with it. |
| **Map** | Maps | The single spatial substrate. Discover, Plan, and Companion are all *the same map* at different zoom levels of intent. |
| **AI** | AI | One brain, many contexts. The same conversational memory whether you're wandering Discover, editing a plan, or asking "what's near me" at 8pm on day 3. |
| **Design language** | design system | One token / component / motion vocabulary across all surfaces (the enforcement work in master-plan §4, extended product-wide). |

**The single architectural law of the ecosystem:** *one owner per core object; everyone else
references, never copies.* This is exactly the lesson learned by deleting `apps/travel_intelligence`
— it had failed by keeping its own duplicate Trip schema and its own Place-seeding path. That
wasn't a one-off mistake to clean up; it's the principle that keeps the whole ecosystem coherent
as it grows. Any future feature that wants its own copy of "trip" or "place" is a red flag.

---

## 3. Dream — fixing Exploration (7.5 → 10)

The product currently assumes you already know you want Jaipur. Everything starts from a filled-in
intent. There is no surface for the enormous, valuable time *before* a trip exists — and that's
the entire top of the funnel and most of the "come back when you're not actively planning" energy.

**The Discover home** — the new default landing surface:

- **Inspiration, not a form.** A living canvas of destinations, seasonal ideas, and — crucially —
  *real trips other travellers actually took* (the corpus). "6 days in Rajasthan people loved this
  December" beats any stock hero image.
- **Map-first wandering.** Pan a region and see what's actually there — real places from the
  knowledge layer, shaded by neighbourhood character, clustered by interest. Exploration *is* the
  map at low intent; planning is the same map at high intent.
- **A wishlist that isn't a commitment.** Save a place, a dish, a template, a "someday" city —
  with no obligation to build a trip. This is the lightweight object the product is missing: an
  idea you keep, that the AI remembers, that seeds a plan when you're ready.
- **The bridge is one tap.** Anything you're looking at — a saved place, a browsed template, a
  neighbourhood — turns into a planner draft with "Turn this into a trip," pre-seeded so the chat
  starts warm instead of cold.

Discover reuses everything: the same Map, the same Places, the same AI, the same Community
corpus. It's not a new pillar — it's the low-intent lens on the spine.

---

## 4. Travel — fixing Emotional Experience (8 → 10) *during* the trip

The emotional arc of a trip has four beats — **anticipation, arrival, presence, memory** — and
the product today only touches the planning one. The companion mode is the biggest single lever
on both Emotional Experience and the "never leave" goal, because it puts NeuralNomad *in your
pocket while you're actually travelling.*

- **Anticipation (before departure):** a gentle countdown, weather-driven packing nudges from
  the seasonal normals already in the catalog, "12 days until Jaipur — visa's sorted, one hotel
  still unbooked." The product stays warm in the gap between booking and going.
- **Presence (during):** the plan becomes a live, contextual companion. "You're 400m from Amber
  Fort — it opens in 20 minutes, beat the 10am crowd." "Your train to Udaipur leaves in 2 hours
  from platform 3." This is the knowledge layer's crowd/hours/transit data + the map + the AI,
  fired by where and when you are, not by a screen you had to open.
- **Reassurance:** offline access to today's plan, confirmations, and emergency numbers (already
  a knowledge model). The one moment a traveller most needs the product is the one moment
  connectivity is worst — design for it.

None of this needs new data. It needs the existing spine pointed at *now* instead of *later*.

---

## 5. Remember & the flywheel — fixing "Never leave" (7 → 10)

"Never leave" is not won by trapping people; it's won by being worth returning to when you have
no active trip. The loop is what does that:

- **Recap (after):** the finished trip becomes a beautiful, honest memory — the route you actually
  took, the places, the real cost. Something you're a little proud of and happy to keep.
- **Generosity, not vanity:** with one opt-in, that recap becomes an anonymized template that
  helps the next traveller. Community here is *proven trips*, not feeds and followers — inspiration
  with provenance, which is a far stronger and more defensible thing than a social network.
- **Reasons to return with no trip booked:** new community trips for places on your wishlist,
  seasonal inspiration timed to when a destination is at its best, "a traveller did the Kerala
  trip you saved." The product has a heartbeat even when you're not planning.

The flywheel: **more trips taken → more proven templates → better Discover → more trips started →
more trips taken.** Every pillar feeds it, and it feeds every pillar back. That self-reinforcing
loop *is* the moat, and it's the honest version of "never leave."

---

## 6. The emotional layer, everywhere — the rest of Emotional (8 → 10)

Beyond the Travel stage, cohesion has a *feel*, delivered consistently across all surfaces:

- **One companion voice** — warm, brief, expert, never chirpy or over-personified. The same
  character whether it's greeting you in Discover or nudging you on day 3. Tasteful restraint;
  the AI is a good travel friend, not a mascot.
- **Earned delight moments** — the reveal when a plan finishes generating, a quiet celebration
  when a trip is fully booked, the Recap when you're home. A few, well-placed, never gratuitous.
- **Continuity** — it remembers you and picks up where you left off: "welcome back — your Jaipur
  trip is in 12 days, and prices on that unbooked hotel dropped." Memory is the difference between
  a tool and a companion.
- **Motion as meaning** — one motion vocabulary (panels, reveals, transitions) so the product
  moves like one organism, always respecting reduced-motion.

---

## 7. Build order — grounding the vision

This is sequenced so each step stands on the last and value ships continuously — not a big-bang.

1. **Finish the planner master plan.** Dedupe, design-system enforcement, structure, community
   corpus. This *establishes the shared spine* — Place, Trip, Traveller already exist; the corpus
   seeds the loop. (Detailed in `planner-master-plan.md`.)
2. **Promote the spine to first-class.** Make Place / Trip / Traveller / Map / AI / design shared
   services the whole app reads, not planner-internal implementation details. Enforce the
   one-owner law.
3. **Build Discover.** Biggest lever on Exploration and top-of-funnel. Low-intent lens on the
   spine: map-first browse, wishlist, community-as-inspiration, one-tap bridge to Plan.
4. **Build the Travel companion.** Biggest lever on Emotional and during-trip "never leave." Point
   the existing spine at *now*: anticipation, contextual presence, offline reassurance.
5. **Close the loop.** Recap → template → Discover feed. The flywheel goes live.
6. **Polish the emotional layer product-wide.** Voice, delight moments, continuity, motion.

---

## 8. Guardrails (so growth doesn't re-fragment the product)

- **One owner per core object.** The single law from §2. Any new "trip-like" or "place-like"
  table is a design smell — reference the owner instead. This is what went wrong with
  `travel_intelligence`; don't let it recur under a new name.
- **Community is proven trips, not a social network.** No feeds-for-engagement, followers, or
  vanity metrics. Inspiration with provenance is the product; a social graph is a different,
  weaker company.
- **The honesty rule extends ecosystem-wide.** Measured facts are measured and the AI only
  phrases them; judgment calls are tagged as the soft tier; visa and safety are never AI-primary.
  Trust is the brand — it can't be traded for delight.
- **Every pillar is a lens, never a silo.** If a surface can't be expressed as a view on the
  shared spine, question whether it belongs — or whether the spine is missing an object.

---

*This document is the product north star. `planner-master-plan.md` is step 1 of §7 in full
engineering detail. The two are meant to be read together: this one says what NeuralNomad is,
that one says how the first and largest piece of it gets built.*
