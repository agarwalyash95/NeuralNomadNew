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
from django.utils import timezone

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


def extract_photos(photos, api_key=None):
    """Google Places `photos[].name` -> (primary image_url, [secondary urls]).

    URLs point at our own photo-proxy endpoint (apps.reference.views.place_photo_proxy),
    never at Google directly — the Places API key must never reach the browser. The
    `api_key` parameter is kept (unused) so existing call sites don't need to change.
    """
    image_url = ''
    secondary_images = []
    base = getattr(settings, 'BACKEND_BASE_URL', '').rstrip('/')
    if photos:
        first_photo = photos[0].get('name')
        if first_photo:
            image_url = f"{base}/api/reference/photo-proxy/{first_photo}/"
        for sp in photos[1:6]:
            spname = sp.get('name')
            if spname:
                secondary_images.append(f"{base}/api/reference/photo-proxy/{spname}/")
    return image_url, secondary_images


def extract_opening_hours(place_json):
    return place_json.get('regularOpeningHours', {}).get('weekdayDescriptions', [])


def extract_editorial_summary(place_json):
    return place_json.get('editorialSummary', {}).get('text', '')


# ── Google Places field mappers ──────────────────────────────────────────
# Each maps a Places API result dict to the model-specific create() kwargs
# (city/place_id are supplied by explore_places itself). Moved here from
# views.py — service logic belongs in the service layer, and
# apps.knowledge.services.engine needs to reuse these without importing
# from a view module (see docs/travel-knowledge-engine-plan.md K2).

def map_restaurant(p, api_key=None):
    price_map = {
        "PRICE_LEVEL_FREE": 0, "PRICE_LEVEL_INEXPENSIVE": 1,
        "PRICE_LEVEL_MODERATE": 2, "PRICE_LEVEL_EXPENSIVE": 3, "PRICE_LEVEL_VERY_EXPENSIVE": 4,
    }
    image_url, secondary_images = extract_photos(p.get('photos', []), api_key)
    return dict(
        name=p.get('displayName', {}).get('text', 'Unknown')[:250],
        primary_type=p.get('primaryType', ''),
        price_level=price_map.get(p.get('priceLevel', ''), None),
        user_rating=p.get('rating'),
        user_ratings_total=p.get('userRatingCount', 0),
        address=p.get('formattedAddress', ''),
        latitude=p.get('location', {}).get('latitude'),
        longitude=p.get('location', {}).get('longitude'),
        outdoor_seating=p.get('outdoorSeating'),
        good_for_groups=p.get('goodForGroups'),
        allows_dogs=p.get('allowsDogs'),
        good_for_children=p.get('goodForChildren'),
        menu_for_children=p.get('menuForChildren'),
        serves_vegetarian_food=p.get('servesVegetarianFood'),
        dine_in=p.get('dineIn'),
        takeout=p.get('takeout'),
        delivery=p.get('delivery'),
        parking_options=p.get('parkingOptions', {}),
        payment_options=p.get('paymentOptions', {}),
        reviews=p.get('reviews', [])[:5],
        opening_hours=extract_opening_hours(p),
        national_phone_number=p.get('nationalPhoneNumber'),
        website_uri=p.get('websiteUri'),
        editorial_summary=extract_editorial_summary(p),
        image_url=image_url,
        secondary_images=secondary_images,
    )


def map_attraction(p, api_key=None):
    image_url, secondary_images = extract_photos(p.get('photos', []), api_key)
    access_opts = p.get('accessibilityOptions', {})
    return dict(
        name=p.get('displayName', {}).get('text', 'Unknown')[:250],
        primary_type=p.get('primaryType', 'tourist_attraction'),
        category=p.get('primaryType', 'sightseeing'),
        user_rating=p.get('rating'),
        user_ratings_total=p.get('userRatingCount', 0),
        address=p.get('formattedAddress', ''),
        latitude=p.get('location', {}).get('latitude'),
        longitude=p.get('location', {}).get('longitude'),
        good_for_children=p.get('goodForChildren'),
        wheelchair_accessible=access_opts.get('wheelchairAccessibleEntrance'),
        good_for_groups=p.get('goodForGroups'),
        reviews=p.get('reviews', [])[:5],
        opening_hours=extract_opening_hours(p),
        national_phone_number=p.get('nationalPhoneNumber'),
        website_uri=p.get('websiteUri'),
        editorial_summary=extract_editorial_summary(p),
        image_url=image_url,
        secondary_images=secondary_images,
        # No real duration/ticket data from Places — honest gaps, not defaults
        suggested_duration_mins=None,
        ticket_price_estimate="",
    )


def map_activity(p, api_key=None):
    image_url, secondary_images = extract_photos(p.get('photos', []), api_key)
    return dict(
        name=p.get('displayName', {}).get('text', 'Unknown')[:250],
        primary_type=p.get('primaryType', 'activity'),
        category=p.get('primaryType', 'adventure'),
        user_rating=p.get('rating'),
        user_ratings_total=p.get('userRatingCount', 0),
        address=p.get('formattedAddress', ''),
        latitude=p.get('location', {}).get('latitude'),
        longitude=p.get('location', {}).get('longitude'),
        good_for_children=p.get('goodForChildren'),
        good_for_groups=p.get('goodForGroups'),
        # Google Places has no data for these — leave honest gaps rather
        # than stamping invented specifics (guided_tour, price, difficulty).
        guided_tour=None,
        equipment_included=None,
        reviews=p.get('reviews', [])[:5],
        opening_hours=extract_opening_hours(p),
        national_phone_number=p.get('nationalPhoneNumber'),
        website_uri=p.get('websiteUri'),
        editorial_summary=extract_editorial_summary(p),
        image_url=image_url,
        secondary_images=secondary_images,
        price_estimate=None,
        suggested_duration="",
        difficulty_level="",
    )


def map_hotel(p, api_key=None):
    price_map = {
        "PRICE_LEVEL_FREE": '', "PRICE_LEVEL_INEXPENSIVE": '$',
        "PRICE_LEVEL_MODERATE": '$$', "PRICE_LEVEL_EXPENSIVE": '$$$', "PRICE_LEVEL_VERY_EXPENSIVE": '$$$$',
    }
    image_url, secondary_images = extract_photos(p.get('photos', []), api_key)
    return dict(
        name=p.get('displayName', {}).get('text', 'Unknown')[:250],
        primary_type=p.get('primaryType', 'lodging'),
        price_range=price_map.get(p.get('priceLevel', ''), None),
        user_rating=p.get('rating'),
        user_ratings_total=p.get('userRatingCount', 0),
        address=p.get('formattedAddress', ''),
        latitude=p.get('location', {}).get('latitude'),
        longitude=p.get('location', {}).get('longitude'),
        parking_options=p.get('parkingOptions', {}),
        payment_options=p.get('paymentOptions', {}),
        reviews=p.get('reviews', [])[:5],
        opening_hours=extract_opening_hours(p),
        national_phone_number=p.get('nationalPhoneNumber'),
        website_uri=p.get('websiteUri'),
        editorial_summary=extract_editorial_summary(p),
        image_url=image_url,
        secondary_images=secondary_images,
    )


# Category config used by KnowledgeEngine.resolve() (apps.knowledge.services.engine)
# — centralizes what was previously duplicated inline across four explore()
# actions in views.py.
def _category_config():
    from apps.reference.models import ActivityMaster, AttractionMaster, HotelMaster, RestaurantMaster

    return {
        "hotel": dict(
            model=HotelMaster,
            query_template="hotels in {location}",
            included_type="lodging",
            field_mask=(
                "places.id,places.displayName,places.primaryType,places.rating,places.userRatingCount,"
                "places.priceLevel,places.formattedAddress,places.location,places.parkingOptions,"
                "places.paymentOptions,places.reviews,places.regularOpeningHours,places.nationalPhoneNumber,"
                "places.websiteUri,places.editorialSummary,places.photos"
            ),
            field_mapper=map_hotel,
        ),
        "restaurant": dict(
            model=RestaurantMaster,
            query_template="best restaurants in {location}",
            included_type="restaurant",
            field_mask=(
                "places.id,places.displayName,places.primaryType,places.rating,places.userRatingCount,"
                "places.priceLevel,places.formattedAddress,places.location,places.outdoorSeating,"
                "places.goodForGroups,places.allowsDogs,places.goodForChildren,places.menuForChildren,"
                "places.servesVegetarianFood,places.dineIn,places.takeout,places.delivery,"
                "places.parkingOptions,places.paymentOptions,places.reviews,places.regularOpeningHours,"
                "places.nationalPhoneNumber,places.websiteUri,places.editorialSummary,places.photos"
            ),
            field_mapper=map_restaurant,
        ),
        "attraction": dict(
            model=AttractionMaster,
            query_template="top tourist attractions, heritage sites and landmarks in {location}",
            included_type="tourist_attraction",
            field_mask=(
                "places.id,places.displayName,places.primaryType,places.rating,places.userRatingCount,"
                "places.formattedAddress,places.location,places.goodForChildren,places.goodForGroups,"
                "places.accessibilityOptions,places.reviews,places.regularOpeningHours,"
                "places.nationalPhoneNumber,places.websiteUri,places.editorialSummary,places.photos"
            ),
            field_mapper=map_attraction,
        ),
        "activity": dict(
            model=ActivityMaster,
            query_template="top adventure activities, outdoor sports and tours in {location}",
            included_type=None,
            field_mask=(
                "places.id,places.displayName,places.primaryType,places.rating,places.userRatingCount,"
                "places.formattedAddress,places.location,places.goodForChildren,places.goodForGroups,"
                "places.reviews,places.regularOpeningHours,places.nationalPhoneNumber,places.websiteUri,"
                "places.editorialSummary,places.photos"
            ),
            field_mapper=map_activity,
        ),
    }


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
        return 'error', None, str(e)

    for p in places_json:
        place_id = p.get('id')
        if place_id and not model.objects.filter(place_id=place_id).exists():
            try:
                with transaction.atomic():
                    kwargs = field_mapper(p, api_key)
                    # Stamps freshness at creation time — previously absent, so a
                    # row's staleness could never be determined (see
                    # docs/travel-knowledge-engine-plan.md §3a/§4). The background
                    # refresh task queries against this field.
                    model.objects.create(
                        city=city_obj, place_id=place_id,
                        last_enriched_at=timezone.now(), source="google_places",
                        **kwargs,
                    )
            except Exception as e:
                print(f"Error saving {model.__name__} place: {e}")

    final_places = list(model.objects.filter(city=city_obj))
    if has_coords:
        final_places = _distance_sort(final_places, lat_val, lng_val)
    else:
        final_places.sort(key=lambda p: p.user_rating or 0, reverse=True)

    return 'google_places', final_places, None


def fetch_place_by_id(model, place_id, field_mask, field_mapper):
    """
    Re-fetch a single already-known place from Google's Place Details
    endpoint (not the text-search endpoint explore_places uses) and update
    its row in place. Used by the background staleness-refresh task — see
    apps.reference.tasks.refresh_stale_entities.

    Returns True on a successful refresh, False on any failure (missing key,
    network error, non-200, or the row no longer existing) — a refresh
    failure is a "try again next cycle" situation, never a crash.
    """
    api_key = getattr(settings, 'GOOGLE_PLACES_API_KEY', '')
    if not api_key:
        return False

    headers = {"X-Goog-Api-Key": api_key, "X-Goog-FieldMask": field_mask}
    try:
        resp = requests.get(f"https://places.googleapis.com/v1/{place_id}", headers=headers, timeout=5)
        if resp.status_code != 200:
            return False
        place_json = resp.json()
    except Exception:
        return False

    try:
        kwargs = field_mapper(place_json, api_key)
    except Exception:
        return False

    updated = model.objects.filter(place_id=place_id).update(
        last_enriched_at=timezone.now(), **kwargs
    )
    return updated > 0
