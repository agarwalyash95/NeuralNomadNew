from django.contrib.auth import get_user_model
from django.test import TestCase

from apps.planner.models import PlannerWorkspace, PlannerTrip, PlanProposal
from apps.planner.services.chat_edit_intents import detect_retime_intent, propose_retime_from_chat


class DetectRetimeIntentTests(TestCase):
    def test_matches_move_with_explicit_pm(self):
        self.assertEqual(
            detect_retime_intent('Move dinner to 8pm'),
            ('dinner', '20:00'),
        )

    def test_matches_change_with_hhmm(self):
        self.assertEqual(
            detect_retime_intent('change the museum visit to 14:30'),
            ('museum visit', '14:30'),
        )

    def test_rejects_bare_hour_with_no_am_pm(self):
        self.assertIsNone(detect_retime_intent('Move dinner to 8'))

    def test_rejects_message_without_trigger_verb(self):
        self.assertIsNone(detect_retime_intent('dinner should be at 8pm'))

    def test_rejects_unrelated_chat_message(self):
        self.assertIsNone(detect_retime_intent('What is the weather like in Manali?'))

    def test_rejects_out_of_range_time(self):
        self.assertIsNone(detect_retime_intent('move dinner to 25:99'))


class ProposeRetimeFromChatTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            email="traveler@example.com", password="password", name="Traveler"
        )
        self.workspace = PlannerWorkspace.objects.create(
            user=self.user, title="Trip", status=PlannerWorkspace.STATUS_ACTIVE
        )
        self.trip = PlannerTrip.objects.create(
            workspace=self.workspace,
            title="Test Trip",
            summary="",
            total_budget=10000,
            currency_code="INR",
            cities=[{"name": "Manali", "order": 1, "nights": 1}],
            days=[{
                "day_number": 1,
                "date": "2026-10-15",
                "title": "Day 1",
                "city": "Manali",
                "activities": [
                    {"id": "block-dinner", "category": "food", "title": "Dinner at Cafe 1947", "start_time": "19:00", "status": "pending"},
                    {"id": "block-flight", "category": "flight", "title": "Flight to Delhi", "start_time": "10:00", "status": "pending"},
                    {"id": "block-flight-2", "category": "flight", "title": "Flight to Manali", "start_time": "11:00", "status": "pending"},
                ],
            }],
            metadata={},
        )

    def test_files_a_proposal_for_a_clean_retime_match(self):
        proposal = propose_retime_from_chat(self.workspace, "Move dinner to 8pm")
        self.assertIsNotNone(proposal)
        self.assertEqual(proposal.kind, PlanProposal.KIND_PLAN_EDIT)
        after_activities = proposal.diff["after"]["days"][0]["activities"]
        dinner = next(a for a in after_activities if a["id"] == "block-dinner")
        self.assertEqual(dinner["start_time"], "20:00")
        # Untouched blocks pass through unchanged
        flight = next(a for a in after_activities if a["id"] == "block-flight")
        self.assertEqual(flight["start_time"], "10:00")

    def test_returns_none_for_ambiguous_block_match(self):
        # Two blocks both contain "flight" — must not guess which one
        proposal = propose_retime_from_chat(self.workspace, "Move flight to 9am")
        self.assertIsNone(proposal)
        self.assertEqual(PlanProposal.objects.filter(workspace=self.workspace).count(), 0)

    def test_returns_none_when_no_block_matches(self):
        proposal = propose_retime_from_chat(self.workspace, "Move the museum tour to 3pm")
        self.assertIsNone(proposal)

    def test_returns_none_for_ordinary_chat_message(self):
        proposal = propose_retime_from_chat(self.workspace, "What should I pack for Manali?")
        self.assertIsNone(proposal)

    def test_does_not_duplicate_an_already_open_identical_proposal(self):
        first = propose_retime_from_chat(self.workspace, "Move dinner to 8pm")
        second = propose_retime_from_chat(self.workspace, "Move dinner to 8pm")
        self.assertIsNotNone(first)
        self.assertIsNone(second)
        self.assertEqual(
            PlanProposal.objects.filter(workspace=self.workspace, kind=PlanProposal.KIND_PLAN_EDIT).count(), 1
        )

    def test_returns_none_when_workspace_has_no_trip(self):
        bare = PlannerWorkspace.objects.create(user=self.user, title="No plan")
        self.assertIsNone(propose_retime_from_chat(bare, "Move dinner to 8pm"))
