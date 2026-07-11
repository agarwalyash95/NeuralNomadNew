import requests
from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from django.conf import settings
from django.core.cache import cache
from django.http import HttpResponse
from django_filters.rest_framework import DjangoFilterBackend
from .models import (
    Country, State, City, Airport, Airline, AirportRoute,
    RailwayStation, TrainRoute, BusStation, BusRoute, MetroStation,
    HotelMaster, RestaurantMaster, AttractionMaster, ActivityMaster,
    HolidayCalendar, WeatherNormals, TravelSeason
)
from .serializers import (
    CountrySerializer, StateSerializer, CitySerializer, AirportSerializer, AirlineSerializer,
    AirportRouteSerializer, RailwayStationSerializer, TrainRouteSerializer, BusStationSerializer,
    BusRouteSerializer, MetroStationSerializer, HotelMasterSerializer, RestaurantMasterSerializer,
    AttractionMasterSerializer, ActivityMasterSerializer,
    HolidayCalendarSerializer, WeatherNormalsSerializer, TravelSeasonSerializer
)
from .services.suggestions import to_suggestion, to_suggestion_list

# The four explore() actions below all delegate to KnowledgeEngine.resolve()
# (apps.knowledge.services.engine), imported locally in each action to avoid
# a reference->knowledge->reference import cycle at module load time. Field
# masks / Places query templates / field mappers live in one place now:
# apps.reference.services.places_explore._category_config().


def _trigger_enrichment_if_needed(category, instance):
    """
    Fire-and-forget LLM enrichment the first time a place is actually looked
    at (details view — every replace/select flow in the planner hits this
    before confirming). Without this, a place only gets PlaceInsight rows if
    it happens to win a slot in run_enrichment_pass's popularity-ordered
    batch — new/replaced places start at popularity_score=0 and can wait
    indefinitely for that. See apps.knowledge.services.enrichment.
    """
    from apps.knowledge.services.enrichment import needs_enrichment

    if needs_enrichment(category, instance):
        from apps.reference.tasks import enrich_place
        enrich_place.delay(category, instance.pk)


def _parse_coords(request):
    lat = request.query_params.get('lat')
    lng = request.query_params.get('lng')
    if lat and lng:
        try:
            return float(lat), float(lng)
        except ValueError:
            pass
    return None, None

# Field mappers (map_hotel/map_restaurant/map_attraction/map_activity) now live
# in services/places_explore.py — service logic, not view logic — and are
# imported above under their original `_map_*` names so the four explore()
# actions below don't need to change.


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

        from apps.knowledge.services.engine import KnowledgeEngine
        source, places, error = KnowledgeEngine.resolve('hotel', location, lat=lat_val, lng=lng_val)
        if error and not places:
            return Response({'error': error}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        return Response({'source': source, 'results': to_suggestion_list(places, 'hotel')})

    @action(detail=True, methods=['get'])
    def details(self, request, pk=None):
        hotel = self.get_object()
        _trigger_enrichment_if_needed('hotel', hotel)
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

        from apps.knowledge.services.engine import KnowledgeEngine
        source, places, error = KnowledgeEngine.resolve('restaurant', location, lat=lat_val, lng=lng_val)
        if error and not places:
            return Response({'error': error}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        return Response({'source': source, 'results': to_suggestion_list(places, 'restaurant')})

    @action(detail=True, methods=['get'])
    def details(self, request, pk=None):
        restaurant = self.get_object()
        _trigger_enrichment_if_needed('restaurant', restaurant)
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

        from apps.knowledge.services.engine import KnowledgeEngine
        source, places, error = KnowledgeEngine.resolve('attraction', location, lat=lat_val, lng=lng_val)
        if error and not places:
            return Response({'error': error}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        return Response({'source': source, 'results': to_suggestion_list(places, 'attraction')})

    @action(detail=True, methods=['get'])
    def details(self, request, pk=None):
        attraction = self.get_object()
        _trigger_enrichment_if_needed('attraction', attraction)
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

        from apps.knowledge.services.engine import KnowledgeEngine
        source, places, error = KnowledgeEngine.resolve('activity', location, lat=lat_val, lng=lng_val)
        if error and not places:
            return Response({'error': error}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        return Response({'source': source, 'results': to_suggestion_list(places, 'activity')})

    @action(detail=True, methods=['get'])
    def details(self, request, pk=None):
        activity = self.get_object()
        _trigger_enrichment_if_needed('activity', activity)
        return Response({'source': 'database', 'data': to_suggestion(activity, 'activity')})

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


class CityBriefingView(APIView):
    """
    GET /reference/city-briefing/?name=<city>&month=<1-12, optional>

    Aggregates only real, already-shipped destination facts for the
    collapsed-by-default City Briefing shown under CityHeaderNode: weather
    normals, reviewed LocalTips, and TravelSeason. Absence over invention —
    any domain with nothing on file is simply omitted from the response
    (null/empty) rather than backfilled with a placeholder, so the frontend
    renders a real "nothing on file yet" gap instead of a fabricated one.

    Resolves the city by case-insensitive name only, same as
    apps.planner.services.plan_generation._resolve_cities /
    _stamp_weather_normals — the persisted trip JSON carries city names, not
    reference.City ids, so this is the one lookup key both sides agree on.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        name = request.query_params.get('name', '').strip()
        if not name:
            return Response({"error": "name is required"}, status=400)

        city = City.objects.filter(name__iexact=name).first()
        if city is None:
            return Response({"error": "No matching city on file"}, status=404)

        month = None
        month_param = request.query_params.get('month')
        if month_param:
            try:
                parsed = int(month_param)
                if 1 <= parsed <= 12:
                    month = parsed
            except ValueError:
                pass

        weather = None
        season = None
        if month:
            normal = WeatherNormals.objects.filter(city=city, month=month).first()
            if normal:
                weather = {
                    "month": month,
                    "avg_temp_c": float(normal.avg_temp_c) if normal.avg_temp_c is not None else None,
                    "precipitation_mm": float(normal.precipitation_mm) if normal.precipitation_mm is not None else None,
                    "feels_like_bucket": normal.feels_like_bucket or None,
                    "packing_note": normal.packing_note or None,
                }
            season_row = TravelSeason.objects.filter(city=city, month=month).first()
            if season_row:
                season = {
                    "month": month,
                    "season_type": season_row.season_type,
                    "natural_phenomena": season_row.natural_phenomena or [],
                }

        from django.contrib.contenttypes.models import ContentType

        from apps.knowledge.models import LocalTip

        content_type = ContentType.objects.get_for_model(City)
        tip_rows = LocalTip.objects.filter(
            content_type=content_type, object_id=str(city.pk), needs_human_review=False
        ).order_by('category')[:6]
        local_tips = [
            {"category": row.category, "text": row.tip_text, "confidence": row.confidence}
            for row in tip_rows
        ]

        return Response({
            "city": city.name,
            "country": city.country.name,
            "weather": weather,
            "season": season,
            "local_tips": local_tips,
        })


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
                _trigger_enrichment_if_needed(category, instance)
                return Response({"source": "database", "data": to_suggestion(instance, category)})

        return Response({"error": "No place found for this place_id"}, status=404)


class SemanticSearchView(APIView):
    """
    Hybrid-ready semantic search — GET /reference/search/?q=...&category=restaurant
    Cosine-similarity over EntityEmbedding (apps.knowledge.services.embeddings),
    resolved back to the Suggestion envelope. Lexical/full-text fusion is not
    added yet (see docs/travel-knowledge-engine-plan.md §10) — this is the
    semantic half on its own, already useful standalone.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        query = request.query_params.get("q", "").strip()
        if not query:
            return Response({"error": "q is required"}, status=400)

        category = request.query_params.get("category", "").strip().lower() or None
        categories = [category] if category else None
        try:
            limit = min(int(request.query_params.get("limit", 10)), 25)
        except ValueError:
            limit = 10

        from apps.knowledge.services.embeddings import semantic_search

        results = semantic_search(query, categories=categories, limit=limit)
        return Response({
            "results": [
                {**to_suggestion(r["instance"], r["category"]), "semantic_distance": round(float(r["distance"]), 4)}
                for r in results
            ],
        })


class PlacePhotoProxyView(APIView):
    """
    Streams a Google Places photo through this backend so the Places API key
    never reaches the browser. `photo_ref` is the raw Places `photos[].name`
    resource path (e.g. "places/ChIJ.../photos/AUq...") — see
    apps.reference.services.places_explore.extract_photos, which stamps
    HotelMaster/RestaurantMaster/AttractionMaster/ActivityMaster.image_url
    and .secondary_images with URLs pointing at this endpoint instead of
    Google's directly.
    """
    permission_classes = [AllowAny]
    _CACHE_TIMEOUT = 60 * 60 * 24 * 7  # 7 days — Places photo content is stable

    def get(self, request, photo_ref):
        api_key = getattr(settings, "GOOGLE_PLACES_API_KEY", "")
        if not api_key:
            return Response({"error": "Photo service not configured"}, status=503)

        try:
            max_h = int(request.query_params.get("h", 800))
            max_w = int(request.query_params.get("w", 800))
        except ValueError:
            max_h, max_w = 800, 800

        cache_key = f"place-photo:{photo_ref}:{max_w}x{max_h}"
        cached = cache.get(cache_key)
        if cached is not None:
            content, content_type = cached
            resp = HttpResponse(content, content_type=content_type)
            resp["Cache-Control"] = f"public, max-age={self._CACHE_TIMEOUT}"
            return resp

        try:
            upstream = requests.get(
                f"https://places.googleapis.com/v1/{photo_ref}/media",
                params={"maxHeightPx": max_h, "maxWidthPx": max_w, "key": api_key},
                timeout=6,
            )
        except requests.RequestException:
            return Response({"error": "Photo fetch failed"}, status=502)

        if upstream.status_code != 200:
            return Response({"error": "Photo not found"}, status=404)

        content_type = upstream.headers.get("Content-Type", "image/jpeg")
        cache.set(cache_key, (upstream.content, content_type), self._CACHE_TIMEOUT)

        resp = HttpResponse(upstream.content, content_type=content_type)
        resp["Cache-Control"] = f"public, max-age={self._CACHE_TIMEOUT}"
        return resp


class ExploreAllView(APIView):
    """
    Combined search across tourist attractions, restaurants, and outdoor activities.
    Uses KnowledgeEngine.resolve() to trigger cache-on-miss Google Places loading.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        location = request.query_params.get('location', '')
        lat_val, lng_val = _parse_coords(request)

        # Reverse geocode if coordinates are provided but location string is missing
        if not location and (lat_val is not None and lng_val is not None):
            api_key = getattr(settings, 'GOOGLE_PLACES_API_KEY', '')
            if api_key:
                geocode_url = f"https://maps.googleapis.com/maps/api/geocode/json?latlng={lat_val},{lng_val}&key={api_key}"
                try:
                    resp = requests.get(geocode_url, timeout=5)
                    data = resp.json()
                    if data.get('results'):
                        # Try to find locality
                        for component in data['results'][0]['address_components']:
                            if 'locality' in component['types']:
                                location = component['long_name']
                                break
                        if not location:
                            # Fallback to administrative_area_level_1 or something else
                            location = data['results'][0]['address_components'][0]['long_name']
                except Exception as e:
                    print(f"Error reverse geocoding coords in explore-all: {e}")

        if not location:
            return Response({'error': 'Location is required'}, status=status.HTTP_400_BAD_REQUEST)

        from apps.knowledge.services.engine import KnowledgeEngine

        categories = ['attraction', 'restaurant', 'activity']
        results = []
        overall_source = 'cache'

        for category in categories:
            try:
                source, places, error = KnowledgeEngine.resolve(category, location, lat=lat_val, lng=lng_val)
                if not error and places:
                    if source == 'google_places':
                        overall_source = 'google_places'
                    results.extend(to_suggestion_list(places, category))
            except Exception as e:
                # Log the error, but don't crash the whole view if one category fails
                print(f"Error resolving {category} in explore-all: {e}")
                pass

        # Sort the overall results by rating (highest first)
        results.sort(key=lambda x: x.get('rating') or 0, reverse=True)

        return Response({'source': overall_source, 'location': location, 'results': results})

