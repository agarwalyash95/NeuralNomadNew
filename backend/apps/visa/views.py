"""
Visa app views
"""

from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny

from .models import VisaData
from .serializers import VisaDataSerializer


class VisaDataViewSet(viewsets.ReadOnlyModelViewSet):
    """Visa data viewset"""

    queryset = VisaData.objects.all()
    serializer_class = VisaDataSerializer
    permission_classes = [AllowAny]

    @action(detail=False, methods=['get'])
    def by_country(self, request):
        """
        Get visa info for a specific country.
        Supports case-insensitive exact or partial match.
        GET /api/visa/visa-data/by_country/?country=swit
        """
        country = request.query_params.get('country', '').strip()
        if not country:
            return Response({'error': 'Country parameter is required'}, status=400)

        # Try exact match first, then fall back to partial (startswith)
        qs = VisaData.objects.filter(country__iexact=country)
        if not qs.exists():
            qs = VisaData.objects.filter(country__icontains=country)

        if not qs.exists():
            return Response({'error': f'No visa data found for "{country}"'}, status=404)

        # If multiple results, return all; single result returns the object
        if qs.count() == 1:
            serializer = self.get_serializer(qs.first())
            return Response(serializer.data)

        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def required_for_india(self, request):
        """Get countries where Indians need visa"""
        visa_required = self.get_queryset().filter(visa_required=True)
        serializer = self.get_serializer(visa_required, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def exempt_for_india(self, request):
        """Get countries where Indians don't need visa"""
        visa_not_required = self.get_queryset().filter(visa_required=False)
        serializer = self.get_serializer(visa_not_required, many=True)
        return Response(serializer.data)
