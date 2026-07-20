"""Backfills transport hub service areas and derived connectivity/hub scores.

**H7 fix (Phase 4):** the previous version always did
``Model.objects.all().delete()`` then ``bulk_create`` for each of the three
service-area tables — a mid-run failure between those two calls left the
table at zero rows, and every route-graph/hub-selection query silently
degraded to "no service areas" until the command was re-run to completion.

The default mode now is an **incremental upsert**: compute the current pass's
rows, create/update them, and only delete now-stale rows *after* the new data
is safely written, all inside one transaction (so even a mid-run crash rolls
back to the prior, intact state — never a zero-row window). The old
wipe-and-rebuild behavior is preserved behind ``--rebuild --confirm-rebuild``
(a double-confirm gate, matching the Phase 0 scrub-command precedent) for
cases where a full recompute is genuinely wanted.
"""

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.db.models import Count

from apps.reference.models import (
    City, RailwayStation, RailwayStationServiceArea, TrainRoute,
    Airport, AirportServiceArea, AirportRoute,
    BusStation, BusStationServiceArea, BusRoute
)
from apps.reference.services.canonical_resolver import calculate_distance as haversine_distance_km

UPDATE_FIELDS = ("distance_km", "typical_transfer_mins", "transfer_mode", "is_primary_hub", "confidence", "is_estimated")
_FLOAT_FIELDS = {"distance_km", "confidence"}
_FLOAT_TOLERANCE = 0.01  # found this session: exact `!=` on floats round-tripped
                         # through Postgres spuriously flagged nearly every row as
                         # "changed", turning every "incremental" run back into a
                         # full rewrite and defeating H7's own performance goal.


def _field_changed(existing_value, new_value, field):
    if field in _FLOAT_FIELDS:
        if existing_value is None or new_value is None:
            return existing_value != new_value
        return abs(existing_value - new_value) > _FLOAT_TOLERANCE
    return existing_value != new_value


def _incremental_upsert(model, hub_field, computed_objs):
    """Upsert by (hub_id, city_id); delete stale rows only after new/updated
    rows are written, all inside the caller's transaction."""
    existing = {
        (getattr(row, f"{hub_field}_id"), row.city_id): row
        for row in model.objects.all()
    }
    computed_keys = set()
    to_create = []
    to_update = []

    for obj in computed_objs:
        key = (getattr(obj, f"{hub_field}_id"), obj.city_id)
        computed_keys.add(key)
        existing_row = existing.get(key)
        if existing_row is None:
            to_create.append(obj)
            continue
        changed = False
        for field in UPDATE_FIELDS:
            if _field_changed(getattr(existing_row, field), getattr(obj, field), field):
                setattr(existing_row, field, getattr(obj, field))
                changed = True
        if changed:
            to_update.append(existing_row)

    stale_pks = [row.pk for key, row in existing.items() if key not in computed_keys]

    if to_create:
        model.objects.bulk_create(to_create, batch_size=1000)
    if to_update:
        model.objects.bulk_update(to_update, list(UPDATE_FIELDS), batch_size=1000)
    if stale_pks:
        model.objects.filter(pk__in=stale_pks).delete()

    return {
        "created": len(to_create), "updated": len(to_update),
        "deleted_stale": len(stale_pks),
        "unchanged": len(existing) - len(to_update) - len(stale_pks),
    }


class Command(BaseCommand):
    help = "Incrementally upserts transport hub service areas and derived connectivity/hub scores (H7-fixed)."

    def add_arguments(self, parser):
        parser.add_argument("--json", action="store_true")
        parser.add_argument(
            "--rebuild", action="store_true",
            help="Use the legacy wipe-then-rebuild path instead of incremental upsert. Requires --confirm-rebuild.",
        )
        parser.add_argument("--confirm-rebuild", action="store_true")

    def handle(self, *args, **options):
        if options["rebuild"] and not options["confirm_rebuild"]:
            raise CommandError(
                "--rebuild requires --confirm-rebuild (this wipes all three service-area "
                "tables before recreating them — the exact H7 unsafe pattern this command "
                "otherwise no longer uses by default)."
            )
        rebuild = options["rebuild"] and options["confirm_rebuild"]

        cities = list(City.objects.exclude(latitude__isnull=True).exclude(longitude__isnull=True))
        if not cities:
            raise CommandError("No cities with coordinates found! Run backfill_city_coordinates first.")

        report = {"mode": "rebuild" if rebuild else "incremental"}

        with transaction.atomic():
            report["railway"] = self._process_railway(cities, rebuild)
            report["airport"] = self._process_airport(cities, rebuild)
            report["bus"] = self._process_bus(cities, rebuild)

        if options["json"]:
            import json
            self.stdout.write(json.dumps(report, indent=2, sort_keys=True))
        else:
            self.stdout.write(self.style.SUCCESS(f"Station intelligence backfill complete ({report['mode']})."))
            for label, stats in report.items():
                if label != "mode":
                    self.stdout.write(f"  {label}: {stats}")

    def _process_railway(self, cities, rebuild):
        self.stdout.write("Processing Railway Stations...")
        stations = list(RailwayStation.objects.select_related("city"))

        import requests
        coords_by_code = {}
        try:
            r = requests.get("https://raw.githubusercontent.com/datameet/railways/master/stations.json", timeout=15)
            if r.status_code == 200:
                for f in r.json().get("features", []):
                    props = f.get("properties") or {}
                    geom = f.get("geometry") or {}
                    raw_code = props.get("code")
                    if raw_code:
                        coords = geom.get("coordinates") or []
                        if len(coords) == 2:
                            coords_by_code[str(raw_code).upper().strip()] = (coords[1], coords[0])
        except Exception as e:
            self.stdout.write(self.style.WARNING(f"Failed to fetch Datameet coordinates: {e}"))

        route_counts = {}
        for row in TrainRoute.objects.values("source_id").annotate(cnt=Count("id")):
            route_counts[row["source_id"]] = route_counts.get(row["source_id"], 0) + row["cnt"]
        for row in TrainRoute.objects.values("destination_id").annotate(cnt=Count("id")):
            route_counts[row["destination_id"]] = route_counts.get(row["destination_id"], 0) + row["cnt"]

        station_service_areas = []
        stations_to_update = []
        for station in stations:
            code_upper = station.code.upper().strip()
            if code_upper in coords_by_code:
                lat, lng = coords_by_code[code_upper]
                station.latitude = lat
                station.longitude = lng

            name_upper = station.name.upper()
            role, op_form = "local_station", "through_station"
            if "JN" in name_upper or "JUNCTION" in name_upper:
                role, op_form = "regional_hub", "junction"
            elif "TERMINUS" in name_upper or "TERM" in name_upper:
                role, op_form = "primary_city_hub", "terminal"
            elif "CANTT" in name_upper or "CENTRAL" in name_upper:
                role, op_form = "primary_city_hub", "through_station"
            elif "ROAD" in name_upper:
                role, op_form = "local_station", "halt"

            station.operational_form = op_form
            station.network_role = role
            routes_count = route_counts.get(station.id, 0)
            station.derived_connectivity_score = float(routes_count)
            station.derived_hub_score = min(10.0, 1.0 + (routes_count / 10.0))
            stations_to_update.append(station)

            if station.latitude is not None and station.longitude is not None:
                for city in cities:
                    if abs(float(city.latitude) - float(station.latitude)) > 1.0 or abs(float(city.longitude) - float(station.longitude)) > 1.0:
                        continue
                    dist = haversine_distance_km(
                        float(city.latitude), float(city.longitude),
                        float(station.latitude), float(station.longitude)
                    )
                    if dist <= 80.0:
                        station_service_areas.append(RailwayStationServiceArea(
                            station=station, city=city, distance_km=dist,
                            typical_transfer_mins=max(10, int(dist * 1.5)),
                            transfer_mode="cab" if dist > 10 else "walk",
                            is_primary_hub=(role == "primary_city_hub" and dist <= 15.0),
                            confidence=0.8, is_estimated=True,
                        ))
            elif station.city:
                station_service_areas.append(RailwayStationServiceArea(
                    station=station, city=station.city, distance_km=15.0,
                    typical_transfer_mins=35, transfer_mode="cab",
                    is_primary_hub=(role == "primary_city_hub"),
                    confidence=0.5, is_estimated=True,
                ))

        RailwayStation.objects.bulk_update(
            stations_to_update,
            ["operational_form", "network_role", "derived_connectivity_score", "derived_hub_score", "latitude", "longitude"],
            batch_size=1000,
        )

        if rebuild:
            RailwayStationServiceArea.objects.all().delete()
            RailwayStationServiceArea.objects.bulk_create(station_service_areas, batch_size=1000)
            return {"created": len(station_service_areas), "mode": "rebuild"}
        return _incremental_upsert(RailwayStationServiceArea, "station", station_service_areas)

    def _process_airport(self, cities, rebuild):
        self.stdout.write("Processing Airports...")
        airports = list(Airport.objects.select_related("city"))
        airport_route_counts = {}
        for row in AirportRoute.objects.values("source_id").annotate(cnt=Count("id")):
            airport_route_counts[row["source_id"]] = row["cnt"]

        airport_service_areas = []
        for ap in airports:
            ap.hub_importance = "primary" if airport_route_counts.get(ap.id, 0) > 5 else "secondary"
            if ap.latitude is not None and ap.longitude is not None:
                for city in cities:
                    # Bounding-box pre-filter (found missing this session — the
                    # original loop ran a full haversine for every airport x
                    # city combination, ~107M calls in pure Python at this
                    # table's scale, which is why an earlier run of this exact
                    # command took an impractically long time).
                    if abs(float(city.latitude) - float(ap.latitude)) > 1.2 or abs(float(city.longitude) - float(ap.longitude)) > 1.2:
                        continue
                    dist = haversine_distance_km(
                        float(city.latitude), float(city.longitude),
                        float(ap.latitude), float(ap.longitude)
                    )
                    if dist <= 120.0:
                        airport_service_areas.append(AirportServiceArea(
                            airport=ap, city=city, distance_km=dist,
                            typical_transfer_mins=max(20, int(dist * 2.0)),
                            transfer_mode="cab",
                            is_primary_hub=(dist <= 40.0 and ap.hub_importance == "primary"),
                            confidence=0.9, is_estimated=True,
                        ))
            elif ap.city:
                airport_service_areas.append(AirportServiceArea(
                    airport=ap, city=ap.city, distance_km=25.0,
                    typical_transfer_mins=50, transfer_mode="cab",
                    is_primary_hub=True, confidence=0.6, is_estimated=True,
                ))

        Airport.objects.bulk_update(airports, ["hub_importance"], batch_size=1000)

        if rebuild:
            AirportServiceArea.objects.all().delete()
            AirportServiceArea.objects.bulk_create(airport_service_areas, batch_size=1000)
            return {"created": len(airport_service_areas), "mode": "rebuild"}
        return _incremental_upsert(AirportServiceArea, "airport", airport_service_areas)

    def _process_bus(self, cities, rebuild):
        self.stdout.write("Processing Bus Stations...")
        bus_stations = list(BusStation.objects.select_related("city"))
        bus_service_areas = []
        for bs in bus_stations:
            if bs.latitude is not None and bs.longitude is not None:
                for city in cities:
                    if abs(float(city.latitude) - float(bs.latitude)) > 0.5 or abs(float(city.longitude) - float(bs.longitude)) > 0.5:
                        continue
                    dist = haversine_distance_km(
                        float(city.latitude), float(city.longitude),
                        float(bs.latitude), float(bs.longitude)
                    )
                    if dist <= 40.0:
                        bus_service_areas.append(BusStationServiceArea(
                            bus_station=bs, city=city, distance_km=dist,
                            typical_transfer_mins=max(10, int(dist * 1.8)),
                            transfer_mode="cab", is_primary_hub=(dist <= 10.0),
                            confidence=0.7, is_estimated=True,
                        ))
            elif bs.city:
                bus_service_areas.append(BusStationServiceArea(
                    bus_station=bs, city=bs.city, distance_km=10.0,
                    typical_transfer_mins=25, transfer_mode="cab",
                    is_primary_hub=True, confidence=0.5, is_estimated=True,
                ))

        if rebuild:
            BusStationServiceArea.objects.all().delete()
            BusStationServiceArea.objects.bulk_create(bus_service_areas, batch_size=1000)
            return {"created": len(bus_service_areas), "mode": "rebuild"}
        return _incremental_upsert(BusStationServiceArea, "bus_station", bus_service_areas)
