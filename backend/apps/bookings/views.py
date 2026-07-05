"""
Bookings app views
"""

from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.db.models import Q

from .models import Booking, SearchInventory, Location
from .serializers import BookingSerializer, SearchInventorySerializer, LocationSerializer


class BookingViewSet(viewsets.ModelViewSet):
    """Booking viewset — manages a user's saved bookings."""

    serializer_class = BookingSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Booking.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        import uuid
        reference_number = f"BK{uuid.uuid4().hex[:10].upper()}"
        serializer.save(user=self.request.user, reference_number=reference_number)

    @action(detail=True, methods=['post'])
    def confirm_payment(self, request, pk=None):
        """Confirm payment for a booking"""
        booking = self.get_object()
        booking.payment_confirmed = True
        booking.status = 'confirmed'
        booking.payment_method = request.data.get('payment_method', 'credit_card')
        booking.save()
        return Response(self.get_serializer(booking).data)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Cancel a booking"""
        booking = self.get_object()
        if booking.status == 'completed':
            return Response(
                {'error': 'Cannot cancel completed bookings'},
                status=status.HTTP_400_BAD_REQUEST
            )
        booking.status = 'cancelled'
        booking.save()
        return Response(self.get_serializer(booking).data)

    @action(detail=False, methods=['get'])
    def pending(self, request):
        """Get pending bookings"""
        bookings = self.get_queryset().filter(status='pending')
        return Response(self.get_serializer(bookings, many=True).data)

    @action(detail=False, methods=['get'])
    def confirmed(self, request):
        """Get confirmed bookings"""
        bookings = self.get_queryset().filter(status='confirmed')
        return Response(self.get_serializer(bookings, many=True).data)


from .providers.registry import provider_registry


class SearchInventoryViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Search Inventory viewset — read-only travel search results via Provider Registry.

    Endpoint: GET /api/bookings/inventory/search/
    Query Params:
      - service     : flight | train | hotel | bus | cab  (required)
      - origin      : city name or code (for flights/trains/bus)
      - destination : city name or code (for flights/trains/bus)
      - city        : for hotels
      - pickup      : for cabs
      - drop        : for cabs
      - departureDate: departure date
    """
    serializer_class = SearchInventorySerializer
    permission_classes = [AllowAny]  # Search is public — no login required
    queryset = SearchInventory.objects.filter(is_active=True)

    @action(detail=False, methods=['get'])
    def search(self, request):
        """
        Main search endpoint using dynamic provider architecture.
        Delegates to RapidAPI endpoints (SkyScrapper, BookingCom, Redbus, LiveTrainStatus)
        or mock database fallbacks.
        """
        service = request.query_params.get('service', '').lower()
        if not service:
            return Response({'error': 'service parameter is required'}, status=400)

        # Convert query params to dict
        params = request.query_params.dict()
        results = provider_registry.search(service, params)
        return Response(results)



class LocationViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for searching locations for autocomplete dropdowns.
    """
    queryset = Location.objects.all()
    serializer_class = LocationSerializer
    permission_classes = [permissions.AllowAny]

    @action(detail=False, methods=['get'])
    def search(self, request):
        """
        Search locations by query and type.
        Usage: /api/bookings/locations/search/?q=delhi&type=airport
        """
        query = request.query_params.get('q', '').strip()
        loc_type = request.query_params.get('type', '').strip().lower()

        if not query:
            return Response([])

        qs = self.get_queryset()

        if loc_type:
            qs = qs.filter(location_type=loc_type)

        # Search across name, city, and code
        qs = qs.filter(
            Q(name__icontains=query) |
            Q(city__icontains=query) |
            Q(code__icontains=query)
        )

        # Limit to 10 suggestions
        serializer = self.get_serializer(qs[:10], many=True)
        return Response(serializer.data)
