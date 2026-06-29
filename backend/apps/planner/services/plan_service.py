from apps.planner.engine.timeline_engine import TimelineEngine
from apps.planner.models import TripCity

class PlanService:
    @staticmethod
    def add_city_to_trip(workspace, city_id, start_date=None, end_date=None):
        trip = workspace.trip
        order = trip.cities.count()
        trip_city = TripCity.objects.create(
            trip=trip,
            city_id=city_id,
            order=order,
            start_date=start_date,
            end_date=end_date
        )
        if start_date and end_date:
            TimelineEngine.generate_days_for_city(trip_city)
        return trip_city
