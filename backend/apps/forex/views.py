"""
Forex app views
"""

from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated

from .models import ForexData, ForexVendor, ForexDeliveryRequest
from .serializers import (
    ForexDataSerializer,
    ForexVendorSerializer,
    ForexDeliveryRequestSerializer,
)


class ForexDataViewSet(viewsets.ReadOnlyModelViewSet):
    """Forex data viewset"""

    queryset = ForexData.objects.all()
    serializer_class = ForexDataSerializer
    permission_classes = [AllowAny]

    @action(detail=False, methods=['get'])
    def all_rates(self, request):
        """Get all exchange rates"""
        rates = self.get_queryset()
        serializer = self.get_serializer(rates, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def convert(self, request):
        """Convert currency"""
        from_currency = request.query_params.get('from', 'INR')
        to_currency = request.query_params.get('to')
        amount = request.query_params.get('amount', 1)

        if not to_currency:
            return Response({'error': 'to_currency parameter is required'}, status=400)

        try:
            if from_currency == 'INR':
                from_rate_val = 1.0
            else:
                from_rate_val = float(ForexData.objects.get(currency=from_currency).exchange_rate)

            if to_currency == 'INR':
                to_rate_val = 1.0
            else:
                to_rate_val = float(ForexData.objects.get(currency=to_currency).exchange_rate)

            # Convert: amount in from_currency → to_currency
            # Both rates are stored as "1 unit of currency = X INR"
            # So: amount_in_from * (from_rate / to_rate) = amount_in_to
            converted_amount = float(amount) * (from_rate_val / to_rate_val)

            return Response({
                'from_currency': from_currency,
                'to_currency': to_currency,
                'amount': float(amount),
                'converted_amount': round(converted_amount, 4),
                'rate': round(from_rate_val / to_rate_val, 6)
            })
        except ForexData.DoesNotExist:
            return Response({'error': 'Currency not found'}, status=404)

    @action(detail=False, methods=['get'])
    def by_currency(self, request):
        """Get rate for specific currency"""
        currency = request.query_params.get('currency')
        if not currency:
            return Response({'error': 'currency parameter is required'}, status=400)

        try:
            forex = ForexData.objects.get(currency=currency)
            serializer = self.get_serializer(forex)
            return Response(serializer.data)
        except ForexData.DoesNotExist:
            return Response({'error': 'Currency not found'}, status=404)


class ForexVendorViewSet(viewsets.ReadOnlyModelViewSet):
    """
    List and retrieve local forex vendors.
    Supports filtering by currency: GET /api/forex/forex-vendors/?currency=USD
    """

    queryset = ForexVendor.objects.prefetch_related('inventory').filter(is_deleted=False)
    serializer_class = ForexVendorSerializer
    permission_classes = [AllowAny]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'address']
    ordering_fields = ['rating', 'name']
    ordering = ['-rating']

    def get_queryset(self):
        queryset = super().get_queryset()
        currency = self.request.query_params.get('currency')
        if currency:
            # Filter vendors that have this currency in their inventory and it is available
            queryset = queryset.filter(
                inventory__currency=currency,
                inventory__is_available=True
            ).distinct()
        return queryset


class ForexDeliveryRequestViewSet(viewsets.ModelViewSet):
    """
    Create and manage forex pickup / delivery requests.
    - POST /api/forex/delivery-requests/  → Create a new request
    - GET  /api/forex/delivery-requests/  → List the current user's requests
    """

    serializer_class = ForexDeliveryRequestSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ['get', 'post', 'head', 'options']  # No PUT/PATCH/DELETE from client

    def get_queryset(self):
        """Return only the authenticated user's requests"""
        return ForexDeliveryRequest.objects.filter(
            user=self.request.user,
            is_deleted=False
        ).select_related('vendor').order_by('-created_at')
