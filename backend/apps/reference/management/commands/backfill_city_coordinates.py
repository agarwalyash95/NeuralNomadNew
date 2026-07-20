"""Compatibility entry point for the Phase 2 coordinate source ladder.

Open/curated sources delegate to ``backfill_reference_coordinates``. Google remains the
single sanctioned planner-owned writer during the transition, but is never called unless
the operator explicitly selects it, enables paid calls, sets a positive budget, and uses
``--apply``.
"""

import json

from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError
from django.db.models import Q

from apps.planner.services.geocoding import geocode_city
from apps.reference.models import City
from apps.reference.services.geo import is_placeholder, valid_coordinates


class Command(BaseCommand):
    help = "Backfill city coordinates through the Phase 2 source ladder (dry-run by default)."

    def add_arguments(self, parser):
        mode = parser.add_mutually_exclusive_group()
        mode.add_argument("--apply", action="store_true", help="Persist reviewed updates.")
        mode.add_argument("--dry-run", action="store_true", help="Preview only (the default).")
        parser.add_argument(
            "--source",
            choices=("auto", "datameet", "wikidata", "curated", "linked_station", "google"),
            default="auto",
        )
        parser.add_argument("--skip-network", action="store_true")
        parser.add_argument("--allow-paid-api", action="store_true")
        parser.add_argument("--max-google-calls", type=int, default=0)
        parser.add_argument("--json", action="store_true")

    def handle(self, *args, **options):
        source = options["source"]
        if source != "google":
            call_command(
                "backfill_reference_coordinates",
                apply=options["apply"],
                dry_run=not options["apply"],
                source=source,
                skip_network=options["skip_network"],
                json=options["json"],
                stdout=self.stdout,
            )
            return

        targets = list(
            City.objects.filter(
                Q(latitude__isnull=True)
                | Q(longitude__isnull=True)
                | Q(latitude=20.5937, longitude=78.9629)
            ).order_by("pk")
        )
        metrics = {
            "mode": "apply" if options["apply"] else "dry_run",
            "source": "google",
            "targeted": len(targets),
            "calls": 0,
            "updated": 0,
            "failed": 0,
        }
        if not options["apply"]:
            self.stdout.write(json.dumps(metrics, indent=2, sort_keys=True))
            self.stdout.write("Google dry-run makes no request; review the target count first.")
            return
        if not options["allow_paid_api"]:
            raise CommandError("Google writes require --allow-paid-api.")
        if options["max_google_calls"] <= 0:
            raise CommandError("Google writes require a positive --max-google-calls budget.")

        for city in targets[: options["max_google_calls"]]:
            metrics["calls"] += 1
            geocode = geocode_city(city.name)
            if not geocode or not valid_coordinates(
                geocode.get("latitude"), geocode.get("longitude")
            ) or is_placeholder(geocode.get("latitude"), geocode.get("longitude")):
                metrics["failed"] += 1
                continue
            city.latitude = geocode["latitude"]
            city.longitude = geocode["longitude"]
            city.coordinate_confidence = 0.60
            city.is_publishable = True
            fields = ["latitude", "longitude", "coordinate_confidence", "is_publishable"]
            place_id = geocode.get("place_id")
            place_id_owned = (
                place_id
                and City.objects.filter(place_id=place_id).exclude(pk=city.pk).exists()
            )
            if place_id and not place_id_owned:
                city.place_id = place_id
                fields.append("place_id")
            city.save(update_fields=fields)
            metrics["updated"] += 1

        self.stdout.write(json.dumps(metrics, indent=2, sort_keys=True))
