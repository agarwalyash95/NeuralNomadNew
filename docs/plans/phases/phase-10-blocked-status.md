# Phase 10 Status — Final Consolidation: BLOCKED

- Date: 2026-07-20, Asia/Calcutta
- Agent/platform: Claude Code (Sonnet 5)
- Status: **BLOCKED — no deletions performed.** All four of Phase 10's own gates were checked fresh against live code/config, not assumed from prior docs. None is currently satisfied, though one (route_graph latency) improved materially during this same session via a separate background fix.

This mirrors this repo's own Phase 00 precedent: when a phase's prerequisites are genuinely unmet, the correct action is a documented block, not a forced execution. Every "delete X" item in Phase 10's scope is explicitly conditioned on a gate in the master plan's own text — none of the four gates below hold today.

## Gate 1 — Knowledge app removal (`apps.knowledge` shell + shims)

**Condition**: "§12 criteria met" — specifically, master plan §12.2 step 8 (confirm parity after one real production Celery beat cycle: embeddings task at 15min, enrichment task at 6h) must complete first, per Phase 7's own explicit scoping.

**Current status**: NOT MET.
- `backend/config/settings/base.py:48` — `"apps.knowledge",` still in `INSTALLED_APPS` (checked directly).
- `apps/knowledge/models.py`, `admin.py`, `services/embeddings.py`, `services/engine.py`, `services/enrichment.py` — all still present as shim files (checked directly).
- Step 8 has not run: no evidence of a confirmed production beat cycle exists in any evidence doc.

**What would close this gate**: run the app for one real production beat cycle (or a deliberately-simulated equivalent), confirm the shims produced identical results to a direct `apps.reference`/`apps.planner` call throughout, record that evidence, then remove the shim files and the `INSTALLED_APPS` entry.

## Gate 2 — Attractions app removal

**Condition**: "only if §13 checklist fully green + owner approval."

**Current status**: NOT MET.
- `backend/apps/attractions/` is still a full, live app — `admin.py`, `apps.py`, `models.py`, `serializers.py`, `urls.py`, `views.py` all present (checked directly, not a stub).
- `backend/config/settings/base.py:52` — `"apps.attractions",` still in `INSTALLED_APPS`.
- `backend/config/urls.py:18` — still routed (`path('attractions/', include('apps.attractions.urls'))`).
- Phase 6's own audit (`docs/plans/phases/phase-06-attractions-audit.md`) names a real, unresolved blocker: no `apps.reference` equivalent exists for the old app's paginated, category-filtered browse endpoint (`getAttractions`), which `frontend/src/app/attractions/[id]/page.tsx` genuinely depends on today. Owner approval for removal was never sought.

**What would close this gate**: either build the missing `apps.reference` browse-list endpoint and migrate the frontend page onto it, or a product decision to retire/redesign that page instead — then re-verify the full §13 checklist and get explicit owner sign-off.

## Gate 3 — Legacy resolver path + kill-switch removal

**Condition**: the plan's text implies this only makes sense once `route_graph.search` is the authoritative journey-resolution path.

**Current status**: NOT MET, but materially improved this session.
- `PLANNER_ROUTE_GRAPH_ENABLED` still defaults `False` (`base.py:310`, checked directly) — the flip itself remains an explicit owner decision, not something any agent session should make unilaterally.
- `apps/planner/services/journey_resolver.py` still contains both `_resolve_scheduled_mode` (legacy) and `_route_graph_resolve_scheduled_mode` (route_graph-backed), switched by the still-present flag check at line 42 — both paths, and the switch itself, remain live.
- **Real, positive development**: earlier the same day, Phase 8's own benchmark found `route_graph.search()`'s median latency was ~8 seconds (worst case 48s) — a genuine blocker that made the flip decision unconsiderable regardless of anything else. A dedicated follow-up (`task_ab02ca90`) root-caused this to an N+1 query pattern in `station_selector.py` and fixed it: real re-benchmark shows p50 8,051ms → 54.76ms (~147x), p95 19,149ms → 77.69ms (~246x), max 48,291ms → 133.05ms (~363x), all existing tests still passing. See `docs/plans/phases/phase-08-perf-fix-station-selector-n-plus-1.md`. **This removes the specific latency blocker; it does not itself authorize the flip or the deletion** — both remain exactly as owner-gated as before, just no longer blocked by a performance defect on top of that.

**What would close this gate**: the owner reviews the (now-healthy) shadow-comparison + latency evidence and explicitly decides to flip `PLANNER_ROUTE_GRAPH_ENABLED`; that flip then needs its own soak/verification period in a live environment before the legacy path is safe to delete outright (deleting a fallback the moment its replacement is enabled, with no soak time, would remove the safety net exactly when it's most likely to be needed).

## Gate 4 — `check_layer_boundaries` empty-allowlist criterion

**Condition**: Phase 10's acceptance bar requires `check_layer_boundaries` to pass with an **empty** allowlist (today it passes, but with 2 allowlisted entries, not zero).

**Current status**: NOT MET.
```
$ python manage.py check_layer_boundaries --json
{
  "status": "pass",
  "violations": [],
  "allowlisted": [
    {"path": "apps/reference/services/places_explore.py", "line": 38, "module": "apps.planner.services.geocoding"},
    {"path": "apps/reference/management/commands/backfill_city_coordinates.py", "line": 15, "module": "apps.planner.services.geocoding"}
  ],
  "strict_knowledge": false
}
```
(Run fresh for this doc — real output, not copied from an old report.) Both entries delegate to `apps.planner.services.geocoding.resolve_or_create_city`, flagged since Phase 1 as "transitional debt" pending a reference-owned (lower-layer) geocoding writer that would let both call sites drop the planner import entirely. That consolidation has not been built in any phase through Phase 9.

**What would close this gate**: build the reference-owned geocoding writer the Phase 1 decision anticipated, re-point both allowlisted call sites at it, remove the allowlist entries, confirm `check_layer_boundaries --json` reports an empty `allowlisted` list.

## Bonus finding: the "3 haversine wrappers" the plan calls dead are not dead

Phase 10's scope text says to delete "the 3 haversine wrappers." Checked fresh: `apps/reference/services/geo.py::haversine_km` (canonical), `apps/planner/services/distance_service.py::haversine_distance_km` (thin wrapper), and `apps/reference/services/places_explore.py::haversine` (thin wrapper) are **all three real, live call paths today** — `haversine_km` has 5+ direct callers across `route_graph.py`/`reconciliation.py`/`canonical_resolver.py`/management commands; `haversine_distance_km` has real callers in `journey_resolver.py`/`validation.py`/`insight_engine.py`/`route_optimizer.py`; `places_explore.py`'s `haversine` is called by its own `_distance_sort()`, the real distance-filter step for restaurant/attraction/activity/hotel explore results, and is directly exercised by `apps/reference/tests/test_geo.py`. Deleting any of the two thin wrappers without first re-pointing every one of their current callers to `haversine_km` directly would break real code — that consolidation has not happened and was not attempted here (out of scope for a status-check pass).

## What this session did instead of forcing Phase 10

- Verified all four gates fresh, with direct evidence (not trusted from prior docs).
- Confirmed and recorded a real, positive change to Gate 3's story (the route_graph latency fix) that happened via a separate background session during this same work session.
- Corrected the plan's own false "3 haversine wrappers are dead" claim before it could cause an accidental deletion of live code.
- Performed **zero deletions**, **zero `INSTALLED_APPS` changes**, **zero migration**, and did not touch `AGENTS.md`/architecture docs' "final ownership" section (meaningless to update before ownership is actually final).

## Next action

1. This status doc becomes stale the moment any one gate changes — re-run this session's two direct checks (`grep -r "apps.knowledge" backend/`, `check_layer_boundaries --json`) before trusting it in a future session, per this repo's own evidence-first discipline (D-002).
2. Gate 3 is the closest to resolvable — it now only needs an owner decision + soak period, not further engineering work.
3. Gates 1, 2, and 4 each need real, separately-scoped engineering work (a production beat-cycle confirmation; a new browse-list endpoint + frontend migration or a product retirement decision; a reference-owned geocoding writer) before they can close.
