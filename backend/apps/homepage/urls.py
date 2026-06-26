"""
Homepage CMS URL configuration
"""
from rest_framework.routers import DefaultRouter
from .views import (
    DestinationViewSet,
    MoodCategoryViewSet,
    SeasonalInsightViewSet,
    AIFeatureTileViewSet,
)

router = DefaultRouter()
router.register(r'destinations', DestinationViewSet, basename='homepage-destinations')
router.register(r'moods', MoodCategoryViewSet, basename='homepage-moods')
router.register(r'insights', SeasonalInsightViewSet, basename='homepage-insights')
router.register(r'features', AIFeatureTileViewSet, basename='homepage-features')

urlpatterns = router.urls
