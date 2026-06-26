"""
Travel Pass app URLs
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import TravelPassViewSet

router = DefaultRouter()
router.register(r'travel-passes', TravelPassViewSet, basename='travel-pass')

urlpatterns = [
    path('', include(router.urls)),
]
