"""
Views for reference data — read-only with search/filter/autocomplete support.
Reference endpoints are public (AllowAny) since this is static knowledge data.
"""

from rest_framework import viewsets, filters
from rest_framework.permissions import AllowAny
from django_filters.rest_framework import DjangoFilterBackend

from .models import (
    Country, State, City, TimeZoneInfo,
    Airport, Airline, AirportRoute,
    RailwayStation, TrainRoute,
    BusStation, BusRoute,
    MetroStation,
    HotelMaster,
    RestaurantMaster,
    AttractionMaster, ActivityMaster,
    VisaRequirement, Currency, HolidayCalendar, TravelSeason,
    GooglePlaceCache, WeatherNormals,
)
from .serializers import (
    CountrySerializer, StateSerializer, CitySerializer, CityMinimalSerializer,
    TimeZoneInfoSerializer,
    AirportSerializer, AirlineSerializer, AirportRouteSerializer,
    RailwayStationSerializer, TrainRouteSerializer,
    BusStationSerializer, BusRouteSerializer,
    MetroStationSerializer,
    HotelMasterSerializer,
    RestaurantMasterSerializer,
    AttractionMasterSerializer, ActivityMasterSerializer,
    VisaRequirementSerializer, CurrencySerializer,
    HolidayCalendarSerializer, TravelSeasonSerializer,
    GooglePlaceCacheSerializer, WeatherNormalsSerializer,
)


class ReadOnlyReferenceViewSet(viewsets.ReadOnlyModelViewSet):
    """Base viewset for reference data — read-only, public access."""
    permission_classes = [AllowAny]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]


# ─── Geography ─────────────────────────────────────────

class CountryViewSet(ReadOnlyReferenceViewSet):
    queryset = Country.objects.filter(is_deleted=False)
    serializer_class = CountrySerializer
    search_fields = ['name', 'iso_code', 'iso_code_3']
    ordering_fields = ['name']
    filterset_fields = ['continent']


class StateViewSet(ReadOnlyReferenceViewSet):
    queryset = State.objects.filter(is_deleted=False).select_related('country')
    serializer_class = StateSerializer
    search_fields = ['name', 'code']
    filterset_fields = ['country']


class CityViewSet(ReadOnlyReferenceViewSet):
    queryset = City.objects.filter(is_deleted=False).select_related('country', 'state')
    search_fields = ['name']
    ordering_fields = ['name', 'population']
    filterset_fields = ['country', 'state', 'is_major']

    def get_serializer_class(self):
        if self.request.query_params.get('minimal') == 'true':
            return CityMinimalSerializer
        return CitySerializer


class TimeZoneInfoViewSet(ReadOnlyReferenceViewSet):
    queryset = TimeZoneInfo.objects.filter(is_deleted=False)
    serializer_class = TimeZoneInfoSerializer
    search_fields = ['name', 'abbreviation']


# ─── Transport ─────────────────────────────────────────

class AirportViewSet(ReadOnlyReferenceViewSet):
    queryset = Airport.objects.filter(is_deleted=False).select_related('city', 'city__country')
    serializer_class = AirportSerializer
    search_fields = ['iata_code', 'name', 'display_name', 'city__name']
    filterset_fields = ['city', 'is_international']


class AirlineViewSet(ReadOnlyReferenceViewSet):
    queryset = Airline.objects.filter(is_deleted=False).select_related('country')
    serializer_class = AirlineSerializer
    search_fields = ['iata_code', 'name']
    filterset_fields = ['alliance', 'is_low_cost']


class AirportRouteViewSet(ReadOnlyReferenceViewSet):
    serializer_class = AirportRouteSerializer
    search_fields = ['from_airport__iata_code', 'to_airport__iata_code']

    def get_queryset(self):
        qs = AirportRoute.objects.filter(is_deleted=False).select_related(
            'from_airport', 'to_airport',
            'from_airport__city', 'to_airport__city',
        ).prefetch_related('airlines')

        from_code = self.request.query_params.get('from')
        to_code = self.request.query_params.get('to')
        if from_code:
            qs = qs.filter(from_airport__iata_code__iexact=from_code)
        if to_code:
            qs = qs.filter(to_airport__iata_code__iexact=to_code)
        return qs


class RailwayStationViewSet(ReadOnlyReferenceViewSet):
    queryset = RailwayStation.objects.filter(is_deleted=False).select_related('city')
    serializer_class = RailwayStationSerializer
    search_fields = ['code', 'name', 'city__name']
    filterset_fields = ['city', 'station_type']


class TrainRouteViewSet(ReadOnlyReferenceViewSet):
    serializer_class = TrainRouteSerializer

    def get_queryset(self):
        qs = TrainRoute.objects.filter(is_deleted=False).select_related(
            'from_station', 'to_station',
        )
        from_code = self.request.query_params.get('from')
        to_code = self.request.query_params.get('to')
        if from_code:
            qs = qs.filter(from_station__code__iexact=from_code)
        if to_code:
            qs = qs.filter(to_station__code__iexact=to_code)
        return qs


class BusStationViewSet(ReadOnlyReferenceViewSet):
    queryset = BusStation.objects.filter(is_deleted=False).select_related('city')
    serializer_class = BusStationSerializer
    search_fields = ['name', 'code', 'city__name']
    filterset_fields = ['city', 'station_type']


class BusRouteViewSet(ReadOnlyReferenceViewSet):
    serializer_class = BusRouteSerializer

    def get_queryset(self):
        qs = BusRoute.objects.filter(is_deleted=False).select_related(
            'from_station', 'to_station',
        )
        from_id = self.request.query_params.get('from')
        to_id = self.request.query_params.get('to')
        if from_id:
            qs = qs.filter(from_station_id=from_id)
        if to_id:
            qs = qs.filter(to_station_id=to_id)
        return qs


class MetroStationViewSet(ReadOnlyReferenceViewSet):
    queryset = MetroStation.objects.filter(is_deleted=False).select_related('city')
    serializer_class = MetroStationSerializer
    search_fields = ['name', 'line']
    filterset_fields = ['city', 'line']


# ─── Accommodation ─────────────────────────────────────

class HotelMasterViewSet(ReadOnlyReferenceViewSet):
    queryset = HotelMaster.objects.filter(is_deleted=False).select_related('city')
    serializer_class = HotelMasterSerializer
    search_fields = ['name', 'city__name']
    filterset_fields = ['city', 'stars', 'hotel_type', 'price_range']
    ordering_fields = ['rating', 'name', 'stars']


# ─── Dining ────────────────────────────────────────────

class RestaurantMasterViewSet(ReadOnlyReferenceViewSet):
    queryset = RestaurantMaster.objects.filter(is_deleted=False).select_related('city')
    serializer_class = RestaurantMasterSerializer
    search_fields = ['name', 'cuisine_type', 'city__name']
    filterset_fields = ['city', 'price_level', 'is_vegetarian_friendly']
    ordering_fields = ['rating', 'name']


# ─── Attractions ───────────────────────────────────────

class AttractionMasterViewSet(ReadOnlyReferenceViewSet):
    queryset = AttractionMaster.objects.filter(is_deleted=False).select_related('city')
    serializer_class = AttractionMasterSerializer
    search_fields = ['name', 'city__name', 'category']
    filterset_fields = ['city', 'category']
    ordering_fields = ['rating', 'name']


class ActivityMasterViewSet(ReadOnlyReferenceViewSet):
    queryset = ActivityMaster.objects.filter(is_deleted=False).select_related('city')
    serializer_class = ActivityMasterSerializer
    search_fields = ['name', 'city__name', 'category']
    filterset_fields = ['city', 'category', 'difficulty_level', 'price_range']
    ordering_fields = ['rating', 'name']


# ─── Travel Info ───────────────────────────────────────

class VisaRequirementViewSet(ReadOnlyReferenceViewSet):
    serializer_class = VisaRequirementSerializer

    def get_queryset(self):
        qs = VisaRequirement.objects.filter(is_deleted=False).select_related(
            'from_country', 'to_country',
        )
        from_id = self.request.query_params.get('from')
        to_id = self.request.query_params.get('to')
        if from_id:
            qs = qs.filter(from_country_id=from_id)
        if to_id:
            qs = qs.filter(to_country_id=to_id)
        return qs


class CurrencyViewSet(ReadOnlyReferenceViewSet):
    queryset = Currency.objects.filter(is_deleted=False)
    serializer_class = CurrencySerializer
    search_fields = ['code', 'name']


class HolidayCalendarViewSet(ReadOnlyReferenceViewSet):
    queryset = HolidayCalendar.objects.filter(is_deleted=False).select_related('country')
    serializer_class = HolidayCalendarSerializer
    filterset_fields = ['country', 'holiday_type', 'is_public']
    ordering_fields = ['date']


class TravelSeasonViewSet(ReadOnlyReferenceViewSet):
    queryset = TravelSeason.objects.filter(is_deleted=False).select_related('city')
    serializer_class = TravelSeasonSerializer
    filterset_fields = ['city', 'season_type']


# ─── Cache ─────────────────────────────────────────────

class WeatherNormalsViewSet(ReadOnlyReferenceViewSet):
    serializer_class = WeatherNormalsSerializer
    filterset_fields = ['city']

    def get_queryset(self):
        qs = WeatherNormals.objects.filter(is_deleted=False).select_related('city')
        month = self.request.query_params.get('month')
        if month:
            qs = qs.filter(month=month)
        return qs
