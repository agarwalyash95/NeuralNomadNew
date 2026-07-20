"""Phase 4 HubTransferLink population (master plan §7.2/§14 Phase 4).

The plan's design populates ``HubTransferLink`` for the "top-50 metro areas"
via ``MetroArea``/``MetroAreaCity``. Both tables are empty in this tree (no
phase has populated them) — this command uses an **adapted strategy**,
documented in the Phase 4 packet: same-city Airport<->RailwayStation<->
BusStation pairs for the top-N cities by population (``City.population``,
populated by Phase 3's GeoNames import), representing genuine intra-city
hub-to-hub transfers (e.g. a city's railway terminus <-> its airport) without
requiring metro-area membership data that doesn't exist yet.

``--dry-run`` is the default.
"""

import json

from django.contrib.contenttypes.models import ContentType
from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.reference.models import (
    Airport, AirportServiceArea, BusStation, BusStationServiceArea, City,
    HubTransferLink, RailwayStation, RailwayStationServiceArea,
)
from apps.reference.services.geo import haversine_km, valid_coordinates


def _primary_hubs_for_city(city, service_area_model, hub_field):
    areas = service_area_model.objects.filter(city=city, is_primary_hub=True).select_related(hub_field)[:2]
    return [getattr(a, hub_field) for a in areas]


class Command(BaseCommand):
    help = "Populate HubTransferLink for same-city hub pairs, top-N cities by population (dry-run by default)."

    def add_arguments(self, parser):
        mode = parser.add_mutually_exclusive_group()
        mode.add_argument("--apply", action="store_true")
        mode.add_argument("--dry-run", action="store_true")
        parser.add_argument("--top-n-cities", type=int, default=50)
        parser.add_argument("--json", action="store_true")

    def handle(self, *args, **options):
        apply_mode = bool(options["apply"])
        top_n = options["top_n_cities"]

        cities = list(City.objects.filter(population__isnull=False).order_by("-population")[:top_n])

        metrics = {"mode": "apply" if apply_mode else "dry_run", "cities_considered": len(cities),
                   "links_created": 0, "links_updated": 0, "links_already_current": 0, "cities_with_no_pair": 0}

        for city in cities:
            hubs_by_type = {
                RailwayStation: _primary_hubs_for_city(city, RailwayStationServiceArea, "station"),
                Airport: _primary_hubs_for_city(city, AirportServiceArea, "airport"),
                BusStation: _primary_hubs_for_city(city, BusStationServiceArea, "bus_station"),
            }
            found_any = False
            hub_types = list(hubs_by_type.keys())
            for i in range(len(hub_types)):
                for j in range(i + 1, len(hub_types)):
                    type_a, type_b = hub_types[i], hub_types[j]
                    for hub_a in hubs_by_type[type_a]:
                        for hub_b in hubs_by_type[type_b]:
                            if not (valid_coordinates(hub_a.latitude, hub_a.longitude)
                                    and valid_coordinates(hub_b.latitude, hub_b.longitude)):
                                continue
                            found_any = True
                            distance = haversine_km(hub_a.latitude, hub_a.longitude, hub_b.latitude, hub_b.longitude)
                            typical_mins = max(15, int(distance * 2.0))
                            ct_a, ct_b = ContentType.objects.get_for_model(hub_a), ContentType.objects.get_for_model(hub_b)

                            existing = HubTransferLink.objects.filter(
                                from_content_type=ct_a, from_object_id=str(hub_a.pk),
                                to_content_type=ct_b, to_object_id=str(hub_b.pk),
                            ).first()
                            changed = existing is None
                            if existing and (
                                existing.distance_km != round(distance, 1)
                                or existing.typical_transfer_mins != typical_mins
                            ):
                                changed = True

                            if changed:
                                if existing:
                                    metrics["links_updated"] += 1
                                else:
                                    metrics["links_created"] += 1
                                if apply_mode:
                                    HubTransferLink.objects.update_or_create(
                                        from_content_type=ct_a, from_object_id=str(hub_a.pk),
                                        to_content_type=ct_b, to_object_id=str(hub_b.pk),
                                        defaults={
                                            "distance_km": round(distance, 1),
                                            "typical_transfer_mins": typical_mins,
                                            "mode": "cab",
                                            "provenance_tier": "derived",
                                            "confidence": 0.6,
                                        },
                                    )
                            else:
                                metrics["links_already_current"] += 1
            if not found_any:
                metrics["cities_with_no_pair"] += 1

        if options["json"]:
            self.stdout.write(json.dumps(metrics, indent=2, sort_keys=True))
        else:
            self.stdout.write(self.style.SUCCESS(json.dumps(metrics, indent=2)))
