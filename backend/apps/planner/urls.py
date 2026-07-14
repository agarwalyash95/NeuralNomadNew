from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.planner.views import (
    PlannerWorkspaceViewSet,
    TripViewSet,
    batch_distances,
    compare_transport_legs,
    explain_recommendation,
    lazy_chat,
    lazy_chat_stream,
    traveler_profile,
    trip_prep_status,
    workspace_chat_stream,
)

router = DefaultRouter()
router.register("workspaces", PlannerWorkspaceViewSet, basename="planner-workspace")
router.register("trips", TripViewSet, basename="planner-trip")

urlpatterns = [
    path("chat/", lazy_chat, name="planner-lazy-chat"),
    path("chat/stream/", lazy_chat_stream, name="planner-lazy-chat-stream"),
    path(
        "workspaces/<uuid:workspace_id>/chat/stream/",
        workspace_chat_stream,
        name="planner-workspace-chat-stream",
    ),
    path("distances/", batch_distances, name="planner-batch-distances"),
    path("legs/compare/", compare_transport_legs, name="planner-compare-transport-legs"),
    path("profile/", traveler_profile, name="planner-traveler-profile"),
    path("recommendations/explain/", explain_recommendation, name="planner-explain-recommendation"),
    path(
        "workspaces/<uuid:workspace_id>/trip-prep/",
        trip_prep_status,
        name="planner-trip-prep-status",
    ),
    path("", include(router.urls)),
]
