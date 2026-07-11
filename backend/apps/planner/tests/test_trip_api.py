from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient
from datetime import date, timedelta
from apps.planner.models import PlannerWorkspace, TripDraftState, PlannerTrip

User = get_user_model()

class TripApiTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="traveler@example.com", password="password", name="Traveler"
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.base_url = "/api/planner/trips/"

    def test_list_trips_returns_mapped_workspaces(self):
        # Create a workspace
        workspace = PlannerWorkspace.objects.create(
            user=self.user,
            title="Trip to Goa",
            status="booked"
        )
        draft = TripDraftState.objects.create(
            workspace=workspace,
            destination_text="Goa",
            start_date=date.today() + timedelta(days=5),
            end_date=date.today() + timedelta(days=10),
            budget_amount="25000.00"
        )
        
        response = self.client.get(self.base_url)
        self.assertEqual(response.status_code, 200)
        
        results = response.data.get("results") if isinstance(response.data, dict) else response.data
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["destination"], "Goa")
        self.assertEqual(results[0]["status"], "booked")
        self.assertEqual(results[0]["budget"], 25000.00)

    def test_upcoming_trips(self):
        # Create an upcoming trip (start date in future, booked status)
        workspace = PlannerWorkspace.objects.create(
            user=self.user,
            title="Trip to Paris",
            status="booked"
        )
        TripDraftState.objects.create(
            workspace=workspace,
            destination_text="Paris",
            start_date=date.today() + timedelta(days=10),
            end_date=date.today() + timedelta(days=15)
        )
        
        response = self.client.get(f"{self.base_url}upcoming/")
        self.assertEqual(response.status_code, 200)
        
        results = response.data
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["destination"], "Paris")

    def test_past_trips(self):
        # Create a past trip (end date in past)
        workspace = PlannerWorkspace.objects.create(
            user=self.user,
            title="Trip to Delhi",
            status="completed"
        )
        TripDraftState.objects.create(
            workspace=workspace,
            destination_text="New Delhi",
            start_date=date.today() - timedelta(days=10),
            end_date=date.today() - timedelta(days=5)
        )
        
        response = self.client.get(f"{self.base_url}past/")
        self.assertEqual(response.status_code, 200)
        
        results = response.data
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["destination"], "New Delhi")
