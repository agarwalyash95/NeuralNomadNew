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
    travel_month = start_date.month if start_date else None

    normal = _weather_from_normals(destination_text, travel_month)
    if normal is None:
        return {
            "weather": {
                "avg_temp_c": None,
                "precipitation_mm": None,
                "provenance": "unknown",
                "note": "No climate data available for this destination yet.",
            },
            "packing": ["Comfortable walking shoes", "Phone charger", "Reusable water bottle"],
        }

    avg_temp = float(normal.avg_temp_c) if normal.avg_temp_c is not None else None
    precip = float(normal.precipitation_mm) if normal.precipitation_mm is not None else None
    packing = _packing_from_bucket(normal.feels_like_bucket, precip)
    if normal.packing_note:
        packing.append(normal.packing_note)

    return {
        "weather": {
            "avg_temp_c": avg_temp,
            "precipitation_mm": precip,
            "feels_like_bucket": normal.feels_like_bucket,
            "provenance": "estimated",
            "note": f"Based on historical climate averages for {destination_text or 'this destination'}.",
        },
        "packing": packing,
    }
