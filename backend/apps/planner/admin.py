from django.contrib import admin
from .models import (
    PlannerWorkspace, PlannerMemory, WorkspaceContext, WorkspaceChat,
    WorkspaceActivity, PlannerTrip, TripCity, TripDay, TripActivity,
    TripRoute, Recommendation, CanvasInstance, CanvasData, BookingOrder, SavedPlace
)

admin.site.register(PlannerWorkspace)
admin.site.register(PlannerMemory)
admin.site.register(WorkspaceContext)
admin.site.register(WorkspaceChat)
admin.site.register(WorkspaceActivity)
admin.site.register(PlannerTrip)
admin.site.register(TripCity)
admin.site.register(TripDay)
admin.site.register(TripActivity)
admin.site.register(TripRoute)
admin.site.register(Recommendation)
admin.site.register(CanvasInstance)
admin.site.register(CanvasData)
admin.site.register(BookingOrder)
admin.site.register(SavedPlace)
