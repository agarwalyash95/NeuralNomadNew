"""Phase 7 compatibility shim — real implementation relocated to
apps.reference.services.enrichment (same content, PlaceInsight/LocalTip now
live in apps.reference — same tables, state-only move). Every real caller in
this codebase has been migrated to import from the new location directly;
this re-export exists only so anything still importing
`apps.knowledge.services.enrichment` keeps working unchanged.
"""

from apps.reference.services.enrichment import (  # noqa: F401
    enrich_activity,
    enrich_attraction,
    enrich_hotel,
    enrich_one,
    enrich_restaurant,
    generate_safety_etiquette_tips,
    needs_enrichment,
    run_enrichment_pass,
    run_safety_etiquette_pass,
)
