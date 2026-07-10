from datetime import date
from unittest.mock import MagicMock, patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.planner.models import PlannerWorkspace
from apps.reference.models import City, Country
from seed_question_bank import seed_database


def parse_sse(content: bytes):
    """[(event, json-string)] from a raw SSE body."""
    events = []
    for raw in content.decode("utf-8").split("\n\n"):
        if not raw.strip():
            continue
        event, data = "message", None
        for line in raw.split("\n"):
            if line.startswith("event:"):
                event = line[6:].strip()
            elif line.startswith("data:"):
                data = line[5:].strip()
        events.append((event, data))
    return events


class ChatStreamApiTests(TestCase):
    def setUp(self):
        seed_database()
        self.user = get_user_model().objects.create_user(
            email="traveler@example.com", password="password", name="Traveler"
        )
        country = Country.objects.create(name="Japan", code="JP", currency_code="JPY")
        City.objects.create(country=country, name="Tokyo")
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    @patch("apps.planner.services.conversation_engine.genai.Client")
    def test_lazy_stream_emits_state_tokens_widgets_done(self, mock_client_class):
        import json

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
            reply="Tokyo sounds amazing! Here are some nearby city recommendations for your seven day adventure.",
            widgets=["nearby_cities_recommendation"],
            confidence_score=90,
            confidence_explanation="Looking good!",
        )
        mock_client.models.generate_content.return_value = mock_response

        response = self.client.post(
            "/api/planner/chat/stream/",
            {"message": "I want to go to Tokyo from Oct 1 to Oct 8"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "text/event-stream")

        body = b"".join(response.streaming_content)
        events = parse_sse(body)
        kinds = [e for e, _ in events]

        self.assertEqual(kinds[0], "state")
        self.assertIn("token", kinds)
        self.assertIn("widgets", kinds)
        self.assertEqual(kinds[-1], "done")

        # Token chunks reassemble into exactly the persisted reply
        tokens = "".join(json.loads(d)["t"] for e, d in events if e == "token")
        done = json.loads(next(d for e, d in events if e == "done"))
        self.assertTrue(tokens.startswith("Tokyo sounds amazing!"))
        self.assertTrue(done["ready_for_plan"])
        self.assertIn("Create my plan ✨", done["suggested_replies"])
        self.assertTrue(done["message_id"])

        # The turn was persisted like any classic chat turn
        self.assertEqual(PlannerWorkspace.objects.count(), 1)
        workspace = PlannerWorkspace.objects.first()
        self.assertEqual(workspace.chat_messages.count(), 2)

    def test_workspace_stream_404s_for_unknown_workspace(self):
        response = self.client.post(
            "/api/planner/workspaces/00000000-0000-0000-0000-000000000000/chat/stream/",
            {"message": "hello"},
            format="json",
        )
        self.assertEqual(response.status_code, 404)

    def test_stream_requires_message_or_structured_value(self):
        response = self.client.post("/api/planner/chat/stream/", {}, format="json")
        self.assertEqual(response.status_code, 400)
