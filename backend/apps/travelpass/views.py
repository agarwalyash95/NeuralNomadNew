"""
Travel Pass app views — authenticated document management
"""

import uuid
from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from .models import TravelPass
from .serializers import TravelPassSerializer


class TravelPassViewSet(viewsets.ModelViewSet):
    """
    Travel pass viewset — full CRUD for authenticated users.
    Supports file upload via multipart/form-data.
    Filter by document_type: GET /api/travelpass/travel-passes/?type=FLIGHT
    Filter by trip: GET /api/travelpass/travel-passes/?trip=<uuid>
    """

    serializer_class = TravelPassSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['valid_from', 'created_at', 'document_type']
    ordering = ['-created_at']

    def get_queryset(self):
        qs = TravelPass.objects.filter(user=self.request.user)

        # Filter by document type
        doc_type = self.request.query_params.get('type')
        if doc_type:
            qs = qs.filter(document_type=doc_type.upper())

        return qs

    def perform_create(self, serializer):
        reference_number = f"TP-{uuid.uuid4().hex[:8].upper()}"
        serializer.save(user=self.request.user, reference_number=reference_number)

    @action(detail=False, methods=['get'], url_path='summary')
    def summary(self, request):
        """Return a count summary for the user's documents"""
        qs = self.get_queryset()
        total = qs.count()
        by_type = {}
        for choice_key, _ in TravelPass.DOCUMENT_TYPE_CHOICES:
            count = qs.filter(document_type=choice_key).count()
            if count > 0:
                by_type[choice_key] = count

        active = qs.filter(status='ACTIVE').count()
        upcoming = qs.filter(status='UPCOMING').count()

        return Response({
            'total': total,
            'active': active,
            'upcoming': upcoming,
            'by_type': by_type,
        })
