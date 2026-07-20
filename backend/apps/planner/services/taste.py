"""
Per-user taste vector (M2 'compounding personal memory', Phase 4 —
docs/planner-north-star-audit-and-vision.md §4).

A taste vector is a single 768-dim embedding — an exponential moving
average of the real place embeddings (apps.reference.services.embeddings)
of everywhere a traveler has kept in a persisted plan or explicitly booked
(positive) and everywhere they've explicitly swapped away from in favor of
something else (negative, only once a vector already exists — nothing to
subtract from on a first-ever signal). Stored as an ordinary
TravelerProfile fact (no new model, no migration) so it inherits the same
provenance/inspectability/deletion guarantees every other traveler fact
already has.

Never fabricated: a place with no computed embedding yet (the embeddings
backlog hasn't reached it) silently contributes nothing — this must never
block or fail plan generation or a plan edit.
"""

import logging

logger = logging.getLogger(__name__)

TASTE_VECTOR_FACT_KEY = "taste_vector"
# Weight kept on the existing vector per update — slow, stable drift, so
# one trip's worth of signal never overwhelms years of accumulated taste.
_DECAY = 0.85


def _models_by_category():
    from apps.reference.models import ActivityMaster, AttractionMaster, HotelMaster, RestaurantMaster

    return {
        "attraction": AttractionMaster, "activity": ActivityMaster,
        "restaurant": RestaurantMaster, "hotel": HotelMaster,
    }


def _normalize(vector):
    norm = sum(v * v for v in vector) ** 0.5
    if norm == 0:
        return vector
    return [v / norm for v in vector]


def _taste_fact(profile):
    for fact in (profile.facts or []):
        if fact.get("key") == TASTE_VECTOR_FACT_KEY:
            return fact.get("value") or {}
    return None


def get_taste_vector(profile):
    """The user's current taste vector as a plain float list, or None if
    they don't have enough signal yet."""
    value = _taste_fact(profile)
    vector = (value or {}).get("vector")
    return vector if isinstance(vector, list) and vector else None


def taste_vector_from_facts(profile_facts):
    """Same as get_taste_vector, but from the flat `plan_context.profile_facts`
    dict (already keyed straight from TravelerProfile.facts) rather than a
    live TravelerProfile instance — the shape `_build_candidate_pool` already
    has on hand mid-generation, no extra DB round trip needed."""
    value = (profile_facts or {}).get(TASTE_VECTOR_FACT_KEY) or {}
    vector = value.get("vector")
    return vector if isinstance(vector, list) and vector else None


def update_taste_vector(profile, category, master_pk, direction=1.0, source_trip=None):
    """Blend one real place's embedding into the user's taste vector.
    direction=+1 for kept/booked, -1 for an explicit swap-away. A negative
    update on a still-empty vector is silently skipped — there's nothing
    yet to move away from. Best-effort: any failure (unknown category,
    place not found, not embedded yet) is a silent no-op, never a raise —
    this must never be allowed to break the plan mutation it's attached to.
    """
    try:
        model = _models_by_category().get(category)
        if model is None:
            return
        try:
            instance = model.objects.get(pk=master_pk)
        except model.DoesNotExist:
            return

        from apps.reference.services.embeddings import embedding_for

        embedding = embedding_for(instance, category)
        if embedding is None:
            return  # honest skip — never fabricate a vector for an unembedded place

        existing = get_taste_vector(profile)
        if existing is None:
            if direction < 0:
                return
            new_vector = _normalize(embedding)
            sample_count = 1
        else:
            if len(existing) != len(embedding):
                return  # embedding dimensionality changed underneath us — refuse to blend mismatched vectors
            blended = [existing[i] * _DECAY + embedding[i] * (1 - _DECAY) * direction for i in range(len(existing))]
            new_vector = _normalize(blended)
            sample_count = int((_taste_fact(profile) or {}).get("sample_count", 0) or 0) + 1

        from apps.reference.services.embeddings import EMBEDDING_VERSION

        profile.upsert_fact(
            TASTE_VECTOR_FACT_KEY,
            {"vector": new_vector, "sample_count": sample_count, "embedding_version": EMBEDDING_VERSION},
            provenance="inferred",
            source_trip=source_trip,
        )
    except Exception as exc:
        logger.warning("Taste-vector update failed (non-fatal): %s", exc)


def taste_candidates(profile_facts, category, city_obj, limit):
    """Real candidates retrieved by cosine similarity to this user's taste
    vector, scoped to the given city. Returns [] (never raises) when the
    user has no taste vector yet, retrieval fails, or nothing embeds in
    this city — the same honest-degrade contract as semantic retrieval."""
    vector = taste_vector_from_facts(profile_facts)
    if not vector:
        return []
    try:
        from apps.reference.services.embeddings import vector_search

        hits = vector_search(vector, categories=[category], limit=limit)
    except Exception as exc:
        logger.warning("Taste-vector retrieval failed for %s: %s", category, exc)
        return []
    return [
        hit["instance"] for hit in hits
        if hit.get("instance") is not None and hit["instance"].city_id == city_obj.id
    ]
