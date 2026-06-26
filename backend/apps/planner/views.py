"""
Planner views — thin ViewSets that delegate to services.
"""

from rest_framework import viewsets, status, mixins
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from .models import (
    PlannerWorkspace, PlannerMemory, WorkspaceContext, WorkspaceChat,
    Recommendation, CanvasInstance, BookingOrder, SavedPlace,
)
from .serializers import (
    PlannerWorkspaceSerializer, PlannerMemorySerializer,
    WorkspaceContextSerializer, WorkspaceChatSerializer,
    ChatMessageSerializer, PlannerTripSerializer,
    RecommendationSerializer, CanvasInstanceSerializer,
    BookingOrderSerializer, SavedPlaceSerializer,
)
from .permissions import IsWorkspaceOwner
from .services.workspace_service import WorkspaceService
from .services.chat_service import ChatService
from .services.plan_service import PlanService


class WorkspaceViewSet(viewsets.ModelViewSet):
    """Workspace CRUD."""
    serializer_class = PlannerWorkspaceSerializer
    permission_classes = [IsAuthenticated, IsWorkspaceOwner]

    def get_queryset(self):
        return PlannerWorkspace.objects.filter(
            user=self.request.user, is_deleted=False,
        )

    def perform_create(self, serializer):
        service = WorkspaceService()
        workspace = service.create_workspace(
            user=self.request.user,
            title=serializer.validated_data.get('title', 'New Trip'),
        )
        serializer.instance = workspace

    @action(detail=True, methods=['get'])
    def summary(self, request, pk=None):
        """GET /workspaces/{id}/summary/ — Full workspace summary."""
        service = WorkspaceService()
        summary = service.get_workspace_summary(pk)
        return Response(summary)

    @action(detail=True, methods=['get', 'patch'])
    def memory(self, request, pk=None):
        """GET/PATCH /workspaces/{id}/memory/ — AI memory."""
        workspace = self.get_object()
        memory, _ = PlannerMemory.objects.get_or_create(workspace=workspace)

        if request.method == 'PATCH':
            serializer = PlannerMemorySerializer(memory, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data)

        serializer = PlannerMemorySerializer(memory)
        return Response(serializer.data)

    @action(detail=True, methods=['get', 'patch'])
    def context(self, request, pk=None):
        """GET/PATCH /workspaces/{id}/context/ — Trip parameters."""
        workspace = self.get_object()
        context, _ = WorkspaceContext.objects.get_or_create(workspace=workspace)

        if request.method == 'PATCH':
            serializer = WorkspaceContextSerializer(context, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data)

        serializer = WorkspaceContextSerializer(context)
        return Response(serializer.data)

    @action(detail=True, methods=['get', 'post'])
    def chat(self, request, pk=None):
        """
        GET /workspaces/{id}/chat/ — List messages
        POST /workspaces/{id}/chat/ — Send message → AI → commands → response
        """
        workspace = self.get_object()

        if request.method == 'POST':
            serializer = ChatMessageSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)

            service = ChatService()
            result = service.process_message(
                workspace_id=str(workspace.id),
                message=serializer.validated_data['message'],
            )
            return Response(result, status=status.HTTP_201_CREATED)

        # GET — list messages
        chats = WorkspaceChat.objects.filter(
            workspace=workspace, is_deleted=False,
        ).order_by('created_at')
        serializer = WorkspaceChatSerializer(chats, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get', 'patch'])
    def plan(self, request, pk=None):
        """
        GET /workspaces/{id}/plan/ — Full trip plan
        PATCH /workspaces/{id}/plan/ — Update plan metadata
        """
        workspace = self.get_object()

        if request.method == 'PATCH':
            from .models import PlannerTrip
            trip, _ = PlannerTrip.objects.get_or_create(workspace=workspace)
            serializer = PlannerTripSerializer(trip, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data)

        service = PlanService()
        plan = service.get_full_plan(str(workspace.id))
        return Response(plan)

    @action(detail=True, methods=['get'])
    def recommendations(self, request, pk=None):
        """GET /workspaces/{id}/recommendations/"""
        workspace = self.get_object()
        recs = Recommendation.objects.filter(
            workspace=workspace, is_deleted=False, is_dismissed=False,
        ).order_by('priority')
        serializer = RecommendationSerializer(recs, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get', 'post'])
    def canvases(self, request, pk=None):
        """GET/POST /workspaces/{id}/canvases/"""
        workspace = self.get_object()

        if request.method == 'POST':
            serializer = CanvasInstanceSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            serializer.save(workspace=workspace)
            return Response(serializer.data, status=status.HTTP_201_CREATED)

        instances = CanvasInstance.objects.filter(
            workspace=workspace, is_deleted=False,
        )
        serializer = CanvasInstanceSerializer(instances, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get', 'post'], url_path='cart')
    def cart(self, request, pk=None):
        """GET/POST /workspaces/{id}/cart/"""
        workspace = self.get_object()

        if request.method == 'POST':
            serializer = BookingOrderSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            serializer.save(workspace=workspace)
            return Response(serializer.data, status=status.HTTP_201_CREATED)

        orders = BookingOrder.objects.filter(
            workspace=workspace, is_deleted=False,
        )
        serializer = BookingOrderSerializer(orders, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get', 'post'], url_path='places')
    def places(self, request, pk=None):
        """GET/POST /workspaces/{id}/places/"""
        workspace = self.get_object()

        if request.method == 'POST':
            serializer = SavedPlaceSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            serializer.save(workspace=workspace)
            return Response(serializer.data, status=status.HTTP_201_CREATED)

        places = SavedPlace.objects.filter(
            workspace=workspace, is_deleted=False,
        )
        serializer = SavedPlaceSerializer(places, many=True)
        return Response(serializer.data)
