"""
Shared "explore" flow for the four Google-Places-backed reference categories
(restaurant / attraction / activity / hotel).

Every category viewset used to duplicate this: resolve-or-create the city,
serve from cache when there's enough of it, otherwise hit the Places API,
save new rows (dedup by place_id), then distance-filter/sort by the active
node's coordinates. Keeping one copy means the four categories can't drift
apart in radius, cache threshold, or geo-filtering behavior.
"""

import math

import requests
from django.conf import settings
from django.db import transaction

from apps.reference.models import City, Country

RADIUS_KM = 15.0
MIN_CACHE_RESULTS = 5
SEARCH_URL = "https://places.googleapis.com/v1/places:searchText"


def haversine(lat1, lon1, lat2, lon2):
    R = 6371.0  # earth radius in km
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (math.sin(d_lat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def resolve_city(location):
    city_name = location.split(',')[0].strip()
    city_obj = City.objects.filter(name__iexact=city_name).first()
    if not city_obj:
        country_obj = Country.objects.first()
        if not country_obj:
            country_obj = Country.objects.create(name="India", code="IN")
        city_obj = City.objects.create(name=city_name.capitalize(), country=country_obj)
    return city_obj


def _distance_sort(places, lat_val, lng_val):
    """Filter to RADIUS_KM and sort nearest-first, annotating .distance_km."""
    filtered = []
    for place in places:
        if place.latitude is not None and place.longitude is not None:
            dist = haversine(lat_val, lng_val, float(place.latitude), float(place.longitude))
            if dist <= RADIUS_KM:
                place.distance_km = round(dist, 2)
                filtered.append(place)
    filtered.sort(key=lambda p: p.distance_km)
    return filtered


def extract_photos(photos, api_key):
    """Google Places `photos[].name` -> (primary image_url, [secondary urls])."""
    image_url = ''
    secondary_images = []
    if photos:
        first_photo = photos[0].get('name')
        if first_photo:
            image_url = f"https://places.googleapis.com/v1/{first_photo}/media?maxHeightPx=800&maxWidthPx=800&key={api_key}"
        for sp in photos[1:6]:
            spname = sp.get('name')
            if spname:
                secondary_images.append(f"https://places.googleapis.com/v1/{spname}/media?maxHeightPx=800&maxWidthPx=800&key={api_key}")
    return image_url, secondary_images


def extract_opening_hours(place_json):
    return place_json.get('regularOpeningHours', {}).get('weekdayDescriptions', [])


def extract_editorial_summary(place_json):
    return place_json.get('editorialSummary', {}).get('text', '')


def explore_places(model, location, lat_val, lng_val, google_query, included_type, field_mask, field_mapper):
    """
    model: the Django model class (RestaurantMaster, AttractionMaster, ActivityMaster, HotelMaster)
    location: raw "City[, Country]" string from the request
    lat_val/lng_val: optional floats used for geo-bias + post-fetch distance filtering
    google_query: fully-formatted Places `textQuery` string
    included_type: Places API `includedType` (e.g. "restaurant", "tourist_attraction", "lodging")
    field_mask: Places API `X-Goog-FieldMask` value for this category
    field_mapper(place_json, api_key) -> dict of model field kwargs (city/place_id are added by this function)

    Returns (source, places, error) where source is 'cache' | 'google_places' | 'error'
    and places is a list of model instances (each annotated with .distance_km when
    coordinates were supplied).
    """
    city_obj = resolve_city(location)
    has_coords = lat_val is not None and lng_val is not None

    cached_places = list(model.objects.filter(city=city_obj))
    if has_coords:
        cached_places = _distance_sort(cached_places, lat_val, lng_val)
    if len(cached_places) >= MIN_CACHE_RESULTS:
        return 'cache', cached_places, None

    api_key = getattr(settings, 'GOOGLE_PLACES_API_KEY', '')
    if not api_key:
        if cached_places:
            return 'cache', cached_places, None
        return 'error', None, 'Google API key missing'

    headers = {
        "X-Goog-Api-Key": api_key,
        "X-Goog-FieldMask": field_mask,
        "Content-Type": "application/json",
    }
    payload = {"textQuery": google_query, "maxResultCount": 15}
    if included_type:
        payload["includedType"] = included_type
    if has_coords:
        payload["locationBias"] = {
            "circle": {"center": {"latitude": lat_val, "longitude": lng_val}, "radius": 15000.0}
        }

    try:
        resp = requests.post(SEARCH_URL, headers=headers, json=payload, timeout=5)
        places_json = resp.json().get('places', [])
    except Exception as e:
        if cached_places:
            return 'cache', cached_places, None
        return 'error', str(e), None

    for p in places_json:
        place_id = p.get('id')
        if place_id and not model.objects.filter(place_id=place_id).exists():
            try:
                with transaction.atomic():
                    kwargs = field_mapper(p, api_key)
                    model.objects.create(city=city_obj, place_id=place_id, **kwargs)
            except Exception as e:
                print(f"Error saving {model.__name__} place: {e}")

    final_places = list(model.objects.filter(city=city_obj))
    if has_coords:
        final_places = _distance_sort(final_places, lat_val, lng_val)
    else:
        final_places.sort(key=lambda p: p.user_rating or 0, reverse=True)

    return 'google_places', final_places, None
