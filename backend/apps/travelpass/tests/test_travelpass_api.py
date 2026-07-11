import pytest
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient
from apps.travelpass.models import TravelPass

User = get_user_model()

class TravelPassApiTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="traveler@example.com", password="password", name="Traveler"
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.base_url = "/api/travelpass/travel-passes/"

    def test_create_travel_pass_without_specifying_user(self):
        data = {
            "title": "Indigo Delhi to Mumbai",
            "document_type": "FLIGHT",
            "origin": "Delhi",
            "destination": "Mumbai",
            "status": "UPCOMING",
            "issuer": "Indigo",
            "seat_info": "Seat 14B"
        }
        response = self.client.post(self.base_url, data, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(TravelPass.objects.count(), 1)
        pass_obj = TravelPass.objects.first()
        self.assertEqual(pass_obj.user, self.user)
        self.assertEqual(pass_obj.title, "Indigo Delhi to Mumbai")

    def test_list_travel_passes(self):
        # Create a travel pass manually
        TravelPass.objects.create(
            user=self.user,
            title="Flight Ticket",
            document_type="FLIGHT",
            reference_number="TP-TEST1234",
            status="ACTIVE"
        )
        response = self.client.get(self.base_url)
        self.assertEqual(response.status_code, 200)
        # Check either array or standard pagination results
        results = response.data.get("results") if isinstance(response.data, dict) else response.data
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["title"], "Flight Ticket")

    def test_summary_endpoint(self):
        # Create different kinds of passes
        TravelPass.objects.create(
            user=self.user,
            title="Active Flight",
            document_type="FLIGHT",
            reference_number="TP-ACTIVE",
            status="ACTIVE"
        )
        TravelPass.objects.create(
            user=self.user,
            title="Upcoming Train",
            document_type="TRAIN",
            reference_number="TP-UPCOMING",
            status="UPCOMING"
        )
        
        response = self.client.get(f"{self.base_url}summary/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["total"], 2)
        self.assertEqual(response.data["active"], 1)
        self.assertEqual(response.data["upcoming"], 1)
        self.assertEqual(response.data["by_type"]["FLIGHT"], 1)
        self.assertEqual(response.data["by_type"]["TRAIN"], 1)
