"""
Accounts app URLs
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    AuthViewSet, UserViewSet, UserPreferenceViewSet,
    UploadedDocumentViewSet, ActivityLogViewSet
)

router = DefaultRouter()
router.register(r'auth', AuthViewSet, basename='auth')
router.register(r'users', UserViewSet, basename='user')
router.register(r'preferences', UserPreferenceViewSet, basename='preference')
router.register(r'documents', UploadedDocumentViewSet, basename='document')
router.register(r'activity-logs', ActivityLogViewSet, basename='activity-log')

urlpatterns = [
    path('auth/token/refresh/', TokenRefreshView.as_view(), name='token-refresh'),
    path('', include(router.urls)),
]
