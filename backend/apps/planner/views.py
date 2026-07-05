from django.contrib.auth import get_user_model
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from apps.planner.models import PlannerWorkspace, TripDraftState
from apps.planner.serializers import (
    ChatResponseSerializer,
    PlannerChatMessageSerializer,
    PlannerTripSerializer,
    PlannerWorkspaceSerializer,
    TripDraftStateSerializer,
)
from apps.planner.services.conversation_service import ConversationService


def get_planner_user(request):
    if request.user and request.user.is_authenticated:
        return request.user

    user_model = get_user_model()
    user, created = user_model.objects.get_or_create(
        email="planner-demo@neuralnomad.local",
        defaults={
            "name": "Planner Demo",
            "phone": "",
            "is_active": True,
        },
    )
    if created:
        user.set_unusable_password()
        user.save(update_fields=["password"])
    return user


class PlannerWorkspaceViewSet(viewsets.ModelViewSet):
    serializer_class = PlannerWorkspaceSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        user = get_planner_user(self.request)
        return (
            PlannerWorkspace.objects.filter(user=user, is_deleted=False)
            .prefetch_related("chat_messages")
            .select_related("draft_state")
        )

    def perform_create(self, serializer):
        serializer.save(user=get_planner_user(self.request))

    def perform_destroy(self, instance):
        instance.is_deleted = True
        instance.save(update_fields=["is_deleted"])

    @action(detail=True, methods=["get", "post"], url_path="chat")
    def chat(self, request, pk=None):
        workspace = self.get_object()
        if request.method == "GET":
            messages = workspace.chat_messages.all()
            return Response(PlannerChatMessageSerializer(messages, many=True).data)

        message = request.data.get("message", "")
        structured_value = request.data.get("structured_value")
        if not message and not structured_value:
            return Response(
                {"detail": "message or structured_value is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        result = ConversationService().send_message(
            get_planner_user(request),
            message=message,
            workspace=workspace,
            structured_value=structured_value,
        )
        return Response(ChatResponseSerializer(result).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"], url_path="draft")
    def draft(self, request, pk=None):
        workspace = self.get_object()
        draft, _ = TripDraftState.objects.get_or_create(workspace=workspace)
        return Response(TripDraftStateSerializer(draft).data)

    @action(detail=True, methods=["post", "get", "patch"], url_path="plan")
    def plan(self, request, pk=None):
        workspace = self.get_object()
        service = ConversationService()

        if request.method == "POST":
            try:
                trip = service.create_plan(workspace)
            except ValueError as exc:
                return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
            return Response(PlannerTripSerializer(trip).data, status=status.HTTP_201_CREATED)

        if not hasattr(workspace, "trip"):
            return Response({"detail": "Plan has not been created yet."}, status=status.HTTP_404_NOT_FOUND)

        if request.method == "PATCH":
            serializer = PlannerTripSerializer(workspace.trip, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data)

        return Response(PlannerTripSerializer(workspace.trip).data)


@api_view(["POST"])
@permission_classes([AllowAny])
def lazy_chat(request):
    message = request.data.get("message", "")
    structured_value = request.data.get("structured_value")
    if not message and not structured_value:
        return Response(
            {"detail": "message or structured_value is required"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    result = ConversationService().send_message(
        get_planner_user(request),
        message=message,
        structured_value=structured_value,
    )
    return Response(ChatResponseSerializer(result).data, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([AllowAny])
def batch_distances(request):
    """
    POST /api/v1/planner/distances/
    Body: { "pairs": [...], "mode": "driving" }
    """
    pairs = request.data.get("pairs", [])
    mode = request.data.get("mode", "driving")
    if not pairs:
        return Response({"detail": "pairs list is required"}, status=status.HTTP_400_BAD_REQUEST)

    from apps.planner.services.distance_service import DistanceService
    results = DistanceService.fetch_batch_distances(pairs, mode=mode)
    return Response({"distances": results})

