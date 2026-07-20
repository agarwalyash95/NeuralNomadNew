"""Phase 3 GeoNames India importer (master plan §7.2/§14 Phase 3).

Reconciles existing ``City`` rows against the GeoNames India dump
(``IN.zip`` — CC-BY 4.0, verified in the master plan §5), attaching
``geonameid``/``population`` and inline-alternate-name ``CityAlias`` rows.
Also creates ``District`` rows from GeoNames ``ADM2`` entries.

Deliberately bounded (see the Phase 3 implementation packet §5/§19): only
``PPLC``/``PPLA``/``PPLA2`` (national capital / state capitals / district
admin seats) unmatched rows are auto-created as new ``City`` rows. The
remaining ~546k generic ``PPL`` rows are used only as match candidates for
existing cities — never auto-created, and not written to ``StagingRecord``
individually (that would be a ~550k-row write with no reconciliation value;
they are summarized as a count instead). Unmatched/ambiguous
``PPLC``/``PPLA``/``PPLA2`` candidates ARE staged individually, since that
small set is exactly what a human would review.

``--dry-run`` is the default. Every run writes one ``ImportBatch`` row.
Idempotent: re-running with the same source data changes nothing (matched
rows already carrying the same ``geonameid`` are skipped; aliases and
districts are ``get_or_create``d).
"""

import csv
import io
import json
import zipfile
from collections import defaultdict

import requests
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from apps.reference.models import (
    City, CityAlias, Country, District, ImportBatch, SourceRegistry, SourceRelease,
    StagingRecord, State,
)
from apps.reference.services.geo import haversine_km, valid_coordinates
from apps.reference.services.reconciliation import (
    flag_data_quality_issue, record_field_provenance, write_entity_map,
)
from apps.reference.utils import normalize_search_name

GEONAMES_IN_URL = "https://download.geonames.org/export/dump/IN.zip"
GEONAMES_ADMIN1_URL = "https://download.geonames.org/export/dump/admin1CodesASCII.txt"
NEW_CITY_FEATURE_CODES = {"PPLC", "PPLA", "PPLA2"}
DISTANCE_THRESHOLD_KM = 10.0
MAX_ALIASES_PER_CITY = 8

GEONAME_COLUMNS = (
    "geonameid", "name", "asciiname", "alternatenames", "latitude", "longitude",
    "feature_class", "feature_code", "country_code", "cc2", "admin1_code",
    "admin2_code", "admin3_code", "admin4_code", "population", "elevation",
    "dem", "timezone", "modification_date",
)


def _load_geonames_rows(zip_bytes):
    """Yield dicts for every row in IN.txt inside the given zip bytes."""
    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
        with zf.open("IN.txt") as fh:
            reader = csv.reader(io.TextIOWrapper(fh, encoding="utf-8"), delimiter="\t")
            for row in reader:
                if len(row) < len(GEONAME_COLUMNS):
                    continue
                yield dict(zip(GEONAME_COLUMNS, row))


def _load_admin1_crosswalk(text):
    """Return {"IN.<code>": "State Name"} for India rows in admin1CodesASCII.txt."""
    crosswalk = {}
    for line in text.splitlines():
        if not line.startswith("IN."):
            continue
        parts = line.split("\t")
        if len(parts) < 2:
            continue
        crosswalk[parts[0]] = parts[1]
    return crosswalk


class Command(BaseCommand):
    help = "Reconcile City/District rows against GeoNames India (dry-run by default)."

    def add_arguments(self, parser):
        mode = parser.add_mutually_exclusive_group()
        mode.add_argument("--apply", action="store_true")
        mode.add_argument("--dry-run", action="store_true")
        parser.add_argument("--file", help="Local path to a pre-downloaded IN.zip.")
        parser.add_argument("--admin1-file", help="Local path to a pre-downloaded admin1CodesASCII.txt.")
        parser.add_argument("--max-new-cities", type=int, default=200)
        parser.add_argument("--json", action="store_true")

    def handle(self, *args, **options):
        apply_mode = bool(options["apply"])
        source = SourceRegistry.objects.filter(slug="geonames", active=True).first()
        if not source:
            raise CommandError("SourceRegistry 'geonames' is missing or inactive. Run seed_source_registry first.")

        if options["file"]:
            with open(options["file"], "rb") as fh:
                zip_bytes = fh.read()
        else:
            resp = requests.get(GEONAMES_IN_URL, timeout=120)
            resp.raise_for_status()
            zip_bytes = resp.content

        if options["admin1_file"]:
            with open(options["admin1_file"], encoding="utf-8") as fh:
                admin1_text = fh.read()
        else:
            resp = requests.get(GEONAMES_ADMIN1_URL, timeout=30)
            resp.raise_for_status()
            admin1_text = resp.text

        admin1_crosswalk = _load_admin1_crosswalk(admin1_text)
        # Found this session: 4 India states have a duplicate State row under a
        # different name-punctuation convention (e.g. "Uttar-Pradesh" vs
        # "Uttar Pradesh"), all with the spaced variant holding zero cities.
        # Prefer whichever duplicate already has more attached cities so this
        # importer resolves to the real row, not an empty accidental one.
        state_candidates = defaultdict(list)
        for state in State.objects.select_related("country").filter(country__code="IN"):
            state_candidates[normalize_search_name(state.name)].append(state)
        state_by_normalized_name = {}
        for norm_name, states in state_candidates.items():
            state_by_normalized_name[norm_name] = max(states, key=lambda s: s.cities.count())
        india = Country.objects.filter(code="IN").first()
        if not india:
            raise CommandError("No Country row with code='IN' exists — cannot attribute new cities.")

        release = SourceRelease.objects.create(
            source=source,
            version_label=timezone.now().strftime("%Y-%m-%d"),
            record_count=None,
        )
        batch = ImportBatch.objects.create(
            release=release,
            command_name="import_geonames",
            dry_run=not apply_mode,
            status="dry_run" if not apply_mode else "running",
            params={"max_new_cities": options["max_new_cities"]},
        )

        metrics = {
            "mode": "apply" if apply_mode else "dry_run",
            "batch_id": batch.pk,
            "geonames_rows_seen": 0,
            "populated_place_rows": 0,
            "admin2_rows": 0,
            "cities_backfilled_normalized_name": 0,
            "cities_matched": 0,
            "cities_updated_geonameid": 0,
            "cities_geonameid_conflict_skipped": 0,
            "aliases_created": 0,
            "districts_created": 0,
            "new_cities_created": 0,
            "new_city_candidates_staged": 0,
            "unmatched_generic_populated_places": 0,
        }

        # Prerequisite data-hygiene fix: normalize_name is empty on ~43% of
        # existing City rows (found this session; blocks name-based matching
        # entirely for those rows). Backfilling it is additive and safe.
        cities_missing_normalized = list(City.objects.filter(normalized_name=""))
        metrics["cities_backfilled_normalized_name"] = len(cities_missing_normalized)
        if apply_mode:
            for city in cities_missing_normalized:
                city.normalized_name = normalize_search_name(city.name)
            City.objects.bulk_update(cities_missing_normalized, ["normalized_name"])

        # Build name -> [row, ...] index for populated-place and ADM2 rows only.
        name_index = defaultdict(list)
        admin2_rows = []
        for row in _load_geonames_rows(zip_bytes):
            metrics["geonames_rows_seen"] += 1
            if row["feature_class"] == "P":
                metrics["populated_place_rows"] += 1
                name_index[normalize_search_name(row["name"])].append(row)
                ascii_key = normalize_search_name(row["asciiname"])
                if ascii_key and ascii_key != normalize_search_name(row["name"]):
                    name_index[ascii_key].append(row)
            elif row["feature_class"] == "A" and row["feature_code"] == "ADM2":
                metrics["admin2_rows"] += 1
                admin2_rows.append(row)

        matched_geonameids = set()

        # Pass 1: reconcile existing cities against the GeoNames index.
        existing_cities = list(City.objects.select_related("state").all())
        for city in existing_cities:
            norm = city.normalized_name or normalize_search_name(city.name)
            candidates = name_index.get(norm, [])
            if not candidates:
                continue

            resolved = None
            if len(candidates) == 1:
                resolved = candidates[0]
            else:
                # Disambiguate by state name, then by distance.
                state_name_norm = normalize_search_name(city.state.name) if city.state else None
                by_state = [
                    c for c in candidates
                    if admin1_crosswalk.get(f"IN.{c['admin1_code']}")
                    and normalize_search_name(admin1_crosswalk[f"IN.{c['admin1_code']}"]) == state_name_norm
                ] if state_name_norm else []
                pool = by_state or candidates
                if len(pool) == 1:
                    resolved = pool[0]
                elif valid_coordinates(city.latitude, city.longitude):
                    within = [
                        c for c in pool
                        if valid_coordinates(c["latitude"], c["longitude"])
                        and haversine_km(city.latitude, city.longitude, float(c["latitude"]), float(c["longitude"])) <= DISTANCE_THRESHOLD_KM
                    ]
                    if len(within) == 1:
                        resolved = within[0]

            if resolved is None:
                continue

            metrics["cities_matched"] += 1
            geonameid = int(resolved["geonameid"])

            if city.geonameid and city.geonameid != geonameid:
                metrics["cities_geonameid_conflict_skipped"] += 1
                if apply_mode:
                    flag_data_quality_issue(
                        city, "identity_conflict",
                        details={"existing_geonameid": city.geonameid, "candidate_geonameid": geonameid, "source": "geonames"},
                    )
                continue

            owned_elsewhere = City.objects.exclude(pk=city.pk).filter(geonameid=geonameid).exists()
            if owned_elsewhere:
                metrics["cities_geonameid_conflict_skipped"] += 1
                if apply_mode:
                    flag_data_quality_issue(
                        city, "identity_conflict",
                        details={"geonameid": geonameid, "reason": "already owned by another City row", "source": "geonames"},
                    )
                continue

            matched_geonameids.add(geonameid)

            if not city.geonameid:
                metrics["cities_updated_geonameid"] += 1
                if apply_mode:
                    city.geonameid = geonameid
                    population = int(resolved["population"]) if resolved["population"] else None
                    if population and not city.population:
                        city.population = population
                    city.save(update_fields=["geonameid", "population"])
                    record_field_provenance(
                        city, "geonameid", source_name="geonames", external_id=str(geonameid),
                        confidence=0.9, tier="open_dataset",
                    )
                    write_entity_map(city, source, str(geonameid), confidence=0.9)

            # Aliases from the inline alternatenames column. Queried regardless of
            # apply_mode — dry-run must reflect what already exists, not assume a
            # blank slate, or its "would create" count is misleading.
            alt_names = [a.strip() for a in resolved.get("alternatenames", "").split(",") if a.strip()]
            existing_aliases = {
                a.normalized_alias for a in CityAlias.objects.filter(city=city).only("normalized_alias")
            }
            created_for_city = 0
            for alt in alt_names:
                if created_for_city >= MAX_ALIASES_PER_CITY:
                    break
                alt_norm = normalize_search_name(alt)
                if not alt_norm or alt_norm == norm or alt_norm in existing_aliases:
                    continue
                metrics["aliases_created"] += 1
                created_for_city += 1
                if apply_mode:
                    CityAlias.objects.create(
                        city=city, alias_name=alt, alias_type="alternate_spelling",
                        source="geonames", verification_status="verified", verified_at=timezone.now(),
                    )
                    existing_aliases.add(alt_norm)

        # Pass 2: District rows from ADM2.
        for row in admin2_rows:
            state_name = admin1_crosswalk.get(f"IN.{row['admin1_code']}")
            state = state_by_normalized_name.get(normalize_search_name(state_name)) if state_name else None
            if not state:
                continue
            norm_name = normalize_search_name(row["name"])
            exists = District.objects.filter(state=state, name=row["name"]).exists()
            if not exists:
                metrics["districts_created"] += 1
                if apply_mode:
                    District.objects.get_or_create(
                        state=state, name=row["name"],
                        defaults={"normalized_name": norm_name, "source": "geonames_adm2"},
                    )

        # Pass 3: bounded new-city creation for unmatched PPLC/PPLA/PPLA2 rows.
        new_city_candidates = [
            row for rows in name_index.values() for row in rows
            if row["feature_code"] in NEW_CITY_FEATURE_CODES and int(row["geonameid"]) not in matched_geonameids
        ]
        # Dedup (a row can appear twice in the index via name+asciiname keys).
        seen_ids = set()
        deduped_candidates = []
        for row in new_city_candidates:
            gid = int(row["geonameid"])
            if gid in seen_ids:
                continue
            seen_ids.add(gid)
            deduped_candidates.append(row)

        for row in deduped_candidates[: options["max_new_cities"]]:
            state_name = admin1_crosswalk.get(f"IN.{row['admin1_code']}")
            state = state_by_normalized_name.get(normalize_search_name(state_name)) if state_name else None
            if not state or not valid_coordinates(row["latitude"], row["longitude"]):
                metrics["new_city_candidates_staged"] += 1
                if apply_mode:
                    StagingRecord.objects.create(
                        batch=batch, raw_payload=row, source_record_id=row["geonameid"],
                        normalized_payload={"name": row["name"], "reason": "no state crosswalk or invalid coords"},
                        match_status="rejected",
                    )
                continue

            already_exists = City.objects.filter(name=row["name"], state=state, country=india).exists()
            if already_exists:
                continue
            metrics["new_cities_created"] += 1
            if apply_mode:
                city, created = City.objects.get_or_create(
                    name=row["name"], state=state, country=india,
                    defaults={
                        "normalized_name": normalize_search_name(row["name"]),
                        "latitude": row["latitude"], "longitude": row["longitude"],
                        "geonameid": int(row["geonameid"]),
                        "population": int(row["population"]) if row["population"] else None,
                        "coordinate_confidence": 0.9,
                        "is_publishable": True,
                    },
                )
                if created:
                    record_field_provenance(
                        city, "geonameid", source_name="geonames", external_id=row["geonameid"],
                        confidence=0.9, tier="open_dataset",
                    )
                    write_entity_map(city, source, row["geonameid"], confidence=0.9)
                else:
                    metrics["new_cities_created"] -= 1

        metrics["unmatched_generic_populated_places"] = (
            metrics["populated_place_rows"] - metrics["cities_matched"] - len(deduped_candidates)
        )

        batch.finished_at = timezone.now()
        batch.status = "dry_run" if not apply_mode else "completed"
        batch.created_count = metrics["new_cities_created"] + metrics["districts_created"]
        batch.updated_count = metrics["cities_updated_geonameid"] + metrics["aliases_created"]
        batch.skipped_count = metrics["unmatched_generic_populated_places"]
        batch.conflicted_count = metrics["cities_geonameid_conflict_skipped"]
        batch.quarantined_count = metrics["new_city_candidates_staged"]
        if apply_mode:
            batch.save()
        else:
            batch.delete()  # dry-run leaves no bookkeeping row behind
            release.delete()

        if options["json"]:
            self.stdout.write(json.dumps(metrics, indent=2, sort_keys=True))
        else:
            self.stdout.write(self.style.SUCCESS(json.dumps(metrics, indent=2)))
