"""Dry-run-first Phase 2 coordinate repair using approved open data only."""

import json
import re
from collections import defaultdict
from statistics import median

import requests
from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Q

from apps.reference.models import City, RailwayStation
from apps.reference.services.geo import is_placeholder, valid_coordinates
from apps.reference.utils import normalize_code


DATAMEET_URL = "https://raw.githubusercontent.com/datameet/railways/master/stations.json"
WIKIDATA_URL = "https://query.wikidata.org/sparql"
POINT_RE = re.compile(r"Point\(([-+0-9.]+)\s+([-+0-9.]+)\)")

CURATED_CITIES = {
    "mumbai": (19.0760, 72.8777, "Asia/Kolkata"),
    "bombay": (19.0760, 72.8777, "Asia/Kolkata"),
    "bengaluru": (12.9716, 77.5946, "Asia/Kolkata"),
    "bangalore": (12.9716, 77.5946, "Asia/Kolkata"),
    "gurgaon": (28.4595, 77.0266, "Asia/Kolkata"),
    "gurugram": (28.4595, 77.0266, "Asia/Kolkata"),
    "delhi": (28.6139, 77.2090, "Asia/Kolkata"),
    "new delhi": (28.6139, 77.2090, "Asia/Kolkata"),
    "noida": (28.5355, 77.3910, "Asia/Kolkata"),
    "kolkata": (22.5726, 88.3639, "Asia/Kolkata"),
    "chennai": (13.0827, 80.2707, "Asia/Kolkata"),
    "hyderabad": (17.3850, 78.4867, "Asia/Kolkata"),
    "pune": (18.5204, 73.8567, "Asia/Kolkata"),
    "goa": (15.2993, 74.1240, "Asia/Kolkata"),
}


def _chunks(values, size):
    for index in range(0, len(values), size):
        yield values[index:index + size]


def _datameet_coordinates(stdout):
    try:
        response = requests.get(DATAMEET_URL, timeout=45)
        response.raise_for_status()
        result = {}
        for feature in response.json().get("features", []):
            code = normalize_code((feature.get("properties") or {}).get("code"))
            coords = (feature.get("geometry") or {}).get("coordinates") or []
            if code and len(coords) >= 2 and valid_coordinates(coords[1], coords[0]):
                result.setdefault(code, (float(coords[1]), float(coords[0])))
        return result
    except Exception as exc:
        stdout.write(f"DataMeet unavailable; unresolved rows unchanged: {exc}")
        return {}


def _wikidata_coordinates(codes, stdout):
    result = {}
    headers = {"User-Agent": "NeuralNomad-reference-audit/1.0 (Phase 2 coordinate repair)"}
    for code_chunk in _chunks(sorted(set(codes)), 75):
        values = " ".join(json.dumps(code) for code in code_chunk)
        query = f"""
SELECT ?station ?code ?coord WHERE {{
  VALUES ?code {{ {values} }}
  ?station wdt:P296 ?code ; wdt:P625 ?coord ; wdt:P17 wd:Q668 .
}}
"""
        try:
            response = requests.get(
                WIKIDATA_URL,
                params={"query": query, "format": "json"},
                headers=headers,
                timeout=45,
            )
            response.raise_for_status()
            for binding in response.json().get("results", {}).get("bindings", []):
                code = normalize_code(binding.get("code", {}).get("value"))
                match = POINT_RE.fullmatch(binding.get("coord", {}).get("value", ""))
                if not code or not match:
                    continue
                longitude, latitude = map(float, match.groups())
                if valid_coordinates(latitude, longitude):
                    result.setdefault(code, (latitude, longitude))
        except Exception as exc:
            stdout.write(f"Wikidata batch unavailable; unresolved rows unchanged: {exc}")
    return result


class Command(BaseCommand):
    help = "Backfill unresolved station/city coordinates and recompute City publishability."

    def add_arguments(self, parser):
        mode = parser.add_mutually_exclusive_group()
        mode.add_argument("--apply", action="store_true", help="Persist the proposed updates.")
        mode.add_argument("--dry-run", action="store_true", help="Preview only (the default).")
        parser.add_argument(
            "--source",
            choices=("auto", "datameet", "wikidata", "curated", "linked_station"),
            default="auto",
            help="Restrict the source ladder; auto uses every approved open/curated source.",
        )
        parser.add_argument("--skip-network", action="store_true", help="Use only local/linked data.")
        parser.add_argument("--json", action="store_true", help="Emit machine-readable metrics.")

    def handle(self, *args, **options):
        apply_changes = options["apply"]
        source = options["source"]
        network_allowed = not options["skip_network"]
        metrics = {
            "mode": "apply" if apply_changes else "dry_run",
            "source": source,
            "paid_api_calls": 0,
            "stations": {"targeted": 0, "proposed": 0, "applied": 0, "by_source": {}},
            "cities": {"targeted": 0, "coordinate_proposed": 0, "coordinate_applied": 0, "publishability_changed": 0, "by_source": {}},
        }

        missing_stations = list(
            RailwayStation.objects.select_related("city").filter(
                Q(latitude__isnull=True) | Q(longitude__isnull=True)
            )
        )
        metrics["stations"]["targeted"] = len(missing_stations)
        station_proposals = {}

        datameet = {}
        if network_allowed and source in ("auto", "datameet"):
            datameet = _datameet_coordinates(self.stdout)
        for station in missing_stations:
            coords = datameet.get(normalize_code(station.code))
            if coords:
                station_proposals[station.pk] = (*coords, "datameet")

        unresolved_codes = [
            station.code for station in missing_stations if station.pk not in station_proposals
        ]
        wikidata = {}
        if network_allowed and source in ("auto", "wikidata") and unresolved_codes:
            wikidata = _wikidata_coordinates(unresolved_codes, self.stdout)
        for station in missing_stations:
            if station.pk in station_proposals:
                continue
            coords = wikidata.get(normalize_code(station.code))
            if coords:
                station_proposals[station.pk] = (*coords, "wikidata")

        station_by_id = {station.pk: station for station in missing_stations}
        station_source_counts = defaultdict(int)
        for station_id, (latitude, longitude, proposal_source) in station_proposals.items():
            station = station_by_id[station_id]
            station.latitude = latitude
            station.longitude = longitude
            station_source_counts[proposal_source] += 1
        metrics["stations"]["proposed"] = len(station_proposals)
        metrics["stations"]["by_source"] = dict(sorted(station_source_counts.items()))

        station_coords_by_city = defaultdict(list)
        all_stations = RailwayStation.objects.exclude(city__isnull=True).only(
            "id", "city_id", "latitude", "longitude"
        )
        for station in all_stations.iterator(chunk_size=2000):
            proposal = station_proposals.get(station.pk)
            latitude, longitude = proposal[:2] if proposal else (station.latitude, station.longitude)
            if valid_coordinates(latitude, longitude) and not is_placeholder(latitude, longitude):
                station_coords_by_city[station.city_id].append((float(latitude), float(longitude)))

        cities = list(City.objects.select_related("country").all())
        target_city_ids = {
            city.pk
            for city in cities
            if not valid_coordinates(city.latitude, city.longitude)
            or is_placeholder(city.latitude, city.longitude)
        }
        metrics["cities"]["targeted"] = len(target_city_ids)
        city_source_counts = defaultdict(int)
        coordinate_proposals = set()
        publishability_changes = 0
        changed_cities = []

        for city in cities:
            changed = False
            coordinate_source = None
            if city.pk in target_city_ids:
                normalized_name = city.name.lower().strip()
                if source in ("auto", "curated") and normalized_name in CURATED_CITIES:
                    latitude, longitude, timezone_name = CURATED_CITIES[normalized_name]
                    city.latitude = latitude
                    city.longitude = longitude
                    city.timezone = city.timezone or timezone_name
                    city.coordinate_confidence = 0.95
                    coordinate_source = "curated"
                elif source in ("auto", "linked_station") and station_coords_by_city.get(city.pk):
                    coordinates = station_coords_by_city[city.pk]
                    city.latitude = median(value[0] for value in coordinates)
                    city.longitude = median(value[1] for value in coordinates)
                    city.coordinate_confidence = 0.75
                    coordinate_source = "linked_station"
                if coordinate_source:
                    coordinate_proposals.add(city.pk)
                    city_source_counts[coordinate_source] += 1
                    changed = True

            should_publish = bool(
                valid_coordinates(city.latitude, city.longitude)
                and not is_placeholder(city.latitude, city.longitude)
                and str(city.name or "").strip()
                and city.country_id
            )
            if city.coordinate_confidence is None:
                city.coordinate_confidence = 0.70 if should_publish else 0.0
                changed = True
            if city.is_publishable != should_publish:
                city.is_publishable = should_publish
                publishability_changes += 1
                changed = True
            if changed:
                changed_cities.append(city)

        metrics["cities"]["coordinate_proposed"] = len(coordinate_proposals)
        metrics["cities"]["publishability_changed"] = publishability_changes
        metrics["cities"]["by_source"] = dict(sorted(city_source_counts.items()))

        if apply_changes:
            with transaction.atomic():
                station_updates = [station_by_id[pk] for pk in station_proposals]
                if station_updates:
                    RailwayStation.objects.bulk_update(station_updates, ["latitude", "longitude"], batch_size=500)
                if changed_cities:
                    City.objects.bulk_update(
                        changed_cities,
                        ["latitude", "longitude", "timezone", "coordinate_confidence", "is_publishable"],
                        batch_size=500,
                    )
            metrics["stations"]["applied"] = len(station_proposals)
            metrics["cities"]["coordinate_applied"] = len(coordinate_proposals)

        station_total = RailwayStation.objects.count()
        current_complete = RailwayStation.objects.exclude(
            Q(latitude__isnull=True) | Q(longitude__isnull=True)
        ).count()
        metrics["railway_coordinate_coverage_after_proposal"] = round(
            (current_complete + (0 if apply_changes else len(station_proposals))) / max(station_total, 1),
            6,
        )
        metrics["remaining_placeholder_cities_after_proposal"] = sum(
            1 for city in cities if is_placeholder(city.latitude, city.longitude)
        )
        metrics["publishable_placeholder_cities_after_proposal"] = sum(
            1 for city in cities if city.is_publishable and is_placeholder(city.latitude, city.longitude)
        )

        if options["json"]:
            self.stdout.write(json.dumps(metrics, indent=2, sort_keys=True))
        else:
            self.stdout.write(json.dumps(metrics, indent=2, sort_keys=True))
            if not apply_changes:
                self.stdout.write(self.style.WARNING("Dry run only; rerun with --apply to persist."))
