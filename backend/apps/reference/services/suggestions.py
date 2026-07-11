"""
Normalizes RestaurantMaster / AttractionMaster / ActivityMaster / HotelMaster
rows into ONE envelope shape for the frontend Helper Canvases.

This is deliberately not a serializer swap: the ModelSerializers in
serializers.py stay untouched (admin/CRUD keep raw model fields). This layer
only shapes what `explore`/`details` actions return, so the frontend consumes
exactly one "Suggestion" shape regardless of category — matching the trust
grammar the Plan Canvas already renders (see
apps/planner/services/block_schema.py).
"""

from apps.planner.services.block_schema import make_provenance, TIER_SUGGESTED

# Google price_level -> approx "for two" amount (INR), used only as a
# suggestion band, never presented as an exact quote.
_RESTAURANT_PRICE_BAND = {0: 200, 1: 200, 2: 500, 3: 1000, 4: 2000}
_RESTAURANT_PRICE_LABEL = {
    0: '₹200 for two', 1: '₹200 for two', 2: '₹500 for two',
    3: '₹1000 for two', 4: '₹2000 for two',
}


def _restaurant_fields(r):
    price_level = r.price_level
    return {
        "subtitle": (r.cuisine or r.primary_type or 'Restaurant'),
        "duration_label": None,
        "price_label": _RESTAURANT_PRICE_LABEL.get(price_level, '₹400 for two'),
        "cost_amount": _RESTAURANT_PRICE_BAND.get(price_level, 400),
        "cost_basis": "Approx. price band from Google Places, not an exact bill",
        "details": {
            "outdoor_seating": r.outdoor_seating,
            "good_for_groups": r.good_for_groups,
            "allows_dogs": r.allows_dogs,
            "good_for_children": r.good_for_children,
            "menu_for_children": r.menu_for_children,
            "serves_vegetarian_food": r.serves_vegetarian_food,
            "dine_in": r.dine_in,
            "takeout": r.takeout,
            "delivery": r.delivery,
            "parking_options": r.parking_options,
            "payment_options": r.payment_options,
            "reviews": r.reviews,
            "opening_hours": r.opening_hours,
            "national_phone_number": r.national_phone_number,
            "website_uri": r.website_uri,
            "editorial_summary": r.editorial_summary,
            "reservation_policy": r.reservation_policy,
            "typical_lead_time_days": r.typical_lead_time_days,
            "dietary_accommodations": r.dietary_accommodations or {},
        },
    }


def _attraction_fields(a):
    # 120 mins and the generic ticket string are ingest-time placeholders,
    # not facts about this attraction — suppress them rather than display them.
    duration_label = None
    if a.suggested_duration_mins and a.suggested_duration_mins != 120:
        duration_label = f"{round(a.suggested_duration_mins / 60, 1)} hrs"
    price_label = None
    if a.ticket_price_estimate and a.ticket_price_estimate != 'Free / Entry Fee Applies':
        price_label = a.ticket_price_estimate
    return {
        "subtitle": (a.category or a.primary_type or 'Attraction'),
        "duration_label": duration_label,
        "price_label": price_label,
        "cost_amount": None,
        "cost_basis": "Google Places listing — exact ticket price not available",
        "details": {
            "good_for_children": a.good_for_children,
            "wheelchair_accessible": a.wheelchair_accessible,
            "good_for_groups": a.good_for_groups,
            "parking_options": a.parking_options,
            "reviews": a.reviews,
            "opening_hours": a.opening_hours,
            "national_phone_number": a.national_phone_number,
            "website_uri": a.website_uri,
            "editorial_summary": a.editorial_summary,
            "accessibility_detail": a.accessibility_detail or {},
        },
    }


def _activity_fields(a):
    # price_estimate (₹1200), "3-4 hours", guided_tour/equipment_included=True
    # and difficulty "Moderate" were all hardcoded at ingest — never real data.
    # Google Places doesn't provide them; suppress until a real source exists.
    duration_label = a.suggested_duration if a.suggested_duration and a.suggested_duration not in ('3-4 hours', '3-4 hrs') else None
    real_price = float(a.price_estimate) if a.price_estimate is not None and float(a.price_estimate) != 1200.0 else None
    return {
        "subtitle": (a.category or a.primary_type or 'Activity'),
        "duration_label": duration_label,
        "price_label": f"₹{real_price:g}" if real_price is not None else None,
        "cost_amount": real_price,
        "cost_basis": "Google Places listing — indicative price, confirm with operator",
        "details": {
            "good_for_children": a.good_for_children,
            "good_for_groups": a.good_for_groups,
            "guided_tour": None,
            "equipment_included": None,
            "difficulty_level": None,
            "reviews": a.reviews,
            "opening_hours": a.opening_hours,
            "national_phone_number": a.national_phone_number,
            "website_uri": a.website_uri,
            "editorial_summary": a.editorial_summary,
            "accessibility_detail": a.accessibility_detail or {},
        },
    }


def _hotel_fields(h):
    return {
        "subtitle": f"{h.star_rating}★ Hotel" if h.star_rating else (h.primary_type or 'Hotel'),
        "duration_label": None,
        "price_label": None,
        "cost_amount": None,
        "cost_basis": "Google Places listing — no live rate yet, search to check availability",
        "details": {
            "star_rating": float(h.star_rating) if h.star_rating is not None else None,
            "price_range": h.price_range,
            "parking_options": h.parking_options,
            "payment_options": h.payment_options,
            "reviews": h.reviews,
            "opening_hours": h.opening_hours,
            "national_phone_number": h.national_phone_number,
            "website_uri": h.website_uri,
            "editorial_summary": h.editorial_summary,
            "seasonal_amenities": h.seasonal_amenities or [],
            "room_tiers": [
                {"tier_name": t.tier_name, "price_premium_pct": t.price_premium_pct, "feature_tags": t.feature_tags}
                for t in h.room_tiers.all()
            ] if h.pk else [],
        },
    }


_CATEGORY_FIELDS = {
    "restaurant": _restaurant_fields,
    "attraction": _attraction_fields,
    "activity": _activity_fields,
    "hotel": _hotel_fields,
}


def _place_insights(instance):
    """
    Cached AI judgment synthesis (apps.knowledge.services.enrichment) — real
    for whatever's actually been enriched, an empty dict for everything else
    rather than a placeholder. See docs/travel-intelligence-implementation-roadmap.md §1.
    """
    try:
        from django.contrib.contenttypes.models import ContentType

        from apps.knowledge.models import PlaceInsight
    except Exception:
        return {}

    content_type = ContentType.objects.get_for_model(instance)
    rows = PlaceInsight.objects.filter(content_type=content_type, object_id=str(instance.pk))
    out = {}
    for row in rows:
        out[row.insight_type] = {
            "text": row.text or None,
            **row.structured,
            "provenance": row.provenance,
        }
    return out


def _local_tips(instance):
    """
    Approved local tips (apps.knowledge.services.enrichment) attached to this
    place — scam warnings, etiquette, safety notes. Only tips that have
    cleared the human-review gate surface here; unreviewed auto-generated
    tips (default for scam_warning/after_dark/safety/emergency_prep) are
    withheld rather than shown as suggested-tier, because a wrong safety
    claim isn't proportionally bad the way a wrong restaurant tip is — see
    docs/travel-intelligence-implementation-roadmap.md §1.
    """
    try:
        from django.contrib.contenttypes.models import ContentType

        from apps.knowledge.models import LocalTip
    except Exception:
        return []

    content_type = ContentType.objects.get_for_model(instance)
    rows = LocalTip.objects.filter(
        content_type=content_type, object_id=str(instance.pk), needs_human_review=False
    ).order_by("category")[:3]
    return [
        {"category": row.category, "text": row.tip_text, "confidence": row.confidence}
        for row in rows
    ]


def to_suggestion(instance, category, distance_km=None):
    """Shape a single master-table instance into the normalized Suggestion envelope."""
    fields = _CATEGORY_FIELDS[category](instance)
    fields["details"]["insights"] = _place_insights(instance)
    fields["details"]["local_tips"] = _local_tips(instance)

    return {
        "id": instance.id,
        "place_id": instance.place_id,
        "category": category,
        "name": instance.name,
        "subtitle": fields["subtitle"],
        "rating": float(instance.user_rating) if instance.user_rating is not None else None,
        "ratings_count": getattr(instance, "user_ratings_total", 0) or 0,
        "image_url": instance.image_url or None,
        "secondary_images": getattr(instance, "secondary_images", []) or [],
        "address": instance.address,
        "latitude": float(instance.latitude) if instance.latitude is not None else None,
        "longitude": float(instance.longitude) if instance.longitude is not None else None,
        "distance_km": distance_km if distance_km is not None else getattr(instance, "distance_km", None),
        "duration_label": fields["duration_label"],
        "price_label": fields["price_label"],
        "cost": {
            "amount": fields["cost_amount"],
            "currency": "INR",
            "provenance": make_provenance(TIER_SUGGESTED, source="google_places", basis=fields["cost_basis"]),
        },
        "details": fields["details"],
    }


def to_suggestion_list(instances, category):
    return [to_suggestion(inst, category) for inst in instances]
