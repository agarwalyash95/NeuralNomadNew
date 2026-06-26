"""
Serializers for reference data — with search and autocomplete support.
"""

from rest_framework import serializers
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


# ─── Geography ─────────────────────────────────────────

class CountrySerializer(serializers.ModelSerializer):
    class Meta:
        model = Country
        fields = [
            'id', 'name', 'iso_code', 'iso_code_3', 'currency_code',
            'phone_code', 'continent', 'timezone_default', 'flag_emoji',
        ]


class CountryMinimalSerializer(serializers.ModelSerializer):
    """Lightweight country for nested use."""
    class Meta:
        model = Country
        fields = ['id', 'name', 'iso_code', 'flag_emoji']


class StateSerializer(serializers.ModelSerializer):
    country_name = serializers.CharField(source='country.name', read_only=True)

    class Meta:
        model = State
        fields = ['id', 'name', 'code', 'country', 'country_name']


class CitySerializer(serializers.ModelSerializer):
    country_name = serializers.CharField(source='country.name', read_only=True)
    state_name = serializers.CharField(source='state.name', read_only=True, default=None)

    class Meta:
        model = City
        fields = [
            'id', 'name', 'state', 'state_name', 'country', 'country_name',
            'latitude', 'longitude', 'population', 'is_major', 'timezone',
            'description', 'image_url',
        ]


class CityMinimalSerializer(serializers.ModelSerializer):
    """Lightweight city for autocomplete dropdowns."""
    country_name = serializers.CharField(source='country.name', read_only=True)

    class Meta:
        model = City
        fields = ['id', 'name', 'country_name', 'latitude', 'longitude', 'is_major']


class TimeZoneInfoSerializer(serializers.ModelSerializer):
    class Meta:
        model = TimeZoneInfo
        fields = ['id', 'name', 'utc_offset', 'dst_offset', 'abbreviation']


# ─── Transport ─────────────────────────────────────────

class AirportSerializer(serializers.ModelSerializer):
    city_name = serializers.CharField(source='city.name', read_only=True)
    country_name = serializers.CharField(source='city.country.name', read_only=True)

    class Meta:
        model = Airport
        fields = [
            'id', 'iata_code', 'icao_code', 'name', 'display_name',
            'city', 'city_name', 'country_name',
            'latitude', 'longitude', 'timezone', 'is_international',
        ]


class AirlineSerializer(serializers.ModelSerializer):
    country_name = serializers.CharField(source='country.name', read_only=True, default=None)

    class Meta:
        model = Airline
        fields = [
            'id', 'iata_code', 'name', 'logo_url',
            'country', 'country_name', 'alliance', 'is_low_cost',
        ]


class AirportRouteSerializer(serializers.ModelSerializer):
    from_airport_code = serializers.CharField(source='from_airport.iata_code', read_only=True)
    to_airport_code = serializers.CharField(source='to_airport.iata_code', read_only=True)
    from_city = serializers.CharField(source='from_airport.city.name', read_only=True)
    to_city = serializers.CharField(source='to_airport.city.name', read_only=True)
    airline_names = serializers.SerializerMethodField()

    class Meta:
        model = AirportRoute
        fields = [
            'id', 'from_airport', 'to_airport',
            'from_airport_code', 'to_airport_code',
            'from_city', 'to_city',
            'airline_names', 'avg_duration_minutes', 'avg_price',
            'price_currency', 'distance_km',
        ]

    def get_airline_names(self, obj):
        return list(obj.airlines.values_list('name', flat=True))


class RailwayStationSerializer(serializers.ModelSerializer):
    city_name = serializers.CharField(source='city.name', read_only=True)

    class Meta:
        model = RailwayStation
        fields = [
            'id', 'code', 'name', 'station_type',
            'city', 'city_name',
            'latitude', 'longitude', 'zone',
        ]


class TrainRouteSerializer(serializers.ModelSerializer):
    from_station_name = serializers.CharField(source='from_station.name', read_only=True)
    to_station_name = serializers.CharField(source='to_station.name', read_only=True)

    class Meta:
        model = TrainRoute
        fields = [
            'id', 'from_station', 'to_station',
            'from_station_name', 'to_station_name',
            'train_name', 'train_number',
            'avg_duration_minutes', 'distance_km',
            'days_of_week', 'classes',
        ]


class BusStationSerializer(serializers.ModelSerializer):
    city_name = serializers.CharField(source='city.name', read_only=True)

    class Meta:
        model = BusStation
        fields = ['id', 'name', 'code', 'station_type', 'city', 'city_name', 'latitude', 'longitude']


class BusRouteSerializer(serializers.ModelSerializer):
    from_station_name = serializers.CharField(source='from_station.name', read_only=True)
    to_station_name = serializers.CharField(source='to_station.name', read_only=True)

    class Meta:
        model = BusRoute
        fields = [
            'id', 'from_station', 'to_station',
            'from_station_name', 'to_station_name',
            'operator', 'avg_duration_minutes', 'distance_km', 'bus_type',
        ]


class MetroStationSerializer(serializers.ModelSerializer):
    city_name = serializers.CharField(source='city.name', read_only=True)

    class Meta:
        model = MetroStation
        fields = ['id', 'name', 'line', 'line_color', 'order', 'city', 'city_name', 'latitude', 'longitude']


# ─── Accommodation ─────────────────────────────────────

class HotelMasterSerializer(serializers.ModelSerializer):
    city_name = serializers.CharField(source='city.name', read_only=True)

    class Meta:
        model = HotelMaster
        fields = [
            'id', 'name', 'stars', 'hotel_type', 'address',
            'city', 'city_name',
            'latitude', 'longitude', 'amenities', 'price_range',
            'rating', 'review_count', 'images', 'description', 'website',
        ]


# ─── Dining ────────────────────────────────────────────

class RestaurantMasterSerializer(serializers.ModelSerializer):
    city_name = serializers.CharField(source='city.name', read_only=True)

    class Meta:
        model = RestaurantMaster
        fields = [
            'id', 'name', 'cuisine_type', 'price_level', 'address',
            'city', 'city_name',
            'latitude', 'longitude', 'rating', 'is_vegetarian_friendly',
            'opening_hours', 'phone', 'website', 'description', 'images',
        ]


# ─── Attractions ───────────────────────────────────────

class AttractionMasterSerializer(serializers.ModelSerializer):
    city_name = serializers.CharField(source='city.name', read_only=True)

    class Meta:
        model = AttractionMaster
        fields = [
            'id', 'name', 'category', 'description', 'address',
            'city', 'city_name',
            'latitude', 'longitude', 'rating',
            'entry_fee', 'fee_currency', 'duration_minutes',
            'opening_hours', 'best_time', 'images',
        ]


class ActivityMasterSerializer(serializers.ModelSerializer):
    city_name = serializers.CharField(source='city.name', read_only=True)

    class Meta:
        model = ActivityMaster
        fields = [
            'id', 'name', 'category', 'description',
            'city', 'city_name',
            'duration_minutes', 'price_range', 'difficulty_level',
            'latitude', 'longitude', 'provider', 'booking_required',
            'rating', 'images',
        ]


# ─── Travel Info ───────────────────────────────────────

class VisaRequirementSerializer(serializers.ModelSerializer):
    from_country_name = serializers.CharField(source='from_country.name', read_only=True)
    to_country_name = serializers.CharField(source='to_country.name', read_only=True)

    class Meta:
        model = VisaRequirement
        fields = [
            'id', 'from_country', 'to_country',
            'from_country_name', 'to_country_name',
            'visa_required', 'visa_type', 'processing_days',
            'fee', 'fee_currency', 'validity',
            'required_documents', 'exemptions', 'official_link', 'notes',
        ]


class CurrencySerializer(serializers.ModelSerializer):
    class Meta:
        model = Currency
        fields = ['id', 'code', 'name', 'symbol', 'country', 'decimal_places']


class HolidayCalendarSerializer(serializers.ModelSerializer):
    country_name = serializers.CharField(source='country.name', read_only=True)

    class Meta:
        model = HolidayCalendar
        fields = ['id', 'name', 'date', 'holiday_type', 'is_public', 'country', 'country_name']


class TravelSeasonSerializer(serializers.ModelSerializer):
    city_name = serializers.CharField(source='city.name', read_only=True)

    class Meta:
        model = TravelSeason
        fields = [
            'id', 'city', 'city_name', 'season_type',
            'start_month', 'end_month', 'description', 'crowd_level',
        ]


# ─── Cache ─────────────────────────────────────────────

class GooglePlaceCacheSerializer(serializers.ModelSerializer):
    class Meta:
        model = GooglePlaceCache
        fields = [
            'id', 'google_place_id', 'name', 'address',
            'latitude', 'longitude', 'rating', 'types',
            'photos', 'opening_hours', 'phone', 'website', 'cached_at',
        ]


class WeatherNormalsSerializer(serializers.ModelSerializer):
    city_name = serializers.CharField(source='city.name', read_only=True)

    class Meta:
        model = WeatherNormals
        fields = [
            'id', 'city', 'city_name', 'month',
            'avg_temp_high', 'avg_temp_low', 'avg_rainfall_mm',
            'avg_humidity', 'weather_description',
        ]
