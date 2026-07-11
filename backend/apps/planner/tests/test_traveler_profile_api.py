from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.planner.models import TravelerProfile


class TravelerProfilePreferenceApiTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            email="traveler@example.com", password="password", name="Traveler"
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def test_put_sets_transport_preference_fact(self):
        response = self.client.put(
            "/api/planner/profile/",
            {"transport_preference": {"priority": "fastest", "avoid_flights": True}},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        facts = response.data["facts"]
        pref = next(f for f in facts if f["key"] == "transport_preference")
        self.assertEqual(pref["value"], {"priority": "fastest", "avoid_flights": True})
        self.assertEqual(pref["provenance"], "stated")

        profile = TravelerProfile.objects.get(user=self.user)
        stored = next(f for f in profile.facts if f["key"] == "transport_preference")
        self.assertEqual(stored["value"]["priority"], "fastest")

    def test_put_without_preference_body_is_rejected(self):
        response = self.client.put("/api/planner/profile/", {}, format="json")
        self.assertEqual(response.status_code, 400)

    def test_put_then_get_roundtrips(self):
        self.client.put(
            "/api/planner/profile/",
            {"transport_preference": {"priority": "cheapest"}},
            format="json",
        )
        response = self.client.get("/api/planner/profile/")
        self.assertEqual(response.status_code, 200)
        pref = next(f for f in response.data["facts"] if f["key"] == "transport_preference")
        self.assertEqual(pref["value"], {"priority": "cheapest"})

    def test_put_overwrites_previous_stated_preference(self):
        self.client.put("/api/planner/profile/", {"transport_preference": {"priority": "cheapest"}}, format="json")
        self.client.put("/api/planner/profile/", {"transport_preference": {"priority": "comfort"}}, format="json")
        profile = TravelerProfile.objects.get(user=self.user)
        matches = [f for f in profile.facts if f["key"] == "transport_preference"]
        self.assertEqual(len(matches), 1)
        self.assertEqual(matches[0]["value"]["priority"], "comfort")
