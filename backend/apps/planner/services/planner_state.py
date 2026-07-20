"""
Planner state — ONE authoritative resolver, derived, never duplicated
(docs/planner-complete-audit-and-fix-plan.md §4.3, checklist 2.4).

The repository already persists everything the state machine needs:
TripDraftState readiness, the latest PlanGenerationJob, the PlannerTrip row,
and PlannerWorkspace.is_modified. A new persisted column would be a fourth
authority that can drift from the other three — so state is derived here,
in exactly one place, and exposed read-only on the workspace serializer.

States:
    COLLECTING          no trip, draft not ready
    READY               no trip, draft ready, no live generation job
    GENERATING          latest job is queued/running and not stalled
    GENERATED           trip exists, unmodified since generation
    GENERATED_DEGRADED  trip exists but the producing run degraded to fallback
    REFINING            trip exists and has been modified since generation

Gating rules (the "transition service"): a generated trip never re-enters
intake; regeneration over an existing trip requires an explicit
`regenerate=True`; booked commitments block regeneration entirely (unlock or
cancel them first — the same rule select_item enforces per-block).
"""

from django.utils import timezone

from apps.planner.models import PlanBlockCommitment, PlanGenerationJob

COLLECTING = "collecting"
READY = "ready"
GENERATING = "generating"
GENERATED = "generated"
GENERATED_DEGRADED = "generated_degraded"
REFINING = "refining"


def _latest_job(workspace):
    return (
        workspace.generation_jobs.filter(is_deleted=False)
        .order_by("-created_at")
        .first()
    )


def _job_is_live(job) -> bool:
    """Queued/running AND not stalled (same window CH-03 uses)."""
    from apps.planner.services.plan_generation import STALE_AFTER_SECONDS

    if job is None or job.status not in (
        PlanGenerationJob.STATUS_QUEUED,
        PlanGenerationJob.STATUS_RUNNING,
    ):
        return False
    if (job.error or "").startswith("worker_unavailable"):
        return False
    silence = (timezone.now() - job.updated_at).total_seconds()
    return silence <= STALE_AFTER_SECONDS


def resolve_state(workspace) -> str:
    """The single source of truth for 'where is this trip in its lifecycle'."""
    job = _latest_job(workspace)
    if _job_is_live(job):
        return GENERATING

    trip = getattr(workspace, "trip", None)
    if trip is None:
        draft = getattr(workspace, "draft_state", None)
        if draft is not None and draft.is_ready_for_plan:
            return READY
        return COLLECTING

    if workspace.is_modified:
        return REFINING
    if job is not None and job.degraded and job.status == PlanGenerationJob.STATUS_DONE:
        return GENERATED_DEGRADED
    return GENERATED


class GenerationBlocked(Exception):
    """A generation request the current state forbids. `code` is the
    machine-readable reason the API returns; `detail` the human sentence."""

    def __init__(self, code: str, detail: str, extra=None):
        self.code = code
        self.detail = detail
        self.extra = extra or {}
        super().__init__(detail)


def check_can_generate(workspace, *, regenerate: bool = False) -> str:
    """Gate for starting (or re-starting) plan generation.

    Returns the resolved state when allowed. Raises GenerationBlocked with:
      not_ready            — blocking slots missing (COLLECTING)
      regenerate_required  — a plan already exists and `regenerate` wasn't set
      booked_items_present — booked/ticketed commitments exist; regeneration
                             would orphan money state (unlock/cancel first)

    GENERATING is deliberately NOT blocked here: start_generation_job is
    idempotent and returns the live job, which is the correct poll target.
    """
    state = resolve_state(workspace)

    draft = getattr(workspace, "draft_state", None)
    if draft is None or not draft.is_ready_for_plan:
        raise GenerationBlocked(
            "not_ready",
            "Source, destination, inclusive dates, and traveler breakdown are required before creating a plan.",
            extra={
                "missing_slots": draft.missing_required_slots()
                if draft else ["origin", "destination", "travel_dates", "travelers"]
            },
        )

    if state in (GENERATED, GENERATED_DEGRADED, REFINING):
        if not regenerate:
            raise GenerationBlocked(
                "regenerate_required",
                "A plan already exists for this trip. Pass regenerate=true to rebuild it.",
            )
        booked = list(
            workspace.commitments.filter(
                is_deleted=False,
                status__in=[
                    PlanBlockCommitment.STATUS_BOOKED,
                    PlanBlockCommitment.STATUS_TICKETED,
                ],
            ).values_list("block_id", flat=True)
        )
        if booked:
            raise GenerationBlocked(
                "booked_items_present",
                "Booked items exist on this plan. Unlock or cancel them before regenerating — "
                "rebuilding would orphan their booking state.",
                extra={"booked_block_ids": booked},
            )

    return state
