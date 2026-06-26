"""
Forex app URLs
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ForexDataViewSet, ForexVendorViewSet, ForexDeliveryRequestViewSet

router = DefaultRouter()
router.register(r'forex-rates', ForexDataViewSet, basename='forex-rate')
router.register(r'forex-vendors', ForexVendorViewSet, basename='forex-vendor')
router.register(r'delivery-requests', ForexDeliveryRequestViewSet, basename='forex-delivery-request')

urlpatterns = [
    path('', include(router.urls)),
]
