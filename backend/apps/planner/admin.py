from django.contrib import admin

from .models import (
    PlannerWorkspace,
    WorkspaceContext,
    WorkspaceChat,
    WorkspaceActivity,
    CanvasInstance,
    CanvasData,
    BookingOrder,
    SavedPlace,
    PlannerTrip,
    TripCity,
    TripDay,
    TripActivity,
    TripRoute,
    Recommendation,
)

admin.site.register(PlannerWorkspace)
admin.site.register(WorkspaceContext)
admin.site.register(WorkspaceChat)
admin.site.register(WorkspaceActivity)
admin.site.register(CanvasInstance)
admin.site.register(CanvasData)
admin.site.register(BookingOrder)
admin.site.register(SavedPlace)
admin.site.register(PlannerTrip)
admin.site.register(TripCity)
admin.site.register(TripDay)
admin.site.register(TripActivity)
admin.site.register(TripRoute)
admin.site.register(Recommendation)
