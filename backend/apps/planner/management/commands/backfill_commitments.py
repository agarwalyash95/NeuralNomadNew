"""
Create commitment rows for blocks already marked booked in trip JSON.

Idempotent: existing (workspace, block_id) rows are left untouched.
After this runs, money state has exactly one authoritative home.
"""

from django.core.management.base import BaseCommand

from apps.planner.models import PlanBlockCommitment, PlannerTrip
from apps.planner.services.block_schema import upcast_activity


def _iter_blocks(trip):
    for day in trip.days or []:
        for act in day.get("activities") or []:
            yield act
    for city in trip.cities or []:
        transit = city.get("transitToNext")
        if isinstance(transit, dict):
            yield transit


class Command(BaseCommand):
    help = "Backfill PlanBlockCommitment rows from booked blocks in trip JSON (idempotent)."

    def handle(self, *args, **options):
        created = 0
        for trip in PlannerTrip.objects.select_related("workspace").all():
            for block in _iter_blocks(trip):
                if block.get("status") != "booked" and block.get("block_status") != "booked":
                    continue
                block_id = block.get("id")
                if not block_id:
                    continue
                upcast_activity(block, trip.currency_code or "INR")
                _, was_created = PlanBlockCommitment.objects.get_or_create(
                    workspace=trip.workspace,
                    block_id=str(block_id),
                    defaults={
                        "status": PlanBlockCommitment.STATUS_BOOKED,
                        "amount": block.get("cost", {}).get("amount"),
                        "currency": block.get("cost", {}).get("currency") or "INR",
                        "history": [{"to": "booked", "at": None, "amount": block.get("cost", {}).get("amount"), "note": "backfilled"}],
                    },
                )
                if was_created:
                    created += 1

        self.stdout.write(self.style.SUCCESS(f"Created {created} commitment rows."))
