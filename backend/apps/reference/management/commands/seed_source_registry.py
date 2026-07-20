"""Idempotent seed of the Phase 3 SourceRegistry rows.

Each row records the licence facts verified in the master plan §5 (GeoNames,
OurAirports, Wikidata — verified before Phase 3 started) and this phase's own
GODL-India verification (docs/plans/evidence/phase-03/licence-verification.md).
OTD Delhi stays inactive: its terms were never fetched, and GTFS import is out
of Phase 3 scope regardless (V2/T4 in the master plan).
"""

import json

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.reference.models import SourceRegistry


SOURCES = [
    {
        "slug": "geonames",
        "publisher": "GeoNames (Unxos GmbH)",
        "licence_name": "CC-BY 4.0",
        "licence_url": "https://www.geonames.org/export/",
        "storage_permissions": {"raw": True, "normalized": True},
        "attribution_text": "Geographic data from GeoNames.org, CC-BY 4.0.",
        "priority_rank": 10,
        "active": True,
    },
    {
        "slug": "ourairports",
        "publisher": "OurAirports (community)",
        "licence_name": "Public Domain",
        "licence_url": "https://ourairports.com/data/",
        "storage_permissions": {"raw": True, "normalized": True},
        "attribution_text": "Airport data from OurAirports.com (public domain).",
        "priority_rank": 10,
        "active": True,
    },
    {
        "slug": "wikidata",
        "publisher": "Wikimedia",
        "licence_name": "CC0",
        "licence_url": "https://www.wikidata.org/wiki/Wikidata:Licensing",
        "storage_permissions": {"raw": True, "normalized": True},
        "attribution_text": "Structured data from Wikidata (CC0, public domain).",
        "priority_rank": 5,
        "active": True,
    },
    {
        "slug": "data_gov_in_godl",
        "publisher": "Government of India (MeitY / NIC)",
        "licence_name": "GODL-India",
        "licence_url": "https://data.gov.in/sites/default/files/Gazette_Notification_OGDL.pdf",
        "storage_permissions": {"raw": True, "normalized": True},
        "attribution_text": (
            "[Name of Data Provider], [Year], [Name of Data], Open Government Data "
            "Platform India, [Date], [URL]. Published under Government Open Data "
            "License - India (GODL-India)."
        ),
        "priority_rank": 40,
        "active": True,
    },
    {
        "slug": "otd_delhi",
        "publisher": "GNCTD / DIMTS",
        "licence_name": "Portal T&C — unreviewed",
        "licence_url": "https://otd.delhi.gov.in",
        "storage_permissions": {"raw": False, "normalized": False},
        "attribution_text": "",
        "priority_rank": 90,
        "active": False,
    },
    {
        "slug": "openflights",
        "publisher": "OpenFlights.org / Airline Route Mapper",
        "licence_name": "ODbL",
        "licence_url": "https://openflights.org/data.php",
        "storage_permissions": {"raw": False, "normalized": True},
        "attribution_text": "Route/airline data from OpenFlights.org / Airline Route Mapper, ODbL.",
        "priority_rank": 60,
        "active": True,
    },
    {
        "slug": "osm_overpass",
        "publisher": "OpenStreetMap contributors, via the Overpass API",
        "licence_name": "ODbL 1.0",
        "licence_url": "https://www.openstreetmap.org/copyright",
        # ODbL is share-alike: derived/normalized fields we compute (category
        # mapping, matched cross-ids) are fine to store; raw OSM tag payloads
        # are not persisted verbatim beyond what feeds a normalized field.
        "storage_permissions": {"raw": False, "normalized": True},
        "attribution_text": "Map data from OpenStreetMap contributors, ODbL 1.0, via the Overpass API (overpass-api.de).",
        "priority_rank": 65,
        "active": True,
    },
]


class Command(BaseCommand):
    help = "Idempotently seed/refresh the Phase 3 SourceRegistry rows (licence facts only)."

    def add_arguments(self, parser):
        parser.add_argument("--json", action="store_true")

    def handle(self, *args, **options):
        now = timezone.now()
        results = {"created": [], "updated": [], "unchanged": []}
        for spec in SOURCES:
            slug = spec["slug"]
            defaults = {k: v for k, v in spec.items() if k != "slug"}
            defaults["licence_verified_at"] = now if defaults["active"] else None
            obj, created = SourceRegistry.objects.get_or_create(slug=slug, defaults=defaults)
            if created:
                results["created"].append(slug)
                continue
            changed = False
            for field, value in defaults.items():
                if field == "licence_verified_at":
                    continue
                if getattr(obj, field) != value:
                    setattr(obj, field, value)
                    changed = True
            if changed:
                obj.save()
                results["updated"].append(slug)
            else:
                results["unchanged"].append(slug)

        if options["json"]:
            self.stdout.write(json.dumps(results, indent=2, sort_keys=True))
        else:
            self.stdout.write(self.style.SUCCESS(
                f"created={len(results['created'])} updated={len(results['updated'])} "
                f"unchanged={len(results['unchanged'])}"
            ))
