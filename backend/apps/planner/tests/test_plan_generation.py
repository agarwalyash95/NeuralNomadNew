from datetime import date, timedelta
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings

from apps.planner.models import PlanGenerationJob, PlannerWorkspace, TripDraftState
from apps.reference.models import (
    ActivityMaster,
    AttractionMaster,
    City,
    Country,
    HotelMaster,
    RestaurantMaster,
)


def _skeleton_response(start, end):
    days = []
    current = start
    number = 1
    while current <= end:
        days.append(
            SimpleNamespace(
                day_number=number,
                date=current.isoformat(),
                title=f"Day {number} in Jaipur",
                day_type="arrival" if number == 1 else "exploration",
                city="Jaipur",
            )
        )
        current += timedelta(days=1)
        number += 1
    return SimpleNamespace(
        title="Jaipur Heritage Escape",
        summary="Forts, food and pink-city lanes.",
        cities=[
            SimpleNamespace(
                name="Jaipur",
                nights=(end - start).days,
                arrival_date=start.isoformat(),
                departure_date=end.isoformat(),
            )
        ],
        days=days,
    )


def _composed_response(attraction_id, restaurant_id, hotel_id):
    def block(**kw):
        base = dict(
            kind="candidate",
            candidate_id=None,
            transport_mode=None,
            from_place=None,
            to_place=None,
            start_time="09:00",
            end_time="11:00",
            note="A well-reviewed stop.",
        )
        base.update(kw)
        return SimpleNamespace(**base)

    return SimpleNamespace(
        days=[
            SimpleNamespace(
                day_number=1,
                blocks=[
                    block(kind="transport", transport_mode="train", from_place="Delhi", to_place="Jaipur",
                          start_time="06:00", end_time="10:30"),
                    block(candidate_id=f"hotel:{hotel_id}", start_time="11:00", end_time="12:00"),
                    block(candidate_id=f"attraction:{attraction_id}", start_time="14:00", end_time="16:30"),
                    block(candidate_id=f"restaurant:{restaurant_id}", start_time="19:30", end_time="21:00"),
                ],
            ),
            SimpleNamespace(
                day_number=2,
                blocks=[
                    # Hallucinated id — must be rejected and heuristically filled
                    block(candidate_id="attraction:999999", start_time="10:00", end_time="12:00"),
                ],
            ),
        ]
    )


@override_settings(GOOGLE_PLACES_API_KEY="", LIVE_PROVIDERS_ENABLED=False)
class PlanGenerationPipelineTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            email="traveler@example.com", password="password", name="Traveler"
        )
        country = Country.objects.create(name="India", code="IN", currency_code="INR")
        self.city = City.objects.create(
            country=country, name="Jaipur", latitude=26.9124, longitude=75.7873
        )

        self.attractions = [
            AttractionMaster.objects.create(
                city=self.city,
                name=f"Amber Fort {i}",
                category="heritage",
                user_rating=4.5 - i * 0.1,
                latitude=26.9855 + i * 0.001,
                longitude=75.8513,
                address="Devisinghpura, Amer",
                place_id=f"place-attr-{i}",
                editorial_summary="Hilltop fort with mirrored halls.",
                image_url="https://example.com/fort.jpg",
            )
            for i in range(6)
        ]
        self.restaurants = [
            RestaurantMaster.objects.create(
                city=self.city,
                name=f"Laxmi Misthan Bhandar {i}",
                cuisine="Rajasthani",
                user_rating=4.3,
                latitude=26.9230,
                longitude=75.8267,
                address="Johari Bazar",
                place_id=f"place-rest-{i}",
            )
            for i in range(5)
        ]
        self.hotels = [
            HotelMaster.objects.create(
                city=self.city,
                name=f"Haveli Stay {i}",
                user_rating=4.4,
                latitude=26.9150,
                longitude=75.8000,
                address="MI Road",
                place_id=f"place-hotel-{i}",
            )
            for i in range(5)
        ]
        for i in range(5):
            ActivityMaster.objects.create(
                city=self.city,
                name=f"Hot Air Balloon {i}",
                category="adventure",
                user_rating=4.6,
                latitude=26.9000,
                longitude=75.8100,
                place_id=f"place-act-{i}",
            )

        self.workspace = PlannerWorkspace.objects.create(user=self.user, title="Jaipur Trip")
        start = date.today() + timedelta(days=30)
        self.start, self.end = start, start + timedelta(days=1)
        self.draft = TripDraftState.objects.create(
            workspace=self.workspace,
            destination_text="Jaipur",
            start_date=self.start,
            end_date=self.end,
            adults=2,
            metadata={"origin": "Delhi"},
        )

    @patch("google.genai.Client")
    def test_pipeline_builds_trip_from_real_reference_rows(self, mock_client_class):
        from apps.planner.services.plan_generation import run_generation_job, start_generation_job

        mock_client = MagicMock()
        mock_client_class.return_value = mock_client
        mock_client.models.generate_content.side_effect = [
            MagicMock(parsed=_skeleton_response(self.start, self.end)),
            MagicMock(
                parsed=_composed_response(
                    self.attractions[0].pk, self.restaurants[0].pk, self.hotels[0].pk
                )
            ),
        ]

        job, created = start_generation_job(self.workspace)
        self.assertTrue(created)
        run_generation_job(job.id)  # synchronous in tests — same code the thread runs

        job.refresh_from_db()
        self.assertEqual(job.status, PlanGenerationJob.STATUS_DONE, job.error)
        self.assertEqual(job.progress, 100)
        self.assertTrue(all(p["state"] == "done" for p in job.phase_log), job.phase_log)

        self.workspace.refresh_from_db()
        trip = self.workspace.trip
        self.assertEqual(trip.title, "Jaipur Heritage Escape")
        self.assertEqual(len(trip.days), 2)

        day1 = trip.days[0]
        titles = [a["title"] for a in day1["activities"]]
        self.assertIn("Haveli Stay 0", titles)
        self.assertIn("Amber Fort 0", titles)

        # Every candidate block carries its reference identity
        fort = next(a for a in day1["activities"] if a["title"] == "Amber Fort 0")
        self.assertEqual(fort["metadata"]["place_id"], "place-attr-0")
        self.assertEqual(fort["metadata"]["master_ref"]["table"], "attraction")
        self.assertEqual(fort["ai_tip"], "Hilltop fort with mirrored halls.")

        # Alternatives are real pool rows, not invented placeholders
        alt_titles = [c["title"] for c in fort["_aiInsights"]["candidates"]]
        for title in alt_titles:
            self.assertTrue(AttractionMaster.objects.filter(name=title).exists(), title)

        # Hallucinated id on day 2 was replaced by a real unused candidate
        day2_titles = [a["title"] for a in trip.days[1]["activities"]]
        self.assertEqual(len(day2_titles), 1)
        self.assertNotIn("999999", day2_titles[0])

        # Distances were stamped (haversine fallback with no API key)
        self.assertTrue(day1.get("transit_hints"), "expected transit_hints on day 1")

        # Transport is priced ONLY through lookup_live_price — if a price is
        # present it must carry provenance from that lookup (history or
        # provider), never an invented bare number.
        train = next(a for a in day1["activities"] if a["category"] == "train")
        if train.get("estimated_cost") is not None:
            self.assertIn("provenance", train["cost"])
            self.assertIn(train["cost"]["provenance"]["tier"], ("verified", "estimated"))
            self.assertEqual(train["cost"]["amount"], train["estimated_cost"])
        else:
            self.assertNotIn("cost", train)

    @patch("google.genai.Client")
    def test_pipeline_failure_falls_back_to_curated_skeleton(self, mock_client_class):
        from apps.planner.services.plan_generation import run_generation_job, start_generation_job

        mock_client = MagicMock()
        mock_client_class.return_value = mock_client
        mock_client.models.generate_content.side_effect = RuntimeError("LLM down")

        job, _ = start_generation_job(self.workspace)
        run_generation_job(job.id)

        job.refresh_from_db()
        self.assertEqual(job.status, PlanGenerationJob.STATUS_DONE)
        self.assertIn("fallback", job.error.lower())
        self.workspace.refresh_from_db()
        self.assertTrue(hasattr(self.workspace, "trip"))
        self.assertTrue(len(self.workspace.trip.days) > 0)

    def test_start_generation_job_is_idempotent_while_running(self):
        from apps.planner.services.plan_generation import start_generation_job

        job1, created1 = start_generation_job(self.workspace)
        job2, created2 = start_generation_job(self.workspace)
        self.assertTrue(created1)
        self.assertFalse(created2)
        self.assertEqual(job1.id, job2.id)

    def test_plan_endpoint_returns_202_job_and_status_is_pollable(self):
        from rest_framework.test import APIClient

        client = APIClient()
        client.force_authenticate(self.user)
        base = f"/api/planner/workspaces/{self.workspace.id}"

        response = client.post(f"{base}/plan/")
        self.assertEqual(response.status_code, 202)
        self.assertIn("job_id", response.data)
        self.assertEqual(response.data["status"], "queued")

        # Re-POST while queued returns the same job, not a duplicate
        again = client.post(f"{base}/plan/")
        self.assertEqual(again.data["job_id"], response.data["job_id"])

        status_resp = client.get(f"{base}/plan/status/")
        self.assertEqual(status_resp.status_code, 200)
        self.assertEqual(status_resp.data["job_id"], response.data["job_id"])
        self.assertEqual(len(status_resp.data["phases"]), 0)  # reporter not started yet

    def test_plan_endpoint_sync_flag_uses_blocking_path(self):
        from rest_framework.test import APIClient

        with patch(
            "apps.planner.services.conversation_service.ConversationService.create_plan"
        ) as mock_create:
            from apps.planner.models import PlannerTrip

            mock_create.return_value = PlannerTrip.objects.create(
                workspace=self.workspace, title="Sync Trip", days=[], cities=[]
            )
            client = APIClient()
            client.force_authenticate(self.user)
            response = client.post(f"/api/planner/workspaces/{self.workspace.id}/plan/?sync=1")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["title"], "Sync Trip")
