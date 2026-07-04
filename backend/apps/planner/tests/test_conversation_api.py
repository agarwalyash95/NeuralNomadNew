from datetime import date
from unittest.mock import patch, MagicMock

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.planner.models import PlannerWorkspace
from apps.reference.models import City, Country
from seed_question_bank import seed_database


class PlannerConversationApiTests(TestCase):
    def setUp(self):
        seed_database()
        self.user = get_user_model().objects.create_user(
            email="traveler@example.com",
            password="password",
            name="Traveler",
        )
        self.country = Country.objects.create(name="Japan", code="JP", currency_code="JPY")
        City.objects.create(country=self.country, name="Tokyo")
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    @patch('apps.planner.services.conversation_engine.genai.Client')
    def test_first_chat_message_creates_workspace_lazily_and_returns_readiness(self, mock_client_class):
        from apps.planner.services.conversation_engine import ExtractedTripData
        
        mock_client = MagicMock()
        mock_client_class.return_value = mock_client
        
        mock_response = MagicMock()
        mock_response.parsed = ExtractedTripData(
            destination_text="Tokyo",
            start_date=f"{date.today().year}-10-01",
            end_date=f"{date.today().year}-10-08",
            adults=1,
            budget_tier="mid_range",
            reply="Tokyo sounds amazing! Since you are spending 7 days there, here are some nearby city recommendations.",
            widgets=["nearby_cities_recommendation"],
            confidence_score=90,
            confidence_explanation="Looking good!"
        )
        mock_client.models.generate_content.return_value = mock_response

        response = self.client.post(
            "/api/planner/chat/",
            {"message": "I want to go to Tokyo from Oct 1 to Oct 8"},
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(PlannerWorkspace.objects.count(), 1)
        self.assertTrue(response.data["ready_for_plan"])
        self.assertEqual(response.data["missing_slots"], ["optional_details", "nearby_cities"])
        self.assertEqual(response.data["draft_state"]["destination_text"], "Tokyo")
        self.assertEqual(response.data["draft_state"]["start_date"], f"{date.today().year}-10-01")
        self.assertEqual(response.data["draft_state"]["end_date"], f"{date.today().year}-10-08")
        self.assertEqual(response.data["assistant_message"]["widgets"][0]["type"], "optional_trip_details")

    @patch('apps.planner.services.conversation_engine.genai.Client')
    def test_readiness_requires_destination_and_dates(self, mock_client_class):
        from apps.planner.services.conversation_engine import ExtractedTripData
        
        mock_client = MagicMock()
        mock_client_class.return_value = mock_client
        
        mock_response = MagicMock()
        mock_response.parsed = ExtractedTripData(
            destination_text="Tokyo",
            start_date=None,
            end_date=None,
            reply="Tokyo is beautiful! When are you planning to visit?",
            widgets=["date_range_picker"],
            confidence_score=50,
            confidence_explanation="Dates are missing."
        )
        mock_client.models.generate_content.return_value = mock_response

        response = self.client.post(
            "/api/planner/chat/",
            {"message": "Tokyo sounds nice"},
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertFalse(response.data["ready_for_plan"])
        self.assertEqual(response.data["missing_slots"], ["travel_dates", "optional_details"])
        self.assertEqual(response.data["assistant_message"]["widgets"][0]["type"], "date_range_picker")

    @patch('apps.planner.services.conversation_engine.genai.Client')
    def test_first_chat_message_allows_anonymous_demo_session(self, mock_client_class):
        from apps.planner.services.conversation_engine import ExtractedTripData
        
        mock_client = MagicMock()
        mock_client_class.return_value = mock_client
        
        mock_response = MagicMock()
        mock_response.parsed = ExtractedTripData(
            destination_text="Tokyo",
            start_date=None,
            end_date=None,
            reply="Tokyo is beautiful! When are you planning to visit?",
            widgets=["date_range_picker"],
            confidence_score=50,
            confidence_explanation="Dates are missing."
        )
        mock_client.models.generate_content.return_value = mock_response

        self.client.force_authenticate(user=None)

        response = self.client.post(
            "/api/planner/chat/",
            {"message": "Tokyo sounds nice"},
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["draft_state"]["destination_text"], "Tokyo")
