from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    CountryViewSet, StateViewSet, CityViewSet, AirportViewSet, AirlineViewSet,
    AirportRouteViewSet, RailwayStationViewSet, TrainRouteViewSet, BusStationViewSet,
    BusRouteViewSet, MetroStationViewSet, HotelMasterViewSet, RestaurantMasterViewSet,
    AttractionMasterViewSet, ActivityMasterViewSet,
    HolidayCalendarViewSet, WeatherNormalsViewSet,
    TravelSeasonViewSet, LivePriceView, PlaceDetailsView,
    PlacePhotoProxyView, SemanticSearchView, ExploreAllView, CityBriefingView
)

router = DefaultRouter()
router.register(r'countries', CountryViewSet)
router.register(r'states', StateViewSet)
router.register(r'cities', CityViewSet)
router.register(r'airports', AirportViewSet)
router.register(r'airlines', AirlineViewSet)
router.register(r'airport-routes', AirportRouteViewSet)
router.register(r'railway-stations', RailwayStationViewSet)
router.register(r'train-routes', TrainRouteViewSet)
router.register(r'bus-stations', BusStationViewSet)
router.register(r'bus-routes', BusRouteViewSet)
router.register(r'metro-stations', MetroStationViewSet)
router.register(r'hotels', HotelMasterViewSet)
router.register(r'restaurants', RestaurantMasterViewSet)
router.register(r'attractions', AttractionMasterViewSet)
router.register(r'activities', ActivityMasterViewSet)
router.register(r'holiday-calendar', HolidayCalendarViewSet)
router.register(r'weather-normals', WeatherNormalsViewSet)
router.register(r'travel-seasons', TravelSeasonViewSet)

urlpatterns = [
    path('explore-all/', ExploreAllView.as_view(), name='explore-all'),
    path('live-price/', LivePriceView.as_view(), name='live-price'),
    path('places/details/', PlaceDetailsView.as_view(), name='place-details'),
    path('photo-proxy/<path:photo_ref>/', PlacePhotoProxyView.as_view(), name='place-photo-proxy'),
    path('search/', SemanticSearchView.as_view(), name='semantic-search'),
    path('city-briefing/', CityBriefingView.as_view(), name='city-briefing'),
    path('', include(router.urls)),
]


