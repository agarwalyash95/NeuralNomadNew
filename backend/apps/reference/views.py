from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.conf import settings
from django_filters.rest_framework import DjangoFilterBackend
from .models import (
    Country, State, City, Airport, Airline, AirportRoute,
    RailwayStation, TrainRoute, BusStation, BusRoute, MetroStation,
    HotelMaster, RestaurantMaster, AttractionMaster, ActivityMaster,
    VisaRequirement, Currency, HolidayCalendar, WeatherNormals,
    TravelSeason, GooglePlaceCache
)
from .serializers import (
    CountrySerializer, StateSerializer, CitySerializer, AirportSerializer, AirlineSerializer,
    AirportRouteSerializer, RailwayStationSerializer, TrainRouteSerializer, BusStationSerializer,
    BusRouteSerializer, MetroStationSerializer, HotelMasterSerializer, RestaurantMasterSerializer,
    AttractionMasterSerializer, ActivityMasterSerializer, VisaRequirementSerializer,
    CurrencySerializer, HolidayCalendarSerializer, WeatherNormalsSerializer,
    TravelSeasonSerializer, GooglePlaceCacheSerializer
)
from .services.places_explore import explore_places, extract_photos, extract_opening_hours, extract_editorial_summary
from .services.suggestions import to_suggestion, to_suggestion_list


def _parse_coords(request):
    lat = request.query_params.get('lat')
    lng = request.query_params.get('lng')
    if lat and lng:
        try:
            return float(lat), float(lng)
        except ValueError:
            pass
    return None, None


# ── Google Places field mappers ──────────────────────────────────────────
# Each maps a Places API result dict to the model-specific create() kwargs
# (city/place_id are supplied by explore_places itself).

def _map_restaurant(p, api_key):
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


def _map_attraction(p, api_key):
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


def _map_activity(p, api_key):
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


def _map_hotel(p, api_key):
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


class BaseReferenceViewSet(viewsets.ReadOnlyModelViewSet):
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]

class CountryViewSet(BaseReferenceViewSet):
    queryset = Country.objects.all()
    serializer_class = CountrySerializer
    search_fields = ['name', 'code']

class StateViewSet(BaseReferenceViewSet):
    queryset = State.objects.all()
    serializer_class = StateSerializer
    search_fields = ['name', 'country__name']
    filterset_fields = ['country']

class CityViewSet(BaseReferenceViewSet):
    queryset = City.objects.all()
    serializer_class = CitySerializer
    search_fields = ['name', 'country__name']
    filterset_fields = ['country', 'state']

class AirportViewSet(BaseReferenceViewSet):
    queryset = Airport.objects.all()
    serializer_class = AirportSerializer
    search_fields = ['name', 'iata_code', 'city__name']
    filterset_fields = ['city']

class AirlineViewSet(BaseReferenceViewSet):
    queryset = Airline.objects.all()
    serializer_class = AirlineSerializer
    search_fields = ['name', 'iata_code']

class AirportRouteViewSet(BaseReferenceViewSet):
    queryset = AirportRoute.objects.all()
    serializer_class = AirportRouteSerializer
    filterset_fields = ['source', 'destination', 'airline']

class RailwayStationViewSet(BaseReferenceViewSet):
    queryset = RailwayStation.objects.all()
    serializer_class = RailwayStationSerializer
    search_fields = ['name', 'code', 'city__name']
    filterset_fields = ['city']

class TrainRouteViewSet(BaseReferenceViewSet):
    queryset = TrainRoute.objects.all()
    serializer_class = TrainRouteSerializer
    search_fields = ['train_name', 'train_number']
    filterset_fields = ['source', 'destination']

class BusStationViewSet(BaseReferenceViewSet):
    queryset = BusStation.objects.all()
    serializer_class = BusStationSerializer
    search_fields = ['name', 'city__name']
    filterset_fields = ['city']

class BusRouteViewSet(BaseReferenceViewSet):
    queryset = BusRoute.objects.all()
    serializer_class = BusRouteSerializer
    search_fields = ['operator_name']
    filterset_fields = ['source', 'destination']

class MetroStationViewSet(BaseReferenceViewSet):
    queryset = MetroStation.objects.all()
    serializer_class = MetroStationSerializer
    search_fields = ['name']
    filterset_fields = ['city', 'line_color']

class HotelMasterViewSet(BaseReferenceViewSet):
    queryset = HotelMaster.objects.all()
    serializer_class = HotelMasterSerializer
    search_fields = ['name', 'address']
    filterset_fields = ['city', 'star_rating']

    @action(detail=False, methods=['get'])
    def explore(self, request):
        location = request.query_params.get('location', '')
        if not location:
            return Response({'error': 'Location is required'}, status=status.HTTP_400_BAD_REQUEST)
        lat_val, lng_val = _parse_coords(request)

        field_mask = (
            "places.id,places.displayName,places.primaryType,places.rating,places.userRatingCount,"
            "places.priceLevel,places.formattedAddress,places.location,places.parkingOptions,"
            "places.paymentOptions,places.reviews,places.regularOpeningHours,places.nationalPhoneNumber,"
            "places.websiteUri,places.editorialSummary,places.photos"
        )
        source, places, error = explore_places(
            model=HotelMaster,
            location=location,
            lat_val=lat_val, lng_val=lng_val,
            google_query=f"hotels in {location}",
            included_type="lodging",
            field_mask=field_mask,
            field_mapper=_map_hotel,
        )
        if error and not places:
            return Response({'error': error}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        return Response({'source': source, 'results': to_suggestion_list(places, 'hotel')})

    @action(detail=True, methods=['get'])
    def details(self, request, pk=None):
        hotel = self.get_object()
        return Response({'source': 'database', 'data': to_suggestion(hotel, 'hotel')})

class RestaurantMasterViewSet(BaseReferenceViewSet):
    queryset = RestaurantMaster.objects.all()
    serializer_class = RestaurantMasterSerializer
    search_fields = ['name', 'cuisine']
    filterset_fields = ['city', 'price_range']

    @action(detail=False, methods=['get'])
    def explore(self, request):
        location = request.query_params.get('location', '')
        if not location:
            return Response({'error': 'Location is required'}, status=status.HTTP_400_BAD_REQUEST)
        lat_val, lng_val = _parse_coords(request)

        field_mask = (
            "places.id,places.displayName,places.primaryType,places.rating,places.userRatingCount,"
            "places.priceLevel,places.formattedAddress,places.location,places.outdoorSeating,"
            "places.goodForGroups,places.allowsDogs,places.goodForChildren,places.menuForChildren,"
            "places.servesVegetarianFood,places.dineIn,places.takeout,places.delivery,"
            "places.parkingOptions,places.paymentOptions,places.reviews,places.regularOpeningHours,"
            "places.nationalPhoneNumber,places.websiteUri,places.editorialSummary,places.photos"
        )
        source, places, error = explore_places(
            model=RestaurantMaster,
            location=location,
            lat_val=lat_val, lng_val=lng_val,
            google_query=f"best restaurants in {location}",
            included_type="restaurant",
            field_mask=field_mask,
            field_mapper=_map_restaurant,
        )
        if error and not places:
            return Response({'error': error}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        return Response({'source': source, 'results': to_suggestion_list(places, 'restaurant')})

    @action(detail=True, methods=['get'])
    def details(self, request, pk=None):
        restaurant = self.get_object()
        return Response({'source': 'database', 'data': to_suggestion(restaurant, 'restaurant')})

class AttractionMasterViewSet(BaseReferenceViewSet):
    queryset = AttractionMaster.objects.all()
    serializer_class = AttractionMasterSerializer
    search_fields = ['name', 'category']
    filterset_fields = ['city', 'category']

    @action(detail=False, methods=['get'])
    def explore(self, request):
        location = request.query_params.get('location', '')
        if not location:
            return Response({'error': 'Location is required'}, status=status.HTTP_400_BAD_REQUEST)
        lat_val, lng_val = _parse_coords(request)

        field_mask = (
            "places.id,places.displayName,places.primaryType,places.rating,places.userRatingCount,"
            "places.formattedAddress,places.location,places.goodForChildren,places.goodForGroups,"
            "places.accessibilityOptions,places.reviews,places.regularOpeningHours,"
            "places.nationalPhoneNumber,places.websiteUri,places.editorialSummary,places.photos"
        )
        source, places, error = explore_places(
            model=AttractionMaster,
            location=location,
            lat_val=lat_val, lng_val=lng_val,
            google_query=f"top tourist attractions, heritage sites and landmarks in {location}",
            included_type="tourist_attraction",
            field_mask=field_mask,
            field_mapper=_map_attraction,
        )
        if error and not places:
            return Response({'error': error}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        return Response({'source': source, 'results': to_suggestion_list(places, 'attraction')})

    @action(detail=True, methods=['get'])
    def details(self, request, pk=None):
        attraction = self.get_object()
        return Response({'source': 'database', 'data': to_suggestion(attraction, 'attraction')})

class ActivityMasterViewSet(BaseReferenceViewSet):
    queryset = ActivityMaster.objects.all()
    serializer_class = ActivityMasterSerializer
    search_fields = ['name', 'category']
    filterset_fields = ['city', 'category']

    @action(detail=False, methods=['get'])
    def explore(self, request):
        location = request.query_params.get('location', '')
        if not location:
            return Response({'error': 'Location is required'}, status=status.HTTP_400_BAD_REQUEST)
        lat_val, lng_val = _parse_coords(request)

        field_mask = (
            "places.id,places.displayName,places.primaryType,places.rating,places.userRatingCount,"
            "places.formattedAddress,places.location,places.goodForChildren,places.goodForGroups,"
            "places.reviews,places.regularOpeningHours,places.nationalPhoneNumber,places.websiteUri,"
            "places.editorialSummary,places.photos"
        )
        source, places, error = explore_places(
            model=ActivityMaster,
            location=location,
            lat_val=lat_val, lng_val=lng_val,
            google_query=f"top adventure activities, outdoor sports and tours in {location}",
            included_type=None,
            field_mask=field_mask,
            field_mapper=_map_activity,
        )
        if error and not places:
            return Response({'error': error}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        return Response({'source': source, 'results': to_suggestion_list(places, 'activity')})

    @action(detail=True, methods=['get'])
    def details(self, request, pk=None):
        activity = self.get_object()
        return Response({'source': 'database', 'data': to_suggestion(activity, 'activity')})

class VisaRequirementViewSet(BaseReferenceViewSet):
    queryset = VisaRequirement.objects.all()
    serializer_class = VisaRequirementSerializer
    filterset_fields = ['nationality', 'destination', 'status']

class CurrencyViewSet(BaseReferenceViewSet):
    queryset = Currency.objects.all()
    serializer_class = CurrencySerializer
    search_fields = ['name', 'code']

class HolidayCalendarViewSet(BaseReferenceViewSet):
    queryset = HolidayCalendar.objects.all()
    serializer_class = HolidayCalendarSerializer
    filterset_fields = ['country', 'date', 'type']
    search_fields = ['name']

class WeatherNormalsViewSet(BaseReferenceViewSet):
    queryset = WeatherNormals.objects.all()
    serializer_class = WeatherNormalsSerializer
    filterset_fields = ['city', 'month']

class TravelSeasonViewSet(BaseReferenceViewSet):
    queryset = TravelSeason.objects.all()
    serializer_class = TravelSeasonSerializer
    filterset_fields = ['city', 'month', 'season_type']

class GooglePlaceCacheViewSet(BaseReferenceViewSet):
    queryset = GooglePlaceCache.objects.all()
    serializer_class = GooglePlaceCacheSerializer
    search_fields = ['name', 'place_id']


from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from datetime import datetime
from django.db.models import Q
from .models import TravelPriceHistory

class LivePriceView(APIView):
    """
    Thin HTTP wrapper over the shared live-price lookup service.

    Note: there is deliberately NO "any record of this service type" fallback.
    If no price exists for the requested route/date, we say so — an unrelated
    price presented as this item's price is a trust violation, not a feature.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        service_type = request.query_params.get('service_type')
        date_str = request.query_params.get('date')

        if not service_type or not date_str:
            return Response({"error": "service_type and date are required"}, status=400)

        from apps.reference.services.live_price import lookup_live_price

        result = lookup_live_price(
            service_type=service_type,
            date_str=date_str,
            provider=request.query_params.get('provider', ''),
            code=request.query_params.get('code', ''),
            origin=request.query_params.get('origin', ''),
            destination=request.query_params.get('destination', ''),
        )

        if result is None:
            return Response({"error": "No price record found"}, status=404)
        return Response(result)


class PlaceDetailsView(APIView):
    """
    Unified place resolver for plan blocks: one URL, any category.
    GET /reference/places/details/?place_id=…[&category=hotel]
    Returns the same Suggestion envelope the explore endpoints use, so the
    rich hover card and the canvases read one shape.
    """
    permission_classes = [AllowAny]

    _MODELS = {
        "hotel": HotelMaster,
        "restaurant": RestaurantMaster,
        "attraction": AttractionMaster,
        "activity": ActivityMaster,
    }

    def get(self, request):
        place_id = request.query_params.get("place_id")
        if not place_id:
            return Response({"error": "place_id is required"}, status=400)

        category_param = request.query_params.get("category", "").lower().strip()
        # A block's UI type maps onto the master-table category
        category_alias = {"food": "restaurant", "stay": "hotel"}
        category_param = category_alias.get(category_param, category_param)

        categories = [category_param] if category_param in self._MODELS else list(self._MODELS)
        for category in categories:
            instance = self._MODELS[category].objects.filter(place_id=place_id).first()
            if instance is not None:
                return Response({"source": "database", "data": to_suggestion(instance, category)})

        return Response({"error": "No place found for this place_id"}, status=404)
