from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.common.models import BaseModel


class PlannerWorkspace(BaseModel):
    STATUS_DRAFT = "draft"
    STATUS_ACTIVE = "active"
    STATUS_COMPLETED = "completed"
    STATUS_ARCHIVED = "archived"
    STATUS_SAVED = "saved"
    STATUS_BOOKED = "booked"

    MODE_PLANNING = "planning"
    MODE_EXPLORING = "exploring"
    MODE_BOOKING = "booking"
    MODE_REVIEW = "review"
    MODE_TRAVELING = "traveling"
    MODE_COMPLETED = "completed"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="planner_workspaces",
    )
    title = models.CharField(max_length=160, default="New Trip")
    status = models.CharField(
        max_length=20,
        choices=[
            (STATUS_DRAFT, "Draft"),
            (STATUS_ACTIVE, "Active"),
            (STATUS_COMPLETED, "Completed"),
            (STATUS_ARCHIVED, "Archived"),
            (STATUS_SAVED, "Saved"),
            (STATUS_BOOKED, "Booked"),
        ],
        default=STATUS_DRAFT,
    )
    mode = models.CharField(
        max_length=20,
        choices=[
            (MODE_PLANNING, "Planning"),
            (MODE_EXPLORING, "Exploring"),
            (MODE_BOOKING, "Booking"),
            (MODE_REVIEW, "Review"),
            (MODE_TRAVELING, "Traveling"),
            (MODE_COMPLETED, "Completed"),
        ],
        default=MODE_PLANNING,
    )
    last_activity_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-last_activity_at", "-created_at"]
        indexes = [
            models.Index(fields=["user", "-last_activity_at"]),
            models.Index(fields=["status"]),
        ]
        db_table = "planner_workspace"

    def __str__(self):
        return self.title


class TripDraftState(BaseModel):
    workspace = models.OneToOneField(
        PlannerWorkspace,
        on_delete=models.CASCADE,
        related_name="draft_state",
    )
    destination_city = models.ForeignKey(
        "reference.City",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="planner_drafts",
    )
    destination_text = models.CharField(max_length=160, blank=True)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    adults = models.PositiveSmallIntegerField(default=1)
    children = models.PositiveSmallIntegerField(default=0)
    infants = models.PositiveSmallIntegerField(default=0)
    budget_tier = models.CharField(max_length=40, blank=True)
    budget_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
    )
    budget_currency = models.CharField(max_length=3, default="INR")
    interests = models.JSONField(default=list, blank=True)
    intent = models.CharField(max_length=50, default="full_trip")
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = "planner_trip_draft_state"

    @property
    def is_ready_for_plan(self):
        return len(self.missing_slots()) == 0

    def missing_slots(self):
        missing = []
        if not self.destination_text:
            missing.append("destination")
        if not (self.start_date and self.end_date):
            missing.append("travel_dates")
        return missing


class PlannerChatMessage(BaseModel):
    ROLE_USER = "user"
    ROLE_ASSISTANT = "assistant"
    ROLE_SYSTEM = "system"

    workspace = models.ForeignKey(
        PlannerWorkspace,
        on_delete=models.CASCADE,
        related_name="chat_messages",
    )
    role = models.CharField(
        max_length=20,
        choices=[
            (ROLE_USER, "User"),
            (ROLE_ASSISTANT, "Assistant"),
            (ROLE_SYSTEM, "System"),
        ],
    )
    message = models.TextField()
    widgets = models.JSONField(default=list, blank=True)
    commands = models.JSONField(default=list, blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["created_at"]
        indexes = [models.Index(fields=["workspace", "created_at"])]
        db_table = "planner_chat_message"


class PlannerTrip(BaseModel):
    workspace = models.OneToOneField(
        PlannerWorkspace,
        on_delete=models.CASCADE,
        related_name="trip",
    )
    title = models.CharField(max_length=160)
    summary = models.TextField(blank=True)
    total_budget = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
    )
    spent_budget = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
    )
    currency_code = models.CharField(max_length=3, default="INR")
    cities = models.JSONField(default=list, blank=True)
    days = models.JSONField(default=list, blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = "planner_trip"


class PlannerQuestionBank(BaseModel):
    destination_text = models.CharField(max_length=160, db_index=True)
    missing_slots = models.JSONField(default=list, blank=True)
    question_text = models.TextField()
    widget_type = models.CharField(max_length=50)
    widget_data = models.JSONField(default=dict, blank=True)
    occurrence_count = models.IntegerField(default=1)
    success_count = models.IntegerField(default=0)

    class Meta:
        db_table = "planner_question_bank"
        ordering = ["-success_count", "-occurrence_count"]

