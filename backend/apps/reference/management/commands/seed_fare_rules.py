"""Idempotent seed of Phase 5 FareRule rows (docs/plans/reference-foundation-
and-planner-intelligence-master-plan.md §10.2).

Every row here is either (a) a number already live in the codebase, now
DB-sourced instead of a Python constant, or (b) a real, dated, cited public
fare table found via web research this phase. Nothing is guessed:

  - cab:   the exact Rs 300 + Rs 16/km already shipped in
           apps.planner.services.transport_compare — same numbers, new home.
  - bus:   UPSRTC's own published fare-calculation page (see SOURCES below),
           applied as a national fallback since no all-India per-km bus rate
           exists. Confidence intentionally discounted — a single state's
           rate stood in for a national default, and the source page's own
           stated effective window (25.12.2024-28.02.2025) has since lapsed
           without a re-check.
  - train: NOT seeded. IRCTC's distance-slab base fares are only published as
           scanned/binary PDF circulars (CC 11/2025, eff. 01.07.2025) that
           this session's tooling could not extract text from — see the
           phase-05 implementation report for the exact URLs tried. Left
           unseeded rather than guessed; price_estimator.estimate_train()
           honestly returns insufficient_data until a future session
           transcribes the real table (or OCRs the PDF).
  - metro: NOT seeded — no clean, obviously-sourceable flat-fare table
           surfaced during this phase's research pass.
"""

import json
from datetime import date

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.reference.models import FareRule, SourceRegistry


SOURCES = [
    {
        "slug": "upsrtc_fare_calculation",
        "publisher": "Uttar Pradesh State Road Transport Corporation (UPSRTC)",
        "licence_name": "Public tariff notification (no formal open-data licence)",
        "licence_url": "https://upsrtc.up.gov.in/en/article/fare-calculation",
        "storage_permissions": {"raw": False, "normalized": True},
        "attribution_text": "Bus fare rates published by UPSRTC (upsrtc.up.gov.in).",
        "priority_rank": 70,
        "active": True,
    },
]

FARE_RULES = [
    {
        "category": "cab",
        "name": "NeuralNomad intercity cab rate card (formalized)",
        "scope": "national",
        "city": None,
        "service_class": "",
        "unit": "per_km",
        "params": {"base_fare": 300, "per_km": 16},
        "valid_from": None,  # set to today at seed time — see handle()
        "valid_to": None,
        "source_slug": None,
        "provenance_tier": "derived",
        "confidence": 0.6,
    },
    {
        "category": "bus",
        "name": "UPSRTC Ordinary (non-AC) bus rate, national fallback — needs periodic re-verification",
        "scope": "national",
        "city": None,
        "service_class": "non_ac",
        "unit": "per_km",
        "params": {"base_fare": 0, "per_km": 1.30},
        "valid_from": date(2024, 12, 25),
        "valid_to": None,
        "source_slug": "upsrtc_fare_calculation",
        "provenance_tier": "derived",
        "confidence": 0.35,
    },
    {
        "category": "bus",
        "name": "UPSRTC AC (2x2) bus rate, national fallback — needs periodic re-verification",
        "scope": "national",
        "city": None,
        "service_class": "ac",
        "unit": "per_km",
        "params": {"base_fare": 0, "per_km": 1.94},
        "valid_from": date(2024, 12, 25),
        "valid_to": None,
        "source_slug": "upsrtc_fare_calculation",
        "provenance_tier": "derived",
        "confidence": 0.35,
    },
]


class Command(BaseCommand):
    help = "Idempotently seed/refresh the Phase 5 FareRule rows (real, cited numbers only)."

    def add_arguments(self, parser):
        parser.add_argument("--json", action="store_true")

    def handle(self, *args, **options):
        now = timezone.now()
        today = date.today()
        results = {"sources_created": [], "sources_updated": [], "rules_created": [], "rules_updated": [], "rules_unchanged": []}

        source_by_slug = {}
        for spec in SOURCES:
            slug = spec["slug"]
            defaults = {k: v for k, v in spec.items() if k != "slug"}
            defaults["licence_verified_at"] = now if defaults["active"] else None
            obj, created = SourceRegistry.objects.get_or_create(slug=slug, defaults=defaults)
            if created:
                results["sources_created"].append(slug)
            else:
                changed = False
                for field, value in defaults.items():
                    if field == "licence_verified_at":
                        continue
                    if getattr(obj, field) != value:
                        setattr(obj, field, value)
                        changed = True
                if changed:
                    obj.save()
                    results["sources_updated"].append(slug)
            source_by_slug[slug] = obj

        for spec in FARE_RULES:
            valid_from = spec["valid_from"] or today
            source = source_by_slug.get(spec["source_slug"]) if spec["source_slug"] else None
            lookup = {
                "category": spec["category"],
                "scope": spec["scope"],
                "city": spec["city"],
                "service_class": spec["service_class"],
            }
            defaults = {
                "name": spec["name"],
                "unit": spec["unit"],
                "params": spec["params"],
                "valid_from": valid_from,
                "valid_to": spec["valid_to"],
                "source": source,
                "provenance_tier": spec["provenance_tier"],
                "confidence": spec["confidence"],
                "freshness_at": now,
                "is_active": True,
            }
            obj, created = FareRule.objects.get_or_create(**lookup, defaults=defaults)
            label = f"{spec['category']}:{spec['service_class'] or 'default'}"
            if created:
                results["rules_created"].append(label)
                continue
            changed = False
            for field, value in defaults.items():
                if field == "freshness_at":
                    continue
                if getattr(obj, field) != value:
                    setattr(obj, field, value)
                    changed = True
            if changed:
                obj.freshness_at = now
                obj.save()
                results["rules_updated"].append(label)
            else:
                results["rules_unchanged"].append(label)

        if options["json"]:
            self.stdout.write(json.dumps(results, indent=2, sort_keys=True, default=str))
        else:
            self.stdout.write(self.style.SUCCESS(
                f"sources: created={len(results['sources_created'])} updated={len(results['sources_updated'])} | "
                f"rules: created={len(results['rules_created'])} updated={len(results['rules_updated'])} "
                f"unchanged={len(results['rules_unchanged'])}"
            ))
            self.stdout.write(self.style.WARNING(
                "train/metro FareRules were NOT seeded this pass — no confidently-sourced table found "
                "(see docstring + phase-05 implementation report)."
            ))
