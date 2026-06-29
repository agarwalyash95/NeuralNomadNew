import uuid
from django.db import models
from django.conf import settings
from apps.reference.models import City

class PlannerWorkspace(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='workspaces')
    name = models.CharField(max_length=255, default="New Workspace")
    sidebar_expanded = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} ({self.user.username})"

class PlannerMemory(models.Model):
    workspace = models.OneToOneField(PlannerWorkspace, on_delete=models.CASCADE, related_name='memory')
    preferences = models.JSONField(default=dict, blank=True)
    constraints = models.JSONField(default=dict, blank=True)
    inferred_data = models.JSONField(default=dict, blank=True)

class WorkspaceContext(models.Model):
    workspace = models.OneToOneField(PlannerWorkspace, on_delete=models.CASCADE, related_name='context')
    budget_total = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    currency = models.CharField(max_length=3, default="USD")
    travelers_count = models.IntegerField(default=1)
    checklist_status = models.JSONField(default=dict, blank=True)

class WorkspaceChat(models.Model):
    workspace = models.ForeignKey(PlannerWorkspace, on_delete=models.CASCADE, related_name='chats')
    role = models.CharField(max_length=50) # 'user', 'assistant', 'system'
    content = models.TextField()
    widgets = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

class WorkspaceActivity(models.Model):
    workspace = models.ForeignKey(PlannerWorkspace, on_delete=models.CASCADE, related_name='activities')
    action = models.CharField(max_length=255)
    details = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

class PlannerTrip(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.OneToOneField(PlannerWorkspace, on_delete=models.CASCADE, related_name='trip')
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)

class TripCity(models.Model):
    trip = models.ForeignKey(PlannerTrip, on_delete=models.CASCADE, related_name='cities')
    city = models.ForeignKey(City, on_delete=models.CASCADE)
    order = models.IntegerField(default=0)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)

    class Meta:
        ordering = ['order']

class TripDay(models.Model):
    trip_city = models.ForeignKey(TripCity, on_delete=models.CASCADE, related_name='days')
    date = models.DateField()
    day_index = models.IntegerField()

    class Meta:
        ordering = ['date']

class TripActivity(models.Model):
    trip_day = models.ForeignKey(TripDay, on_delete=models.CASCADE, related_name='activities')
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    category = models.CharField(max_length=100) # Flight, Hotel, Activity, Food
    start_time = models.TimeField(null=True, blank=True)
    end_time = models.TimeField(null=True, blank=True)
    thumbnail_url = models.URLField(blank=True, null=True)
    cost = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    booking_reference = models.CharField(max_length=255, blank=True, null=True)
    order = models.IntegerField(default=0)

    class Meta:
        ordering = ['start_time', 'order']

class TripRoute(models.Model):
    trip = models.ForeignKey(PlannerTrip, on_delete=models.CASCADE, related_name='routes')
    source_city = models.ForeignKey(City, on_delete=models.CASCADE, related_name='+')
    destination_city = models.ForeignKey(City, on_delete=models.CASCADE, related_name='+')
    mode = models.CharField(max_length=50) # Flight, Train, Bus, Cab
    travel_date = models.DateField()
    details = models.JSONField(default=dict, blank=True)

class Recommendation(models.Model):
    workspace = models.ForeignKey(PlannerWorkspace, on_delete=models.CASCADE, related_name='recommendations')
    type = models.CharField(max_length=100)
    title = models.CharField(max_length=255)
    description = models.TextField()
    data = models.JSONField(default=dict)
    status = models.CharField(max_length=50, default='pending') # pending, accepted, rejected
    created_at = models.DateTimeField(auto_now_add=True)

class CanvasInstance(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(PlannerWorkspace, on_delete=models.CASCADE, related_name='canvases')
    canvas_type = models.CharField(max_length=100) # flight, hotel, etc.
    status = models.CharField(max_length=50, default='active')
    search_params = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class CanvasData(models.Model):
    canvas = models.ForeignKey(CanvasInstance, on_delete=models.CASCADE, related_name='results')
    data = models.JSONField()
    is_selected = models.BooleanField(default=False)
    provider = models.CharField(max_length=100, blank=True, null=True)

class BookingOrder(models.Model):
    workspace = models.ForeignKey(PlannerWorkspace, on_delete=models.CASCADE, related_name='bookings')
    canvas_data = models.ForeignKey(CanvasData, on_delete=models.SET_NULL, null=True)
    status = models.CharField(max_length=50, default='pending')
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    transaction_id = models.CharField(max_length=255, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

class SavedPlace(models.Model):
    workspace = models.ForeignKey(PlannerWorkspace, on_delete=models.CASCADE, related_name='saved_places')
    place_id = models.CharField(max_length=255) # e.g. Google Place ID
    name = models.CharField(max_length=255)
    category = models.CharField(max_length=100)
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
