from django.contrib import admin
from .models import (
    Country, State, City, Airport, Airline, AirportRoute,
    RailwayStation, TrainRoute, BusStation, BusRoute, MetroStation,
    HotelMaster, RestaurantMaster, AttractionMaster, ActivityMaster,
    VisaRequirement, Currency, HolidayCalendar, WeatherNormals,
    TravelSeason, GooglePlaceCache
)

admin.site.register(Country)
admin.site.register(State)
admin.site.register(City)
admin.site.register(Airport)
admin.site.register(Airline)
admin.site.register(AirportRoute)
admin.site.register(RailwayStation)
admin.site.register(TrainRoute)
admin.site.register(BusStation)
admin.site.register(BusRoute)
admin.site.register(MetroStation)
admin.site.register(HotelMaster)
admin.site.register(RestaurantMaster)
admin.site.register(AttractionMaster)
admin.site.register(ActivityMaster)
admin.site.register(VisaRequirement)
admin.site.register(Currency)
admin.site.register(HolidayCalendar)
admin.site.register(WeatherNormals)
admin.site.register(TravelSeason)
admin.site.register(GooglePlaceCache)
