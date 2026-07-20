"""Shared geospatial primitives for reference and planner services.

Coordinate storage is deliberately opaque to callers. Today it is backed by paired
Decimal fields; a future PostGIS implementation can replace the queryset internals here
without changing consumers.
"""

import math


EARTH_RADIUS_KM = 6371.0
KM_PER_LATITUDE_DEGREE = 111.32
PLACEHOLDER_COORDINATES = ((20.5937, 78.9629),)


def _number(value):
    try:
        return float(value)
    except (TypeError, ValueError, OverflowError):
        return None


def valid_coordinates(latitude, longitude):
    """Return whether a coordinate pair is present, finite, and globally in range."""
    lat = _number(latitude)
    lng = _number(longitude)
    return bool(
        lat is not None
        and lng is not None
        and math.isfinite(lat)
        and math.isfinite(lng)
        and -90.0 <= lat <= 90.0
        and -180.0 <= lng <= 180.0
    )


def is_placeholder(latitude, longitude, tolerance=0.000001):
    """Return whether the pair matches a known coordinate sentinel."""
    if not valid_coordinates(latitude, longitude):
        return False
    lat = float(latitude)
    lng = float(longitude)
    return any(
        abs(lat - placeholder_lat) <= tolerance
        and abs(lng - placeholder_lng) <= tolerance
        for placeholder_lat, placeholder_lng in PLACEHOLDER_COORDINATES
    )


def haversine_km(lat1, lng1, lat2, lng2):
    """Return great-circle distance in kilometres, or infinity for invalid input."""
    if not valid_coordinates(lat1, lng1) or not valid_coordinates(lat2, lng2):
        return float("inf")
    lat1, lng1, lat2, lng2 = map(float, (lat1, lng1, lat2, lng2))
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lng2 - lng1)
    value = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    )
    value = min(1.0, max(0.0, value))
    return EARTH_RADIUS_KM * 2.0 * math.atan2(math.sqrt(value), math.sqrt(1.0 - value))


def bounding_box(latitude, longitude, radius_km):
    """Return a latitude-aware `(min_lat, max_lat, min_lng, max_lng)` window."""
    if not valid_coordinates(latitude, longitude):
        raise ValueError("A valid center coordinate is required.")
    radius = _number(radius_km)
    if radius is None or radius < 0:
        raise ValueError("radius_km must be a non-negative number.")

    latitude = float(latitude)
    longitude = float(longitude)
    lat_delta = radius / KM_PER_LATITUDE_DEGREE
    cosine = abs(math.cos(math.radians(latitude)))
    lng_delta = 180.0 if cosine < 1e-12 else min(180.0, radius / (KM_PER_LATITUDE_DEGREE * cosine))
    return (
        max(-90.0, latitude - lat_delta),
        min(90.0, latitude + lat_delta),
        max(-180.0, longitude - lng_delta),
        min(180.0, longitude + lng_delta),
    )


def bbox_prefilter(queryset, latitude, longitude, radius_km, latitude_field="latitude", longitude_field="longitude"):
    """Apply the indexed degree window before exact Haversine sorting."""
    min_lat, max_lat, min_lng, max_lng = bounding_box(latitude, longitude, radius_km)
    return queryset.filter(
        **{
            f"{latitude_field}__range": (min_lat, max_lat),
            f"{longitude_field}__range": (min_lng, max_lng),
        }
    )


def nearest(queryset, latitude, longitude, radius_km, limit=20, latitude_field="latitude", longitude_field="longitude"):
    """Return exact-distance-sorted objects inside a bounded indexed prefilter."""
    if limit is not None and limit < 0:
        raise ValueError("limit must be non-negative or None.")
    candidates = bbox_prefilter(
        queryset,
        latitude,
        longitude,
        radius_km,
        latitude_field=latitude_field,
        longitude_field=longitude_field,
    )
    # Nearest sorting needs only identity + coordinates. Django transparently
    # fetches any other field a caller later reads, while the hot path avoids
    # materializing wide JSON/text payloads for every bbox candidate.
    candidates = candidates.only("pk", latitude_field, longitude_field)
    ranked = []
    for obj in candidates:
        distance = haversine_km(
            getattr(obj, latitude_field, None),
            getattr(obj, longitude_field, None),
            latitude,
            longitude,
        )
        if distance <= radius_km:
            obj.distance_km = round(distance, 3)
            ranked.append(obj)
    ranked.sort(key=lambda item: item.distance_km)
    return ranked if limit is None else ranked[:limit]
