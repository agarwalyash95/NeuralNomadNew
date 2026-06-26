"""
Admin registrations for all reference data models.
"""

from django.contrib import admin
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

@admin.register(Country)
class CountryAdmin(admin.ModelAdmin):
    list_display = ['name', 'iso_code', 'continent', 'currency_code', 'phone_code']
    search_fields = ['name', 'iso_code']
    list_filter = ['continent']


@admin.register(State)
class StateAdmin(admin.ModelAdmin):
    list_display = ['name', 'code', 'country']
    search_fields = ['name', 'code']
    list_filter = ['country']


@admin.register(City)
class CityAdmin(admin.ModelAdmin):
    list_display = ['name', 'country', 'state', 'is_major', 'population']
    search_fields = ['name']
    list_filter = ['country', 'is_major']


@admin.register(TimeZoneInfo)
class TimeZoneInfoAdmin(admin.ModelAdmin):
    list_display = ['name', 'utc_offset', 'abbreviation']
    search_fields = ['name', 'abbreviation']


# ─── Transport ─────────────────────────────────────────

@admin.register(Airport)
class AirportAdmin(admin.ModelAdmin):
    list_display = ['iata_code', 'name', 'city', 'is_international']
    search_fields = ['iata_code', 'name', 'city__name']
    list_filter = ['is_international']


@admin.register(Airline)
class AirlineAdmin(admin.ModelAdmin):
    list_display = ['iata_code', 'name', 'alliance', 'is_low_cost']
    search_fields = ['iata_code', 'name']
    list_filter = ['alliance', 'is_low_cost']


@admin.register(AirportRoute)
class AirportRouteAdmin(admin.ModelAdmin):
    list_display = ['from_airport', 'to_airport', 'avg_duration_minutes', 'avg_price']
    search_fields = ['from_airport__iata_code', 'to_airport__iata_code']


@admin.register(RailwayStation)
class RailwayStationAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'city', 'station_type', 'zone']
    search_fields = ['code', 'name', 'city__name']
    list_filter = ['station_type', 'zone']


@admin.register(TrainRoute)
class TrainRouteAdmin(admin.ModelAdmin):
    list_display = ['train_number', 'train_name', 'from_station', 'to_station']
    search_fields = ['train_number', 'train_name']


@admin.register(BusStation)
class BusStationAdmin(admin.ModelAdmin):
    list_display = ['name', 'code', 'city', 'station_type']
    search_fields = ['name', 'code', 'city__name']


@admin.register(BusRoute)
class BusRouteAdmin(admin.ModelAdmin):
    list_display = ['from_station', 'to_station', 'operator', 'bus_type']
    search_fields = ['operator']
    list_filter = ['bus_type']


@admin.register(MetroStation)
class MetroStationAdmin(admin.ModelAdmin):
    list_display = ['name', 'line', 'city', 'order']
    search_fields = ['name', 'line']
    list_filter = ['city', 'line']


# ─── Accommodation ─────────────────────────────────────

@admin.register(HotelMaster)
class HotelMasterAdmin(admin.ModelAdmin):
    list_display = ['name', 'city', 'stars', 'hotel_type', 'price_range', 'rating']
    search_fields = ['name', 'city__name']
    list_filter = ['stars', 'hotel_type', 'price_range']


# ─── Dining ────────────────────────────────────────────

@admin.register(RestaurantMaster)
class RestaurantMasterAdmin(admin.ModelAdmin):
    list_display = ['name', 'city', 'cuisine_type', 'price_level', 'rating']
    search_fields = ['name', 'cuisine_type', 'city__name']
    list_filter = ['price_level', 'is_vegetarian_friendly']


# ─── Attractions ───────────────────────────────────────

@admin.register(AttractionMaster)
class AttractionMasterAdmin(admin.ModelAdmin):
    list_display = ['name', 'city', 'category', 'rating', 'entry_fee']
    search_fields = ['name', 'city__name']
    list_filter = ['category']


@admin.register(ActivityMaster)
class ActivityMasterAdmin(admin.ModelAdmin):
    list_display = ['name', 'city', 'category', 'price_range', 'difficulty_level']
    search_fields = ['name', 'city__name']
    list_filter = ['category', 'difficulty_level', 'price_range']


# ─── Travel Info ───────────────────────────────────────

@admin.register(VisaRequirement)
class VisaRequirementAdmin(admin.ModelAdmin):
    list_display = ['from_country', 'to_country', 'visa_required', 'visa_type', 'processing_days']
    list_filter = ['visa_required', 'visa_type']


@admin.register(Currency)
class CurrencyAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'symbol']
    search_fields = ['code', 'name']


@admin.register(HolidayCalendar)
class HolidayCalendarAdmin(admin.ModelAdmin):
    list_display = ['name', 'country', 'date', 'holiday_type', 'is_public']
    list_filter = ['country', 'holiday_type']
    search_fields = ['name']


@admin.register(TravelSeason)
class TravelSeasonAdmin(admin.ModelAdmin):
    list_display = ['city', 'season_type', 'start_month', 'end_month', 'crowd_level']
    list_filter = ['season_type', 'crowd_level']


# ─── Cache ─────────────────────────────────────────────

@admin.register(GooglePlaceCache)
class GooglePlaceCacheAdmin(admin.ModelAdmin):
    list_display = ['name', 'google_place_id', 'rating', 'cached_at']
    search_fields = ['name', 'google_place_id']


@admin.register(WeatherNormals)
class WeatherNormalsAdmin(admin.ModelAdmin):
    list_display = ['city', 'month', 'avg_temp_high', 'avg_temp_low', 'avg_rainfall_mm']
    list_filter = ['month']
