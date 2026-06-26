from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import AttractionViewSet, DestinationViewSet

router = DefaultRouter()
router.register(r'destinations', DestinationViewSet, basename='destination')
router.register(r'items', AttractionViewSet, basename='attraction')

urlpatterns = [
    path('', include(router.urls)),
]