from rest_framework import viewsets, filters
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

class RestaurantMasterViewSet(BaseReferenceViewSet):
    queryset = RestaurantMaster.objects.all()
    serializer_class = RestaurantMasterSerializer
    search_fields = ['name', 'cuisine']
    filterset_fields = ['city', 'price_range']

class AttractionMasterViewSet(BaseReferenceViewSet):
    queryset = AttractionMaster.objects.all()
    serializer_class = AttractionMasterSerializer
    search_fields = ['name', 'category']
    filterset_fields = ['city', 'category']

class ActivityMasterViewSet(BaseReferenceViewSet):
    queryset = ActivityMaster.objects.all()
    serializer_class = ActivityMasterSerializer
    search_fields = ['name', 'category']
    filterset_fields = ['city', 'category']

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
