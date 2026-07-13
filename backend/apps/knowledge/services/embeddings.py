"""
Semantic embeddings — Gemini's embedding endpoint via the same google-genai
client already used for LLM calls (no second AI vendor). See
docs/travel-knowledge-engine-plan.md §10.

gemini-embedding-001's native output is 3072-dim; requested down to 768 via
Matryoshka truncation (output_dimensionality) to match EntityEmbedding's
schema — confirmed against the live API, not assumed.
"""

import hashlib
import logging

logger = logging.getLogger(__name__)

EMBEDDING_MODEL = "gemini-embedding-001"
EMBEDDING_DIMENSIONS = 768
EMBEDDING_VERSION = f"{EMBEDDING_MODEL}-{EMBEDDING_DIMENSIONS}d"


def _source_text(instance, category):
    """The text actually indexed — name + category-relevant descriptive fields."""
    parts = [instance.name]
    if category == "hotel":
        parts += [instance.primary_type or "", instance.editorial_summary or "", instance.address or ""]
    elif category == "restaurant":
        parts += [instance.cuisine or "", instance.editorial_summary or "", instance.address or ""]
    elif category == "attraction":
        parts += [instance.category or "", instance.editorial_summary or "", instance.address or ""]
    elif category == "activity":
        parts += [instance.category or "", instance.editorial_summary or "", instance.address or ""]
    return " — ".join(p for p in parts if p)


def embed_text(text):
    """Returns a 768-dim float list, or None on any failure (never a crash)."""
    try:
        from google import genai
    except ImportError:
        logger.warning("google-genai not installed; embedding skipped")
        return None
    try:
        from apps.common.ai import get_genai_client
        client = get_genai_client()
        resp = client.models.embed_content(
            model=EMBEDDING_MODEL,
            contents=text,
            config=genai.types.EmbedContentConfig(output_dimensionality=EMBEDDING_DIMENSIONS),
        )
        return list(resp.embeddings[0].values)
    except Exception as exc:
        logger.warning("Embedding call failed: %s", exc)
        return None


def upsert_embedding(instance, category):
    """Re-embeds only when the source text actually changed (source_text_hash)."""
    from django.contrib.contenttypes.models import ContentType

    from apps.knowledge.models import EntityEmbedding

    text = _source_text(instance, category)
    if not text:
        return False
    text_hash = hashlib.sha256(text.encode()).hexdigest()

    content_type = ContentType.objects.get_for_model(instance)
    existing = EntityEmbedding.objects.filter(
        content_type=content_type, object_id=str(instance.pk), embedding_version=EMBEDDING_VERSION,
    ).first()
    if existing and existing.source_text_hash == text_hash:
        return False  # unchanged — no need to re-call the API

    vector = embed_text(text)
    if vector is None:
        return False

    EntityEmbedding.objects.update_or_create(
        content_type=content_type, object_id=str(instance.pk), embedding_version=EMBEDDING_VERSION,
        defaults={"embedding": vector, "source_text_hash": text_hash},
    )
    return True


def compute_embeddings_backlog(batch_size_per_category=10):
    """Popularity-ordered — same pattern as run_enrichment_pass."""
    from apps.reference.models import ActivityMaster, AttractionMaster, HotelMaster, RestaurantMaster

    models_by_category = {
        "hotel": HotelMaster, "restaurant": RestaurantMaster,
        "attraction": AttractionMaster, "activity": ActivityMaster,
    }
    results = {}
    for category, model in models_by_category.items():
        candidates = model.objects.order_by("-popularity_score", "-user_ratings_total")[:batch_size_per_category]
        done = sum(1 for instance in candidates if upsert_embedding(instance, category))
        results[category] = {"attempted": len(candidates), "embedded": done}
    return results


def semantic_search(query_text, categories=None, limit=10):
    """
    Hybrid-ready building block: cosine-similarity search over EntityEmbedding,
    resolved back to real model instances. `categories` restricts to a subset
    (e.g. ["restaurant"]); defaults to all four.
    """
    from django.contrib.contenttypes.models import ContentType
    from pgvector.django import CosineDistance

    from apps.knowledge.models import EntityEmbedding
    from apps.reference.models import ActivityMaster, AttractionMaster, HotelMaster, RestaurantMaster

    query_vector = embed_text(query_text)
    if query_vector is None:
        return []

    models_by_category = {
        "hotel": HotelMaster, "restaurant": RestaurantMaster,
        "attraction": AttractionMaster, "activity": ActivityMaster,
    }
    target_categories = categories or list(models_by_category.keys())
    ct_id_to_category = {ContentType.objects.get_for_model(models_by_category[c]).id: c for c in target_categories}

    rows = (
        EntityEmbedding.objects.filter(content_type_id__in=list(ct_id_to_category.keys()), embedding_version=EMBEDDING_VERSION)
        .annotate(distance=CosineDistance("embedding", query_vector))
        .order_by("distance")[:limit]
    )

    results = []
    for row in rows:
        category = ct_id_to_category[row.content_type_id]
        model = models_by_category[category]
        try:
            instance = model.objects.get(pk=row.object_id)
        except model.DoesNotExist:
            continue
        results.append({"instance": instance, "category": category, "distance": row.distance})
    return results
