from datetime import date

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.planner.models import PlannerWorkspace
from apps.reference.models import City, Country


class PlannerConversationApiTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            email="traveler@example.com",
            password="password",
            name="Traveler",
        )
        self.country = Country.objects.create(name="Japan", code="JP", currency_code="JPY")
        City.objects.create(country=self.country, name="Tokyo")
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def test_first_chat_message_creates_workspace_lazily_and_returns_readiness(self):
        response = self.client.post(
            "/api/planner/chat/",
            {"message": "I want to go to Tokyo from Oct 1 to Oct 8"},
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(PlannerWorkspace.objects.count(), 1)
        self.assertTrue(response.data["ready_for_plan"])
        self.assertEqual(response.data["missing_slots"], [])
        self.assertEqual(response.data["draft_state"]["destination_text"], "Tokyo")
        self.assertEqual(response.data["draft_state"]["start_date"], f"{date.today().year}-10-01")
        self.assertEqual(response.data["draft_state"]["end_date"], f"{date.today().year}-10-08")
        self.assertEqual(response.data["assistant_message"]["widgets"][0]["type"], "nearby_cities_recommendation")

    def test_readiness_requires_destination_and_dates(self):
        response = self.client.post(
            "/api/planner/chat/",
            {"message": "Tokyo sounds nice"},
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertFalse(response.data["ready_for_plan"])
        self.assertEqual(response.data["missing_slots"], ["travel_dates"])
        self.assertEqual(response.data["assistant_message"]["widgets"][0]["type"], "date_range_picker")

    def test_first_chat_message_allows_anonymous_demo_session(self):
        self.client.force_authenticate(user=None)

        response = self.client.post(
            "/api/planner/chat/",
            {"message": "Tokyo sounds nice"},
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["draft_state"]["destination_text"], "Tokyo")
