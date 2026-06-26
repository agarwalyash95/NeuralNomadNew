"""
Homepage CMS views — all public, no authentication required.
"""
import datetime
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .models import Destination, MoodCategory, SeasonalInsight, AIFeatureTile
from .serializers import (
    DestinationSerializer, MoodCategorySerializer,
    SeasonalInsightSerializer, AIFeatureTileSerializer,
)


class DestinationViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Public destination cards.

    Query params:
        mood=<slug>        — filter by mood tag
        continent=<name>   — boost results from this continent to the top
    """

    serializer_class = DestinationSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        qs = Destination.objects.filter(is_active=True)

        mood = self.request.query_params.get('mood')
        if mood:
            # JSONField contains lookup
            qs = qs.filter(mood_tags__contains=mood)

        # Sort by computed score (view_count * 0.6 + booking_count * 0.4)
        # Python-side sort because the formula isn't easily expressible in DB without annotation
        qs = list(qs)
        continent = self.request.query_params.get('continent')
        if continent:
            # Continent-boosted sort: same continent first, then rest by score
            qs.sort(
                key=lambda d: (
                    0 if d.continent == continent else 1,
                    -d.popularity_score()
                )
            )
        else:
            qs.sort(key=lambda d: -d.popularity_score())

        return qs

    @action(detail=True, methods=['post'])
    def view(self, request, pk=None):
        """Increment view_count when user clicks/views a destination card."""
        destination = self.get_object()
        destination.view_count += 1
        destination.save(update_fields=['view_count'])
        return Response({'view_count': destination.view_count}, status=status.HTTP_200_OK)


class MoodCategoryViewSet(viewsets.ReadOnlyModelViewSet):
    """Public mood categories for the pill navbar."""

    serializer_class = MoodCategorySerializer
    permission_classes = [AllowAny]
    queryset = MoodCategory.objects.filter(is_active=True)


class SeasonalInsightViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Seasonal travel insights filtered by country_code and/or month.

    Query params:
        country_code=IN   — ISO 2-letter country code
        month=6           — month number 1-12 (defaults to current month)
    """

    serializer_class = SeasonalInsightSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        qs = SeasonalInsight.objects.filter(is_active=True)
        country_code = self.request.query_params.get('country_code', '').upper()
        month = self.request.query_params.get('month', str(datetime.date.today().month))

        try:
            month = int(month)
        except ValueError:
            month = datetime.date.today().month

        if country_code:
            # Prefer exact country match, fall back to continent level
            exact = qs.filter(country_code=country_code, month=month)
            if exact.exists():
                return exact
            return qs.filter(country_code='', month=month)  # continent-level fallback

        return qs.filter(month=month)


class AIFeatureTileViewSet(viewsets.ReadOnlyModelViewSet):
    """Public AI feature tiles for the features strip."""

    serializer_class = AIFeatureTileSerializer
    permission_classes = [AllowAny]
    queryset = AIFeatureTile.objects.filter(is_active=True)
