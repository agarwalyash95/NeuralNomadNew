"""
Travel Knowledge Engine — compatibility shim (Phase 7, master plan §12).

Every model this app used to define directly has now moved: the 5 live ones
(EntityEmbedding, DistanceEdge, PlaceInsight, LocalTip -> apps.reference;
PlanInsightDismissal -> apps.planner) via a state-only migration — the real
tables (knowledge_entityembedding, etc.) are untouched, only Django's
migration state and the Python class location changed. The 8 confirmed-dead
models (Neighbourhood, Event, EmergencyContact, SafetyAdvisory,
PlaceRelationship, CrowdPattern, EntityInteractionLog, TransitOutcomeLog —
zero real readers/writers anywhere outside this app, and zero rows in every
one of them at the time of removal) were deleted for real.

This module re-exports the 4 reference-relocated names so any code still
importing `apps.knowledge.models.X` keeps working unchanged — per §12.2
step 4 (compat shims) through step 7 (shims become read-only aliases; every
real caller has been migrated to import from the new location directly, see
docs/plans/phases/phase-07-implementation-report.md). Steps 8-10 (confirm
parity after a real beat cycle, remove the shims, remove this app) are an
explicit owner-timed follow-up, not done this phase.

`PlanInsightDismissal` (moved to `apps.planner`, not `apps.reference`) is
deliberately NOT re-exported here: `check_layer_boundaries` forbids
`apps.knowledge` importing `apps.planner` (D-004), and — unlike the other
4 relocated models — every real caller of `PlanInsightDismissal` was fully
migrated to `apps.planner.models` directly during this phase, so no shim
entry is needed. Import it from `apps.planner.models` going forward.
"""

from apps.reference.models import (  # noqa: F401
    DistanceEdge,
    EntityEmbedding,
    LocalTip,
    PlaceInsight,
)
