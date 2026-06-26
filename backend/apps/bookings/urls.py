"""
Bookings app URLs
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import BookingViewSet, SearchInventoryViewSet, LocationViewSet

router = DefaultRouter()
router.register(r'inventory', SearchInventoryViewSet, basename='inventory')
router.register(r'locations', LocationViewSet, basename='location')
router.register(r'bookings', BookingViewSet, basename='booking')

urlpatterns = [
    path('', include(router.urls)),
]
