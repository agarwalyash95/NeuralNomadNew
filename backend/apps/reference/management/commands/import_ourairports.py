"""Phase 3 OurAirports importer (master plan §7.2/§14 Phase 3).

Reconciles existing ``Airport`` rows against the OurAirports India extract
(``airports.csv`` — Public Domain, verified in the master plan §5) by IATA
code. Writes ``ourairports_ident`` and field-level provenance on matched
rows; conflicting identities become a ``DataQualityIssue``. No new ``Airport``
row is created by this command (open-data airport creation is out of scope
for Phase 3 — see the implementation packet §5).

``--dry-run`` is the default. Idempotent: re-running changes nothing once a
row is matched and its ``ourairports_ident`` already agrees.
"""

import csv
import io
import json

import requests
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from apps.reference.models import Airport, ImportBatch, SourceRegistry, SourceRelease
from apps.reference.services.reconciliation import (
    flag_data_quality_issue, record_field_provenance, write_entity_map,
)

OURAIRPORTS_URL = "https://ourairports.com/data/airports.csv"


class Command(BaseCommand):
    help = "Reconcile Airport rows against OurAirports India data by IATA code (dry-run by default)."

    def add_arguments(self, parser):
        mode = parser.add_mutually_exclusive_group()
        mode.add_argument("--apply", action="store_true")
        mode.add_argument("--dry-run", action="store_true")
        parser.add_argument("--file", help="Local path to a pre-downloaded airports.csv.")
        parser.add_argument("--json", action="store_true")

    def handle(self, *args, **options):
        apply_mode = bool(options["apply"])
        source = SourceRegistry.objects.filter(slug="ourairports", active=True).first()
        if not source:
            raise CommandError("SourceRegistry 'ourairports' is missing or inactive. Run seed_source_registry first.")

        if options["file"]:
            with open(options["file"], encoding="utf-8") as fh:
                text = fh.read()
        else:
            resp = requests.get(OURAIRPORTS_URL, timeout=60)
            resp.raise_for_status()
            text = resp.text

        release = SourceRelease.objects.create(
            source=source, version_label=timezone.now().strftime("%Y-%m-%d")
        )
        batch = ImportBatch.objects.create(
            release=release, command_name="import_ourairports",
            dry_run=not apply_mode, status="dry_run" if not apply_mode else "running",
        )

        metrics = {
            "mode": "apply" if apply_mode else "dry_run",
            "batch_id": batch.pk,
            "india_rows_seen": 0,
            "india_rows_with_iata": 0,
            "matched": 0,
            "updated": 0,
            "already_current": 0,
            "unmatched_no_airport": 0,
            "conflicts": 0,
        }

        reader = csv.DictReader(io.StringIO(text))
        for row in reader:
            if row.get("iso_country") != "IN":
                continue
            metrics["india_rows_seen"] += 1
            iata = (row.get("iata_code") or "").strip().upper()
            ident = (row.get("ident") or "").strip()
            if not iata:
                continue
            metrics["india_rows_with_iata"] += 1

            airport = Airport.objects.filter(iata_code=iata).first()
            if not airport:
                metrics["unmatched_no_airport"] += 1
                continue

            metrics["matched"] += 1

            if airport.ourairports_ident and airport.ourairports_ident != ident:
                metrics["conflicts"] += 1
                if apply_mode:
                    flag_data_quality_issue(
                        airport, "identity_conflict",
                        details={"existing_ident": airport.ourairports_ident, "candidate_ident": ident, "source": "ourairports"},
                    )
                continue

            owned_elsewhere = Airport.objects.exclude(pk=airport.pk).filter(ourairports_ident=ident).exists()
            if owned_elsewhere:
                metrics["conflicts"] += 1
                if apply_mode:
                    flag_data_quality_issue(
                        airport, "identity_conflict",
                        details={"ident": ident, "reason": "already owned by another Airport row", "source": "ourairports"},
                    )
                continue

            if airport.ourairports_ident == ident:
                metrics["already_current"] += 1
                continue

            metrics["updated"] += 1
            if apply_mode:
                airport.ourairports_ident = ident
                airport.save(update_fields=["ourairports_ident"])
                record_field_provenance(
                    airport, "ourairports_ident", source_name="ourairports", external_id=ident,
                    confidence=0.9, tier="open_dataset",
                )
                write_entity_map(airport, source, ident, confidence=0.9)

        batch.finished_at = timezone.now()
        batch.status = "dry_run" if not apply_mode else "completed"
        batch.updated_count = metrics["updated"]
        batch.skipped_count = metrics["unmatched_no_airport"]
        batch.conflicted_count = metrics["conflicts"]
        if apply_mode:
            batch.save()
        else:
            batch.delete()
            release.delete()

        if options["json"]:
            self.stdout.write(json.dumps(metrics, indent=2, sort_keys=True))
        else:
            self.stdout.write(self.style.SUCCESS(json.dumps(metrics, indent=2)))
