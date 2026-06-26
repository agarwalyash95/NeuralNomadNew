"""
Workspace Event Bus — synchronous pub/sub within a request lifecycle.
All planner modules communicate through events, never directly.
"""

import logging
from collections import defaultdict
from typing import Callable, Any

logger = logging.getLogger(__name__)


class WorkspaceEventType:
    """All workspace event types."""
    # Context events
    CONTEXT_UPDATED = 'context.updated'
    DATES_CHANGED = 'dates.changed'
    BUDGET_CHANGED = 'budget.changed'
    TRAVELERS_CHANGED = 'travelers.changed'

    # Canvas events
    CANVAS_OPENED = 'canvas.opened'
    CANVAS_CLOSED = 'canvas.closed'
    CANVAS_FOCUSED = 'canvas.focused'

    # Item events
    ITEM_SELECTED = 'item.selected'
    ITEM_REMOVED = 'item.removed'
    ITEM_MODIFIED = 'item.modified'

    # Timeline events
    ACTIVITY_ADDED = 'activity.added'
    ACTIVITY_REMOVED = 'activity.removed'
    ACTIVITY_MOVED = 'activity.moved'
    ACTIVITY_REORDERED = 'activity.reordered'

    # Plan events
    PLAN_RECALCULATED = 'plan.recalculated'
    ROUTE_UPDATED = 'route.updated'
    CONFLICT_DETECTED = 'conflict.detected'
    CONFLICT_RESOLVED = 'conflict.resolved'

    # Recommendation events
    RECOMMENDATION_GENERATED = 'recommendation.generated'
    RECOMMENDATION_ACCEPTED = 'recommendation.accepted'
    RECOMMENDATION_DISMISSED = 'recommendation.dismissed'


class WorkspaceEventBus:
    """
    Synchronous event bus — handlers execute in sequence within a request.
    Thread-safe singleton pattern.
    """

    def __init__(self):
        self._handlers: dict[str, list[Callable]] = defaultdict(list)

    def subscribe(self, event_type: str, handler: Callable):
        """Register a handler for an event type."""
        self._handlers[event_type].append(handler)
        logger.debug(f"EventBus: {handler.__name__} subscribed to {event_type}")

    def publish(self, workspace_id: str, event_type: str, payload: dict[str, Any] | None = None):
        """Publish event → all registered handlers execute in sequence."""
        payload = payload or {}
        logger.info(f"EventBus: Publishing {event_type} for workspace {workspace_id}")

        for handler in self._handlers.get(event_type, []):
            try:
                handler(workspace_id, payload)
            except Exception as e:
                logger.error(f"EventBus: Handler {handler.__name__} failed on {event_type}: {e}")

    def clear(self):
        """Clear all subscriptions (for testing)."""
        self._handlers.clear()


# Module-level singleton
event_bus = WorkspaceEventBus()


def register_default_handlers():
    """
    Register all engine event subscriptions.
    Called from PlannerConfig.ready().
    """
    from .timeline_engine import TimelineEngine
    from .budget_engine import BudgetEngine
    from .conflict_detector import ConflictDetector

    timeline = TimelineEngine()
    budget = BudgetEngine()
    conflict = ConflictDetector()

    # Timeline listens to item selections, activity moves, and date changes
    event_bus.subscribe(WorkspaceEventType.ITEM_SELECTED, timeline.on_item_selected)
    event_bus.subscribe(WorkspaceEventType.ACTIVITY_MOVED, timeline.on_activity_moved)
    event_bus.subscribe(WorkspaceEventType.DATES_CHANGED, timeline.on_dates_changed)

    # Budget listens to item selections and removals
    event_bus.subscribe(WorkspaceEventType.ITEM_SELECTED, budget.on_item_selected)
    event_bus.subscribe(WorkspaceEventType.ITEM_REMOVED, budget.on_item_removed)
    event_bus.subscribe(WorkspaceEventType.ITEM_MODIFIED, budget.on_item_modified)

    # Conflict detector listens to activity changes
    event_bus.subscribe(WorkspaceEventType.ACTIVITY_ADDED, conflict.on_activity_changed)
    event_bus.subscribe(WorkspaceEventType.ACTIVITY_MOVED, conflict.on_activity_changed)
    event_bus.subscribe(WorkspaceEventType.DATES_CHANGED, conflict.on_dates_changed)

    logger.info("EventBus: Default handlers registered")
