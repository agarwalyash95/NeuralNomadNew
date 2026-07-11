from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.planner.models import PlannerWorkspace, PlannerTrip, PlanProposal


def make_trip(workspace, **overrides):
    """A minimal two-block trip: one costed hotel, one free walk."""
    defaults = dict(
        workspace=workspace,
        title="Test Trip",
        summary="",
        total_budget=10000,
        currency_code="INR",
        cities=[{"name": "Manali", "order": 1, "nights": 2}],
        days=[
            {
                "day_number": 1,
                "date": "2026-10-15",
                "title": "Day 1",
                "city": "Manali",
                "activities": [
                    {
                        "id": "block-hotel",
                        "category": "hotel",
                        "title": "Zostel Manali",
                        "cost": {
                            "amount": 3500,
                            "currency": "INR",
                            "provenance": {"tier": "estimated", "source": "test"},
                        },
                        "block_status": "priced",
                        "status": "pending",
                    },
                    {
                        "id": "block-walk",
                        "category": "activity",
                        "title": "Old Manali Walk",
                        "status": "pending",
                    },
                ],
            }
        ],
        metadata={},
    )
    defaults.update(overrides)
    return PlannerTrip.objects.create(**defaults)


class PlanLifecycleApiTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            email="traveler@example.com", password="password", name="Traveler"
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.workspace = PlannerWorkspace.objects.create(
            user=self.user, title="Trip", status=PlannerWorkspace.STATUS_ACTIVE
        )
        self.trip = make_trip(self.workspace)
        self.base = f"/api/planner/workspaces/{self.workspace.id}"

    def test_save_moves_workspace_to_saved_bucket(self):
        response = self.client.post(f"{self.base}/save/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "saved")
        self.assertEqual(response.data["bucket"], "saved")
        self.assertFalse(response.data["is_modified"])
        self.trip.refresh_from_db()
        self.assertIn("saved_snapshot_at", self.trip.metadata)

    def test_editing_a_saved_plan_returns_it_to_recent_with_modified_flag(self):
        self.client.post(f"{self.base}/save/")
        response = self.client.patch(f"{self.base}/plan/", {"title": "Renamed"}, format="json")
        self.assertEqual(response.status_code, 200)

        listing = self.client.get(f"{self.base}/")
        self.assertEqual(listing.data["bucket"], "recent")
        self.assertTrue(listing.data["is_modified"])
        self.assertEqual(listing.data["status"], "saved")
        self.assertEqual(listing.data["next_action"], "Modified since last save")

        # Re-saving returns it to Saved
        resave = self.client.post(f"{self.base}/save/")
        self.assertEqual(resave.data["bucket"], "saved")

    def test_book_blocks_when_costed_blocks_lack_commitments(self):
        response = self.client.post(f"{self.base}/book/", {}, format="json")
        self.assertEqual(response.status_code, 409)
        blocking_ids = [b["block_id"] for b in response.data["blocking_blocks"]]
        self.assertEqual(blocking_ids, ["block-hotel"])  # the free walk never gates booking

    def test_book_succeeds_once_all_costed_blocks_are_booked(self):
        transition = self.client.post(
            f"{self.base}/blocks/transition/",
            {"to": "booked", "block_ids": ["block-hotel"]},
            format="json",
        )
        self.assertEqual(transition.status_code, 200)
        self.assertEqual(transition.data["transitioned"], ["block-hotel"])

        response = self.client.post(f"{self.base}/book/", {}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["workspace"]["status"], "booked")
        self.assertEqual(response.data["workspace"]["bucket"], "booked")

    def test_save_requires_a_generated_plan(self):
        bare = PlannerWorkspace.objects.create(user=self.user, title="No plan yet")
        response = self.client.post(f"/api/planner/workspaces/{bare.id}/save/")
        self.assertEqual(response.status_code, 404)

    def test_replacing_a_days_anchor_block_proposes_a_retitle(self):
        # "Old Manali Walk" literally names the day — swap it for something
        # else and the day title should be offered a refresh, not left stale.
        self.trip.days[0]["title"] = "Old Manali Walk & Café Crawl"
        self.trip.save(update_fields=["days"])

        new_days = [dict(self.trip.days[0])]
        new_days[0]["activities"] = [
            self.trip.days[0]["activities"][0],
            {**self.trip.days[0]["activities"][1], "title": "Vashisht Temple Visit"},
        ]
        response = self.client.patch(
            f"{self.base}/plan/",
            {"days": new_days, "cities": self.trip.cities},
            format="json",
        )
        self.assertEqual(response.status_code, 200)

        proposals = PlanProposal.objects.filter(workspace=self.workspace, kind=PlanProposal.KIND_PLAN_EDIT)
        self.assertEqual(proposals.count(), 1)
        proposal = proposals.first()
        self.assertIn("Vashisht Temple Visit", proposal.diff["after"]["days"][0]["title"])
        self.assertEqual(proposal.diff["after"]["days"][0]["title"], "Vashisht Temple Visit & Café Crawl")

        # A second identical PATCH (e.g. an unrelated autosave) must not pile up dupes
        response2 = self.client.patch(
            f"{self.base}/plan/",
            {"days": new_days, "cities": self.trip.cities},
            format="json",
        )
        self.assertEqual(response2.status_code, 200)
        self.assertEqual(
            PlanProposal.objects.filter(workspace=self.workspace, kind=PlanProposal.KIND_PLAN_EDIT).count(), 1
        )

    def test_reordering_blocks_without_renaming_proposes_nothing(self):
        # A drag reorder changes activity order but no titles — must not
        # trigger a retitle proposal (the detector keys on title changes).
        reordered = dict(self.trip.days[0])
        reordered["activities"] = list(reversed(self.trip.days[0]["activities"]))
        response = self.client.patch(
            f"{self.base}/plan/",
            {"days": [reordered], "cities": self.trip.cities},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            PlanProposal.objects.filter(workspace=self.workspace, kind=PlanProposal.KIND_PLAN_EDIT).count(), 0
        )
