from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    PlannerWorkspaceViewSet, PlannerTripViewSet, WorkspaceChatViewSet,
    WorkspaceActivityViewSet, RecommendationViewSet, CanvasInstanceViewSet,
    BookingOrderViewSet, SavedPlaceViewSet
)

router = DefaultRouter()
router.register(r'workspaces', PlannerWorkspaceViewSet, basename='workspace')

nested_urls = [
    path('trips/', PlannerTripViewSet.as_view({'get': 'list', 'post': 'create'})),
    path('trips/<int:pk>/', PlannerTripViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'})),
    
    path('chats/', WorkspaceChatViewSet.as_view({'get': 'list', 'post': 'create'})),
    path('chats/<int:pk>/', WorkspaceChatViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'})),
    
    path('activities/', WorkspaceActivityViewSet.as_view({'get': 'list', 'post': 'create'})),
    path('activities/<int:pk>/', WorkspaceActivityViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'})),

    path('recommendations/', RecommendationViewSet.as_view({'get': 'list', 'post': 'create'})),
    path('recommendations/<int:pk>/', RecommendationViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'})),

    path('canvases/', CanvasInstanceViewSet.as_view({'get': 'list', 'post': 'create'})),
    path('canvases/<uuid:pk>/', CanvasInstanceViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'})),

    path('bookings/', BookingOrderViewSet.as_view({'get': 'list', 'post': 'create'})),
    path('bookings/<int:pk>/', BookingOrderViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'})),

    path('saved-places/', SavedPlaceViewSet.as_view({'get': 'list', 'post': 'create'})),
    path('saved-places/<int:pk>/', SavedPlaceViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'})),
]

urlpatterns = [
    path('', include(router.urls)),
    path('workspaces/<uuid:workspace_pk>/', include(nested_urls)),
]
