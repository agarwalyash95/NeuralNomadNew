# Cache Key Registry (Phase 9, master plan §14 P9)

`CACHES["default"]` is `django_redis.cache.RedisCache` (`backend/config/settings/base.py:398-416`, `REDIS_URL` env, DB 0 — Celery uses DBs 1/2, kept separate) with `IGNORE_EXCEPTIONS: True` (a Redis outage degrades to a permanent cache miss, never a 500). This registry catalogs every real cache key namespace in use today, so a new one doesn't collide and so anyone debugging a stale-data report knows exactly where to look.

## Existing key namespaces (all plain get-then-set-on-miss with a flat TTL — none is stale-while-revalidate)

| Key pattern | File | TTL | Purpose |
|---|---|---|---|
| `place-photo:{photo_ref}:{max_w}x{max_h}` | `apps/reference/views.py:486` (`PlacePhotoProxyView`) | `self._CACHE_TIMEOUT` | Proxies Google Places photo bytes so the API key never reaches the browser. |
| `planner:ratelimit:{scope}:{user.id}` | `apps/planner/views.py:218` | `window_seconds` (caller-supplied) | Fixed-window rate-limit counter, per (scope, user) — real accounts and anonymous sessions limited independently. |
| `rec_explain:{sha256(prompt)[:20]}` | `apps/planner/views.py:1469` | 1800s (30 min) | Caches a recommendation-explanation LLM result keyed by its exact prompt hash. |
| `progressive_warm:{workspace_id}:{input_hash}` | `apps/planner/services/intelligence/progressive.py:42` | `_WARM_TTL_SECONDS` = 1200s (20 min) | Warm progressive-intelligence artifact for a workspace, keyed by a canonical-context fingerprint (`input_hash()`, same module) so a changed draft naturally misses. |
| `progressive_warm_inflight:{workspace_id}` | `apps/planner/services/intelligence/progressive.py:46` | `_INFLIGHT_TTL_SECONDS` = 300s (5 min) | Dedup flag preventing duplicate concurrent warm-artifact computation for the same workspace. |
| `journey_feed_facts:{destination.lower()}` | `apps/planner/services/intelligence/journey_feed.py:56` | `_CACHE_TTL_SECONDS` = 30 days | Destination-level facts that "don't go stale" per the module's own comment. |

## What Phase 9 explored but did not build: stale-while-revalidate for suggestions

The master plan's own wording is "explore," not "ship" — and this is genuinely greenfield: every site above is plain read-then-write-on-miss, no background-refresh pattern exists anywhere in this codebase today.

**Where it would hook in**: `apps/reference/services/places_explore.py::explore_places()` — today's "cache" for hotel/restaurant/attraction/activity suggestions is DB-as-cache (`publishable(model.objects.filter(city=city_obj))`, `MIN_CACHE_RESULTS = 5` gates a live Google Places fetch), not Redis. A real SWR layer would sit in front of that function:

1. **Key**: `explore:{category}:{city_id}:{radius_km}` (or a hash of the same, if `radius_km` needs float-safe keying).
2. **On request**: serve the Redis-cached suggestion list immediately if present, regardless of freshness.
3. **Freshness check**: if the cached entry's age exceeds a threshold (shorter than `EnrichmentMixin.enrichment_ttl_days`, since this is a request-path cache, not the DB row's own staleness), enqueue a Celery task to re-run `explore_places()` for that (category, city) pair and refresh the Redis entry — the request itself never blocks on this.
4. **Cold start**: no cached entry yet → fall through to today's synchronous `explore_places()` call (unchanged), then populate the new Redis key.

**Why not built this phase**: turning `places_explore.py`'s DB-as-cache pattern into a real Redis SWR layer touches a request path every `explore()` action (4 ViewSets) and `resolve_places()` (planner's `_grow_pool_via_places`) depends on — a materially larger, riskier change than one phase's "explore" scope, and one that deserves its own dedicated implementation + verification pass, not a same-day addition alongside a dashboard and two audit scripts. Recorded here as the concrete design for whenever that pass happens.

## Materialized route summaries — decision recorded, not built

The master plan's own trigger ("ONLY if P4 latency targets missed") was met at the time Phase 9 started — Phase 8's benchmark found `route_graph.search()` median latency ~8s. **That trigger condition no longer holds**: a same-day follow-up (`task_ab02ca90`, see `docs/plans/phases/phase-08-perf-fix-station-selector-n-plus-1.md`) root-caused and fixed the underlying `station_selector` N+1 bug, bringing real p50 down to ~55ms and p95 to ~78ms — both comfortably under `benchmark_geo_queries.py`'s own 150ms p95 adoption-trigger threshold. Decision recorded: **materialized route summaries are not needed on current evidence** — the underlying function is fast now that its real defect is fixed; adding a precompute/materialization layer on top would be solving a problem that no longer exists. Revisit only if a future, larger-scale benchmark shows real latency creeping back up.
