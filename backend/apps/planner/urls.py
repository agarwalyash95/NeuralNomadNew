from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.planner.views import PlannerWorkspaceViewSet, lazy_chat

router = DefaultRouter()
router.register("workspaces", PlannerWorkspaceViewSet, basename="planner-workspace")

urlpatterns = [
    path("chat/", lazy_chat, name="planner-lazy-chat"),
    path("", include(router.urls)),
]
