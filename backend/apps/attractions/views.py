import requests
from urllib.parse import quote
from django.conf import settings
from django.db import transaction
from django.http import HttpResponse
from rest_framework import viewsets, filters, status
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.pagination import PageNumberPagination
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from .models import Attraction, Destination
from .serializers import AttractionSerializer, DestinationSerializer


def _photo_proxy_url(photo_ref):
    if not photo_ref:
        return None
    return f"/api/attractions/items/photo-proxy/?ref={quote(str(photo_ref), safe='')}"

class StandardResultsSetPagination(PageNumberPagination):
    page_size = 12
    page_size_query_param = 'page_size'
    max_page_size = 100

class DestinationViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API endpoint that allows destinations to be viewed.
    """
    queryset = Destination.objects.all().order_by('city')
    serializer_class = DestinationSerializer
    permission_classes = [AllowAny]
    pagination_class = StandardResultsSetPagination
    filter_backends = [filters.SearchFilter, DjangoFilterBackend]
    search_fields = ['city', 'country']
    filterset_fields = ['country']

class AttractionViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API endpoint that allows attractions to be viewed.
    Supports search, filtering by category/city, and pagination.
    """
    queryset = Attraction.objects.all().order_by('-rating')
    serializer_class = AttractionSerializer
    permission_classes = [AllowAny]
    pagination_class = StandardResultsSetPagination
    filter_backends = [filters.SearchFilter, DjangoFilterBackend]
    # Updated: Added city and country to search fields
    search_fields = ['name', 'description', 'address', 'city', 'country']
    # Fixed: Strictly using actual fields from models.py
    filterset_fields = ['category', 'city', 'country']

    @action(detail=False, methods=['get'])
    def popular(self, request):
        """Return the top-rated attractions."""
        popular_attractions = self.get_queryset().filter(rating__gte=4.5).order_by('-rating')[:10]
        serializer = self.get_serializer(popular_attractions, many=True)
        return Response(serializer.data)
        
    @action(detail=False, methods=['get'])
    def categories(self, request):
        """Return a list of all distinct attraction categories."""
        categories = Attraction.objects.exclude(category='').values_list('category', flat=True).distinct()
        return Response([cat for cat in categories if cat])

    @action(detail=False, methods=['get'])
    def autocomplete(self, request):
        query = request.GET.get('q', '')
        if not query:
            return Response({'predictions': []})
        
        api_key = getattr(settings, 'GOOGLE_PLACES_API_KEY', '')
        if not api_key:
            return Response({'error': 'Google Places API key not configured'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
        url = f"https://maps.googleapis.com/maps/api/place/autocomplete/json?input={query}&types=(cities)&key={api_key}"
        try:
            resp = requests.get(url, timeout=5)
            return Response(resp.json())
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'], url_path='photo-proxy')
    def photo_proxy(self, request):
        """Stream a legacy Places photo without exposing the API key."""
        photo_ref = request.GET.get('ref', '')
        api_key = getattr(settings, 'GOOGLE_PLACES_API_KEY', '')
        if not photo_ref or not api_key:
            return Response({'error': 'Photo service not configured'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        try:
            upstream = requests.get(
                "https://maps.googleapis.com/maps/api/place/photo",
                params={"maxwidth": 800, "photoreference": photo_ref, "key": api_key},
                timeout=6,
            )
        except requests.RequestException:
            return Response({'error': 'Photo fetch failed'}, status=status.HTTP_502_BAD_GATEWAY)

        if upstream.status_code != 200:
            return Response({'error': 'Photo not found'}, status=status.HTTP_404_NOT_FOUND)
        return HttpResponse(
            upstream.content,
            content_type=upstream.headers.get('Content-Type', 'image/jpeg'),
        )

    @action(detail=False, methods=['get'])
    def explore(self, request):
        location = request.GET.get('location')
        lat = request.GET.get('lat')
        lng = request.GET.get('lng')
        
        api_key = getattr(settings, 'GOOGLE_PLACES_API_KEY', '')
        if not api_key:
            return Response({'error': 'Google Places API key not configured'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        if not location and (lat and lng):
            # Reverse geocode to get city
            geocode_url = f"https://maps.googleapis.com/maps/api/geocode/json?latlng={lat},{lng}&key={api_key}"
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
                pass

        if not location:
            return Response({'error': 'Location or lat/lng is required'}, status=status.HTTP_400_BAD_REQUEST)
            
        # 1. Check Cache (DB)
        cached_places = Attraction.objects.filter(city__iexact=location)
        if cached_places.count() >= 10:
            serializer = self.get_serializer(cached_places, many=True)
            return Response({'source': 'cache', 'results': serializer.data})
            
        # 2. Fetch from Google Places Text Search API
        api_key = getattr(settings, 'GOOGLE_PLACES_API_KEY', '')
        if not api_key:
            return Response({'error': 'Google Places API key not configured'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
        categories = ['tourist_attraction', 'restaurant', 'amusement_park', 'park']
        
        for category in categories:
            query = f"top {category} in {location}"
            url = f"https://maps.googleapis.com/maps/api/place/textsearch/json?query={query}&key={api_key}"
            try:
                resp = requests.get(url, timeout=5)
                data = resp.json()
                results = data.get('results', [])[:10] # Top 10 per category
                
                for place in results:
                    place_id = place.get('place_id')
                    
                    if not Attraction.objects.filter(place_id=place_id).exists():
                        image_url = None
                        photos = place.get('photos', [])
                        if photos:
                            photo_ref = photos[0].get('photo_reference')
                            image_url = _photo_proxy_url(photo_ref)
                        
                        geom = place.get('geometry', {}).get('location', {})
                        
                        # Map google types to our basic categories if possible
                        mapped_category = category
                        if 'museum' in place.get('types', []): mapped_category = 'museum'
                        
                        try:
                            with transaction.atomic():
                                Attraction.objects.create(
                                    place_id=place_id,
                                    name=place.get('name', 'Unknown')[:250],
                                    description=place.get('formatted_address', ''),
                                    category=mapped_category,
                                    city=location[:95],
                                    country='',
                                    address=place.get('formatted_address', ''),
                                    latitude=geom.get('lat'),
                                    longitude=geom.get('lng'),
                                    rating=place.get('rating'),
                                    review_count=place.get('user_ratings_total', 0),
                                    image_url=image_url[:999] if image_url else None,
                                    price_level=place.get('price_level')
                                )
                        except Exception as e:
                            print(f"Error saving place {place_id}: {e}")
            except Exception as e:
                pass # Skip category on error
                
        # Re-fetch from DB and return
        final_places = Attraction.objects.filter(city__iexact=location).order_by('-rating')
        serializer = self.get_serializer(final_places, many=True)
        return Response({'source': 'google_places', 'results': serializer.data})

    @action(detail=True, methods=['get'])
    def details(self, request, pk=None):
        attraction = self.get_object()
        
        # Cache Check: if business_status is set or we have reviews, we probably fetched details already
        if attraction.business_status is not None or attraction.reviews:
            serializer = self.get_serializer(attraction)
            return Response({'source': 'cache', 'data': serializer.data})
            
        api_key = getattr(settings, 'GOOGLE_PLACES_API_KEY', '')
        if not api_key:
            return Response({'error': 'Google Places API key not configured'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
        url = f"https://maps.googleapis.com/maps/api/place/details/json?place_id={attraction.place_id}&key={api_key}"
        try:
            resp = requests.get(url, timeout=5)
            data = resp.json().get('result', {})
            
            # Update the attraction with deep details
            attraction.editorial_summary = data.get('editorial_summary', {}).get('overview')
            attraction.business_status = data.get('business_status', 'OPERATIONAL')
            attraction.formatted_phone_number = data.get('formatted_phone_number')
            attraction.international_phone_number = data.get('international_phone_number')
            attraction.google_maps_url = data.get('url')
            attraction.wheelchair_accessible_entrance = data.get('wheelchair_accessible_entrance')
            attraction.reservable = data.get('reservable')
            
            attraction.serves_beer = data.get('serves_beer')
            attraction.serves_wine = data.get('serves_wine')
            attraction.serves_vegetarian_food = data.get('serves_vegetarian_food')
            attraction.dine_in = data.get('dine_in')
            attraction.takeout = data.get('takeout')
            attraction.delivery = data.get('delivery')
            
            # Reviews
            attraction.reviews = data.get('reviews', [])[:5]
            
            # Secondary Images
            photos = data.get('photos', [])[1:6] # Skip the first one as it's the main image
            secondary_images = []
            for p in photos:
                ref = p.get('photo_reference')
                if ref:
                    secondary_images.append(_photo_proxy_url(ref))
            attraction.secondary_images = secondary_images
            
            # Additional info
            if not attraction.opening_hours:
                attraction.opening_hours = data.get('opening_hours', {}).get('weekday_text', [])
                
            if not attraction.website:
                attraction.website = data.get('website')
                
            attraction.save()
            
            serializer = self.get_serializer(attraction)
            return Response({'source': 'google_places', 'data': serializer.data})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
