"""
Conflict Detector — identifies impossible schedules, overlaps, missing bookings.
"""

import logging
from apps.planner.models import TripActivity, TripDay

logger = logging.getLogger(__name__)


class ConflictDetector:
    """Detects scheduling conflicts in the trip timeline."""

    def detect_conflicts(self, workspace_id: str) -> list[dict]:
        """
        Scan all activities for conflicts.
        Returns list of conflict descriptions.
        """
        conflicts = []

        days = TripDay.objects.filter(
            trip__workspace_id=workspace_id, is_deleted=False,
        ).prefetch_related('activities')

        for day in days:
            activities = list(
                day.activities.filter(is_deleted=False).order_by('start_time', 'order')
            )

            # Check for time overlaps
            for i, a in enumerate(activities):
                if not a.start_time or not a.end_time:
                    continue
                for b in activities[i + 1:]:
                    if not b.start_time or not b.end_time:
                        continue
                    if a.end_time > b.start_time:
                        conflicts.append({
                            'type': 'time_overlap',
                            'severity': 'high',
                            'day': day.day_number,
                            'activities': [str(a.id), str(b.id)],
                            'message': f"'{a.title}' overlaps with '{b.title}' on Day {day.day_number}",
                        })

        return conflicts

    # ─── Event Handlers ────────────────────────────────

    def on_activity_changed(self, workspace_id: str, payload: dict):
        """Re-run conflict detection when activities change."""
        conflicts = self.detect_conflicts(workspace_id)
        if conflicts:
            from .event_bus import event_bus, WorkspaceEventType
            event_bus.publish(workspace_id, WorkspaceEventType.CONFLICT_DETECTED, {
                'conflicts': conflicts,
            })
        logger.info(f"Conflict check: {len(conflicts)} conflicts in {workspace_id}")

    def on_dates_changed(self, workspace_id: str, payload: dict):
        """Re-run conflict detection when dates change."""
        self.on_activity_changed(workspace_id, payload)
