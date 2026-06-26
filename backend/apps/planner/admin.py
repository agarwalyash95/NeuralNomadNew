"""
Admin registrations for planner models.
"""

from django.contrib import admin
from .models import (
    PlannerWorkspace, PlannerMemory, WorkspaceContext, WorkspaceChat,
    WorkspaceActivity, PlannerTrip, TripCity, TripDay, TripActivity,
    TripRoute, Recommendation, CanvasInstance, CanvasData,
    BookingOrder, SavedPlace,
)


class TripCityInline(admin.TabularInline):
    model = TripCity
    extra = 0


class TripDayInline(admin.TabularInline):
    model = TripDay
    extra = 0


class TripActivityInline(admin.TabularInline):
    model = TripActivity
    extra = 0


@admin.register(PlannerWorkspace)
class PlannerWorkspaceAdmin(admin.ModelAdmin):
    list_display = ['title', 'user', 'status', 'mode', 'last_activity_at']
    list_filter = ['status', 'mode']
    search_fields = ['title', 'user__email']


@admin.register(PlannerMemory)
class PlannerMemoryAdmin(admin.ModelAdmin):
    list_display = ['workspace', 'current_phase']


@admin.register(WorkspaceContext)
class WorkspaceContextAdmin(admin.ModelAdmin):
    list_display = ['workspace', 'start_date', 'end_date', 'adults', 'budget']


@admin.register(WorkspaceChat)
class WorkspaceChatAdmin(admin.ModelAdmin):
    list_display = ['workspace', 'role', 'message_preview', 'created_at']
    list_filter = ['role']

    def message_preview(self, obj):
        return obj.message[:80] + '...' if len(obj.message) > 80 else obj.message


@admin.register(PlannerTrip)
class PlannerTripAdmin(admin.ModelAdmin):
    list_display = ['title', 'workspace', 'total_budget', 'spent_budget', 'currency_code']
    inlines = [TripCityInline, TripDayInline]


@admin.register(TripActivity)
class TripActivityAdmin(admin.ModelAdmin):
    list_display = ['title', 'category', 'day', 'status', 'estimated_cost', 'order']
    list_filter = ['category', 'status']


@admin.register(Recommendation)
class RecommendationAdmin(admin.ModelAdmin):
    list_display = ['title', 'type', 'workspace', 'priority', 'confidence', 'impact', 'is_accepted', 'is_dismissed']
    list_filter = ['type', 'impact', 'is_accepted', 'is_dismissed']


@admin.register(CanvasInstance)
class CanvasInstanceAdmin(admin.ModelAdmin):
    list_display = ['canvas_type', 'workspace', 'lifecycle_state', 'is_active']
    list_filter = ['canvas_type', 'lifecycle_state']


@admin.register(BookingOrder)
class BookingOrderAdmin(admin.ModelAdmin):
    list_display = ['title', 'workspace', 'item_type', 'price', 'status']
    list_filter = ['status', 'item_type']


@admin.register(SavedPlace)
class SavedPlaceAdmin(admin.ModelAdmin):
    list_display = ['name', 'workspace', 'category', 'rating']
