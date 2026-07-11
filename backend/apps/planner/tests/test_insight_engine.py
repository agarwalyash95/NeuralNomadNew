from django.contrib.auth import get_user_model
from django.test import TestCase

from apps.planner.models import PlannerWorkspace, PlannerTrip
from apps.planner.services.insight_engine import PlanInsightEngine
from apps.reference.models import AttractionMaster, City, Country


def make_workspace_trip(user, **overrides):
    workspace = PlannerWorkspace.objects.create(user=user, title="Trip", status=PlannerWorkspace.STATUS_ACTIVE)
    defaults = dict(
        workspace=workspace,
        title="Test Trip",
        summary="",
        total_budget=10000,
        currency_code="INR",
        cities=[{"name": "Manali", "order": 1, "nights": 2}],
        days=[],
        metadata={},
    )
    defaults.update(overrides)
    trip = PlannerTrip.objects.create(**defaults)
    return workspace, trip


class InsightEngineTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            email="traveler@example.com", password="password", name="Traveler"
        )

    def _insights_for(self, days, cities=None):
        _workspace, trip = make_workspace_trip(
            self.user, days=days, cities=cities or [{"name": "Manali", "order": 1, "nights": 2}]
        )
        return PlanInsightEngine.run(trip)

    def test_schedule_gap_warning_fires_on_a_wide_gap(self):
        days = [{
            "day_number": 1,
            "date": "2026-10-15",
            "title": "Day 1",
            "city": "Manali",
            "activities": [
                {"id": "a1", "category": "attraction", "title": "Hadimba Temple", "start_time": "09:00", "end_time": "10:00"},
                {"id": "a2", "category": "food", "title": "Dinner", "start_time": "20:00"},
            ],
        }]
        insights = self._insights_for(days)
        gap = [i for i in insights if i["rule"] == "schedule_gap"]
        self.assertEqual(len(gap), 1)
        self.assertIn("Hadimba Temple", gap[0]["message"])

    def test_schedule_gap_warning_silent_on_a_tight_schedule(self):
        days = [{
            "day_number": 1,
            "date": "2026-10-15",
            "title": "Day 1",
            "city": "Manali",
            "activities": [
                {"id": "a1", "category": "attraction", "title": "Hadimba Temple", "start_time": "09:00", "end_time": "10:00"},
                {"id": "a2", "category": "food", "title": "Lunch", "start_time": "11:00"},
            ],
        }]
        insights = self._insights_for(days)
        self.assertEqual([i for i in insights if i["rule"] == "schedule_gap"], [])

    def test_checkin_mismatch_fires_when_hotel_checkin_precedes_arrival(self):
        cities = [
            {"name": "Delhi", "order": 1, "nights": 1, "transitToNext": {
                "id": "flight-1", "type": "flight", "title": "Delhi to Manali", "end_time": "18:00", "is_active": True,
            }},
            {"name": "Manali", "order": 2, "nights": 2},
        ]
        days = [
            {"day_number": 1, "date": "2026-10-15", "title": "Delhi", "city": "Delhi", "activities": []},
            {"day_number": 2, "date": "2026-10-16", "title": "Manali arrival", "city": "Manali", "activities": [
                {"id": "hotel-1", "category": "hotel", "title": "Zostel Manali", "start_time": "14:00"},
            ]},
        ]
        insights = self._insights_for(days, cities)
        mismatch = [i for i in insights if i["rule"] == "checkin_mismatch"]
        self.assertEqual(len(mismatch), 1)
        self.assertIn("Zostel Manali", mismatch[0]["message"])

    def test_checkin_mismatch_silent_when_checkin_is_after_arrival(self):
        cities = [
            {"name": "Delhi", "order": 1, "nights": 1, "transitToNext": {
                "id": "flight-1", "type": "flight", "title": "Delhi to Manali", "end_time": "10:00", "is_active": True,
            }},
            {"name": "Manali", "order": 2, "nights": 2},
        ]
        days = [
            {"day_number": 1, "date": "2026-10-15", "title": "Delhi", "city": "Delhi", "activities": []},
            {"day_number": 2, "date": "2026-10-16", "title": "Manali arrival", "city": "Manali", "activities": [
                {"id": "hotel-1", "category": "hotel", "title": "Zostel Manali", "start_time": "14:00"},
            ]},
        ]
        insights = self._insights_for(days, cities)
        self.assertEqual([i for i in insights if i["rule"] == "checkin_mismatch"], [])

    def test_late_arrival_warning_fires_on_late_landing_and_early_next_day(self):
        cities = [
            {"name": "Delhi", "order": 1, "nights": 1, "transitToNext": {
                "id": "flight-1", "type": "flight", "title": "Delhi to Manali", "end_time": "23:30", "is_active": True,
            }},
            {"name": "Manali", "order": 2, "nights": 2},
        ]
        days = [
            {"day_number": 1, "date": "2026-10-15", "title": "Delhi", "city": "Delhi", "activities": []},
            {"day_number": 2, "date": "2026-10-16", "title": "Manali", "city": "Manali", "activities": [
                {"id": "act-1", "category": "attraction", "title": "Solang Valley", "start_time": "08:00"},
            ]},
        ]
        insights = self._insights_for(days, cities)
        late = [i for i in insights if i["rule"] == "late_arrival"]
        self.assertEqual(len(late), 1)
        self.assertIn("Solang Valley", late[0]["message"])

    def test_opening_hours_conflict_fires_when_scheduled_while_closed(self):
        country = Country.objects.create(name="India", code="IN")
        city = City.objects.create(name="Manali", country=country)
        attraction = AttractionMaster.objects.create(
            city=city,
            name="Hadimba Temple",
            opening_hours=[
                "Monday: 9:00 AM – 6:00 PM",
                "Tuesday: 9:00 AM – 6:00 PM",
                "Wednesday: 9:00 AM – 6:00 PM",
                "Thursday: 9:00 AM – 6:00 PM",
                "Friday: 9:00 AM – 6:00 PM",
                "Saturday: 9:00 AM – 6:00 PM",
                "Sunday: 9:00 AM – 6:00 PM",
            ],
        )
        # 2026-10-15 is a Thursday
        days = [{
            "day_number": 1,
            "date": "2026-10-15",
            "title": "Day 1",
            "city": "Manali",
            "activities": [{
                "id": "a1",
                "category": "attraction",
                "title": "Hadimba Temple",
                "start_time": "20:00",
                "metadata": {"master_ref": {"table": "attraction", "id": attraction.pk}},
            }],
        }]
        insights = self._insights_for(days)
        conflict = [i for i in insights if i["rule"] == "opening_hours_conflict"]
        self.assertEqual(len(conflict), 1)
        self.assertIn("Hadimba Temple", conflict[0]["message"])

    def test_opening_hours_conflict_silent_when_scheduled_while_open(self):
        country = Country.objects.create(name="India", code="IN")
        city = City.objects.create(name="Manali", country=country)
        attraction = AttractionMaster.objects.create(
            city=city,
            name="Hadimba Temple",
            opening_hours=["Thursday: 9:00 AM – 6:00 PM"] * 7,
        )
        days = [{
            "day_number": 1,
            "date": "2026-10-15",
            "title": "Day 1",
            "city": "Manali",
            "activities": [{
                "id": "a1",
                "category": "attraction",
                "title": "Hadimba Temple",
                "start_time": "11:00",
                "metadata": {"master_ref": {"table": "attraction", "id": attraction.pk}},
            }],
        }]
        insights = self._insights_for(days)
        self.assertEqual([i for i in insights if i["rule"] == "opening_hours_conflict"], [])
