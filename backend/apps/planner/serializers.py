from rest_framework import serializers

from apps.planner.models import (
    PlannerChatMessage,
    PlannerTrip,
    PlannerWorkspace,
    PlanProposal,
    TripDraftState,
)


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
    lifecycle = serializers.SerializerMethodField()
    next_action = serializers.SerializerMethodField()
    bucket = serializers.SerializerMethodField()

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
            "is_modified",
            "lifecycle",
            "next_action",
            "bucket",
        ]
        read_only_fields = ["id", "last_activity_at", "created_at", "updated_at", "is_modified"]

    def get_active_canvases(self, obj):
        return []

    def get_chat_count(self, obj):
        return obj.chat_messages.count()

    def get_lifecycle(self, obj):
        """
        Where this trip sits in time — the sidebar groups by this, because
        travelers think in time and urgency, not storage statuses.
        """
        from datetime import date

        draft = getattr(obj, "draft_state", None)
        start = getattr(draft, "start_date", None)
        end = getattr(draft, "end_date", None)
        today = date.today()

        if end and end < today:
            return "past"
        if obj.status == "booked":
            if start and start <= today and (not end or today <= end):
                return "traveling"
            return "upcoming"
        return "planning"

    def get_bucket(self, obj):
        """
        Sidebar section — one at a time: Booked beats Saved beats Recent.
        A saved plan that was edited falls back to Recent (with a Modified
        badge client-side) until it's re-saved.
        """
        if obj.status == PlannerWorkspace.STATUS_BOOKED:
            return "booked"
        if obj.status == PlannerWorkspace.STATUS_SAVED and not obj.is_modified:
            return "saved"
        return "recent"

    def get_next_action(self, obj):
        """One-line hint: what does this trip need from the user next?"""
        draft = getattr(obj, "draft_state", None)

        if obj.status == "draft":
            if draft and draft.is_ready_for_plan:
                return "Ready to generate your plan"
            return "Awaiting trip details"
        if obj.status == "booked":
            return "All set"
        if obj.status == PlannerWorkspace.STATUS_SAVED and obj.is_modified:
            return "Modified since last save"
        if obj.is_modified:
            return "Unsaved changes to review"
        return "Bookings pending"


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

    def to_representation(self, instance):
        """Every trip read speaks block schema v2 — legacy rows are upcast on the fly."""
        from apps.planner.services.block_schema import upcast_trip_payload

        return upcast_trip_payload(
            super().to_representation(instance),
            default_currency=instance.currency_code or "INR",
        )


class PlanProposalSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlanProposal
        fields = [
            "id",
            "kind",
            "title",
            "rationale",
            "diff",
            "status",
            "rejection_reason",
            "created_by",
            "created_at",
            "resolved_at",
        ]
        read_only_fields = ["id", "status", "rejection_reason", "created_at", "resolved_at"]


class TripSerializer(serializers.ModelSerializer):
    destination = serializers.SerializerMethodField()
    destination_country = serializers.SerializerMethodField()
    destination_city = serializers.SerializerMethodField()
    start_date = serializers.SerializerMethodField()
    end_date = serializers.SerializerMethodField()
    budget = serializers.SerializerMethodField()
    estimated_budget = serializers.SerializerMethodField()
    actual_budget = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()
    trip_type = serializers.SerializerMethodField()
    description = serializers.SerializerMethodField()
    cover_image = serializers.SerializerMethodField()

    class Meta:
        model = PlannerWorkspace
        fields = [
            "id",
            "destination",
            "destination_country",
            "destination_city",
            "start_date",
            "end_date",
            "budget",
            "estimated_budget",
            "actual_budget",
            "status",
            "trip_type",
            "description",
            "cover_image",
            "created_at",
            "updated_at",
        ]

    def get_destination(self, obj):
        draft = getattr(obj, "draft_state", None)
        return draft.destination_text if draft else obj.title

    def get_destination_country(self, obj):
        draft = getattr(obj, "draft_state", None)
        if draft and draft.destination_city:
            return draft.destination_city.country
        return ""

    def get_destination_city(self, obj):
        draft = getattr(obj, "draft_state", None)
        if draft and draft.destination_city:
            return draft.destination_city.name
        return ""

    def get_start_date(self, obj):
        draft = getattr(obj, "draft_state", None)
        return draft.start_date.isoformat() if draft and draft.start_date else ""

    def get_end_date(self, obj):
        draft = getattr(obj, "draft_state", None)
        return draft.end_date.isoformat() if draft and draft.end_date else ""

    def get_budget(self, obj):
        draft = getattr(obj, "draft_state", None)
        return float(draft.budget_amount) if draft and draft.budget_amount else 0.0

    def get_estimated_budget(self, obj):
        return self.get_budget(obj)

    def get_actual_budget(self, obj):
        trip = getattr(obj, "trip", None)
        return float(trip.spent_budget) if trip else 0.0

    def get_status(self, obj):
        from datetime import date
        draft = getattr(obj, "draft_state", None)
        start = getattr(draft, "start_date", None)
        end = getattr(draft, "end_date", None)
        today = date.today()

        if end and end < today:
            return "completed"
        if obj.status == "booked":
            if start and start <= today and (not end or today <= end):
                return "ongoing"
            return "booked"
        return "planning"

    def get_trip_type(self, obj):
        draft = getattr(obj, "draft_state", None)
        intent = getattr(draft, "intent", "") if draft else ""
        if "adventure" in intent:
            return "adventure"
        if "business" in intent:
            return "business"
        return "leisure"

    def get_description(self, obj):
        trip = getattr(obj, "trip", None)
        return trip.summary if trip else obj.title

    def get_cover_image(self, obj):
        draft = getattr(obj, "draft_state", None)
        city = draft.destination_city.name.lower() if draft and draft.destination_city else ""
        if "goa" in city:
            return "https://images.unsplash.com/photo-1614082242765-7c98ca0f3df3?w=800&q=80"
        if "delhi" in city:
            return "https://images.unsplash.com/photo-1587474260584-136574528ed5?w=800&q=80"
        return "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80"
