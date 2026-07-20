"""Phase 4 train-route importer (master plan §7.1/§9.1/§14 Phase 4).

Populates ``TrainRoute`` from the datameet/railways ``trains.json`` GeoJSON
snapshot (CC0, already approved in the master plan §5 for station coordinates;
this phase is the first to use its train-service features for route facts).

5,208 real train-service features exist upstream; many share the same
(from_station, to_station) pair (multiple trains on the same corridor). This
importer creates **one** ``TrainRoute`` row per station pair — duration is the
shortest real service seen (an honest, defensible single value for a table
whose current schema has one ``duration_mins`` column, not a list) —
and records how many distinct train numbers were folded into it via
``frequency_per_day`` and ``service_class_meta``.

Every row is stamped ``provenance_tier="derived"`` — this is a real, dated
train-service snapshot from a community-maintained repo, not a live or
official schedule; it is never marked ``verified``/``authoritative``.

``--dry-run`` is the default.
"""

import io
import json
import re
from collections import defaultdict

import requests
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from apps.reference.models import ImportBatch, RailwayStation, SourceRegistry, SourceRelease, TrainRoute
from apps.reference.services.reconciliation import record_field_provenance
from apps.reference.utils import normalize_code

TRAINS_JSON_URL = "https://raw.githubusercontent.com/datameet/railways/master/trains.json"


def _duration_mins(props):
    hours = props.get("duration_h") or 0
    mins = props.get("duration_m") or 0
    try:
        total = int(hours) * 60 + int(mins)
    except (TypeError, ValueError):
        return None
    return total if total > 0 else None


class Command(BaseCommand):
    help = "Populate TrainRoute from datameet/railways trains.json (dry-run by default)."

    def add_arguments(self, parser):
        mode = parser.add_mutually_exclusive_group()
        mode.add_argument("--apply", action="store_true")
        mode.add_argument("--dry-run", action="store_true")
        parser.add_argument("--file", help="Local path to a pre-downloaded trains.json.")
        parser.add_argument("--json", action="store_true")

    def handle(self, *args, **options):
        apply_mode = bool(options["apply"])
        source = SourceRegistry.objects.filter(slug="datameet_railways", active=True).first()
        if not source:
            # datameet was approved in the master plan before SourceRegistry existed
            # (Phase 0-era station-coordinate use); register it now if missing,
            # matching the same slug convention as the other Phase 3 sources.
            source, _ = SourceRegistry.objects.get_or_create(
                slug="datameet_railways",
                defaults={
                    "publisher": "DataMeet community",
                    "licence_name": "CC0",
                    "licence_url": "https://github.com/datameet/railways",
                    "storage_permissions": {"raw": True, "normalized": True},
                    "attribution_text": "Train data from datameet/railways (CC0).",
                    "priority_rank": 30,
                    "active": True,
                    "licence_verified_at": timezone.now(),
                },
            )

        if options["file"]:
            with open(options["file"], encoding="utf-8") as fh:
                data = json.load(fh)
        else:
            resp = requests.get(TRAINS_JSON_URL, timeout=60)
            resp.raise_for_status()
            data = resp.json()

        release = SourceRelease.objects.create(
            source=source, version_label=timezone.now().strftime("%Y-%m-%d"),
            record_count=len(data.get("features", [])),
        )
        batch = ImportBatch.objects.create(
            release=release, command_name="import_datameet_train_routes",
            dry_run=not apply_mode, status="dry_run" if not apply_mode else "running",
        )

        stations_by_code = {
            normalize_code(s.code): s for s in RailwayStation.objects.all()
        }

        pairs = defaultdict(list)
        for feature in data.get("features", []):
            props = feature.get("properties") or {}
            from_code = normalize_code(props.get("from_station_code", ""))
            to_code = normalize_code(props.get("to_station_code", ""))
            if not from_code or not to_code or from_code == to_code:
                continue
            pairs[(from_code, to_code)].append(props)

        metrics = {
            "mode": "apply" if apply_mode else "dry_run",
            "batch_id": batch.pk,
            "features_seen": len(data.get("features", [])),
            "distinct_station_pairs": len(pairs),
            "matched_pairs": 0,
            "unmatched_station_code": 0,
            "created": 0,
            "updated": 0,
            "already_current": 0,
        }

        for (from_code, to_code), features in pairs.items():
            source_station = stations_by_code.get(from_code)
            dest_station = stations_by_code.get(to_code)
            if not source_station or not dest_station:
                metrics["unmatched_station_code"] += 1
                continue
            metrics["matched_pairs"] += 1

            best = min(
                (f for f in features if _duration_mins(f) is not None),
                key=_duration_mins, default=features[0],
            )
            duration = _duration_mins(best)
            distances = [f.get("distance") for f in features if f.get("distance")]
            distance_km = min(distances) if distances else None
            train_numbers = sorted({f.get("number") for f in features if f.get("number")})

            route = TrainRoute.objects.filter(source=source_station, destination=dest_station).first()
            fields_changed = route is None
            if route is None:
                route = TrainRoute(
                    source=source_station, destination=dest_station,
                    train_name=best.get("name", "")[:255], train_number=str(best.get("number", ""))[:20],
                )
            if route.duration_mins != duration:
                route.duration_mins = duration
                fields_changed = True
            if distance_km is not None and route.distance_km != distance_km:
                route.distance_km = distance_km
                fields_changed = True
            new_freq = min(len(train_numbers), 20)  # bounded — a real per-day count needs schedules.json
            if route.frequency_per_day != new_freq:
                route.frequency_per_day = new_freq
                fields_changed = True
            route.provenance_tier = "derived"
            route.confidence = 0.6
            route.freshness_at = None  # honest: no per-row date exists upstream
            route.service_class_meta = {
                "source": "datameet_trains_json",
                "sample_train_numbers": train_numbers[:10],
                "distinct_trains_on_corridor": len(train_numbers),
                "staleness_note": "single-instance schedule snapshot, not a live/current timetable",
            }

            if fields_changed:
                if route.pk:
                    metrics["updated"] += 1
                else:
                    metrics["created"] += 1
                if apply_mode:
                    route.save()
                    record_field_provenance(
                        route, "duration_mins", source_name="datameet_railways",
                        external_id=f"{from_code}-{to_code}", confidence=0.6, tier="derived",
                    )
            else:
                metrics["already_current"] += 1

        batch.finished_at = timezone.now()
        batch.status = "dry_run" if not apply_mode else "completed"
        batch.created_count = metrics["created"]
        batch.updated_count = metrics["updated"]
        batch.skipped_count = metrics["unmatched_station_code"]
        if apply_mode:
            batch.save()
        else:
            batch.delete()
            release.delete()

        if options["json"]:
            self.stdout.write(json.dumps(metrics, indent=2, sort_keys=True))
        else:
            self.stdout.write(self.style.SUCCESS(json.dumps(metrics, indent=2)))
