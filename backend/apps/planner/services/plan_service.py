"""
Plan Service — Trip and journey CRUD.
"""

import logging
from apps.planner.models import PlannerTrip, TripCity, TripDay, TripActivity

logger = logging.getLogger(__name__)


class PlanService:
    """Manages trip plan CRUD operations."""

    def get_full_plan(self, workspace_id: str) -> dict:
        """Get complete trip plan with cities, days, and activities."""
        try:
            trip = PlannerTrip.objects.get(workspace_id=workspace_id)
        except PlannerTrip.DoesNotExist:
            return {}

        cities = list(
            trip.cities.filter(is_deleted=False).order_by('order').values(
                'id', 'name', 'country', 'latitude', 'longitude',
                'order', 'nights', 'arrival_date', 'departure_date',
            )
        )

        days = []
        for day in trip.days.filter(is_deleted=False).order_by('day_number'):
            activities = list(
                day.activities.filter(is_deleted=False).order_by('order').values(
                    'id', 'title', 'category', 'location_name',
                    'latitude', 'longitude', 'start_time', 'end_time',
                    'duration_minutes', 'estimated_cost', 'currency_code',
                    'status', 'order', 'notes',
                )
            )
            days.append({
                'id': str(day.id),
                'day_number': day.day_number,
                'date': str(day.date) if day.date else None,
                'title': day.title,
                'day_type': day.day_type,
                'activities': activities,
            })

        return {
            'id': str(trip.id),
            'title': trip.title,
            'summary': trip.summary,
            'total_budget': float(trip.total_budget) if trip.total_budget else None,
            'spent_budget': float(trip.spent_budget),
            'currency_code': trip.currency_code,
            'cities': cities,
            'days': days,
        }
