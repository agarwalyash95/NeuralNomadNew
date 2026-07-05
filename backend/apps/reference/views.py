from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
import requests
from django.conf import settings
from django.db import transaction
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

    @action(detail=False, methods=['get'])
    def explore(self, request):
        location = request.query_params.get('location', '')
        if not location:
            return Response({'error': 'Location is required'}, status=status.HTTP_400_BAD_REQUEST)
            
        city_name = location.split(',')[0].strip()
        
        city_obj = City.objects.filter(name__iexact=city_name).first()
        if not city_obj:
            country_obj = Country.objects.first()
            if not country_obj:
                country_obj = Country.objects.create(name="India", code="IN")
            city_obj = City.objects.create(name=city_name.capitalize(), country=country_obj)

        cached_places = RestaurantMaster.objects.filter(city=city_obj)
        if cached_places.count() >= 5:
            serializer = self.get_serializer(cached_places, many=True)
            return Response({'source': 'cache', 'results': serializer.data})
            
        api_key = getattr(settings, 'GOOGLE_PLACES_API_KEY', '')
        if not api_key:
            return Response({'error': 'Google API key missing'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
        url = "https://places.googleapis.com/v1/places:searchText"
        headers = {
            "X-Goog-Api-Key": api_key,
            "X-Goog-FieldMask": "places.id,places.displayName,places.primaryType,places.rating,places.userRatingCount,places.priceLevel,places.formattedAddress,places.location,places.outdoorSeating,places.goodForGroups,places.allowsDogs,places.goodForChildren,places.menuForChildren,places.servesVegetarianFood,places.dineIn,places.takeout,places.delivery,places.parkingOptions,places.paymentOptions,places.reviews,places.regularOpeningHours,places.nationalPhoneNumber,places.websiteUri,places.editorialSummary,places.photos",
            "Content-Type": "application/json"
        }
        payload = {
            "textQuery": f"best restaurants in {location}",
            "includedType": "restaurant",
            "maxResultCount": 15
        }
        
        try:
            resp = requests.post(url, headers=headers, json=payload, timeout=5)
            data = resp.json()
            places = data.get('places', [])
            
            price_map = {
                "PRICE_LEVEL_FREE": 0, "PRICE_LEVEL_INEXPENSIVE": 1,
                "PRICE_LEVEL_MODERATE": 2, "PRICE_LEVEL_EXPENSIVE": 3, "PRICE_LEVEL_VERY_EXPENSIVE": 4
            }
            
            for p in places:
                place_id = p.get('id')
                if not RestaurantMaster.objects.filter(place_id=place_id).exists():
                    try:
                        with transaction.atomic():
                            pl_str = p.get('priceLevel', '')
                            pl_int = price_map.get(pl_str, None)
                            
                            image_url = ''
                            secondary_images = []
                            photos = p.get('photos', [])
                            if photos:
                                first_photo = photos[0].get('name')
                                if first_photo:
                                    image_url = f"https://places.googleapis.com/v1/{first_photo}/media?maxHeightPx=800&maxWidthPx=800&key={api_key}"
                                for sp in photos[1:6]:
                                    spname = sp.get('name')
                                    if spname:
                                        secondary_images.append(f"https://places.googleapis.com/v1/{spname}/media?maxHeightPx=800&maxWidthPx=800&key={api_key}")

                            hours = p.get('regularOpeningHours', {})
                            opening_hours = hours.get('weekdayDescriptions', [])
                            
                            summary = p.get('editorialSummary', {})
                            editorial_summary = summary.get('text', '')

                            RestaurantMaster.objects.create(
                                city=city_obj,
                                place_id=place_id,
                                name=p.get('displayName', {}).get('text', 'Unknown')[:250],
                                primary_type=p.get('primaryType', ''),
                                price_level=pl_int,
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
                                opening_hours=opening_hours,
                                national_phone_number=p.get('nationalPhoneNumber'),
                                website_uri=p.get('websiteUri'),
                                editorial_summary=editorial_summary,
                                image_url=image_url,
                                secondary_images=secondary_images
                            )
                    except Exception as e:
                        print("Error saving place", e)
                        
            final_places = RestaurantMaster.objects.filter(city=city_obj).order_by('-user_rating')
            serializer = self.get_serializer(final_places, many=True)
            return Response({'source': 'google_places', 'results': serializer.data})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['get'])
    def details(self, request, pk=None):
        # Now details only returns data from DB since it was fully fetched during explore
        restaurant = self.get_object()
        serializer = self.get_serializer(restaurant)
        return Response({'source': 'database', 'data': serializer.data})

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

        city_name = location.split(',')[0].strip()

        city_obj = City.objects.filter(name__iexact=city_name).first()
        if not city_obj:
            country_obj = Country.objects.first()
            if not country_obj:
                country_obj = Country.objects.create(name="India", code="IN")
            city_obj = City.objects.create(name=city_name.capitalize(), country=country_obj)

        cached_places = AttractionMaster.objects.filter(city=city_obj)
        if cached_places.count() >= 5:
            serializer = self.get_serializer(cached_places, many=True)
            return Response({'source': 'cache', 'results': serializer.data})

        api_key = getattr(settings, 'GOOGLE_PLACES_API_KEY', '')
        if not api_key:
            return Response({'error': 'Google API key missing'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        url = "https://places.googleapis.com/v1/places:searchText"
        headers = {
            "X-Goog-Api-Key": api_key,
            "X-Goog-FieldMask": "places.id,places.displayName,places.primaryType,places.rating,places.userRatingCount,places.formattedAddress,places.location,places.goodForChildren,places.goodForGroups,places.accessibilityOptions,places.reviews,places.regularOpeningHours,places.nationalPhoneNumber,places.websiteUri,places.editorialSummary,places.photos",
            "Content-Type": "application/json"
        }
        payload = {
            "textQuery": f"top tourist attractions, heritage sites and landmarks in {location}",
            "includedType": "tourist_attraction",
            "maxResultCount": 15
        }

        try:
            resp = requests.post(url, headers=headers, json=payload, timeout=5)
            data = resp.json()
            places = data.get('places', [])

            for p in places:
                place_id = p.get('id')
                if not AttractionMaster.objects.filter(place_id=place_id).exists():
                    try:
                        with transaction.atomic():
                            image_url = ''
                            secondary_images = []
                            photos = p.get('photos', [])
                            if photos:
                                first_photo = photos[0].get('name')
                                if first_photo:
                                    image_url = f"https://places.googleapis.com/v1/{first_photo}/media?maxHeightPx=800&maxWidthPx=800&key={api_key}"
                                for sp in photos[1:6]:
                                    spname = sp.get('name')
                                    if spname:
                                        secondary_images.append(f"https://places.googleapis.com/v1/{spname}/media?maxHeightPx=800&maxWidthPx=800&key={api_key}")

                            hours = p.get('regularOpeningHours', {})
                            opening_hours = hours.get('weekdayDescriptions', [])

                            summary = p.get('editorialSummary', {})
                            editorial_summary = summary.get('text', '')
                            access_opts = p.get('accessibilityOptions', {})

                            AttractionMaster.objects.create(
                                city=city_obj,
                                place_id=place_id,
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
                                opening_hours=opening_hours,
                                national_phone_number=p.get('nationalPhoneNumber'),
                                website_uri=p.get('websiteUri'),
                                editorial_summary=editorial_summary,
                                image_url=image_url,
                                secondary_images=secondary_images,
                                suggested_duration_mins=120,
                                ticket_price_estimate="Free / Entry Fee Applies"
                            )
                    except Exception as e:
                        print("Error saving attraction place", e)

            final_places = AttractionMaster.objects.filter(city=city_obj).order_by('-user_rating')
            serializer = self.get_serializer(final_places, many=True)
            return Response({'source': 'google_places', 'results': serializer.data})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['get'])
    def details(self, request, pk=None):
        attraction = self.get_object()
        serializer = self.get_serializer(attraction)
        return Response({'source': 'database', 'data': serializer.data})

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

        city_name = location.split(',')[0].strip()

        city_obj = City.objects.filter(name__iexact=city_name).first()
        if not city_obj:
            country_obj = Country.objects.first()
            if not country_obj:
                country_obj = Country.objects.create(name="India", code="IN")
            city_obj = City.objects.create(name=city_name.capitalize(), country=country_obj)

        cached_places = ActivityMaster.objects.filter(city=city_obj)
        if cached_places.count() >= 5:
            serializer = self.get_serializer(cached_places, many=True)
            return Response({'source': 'cache', 'results': serializer.data})

        api_key = getattr(settings, 'GOOGLE_PLACES_API_KEY', '')
        if not api_key:
            return Response({'error': 'Google API key missing'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        url = "https://places.googleapis.com/v1/places:searchText"
        headers = {
            "X-Goog-Api-Key": api_key,
            "X-Goog-FieldMask": "places.id,places.displayName,places.primaryType,places.rating,places.userRatingCount,places.formattedAddress,places.location,places.goodForChildren,places.goodForGroups,places.reviews,places.regularOpeningHours,places.nationalPhoneNumber,places.websiteUri,places.editorialSummary,places.photos",
            "Content-Type": "application/json"
        }
        payload = {
            "textQuery": f"top adventure activities, outdoor sports and tours in {location}",
            "maxResultCount": 15
        }

        try:
            resp = requests.post(url, headers=headers, json=payload, timeout=5)
            data = resp.json()
            places = data.get('places', [])

            for p in places:
                place_id = p.get('id')
                if not ActivityMaster.objects.filter(place_id=place_id).exists():
                    try:
                        with transaction.atomic():
                            image_url = ''
                            secondary_images = []
                            photos = p.get('photos', [])
                            if photos:
                                first_photo = photos[0].get('name')
                                if first_photo:
                                    image_url = f"https://places.googleapis.com/v1/{first_photo}/media?maxHeightPx=800&maxWidthPx=800&key={api_key}"
                                for sp in photos[1:6]:
                                    spname = sp.get('name')
                                    if spname:
                                        secondary_images.append(f"https://places.googleapis.com/v1/{spname}/media?maxHeightPx=800&maxWidthPx=800&key={api_key}")

                            hours = p.get('regularOpeningHours', {})
                            opening_hours = hours.get('weekdayDescriptions', [])

                            summary = p.get('editorialSummary', {})
                            editorial_summary = summary.get('text', '')

                            ActivityMaster.objects.create(
                                city=city_obj,
                                place_id=place_id,
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
                                guided_tour=True,
                                equipment_included=True,
                                reviews=p.get('reviews', [])[:5],
                                opening_hours=opening_hours,
                                national_phone_number=p.get('nationalPhoneNumber'),
                                website_uri=p.get('websiteUri'),
                                editorial_summary=editorial_summary,
                                image_url=image_url,
                                secondary_images=secondary_images,
                                price_estimate=1200.00,
                                suggested_duration="3-4 hours",
                                difficulty_level="Moderate"
                            )
                    except Exception as e:
                        print("Error saving activity place", e)

            final_places = ActivityMaster.objects.filter(city=city_obj).order_by('-user_rating')
            serializer = self.get_serializer(final_places, many=True)
            return Response({'source': 'google_places', 'results': serializer.data})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['get'])
    def details(self, request, pk=None):
        activity = self.get_object()
        serializer = self.get_serializer(activity)
        return Response({'source': 'database', 'data': serializer.data})

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
