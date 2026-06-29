from rest_framework import serializers
from .models import (
    Country, State, City, Airport, Airline, AirportRoute,
    RailwayStation, TrainRoute, BusStation, BusRoute, MetroStation,
    HotelMaster, RestaurantMaster, AttractionMaster, ActivityMaster,
    VisaRequirement, Currency, HolidayCalendar, WeatherNormals,
    TravelSeason, GooglePlaceCache
)

class CountrySerializer(serializers.ModelSerializer):
    class Meta:
        model = Country
        fields = '__all__'

class StateSerializer(serializers.ModelSerializer):
    class Meta:
        model = State
        fields = '__all__'

class CitySerializer(serializers.ModelSerializer):
    country_code = serializers.CharField(source='country.code', read_only=True)
    class Meta:
        model = City
        fields = '__all__'

class AirportSerializer(serializers.ModelSerializer):
    class Meta:
        model = Airport
        fields = '__all__'

class AirlineSerializer(serializers.ModelSerializer):
    class Meta:
        model = Airline
        fields = '__all__'

class AirportRouteSerializer(serializers.ModelSerializer):
    class Meta:
        model = AirportRoute
        fields = '__all__'

class RailwayStationSerializer(serializers.ModelSerializer):
    class Meta:
        model = RailwayStation
        fields = '__all__'

class TrainRouteSerializer(serializers.ModelSerializer):
    class Meta:
        model = TrainRoute
        fields = '__all__'

class BusStationSerializer(serializers.ModelSerializer):
    class Meta:
        model = BusStation
        fields = '__all__'

class BusRouteSerializer(serializers.ModelSerializer):
    class Meta:
        model = BusRoute
        fields = '__all__'

class MetroStationSerializer(serializers.ModelSerializer):
    class Meta:
        model = MetroStation
        fields = '__all__'

class HotelMasterSerializer(serializers.ModelSerializer):
    class Meta:
        model = HotelMaster
        fields = '__all__'

class RestaurantMasterSerializer(serializers.ModelSerializer):
    class Meta:
        model = RestaurantMaster
        fields = '__all__'

class AttractionMasterSerializer(serializers.ModelSerializer):
    class Meta:
        model = AttractionMaster
        fields = '__all__'

class ActivityMasterSerializer(serializers.ModelSerializer):
    class Meta:
        model = ActivityMaster
        fields = '__all__'

class VisaRequirementSerializer(serializers.ModelSerializer):
    class Meta:
        model = VisaRequirement
        fields = '__all__'

class CurrencySerializer(serializers.ModelSerializer):
    class Meta:
        model = Currency
        fields = '__all__'

class HolidayCalendarSerializer(serializers.ModelSerializer):
    class Meta:
        model = HolidayCalendar
        fields = '__all__'

class WeatherNormalsSerializer(serializers.ModelSerializer):
    class Meta:
        model = WeatherNormals
        fields = '__all__'

class TravelSeasonSerializer(serializers.ModelSerializer):
    class Meta:
        model = TravelSeason
        fields = '__all__'

class GooglePlaceCacheSerializer(serializers.ModelSerializer):
    class Meta:
        model = GooglePlaceCache
        fields = '__all__'
