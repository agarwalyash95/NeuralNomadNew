"""
Search & Discovery capabilities (docs/conversation-capability-layer.md §3).

Thin wrappers over the existing DB-first, cache-on-miss place search
(apps.reference.services.places_explore.explore_places) — the same
substrate the Explore tabs already use, so results are always real
(master-table rows or freshly cached from Google Places), never invented.
"""

from apps.planner.services.capabilities.base import capability_envelope


def _serialize_place(p, category):
    rating = getattr(p, "user_rating", None)
    if rating is None:
        rating = getattr(p, "star_rating", None)
    distance_km = getattr(p, "distance_km", None)
    return {
        "id": p.pk,
        "name": p.name,
        "category": category,
        "rating": float(rating) if rating is not None else None,
        "address": getattr(p, "address", None),
        "image_url": getattr(p, "image_url", None),
        "latitude": float(p.latitude) if p.latitude is not None else None,
        "longitude": float(p.longitude) if p.longitude is not None else None,
        "distance_km": round(distance_km, 2) if distance_km is not None else None,
    }


def _run_search(category, destination_text, limit=6):
    from apps.reference.services.places_explore import _category_config, explore_places

    if not destination_text:
        return None, "no destination known yet"

    config = _category_config().get(category)
    if not config:
        return None, f"unsupported category: {category}"

    google_query = config["query_template"].format(location=destination_text)
    source, places, error = explore_places(
        config["model"], destination_text, None, None,
        google_query, config["included_type"], config["field_mask"], config["field_mapper"],
    )
    if error:
        return None, error
    return [_serialize_place(p, category) for p in places[:limit]], None


def search_hotels(destination_text=None, **_):
    results, error = _run_search("hotel", destination_text)
    if error:
        return capability_envelope(
            "search_hotels", {"destination": destination_text, "results": []},
            freshness="slow", degraded=True, degraded_reason=error,
        )
    return capability_envelope("search_hotels", {"destination": destination_text, "results": results}, freshness="slow")


def search_restaurants(destination_text=None, **_):
    results, error = _run_search("restaurant", destination_text)
    if error:
        return capability_envelope(
            "search_restaurants", {"destination": destination_text, "results": []},
            freshness="slow", degraded=True, degraded_reason=error,
        )
    return capability_envelope("search_restaurants", {"destination": destination_text, "results": results}, freshness="slow")


def search_attractions(destination_text=None, **_):
    results, error = _run_search("attraction", destination_text)
    if error:
        return capability_envelope(
            "search_attractions", {"destination": destination_text, "results": []},
            freshness="slow", degraded=True, degraded_reason=error,
        )
    return capability_envelope("search_attractions", {"destination": destination_text, "results": results}, freshness="slow")


def nearby_search(destination_text=None, category="attraction", **_):
    category = category if category in ("hotel", "restaurant", "attraction", "activity") else "attraction"
    results, error = _run_search(category, destination_text)
    if error:
        return capability_envelope(
            "nearby_search", {"destination": destination_text, "category": category, "results": []},
            freshness="slow", degraded=True, degraded_reason=error,
        )
    return capability_envelope(
        "nearby_search", {"destination": destination_text, "category": category, "results": results}, freshness="slow",
    )
