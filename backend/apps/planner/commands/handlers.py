"""
Command handlers — thin wrappers that map command types to engine actions.

These handlers are registered in the CommandExecutor at startup.
Each handler receives (workspace_id, payload) and delegates to the
appropriate engine module.
"""

import logging
from apps.planner.models import (
    PlannerWorkspace, CanvasInstance, BookingOrder,
    PlannerTrip, TripActivity,
)
from apps.planner.engine.event_bus import event_bus, WorkspaceEventType

logger = logging.getLogger(__name__)


# ─── Activity Handlers ──────────────────────────────

def handle_add_activity(workspace_id: str, payload: dict) -> dict:
    """Add an activity to the timeline via the TimelineEngine."""
    from apps.planner.engine.timeline_engine import TimelineEngine
    engine = TimelineEngine()
    activity = engine.add_activity(
        workspace_id=workspace_id,
        day_number=payload.get('day_number', 1),
        activity_data={
            'title': payload.get('title', 'New Activity'),
            'category': payload.get('category', 'general'),
            'location_name': payload.get('location_name', ''),
            'start_time': payload.get('start_time'),
            'end_time': payload.get('end_time'),
            'duration_minutes': payload.get('duration_minutes', 60),
            'estimated_cost': payload.get('estimated_cost', 0),
        },
    )
    return {'activity_id': str(activity.id) if activity else None}


def handle_remove_activity(workspace_id: str, payload: dict) -> dict:
    """Remove an activity from the timeline."""
    activity_id = payload.get('activity_id')
    if not activity_id:
        return {'error': 'activity_id required'}

    try:
        activity = TripActivity.objects.get(id=activity_id)
        activity.is_deleted = True
        activity.save(update_fields=['is_deleted'])

        event_bus.publish(workspace_id, WorkspaceEventType.ACTIVITY_REMOVED, {
            'activity_id': str(activity_id),
        })
        return {'removed': True}
    except TripActivity.DoesNotExist:
        return {'error': 'Activity not found'}


def handle_move_activity(workspace_id: str, payload: dict) -> dict:
    """Move an activity to a different position or day."""
    activity_id = payload.get('activity_id')
    new_order = payload.get('new_order')
    new_day = payload.get('new_day')

    if not activity_id:
        return {'error': 'activity_id required'}

    try:
        activity = TripActivity.objects.get(id=activity_id)
        if new_order is not None:
            activity.order = new_order
        activity.save()

        event_bus.publish(workspace_id, WorkspaceEventType.ACTIVITY_MOVED, {
            'activity_id': str(activity_id),
            'new_order': new_order,
            'new_day': new_day,
        })
        return {'moved': True}
    except TripActivity.DoesNotExist:
        return {'error': 'Activity not found'}


# ─── Cart Handlers ──────────────────────────────────

def handle_add_to_cart(workspace_id: str, payload: dict) -> dict:
    """Add an item to the booking cart."""
    workspace = PlannerWorkspace.objects.get(id=workspace_id)

    order = BookingOrder.objects.create(
        workspace=workspace,
        item_type=payload.get('item_type', 'general'),
        source_canvas=payload.get('source_canvas', ''),
        title=payload.get('title', 'Booking Item'),
        provider=payload.get('provider', ''),
        price=payload.get('price', 0),
        currency_code=payload.get('currency_code', 'INR'),
        metadata=payload.get('metadata', {}),
    )

    event_bus.publish(workspace_id, WorkspaceEventType.ITEM_SELECTED, {
        'order_id': str(order.id),
        'item_type': order.item_type,
    })

    return {'order_id': str(order.id)}


# ─── Canvas Shortcut Handlers ───────────────────────

def handle_check_visa(workspace_id: str, payload: dict) -> dict:
    """Open the visa canvas."""
    canvas, _ = CanvasInstance.objects.get_or_create(
        workspace_id=workspace_id,
        canvas_type='visa',
        defaults={'lifecycle_state': 'expanded', 'is_active': True},
    )
    if not canvas.is_active:
        canvas.is_active = True
        canvas.lifecycle_state = 'expanded'
        canvas.save()

    event_bus.publish(workspace_id, WorkspaceEventType.CANVAS_OPENED, {
        'canvas_type': 'visa',
    })
    return {'canvas_type': 'visa', 'state': 'expanded'}


def handle_check_forex(workspace_id: str, payload: dict) -> dict:
    """Open the forex canvas."""
    canvas, _ = CanvasInstance.objects.get_or_create(
        workspace_id=workspace_id,
        canvas_type='forex',
        defaults={'lifecycle_state': 'expanded', 'is_active': True},
    )
    if not canvas.is_active:
        canvas.is_active = True
        canvas.lifecycle_state = 'expanded'
        canvas.save()

    event_bus.publish(workspace_id, WorkspaceEventType.CANVAS_OPENED, {
        'canvas_type': 'forex',
    })
    return {'canvas_type': 'forex', 'state': 'expanded'}
