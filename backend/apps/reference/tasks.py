"""
Background enrichment tasks for the reference app.

`refresh_stale_entities` is the popularity-adjusted background refresh
promised by the Knowledge Engine caching design (see
docs/travel-knowledge-engine-plan.md §4): entities are never refreshed
proactively just because a request came in (that's a request-time cache
read, handled by KnowledgeEngine.resolve()) — staleness is only ever
resolved here, on a schedule, most-popular-first.
"""

from datetime import timedelta

from celery import shared_task
from django.db.models import Q
from django.utils import timezone


def _is_stale(row):
    if row.last_enriched_at is None:
        return True
    return timezone.now() >= row.last_enriched_at + timedelta(days=row.enrichment_ttl_days)


def _refresh_stale_entities(batch_size_per_category=20):
    from apps.reference.services.places_explore import _category_config, fetch_place_by_id

    refreshed = 0
    attempted = 0
    per_category = {}

    for category, config in _category_config().items():
        model = config["model"]

        # Narrow on the DB side to a conservative window (>= 7 days, the
        # shortest realistic enrichment_ttl_days) — the exact per-row TTL
        # check runs in Python below, since comparing a DateTimeField against
        # "itself + a duration derived from an IntegerField" isn't portable
        # across SQLite/Postgres without fragile duration-expression SQL, and
        # this is a batch job, not a hot path, so the extra Python pass is fine.
        candidates = model.objects.filter(
            Q(last_enriched_at__isnull=True) | Q(last_enriched_at__lt=timezone.now() - timedelta(days=7))
        ).order_by("-popularity_score")

        stale = [row for row in candidates if _is_stale(row)][:batch_size_per_category]
        category_refreshed = 0
        for row in stale:
            if not row.place_id:
                continue
            attempted += 1
            ok = fetch_place_by_id(model, row.place_id, config["field_mask"], config["field_mapper"])
            if ok:
                refreshed += 1
                category_refreshed += 1
        per_category[category] = {"attempted": len(stale), "refreshed": category_refreshed}

    return {"attempted": attempted, "refreshed": refreshed, "by_category": per_category}


@shared_task(name="apps.reference.tasks.refresh_stale_entities")
def refresh_stale_entities():
    return _refresh_stale_entities()


@shared_task(name="apps.reference.tasks.enrich_place")
def enrich_place(category, object_id):
    """
    On-demand single-place LLM enrichment — fired the moment a place is
    actually looked at (details view, which every replace/select flow hits
    before confirming), instead of waiting for run_enrichment_pass's
    popularity-ordered batch to reach it. New/replaced places start at
    popularity_score=0 and can wait indefinitely for that batch otherwise.
    """
    from apps.knowledge.services.enrichment import enrich_one
    from apps.reference.services.places_explore import _category_config

    model = _category_config()[category]["model"]
    try:
        instance = model.objects.get(pk=object_id)
    except model.DoesNotExist:
        return False
    return enrich_one(category, instance)


@shared_task(name="apps.reference.tasks.run_enrichment_pass")
def run_enrichment_pass():
    """Hotel/Restaurant/Attraction LLM judgment synthesis — see apps.knowledge.services.enrichment."""
    from apps.knowledge.services.enrichment import run_enrichment_pass as _run

    return _run()


@shared_task(name="apps.reference.tasks.run_safety_etiquette_pass")
def run_safety_etiquette_pass():
    """City-level safety/etiquette LocalTip generation — see apps.knowledge.services.enrichment."""
    from apps.knowledge.services.enrichment import run_safety_etiquette_pass as _run

    return _run()


@shared_task(name="apps.reference.tasks.compute_embeddings_backlog")
def compute_embeddings_backlog():
    """Semantic embeddings for hybrid search — see apps.knowledge.services.embeddings."""
    from apps.knowledge.services.embeddings import compute_embeddings_backlog as _run

    return _run()
