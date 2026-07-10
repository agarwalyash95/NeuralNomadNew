from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.planner.views import (
    PlannerWorkspaceViewSet,
    batch_distances,
    lazy_chat,
    lazy_chat_stream,
    traveler_profile,
    workspace_chat_stream,
)

router = DefaultRouter()
router.register("workspaces", PlannerWorkspaceViewSet, basename="planner-workspace")

urlpatterns = [
    path("chat/", lazy_chat, name="planner-lazy-chat"),
    path("chat/stream/", lazy_chat_stream, name="planner-lazy-chat-stream"),
    path(
        "workspaces/<uuid:workspace_id>/chat/stream/",
        workspace_chat_stream,
        name="planner-workspace-chat-stream",
    ),
    path("distances/", batch_distances, name="planner-batch-distances"),
    path("profile/", traveler_profile, name="planner-traveler-profile"),
    path("", include(router.urls)),
]
