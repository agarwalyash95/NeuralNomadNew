"""Phase 3 reconciliation ladder (master plan §7.3).

Matching order, cheapest/most-certain first:
  1. Exact external-id match on a fast-path column (geonameid/iata_code/etc).
  2. Cross-id via ``ProviderEntityMap``.
  3. Normalized name + admin container (state) + distance <= threshold.
  4. Otherwise: ``ambiguous`` — caller stages the row for report 8, never merges.

This module never merges two existing canonical rows. That is exclusively the
job of the human-gated ``merge_reference_entities`` command.
"""

from django.contrib.contenttypes.models import ContentType
from django.utils import timezone

from apps.reference.services.geo import haversine_km, valid_coordinates
from apps.reference.utils import normalize_search_name

MATCHED = "matched"
AMBIGUOUS = "ambiguous"
UNMATCHED = "unmatched"


def record_field_provenance(instance, field_name, source_name, external_id="", confidence=0.85,
                             tier="open_dataset", metadata=None):
    """Write a new current provenance row for one field, superseding any prior one."""
    from apps.reference.models import ReferenceFieldProvenance

    content_type = ContentType.objects.get_for_model(instance)
    now = timezone.now()
    ReferenceFieldProvenance.objects.filter(
        content_type=content_type, object_id=str(instance.pk),
        field_name=field_name, is_current=True,
    ).update(is_current=False, superseded_at=now)
    return ReferenceFieldProvenance.objects.create(
        content_type=content_type,
        object_id=str(instance.pk),
        field_name=field_name,
        source_name=source_name,
        external_id=external_id or None,
        retrieved_at=now,
        confidence=confidence,
        provenance_tier=tier,
        metadata=metadata or {},
    )


def flag_data_quality_issue(instance, issue_type, details=None):
    from apps.reference.models import DataQualityIssue

    content_type = ContentType.objects.get_for_model(instance)
    return DataQualityIssue.objects.create(
        content_type=content_type,
        object_id=str(instance.pk),
        issue_type=issue_type,
        details=details or {},
    )


def write_entity_map(instance, source, external_id, confidence=1.0):
    from apps.reference.models import ProviderEntityMap

    content_type = ContentType.objects.get_for_model(instance)
    obj, _ = ProviderEntityMap.objects.update_or_create(
        source=source, external_id=external_id,
        defaults={
            "content_type": content_type,
            "object_id": str(instance.pk),
            "match_confidence": confidence,
        },
    )
    return obj


def match_city(queryset, name, state=None, latitude=None, longitude=None, geonameid=None,
               distance_threshold_km=10.0):
    """Return ``(city_or_none, status)``.

    ``status`` is one of ``MATCHED``/``AMBIGUOUS``/``UNMATCHED``. Exact
    ``geonameid`` match short-circuits everything else. Otherwise candidates
    are narrowed by normalized name (+ state, when given); ties are broken by
    distance; anything left unresolved after that is ``AMBIGUOUS``, never
    guessed.
    """
    if geonameid:
        exact = queryset.filter(geonameid=geonameid).first()
        if exact:
            return exact, MATCHED

    norm = normalize_search_name(name)
    if not norm:
        return None, UNMATCHED

    candidates = queryset.filter(normalized_name=norm)
    if state is not None:
        candidates = candidates.filter(state=state)
    candidates = list(candidates)

    if not candidates:
        return None, UNMATCHED

    have_coords = valid_coordinates(latitude, longitude)

    if len(candidates) == 1:
        candidate = candidates[0]
        if have_coords and valid_coordinates(candidate.latitude, candidate.longitude):
            distance = haversine_km(latitude, longitude, candidate.latitude, candidate.longitude)
            if distance > distance_threshold_km:
                return None, AMBIGUOUS
        return candidate, MATCHED

    if have_coords:
        within_threshold = []
        for candidate in candidates:
            if not valid_coordinates(candidate.latitude, candidate.longitude):
                continue
            distance = haversine_km(latitude, longitude, candidate.latitude, candidate.longitude)
            if distance <= distance_threshold_km:
                within_threshold.append((distance, candidate))
        if len(within_threshold) == 1:
            return within_threshold[0][1], MATCHED

    return None, AMBIGUOUS


def match_place_by_name_distance(queryset, name, latitude=None, longitude=None, distance_threshold_km=0.3):
    """Phase 6: match a place (hotel/restaurant/attraction/activity) by
    normalized name within an already-city-scoped queryset, disambiguated by
    coordinate proximity when more than one same-named row exists (e.g. chain
    outlets). Same three-way (matched/ambiguous/unmatched) contract as
    ``match_city``, but compares names in Python rather than filtering by a
    stored ``normalized_name`` column — the four entity master tables have no
    such column (unlike ``City``), and a city-scoped queryset here is small
    enough (dozens-hundreds of rows) that this is cheap. ``distance_threshold_km``
    defaults far tighter than ``match_city``'s 10km (city-level): two
    same-named POIs within one city are common, and a wrong match at POI
    granularity silently merges two different real places.
    """
    norm = normalize_search_name(name)
    if not norm:
        return None, UNMATCHED

    candidates = [row for row in queryset if normalize_search_name(row.name) == norm]
    if not candidates:
        return None, UNMATCHED

    have_coords = valid_coordinates(latitude, longitude)

    if len(candidates) == 1:
        candidate = candidates[0]
        if have_coords and valid_coordinates(candidate.latitude, candidate.longitude):
            distance = haversine_km(latitude, longitude, candidate.latitude, candidate.longitude)
            if distance > distance_threshold_km:
                return None, AMBIGUOUS
        return candidate, MATCHED

    if have_coords:
        within_threshold = []
        for candidate in candidates:
            if not valid_coordinates(candidate.latitude, candidate.longitude):
                continue
            distance = haversine_km(latitude, longitude, candidate.latitude, candidate.longitude)
            if distance <= distance_threshold_km:
                within_threshold.append((distance, candidate))
        if len(within_threshold) == 1:
            return within_threshold[0][1], MATCHED

    return None, AMBIGUOUS


def match_by_code(queryset, code_field, code_value):
    """Exact-code match helper (IATA/station code) — the common case for
    Airport/RailwayStation reconciliation. Returns ``(obj_or_none, status)``."""
    if not code_value:
        return None, UNMATCHED
    match = queryset.filter(**{code_field: code_value}).first()
    return (match, MATCHED) if match else (None, UNMATCHED)
