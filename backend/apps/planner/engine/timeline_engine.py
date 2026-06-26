"""
Timeline Engine — builds, recalculates, and maintains the event stream.
"""

import logging
from apps.planner.models import (
    PlannerWorkspace, PlannerTrip, TripDay, TripActivity,
    ActivityStatus, DayType,
)
from .event_bus import event_bus, WorkspaceEventType

logger = logging.getLogger(__name__)


class TimelineEngine:
    """Manages the trip timeline as an event stream."""

    def add_activity(self, workspace_id: str, day_id: str, activity_data: dict) -> TripActivity:
        """Add an activity to a day in the timeline."""
        day = TripDay.objects.get(id=day_id)

        # Get the next order number
        max_order = day.activities.aggregate(
            max_order=models.Max('order')
        )['max_order'] or 0

        activity = TripActivity.objects.create(
            day=day,
            title=activity_data.get('title', 'Untitled'),
            category=activity_data.get('category', 'other'),
            location_name=activity_data.get('location_name', ''),
            latitude=activity_data.get('latitude'),
            longitude=activity_data.get('longitude'),
            start_time=activity_data.get('start_time'),
            end_time=activity_data.get('end_time'),
            duration_minutes=activity_data.get('duration_minutes'),
            estimated_cost=activity_data.get('estimated_cost'),
            currency_code=activity_data.get('currency_code', 'INR'),
            notes=activity_data.get('notes', ''),
            order=max_order + 1,
        )

        event_bus.publish(workspace_id, WorkspaceEventType.ACTIVITY_ADDED, {
            'activity_id': str(activity.id),
            'day_id': str(day_id),
            'category': activity.category,
        })

        logger.info(f"Activity '{activity.title}' added to Day {day.day_number}")
        return activity

    def reorder_activities(self, workspace_id: str, day_id: str, activity_ids: list[str]):
        """Reorder activities within a day (drag-drop support)."""
        for order, activity_id in enumerate(activity_ids):
            TripActivity.objects.filter(id=activity_id, day_id=day_id).update(order=order)

        event_bus.publish(workspace_id, WorkspaceEventType.ACTIVITY_REORDERED, {
            'day_id': str(day_id),
            'new_order': activity_ids,
        })

    def build_initial_timeline(self, workspace_id: str, cities: list[dict], start_date=None):
        """Build initial trip timeline from cities and dates."""
        workspace = PlannerWorkspace.objects.get(id=workspace_id)
        trip, _ = PlannerTrip.objects.get_or_create(
            workspace=workspace,
            defaults={'title': workspace.title},
        )

        day_number = 0

        # Preparation day
        day_number += 1
        TripDay.objects.get_or_create(
            trip=trip, day_number=day_number,
            defaults={
                'title': 'Preparation',
                'day_type': DayType.PREPARATION,
                'date': start_date,
            },
        )

        logger.info(f"Initial timeline built for workspace {workspace_id} with {day_number} days")
        return trip

    # ─── Event Handlers ────────────────────────────────

    def on_item_selected(self, workspace_id: str, payload: dict):
        """Handle item selection — add to timeline."""
        logger.info(f"Timeline: Item selected in workspace {workspace_id}")

    def on_activity_moved(self, workspace_id: str, payload: dict):
        """Handle activity move — recalculate times."""
        logger.info(f"Timeline: Activity moved in workspace {workspace_id}")

    def on_dates_changed(self, workspace_id: str, payload: dict):
        """Handle date changes — recalculate timeline."""
        logger.info(f"Timeline: Dates changed in workspace {workspace_id}")


# Fix the missing import
from django.db import models
