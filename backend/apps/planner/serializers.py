from rest_framework import serializers
from .models import (
    PlannerWorkspace, PlannerMemory, WorkspaceContext, WorkspaceChat,
    WorkspaceActivity, PlannerTrip, TripCity, TripDay, TripActivity,
    TripRoute, Recommendation, CanvasInstance, CanvasData, BookingOrder, SavedPlace
)

class PlannerMemorySerializer(serializers.ModelSerializer):
    class Meta:
        model = PlannerMemory
        fields = '__all__'

class WorkspaceContextSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkspaceContext
        fields = '__all__'

class PlannerWorkspaceSerializer(serializers.ModelSerializer):
    memory = PlannerMemorySerializer(read_only=True)
    context = WorkspaceContextSerializer(read_only=True)

    class Meta:
        model = PlannerWorkspace
        fields = '__all__'
        read_only_fields = ['user']

class WorkspaceChatSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkspaceChat
        fields = '__all__'

class WorkspaceActivitySerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkspaceActivity
        fields = '__all__'

class TripActivitySerializer(serializers.ModelSerializer):
    class Meta:
        model = TripActivity
        fields = '__all__'

class TripDaySerializer(serializers.ModelSerializer):
    activities = TripActivitySerializer(many=True, read_only=True)
    class Meta:
        model = TripDay
        fields = '__all__'

class TripCitySerializer(serializers.ModelSerializer):
    days = TripDaySerializer(many=True, read_only=True)
    class Meta:
        model = TripCity
        fields = '__all__'

class TripRouteSerializer(serializers.ModelSerializer):
    class Meta:
        model = TripRoute
        fields = '__all__'

class PlannerTripSerializer(serializers.ModelSerializer):
    cities = TripCitySerializer(many=True, read_only=True)
    routes = TripRouteSerializer(many=True, read_only=True)
    class Meta:
        model = PlannerTrip
        fields = '__all__'

class RecommendationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Recommendation
        fields = '__all__'

class CanvasDataSerializer(serializers.ModelSerializer):
    class Meta:
        model = CanvasData
        fields = '__all__'

class CanvasInstanceSerializer(serializers.ModelSerializer):
    results = CanvasDataSerializer(many=True, read_only=True)
    class Meta:
        model = CanvasInstance
        fields = '__all__'

class BookingOrderSerializer(serializers.ModelSerializer):
    class Meta:
        model = BookingOrder
        fields = '__all__'

class SavedPlaceSerializer(serializers.ModelSerializer):
    class Meta:
        model = SavedPlace
        fields = '__all__'
