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


# All supported intents
INTENT_FULL_TRIP = "full_trip"
INTENT_HOTEL_ONLY = "hotel_only"
INTENT_FLIGHT_ONLY = "flight_only"
INTENT_TRAIN_ONLY = "train_only"
INTENT_BUS_ONLY = "bus_only"
INTENT_CAB_ONLY = "cab_only"
INTENT_CRUISE_ONLY = "cruise_only"
INTENT_CAR_RENTAL = "car_rental"
INTENT_TRANSIT_ONLY = "transit_only"
INTENT_ACTIVITIES_ONLY = "activities_only"
INTENT_FOOD_AND_DINING = "food_and_dining"

INTENT_CHOICES = [
    (INTENT_FULL_TRIP, "Full Trip"),
    (INTENT_HOTEL_ONLY, "Hotel Only"),
    (INTENT_FLIGHT_ONLY, "Flight Only"),
    (INTENT_TRAIN_ONLY, "Train Only"),
    (INTENT_BUS_ONLY, "Bus Only"),
    (INTENT_CAB_ONLY, "Cab / Taxi Only"),
    (INTENT_CRUISE_ONLY, "Cruise Only"),
    (INTENT_CAR_RENTAL, "Car Rental"),
    (INTENT_TRANSIT_ONLY, "Transit (Mixed)"),
    (INTENT_ACTIVITIES_ONLY, "Activities Only"),
    (INTENT_FOOD_AND_DINING, "Food & Dining"),
]

# Fields required per intent (mandatory to show a widget for)
INTENT_REQUIRED_FIELDS = {
    INTENT_FULL_TRIP: ["destination", "travel_dates"],
    INTENT_HOTEL_ONLY: ["destination", "travel_dates"],
    INTENT_FLIGHT_ONLY: ["destination", "origin", "travel_dates"],
    INTENT_TRAIN_ONLY: ["destination", "origin", "travel_dates"],
    INTENT_BUS_ONLY: ["destination", "origin", "travel_dates"],
    INTENT_CAB_ONLY: ["destination", "origin", "travel_dates"],
    INTENT_CRUISE_ONLY: ["destination", "travel_dates"],
    INTENT_CAR_RENTAL: ["destination", "origin", "travel_dates"],
    INTENT_TRANSIT_ONLY: ["destination", "origin", "travel_dates"],
    INTENT_ACTIVITIES_ONLY: ["destination", "travel_dates"],
    INTENT_FOOD_AND_DINING: ["destination", "travel_dates"],
}

# Optional fields to collect per intent (shown in optional_trip_details widget)
# visit_purpose is always listed first — it's the most impactful optional field
INTENT_OPTIONAL_FIELDS = {
    INTENT_FULL_TRIP:       ["visit_purpose", "travelers", "budget", "interests", "origin", "trip_pace"],
    INTENT_HOTEL_ONLY:      ["visit_purpose", "travelers", "budget", "star_rating", "stay_amenities", "property_type"],
    INTENT_FLIGHT_ONLY:     ["visit_purpose", "travelers", "budget", "flight_class", "time_window", "non_stop"],
    INTENT_TRAIN_ONLY:      ["visit_purpose", "travelers", "budget", "train_class", "tatkal", "meal_preference", "time_window"],
    INTENT_BUS_ONLY:        ["visit_purpose", "travelers", "budget", "bus_type", "journey_timing"],
    INTENT_CAB_ONLY:        ["visit_purpose", "travelers", "vehicle_type", "return_trip", "budget"],
    INTENT_CRUISE_ONLY:     ["visit_purpose", "travelers", "budget", "cabin_class", "dining_package"],
    INTENT_CAR_RENTAL:      ["visit_purpose", "travelers", "car_type", "transmission", "budget"],
    INTENT_TRANSIT_ONLY:    ["visit_purpose", "travelers", "budget", "preferred_mode", "priority"],
    INTENT_ACTIVITIES_ONLY: ["visit_purpose", "travelers", "interests", "intensity_level", "budget"],
    INTENT_FOOD_AND_DINING: ["visit_purpose", "travelers", "budget", "meal_type", "cuisine", "dietary", "ambiance"],
}


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
    intent = models.CharField(max_length=50, default=INTENT_FULL_TRIP, choices=INTENT_CHOICES)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = "planner_trip_draft_state"

    @property
    def is_ready_for_plan(self):
        return len(self.missing_required_slots()) == 0

    def missing_required_slots(self):
        """Returns mandatory slots (destination + dates + origin if required) that block plan creation."""
        missing = []
        if not self.destination_text:
            missing.append("destination")
        
        required_fields = INTENT_REQUIRED_FIELDS.get(self.intent, [])
        if "origin" in required_fields:
            meta = self.metadata or {}
            if not meta.get("origin"):
                missing.append("origin")

        if not (self.start_date and self.end_date):
            missing.append("travel_dates")
        return missing

    def missing_slots(self):
        """
        Returns ALL missing slots — required + optional — based on intent.
        Used by the conversation engine to determine what to ask next.
        """
        missing = list(self.missing_required_slots())
        meta = self.metadata or {}

        # Optional details not yet submitted for this intent
        if not meta.get("optional_submitted"):
            optional_fields = INTENT_OPTIONAL_FIELDS.get(self.intent, [])
            unfilled = self._get_unfilled_optional_fields(optional_fields)
            if unfilled:
                missing.append("optional_details")

        # Nearby cities only relevant for full_trip with 3+ days
        if (
            self.intent == INTENT_FULL_TRIP
            and self.start_date
            and self.end_date
            and (self.end_date - self.start_date).days >= 3
            and not meta.get("nearby_cities")
        ):
            missing.append("nearby_cities")

        return missing

    def _get_unfilled_optional_fields(self, fields):
        """Return only the optional fields that haven't been filled yet."""
        meta = self.metadata or {}
        filled = set()

        # Core fields on the model
        if self.adults and self.adults > 0:
            filled.add("travelers")
        if self.budget_tier or meta.get("budget_inr"):
            filled.add("budget")
        if self.interests:
            filled.add("interests")
        if meta.get("origin"):
            filled.add("origin")

        # All metadata-backed optional fields
        meta_backed = [
            "visit_purpose", "train_class", "cabin_class", "car_type", "preferred_mode",
            "flight_class", "time_window", "non_stop", "tatkal", "meal_preference",
            "bus_type", "journey_timing", "vehicle_type", "return_trip",
            "transmission", "priority", "trip_pace", "intensity_level",
            "star_rating", "stay_amenities", "property_type", "dining_package",
            "meal_type", "cuisine", "dietary", "ambiance",
        ]
        for field in meta_backed:
            if meta.get(field) is not None:
                filled.add(field)

        return [f for f in fields if f not in filled]


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
    """
    Stores proven questions and widgets for specific intents and destinations.
    The AI uses this to learn the best question to ask next for a given context.
    """
    intent = models.CharField(
        max_length=50,
        choices=INTENT_CHOICES,
        default=INTENT_FULL_TRIP,
        db_index=True,
    )
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
        indexes = [
            models.Index(fields=["intent", "destination_text"]),
        ]


class PlannerIntentFlow(BaseModel):
    """
    Records successful conversation patterns per intent.
    When a plan is successfully created, the conversation flow is stored here.
    Future AI sessions use these learned flows as templates.
    """
    intent = models.CharField(max_length=50, choices=INTENT_CHOICES, db_index=True)
    destination_text = models.CharField(max_length=160, default="*", db_index=True)
    conversation_steps = models.JSONField(
        default=list,
        help_text="Ordered list of {slot, widget, message_index} steps",
    )
    completion_rate = models.FloatField(
        default=0.0,
        help_text="Fraction of sessions that led to plan creation",
    )
    usage_count = models.IntegerField(default=0)
    avg_messages_to_complete = models.FloatField(
        default=0.0,
        help_text="Average number of messages to reach plan creation",
    )
    last_used_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "planner_intent_flow"
        ordering = ["-completion_rate", "-usage_count"]
        indexes = [
            models.Index(fields=["intent", "destination_text"]),
        ]

    def __str__(self):
        return f"{self.intent} / {self.destination_text} (rate={self.completion_rate:.0%})"
