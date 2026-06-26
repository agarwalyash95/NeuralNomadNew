"""
Planner serializers.
"""

from rest_framework import serializers
from .models import (
    PlannerWorkspace, PlannerMemory, WorkspaceContext, WorkspaceChat,
    WorkspaceActivity, PlannerTrip, TripCity, TripDay, TripActivity,
    TripRoute, Recommendation, CanvasInstance, CanvasData,
    BookingOrder, SavedPlace,
)


class PlannerWorkspaceSerializer(serializers.ModelSerializer):
    chat_count = serializers.SerializerMethodField()
    active_canvases = serializers.SerializerMethodField()

    class Meta:
        model = PlannerWorkspace
        fields = [
            'id', 'title', 'status', 'mode',
            'last_activity_at', 'created_at', 'updated_at',
            'chat_count', 'active_canvases',
        ]
        read_only_fields = ['id', 'last_activity_at', 'created_at', 'updated_at']

    def get_chat_count(self, obj):
        return obj.chats.filter(is_deleted=False).count()

    def get_active_canvases(self, obj):
        return list(
            obj.canvas_instances.filter(
                is_active=True, is_deleted=False,
            ).values_list('canvas_type', flat=True)
        )


class PlannerMemorySerializer(serializers.ModelSerializer):
    class Meta:
        model = PlannerMemory
        fields = [
            'destination', 'origin', 'dates', 'travelers', 'budget',
            'transportation_preference', 'hotel_preference', 'interests',
            'food_preference', 'accessibility',
            'visa_status', 'booking_summary', 'current_phase',
            'conversation_summary', 'last_ai_action',
        ]


class WorkspaceContextSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkspaceContext
        fields = [
            'origin_location', 'destination_location',
            'start_date', 'end_date',
            'adults', 'children', 'infants',
            'budget', 'budget_currency', 'travel_style',
            'interests', 'metadata',
        ]


class WorkspaceChatSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkspaceChat
        fields = ['id', 'role', 'message', 'widgets', 'commands', 'created_at']
        read_only_fields = ['id', 'role', 'widgets', 'commands', 'created_at']


class ChatMessageSerializer(serializers.Serializer):
    """Input serializer for sending a chat message."""
    message = serializers.CharField(max_length=5000)


class TripActivitySerializer(serializers.ModelSerializer):
    class Meta:
        model = TripActivity
        fields = [
            'id', 'title', 'category', 'location_name',
            'latitude', 'longitude', 'start_time', 'end_time',
            'duration_minutes', 'distance_km', 'travel_time_minutes',
            'transport_mode', 'estimated_cost', 'currency_code',
            'status', 'order', 'notes', 'weather_info', 'metadata',
        ]


class TripDaySerializer(serializers.ModelSerializer):
    activities = TripActivitySerializer(many=True, read_only=True)

    class Meta:
        model = TripDay
        fields = ['id', 'day_number', 'date', 'title', 'day_type', 'activities']


class TripCitySerializer(serializers.ModelSerializer):
    class Meta:
        model = TripCity
        fields = [
            'id', 'name', 'country', 'latitude', 'longitude',
            'order', 'nights', 'arrival_date', 'departure_date',
        ]


class PlannerTripSerializer(serializers.ModelSerializer):
    cities = TripCitySerializer(many=True, read_only=True)
    days = TripDaySerializer(many=True, read_only=True)

    class Meta:
        model = PlannerTrip
        fields = [
            'id', 'title', 'summary', 'total_budget', 'spent_budget',
            'currency_code', 'metadata', 'cities', 'days',
        ]


class RecommendationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Recommendation
        fields = [
            'id', 'type', 'canvas_type', 'title', 'description',
            'confidence', 'priority', 'reason',
            'estimated_cost', 'estimated_time', 'impact',
            'dependencies', 'actions', 'data',
            'is_dismissed', 'is_accepted',
        ]


class CanvasInstanceSerializer(serializers.ModelSerializer):
    class Meta:
        model = CanvasInstance
        fields = ['id', 'canvas_type', 'lifecycle_state', 'is_active', 'display_order']


class BookingOrderSerializer(serializers.ModelSerializer):
    class Meta:
        model = BookingOrder
        fields = [
            'id', 'item_type', 'source_canvas', 'title', 'provider',
            'price', 'currency_code', 'status', 'metadata', 'created_at',
        ]


class SavedPlaceSerializer(serializers.ModelSerializer):
    class Meta:
        model = SavedPlace
        fields = [
            'id', 'name', 'category', 'address',
            'latitude', 'longitude', 'rating', 'metadata', 'created_at',
        ]
