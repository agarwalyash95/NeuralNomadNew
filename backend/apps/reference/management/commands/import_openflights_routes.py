"""Phase 4 flight-route importer (master plan §7.1/§9.1/§14 Phase 4).

Populates ``AirportRoute`` (+ any missing ``Airline`` rows) from OpenFlights'
``routes.dat``/``airlines.dat`` (ODbL — verified this phase, see
``docs/plans/evidence/phase-04/openflights-licence-verification.md``).

**This data is a static 2014 snapshot** ("of historical value only" per the
source's own page) — every created row is stamped
``provenance_tier="derived"`` with an explicit staleness note, never
``verified``/``authoritative``. Only routes with **direct** (0-stop) service
where **both** endpoints already match an existing ``Airport.iata_code`` are
imported (no new `Airport` rows are created), and — to keep this bounded and
relevant to an India-focused application — only routes where **at least one**
endpoint is an Indian airport (``Airport.city.country.code == "IN"``).
Airline rows are only created for real 2-letter IATA codes (the ``Airline``
model's `iata_code` column is 2 chars, matching the model's existing
constraint; 3-letter ICAO-only route entries are skipped rather than forced
into a field they don't fit).

``--dry-run`` is the default.
"""

import csv
import io
import json

import requests
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from apps.reference.models import Airline, Airport, ImportBatch, SourceRegistry, SourceRelease, AirportRoute
from apps.reference.services.geo import haversine_km, valid_coordinates
from apps.reference.services.reconciliation import record_field_provenance

# routes.dat carries no duration; derive an honest estimate from great-circle
# distance at a typical effective jet speed (accounts for climb/descent/taxi,
# not pure cruise speed) plus a fixed ground-handling buffer.
_EFFECTIVE_SPEED_KMH = 750.0
_GROUND_BUFFER_MINS = 30

ROUTES_URL = "https://raw.githubusercontent.com/jpatokal/openflights/master/data/routes.dat"
AIRLINES_URL = "https://raw.githubusercontent.com/jpatokal/openflights/master/data/airlines.dat"

ROUTE_COLUMNS = (
    "airline", "airline_id", "source_airport", "source_airport_id",
    "destination_airport", "destination_airport_id", "codeshare", "stops", "equipment",
)
AIRLINE_COLUMNS = ("airline_id", "name", "alias", "iata", "icao", "callsign", "country", "active")


def _parse_dat(text, columns):
    reader = csv.reader(io.StringIO(text))
    for row in reader:
        if len(row) < len(columns):
            continue
        yield dict(zip(columns, row))


class Command(BaseCommand):
    help = "Populate AirportRoute/Airline from OpenFlights routes.dat/airlines.dat (dry-run by default)."

    def add_arguments(self, parser):
        mode = parser.add_mutually_exclusive_group()
        mode.add_argument("--apply", action="store_true")
        mode.add_argument("--dry-run", action="store_true")
        parser.add_argument("--routes-file")
        parser.add_argument("--airlines-file")
        parser.add_argument("--json", action="store_true")

    def handle(self, *args, **options):
        apply_mode = bool(options["apply"])
        source = SourceRegistry.objects.filter(slug="openflights", active=True).first()
        if not source:
            raise CommandError("SourceRegistry 'openflights' is missing or inactive. Run seed_source_registry first.")

        routes_text = (
            open(options["routes_file"], encoding="utf-8").read() if options["routes_file"]
            else requests.get(ROUTES_URL, timeout=30).text
        )
        airlines_text = (
            open(options["airlines_file"], encoding="utf-8").read() if options["airlines_file"]
            else requests.get(AIRLINES_URL, timeout=30).text
        )

        release = SourceRelease.objects.create(
            source=source, version_label="2014-snapshot-" + timezone.now().strftime("%Y-%m-%d")
        )
        batch = ImportBatch.objects.create(
            release=release, command_name="import_openflights_routes",
            dry_run=not apply_mode, status="dry_run" if not apply_mode else "running",
        )

        airports_by_iata = {a.iata_code: a for a in Airport.objects.select_related("city__country")}
        indian_iata = {
            code for code, a in airports_by_iata.items()
            if a.city_id and a.city.country_id and a.city.country.code == "IN"
        }
        airlines_by_id = {row["airline_id"]: row for row in _parse_dat(airlines_text, AIRLINE_COLUMNS)}
        existing_airlines_by_iata = {al.iata_code: al for al in Airline.objects.all()}

        metrics = {
            "mode": "apply" if apply_mode else "dry_run",
            "batch_id": batch.pk,
            "route_rows_seen": 0,
            "direct_rows": 0,
            "both_endpoints_on_file": 0,
            "touches_india": 0,
            "airlines_created": 0,
            "airlines_skipped_non_iata2": 0,
            "airportroutes_created": 0,
            "airportroutes_updated": 0,
            "airportroutes_already_current": 0,
        }

        seen_pairs = set()
        pending_airline_codes = set()  # dry-run only: codes counted as "would create" this run
        for row in _parse_dat(routes_text, ROUTE_COLUMNS):
            metrics["route_rows_seen"] += 1
            if row["stops"] != "0":
                continue
            metrics["direct_rows"] += 1

            src_code, dst_code = row["source_airport"], row["destination_airport"]
            src = airports_by_iata.get(src_code)
            dst = airports_by_iata.get(dst_code)
            if not src or not dst or src.pk == dst.pk:
                continue
            metrics["both_endpoints_on_file"] += 1

            if src_code not in indian_iata and dst_code not in indian_iata:
                continue
            metrics["touches_india"] += 1

            airline_code = row["airline"].strip()
            if len(airline_code) != 2:
                metrics["airlines_skipped_non_iata2"] += 1
                continue

            airline = existing_airlines_by_iata.get(airline_code)
            airline_is_new_this_run = False
            if not airline and airline_code not in pending_airline_codes:
                pending_airline_codes.add(airline_code)
                metrics["airlines_created"] += 1
                airline_is_new_this_run = True
                if apply_mode:
                    al_info = airlines_by_id.get(row["airline_id"], {})
                    al_name = al_info.get("name", "").strip('"') or airline_code
                    airline, _ = Airline.objects.get_or_create(
                        iata_code=airline_code, defaults={"name": al_name[:255]}
                    )
                    existing_airlines_by_iata[airline_code] = airline
            elif not airline:
                airline_is_new_this_run = True  # counted earlier this same run, still pending in dry-run

            if not airline and not apply_mode:
                # Dry-run preview: the airline doesn't exist yet, so any route using
                # it is necessarily new — count it without a real FK to query against.
                pair_key = (src.pk, dst.pk, airline_code)
                if pair_key not in seen_pairs:
                    seen_pairs.add(pair_key)
                    metrics["airportroutes_created"] += 1
                continue

            pair_key = (src.pk, dst.pk, airline_code)
            if pair_key in seen_pairs:
                continue
            seen_pairs.add(pair_key)

            route = AirportRoute.objects.filter(source=src, destination=dst, airline=airline).first()
            is_new = route is None or airline_is_new_this_run
            if route is None:
                route = AirportRoute(source=src, destination=dst, airline=airline)

            changed = is_new
            route.provenance_tier = "derived"
            route.confidence = 0.4  # stale 2014 snapshot — deliberately below datameet's 0.6
            route.freshness_at = None

            distance_km = None
            duration_mins = None
            if valid_coordinates(src.latitude, src.longitude) and valid_coordinates(dst.latitude, dst.longitude):
                distance_km = round(haversine_km(src.latitude, src.longitude, dst.latitude, dst.longitude), 1)
                duration_mins = int(distance_km / _EFFECTIVE_SPEED_KMH * 60) + _GROUND_BUFFER_MINS
            if route.distance_km != distance_km:
                route.distance_km = distance_km
                changed = True
            if route.duration_mins != duration_mins:
                route.duration_mins = duration_mins
                changed = True

            meta = {
                "source": "openflights",
                "snapshot_year": 2014,
                "staleness_note": "route existence only, not a current schedule",
                "equipment": row.get("equipment", ""),
                "duration_estimate_method": "great_circle_distance_at_750kmh_plus_30min",
            }
            if route.service_class_meta != meta:
                route.service_class_meta = meta
                changed = True

            if changed:
                if is_new:
                    metrics["airportroutes_created"] += 1
                else:
                    metrics["airportroutes_updated"] += 1
                if apply_mode:
                    route.save()
                    record_field_provenance(
                        route, "service_class_meta", source_name="openflights",
                        external_id=f"{src_code}-{dst_code}-{airline_code}", confidence=0.4, tier="derived",
                    )
            else:
                metrics["airportroutes_already_current"] += 1

        batch.finished_at = timezone.now()
        batch.status = "dry_run" if not apply_mode else "completed"
        batch.created_count = metrics["airportroutes_created"] + metrics["airlines_created"]
        batch.updated_count = metrics["airportroutes_updated"]
        batch.skipped_count = metrics["airlines_skipped_non_iata2"]
        if apply_mode:
            batch.save()
        else:
            batch.delete()
            release.delete()

        if options["json"]:
            self.stdout.write(json.dumps(metrics, indent=2, sort_keys=True))
        else:
            self.stdout.write(self.style.SUCCESS(json.dumps(metrics, indent=2)))
