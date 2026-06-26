"""
URL routing for reference data API.
Base: /api/reference/
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()

# Geography
router.register('countries', views.CountryViewSet, basename='country')
router.register('states', views.StateViewSet, basename='state')
router.register('cities', views.CityViewSet, basename='city')
router.register('timezones', views.TimeZoneInfoViewSet, basename='timezone')

# Transport
router.register('airports', views.AirportViewSet, basename='airport')
router.register('airlines', views.AirlineViewSet, basename='airline')
router.register('airport-routes', views.AirportRouteViewSet, basename='airport-route')
router.register('railway-stations', views.RailwayStationViewSet, basename='railway-station')
router.register('train-routes', views.TrainRouteViewSet, basename='train-route')
router.register('bus-stations', views.BusStationViewSet, basename='bus-station')
router.register('bus-routes', views.BusRouteViewSet, basename='bus-route')
router.register('metro-stations', views.MetroStationViewSet, basename='metro-station')

# Accommodation
router.register('hotels', views.HotelMasterViewSet, basename='hotel')

# Dining
router.register('restaurants', views.RestaurantMasterViewSet, basename='restaurant')

# Attractions
router.register('attractions', views.AttractionMasterViewSet, basename='attraction')
router.register('activities', views.ActivityMasterViewSet, basename='activity')

# Travel Info
router.register('visa-requirements', views.VisaRequirementViewSet, basename='visa-requirement')
router.register('currencies', views.CurrencyViewSet, basename='currency')
router.register('holidays', views.HolidayCalendarViewSet, basename='holiday')
router.register('travel-seasons', views.TravelSeasonViewSet, basename='travel-season')

# Cache / Weather
router.register('weather', views.WeatherNormalsViewSet, basename='weather')

urlpatterns = [
    path('', include(router.urls)),
]
