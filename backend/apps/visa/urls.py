"""
Visa app URLs
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import VisaDataViewSet

router = DefaultRouter()
router.register(r'visa-data', VisaDataViewSet, basename='visa-data')

urlpatterns = [
    path('', include(router.urls)),
]
