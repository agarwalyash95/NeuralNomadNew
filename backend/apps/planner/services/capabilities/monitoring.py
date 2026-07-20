"""
Monitoring capabilities (docs/conversation-capability-layer.md §9).

`monitor_price` is the MVP here — it reuses the EXISTING PriceWatch model +
`_run_price_watches` Celery task (apps/planner/models.py, apps/planner/tasks.py,
already on CELERY_BEAT_SCHEDULE every 30 min) unchanged. Arming a watch from
chat is just another way to create the same row the Workspace's "watch this
price" button already creates — no new model, migration, or task.

Weather/route monitoring already runs unconditionally for every active
workspace via apps.planner.tasks._run_trip_watch (every 15 min) — there is
nothing to "arm" there; it's always on. Flight/train status monitors are
deliberately NOT built here: no live flight/train status source is wired
anywhere in this codebase (apps.planner.services.live_status only has
weather), so a "Monitor Flight" record could never produce a real finding —
building that scaffolding now would be dead weight until a live source
exists (honest-degrade, not a half-finished feature).
"""

from apps.planner.services.capabilities.base import capability_envelope


def monitor_price(workspace, title_fragment, **_):
    from apps.planner.models import PriceWatch
    # Reuses the same safe, ambiguity-averse block resolver the chat re-time
    # edit path already relies on (docs/ai-chat-implementation-plan.md §7.4):
    # a unique confident match or nothing — never a guessed wrong block.
    from apps.planner.services.chat_edit_intents import _find_unique_active_block

    trip = getattr(workspace, "trip", None) if workspace is not None else None
    if trip is None:
        return capability_envelope(
            "monitor_price", {"title_fragment": title_fragment}, freshness="derived",
            degraded=True, degraded_reason="There's no generated plan yet to watch a price on.",
        )

    if not title_fragment:
        return capability_envelope(
            "monitor_price", {}, freshness="derived", degraded=True,
            degraded_reason="Tell me which item to watch (e.g. \"watch the hotel price\").",
        )

    match = _find_unique_active_block(trip, title_fragment)
    if match is None:
        return capability_envelope(
            "monitor_price", {"title_fragment": title_fragment}, freshness="derived", degraded=True,
            degraded_reason=f'Couldn\'t uniquely match "{title_fragment}" to one plan item — try naming it more specifically.',
        )

    _day, block = match
    PriceWatch.objects.update_or_create(
        workspace=workspace,
        block_id=str(block.get("id")),
        defaults={"active": True, "last_price": (block.get("cost") or {}).get("amount")},
    )
    return capability_envelope("monitor_price", {
        "block_title": block.get("title"),
        "block_id": str(block.get("id")),
        "armed": True,
    }, freshness="derived")
