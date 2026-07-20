from rest_framework import serializers

from apps.planner.models import (
    PlannerChatMessage,
    PlannerTrip,
    PlannerWorkspace,
    PlanProposal,
    TripDraftState,
)

_CLUSTER_CHIP_LABELS = {
    "party": "Who's traveling",
    "trip_style": "Set budget & style",
    "logistics": "Stay & transport",
    "stay_style": "Stay preferences",
    "journey_style": "Journey preferences",
    "dining": "Dining preferences",
    "fine_tune": "Fine-tune details (optional)",
}


def build_suggested_replies(metadata: dict) -> list:
    """
    Context-aware next-step chips (docs/ai-chat-implementation-plan.md
    Phase 6) — deterministic, derived entirely from what the turn already
    computed (assistant message metadata), so the REST response and the SSE
    `done` event can share one implementation instead of drifting.
    """
    meta = metadata or {}
    missing = set(meta.get("missing_slots") or [])
    chips = []

    if meta.get("ready_for_plan"):
        chips.append("Create my plan ✨")

    for cluster in meta.get("pending_clusters") or []:
        label = _CLUSTER_CHIP_LABELS.get(cluster)
        if label:
            chips.append(label)
            break

    for cap in meta.get("capabilities") or []:
        offer = (cap.get("data") or {}).get("offer")
        if offer and offer.get("chip"):
            chips.append(offer["chip"])
            break

    if "destination" not in missing:
        if "origin" not in missing and "travel_dates" not in missing:
            chips.append("Compare train vs flight")
        else:
            chips.append("Check weather")

    seen = set()
    deduped = []
    for chip in chips:
        if chip not in seen:
            seen.add(chip)
            deduped.append(chip)
    return deduped[:4]


class TripDraftStateSerializer(serializers.ModelSerializer):
    ready_for_plan = serializers.BooleanField(source="is_ready_for_plan", read_only=True)
    missing_slots = serializers.SerializerMethodField()
    destination_country = serializers.SerializerMethodField()
    mobility_preferences = serializers.SerializerMethodField()

    class Meta:
        model = TripDraftState
        fields = [
            "id",
            "intent",
            "destination_city",
            "destination_country",
            "destination_text",
            "origin_city",
            "origin_text",
            "mobility_preferences",
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

    def get_destination_country(self, obj):
        city = getattr(obj, "destination_city", None)
        country = getattr(city, "country", None) if city else None
        return getattr(country, "name", country or "")

    def get_mobility_preferences(self, obj):
        return dict((obj.metadata or {}).get("mobility") or {})


class PlannerWorkspaceSerializer(serializers.ModelSerializer):
    chat_count = serializers.SerializerMethodField()
    active_canvases = serializers.SerializerMethodField()
    draft_state = TripDraftStateSerializer(read_only=True)
    lifecycle = serializers.SerializerMethodField()
    next_action = serializers.SerializerMethodField()
    bucket = serializers.SerializerMethodField()
    # §4.3: derived by the ONE authoritative resolver — never persisted,
    # never computed client-side from four separate fields.
    planner_state = serializers.SerializerMethodField()

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
            "revision",
            "lifecycle",
            "next_action",
            "bucket",
            "planner_state",
        ]
        read_only_fields = ["id", "last_activity_at", "created_at", "updated_at", "is_modified", "revision"]

    def get_active_canvases(self, obj):
        return []

    def get_planner_state(self, obj):
        from apps.planner.services.planner_state import resolve_state

        return resolve_state(obj)

    def get_chat_count(self, obj):
        annotated = getattr(obj, "chat_count_value", None)
        return annotated if annotated is not None else obj.chat_messages.count()

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
        fields = ["id", "role", "message", "widgets", "commands", "metadata", "turn_id", "created_at"]


class ChatResponseSerializer(serializers.Serializer):
    workspace = PlannerWorkspaceSerializer()
    draft_state = TripDraftStateSerializer()
    user_message = PlannerChatMessageSerializer()
    assistant_message = PlannerChatMessageSerializer()
    command_results = serializers.ListField()
    ready_for_plan = serializers.BooleanField()
    missing_slots = serializers.ListField(child=serializers.CharField())
    suggested_replies = serializers.SerializerMethodField()

    def get_suggested_replies(self, obj):
        assistant_message = obj.get("assistant_message") if isinstance(obj, dict) else getattr(obj, "assistant_message", None)
        metadata = getattr(assistant_message, "metadata", None) or {}
        return build_suggested_replies(metadata)


class PlannerTripSerializer(serializers.ModelSerializer):
    revision = serializers.IntegerField(source="workspace.revision", read_only=True)

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
            # Phase 4 (docs/planner-output-generation-architecture.md):
            # {overall, dimensions, reasons, flagged_for_review} — {} for
            # trips created before this shipped or via the legacy fallback
            # path, which is honest (a curated fallback was never scored).
            "scorecard",
            "revision",
        ]

    def to_representation(self, instance):
        """Every trip read speaks block schema v2 — legacy rows are upcast on the fly."""
        from apps.planner.services.block_schema import upcast_trip_payload

        payload = upcast_trip_payload(
            super().to_representation(instance),
            default_currency=instance.currency_code or "INR",
        )
        scorecard = payload.get("scorecard") or {}
        payload["scorecard"] = {
            "quality_state": scorecard.get("quality_state") or (
                "review_recommended" if scorecard.get("flagged_for_review") else "strong"
            ),
            "flagged_for_review": bool(scorecard.get("flagged_for_review")),
            "reasons": list(scorecard.get("reasons") or []),
            # M5 'expert reasoning shown': the LLM critic pass's findings,
            # when one ran (plan_generation.py::_run_critic_review) — None
            # when the plan wasn't flagged, the AI-call budget was already
            # spent, or the call failed. Never fabricated client-side.
            "critic_review": scorecard.get("critic_review"),
        }
        return payload


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
        city = draft.destination_city if draft else None
        return city.image_url if city and city.image_url else "/static/images/destination-placeholder.svg"
