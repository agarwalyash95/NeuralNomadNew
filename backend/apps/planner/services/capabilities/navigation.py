"""
Navigation capabilities (docs/conversation-capability-layer.md §6) — MVP
scope is `distance` only; route/map/street-view are deferred to the same
producer + registry pattern.
"""

from apps.planner.services.capabilities.base import capability_envelope
from apps.planner.services.distance_service import haversine_distance_km


def distance(origin_lat=None, origin_lng=None, dest_lat=None, dest_lng=None,
             origin_name=None, dest_name=None, **_):
    if None in (origin_lat, origin_lng, dest_lat, dest_lng):
        return capability_envelope(
            "distance", {"origin": origin_name, "destination": dest_name}, freshness="derived",
            degraded=True, degraded_reason="Need both locations' coordinates to compute distance.",
        )
    km = haversine_distance_km(origin_lat, origin_lng, dest_lat, dest_lng)
    return capability_envelope("distance", {
        "origin": origin_name,
        "destination": dest_name,
        "distance_km": round(km, 1),
    }, freshness="derived")
