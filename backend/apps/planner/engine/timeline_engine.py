from apps.planner.models import PlannerTrip, TripCity, TripDay, TripActivity
from apps.planner.engine.event_bus import EventBus, Events

class TimelineEngine:
    """
    Manages the chronological layout of a trip.
    """
    @staticmethod
    def add_activity_to_day(trip_day, title, category, start_time=None, cost=None, thumbnail_url=None):
        activity = TripActivity.objects.create(
            trip_day=trip_day,
            title=title,
            category=category,
            start_time=start_time,
            cost=cost,
            thumbnail_url=thumbnail_url
        )
        # Recalculate ordering
        TimelineEngine.recalculate_day_ordering(trip_day)
        
        EventBus.publish(Events.ACTIVITY_ADDED, activity_id=activity.id)
        return activity

    @staticmethod
    def recalculate_day_ordering(trip_day):
        # Sort by start_time (nulls last) then by current order
        activities = list(trip_day.activities.all())
        activities.sort(key=lambda a: (a.start_time is None, a.start_time, a.order))
        
        for index, activity in enumerate(activities):
            if activity.order != index:
                activity.order = index
                activity.save(update_fields=['order'])

    @staticmethod
    def generate_days_for_city(trip_city):
        if not trip_city.start_date or not trip_city.end_date:
            return
            
        delta = trip_city.end_date - trip_city.start_date
        for i in range(delta.days + 1):
            date = trip_city.start_date + timedelta(days=i)
            TripDay.objects.get_or_create(trip_city=trip_city, date=date, defaults={'day_index': i + 1})
