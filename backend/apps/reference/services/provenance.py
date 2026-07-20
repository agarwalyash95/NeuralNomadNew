"""Reference-row publishability filters shared by planner and explore services."""

from django.db.models import Q

from apps.reference.services.geo import is_placeholder, valid_coordinates


def _identity_q(field_names):
    identity = Q(name__isnull=False) & ~Q(name="") if "name" in field_names else Q()
    if "country" in field_names:
        identity &= Q(country__isnull=False)
    if "iata_code" in field_names:
        identity &= Q(iata_code__isnull=False) & ~Q(iata_code="")
    elif "code" in field_names:
        identity &= Q(code__isnull=False) & ~Q(code="")
    elif "place_id" in field_names and "external_id" in field_names:
        identity &= (
            (Q(place_id__isnull=False) & ~Q(place_id=""))
            | (Q(external_id__isnull=False) & ~Q(external_id=""))
        )
    return identity


def publishable(queryset):
    """Filter a coordinate-bearing reference queryset to planner-safe rows."""
    field_names = {field.name for field in queryset.model._meta.fields}
    if not {"latitude", "longitude"}.issubset(field_names):
        return queryset.none()

    queryset = queryset.filter(
        latitude__isnull=False,
        longitude__isnull=False,
        latitude__gte=-90,
        latitude__lte=90,
        longitude__gte=-180,
        longitude__lte=180,
    ).exclude(latitude=20.5937, longitude=78.9629)

    if "is_publishable" in field_names:
        queryset = queryset.filter(is_publishable=True)
    if "is_quarantined" in field_names:
        queryset = queryset.filter(is_quarantined=False)
    if "verification_status" in field_names:
        queryset = queryset.exclude(verification_status="quarantined")
    return queryset.filter(_identity_q(field_names))


def is_publishable_instance(instance):
    """Object equivalent of :func:`publishable` for already-loaded hub rows."""
    if not valid_coordinates(
        getattr(instance, "latitude", None), getattr(instance, "longitude", None)
    ):
        return False
    if is_placeholder(instance.latitude, instance.longitude):
        return False
    if hasattr(instance, "is_publishable") and not instance.is_publishable:
        return False
    if getattr(instance, "is_quarantined", False):
        return False
    if getattr(instance, "verification_status", None) == "quarantined":
        return False
    if not str(getattr(instance, "name", "") or "").strip():
        return False
    if hasattr(instance, "country_id") and not instance.country_id:
        return False
    if hasattr(instance, "iata_code") and not str(instance.iata_code or "").strip():
        return False
    if hasattr(instance, "code") and not str(instance.code or "").strip():
        return False
    if hasattr(instance, "place_id") and hasattr(instance, "external_id"):
        if not str(instance.place_id or instance.external_id or "").strip():
            return False
    return True


def exclude_unverified(queryset):
    """Compatibility alias retained while older callers migrate by phase."""
    return publishable(queryset)
