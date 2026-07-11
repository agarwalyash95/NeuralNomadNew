from django.contrib import admin

from .models import (
    CrowdPattern, DistanceEdge, EmergencyContact, EntityEmbedding,
    EntityInteractionLog, Event, LocalTip, Neighbourhood, PlaceInsight,
    PlaceRelationship, PlanInsightDismissal, SafetyAdvisory, TransitOutcomeLog,
)

admin.site.register(Neighbourhood)
admin.site.register(Event)
admin.site.register(LocalTip)
admin.site.register(EmergencyContact)
admin.site.register(SafetyAdvisory)
admin.site.register(PlaceRelationship)
admin.site.register(EntityEmbedding)
admin.site.register(PlaceInsight)
admin.site.register(EntityInteractionLog)
admin.site.register(CrowdPattern)
admin.site.register(TransitOutcomeLog)
admin.site.register(DistanceEdge)
admin.site.register(PlanInsightDismissal)
