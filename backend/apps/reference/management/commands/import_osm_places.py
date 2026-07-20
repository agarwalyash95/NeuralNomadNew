"""Phase 6 OSM place importer (master plan §14 Phase 6) — **adapted strategy**:
queries the free, no-key **Overpass API** instead of parsing a Geofabrik PBF
extract with ``osmium``/``pyosmium``. Same underlying OSM data, same ODbL
provenance, no new C-extension dependency (confirmed not installed) and no
multi-GB country-wide download — bounded, per-city bounding-radius queries
instead. See the phase-06 implementation packet for the full reasoning; this
is a flagged, documented deviation from the plan's literal wording, not a
silent substitution.

Queries `tourism=hotel|guest_house|attraction|museum|viewpoint` and
`amenity=restaurant|cafe|fast_food` within a radius of each of the top-N
Indian cities by population (``City.population``, same convention Phase 4's
``populate_hub_transfer_links`` used). Named elements are matched against
existing master-table rows by name+distance
(``reconciliation.match_place_by_name_distance``); a match backfills
``osm_id``/coordinates only, a non-match creates a new row with **only** what
OSM actually supplies (name, coordinates, category, ``osm_id``) — never a
fabricated price/rating/hours field Google would normally provide. Unnamed
OSM elements are skipped entirely — a POI with no name is not usable
reference data.

``--dry-run`` is the default. ``--cities N`` bounds the run (defaults to a
small pilot set; scaling to full coverage is a mechanical follow-up).
"""

import json
import time

import requests
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from apps.reference.models import (
    AttractionMaster, City, HotelMaster, ImportBatch, RestaurantMaster,
    SourceRegistry, SourceRelease,
)
from apps.reference.services.geo import valid_coordinates
from apps.reference.services.reconciliation import (
    AMBIGUOUS, MATCHED, match_place_by_name_distance, record_field_provenance,
)

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
DEFAULT_RADIUS_M = 15000
REQUEST_DELAY_SECONDS = 2  # polite pacing against the free public endpoint
# The public instance 406s requests with no/generic User-Agent (basic bot
# hygiene on their end) — a real, identifying UA is required, not optional.
REQUEST_HEADERS = {"User-Agent": "NeuralNomad-ReferenceData/1.0 (reference-foundation phase 6; dev environment)"}

# (osm_tag_key, osm_tag_value) -> (model, canonical_category). Mirrors the
# `osm` rows seed_category_vocabulary.py writes into CategoryVocabularyMap —
# kept here as the literal dispatch table since that's what the query and the
# per-element branch both need directly.
TAG_CATEGORY_MAP = {
    ("tourism", "hotel"): (HotelMaster, "hotel"),
    ("tourism", "guest_house"): (HotelMaster, "hotel"),
    ("tourism", "attraction"): (AttractionMaster, "attraction"),
    ("tourism", "museum"): (AttractionMaster, "museum"),
    ("tourism", "viewpoint"): (AttractionMaster, "viewpoint"),
    ("amenity", "restaurant"): (RestaurantMaster, "restaurant"),
    ("amenity", "cafe"): (RestaurantMaster, "cafe"),
    ("amenity", "fast_food"): (RestaurantMaster, "fast_food"),
}


def _build_query(lat, lng, radius_m):
    clauses = []
    for tag_key, tag_value in TAG_CATEGORY_MAP:
        for kind in ("node", "way"):
            clauses.append(f'{kind}["{tag_key}"="{tag_value}"](around:{radius_m},{lat},{lng});')
    return "[out:json][timeout:60];(" + "".join(clauses) + ");out center tags;"


def _element_coords(element):
    if element.get("type") == "node":
        return element.get("lat"), element.get("lon")
    center = element.get("center") or {}
    return center.get("lat"), center.get("lon")


def _match_tag(tags):
    for (tag_key, tag_value), target in TAG_CATEGORY_MAP.items():
        if tags.get(tag_key) == tag_value:
            return target
    return None, None


class Command(BaseCommand):
    help = "Import hotel/restaurant/attraction POIs from the Overpass API for the top-N Indian cities by population (dry-run by default)."

    def add_arguments(self, parser):
        mode = parser.add_mutually_exclusive_group()
        mode.add_argument("--apply", action="store_true")
        mode.add_argument("--dry-run", action="store_true")
        parser.add_argument("--cities", type=int, default=8, help="Number of top-population cities to query this run.")
        parser.add_argument("--radius-m", type=int, default=DEFAULT_RADIUS_M)
        parser.add_argument("--json", action="store_true")

    def handle(self, *args, **options):
        apply_mode = bool(options["apply"])
        n_cities = options["cities"]
        radius_m = options["radius_m"]

        source = SourceRegistry.objects.filter(slug="osm_overpass", active=True).first()
        if not source:
            raise CommandError("SourceRegistry 'osm_overpass' is missing or inactive. Run seed_source_registry first.")

        cities = list(
            City.objects.filter(population__isnull=False, latitude__isnull=False, longitude__isnull=False)
            .order_by("-population")[:n_cities]
        )

        release = SourceRelease.objects.create(
            source=source, version_label="overpass-" + timezone.now().strftime("%Y-%m-%d"),
        )
        batch = ImportBatch.objects.create(
            release=release, command_name="import_osm_places",
            dry_run=not apply_mode, status="dry_run" if not apply_mode else "running",
            params={"cities": n_cities, "radius_m": radius_m},
        )

        metrics = {
            "mode": "apply" if apply_mode else "dry_run",
            "cities_queried": 0, "cities_errored": 0,
            "elements_seen": 0, "elements_unnamed_skipped": 0, "elements_untagged_skipped": 0,
            "matched_backfilled": 0, "matched_already_current": 0, "created": 0, "ambiguous_skipped": 0,
            "per_city": {},
        }

        for i, city in enumerate(cities):
            query = _build_query(float(city.latitude), float(city.longitude), radius_m)
            try:
                resp = requests.post(OVERPASS_URL, data={"data": query}, headers=REQUEST_HEADERS, timeout=90)
                resp.raise_for_status()
                elements = resp.json().get("elements", [])
            except Exception as exc:
                metrics["cities_errored"] += 1
                metrics["per_city"][city.name] = {"error": str(exc)}
                if i < len(cities) - 1:
                    time.sleep(REQUEST_DELAY_SECONDS)
                continue

            metrics["cities_queried"] += 1
            city_stats = {"elements": len(elements), "created": 0, "matched": 0}

            for element in elements:
                metrics["elements_seen"] += 1
                tags = element.get("tags") or {}
                name = (tags.get("name") or "").strip()
                if not name:
                    metrics["elements_unnamed_skipped"] += 1
                    continue
                model, canonical_category = _match_tag(tags)
                if model is None:
                    metrics["elements_untagged_skipped"] += 1
                    continue
                lat, lon = _element_coords(element)
                if not valid_coordinates(lat, lon):
                    continue
                osm_id = f"{element.get('type')}/{element.get('id')}"

                existing_qs = model.objects.filter(city=city)
                match, status = match_place_by_name_distance(existing_qs, name, latitude=lat, longitude=lon)

                if status == MATCHED:
                    changed = False
                    if not match.osm_id:
                        match.osm_id = osm_id
                        changed = True
                    if not valid_coordinates(match.latitude, match.longitude):
                        match.latitude, match.longitude = lat, lon
                        changed = True
                    if changed:
                        metrics["matched_backfilled"] += 1
                        city_stats["matched"] += 1
                        if apply_mode:
                            match.save()
                            record_field_provenance(
                                match, "osm_id", source_name="osm_overpass",
                                external_id=osm_id, confidence=0.7, tier="open_dataset",
                            )
                    else:
                        metrics["matched_already_current"] += 1
                    continue

                if status == AMBIGUOUS:
                    metrics["ambiguous_skipped"] += 1
                    continue

                # unmatched -> a genuinely new place, minimal honest fields only
                metrics["created"] += 1
                city_stats["created"] += 1
                if apply_mode:
                    kwargs = dict(
                        city=city, name=name[:250], latitude=lat, longitude=lon,
                        osm_id=osm_id, external_id=osm_id, source="osm", verification_status="verified",
                        verified_at=timezone.now(), last_enriched_at=timezone.now(),
                    )
                    if model is AttractionMaster:
                        kwargs["category"] = canonical_category
                    elif model is RestaurantMaster:
                        kwargs["primary_type"] = canonical_category
                    row = model.objects.create(**kwargs)
                    record_field_provenance(
                        row, "osm_id", source_name="osm_overpass",
                        external_id=osm_id, confidence=0.7, tier="open_dataset",
                    )

            metrics["per_city"][city.name] = city_stats
            if i < len(cities) - 1:
                time.sleep(REQUEST_DELAY_SECONDS)

        batch.finished_at = timezone.now()
        batch.status = "dry_run" if not apply_mode else "completed"
        batch.created_count = metrics["created"]
        batch.updated_count = metrics["matched_backfilled"]
        batch.skipped_count = metrics["elements_unnamed_skipped"] + metrics["elements_untagged_skipped"] + metrics["ambiguous_skipped"]
        if apply_mode:
            batch.save()
        else:
            batch.delete()
            release.delete()

        if options["json"]:
            self.stdout.write(json.dumps(metrics, indent=2, sort_keys=True))
        else:
            self.stdout.write(self.style.SUCCESS(json.dumps(metrics, indent=2)))
