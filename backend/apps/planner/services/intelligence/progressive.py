"""
Progressive planning — background warm-up so Create Plan feels near-instant
(docs/ai-chat-implementation-plan.md Phase 8.1).

Once a conversation's core slots (destination + dates) are known, we warm
phases 1-2 of the generation pipeline — `_generate_skeleton` (an LLM call)
and `_resolve_cities` (geocoding) — on a daemon thread, the same pattern
`plan_generation.spawn_generation_thread` already uses. The result is cached
by an input hash; `plan_generation.run_pipeline` checks for a fresh matching
artifact and reuses it instead of recomputing. A stale hash (destination,
dates, travelers, budget tier, or transport mode changed since warming)
simply falls through to a normal full run — never a correctness risk, only
a latency win when it hits.

Deliberately does NOT cache phase 3 (candidate pools): those are Django
model instances, cheap to (re)fetch (a handful of indexed queries, no LLM
call), and caching them safely across cache backends would need a
serialization layer this optimization doesn't need to earn its keep.
"""

import hashlib
import json
import logging
import threading
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

_WARM_TTL_SECONDS = 60 * 20  # 20 minutes — comfortably covers the rest of a typical conversation
_INFLIGHT_TTL_SECONDS = 60 * 5


def input_hash(draft) -> str:
    """Fingerprint the complete canonical generation context."""
    from apps.planner.services.plan_context import PlanContextBuilder

    key = PlanContextBuilder.fingerprint_payload(draft)
    raw = json.dumps(key, sort_keys=True, default=str)
    return hashlib.sha256(raw.encode()).hexdigest()[:24]


def _artifact_cache_key(workspace_id, h: str) -> str:
    return f"progressive_warm:{workspace_id}:{h}"


def _inflight_cache_key(workspace_id) -> str:
    return f"progressive_warm_inflight:{workspace_id}"


def get_warm_artifact(workspace, h: str) -> Optional[Dict[str, Any]]:
    from django.core.cache import cache

    return cache.get(_artifact_cache_key(workspace.id, h))


def _run_warm(workspace_id, h: str) -> None:
    from django.core.cache import cache
    from django.db import close_old_connections

    # Thread entry point — same connection-management discipline as
    # plan_generation.run_generation_job's daemon-thread path: this thread
    # gets its own DB connection and must not leak it.
    close_old_connections()
    try:
        from apps.planner.models import PlannerWorkspace
        from apps.planner.services.plan_generation import _generate_skeleton, _resolve_cities

        workspace = PlannerWorkspace.objects.select_related("draft_state").get(id=workspace_id)
        draft = workspace.draft_state
        if not draft or input_hash(draft) != h:
            return  # draft moved on while the thread was starting

        skeleton = _generate_skeleton(draft)
        city_objs = _resolve_cities(skeleton["cities"], draft)
        artifact = {
            "skeleton": skeleton,
            "city_ids": {name: c.id for name, c in city_objs.items()},
        }
        cache.set(_artifact_cache_key(workspace_id, h), artifact, _WARM_TTL_SECONDS)
    except Exception as exc:
        logger.warning("[Progressive] warm-up failed (non-fatal): %s", exc)
    finally:
        cache.delete(_inflight_cache_key(workspace_id))
        close_old_connections()


def trigger_warm_plan(workspace) -> Optional[threading.Thread]:
    """Best-effort, throttled background warm-up. Never raises, never blocks
    the calling turn — at most one concurrent warm per workspace, and the
    same hash is never warmed twice. Returns the spawned Thread (callers
    ignore it; tests use it to wait for the warm-up to fully finish, same
    as plan_generation.spawn_generation_thread's return value)."""
    from django.core.cache import cache

    draft = getattr(workspace, "draft_state", None)
    if not draft or not draft.destination_text or not (draft.start_date and draft.end_date):
        return None
    try:
        h = input_hash(draft)
        if get_warm_artifact(workspace, h) is not None:
            return None
        if cache.get(_inflight_cache_key(workspace.id)):
            return None
        cache.set(_inflight_cache_key(workspace.id), h, _INFLIGHT_TTL_SECONDS)
        thread = threading.Thread(target=_run_warm, args=(workspace.id, h), daemon=True)
        thread.start()
        return thread
    except Exception as exc:
        logger.warning("[Progressive] trigger_warm_plan failed (non-fatal): %s", exc)
        return None
