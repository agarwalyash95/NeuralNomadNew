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
    is_modified = models.BooleanField(default=False)

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


class PlannerTripOriginal(BaseModel):
    workspace = models.OneToOneField(
        PlannerWorkspace,
        on_delete=models.CASCADE,
        related_name="original_trip",
    )
    title = models.CharField(max_length=160)
    summary = models.TextField(blank=True)
    cities = models.JSONField(default=list, blank=True)
    days = models.JSONField(default=list, blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = "planner_trip_original"

    def __str__(self):
        return f"Original: {self.title}"


class PlanGenerationJob(BaseModel):
    """
    One background plan-generation run. The loading screen polls this row —
    every phase/progress/detail here is real pipeline state, never cosmetic.
    Its own table (not PlannerTrip.metadata) because the trip row doesn't
    exist yet while generation runs, and failed runs are worth keeping.
    """

    STATUS_QUEUED = "queued"
    STATUS_RUNNING = "running"
    STATUS_DONE = "done"
    STATUS_FAILED = "failed"
    STATUS_CHOICES = [
        (STATUS_QUEUED, "Queued"),
        (STATUS_RUNNING, "Running"),
        (STATUS_DONE, "Done"),
        (STATUS_FAILED, "Failed"),
    ]

    workspace = models.ForeignKey(
        PlannerWorkspace,
        on_delete=models.CASCADE,
        related_name="generation_jobs",
    )
    status = models.CharField(max_length=12, default=STATUS_QUEUED, choices=STATUS_CHOICES, db_index=True)
    phase = models.CharField(max_length=40, blank=True, default="")
    progress = models.PositiveSmallIntegerField(default=0)
    # [{key, label, state: pending|active|done|failed, detail, at}]
    phase_log = models.JSONField(default=list, blank=True)
    error = models.TextField(blank=True, default="")
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "planner_generation_job"
        ordering = ["-created_at"]

    def __str__(self):
        return f"GenerationJob {self.workspace_id} [{self.status} {self.progress}%]"


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


class PlanProposal(BaseModel):
    """
    An agent- or tool-initiated change to a plan, awaiting the traveler's
    decision. The AI never mutates a plan directly — every change flows
    through a proposal the user accepts, rejects, or lets expire.

    diff shape: {"before": {"days": [...]}, "after": {"days": [...]},
                 "deltas": {"saved_km": float, "saved_mins": int, ...}}
    Days in the diff use block schema v2.
    """

    KIND_ROUTE_OPTIMIZATION = "route_optimization"
    KIND_PLAN_EDIT = "plan_edit"
    KIND_PRICE_WATCH = "price_watch"
    KIND_INSIGHT = "insight"  # PlanInsightEngine rules with a concrete corrective diff (K5+)

    STATUS_OPEN = "open"
    STATUS_ACCEPTED = "accepted"
    STATUS_REJECTED = "rejected"
    STATUS_EXPIRED = "expired"

    STATUS_CHOICES = [
        (STATUS_OPEN, "Open"),
        (STATUS_ACCEPTED, "Accepted"),
        (STATUS_REJECTED, "Rejected"),
        (STATUS_EXPIRED, "Expired"),
    ]

    workspace = models.ForeignKey(
        PlannerWorkspace,
        on_delete=models.CASCADE,
        related_name="proposals",
    )
    kind = models.CharField(max_length=40, default=KIND_PLAN_EDIT)
    title = models.CharField(max_length=200)
    rationale = models.TextField(blank=True)
    diff = models.JSONField(default=dict, blank=True)
    # T5.2: diff_explanation (what_changed/why/what_improved/what_got_worse/
    # confidence/can_undo) and any other non-diff explanation data live here,
    # separate from `diff` which is the literal before/after/deltas payload
    # accept_proposal applies.
    metadata = models.JSONField(default=dict, blank=True)
    status = models.CharField(max_length=20, default=STATUS_OPEN, choices=STATUS_CHOICES, db_index=True)
    # Rejections carry the reason so the agent never re-proposes rejected ideas
    rejection_reason = models.CharField(max_length=300, blank=True)
    created_by = models.CharField(max_length=20, default="agent")
    # Staleness guard: the trip state this proposal was computed against.
    # If the plan changed since, the proposal expires instead of mis-merging.
    base_trip_updated_at = models.DateTimeField(null=True, blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "planner_plan_proposal"
        ordering = ["-created_at"]

    def __str__(self):
        return f"[{self.status}] {self.title}"


class PlanBlockCommitment(BaseModel):
    """
    The money/commitment state machine for a single plan block.

    Itinerary CONTENT stays in PlannerTrip JSON; commitment state (quotes,
    holds, bookings, refund windows) lives here as queryable, auditable rows.
    The block's JSON block_status is kept in sync on every transition.

    Ladder: (planned) -> priced -> held -> booked -> ticketed
    """

    STATUS_PRICED = "priced"
    STATUS_HELD = "held"
    STATUS_BOOKED = "booked"
    STATUS_TICKETED = "ticketed"

    STATUS_CHOICES = [
        (STATUS_PRICED, "Priced"),
        (STATUS_HELD, "Held"),
        (STATUS_BOOKED, "Booked"),
        (STATUS_TICKETED, "Ticketed"),
    ]

    # Rank order for forward-only transitions (held may re-price)
    STATUS_RANK = {STATUS_PRICED: 1, STATUS_HELD: 2, STATUS_BOOKED: 3, STATUS_TICKETED: 4}

    workspace = models.ForeignKey(
        PlannerWorkspace,
        on_delete=models.CASCADE,
        related_name="commitments",
    )
    block_id = models.CharField(max_length=64, db_index=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, db_index=True)
    amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    currency = models.CharField(max_length=3, default="INR")
    quote = models.JSONField(default=dict, blank=True)
    # Every commitment shows its escape hatch
    refundable_until = models.DateTimeField(null=True, blank=True)
    provider_ref = models.CharField(max_length=120, blank=True)
    # Append-only audit trail of transitions: [{to, at, amount}]
    history = models.JSONField(default=list, blank=True)

    class Meta:
        db_table = "planner_block_commitment"
        unique_together = ("workspace", "block_id")

    def can_transition_to(self, new_status):
        current_rank = self.STATUS_RANK.get(self.status, 0)
        new_rank = self.STATUS_RANK.get(new_status)
        if new_rank is None:
            return False
        # held may fall back to priced (a re-quote); everything else is forward-only
        if self.status == self.STATUS_HELD and new_status == self.STATUS_PRICED:
            return True
        return new_rank > current_rank

    def __str__(self):
        return f"{self.block_id}: {self.status}"


class TravelerProfile(BaseModel):
    """
    Durable cross-trip memory about the traveler.

    facts is a list of {key, value, provenance, source_trip, updated_at}.
    Provenance discipline applies to memory too:
      - "stated"    — the user said it explicitly
      - "inferred"  — derived from behavior (a plan they created, a rejection)
      - "confirmed" — inferred, then confirmed by the user
    Nothing silently learned is silently applied: every applied memory must
    cite itself, and this profile is fully inspectable and deletable.
    """

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="traveler_profile",
    )
    facts = models.JSONField(default=list, blank=True)

    class Meta:
        db_table = "planner_traveler_profile"

    def upsert_fact(self, key, value, provenance="inferred", source_trip=None):
        facts = self.facts or []
        now = timezone.now().isoformat()
        for fact in facts:
            if fact.get("key") == key:
                # A user statement outranks an inference — never downgrade
                if fact.get("provenance") in ("stated", "confirmed") and provenance == "inferred":
                    return
                fact.update({
                    "value": value,
                    "provenance": provenance,
                    "source_trip": str(source_trip) if source_trip else fact.get("source_trip"),
                    "updated_at": now,
                })
                break
        else:
            facts.append({
                "key": key,
                "value": value,
                "provenance": provenance,
                "source_trip": str(source_trip) if source_trip else None,
                "updated_at": now,
            })
        self.facts = facts
        self.save(update_fields=["facts", "updated_at"])

    def __str__(self):
        return f"TravelerProfile({self.user_id}, {len(self.facts or [])} facts)"


class PriceWatch(BaseModel):
    """
    A standing task the user delegated: keep re-checking this block's price.
    Findings are filed as PlanProposals — the watch never mutates the plan.
    """

    workspace = models.ForeignKey(
        PlannerWorkspace,
        on_delete=models.CASCADE,
        related_name="price_watches",
    )
    block_id = models.CharField(max_length=64, db_index=True)
    # Optional act-envelope: only propose when price drops below this
    threshold_amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    active = models.BooleanField(default=True, db_index=True)
    last_checked_at = models.DateTimeField(null=True, blank=True)
    last_price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)

    class Meta:
        db_table = "planner_price_watch"
        unique_together = ("workspace", "block_id")

    def __str__(self):
        return f"Watch({self.block_id}, active={self.active})"
