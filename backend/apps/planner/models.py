"""
Planner layer models — the AI workspace engine.

All models extend BaseModel (UUID PK, soft delete, timestamps).
"""

from django.db import models
from django.conf import settings
from apps.common.models import BaseModel


# ─── Workspace Status & Mode Choices ───────────────────

class WorkspaceStatus(models.TextChoices):
    DRAFT = 'draft', 'Draft'
    ACTIVE = 'active', 'Active'
    COMPLETED = 'completed', 'Completed'
    ARCHIVED = 'archived', 'Archived'
    BOOKED = 'booked', 'Booked'


class WorkspaceMode(models.TextChoices):
    PLANNING = 'planning', 'Planning'
    EXPLORING = 'exploring', 'Exploring'
    BOOKING = 'booking', 'Booking'
    REVIEW = 'review', 'Review'
    TRAVELING = 'traveling', 'Traveling'
    COMPLETED = 'completed', 'Completed'


class ChatRole(models.TextChoices):
    USER = 'user', 'User'
    ASSISTANT = 'assistant', 'Assistant'
    SYSTEM = 'system', 'System'


class CanvasType(models.TextChoices):
    PLAN = 'plan', 'Plan'
    FLIGHT = 'flight', 'Flight'
    HOTEL = 'hotel', 'Hotel'
    TRAIN = 'train', 'Train'
    BUS = 'bus', 'Bus'
    CAB = 'cab', 'Cab'
    ATTRACTION = 'attraction', 'Attraction'
    ACTIVITY = 'activity', 'Activity'
    RESTAURANT = 'restaurant', 'Restaurant'
    VISA = 'visa', 'Visa'
    FOREX = 'forex', 'Forex'
    BOOKING = 'booking', 'Booking'


class CanvasLifecycleState(models.TextChoices):
    PREVIEW = 'preview', 'Preview'
    EXPANDED = 'expanded', 'Expanded'
    FOCUSED = 'focused', 'Focused'


class DayType(models.TextChoices):
    PREPARATION = 'preparation', 'Preparation'
    TRAVEL = 'travel', 'Travel Day'
    EXPLORATION = 'exploration', 'Exploration'
    RETURN = 'return', 'Return'
    REST = 'rest', 'Rest Day'


class ActivityStatus(models.TextChoices):
    PLANNED = 'planned', 'Planned'
    BOOKED = 'booked', 'Booked'
    COMPLETED = 'completed', 'Completed'
    CANCELLED = 'cancelled', 'Cancelled'


# ─── Core Workspace ───────────────────────────────────

class PlannerWorkspace(BaseModel):
    """Top-level workspace container — one per trip plan."""
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name='planner_workspaces',
    )
    title = models.CharField(max_length=255, default='New Trip')
    status = models.CharField(
        max_length=20, choices=WorkspaceStatus.choices,
        default=WorkspaceStatus.DRAFT,
    )
    mode = models.CharField(
        max_length=20, choices=WorkspaceMode.choices,
        default=WorkspaceMode.PLANNING,
    )
    last_activity_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-last_activity_at']

    def __str__(self):
        return f"{self.title} ({self.user})"


# ─── AI Memory ─────────────────────────────────────────

class PlannerMemory(BaseModel):
    """
    Structured trip context — the AI reads this, not old chat messages.
    Updated after every chat interaction by the MemoryManager.
    """
    workspace = models.OneToOneField(
        PlannerWorkspace, on_delete=models.CASCADE, related_name='memory',
    )

    # Trip context
    destination = models.JSONField(default=dict, blank=True)
    origin = models.JSONField(default=dict, blank=True)
    dates = models.JSONField(default=dict, blank=True)
    travelers = models.JSONField(default=dict, blank=True)
    budget = models.JSONField(default=dict, blank=True)

    # Preferences
    transportation_preference = models.JSONField(default=list, blank=True)
    hotel_preference = models.JSONField(default=dict, blank=True)
    interests = models.JSONField(default=list, blank=True)
    food_preference = models.JSONField(default=dict, blank=True)
    accessibility = models.JSONField(default=dict, blank=True)

    # Status
    visa_status = models.JSONField(default=dict, blank=True)
    booking_summary = models.JSONField(default=dict, blank=True)
    current_phase = models.CharField(max_length=50, blank=True, default='initial')

    # AI context
    conversation_summary = models.TextField(blank=True)
    last_ai_action = models.JSONField(default=dict, blank=True)

    class Meta:
        verbose_name = 'planner memory'
        verbose_name_plural = 'planner memories'

    def __str__(self):
        return f"Memory: {self.workspace.title}"


# ─── Workspace Context ─────────────────────────────────

class WorkspaceContext(BaseModel):
    """
    User-facing trip parameters.
    Separate from PlannerMemory (which is AI-internal).
    """
    workspace = models.OneToOneField(
        PlannerWorkspace, on_delete=models.CASCADE, related_name='context',
    )
    origin_location = models.JSONField(default=dict, blank=True)
    destination_location = models.JSONField(default=dict, blank=True)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    adults = models.PositiveSmallIntegerField(default=1)
    children = models.PositiveSmallIntegerField(default=0)
    infants = models.PositiveSmallIntegerField(default=0)
    budget = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    budget_currency = models.CharField(max_length=3, default='INR')
    travel_style = models.CharField(
        max_length=20,
        choices=[
            ('budget', 'Budget'),
            ('mid_range', 'Mid-range'),
            ('luxury', 'Luxury'),
            ('backpacker', 'Backpacker'),
        ],
        blank=True,
    )
    interests = models.JSONField(default=list, blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    def __str__(self):
        return f"Context: {self.workspace.title}"


# ─── Chat ──────────────────────────────────────────────

class WorkspaceChat(BaseModel):
    """Chat messages with widget metadata and structured commands."""
    workspace = models.ForeignKey(
        PlannerWorkspace, on_delete=models.CASCADE, related_name='chats',
    )
    role = models.CharField(max_length=10, choices=ChatRole.choices)
    message = models.TextField()
    widgets = models.JSONField(default=list, blank=True, help_text="Widget components to render")
    commands = models.JSONField(default=list, blank=True, help_text="Structured commands from AI")

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"[{self.role}] {self.message[:50]}"


# ─── Activity Log ──────────────────────────────────────

class WorkspaceActivity(BaseModel):
    """Workspace event audit trail."""
    workspace = models.ForeignKey(
        PlannerWorkspace, on_delete=models.CASCADE, related_name='activities',
    )
    event_type = models.CharField(max_length=100)
    event_data = models.JSONField(default=dict, blank=True)
    description = models.TextField(blank=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'workspace activity'
        verbose_name_plural = 'workspace activities'

    def __str__(self):
        return f"{self.event_type} — {self.workspace.title}"


# ─── Trip / Journey Plan ──────────────────────────────

class PlannerTrip(BaseModel):
    """The journey plan — one per workspace."""
    workspace = models.OneToOneField(
        PlannerWorkspace, on_delete=models.CASCADE, related_name='trip',
    )
    title = models.CharField(max_length=255, blank=True)
    summary = models.TextField(blank=True)
    total_budget = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    spent_budget = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    currency_code = models.CharField(max_length=3, default='INR')
    metadata = models.JSONField(default=dict, blank=True)

    def __str__(self):
        return f"Trip: {self.title or self.workspace.title}"


class TripCity(BaseModel):
    """Multi-city routing — cities in the trip."""
    trip = models.ForeignKey(PlannerTrip, on_delete=models.CASCADE, related_name='cities')
    city = models.ForeignKey(
        'reference.City', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='trip_visits',
    )
    name = models.CharField(max_length=150)
    country = models.CharField(max_length=100, blank=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    order = models.PositiveIntegerField(default=0)
    nights = models.PositiveIntegerField(default=1)
    arrival_date = models.DateField(null=True, blank=True)
    departure_date = models.DateField(null=True, blank=True)

    class Meta:
        ordering = ['order']
        verbose_name = 'trip city'
        verbose_name_plural = 'trip cities'

    def __str__(self):
        return f"{self.name} (#{self.order})"


class TripDay(BaseModel):
    """Day containers within a trip."""
    trip = models.ForeignKey(PlannerTrip, on_delete=models.CASCADE, related_name='days')
    city = models.ForeignKey(TripCity, on_delete=models.SET_NULL, null=True, blank=True, related_name='days')
    day_number = models.PositiveIntegerField()
    date = models.DateField(null=True, blank=True)
    title = models.CharField(max_length=255, blank=True)
    day_type = models.CharField(
        max_length=20, choices=DayType.choices,
        default=DayType.EXPLORATION,
    )

    class Meta:
        ordering = ['day_number']

    def __str__(self):
        return f"Day {self.day_number}: {self.title or self.get_day_type_display()}"


class TripActivity(BaseModel):
    """
    Timeline events — the core event stream.
    Every movement, booking, activity, meal is a TripActivity.
    """
    day = models.ForeignKey(TripDay, on_delete=models.CASCADE, related_name='activities')
    title = models.CharField(max_length=255)
    category = models.CharField(
        max_length=30,
        choices=[
            ('flight', 'Flight'), ('hotel', 'Hotel'),
            ('train', 'Train'), ('bus', 'Bus'), ('cab', 'Cab'),
            ('attraction', 'Attraction'), ('activity', 'Activity'),
            ('restaurant', 'Restaurant'), ('meal', 'Meal'),
            ('transfer', 'Transfer'), ('checkin', 'Check-in'),
            ('checkout', 'Check-out'), ('note', 'Note'),
            ('preparation', 'Preparation'), ('other', 'Other'),
        ],
        default='other',
    )
    location_name = models.CharField(max_length=255, blank=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    start_time = models.TimeField(null=True, blank=True)
    end_time = models.TimeField(null=True, blank=True)
    duration_minutes = models.PositiveIntegerField(null=True, blank=True)
    distance_km = models.DecimalField(max_digits=8, decimal_places=1, null=True, blank=True)
    travel_time_minutes = models.PositiveIntegerField(null=True, blank=True)
    transport_mode = models.CharField(max_length=20, blank=True)
    estimated_cost = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    currency_code = models.CharField(max_length=3, default='INR')
    booking_order = models.ForeignKey(
        'BookingOrder', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='timeline_activities',
    )
    status = models.CharField(
        max_length=20, choices=ActivityStatus.choices,
        default=ActivityStatus.PLANNED,
    )
    order = models.PositiveIntegerField(default=0)
    notes = models.TextField(blank=True)
    weather_info = models.JSONField(default=dict, blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ['order']
        verbose_name = 'trip activity'
        verbose_name_plural = 'trip activities'

    def __str__(self):
        return f"{self.title} ({self.category})"


class TripRoute(BaseModel):
    """Route segments between activities — from Google Maps."""
    trip = models.ForeignKey(PlannerTrip, on_delete=models.CASCADE, related_name='routes')
    from_activity = models.ForeignKey(
        TripActivity, on_delete=models.CASCADE, related_name='route_from',
    )
    to_activity = models.ForeignKey(
        TripActivity, on_delete=models.CASCADE, related_name='route_to',
    )
    distance_km = models.DecimalField(max_digits=8, decimal_places=1, null=True, blank=True)
    duration_minutes = models.PositiveIntegerField(null=True, blank=True)
    transport_mode = models.CharField(max_length=20, blank=True)
    polyline = models.TextField(blank=True, help_text="Encoded polyline for map rendering")
    route_data = models.JSONField(default=dict, blank=True)

    def __str__(self):
        return f"Route: {self.from_activity.title} → {self.to_activity.title}"


# ─── Recommendations ──────────────────────────────────

class Recommendation(BaseModel):
    """AI-generated recommendations — rich structured objects."""
    workspace = models.ForeignKey(
        PlannerWorkspace, on_delete=models.CASCADE, related_name='recommendations',
    )

    # Identity
    type = models.CharField(max_length=50)
    canvas_type = models.CharField(max_length=50, choices=CanvasType.choices, blank=True)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)

    # Intelligence
    confidence = models.FloatField(default=0.8)
    priority = models.IntegerField(default=5)
    reason = models.TextField(blank=True)
    estimated_cost = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    estimated_time = models.PositiveIntegerField(null=True, blank=True, help_text="Minutes")
    impact = models.CharField(
        max_length=10,
        choices=[('high', 'High'), ('medium', 'Medium'), ('low', 'Low')],
        default='medium',
    )
    dependencies = models.JSONField(default=list, blank=True)

    # Actions
    actions = models.JSONField(default=list, blank=True, help_text='[{label, command_type, payload}]')
    data = models.JSONField(default=dict, blank=True)

    # Status
    is_dismissed = models.BooleanField(default=False)
    is_accepted = models.BooleanField(default=False)

    class Meta:
        ordering = ['priority', '-confidence']

    def __str__(self):
        return f"[{self.type}] {self.title}"


# ─── Canvas Management ────────────────────────────────

class CanvasInstance(BaseModel):
    """Tracks which canvases are open in a workspace."""
    workspace = models.ForeignKey(
        PlannerWorkspace, on_delete=models.CASCADE, related_name='canvas_instances',
    )
    canvas_type = models.CharField(max_length=20, choices=CanvasType.choices)
    lifecycle_state = models.CharField(
        max_length=15, choices=CanvasLifecycleState.choices,
        default=CanvasLifecycleState.PREVIEW,
    )
    is_active = models.BooleanField(default=True)
    display_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['display_order']
        unique_together = [('workspace', 'canvas_type')]

    def __str__(self):
        return f"{self.get_canvas_type_display()} [{self.lifecycle_state}]"


class CanvasData(BaseModel):
    """Persistent state for a canvas instance (search results, filters, etc)."""
    canvas_instance = models.OneToOneField(
        CanvasInstance, on_delete=models.CASCADE, related_name='data',
    )
    data = models.JSONField(default=dict, blank=True)

    class Meta:
        verbose_name = 'canvas data'
        verbose_name_plural = 'canvas data'

    def __str__(self):
        return f"Data: {self.canvas_instance}"


# ─── Booking / Cart ───────────────────────────────────

class BookingOrder(BaseModel):
    """Cart items — selected booking options before checkout."""
    workspace = models.ForeignKey(
        PlannerWorkspace, on_delete=models.CASCADE, related_name='booking_orders',
    )
    item_type = models.CharField(max_length=30)
    source_canvas = models.CharField(max_length=20, choices=CanvasType.choices, blank=True)
    title = models.CharField(max_length=255)
    provider = models.CharField(max_length=150, blank=True)
    price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    currency_code = models.CharField(max_length=3, default='INR')
    status = models.CharField(
        max_length=20,
        choices=[
            ('in_cart', 'In Cart'),
            ('processing', 'Processing'),
            ('confirmed', 'Confirmed'),
            ('cancelled', 'Cancelled'),
        ],
        default='in_cart',
    )
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.title} ({self.status})"


# ─── Saved Places ─────────────────────────────────────

class SavedPlace(BaseModel):
    """Bookmarked locations within a workspace."""
    workspace = models.ForeignKey(
        PlannerWorkspace, on_delete=models.CASCADE, related_name='saved_places',
    )
    place_cache = models.ForeignKey(
        'reference.GooglePlaceCache', on_delete=models.SET_NULL,
        null=True, blank=True,
    )
    name = models.CharField(max_length=255)
    category = models.CharField(max_length=50, blank=True)
    address = models.TextField(blank=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    rating = models.DecimalField(max_digits=3, decimal_places=1, null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"📌 {self.name}"
