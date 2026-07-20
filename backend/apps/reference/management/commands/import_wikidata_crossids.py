"""Phase 3 Wikidata cross-ID importer (master plan §7.2/§14 Phase 3).

Batched SPARQL lookups against properties already reachable via our own
fast-path columns:
  - P1566 (GeoNames ID)   -> City.geonameid
  - P238  (IATA code)     -> Airport.iata_code
  - P296  (station code)  -> RailwayStation.code

Writes ``wikidata_id`` + field-level provenance + a ``ProviderEntityMap`` row
on every match. Wikidata is CC0 (verified in the master plan §5) — no
licence or attribution obligation blocks this.

Degrades to "no cross-ID this batch" on any SPARQL error (timeout, malformed
response, HTTP failure) rather than failing the whole run — city/airport
identity is never gated on Wikidata's availability.

``--dry-run`` is the default.
"""

import json

import requests
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from apps.reference.models import Airport, City, ImportBatch, RailwayStation, SourceRegistry, SourceRelease
from apps.reference.services.reconciliation import record_field_provenance, write_entity_map

WIKIDATA_SPARQL_URL = "https://query.wikidata.org/sparql"
CHUNK_SIZE = 300
REQUEST_HEADERS = {
    "User-Agent": "NeuralNomad-Phase3-Reconciliation/1.0 (reference data cross-ID import)",
    "Accept": "application/sparql-results+json",
}


def _chunks(seq, size):
    for i in range(0, len(seq), size):
        yield seq[i:i + size]


def _run_sparql(query):
    resp = requests.get(
        WIKIDATA_SPARQL_URL, params={"query": query, "format": "json"},
        headers=REQUEST_HEADERS, timeout=30,
    )
    resp.raise_for_status()
    return resp.json()


def _fetch_crossids(property_id, values, value_is_string=True):
    """Return {value: qid} for the given property over the given values,
    chunked. Returns whatever was resolved even if some chunks fail."""
    resolved = {}
    for chunk in _chunks(values, CHUNK_SIZE):
        if not chunk:
            continue
        values_clause = " ".join(
            f'"{v}"' if value_is_string else str(v) for v in chunk
        )
        query = f"""
        SELECT ?item ?value WHERE {{
          VALUES ?value {{ {values_clause} }}
          ?item wdt:{property_id} ?value .
        }}
        """
        try:
            data = _run_sparql(query)
        except Exception:
            continue  # degrade silently — see module docstring
        for binding in data.get("results", {}).get("bindings", []):
            qid_uri = binding.get("item", {}).get("value", "")
            value = binding.get("value", {}).get("value", "")
            qid = qid_uri.rsplit("/", 1)[-1] if qid_uri else None
            if qid and value:
                resolved[str(value)] = qid
    return resolved


class Command(BaseCommand):
    help = "Fetch Wikidata cross-IDs (geonameid/IATA/station code) for reference rows (dry-run by default)."

    def add_arguments(self, parser):
        mode = parser.add_mutually_exclusive_group()
        mode.add_argument("--apply", action="store_true")
        mode.add_argument("--dry-run", action="store_true")
        parser.add_argument("--json", action="store_true")
        parser.add_argument(
            "--skip", nargs="*", default=[], choices=["city", "airport", "railway_station"],
            help="Entity types to skip this run.",
        )

    def handle(self, *args, **options):
        apply_mode = bool(options["apply"])
        source = SourceRegistry.objects.filter(slug="wikidata", active=True).first()
        if not source:
            raise CommandError("SourceRegistry 'wikidata' is missing or inactive. Run seed_source_registry first.")

        release = SourceRelease.objects.create(
            source=source, version_label=timezone.now().strftime("%Y-%m-%d")
        )
        batch = ImportBatch.objects.create(
            release=release, command_name="import_wikidata_crossids",
            dry_run=not apply_mode, status="dry_run" if not apply_mode else "running",
        )

        metrics = {
            "mode": "apply" if apply_mode else "dry_run",
            "batch_id": batch.pk,
            "city": {"candidates": 0, "resolved": 0, "updated": 0, "conflicts": 0},
            "airport": {"candidates": 0, "resolved": 0, "updated": 0, "conflicts": 0},
            "railway_station": {"candidates": 0, "resolved": 0, "updated": 0, "conflicts": 0},
        }

        if "city" not in options["skip"]:
            self._reconcile(
                City, "city", "P1566", "geonameid",
                lambda c: str(c.geonameid) if c.geonameid else None,
                metrics["city"], source, apply_mode, value_is_string=True,
            )
        if "airport" not in options["skip"]:
            self._reconcile(
                Airport, "airport", "P238", "iata_code",
                lambda a: a.iata_code,
                metrics["airport"], source, apply_mode, value_is_string=True,
            )
        if "railway_station" not in options["skip"]:
            self._reconcile(
                RailwayStation, "railway_station", "P296", "code",
                lambda r: r.code,
                metrics["railway_station"], source, apply_mode, value_is_string=True,
            )

        batch.finished_at = timezone.now()
        batch.status = "dry_run" if not apply_mode else "completed"
        batch.updated_count = sum(m["updated"] for m in metrics.values() if isinstance(m, dict))
        batch.conflicted_count = sum(m["conflicts"] for m in metrics.values() if isinstance(m, dict))
        if apply_mode:
            batch.save()
        else:
            batch.delete()
            release.delete()

        if options["json"]:
            self.stdout.write(json.dumps(metrics, indent=2, sort_keys=True))
        else:
            self.stdout.write(self.style.SUCCESS(json.dumps(metrics, indent=2)))

    def _reconcile(self, model, label, property_id, key_field, key_fn, metrics, source, apply_mode, value_is_string):
        queryset = model.objects.filter(wikidata_id__isnull=True).exclude(**{f"{key_field}__isnull": True})
        rows = list(queryset)
        keys = [key_fn(row) for row in rows]
        keys = [k for k in keys if k]
        metrics["candidates"] = len(keys)
        if not keys:
            return

        resolved_map = _fetch_crossids(property_id, keys, value_is_string=value_is_string)
        metrics["resolved"] = len(resolved_map)

        for row in rows:
            key = key_fn(row)
            if not key or key not in resolved_map:
                continue
            qid = resolved_map[key]

            owned_elsewhere = model.objects.exclude(pk=row.pk).filter(wikidata_id=qid).exists()
            if owned_elsewhere:
                metrics["conflicts"] += 1
                continue

            metrics["updated"] += 1
            if apply_mode:
                row.wikidata_id = qid
                row.save(update_fields=["wikidata_id"])
                record_field_provenance(
                    row, "wikidata_id", source_name="wikidata", external_id=qid,
                    confidence=0.9, tier="open_dataset",
                )
                write_entity_map(row, source, qid, confidence=0.9)
