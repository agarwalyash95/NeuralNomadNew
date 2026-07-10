"""
Rewrite stored PlannerTrip / PlannerTripOriginal rows to block schema v2.

Idempotent: upcasting v2 data is a no-op, so this can run any number of times.
Reads still upcast on the fly (serializer), so this command is about making
the stored data match what the API emits — future diffs and queries compare
like with like.
"""

from django.core.management.base import BaseCommand

from apps.planner.models import PlannerTrip, PlannerTripOriginal
from apps.planner.services.block_schema import SCHEMA_VERSION, upcast_trip_payload


class Command(BaseCommand):
    help = "Backfill PlannerTrip and PlannerTripOriginal JSON to block schema v2 (idempotent)."

    def handle(self, *args, **options):
        updated = 0
        for model in (PlannerTrip, PlannerTripOriginal):
            for trip in model.objects.all():
                payload = {
                    "currency_code": trip.currency_code if hasattr(trip, "currency_code") else "INR",
                    "days": trip.days or [],
                    "cities": trip.cities or [],
                }
                upcast_trip_payload(payload, default_currency=payload["currency_code"])

                trip.days = payload["days"]
                trip.cities = payload["cities"]
                if isinstance(trip.metadata, dict):
                    trip.metadata["schema_version"] = SCHEMA_VERSION
                trip.save()
                updated += 1

        self.stdout.write(self.style.SUCCESS(f"Upcast {updated} trip rows to schema v{SCHEMA_VERSION}."))
