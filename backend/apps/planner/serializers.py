from rest_framework import serializers

from apps.planner.models import PlannerChatMessage, PlannerTrip, PlannerWorkspace, TripDraftState


class TripDraftStateSerializer(serializers.ModelSerializer):
    ready_for_plan = serializers.BooleanField(source="is_ready_for_plan", read_only=True)
    missing_slots = serializers.SerializerMethodField()

    class Meta:
        model = TripDraftState
        fields = [
            "id",
            "destination_city",
            "destination_text",
            "start_date",
            "end_date",
            "adults",
            "children",
            "infants",
            "budget_tier",
            "budget_amount",
            "budget_currency",
            "interests",
            "metadata",
            "ready_for_plan",
            "missing_slots",
        ]

    def get_missing_slots(self, obj):
        return obj.missing_slots()


class PlannerWorkspaceSerializer(serializers.ModelSerializer):
    chat_count = serializers.SerializerMethodField()
    active_canvases = serializers.SerializerMethodField()
    draft_state = TripDraftStateSerializer(read_only=True)

    class Meta:
        model = PlannerWorkspace
        fields = [
            "id",
            "title",
            "status",
            "mode",
            "last_activity_at",
            "created_at",
            "updated_at",
            "chat_count",
            "active_canvases",
            "draft_state",
        ]
        read_only_fields = ["id", "last_activity_at", "created_at", "updated_at"]

    def get_active_canvases(self, obj):
        return []

    def get_chat_count(self, obj):
        return obj.chat_messages.count()


class PlannerChatMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlannerChatMessage
        fields = ["id", "role", "message", "widgets", "commands", "metadata", "created_at"]


class ChatResponseSerializer(serializers.Serializer):
    workspace = PlannerWorkspaceSerializer()
    draft_state = TripDraftStateSerializer()
    user_message = PlannerChatMessageSerializer()
    assistant_message = PlannerChatMessageSerializer()
    command_results = serializers.ListField()
    ready_for_plan = serializers.BooleanField()
    missing_slots = serializers.ListField(child=serializers.CharField())


class PlannerTripSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlannerTrip
        fields = [
            "id",
            "title",
            "summary",
            "total_budget",
            "spent_budget",
            "currency_code",
            "metadata",
            "cities",
            "days",
        ]
