from rest_framework import viewsets, mixins, status
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from .models import (
    PlannerWorkspace, PlannerTrip, WorkspaceChat, WorkspaceActivity,
    Recommendation, CanvasInstance, BookingOrder, SavedPlace
)
from .serializers import (
    PlannerWorkspaceSerializer, PlannerTripSerializer, WorkspaceChatSerializer,
    WorkspaceActivitySerializer, RecommendationSerializer, CanvasInstanceSerializer,
    BookingOrderSerializer, SavedPlaceSerializer
)
from .permissions import IsWorkspaceOwner

class PlannerWorkspaceViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsWorkspaceOwner]
    serializer_class = PlannerWorkspaceSerializer

    def get_queryset(self):
        return PlannerWorkspace.objects.filter(user=self.request.user)
    
    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

class WorkspaceNestedViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsWorkspaceOwner]

    def get_queryset(self):
        return self.queryset.filter(workspace__user=self.request.user, workspace_id=self.kwargs.get('workspace_pk'))

    def perform_create(self, serializer):
        workspace = PlannerWorkspace.objects.get(pk=self.kwargs['workspace_pk'], user=self.request.user)
        serializer.save(workspace=workspace)

class PlannerTripViewSet(WorkspaceNestedViewSet):
    queryset = PlannerTrip.objects.all()
    serializer_class = PlannerTripSerializer

class WorkspaceChatViewSet(WorkspaceNestedViewSet):
    queryset = WorkspaceChat.objects.all()
    serializer_class = WorkspaceChatSerializer

class WorkspaceActivityViewSet(WorkspaceNestedViewSet):
    queryset = WorkspaceActivity.objects.all()
    serializer_class = WorkspaceActivitySerializer

class RecommendationViewSet(WorkspaceNestedViewSet):
    queryset = Recommendation.objects.all()
    serializer_class = RecommendationSerializer

class CanvasInstanceViewSet(WorkspaceNestedViewSet):
    queryset = CanvasInstance.objects.all()
    serializer_class = CanvasInstanceSerializer

class BookingOrderViewSet(WorkspaceNestedViewSet):
    queryset = BookingOrder.objects.all()
    serializer_class = BookingOrderSerializer

class SavedPlaceViewSet(WorkspaceNestedViewSet):
    queryset = SavedPlace.objects.all()
    serializer_class = SavedPlaceSerializer
