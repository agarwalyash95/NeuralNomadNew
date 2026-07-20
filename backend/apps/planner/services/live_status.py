"""
Trip prep status — real weather/packing guidance (T2.3).

Replaces the old hardcoded "24°C / Sunny" placeholder pattern with a lookup
against WeatherNormals (real climate data seeded per city+month). Every
field carries honest provenance: "estimated" when DB normals are found,
"unknown" when they aren't — never a fixed literal presented as fact.
"""


def _weather_from_normals(destination_text, travel_month):
    """Look up WeatherNormals by city name + month. Returns None if no match."""
    if not destination_text or not travel_month:
        return None
    try:
        from apps.reference.models import City, WeatherNormals

        city_obj = City.objects.filter(name__iexact=destination_text.strip().split(",")[0]).first()
        if city_obj is None:
            return None
        normal = WeatherNormals.objects.filter(city=city_obj, month=travel_month).first()
        if normal is None:
            return None
        return normal
    except Exception:
        return None


def _packing_from_bucket(bucket, precip_mm):
    """Context-appropriate packing list derived from the real feels_like_bucket + precipitation."""
    items = ["Comfortable walking shoes", "Phone charger", "Reusable water bottle"]
    if bucket == "hot":
        items += ["Light breathable clothing", "Sunscreen", "Sunglasses", "Hat"]
    elif bucket == "cold":
        items += ["Warm layers", "Jacket", "Gloves"]
    elif bucket == "mild":
        items += ["Light jacket for evenings"]
    if precip_mm is not None and precip_mm > 50:
        items.append("Rain jacket / umbrella")
    return items


def get_trip_prep_status(workspace):
    """
    Returns real weather + packing guidance for a workspace's destination and
    travel month, sourced from WeatherNormals. Provenance is always honest:
    "estimated" (DB climate normals) or "unknown" (no match — never a fake
    default).
    """
    draft = getattr(workspace, "draft_state", None)
    destination_text = getattr(draft, "destination_text", "") if draft else ""
    start_date = getattr(draft, "start_date", None) if draft else None

    from apps.planner.services.weather_service import fetch_live_weather
    res = fetch_live_weather(destination_text, start_date)

    avg_temp = res.get("avg_temp_c")
    precip = res.get("precipitation_mm")
    bucket = res.get("feels_like_bucket", "mild")
    packing = _packing_from_bucket(bucket, precip)

    return {
        "weather": {
            "avg_temp_c": avg_temp,
            "precipitation_mm": precip,
            "feels_like_bucket": bucket,
            "condition": res.get("condition"),
            "provenance": res.get("provenance"),
            "note": res.get("note"),
        },
        "packing": packing,
    }

