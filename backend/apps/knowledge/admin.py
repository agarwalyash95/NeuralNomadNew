"""Phase 7: every model this app used to register directly has moved
(EntityEmbedding/DistanceEdge/PlaceInsight/LocalTip are now registered in
apps.reference.admin; PlanInsightDismissal follows apps.planner's existing
convention of no admin registrations at all) or been deleted for real
(confirmed-dead models — see apps/knowledge/models.py's module docstring).
Nothing left to register here."""
