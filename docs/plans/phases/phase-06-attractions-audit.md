# Phase 6 — Attractions-App §13 Retirement-Gate Audit

- Date: 2026-07-20, Asia/Calcutta
- Scope: real evidence for every checklist item in the master plan's §13 "Attractions-app retirement gate." **No code, frontend, or data changes were made as part of this audit** — it is a fact-finding pass only, per §13's own rule that retirement proceeds "ONLY when every box is checked" and is owner-approved.

## §13 checklist, re-evaluated against current code

- [x] **All consumers mapped.** Full list below — resolved for the first time this phase (previously only `frontend/src/services/attraction.service.ts` was named as `[VERIFIED]`).
- [ ] **Frontend migrated to `/reference/attractions/*` + photo proxy.** **Partially true, not fully.** The `apps.reference` backend endpoint already exists and already serves part of the frontend (see below) — this is not an unbuilt backend feature. But a second, real frontend surface still depends on an old-app capability with no reference equivalent (see "Concrete remaining gap" below). Not closed.
- [x] **ID mapping table:** `AttractionMaster.place_id` (`apps/reference/models.py:374`, `unique=True`) and `attractions.Attraction.place_id` (`apps/attractions/models.py:27`, `unique=True`) are both real, queryable, unique join keys today. No new table was needed to satisfy this — the two existing `place_id` columns already are the join key the checklist item asks for.
- [x] **Saved planner/user references audited — RESOLVED, previously `[UNKNOWN today]`.** A fresh backend-wide grep for `attractions.Attraction`, any `ForeignKey(...Attraction`, and the table name `attractions_attraction` returns **zero matches** in `apps/planner` or `apps/bookings`. Every "Attraction" reference in `apps/planner` (`services/insight_engine.py`, `services/taste.py`, `services/plan_generation.py`, `services/distance_service.py`, `services/intelligence/recommendations.py`, `services/widget_orchestrator.py`) already imports and queries `apps.reference.models.AttractionMaster`, not the old app's model. **No redirect map is needed** — there is nothing to redirect.
- [x] **Backward-compatible routes:** `/attractions/items/explore/` (old app) still exists and functions independently; it is not currently deprecated or shimmed over `apps.reference`, but nothing this audit found requires it to be — see below.
- [~] **Image URLs scrubbed (P0) and re-audited.** `scrub_attraction_image_urls.py` exists and was run in Phase 0 per `docs/agent/HANDOFF.md`. Not re-run this phase (no new key-bearing URLs were introduced by anything in Phase 6 — this phase never touches `apps.attractions`).
- [ ] **Parity verified: same query returns equivalent results from both endpoints on a fixture city.** Not attempted this phase — see "Concrete remaining gap."
- [ ] **Owner approves removal explicitly.** Not requested; not in scope.

## Full current consumer list

**Backend:**
- `config/settings/base.py:52` — `INSTALLED_APPS` entry.
- `config/urls.py:18` — `path('attractions/', include('apps.attractions.urls'))`.
- `apps/attractions/admin.py:9` — `AttractionAdmin` (note: its fieldset at `admin.py:23` references a `phone` field that no longer exists on the current `Attraction` model — pre-existing dead/broken admin fieldset, unrelated to Phase 6, flagged here for whoever eventually does the retirement pass).
- `apps/attractions/management/commands/scrub_attraction_image_urls.py:6` — the only cross-app Python import of `apps.attractions.models.Attraction`.
- No other backend app (`accounts`, `bookings`, `planner`, `visa`, `forex`, `travelpass`, `wallet`, `notifications`, `homepage`, `knowledge`) references `apps.attractions` in any form.

**Frontend — two live call paths coexist:**
- **Old app** (`frontend/src/services/attraction.service.ts`, all 8 methods hit `/attractions/*`): used by `frontend/src/app/attractions/page.tsx` (autocomplete only) and, transitively via `frontend/src/hooks/use-attractions.ts`, by `frontend/src/app/attractions/[id]/page.tsx` — a genuine, load-bearing dependency: this is the app's **paginated, category-filtered browse list** (`getAttractions`).
- **New path** (`frontend/src/services/reference.service.ts`'s `exploreAttractions`/`getPlaceDetails`, hitting `/reference/attractions/explore/` and `/reference/attractions/{id}/details/`): drives the explore/details flow via `use-explore.ts`/`use-explore-details.ts` and the `components/explore/*` panels.
- The old app's own `explore`/`details` actions (`attraction.service.ts`'s `explore`/`getDetails` methods) appear **unused** by the actual explore flow (which uses the new path instead) — worth a follow-up "is this dead code" check, separate from retirement itself.

## Concrete remaining gap (the real blocker, now named instead of an open question)

`apps.reference.AttractionMasterViewSet` (`apps/reference/views.py:206-230`) exposes `explore` and `details` — but **no paginated, category-filtered list/browse action equivalent to the old app's `getAttractions`**. `attractions/[id]/page.tsx` genuinely depends on that capability today. Retirement cannot proceed until either:

1. `apps.reference` gains an equivalent paginated/filtered list endpoint and the frontend is migrated onto it, or
2. The product decides the old app's browse page itself is being retired/redesigned, making the gap moot.

Neither is a Phase 6 (backend reference-data) decision — it's real frontend/product scope, correctly out of this phase.

## What this audit changes vs. the master plan's prior state

Before this phase, §13 had one explicit `[UNKNOWN today]` blocking item (saved-reference audit) and an implicit assumption that "frontend migrated" was simply unbuilt. Both are now resolved with real evidence: the reference-side backend mostly already exists and is already partly consumed; the unknown is resolved to "clean, no dependency"; and the actual remaining blocker is named precisely (the missing browse/list endpoint) rather than left as a vague "frontend migration" checklist line. This makes the next attempt at retirement a scoped, two-option decision instead of an open-ended investigation.

## Verification

- `grep -rn "attractions\.Attraction\|attractions_attraction" backend/apps/planner backend/apps/bookings` — zero matches (the central evidence claim above).
- `grep -rln "apps\.attractions" backend/` — only the 4 files listed under "Full current consumer list."
- No code was written or changed for this audit.
