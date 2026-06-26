"""
URL routing for the planner API.
Base: /api/planner/
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register('workspaces', views.WorkspaceViewSet, basename='workspace')

urlpatterns = [
    path('', include(router.urls)),
]
