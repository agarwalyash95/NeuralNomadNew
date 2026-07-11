# Planner — Production Plan (clean rewrite, 2026-07-11)

> The single authoritative plan for taking the planner to production. Supersedes the earlier
> seed-based draft of this document. Companion docs: `planner-master-plan.md` (architecture
> rationale), `neuralnomad-ecosystem.md` (product north star).

---

## The philosophy (three rules, no exceptions)

1. **One engine.** PostgreSQL (pgvector image) everywhere — dev, tests, production. There is no
   SQLite fallback, no `USE_LOCAL_DB`, no engine toggle. If it doesn't run against Postgres, it
   doesn't run.

2. **Content is never seeded.** Hotels, restaurants, attractions, activities, prices, insights —
   none of it is pre-loaded. The database starts empty and fills itself with **real data through
   the live paths as the app is used**:
   - Places → `places_explore.explore_places()` (Google Places, cache-on-miss)
   - Prices → `live_price.lookup_live_price()` (history first, provider on miss)
   - Distances → `distance_service` (Google Distance Matrix → `knowledge.DistanceEdge`, TTL'd)
   - Insights/tips/embeddings → Celery enrichment passes over whatever the catalog holds
   The only bootstrap is **infrastructure** the stack has no live API for:
   `python manage.py bootstrap_reference` — real geography (countries/airports/stations from
   public datasets, needed for booking-canvas autocomplete) + curated real climate normals
   (the day-header weather chip; live forecasts are deferred scope).

3. **Honest tiers, everywhere.** Real facts are shown as facts. Booking providers stay **mock but
   realistic** until `RAPIDAPI_KEY` + `LIVE_PROVIDERS_ENABLED` flip them live (zero code change —
   already built). Every mock-derived number wears the `estimated` tier; nothing fake is ever
   labeled live/verified. Visa and safety content is never AI-primary.

---

## State of the world (verified, not assumed)

### Done and verified this session

| What | Proof |
|---|---|
| `apps/travel_intelligence` deleted (duplicate trip schema + third catalog write-path) | app dir gone; `INSTALLED_APPS`/urls clean; frontend consumer stubbed until `PlanTemplate` corpus replaces it |
| Duplicate/dead models removed: `GooglePlaceCache`, `reference.VisaRequirement`, `reference.Currency`, `planner.LocationDistanceCache` | migrations `reference.0008` + `planner.0011` applied on real Postgres |
| `distance_service.py` migrated onto `knowledge.DistanceEdge` (TTL'd cache, was the acknowledged duplicate) | read+write paths use `DistanceEdge` with per-mode TTL |
| `knowledge` app installed for real | `knowledge.0001` + `0002` (pgvector `EntityEmbedding` + HNSW index) applied on Postgres |
| Knowledge wired into read paths | `suggestions.py` now emits `insights` **and** review-gated `local_tips`; `RichHoverCard` renders the tip line |
| SQLite/dev shims removed | `base.py` Postgres-only; `testing.py` runs tests on Postgres with real migrations; `db.sqlite3` deleted |
| All mock seeders deleted | `seed_reference`, `seed_reference_google` (leaked API key into stored URLs), `seed_historical_prices`, `seed_bookings` — gone |
| **Database wiped clean** | `DROP SCHEMA public CASCADE` → fresh `migrate` (all green) → `bootstrap_reference` |
| Live path proven on the clean DB | one real Places call fetched + cached 15 real Jaipur attractions (Hawa Mahal, Jaigarh Fort, …) with real ratings/place_ids |

**Database now contains:** 250 countries · 15,369 cities · 7,062 airports · 8,988 railway
stations · 144 climate rows · **zero** pre-seeded content · **zero** mock rows · **zero** users
(re-register / `createsuperuser`). A 42 MB JSON backup of the old DB sits in the session
scratchpad if anything needs recovering.

### Real API contract

| Capability | Source | Status |
|---|---|---|
| Places catalog | Google Places (cache-on-miss) | ✅ live, proven on clean DB |
| Geocoding / cities | Google Places / geocode fallback | ✅ live |
| Distances | Google Distance Matrix → `DistanceEdge` | ✅ wired (browser Maps key still needs rotation — see below) |
| Chat + generation | Gemini (streaming SSE) | ✅ live |
| Enrichment (insights/tips/embeddings) | Gemini + pgvector via Celery | ✅ installed; runs as catalog fills |
| Weather chips | curated climate normals | ✅ bootstrapped |
| Flight/hotel/train/bus/cab booking | **mock, realistic shapes, `estimated` tier** | 🎭 by design; env flip to go live later |

---

## Remaining phases

### A — Readable code (frontend structure)
- Split `PlannerWorkspace.tsx` (859 lines): `usePanelRouter` (12-way panel switch),
  `usePlanState` (plan CRUD/save/verify/watch), `services/bookingTransition.ts`,
  `usePdfExport`. Shell target: <200 lines.
- Extract `helper-canvases/shared/hooks/useCanvasSearch.ts` — the identical
  search/filter/pending-replace state machine currently copy-pasted across
  Flight/Hotel/Train/Bus/Cab/Checkout.
- One `layout/PanelShell.tsx` for Nav Rail / Chat Dock / Detail Panel; fix the sidebar's
  hand-duplicated collapsed view; rename the colliding `types.ts` pair.
- Delete empty scaffold dirs (`features/planner/{api,data,selectors,types}/`), trim
  `routeOptimizer.ts` to the display-only estimate, drop the `@deprecated MockTripData` alias.

**Verify:** `tsc --noEmit` + `next build` green; manual swap in each canvas unchanged.

### B — Design-system enforcement (make it look production)
- Extend `.dark` to cover `paper/ink/cat/trust` tokens (dark mode is currently broken by
  construction — only shadcn base tokens flip).
- Route planner buttons/cards/tabs/badges through the existing-but-unused `components/ui/*`.
- Sweep the ~1,478 hardcoded Tailwind color classes onto the tokens that already model those
  concepts (`cat-stay` vs hand-rolled indigo, `cat-food` vs orange, `trust-*` vs raw
  emerald/amber/violet); fix the attraction/activity color collision.
- Apply the built-but-unused type ramp (`text-display/title/body/caption/micro`) over the
  ~190 arbitrary `text-[Npx]` declarations; one icon system (Lucide, no emoji glyphs).
- Reconcile the three visual registers: map chrome → paper/ink (tiles stay dark), helper
  canvases `bg-white` → `bg-paper-*`.

**Verify:** OS dark-mode toggle flips the planner cleanly; hardcoded-color grep trends to zero;
before/after screenshots per surface.

### C — Production pass
- Consistent loading / empty / error states on every canvas + timeline. The empty-catalog
  cold-start matters now: first search in a new city takes one live round-trip — the UI must
  say "searching real places…" not render a blank.
- Honest-labels audit: every price tier truthful; nothing mock says "live".
- Tests green on Postgres (`config.settings.testing` now requires the docker Postgres up),
  `next build` green, no key in any bundle or response.
- `.env.example` files document every key accurately.

### D — Community corpus (`PlanTemplate`)
Unchanged from `planner-master-plan.md` §2: anonymized, opt-in templates derived from real
booked/saved trips, surfaced in chat + homepage (the stubbed `recommended-trips` section is
waiting to be repointed at it). This is the replacement for the deleted `travel_intelligence`.

---

## Actions only you can take

1. **Rotate the Google Maps browser key** (`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`) — the old one is
   in git history (verified, 2 hits). Revoke in Google Cloud Console, put the new one in
   `frontend/.env` only. HTTP-referrer-restrict it.
2. **Recreate your login** — the wipe removed all users: `python manage.py createsuperuser`.
3. When ready for live booking: add `RAPIDAPI_KEY`, set `LIVE_PROVIDERS_ENABLED=True`. Nothing
   else changes.
