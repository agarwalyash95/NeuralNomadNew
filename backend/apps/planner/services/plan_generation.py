"""
DB-first plan generation with real, pollable progress.

The old path (ConversationService.create_plan) asks the LLM to invent an
itinerary and then tries to reconcile the inventions against reference data.
This pipeline inverts that: real places come FIRST (reference master tables,
grown through the same Google-Places cache-on-miss path the explore canvases
use), and the LLM's only creative job is sequencing — picking candidate ids
and times. A hallucinated id is rejected and filled by heuristic; a
hallucinated venue can't exist here at all.

Progress is a PlanGenerationJob row updated in autocommit writes as each
phase runs, so the loading screen polls actual pipeline state. Runs on a
daemon thread spawned via transaction.on_commit — every phase manages its
own transactions (ATOMIC_REQUESTS wraps views, not this thread).

Phases:
  understanding      LLM 1 (apps.common.ai.DEFAULT_GEMINI_MODEL): skeleton only — cities, nights, day themes
  selecting_cities   validate/geocode against reference.City
  finding_places     per-city candidate pools from master tables (+ live growth)
  composing          LLM 2 (apps.common.ai.COMPOSE_GEMINI_MODEL): pick + sequence candidate ids; server joins rows
  routing            DistanceService transit_hints per day
  pricing            transport priced from TravelPriceHistory / providers
  finalizing         totals, weather normals, persist trip + snapshot

Both model ids resolve to the same flash model today (config/settings/base.py
GEMINI_MODEL / GEMINI_MODEL_COMPOSE) — this docstring previously claimed the
composer used a stronger "pro" model while the code always called flash
(Phase 0h fixed the mismatch by naming reality, not by silently upgrading the
model). Point GEMINI_MODEL_COMPOSE at a stronger model when that quality
upgrade is actually made.
"""

import logging
import hashlib
import json
import threading
import uuid
from copy import deepcopy
from datetime import date as date_cls, timedelta

from django.db import close_old_connections, transaction
from django.utils import timezone

from apps.planner.models import (
    PlanGenerationJob,
    PlannerTrip,
    PlannerTripOriginal,
    PlannerWorkspace,
)

logger = logging.getLogger(__name__)

PHASES = [
    ("understanding", "Understanding your trip", 10),
    ("selecting_cities", "Mapping your route", 20),
    ("finding_places", "Finding real places", 55),
    ("composing", "Composing your days", 75),
    ("routing", "Calculating travel times", 85),
    ("pricing", "Pricing from real data", 95),
    ("finalizing", "Finalizing your plan", 100),
]
_PHASE_PROGRESS = {key: pct for key, _label, pct in PHASES}


class GenerationFailed(Exception):
    pass


class GenerationNeedsInput(Exception):
    def __init__(self, blockers):
        self.blockers = list(blockers or [])
        super().__init__(self.blockers[0].get("detail", "More input is required") if self.blockers else "More input is required")


# A queued/running job with no progress writes for this long is dead — the
# thread/worker crashed or hung. Shared by serialize_job (reporting) and
# start_generation_job (takeover), so the two can never disagree (CH-03).
STALE_AFTER_SECONDS = 90


class JobReporter:
    """Writes phase/progress/detail to the job row in autocommit saves —
    the poller must see every update immediately, never at thread end."""

    def __init__(self, job):
        self.job = job
        self.job.phase_log = [
            {"key": key, "label": label, "state": "pending", "detail": "", "at": None, "duration_ms": None}
            for key, label, _pct in PHASES
        ]
        self._phase_started_at = {}

    @property
    def trace_id(self) -> str:
        """job.id doubles as the per-run correlation id — no separate field
        needed, and it's already threaded through every log line that
        references the job (Phase 0h: the generation path previously had no
        trace id at all, making it impossible to correlate a log line back
        to a specific run)."""
        return str(self.job.id)

    def _entry(self, key):
        for entry in self.job.phase_log:
            if entry["key"] == key:
                return entry
        raise KeyError(key)

    def _elapsed_ms(self, key):
        started = self._phase_started_at.get(key)
        if not started:
            return None
        return round((timezone.now() - started).total_seconds() * 1000)

    def start(self, key, detail=""):
        entry = self._entry(key)
        entry["state"] = "active"
        entry["detail"] = detail
        entry["at"] = timezone.now().isoformat()
        self._phase_started_at[key] = timezone.now()
        self.job.phase = key
        self.job.save(update_fields=["phase", "phase_log", "updated_at"])

    def detail(self, key, detail):
        self._entry(key)["detail"] = detail
        self.job.save(update_fields=["phase_log", "updated_at"])

    def done(self, key, detail=None):
        entry = self._entry(key)
        entry["state"] = "done"
        if detail is not None:
            entry["detail"] = detail
        entry["duration_ms"] = self._elapsed_ms(key)
        self.job.progress = _PHASE_PROGRESS[key]
        self.job.save(update_fields=["progress", "phase_log", "updated_at"])

    def fail(self, key, message):
        entry = self._entry(key)
        entry["state"] = "failed"
        entry["detail"] = message
        entry["duration_ms"] = self._elapsed_ms(key)
        self.job.save(update_fields=["phase_log", "updated_at"])

    def usage(self, key, *, model, response=None, duration_ms=None):
        """
        Record per-LLM-call observability (Phase 0h): response.usage_metadata
        was previously discarded entirely at both generation LLM calls, so
        token counts, cost, and per-call latency were undiagnosable. Best-
        effort — the SDK's usage_metadata shape isn't part of any contract
        here, so a missing/renamed attribute degrades to "model + duration
        only" rather than raising.
        """
        payload = {"model": model, "duration_ms": duration_ms}
        meta = getattr(response, "usage_metadata", None) if response is not None else None
        if meta is not None:
            for attr in ("prompt_token_count", "candidates_token_count", "total_token_count"):
                value = getattr(meta, attr, None)
                # isinstance guard (not just "is not None"): a mocked SDK
                # response (tests) auto-generates non-numeric attributes on
                # unset mocks, which would otherwise fail JSONField encoding.
                if isinstance(value, (int, float)):
                    payload[attr] = value
        usage = dict(self.job.usage or {})
        usage[key] = {**(usage.get(key) or {}), **payload}
        self.job.usage = usage
        self.job.save(update_fields=["usage", "updated_at"])

    def metrics(self, key, **counts):
        """
        Merge plain counters into the phase's usage entry (checklist 0.2,
        audit OBS-02): composer substitutions/drops, warm-cache hits, etc.
        Same JSON home as token usage so one query answers "how clean was
        this run" — never overwrites the LLM-call payload usage() recorded.
        """
        usage = dict(self.job.usage or {})
        usage[key] = {**(usage.get(key) or {}), **counts}
        self.job.usage = usage
        self.job.save(update_fields=["usage", "updated_at"])


# ── Job orchestration ────────────────────────────────────────────────────


def start_generation_job(workspace):
    """
    Create (or return the already-running) generation job for a workspace.

    Phase 0a: the check-then-create used to be two unguarded queries — two
    concurrent "Create Plan" POSTs could both see "no running job" and each
    spawn their own job/thread (duplicate work, last-writer-wins on the
    trip). select_for_update() on the workspace row serializes the
    check-then-create across concurrent callers: the second caller blocks
    until the first's transaction commits, then re-reads and finds the job
    the first one just created.
    """
    with transaction.atomic():
        locked_workspace = PlannerWorkspace.objects.select_for_update().get(pk=workspace.pk)
        existing = locked_workspace.generation_jobs.filter(
            status__in=[PlanGenerationJob.STATUS_QUEUED, PlanGenerationJob.STATUS_RUNNING],
            is_deleted=False,
        ).first()
        if existing:
            silence = (timezone.now() - existing.updated_at).total_seconds()
            worker_unavailable = (existing.error or "").startswith("worker_unavailable")
            if silence <= STALE_AFTER_SECONDS and not worker_unavailable:
                # REL-02 (docs/planner-complete-current-audit-and-repair-
                # plan.md §19 R12): a live job snapshots its draft once at
                # start (run_generation_job's own immutability contract) and
                # cannot be made to pick up a later edit mid-run. Forcibly
                # killing and restarting it here would risk two jobs racing
                # to write the same PlannerTrip — planner_state.py already
                # documents idempotent reuse of a live job as a deliberate
                # design choice, not an oversight, so that isn't changed.
                # What was missing is visibility: recompute the CURRENT
                # draft's hash and record when reuse serves a stale one, so
                # a "my edit didn't apply" report is diagnosable instead of
                # silent. The next click after this job finishes naturally
                # starts a fresh job against current inputs regardless.
                from apps.planner.services.plan_context import PlanContextBuilder

                current_fingerprint = PlanContextBuilder.fingerprint_payload(locked_workspace.draft_state)
                current_hash = hashlib.sha256(
                    json.dumps(current_fingerprint, sort_keys=True, default=str).encode()
                ).hexdigest()
                if current_hash != existing.input_hash:
                    logger.info(
                        "Reused live generation job %s for workspace %s against a stale input_hash "
                        "(job=%s, current=%s) — draft changed after this job started.",
                        existing.id, locked_workspace.id, existing.input_hash, current_hash,
                    )
                    trace = list(existing.decision_trace or [])
                    trace.append({"event": "reused_with_stale_input", "job_input_hash": existing.input_hash, "current_input_hash": current_hash})
                    existing.decision_trace = trace
                    existing.save(update_fields=["decision_trace", "updated_at"])
                return existing, False
            # CH-03 (checklist 2.1): serialize_job used to REPORT this zombie
            # as failed without persisting it, so every retry found the same
            # "running" row, returned it un-dispatched, and looped forever.
            # Persist the death honestly and supersede it with a fresh job.
            existing.status = PlanGenerationJob.STATUS_FAILED
            existing.error = "Generation stalled (no progress writes) — superseded by a new run."
            existing.finished_at = timezone.now()
            existing.save(update_fields=["status", "error", "finished_at", "updated_at"])
            logger.warning(
                "Superseded stalled generation job %s for workspace %s (silent %.0fs)",
                existing.id, locked_workspace.id, silence,
            )
        draft = locked_workspace.draft_state
        from apps.planner.services.plan_context import PlanContextBuilder

        fingerprint = PlanContextBuilder.fingerprint_payload(draft)
        input_hash = hashlib.sha256(json.dumps(fingerprint, sort_keys=True, default=str).encode()).hexdigest()
        job = PlanGenerationJob.objects.create(
            workspace=locked_workspace,
            input_revision=locked_workspace.revision,
            input_hash=input_hash,
        )
        return job, True


def spawn_generation_thread(job_id):
    thread = threading.Thread(
        target=run_generation_job, args=(job_id,), kwargs={"manage_connections": True}, daemon=True
    )
    thread.start()
    return thread


def run_generation_job(job_id, manage_connections=False):
    """Thread entry point. With manage_connections=True (the thread path) it
    opens/closes its own DB connections; synchronous callers (tests) share
    the caller's connection and must not have it closed underneath them."""
    if manage_connections:
        close_old_connections()
    try:
        job = PlanGenerationJob.objects.select_related("workspace").get(id=job_id)
    except PlanGenerationJob.DoesNotExist:
        return

    job.status = PlanGenerationJob.STATUS_RUNNING
    job.started_at = timezone.now()
    job.save(update_fields=["status", "started_at", "updated_at"])

    reporter = JobReporter(job)
    workspace = job.workspace
    # Phase 0d: a deliberate, one-time snapshot — `draft` is fetched exactly
    # once here and this same in-memory object is threaded through the
    # entire pipeline (which can run for many seconds across several LLM
    # calls). The chat request handler can keep writing new values to the
    # SAME database row while a generation is in flight; this snapshot
    # ensures a run always composes against the trip brief as it stood the
    # moment generation started, never a half-updated mix from a message
    # that arrived mid-run. Nothing below this point may re-fetch or
    # refresh `draft` from the database.
    draft = workspace.draft_state

    from apps.planner.services.foundation import DecisionTrace, UsageBudget
    usage_budget = UsageBudget()
    decision_trace = DecisionTrace()
    decision_trace.add("generation_started", revision=job.input_revision, input_hash=job.input_hash)

    try:
        itinerary = run_pipeline(draft, reporter, usage_budget=usage_budget, decision_trace=decision_trace)
        _persist_trip(workspace, draft, itinerary)
        job.status = PlanGenerationJob.STATUS_DONE
        job.progress = 100
        internal = itinerary.get("_internal_scorecard") or {}
        job.internal_score = internal.get("overall")
        job.quality_state = internal.get("quality_state") or "review_recommended"
        job.refinement_count = int(itinerary.get("_refinement_count") or 0)
        job.blockers = list(itinerary.get("gaps") or [])
        if usage_budget.exhausted:
            decision_trace.add("budget_exhausted", limits=list(usage_budget.exhausted))
        job.decision_trace = decision_trace.to_list()
        job.usage = {**(job.usage or {}), "ceilings": usage_budget.to_dict()}
        job.finished_at = timezone.now()
        job.save(update_fields=[
            "status", "progress", "internal_score", "quality_state", "refinement_count",
            "blockers", "decision_trace", "usage", "finished_at", "updated_at",
        ])
    except GenerationNeedsInput as exc:
        if usage_budget.exhausted:
            decision_trace.add("budget_exhausted", limits=list(usage_budget.exhausted))
        job.status = PlanGenerationJob.STATUS_NEEDS_INPUT
        job.quality_state = "blocked"
        job.blockers = exc.blockers
        job.error = str(exc)
        job.decision_trace = decision_trace.to_list()
        job.usage = {**(job.usage or {}), "ceilings": usage_budget.to_dict()}
        job.finished_at = timezone.now()
        job.save(update_fields=[
            "status", "quality_state", "blockers", "error", "decision_trace", "usage",
            "finished_at", "updated_at",
        ])
    except Exception as exc:
        logger.exception(
            "Plan generation pipeline failed for workspace %s [trace_id=%s]", workspace.id, reporter.trace_id
        )
        reporter.fail(job.phase or "understanding", str(exc)[:300])
        # Terminal fallback: the curated skeleton plan is still a usable trip
        # — but it is a DEGRADED result, not the AI-composed plan the user
        # asked for. Phase 0b: this used to write status=DONE with no
        # distinction from a real success, so a full AI outage was
        # indistinguishable from a finished plan on the loading screen.
        try:
            from apps.planner.services.fallback_plan import build_fallback_plan

            itinerary = build_fallback_plan(draft)
            _persist_trip(workspace, draft, itinerary)
            job.status = PlanGenerationJob.STATUS_DONE
            job.progress = 100
            job.degraded = True
            job.error = f"AI pipeline unavailable — built a curated fallback plan. ({str(exc)[:200]})"
            job.finished_at = timezone.now()
            job.quality_state = "review_recommended"
            if usage_budget.exhausted:
                decision_trace.add("budget_exhausted", limits=list(usage_budget.exhausted))
            job.decision_trace = decision_trace.to_list()
            job.usage = {**(job.usage or {}), "ceilings": usage_budget.to_dict()}
            job.save(update_fields=["status", "progress", "degraded", "error", "quality_state", "decision_trace", "usage", "finished_at", "updated_at"])
        except Exception as fallback_exc:
            logger.exception(
                "Skeleton fallback also failed for workspace %s [trace_id=%s]", workspace.id, reporter.trace_id
            )
            job.status = PlanGenerationJob.STATUS_FAILED
            job.error = str(fallback_exc)[:500]
            job.finished_at = timezone.now()
            job.save(update_fields=["status", "error", "finished_at", "updated_at"])
    finally:
        if manage_connections:
            close_old_connections()


def serialize_job(job, stale_after_seconds=STALE_AFTER_SECONDS):
    """Poll payload. A running job with no writes for stale_after_seconds is
    reported failed — a dead thread must surface, not spin forever. (Retry
    then actually works: start_generation_job persists the failure and
    creates a fresh job — CH-03.)"""
    status = job.status
    error = job.error or None
    if status in (PlanGenerationJob.STATUS_QUEUED, PlanGenerationJob.STATUS_RUNNING):
        silence = (timezone.now() - job.updated_at).total_seconds()
        if silence > stale_after_seconds:
            status = PlanGenerationJob.STATUS_FAILED
            error = "Generation stopped responding. Please retry."
        elif status == PlanGenerationJob.STATUS_QUEUED and (job.error or "").startswith("worker_unavailable"):
            # Checklist 2.6: production with no durable worker — honest,
            # retryable state instead of a silently-hung queue.
            status = PlanGenerationJob.STATUS_FAILED
            error = "No background worker is available to run generation right now. Please retry shortly."
    return {
        "job_id": str(job.id),
        "revision": job.workspace.revision,
        "status": status,
        "phase": job.phase,
        "progress": job.progress,
        "phases": job.phase_log,
        "error": error,
        # Phase 0b: DONE no longer means "the AI-composed plan you asked
        # for" unconditionally — a DONE job can be the curated fallback
        # plan (degraded=True) when the pipeline itself failed. The loading
        # screen can now distinguish the two instead of both reading as an
        # identical success.
        "degraded": job.degraded,
        "input_revision": job.input_revision,
        "input_hash": job.input_hash,
        "quality_state": job.quality_state or None,
        "refinement_status": "applied" if job.refinement_count else "not_applied",
        "blockers": job.blockers or [],
        "usage": job.usage or {},
    }


# ── The pipeline ─────────────────────────────────────────────────────────


def run_pipeline(draft, reporter, *, usage_budget=None, decision_trace=None):
    """Returns the itinerary dict {title, summary, total_budget, currency_code,
    cities, days} — same contract create_plan persists."""

    # PlanContext assembly (docs/planner-output-generation-architecture.md
    # Phase 1) is the anti-leak boundary — every normalized preference
    # (dietary/pace/stay/cabin/accessibility/ai_preferences) that will ever
    # reach a prompt this run must be captured here. Promote structured
    # draft prefs (accessibility, pace, hotel tier) to durable
    # TravelerProfile facts using the CANONICAL keys ConstraintEngine reads,
    # BEFORE ConstraintEngine is built below, so a wheelchair need typed in
    # THIS chat filters candidates in THIS same trip.
    from apps.planner.services.intelligence.preferences import promote_draft_preferences_to_profile
    from apps.planner.services.plan_context import PlanContextBuilder
    from apps.planner.services.foundation import DecisionTrace, UsageBudget

    usage_budget = usage_budget or UsageBudget()
    decision_trace = decision_trace or DecisionTrace()

    user = getattr(draft.workspace, "user", None)
    promote_draft_preferences_to_profile(draft, user)
    plan_context = PlanContextBuilder.build(draft)
    rotation_seed = hashlib.sha256(f"{draft.workspace.revision}:{draft.workspace_id}".encode()).hexdigest()[:16]
    decision_trace.add("rotation_seed", revision=draft.workspace.revision, seed=rotation_seed)

    # Resolve door-to-door transport before itinerary composition. The LLM
    # can sequence only these resolved journeys; it cannot invent modes or hubs.
    from apps.planner.services.journey_resolver import resolve_journey_options

    from django.conf import settings as planner_settings
    multimodal_enabled = getattr(planner_settings, "PLANNER_MULTIMODAL_RESOLUTION_ENABLED", True)
    shadow_mode = getattr(planner_settings, "PLANNER_MULTIMODAL_SHADOW_MODE", False)
    journey_options = (
        resolve_journey_options(draft, usage=usage_budget, trace=decision_trace)
        if multimodal_enabled or shadow_mode else []
    )
    selected_journey = next((option for option in journey_options if option.get("recommended")), None) if multimodal_enabled else None
    decision_trace.add(
        "multimodal_resolution", enabled=multimodal_enabled, shadow=shadow_mode,
        option_count=len(journey_options), selected=selected_journey.get("id") if selected_journey else None,
    )
    if multimodal_enabled and draft.intent == "full_trip" and not selected_journey:
        raise GenerationNeedsInput([{
            "code": "journey_unresolved",
            "detail": "No defensible door-to-door journey could be verified. Choose another mode or provide a nearby departure point.",
            "actions": ["change_transport_preference", "choose_nearby_hub", "retry_providers"],
        }])
    plan_context.journey_options = journey_options
    plan_context.selected_journey = selected_journey
    plan_context.rotation_seed = rotation_seed

    # Progressive planning (docs/ai-chat-implementation-plan.md Phase 8.1):
    # reuse a background-warmed skeleton/city-resolution if the input hasn't
    # changed since it warmed — same phases, same code paths, just skipping
    # the wait. A miss (never warmed, or stale hash) falls through to a
    # normal full run below; never a correctness risk, only a latency win.
    from apps.planner.services.intelligence import progressive as _progressive

    warm = _progressive.get_warm_artifact(draft.workspace, _progressive.input_hash(draft))
    # OBS-02 (checklist 0.3): warm-cache behavior must be visible per run —
    # a stale-hash bug here silently drops widget inputs (audit GEN-04).
    reporter.metrics("understanding", warm_hit=bool(warm))
    logger.info(
        "Progressive warm artifact %s for workspace %s [trace_id=%s]",
        "HIT" if warm else "miss",
        draft.workspace_id,
        reporter.trace_id,
    )

    # Phase 1: skeleton — structure only, no venues to hallucinate
    reporter.start("understanding", f"Reading your {draft.destination_text} trip brief")
    if warm:
        usage_budget.claim_ai()  # account for the warmed skeleton in this run's ceiling envelope
    skeleton = warm["skeleton"] if warm else _generate_skeleton(
        draft, reporter=reporter, plan_context=plan_context, usage_budget=usage_budget
    )
    skeleton = _normalize_skeleton_dates(skeleton, draft)
    reporter.done(
        "understanding",
        f"{len(skeleton['days'])} days across {len(skeleton['cities'])} "
        f"{'city' if len(skeleton['cities']) == 1 else 'cities'}" + (" (warmed)" if warm else ""),
    )

    # Phase 2: cities must exist in reference data (create + geocode on miss)
    reporter.start("selecting_cities")
    city_objs = None
    if warm:
        try:
            from apps.reference.models import City

            city_objs = {name: City.objects.get(id=cid) for name, cid in warm["city_ids"].items()}
        except Exception:
            city_objs = None  # stale/deleted city row — fall through to a full resolve
    if city_objs is None:
        city_objs = _resolve_cities(skeleton["cities"], draft)
    from apps.planner.services.currency import trip_currency
    currency_code = trip_currency(draft, city_objs)
    reporter.done("selecting_cities", " → ".join(c.name for c in city_objs.values()))

    # Phase 3: real candidate pools per city — filtered by hard constraints
    # from TravelerProfile facts (wheelchair, stroller, no-red-eye) so a
    # constrained traveler is never offered an inaccessible venue in the
    # first place (T2.2).
    constraint_engine = None
    try:
        from apps.planner.services.constraints import ConstraintEngine

        constraint_engine = ConstraintEngine(draft.workspace)
        if constraint_engine.constraints:
            reporter.detail("finding_places", f"Applying {len(constraint_engine.constraints)} constraint(s)")
    except Exception:
        constraint_engine = None

    reporter.start("finding_places")
    pools = {}
    for city_name, city_obj in city_objs.items():
        pools[city_name] = _build_candidate_pool(
            city_obj, constraint_engine=constraint_engine, plan_context=plan_context,
            decision_trace=decision_trace, usage_budget=usage_budget,
        )
        counts = {cat: len(items) for cat, items in pools[city_name].items() if items}
        summary = ", ".join(f"{n} {cat}s" for cat, n in counts.items())
        reporter.detail("finding_places", f"{city_obj.name}: {summary}")
    total_candidates = sum(len(v) for pool in pools.values() for v in pool.values())
    if total_candidates == 0:
        raise GenerationFailed("No reference places available for these cities.")
    reporter.done("finding_places", f"{total_candidates} real places found")

    # Phase 4: LLM sequences candidate ids; server joins the real rows back
    reporter.start("composing")
    days, meta = _compose_days(
        draft, skeleton, pools, city_objs,
        constraint_engine=constraint_engine, reporter=reporter, plan_context=plan_context,
        currency_code=currency_code, usage_budget=usage_budget, decision_trace=decision_trace,
    )
    # PlanBlock output contract (B13): the composed dict used to be written
    # straight into PlannerTrip.days with no schema check. A violation here
    # (e.g. a non-transport block that lost its master_ref grounding) is
    # treated exactly like an LLM failure — it propagates to
    # run_generation_job's except Exception, which degrades honestly to the
    # curated fallback (Phase 0b) rather than persisting an ungrounded block.
    from apps.planner.services.block_contract import validate_days

    validate_days(days)

    # PlanValidator + deterministic repair (Phase 3): grounding alone
    # doesn't catch INTERNAL feasibility defects — overlapping blocks, a
    # block that ends before it starts, or a red-eye flight the shift-fix
    # (Phase 0f) somehow still let through. Repairs what can be fixed
    # mechanically in place; anything left over is an honest, visible gap
    # on the itinerary, never a silent drop. The PRE-repair report is kept
    # for Phase 4 scoring — it measures how much work repair had to do,
    # i.e. how clean the raw LLM composition was.
    from apps.planner.services.refinement import repair_plan
    from apps.planner.services.validation import validate_plan

    pre_repair_report = validate_plan(days, constraint_engine=constraint_engine)
    days, validation_gaps = repair_plan(days, constraint_engine=constraint_engine)
    validation_gaps = list(meta.get("composition_gaps") or []) + list(validation_gaps)
    reporter.done("composing", f"{sum(len(d['activities']) for d in days)} blocks scheduled")

    # Phase 5: distances between consecutive places, stamped on each day
    reporter.start("routing")
    hint_count = _stamp_transit_hints(days)
    reporter.done("routing", f"{hint_count} legs measured")

    # Phase 6: transport priced from history/providers — never invented
    reporter.start("pricing")
    priced = _price_transport_blocks(days, draft)
    reporter.done("pricing", f"{priced} blocks priced from real data" if priced else "No priced transport on this trip")

    from django.conf import settings as planner_settings
    from apps.planner.services.scoring import score_plan

    initial_scorecard = score_plan(
        days, plan_context=plan_context, pre_repair_report=pre_repair_report, gaps=validation_gaps
    )
    refinement_count = 0
    threshold = float(getattr(planner_settings, "PLANNER_REFINEMENT_SCORE_THRESHOLD", 85))
    if (
        initial_scorecard.overall < threshold
        and usage_budget.ai_calls < usage_budget.max_ai_calls
        and usage_budget.refinement_calls < usage_budget.max_refinement_calls
    ):
        try:
            refined_days, refined_meta = _compose_days(
                draft, skeleton, pools, city_objs,
                constraint_engine=constraint_engine, reporter=reporter, plan_context=plan_context,
                currency_code=currency_code, usage_budget=usage_budget, decision_trace=decision_trace,
                refinement_feedback=initial_scorecard.reasons[:6],
            )
            validate_days(refined_days)
            refined_pre_report = validate_plan(refined_days, constraint_engine=constraint_engine)
            refined_days, refined_gaps = repair_plan(refined_days, constraint_engine=constraint_engine)
            refined_final_report = validate_plan(refined_days, constraint_engine=constraint_engine)
            refinement_count = 1
            if not refined_final_report.has_errors:
                _stamp_transit_hints(refined_days)
                _price_transport_blocks(refined_days, draft)
                refined_all_gaps = list(refined_meta.get("composition_gaps") or []) + list(refined_gaps)
                refined_scorecard = score_plan(
                    refined_days, plan_context=plan_context,
                    pre_repair_report=refined_pre_report, gaps=refined_all_gaps,
                )
                decision_trace.add(
                    "refinement_result", before=round(initial_scorecard.overall, 2),
                    after=round(refined_scorecard.overall, 2),
                    changed=refined_scorecard.overall > initial_scorecard.overall,
                )
                if refined_scorecard.overall > initial_scorecard.overall:
                    days, meta = refined_days, refined_meta
                    validation_gaps = refined_all_gaps
                    pre_repair_report = refined_pre_report
                    initial_scorecard = refined_scorecard
            else:
                decision_trace.add("refinement_rejected", reason="hard_constraint_failure")
        except Exception as exc:
            decision_trace.add("refinement_failed", reason=type(exc).__name__)

    days = _preserve_committed_blocks(days, plan_context, decision_trace)
    final_report = validate_plan(days, constraint_engine=constraint_engine)
    if final_report.has_errors:
        raise GenerationNeedsInput([
            {"code": violation.code, "detail": violation.message, "day_number": violation.day_number}
            for violation in final_report.violations if violation.severity == "error"
        ])

    # Phase 7: weather normals + totals
    reporter.start("finalizing")
    _stamp_weather_normals(days, city_objs)
    itinerary = _assemble_itinerary(draft, skeleton, days, meta, city_objs)
    itinerary["gaps"] = list(itinerary.get("gaps") or []) + validation_gaps

    if draft.budget_amount is not None:
        if (draft.budget_currency or itinerary["currency_code"]) == itinerary["currency_code"]:
            if float(itinerary.get("total_budget") or 0) > float(draft.budget_amount):
                raise GenerationNeedsInput([{
                    "code": "budget_cap_exceeded",
                    "detail": (
                        f"Verified plan costs {itinerary['total_budget']:.0f} {itinerary['currency_code']}, "
                        f"above the confirmed cap of {float(draft.budget_amount):.0f}."
                    ),
                    "actions": ["replace_expensive_items", "change_budget", "reduce_paid_activities"],
                }])
        else:
            itinerary["gaps"].append({
                "code": "budget_currency_verification",
                "detail": "Budget compliance needs a fresh exchange rate before confirmation.",
            })

    # Phase 4: the first objective, persisted measure of itinerary quality —
    # not just "did it not crash." Computed from data every earlier phase
    # already produced (grounding, enrichment, must-honor prefs, the
    # pre-repair validation report); never re-derives LLM judgment.
    scorecard = score_plan(
        days, plan_context=plan_context, pre_repair_report=pre_repair_report, gaps=itinerary["gaps"]
    )
    itinerary["scorecard"] = scorecard.to_dict(internal=False)
    itinerary["_internal_scorecard"] = scorecard.to_dict(internal=True)
    itinerary["_refinement_count"] = refinement_count
    itinerary["selected_journey"] = selected_journey

    # M5 'expert reasoning shown': an LLM critic pass, gated to plans still
    # flagged for review after any deterministic refinement above, and to
    # the same per-run AI-call ceiling every other Gemini call in this
    # pipeline respects. Silence (no critic_review key) on any denial or
    # failure — never a fabricated review, never a second compose.
    if scorecard.flagged_for_review and usage_budget.claim_ai():
        critic_review = _run_critic_review(days, scorecard, reporter=reporter)
        if critic_review:
            itinerary["scorecard"]["critic_review"] = critic_review
            decision_trace.add(
                "critic_review",
                severity=(critic_review["findings"][0]["severity"] if critic_review["findings"] else "none"),
                finding_count=len(critic_review["findings"]),
            )

    finalize_notes = []
    if validation_gaps:
        finalize_notes.append(f"{len(validation_gaps)} unresolved gap(s) recorded")
    if scorecard.flagged_for_review:
        finalize_notes.append("review recommended; actionable gaps recorded")
    reporter.done("finalizing", "; ".join(finalize_notes) if finalize_notes else None)
    return itinerary


def _run_critic_review(days, scorecard, reporter=None):
    """M5 'expert reasoning shown': a real LLM critic pass, extending the
    deterministic self-critique loop (score_plan + the one re-compose
    attempt above) with a second, independent judge. Runs only when the
    plan is still flagged for review after any deterministic refinement —
    gives the traveler concrete, itinerary-grounded observations instead of
    only the scorer's terse dimension-reason strings.

    Deliberately does NOT trigger another re-compose: auto-applying a
    second AI opinion on top of an already-refined plan is a materially
    different, higher-risk feature (the roadmap's own separate
    'constraint-solver optimization' item) — see docs/agent/HANDOFF.md
    Phase 3 note for why that was left for a dedicated follow-up rather
    than folded in here. Returns None on any failure or empty parse —
    never fabricates a review.
    """
    from google import genai
    from pydantic import BaseModel, Field
    from typing import List as _List, Optional as _Optional

    class CriticFinding(BaseModel):
        issue: str = Field(description="One concrete, specific weakness grounded in the itinerary below. No invented facts.")
        day_number: _Optional[int] = Field(default=None, description="The day this observation is about, if day-specific")
        severity: str = Field(description="minor | moderate | significant")

    class CriticReview(BaseModel):
        summary: str = Field(description="One-sentence overall verdict")
        findings: _List[CriticFinding] = Field(default_factory=list)

    day_lines = []
    for day in days:
        blocks = ", ".join(
            f"{b.get('start_time') or '?'} {b.get('title') or '?'} ({b.get('category') or '?'})"
            for b in (day.get("activities") or [])
        )
        day_lines.append(f"Day {day.get('day_number')} ({day.get('date')}): {blocks or '(no blocks)'}")

    prompt = (
        "You are an expert travel-plan critic. A deterministic scorer already flagged this "
        f"itinerary for review with these reasons: {'; '.join(scorecard.reasons[:6]) or 'none given'}.\n\n"
        "Review the actual itinerary below and give concrete, specific findings — reference real "
        "days/blocks, never invent facts not present here. If the deterministic reasons already "
        "cover it, say so briefly in the summary rather than inventing additional issues.\n\n"
        "Itinerary:\n" + "\n".join(day_lines)
    )
    try:
        from apps.common.ai import DEFAULT_GEMINI_MODEL, get_genai_client

        client = get_genai_client()
        _call_started = timezone.now()
        response = client.models.generate_content(
            model=DEFAULT_GEMINI_MODEL,
            contents=prompt,
            config=genai.types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=CriticReview,
                temperature=0.2,
            ),
        )
        if reporter is not None:
            reporter.usage(
                "finalizing", model=DEFAULT_GEMINI_MODEL, response=response,
                duration_ms=round((timezone.now() - _call_started).total_seconds() * 1000),
            )
        review = response.parsed
        if review is None:
            return None
        return {
            "summary": review.summary,
            "findings": [
                {"issue": f.issue, "day_number": f.day_number, "severity": f.severity}
                for f in review.findings
            ],
        }
    except Exception as exc:
        logger.warning("Critic review failed: %s", exc)
        return None


def _preserve_committed_blocks(days, plan_context, decision_trace):
    """Overlay booked/locked/pinned/accepted blocks during regeneration."""
    commitments = list(getattr(plan_context, "commitments", None) or [])
    if not commitments:
        return days
    by_date = {str(day.get("date")): day for day in days}
    for item in commitments:
        block = deepcopy(item.get("block") or {})
        if not block:
            continue
        day = by_date.get(str(item.get("day_date") or ""))
        if day is None:
            raise GenerationNeedsInput([{
                "code": "commitment_date_conflict",
                "detail": f"A {item.get('level')} item falls outside the confirmed trip dates.",
                "actions": ["unlock_commitment", "change_dates", "cancel_booking"],
            }])
        activities = list(day.get("activities") or [])
        existing_index = next(
            (index for index, candidate in enumerate(activities) if str(candidate.get("id")) == str(block.get("id"))),
            None,
        )
        if existing_index is None:
            activities.append(block)
        else:
            activities[existing_index] = block
        activities.sort(key=lambda value: value.get("start_time") or "99:99")
        day["activities"] = activities
        if decision_trace:
            decision_trace.add(
                "candidate_preserved", candidate=str(block.get("id")), outcome="preserved",
                commitment_level=2 if item.get("level") == "booked" else 3,
            )
    return days


# ── Phase 1: skeleton ────────────────────────────────────────────────────


def _generate_skeleton(draft, reporter=None, plan_context=None, usage_budget=None):
    from google import genai
    from pydantic import BaseModel, Field
    from typing import List, Optional

    class CityVisit(BaseModel):
        name: str = Field(description="City name only, e.g. 'Jaipur'")
        nights: int
        arrival_date: Optional[str] = Field(description="YYYY-MM-DD")
        departure_date: Optional[str] = Field(description="YYYY-MM-DD")

    class DayTheme(BaseModel):
        day_number: int
        date: str = Field(description="YYYY-MM-DD")
        title: str = Field(description="Catchy day title")
        day_type: str = Field(description="exploration | transit | relaxation | arrival | departure")
        city: str

    class TripSkeleton(BaseModel):
        title: str
        summary: str
        cities: List[CityVisit]
        days: List[DayTheme]

    nearby = (draft.metadata or {}).get("nearby_cities") or []
    nearby_str = f"Nearby cities to include as excursions: {', '.join(nearby)}" if nearby else ""
    purpose = (draft.metadata or {}).get("visit_purpose", "")

    # Explicit multi-city route (MultiCityWidget) — the traveler ordered
    # these cities deliberately, so this is a hard structural requirement,
    # not a suggestion the skeleton LLM can collapse into one city.
    multi_city_list = (draft.metadata or {}).get("multi_city_destinations") or []
    multi_city_str = (
        f"MULTI-CITY TRIP (MANDATORY): the traveler explicitly listed these cities in this exact order: "
        f"{' → '.join(multi_city_list)}. The 'cities' list MUST include ALL of them, in this order, "
        f"each with at least 1 night — split the total trip length across them sensibly. "
        f"Do NOT collapse this into a single city."
        if len(multi_city_list) >= 2 else ""
    )

    # Phase 1: pace/intensity previously never reached even the skeleton —
    # a "slow" traveler and a "packed" traveler got structurally identical
    # day themes for the same trip length.
    pace = (plan_context.prefs.get("pace") if plan_context else None) or (draft.metadata or {}).get("trip_pace")
    intensity = (plan_context.prefs.get("intensity") if plan_context else None) or (draft.metadata or {}).get("intensity_level")
    pace_str = f"Pace preference: {pace}" if pace else ""
    intensity_str = f"Activity intensity: {intensity}" if intensity else ""

    prompt = f"""Plan the STRUCTURE of a trip — cities, nights, and a theme per day.
Do NOT name any hotels, restaurants, attractions, or specific venues; real places are selected separately from a database.

Intent: {draft.intent}
Destination: {draft.destination_text}
Dates: {draft.start_date} to {draft.end_date}
Travelers: {draft.adults} adults, {draft.children} children
Budget tier: {draft.budget_tier}
Interests: {draft.interests}
Purpose: {purpose}
{pace_str}
{intensity_str}
{nearby_str}
{multi_city_str}

Rules:
- Days must run sequentially from {draft.start_date} to {draft.end_date}, one entry per date.
- Multi-city trips (including provided nearby cities) get a 'transit' day_type on transition days.
- Day 1 is 'arrival', the last day is 'departure' (unless single-day intent).
- If a pace preference is given: "slow" means fewer, more relaxed exploration days (favor 'relaxation' day_type); "packed" means dense exploration.
"""

    if usage_budget is not None and not usage_budget.claim_ai():
        raise GenerationFailed("AI call ceiling reached before skeleton generation.")

    from apps.common.ai import DEFAULT_GEMINI_MODEL, DEFAULT_GEMINI_TIMEOUT_MS, get_genai_client
    client = get_genai_client()
    _call_started = timezone.now()
    response = client.models.generate_content(
        model=DEFAULT_GEMINI_MODEL,
        contents=prompt,
        config=genai.types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=TripSkeleton,
            temperature=0.4,
            http_options=genai.types.HttpOptions(timeout=DEFAULT_GEMINI_TIMEOUT_MS),
        ),
    )
    if reporter is not None:
        reporter.usage(
            "understanding",
            model=DEFAULT_GEMINI_MODEL,
            response=response,
            duration_ms=round((timezone.now() - _call_started).total_seconds() * 1000),
        )
    data = response.parsed
    if data is None or not data.days:
        raise GenerationFailed("Skeleton generation returned no days.")

    return {
        "title": data.title,
        "summary": data.summary,
        "cities": [
            {
                "name": c.name.strip(),
                "nights": c.nights,
                "arrival_date": c.arrival_date or draft.start_date.isoformat(),
                "departure_date": c.departure_date or draft.end_date.isoformat(),
            }
            for c in data.cities
        ]
        or [
            {
                "name": draft.destination_text,
                "nights": max((draft.end_date - draft.start_date).days, 1),
                "arrival_date": draft.start_date.isoformat(),
                "departure_date": draft.end_date.isoformat(),
            }
        ],
        "days": [
            {
                "day_number": d.day_number,
                "date": d.date,
                "title": d.title,
                "day_type": d.day_type,
                "city": d.city.strip(),
            }
            for d in sorted(data.days, key=lambda x: x.day_number)
        ],
    }


# ── Phase 2: cities ──────────────────────────────────────────────────────


def _resolve_cities(skeleton_cities, draft):
    """Resolve or create every skeleton city through the shared geocoder."""
    from apps.planner.services.geocoding import resolve_or_create_city

    city_objs = {}
    names = [c["name"] for c in skeleton_cities]
    for name in names:
        clean = name.strip()
        city_obj = resolve_or_create_city(
            clean,
            country_hint=getattr(getattr(draft, "destination_city", None), "country", None),
        )
        city_objs[clean.lower()] = city_obj
    return city_objs


def _geocode_city(name):
    """Google Geocoding (real) or an honest (None, None) — never an LLM guess.

    Phase 0A (audit GEN-05): the second tier used to ask Gemini for the city's
    coordinates and the result was persisted onto reference.City rows. A city
    we cannot really geocode now simply has no coordinates until a real
    geocode succeeds; downstream (distance stamping, maps) already tolerates
    null coordinates by skipping those blocks."""
    from apps.planner.services.geocoding import geocode_city

    result = geocode_city(name)
    if not result:
        return None, None
    return result.get("latitude"), result.get("longitude")


# ── Phase 3: candidate pools ─────────────────────────────────────────────


def _semantic_query_text(plan_context, city_obj, category):
    """A short natural-language description of what this traveler wants in
    this category, built only from real, already-captured PlanContext
    signal — never invented. Returns None when there's no real
    personalization signal to search on (a bare city name adds nothing a
    plain rating sort doesn't already give _build_candidate_pool)."""
    if plan_context is None:
        return None
    prefs = plan_context.prefs or {}
    signal_parts = []
    interests = prefs.get("interests") or []
    if interests:
        signal_parts.append("interested in " + ", ".join(str(i) for i in interests[:5]))
    if plan_context.visit_purpose:
        signal_parts.append(f"trip purpose: {plan_context.visit_purpose}")
    if category == "restaurant":
        if prefs.get("cuisine"):
            signal_parts.append(f"cuisine: {prefs['cuisine']}")
        if prefs.get("dietary"):
            signal_parts.append(f"dietary need: {prefs['dietary']}")
        if prefs.get("ambiance"):
            signal_parts.append(f"ambiance: {prefs['ambiance']}")
    elif category == "hotel":
        stay = prefs.get("stay") or {}
        if stay.get("property_type"):
            signal_parts.append(f"property type: {stay['property_type']}")
        if stay.get("amenities"):
            signal_parts.append("amenities: " + ", ".join(str(a) for a in stay["amenities"]))
    elif category in ("attraction", "activity"):
        if prefs.get("pace"):
            signal_parts.append(f"pace: {prefs['pace']}")
    if not signal_parts:
        return None
    return f"A {category} in {city_obj.name} for a traveler who is " + "; ".join(signal_parts)


def _semantic_candidates(city_obj, category, per_category, plan_context, decision_trace, usage_budget):
    """RAG connect (M5): retrieve additional candidates via pgvector cosine
    similarity against real trip-intent text, over the same verified master
    tables `_build_candidate_pool` already reads — never a second, separate
    data source. Any failure (no embeddings computed yet, pgvector
    unavailable, embedding call failure) degrades to an empty list; this
    must never break pool building. Bounded to one query per category per
    city, gated on the same wall-time budget as the rest of generation."""
    query_text = _semantic_query_text(plan_context, city_obj, category)
    if not query_text:
        return []
    if usage_budget is not None and not usage_budget.wall_time_available():
        return []
    try:
        from apps.reference.services.embeddings import semantic_search

        hits = semantic_search(query_text, categories=[category], limit=per_category)
    except Exception as exc:
        logger.warning("Semantic retrieval failed for %s/%s: %s", city_obj.name, category, exc)
        return []
    rows = [hit["instance"] for hit in hits if hit.get("instance") is not None and hit["instance"].city_id == city_obj.id]
    if decision_trace:
        decision_trace.add(
            "semantic_retrieval", category=category, city=city_obj.name,
            query=query_text, hits=len(rows),
        )
    return rows


def _build_candidate_pool(city_obj, per_category=12, constraint_engine=None, plan_context=None, decision_trace=None, usage_budget=None):
    """
    Real candidates per category, best-preference-match first. Thin pools
    grow through the same KnowledgeEngine.resolve() path the canvases use
    (Google Places -> cached into the master tables), so generation and
    canvases share one cache and one field-mask config instead of two
    hand-kept-in-sync copies. A second, parallel growth path — semantic
    retrieval (M5, `_semantic_candidates`) — adds candidates the plain
    reference-DB filter wouldn't have surfaced, ranked by cosine similarity
    to real trip-intent text over the same verified rows.

    constraint_engine (T2.2), when given, filters out rows that demonstrably
    violate a hard traveler constraint (e.g. wheelchair accessibility)
    before they're ever offered to the LLM compose step.

    Phase 2: ranking is now PreferenceScorer (services/ranking.py), not a
    plain rating sort — a vegetarian traveler and a steakhouse-lover used
    to get the identical restaurant shortlist at equal rating. Each row is
    stamped with `_pref_score`/`_pref_reasons` so _candidate_block can
    build a non-empty `why` without re-scoring.
    """
    from apps.reference.models import ActivityMaster, AttractionMaster, HotelMaster, RestaurantMaster
    from apps.reference.services.provenance import publishable
    from apps.planner.services.ranking import diversify_ranked_candidates, score_candidate
    from apps.planner.services import taste

    models_by_category = {
        "attraction": AttractionMaster, "activity": ActivityMaster,
        "restaurant": RestaurantMaster, "hotel": HotelMaster,
    }
    prefs = plan_context.prefs if plan_context else {}
    nights = max(((plan_context.end_date - plan_context.start_date).days if plan_context and plan_context.start_date and plan_context.end_date else 1), 1)
    # CTX-01 R7: infants were captured on PlanContext but never counted here
    # — room-capacity checks (below) undercounted the real traveling party,
    # and an infant never triggered the family-friendly-venue bonus a
    # traveling-with-children signal gives. Counting them toward party_size
    # errs safe (slightly larger room estimate) rather than risking a venue
    # too small for the actual group.
    party_size = (plan_context.adults + plan_context.children + plan_context.infants) if plan_context else 1
    rejected = []
    if plan_context:
        for key, value in (plan_context.profile_facts or {}).items():
            if str(key).startswith("rejected."):
                rejected.extend(value if isinstance(value, list) else [value])
        rejected.extend(list(getattr(plan_context, "rejections", None) or []))
    recent = list((getattr(plan_context, "profile_facts", {}) or {}).get("_recent_choice_ids") or [])
    ranking_context = {
        "budget_amount": getattr(plan_context, "budget_amount", None),
        "budget_currency": getattr(plan_context, "budget_currency", None),
        "nights": nights,
        "rooms": max((party_size + 1) // 2, 1),
        "party_size": party_size,
        # Infants should also trigger the "good_for_children" venue bonus in
        # ranking._party_fit, not just older children.
        "children": getattr(plan_context, "children", 0) + getattr(plan_context, "infants", 0),
        "centroid": (float(city_obj.latitude), float(city_obj.longitude)) if city_obj.latitude is not None and city_obj.longitude is not None else None,
        "rejected": rejected,
        "recent": recent,
        # Phase 4 (M2): the ± category-affinity fact preference_learner
        # writes from repeated category_removed edit signals — a small,
        # bounded score nudge in ranking.score_candidate, not a hard filter.
        "category_affinity": (getattr(plan_context, "profile_facts", {}) or {}).get("category_affinity") or {},
    }

    pool = {}
    for category, model in models_by_category.items():
        rows = list(publishable(model.objects.filter(city=city_obj)))
        if len(rows) < per_category:
            rows = _grow_pool_via_places(city_obj, category) or rows
        existing_pks = {row.pk for row in rows}
        semantic_rows = _semantic_candidates(city_obj, category, per_category, plan_context, decision_trace, usage_budget)
        if semantic_rows:
            rows = rows + [row for row in semantic_rows if row.pk not in existing_pks]
            existing_pks.update(row.pk for row in semantic_rows)
        # Phase 4 (M2): a second, genuinely per-user retrieval source —
        # cosine similarity to THIS traveler's own taste vector, not trip-
        # intent text. Tagged _source_taste so ranking.score_candidate can
        # credit it distinctly from a rating- or text-match-driven pick.
        taste_rows = taste.taste_candidates(
            getattr(plan_context, "profile_facts", None), category, city_obj, per_category,
        )
        for row in taste_rows:
            if row.pk not in existing_pks:
                row._source_taste = True
                rows = rows + [row]
                existing_pks.add(row.pk)
        if taste_rows and decision_trace:
            decision_trace.add(
                "taste_retrieval", category=category, city=city_obj.name,
                hits=len([r for r in taste_rows if getattr(r, "_source_taste", False)]),
            )
        if any(getattr(row, "is_available", None) is not None for row in rows):
            rows = [row for row in rows if getattr(row, "is_available", None) is not False]
        if constraint_engine is not None and constraint_engine.constraints:
            rows = [r for r in rows if constraint_engine.is_valid_venue(r)]
        rejected_values = {str(value).strip().lower() for value in rejected}
        eligible_rows = []
        for row in rows:
            identity = f"{category}:{row.pk}".lower()
            if identity in rejected_values or str(row.name).strip().lower() in rejected_values:
                if decision_trace:
                    decision_trace.add("candidate_excluded", candidate=identity, reason="explicit_rejection", commitment_level=6)
                continue
            row._rank_category = category
            row._pref_score, row._pref_reasons = score_candidate(row, category, prefs, ranking_context)
            eligible_rows.append(row)
        rows = diversify_ranked_candidates(
            eligible_rows,
            seed=str(getattr(plan_context, "rotation_seed", "")),
        )
        pool[category] = rows[:per_category]
        if decision_trace:
            for rank, row in enumerate(pool[category], start=1):
                decision_trace.add(
                    "candidate_ranked", candidate=f"{category}:{row.pk}",
                    source="verified_database",
                    normalized_score=round(float(row._pref_score), 4),
                    diversity_penalty=float(getattr(row, "_diversity_penalty", 0)),
                    rank_before_diversity=int(getattr(row, "_rank_before_diversity", rank)),
                    rank_after_diversity=rank, eligibility=True,
                )
    return pool


def _grow_pool_via_places(city_obj, category):
    """Fetch live Places results into the master-table cache. Failure means
    'use what we have', never a crash."""
    try:
        from apps.reference.services.places_explore import resolve_places

        lat = float(city_obj.latitude) if city_obj.latitude else None
        lng = float(city_obj.longitude) if city_obj.longitude else None
        _source, places, _error = resolve_places(category, city_obj.name, lat=lat, lng=lng)
        return list(places) if places else None
    except Exception as exc:
        logger.warning("Pool growth via Places failed for %s/%s: %s", city_obj.name, category, exc)
        return None


# ── Phase 4: composing ───────────────────────────────────────────────────

_CATEGORY_TO_BLOCK = {"attraction": "attraction", "activity": "activity", "restaurant": "food", "hotel": "hotel"}


def _candidate_catalog_lines(pools):
    """Compact, LLM-readable catalog of real candidates with stable ids."""
    lines = []
    for city_name, pool in pools.items():
        lines.append(f"CITY: {city_name.title()}")
        for category, rows in pool.items():
            for row in rows:
                rating = f"{row.user_rating}★" if row.user_rating else "unrated"
                extra = ""
                if category == "restaurant" and getattr(row, "cuisine", ""):
                    extra = f", {row.cuisine[:40]}"
                elif category == "hotel" and getattr(row, "price_range", ""):
                    extra = f", {row.price_range}"
                lines.append(f"  {category}:{row.pk} | {row.name[:60]} ({rating}{extra})")
    return "\n".join(lines)


def _traveler_context_summary(user, destination_text=None):
    """
    Known TravelerProfile facts → natural-language scheduling guidance for
    the compose prompt (T6.1). Translates each behavioral key into an
    actionable sentence so the LLM knows what to do differently, not just
    what the value is.
    """
    if user is None:
        return ""
    try:
        from apps.planner.models import TravelerProfile
        from apps.planner.services import episodic_memory

        profile = TravelerProfile.objects.filter(user=user).first()
    except Exception:
        return ""
    if not profile or not profile.facts:
        return ""

    facts = {f["key"]: f["value"] for f in profile.facts if f.get("key") and f.get("value")}
    lines = []

    pace = facts.get("pace_preference")
    if pace == "packed":
        lines.append("- Pace: packed — schedule 5+ activities per day, fill gaps with restaurants/cafés.")
    elif pace == "slow":
        lines.append("- Pace: slow — max 2-3 blocks per day; build in rest; don't over-schedule.")
    elif pace == "moderate":
        lines.append("- Pace: moderate — 3-4 blocks per day is ideal.")

    budget = facts.get("budget_sensitivity")
    if budget == "value":
        lines.append("- Budget: value-seeker — prefer free/low-cost options; skip luxury tiers unless critical.")
    elif budget == "premium":
        lines.append("- Budget: premium — prioritize 4-5★ and upscale options.")

    start_pref = facts.get("start_time_preference")
    if start_pref == "early_riser":
        lines.append("- Start time: early riser — first activity at 08:00 or earlier; avoid late starts.")
    elif start_pref == "late_starter":
        lines.append("- Start time: late starter — first activity at 10:00+; don't schedule anything before 09:30.")

    meal_timing = facts.get("meal_timing")
    if meal_timing == "early_diner":
        lines.append("- Meals: tends to eat earlier — schedule lunch before 12:30.")
    elif meal_timing == "late_diner":
        lines.append("- Meals: tends to eat later — lunch around 14:00, dinner after 20:00 is fine.")

    top_cats = facts.get("top_activity_categories")
    if top_cats:
        lines.append(f"- Preferred activity types: {top_cats.replace(',', ', ')} — weight toward these when choosing candidates.")

    hotel_tier = facts.get("hotel_quality_tier")
    if hotel_tier == "luxury":
        lines.append("- Hotel: prefers 5★/luxury — prioritize the highest-rated hotel candidates.")
    elif hotel_tier == "budget":
        lines.append("- Hotel: budget traveler — prefer lower-cost hotel candidates.")

    # Phase 4 (M2): ± category affinity, learned from repeated edits
    # (preference_learner.learn_from_edits) — only the categories the
    # traveler has actually tended to remove are worth naming here; a
    # positive-only or empty affinity dict has nothing actionable to say.
    category_affinity = facts.get("category_affinity")
    if isinstance(category_affinity, dict):
        avoided = sorted(
            (cat for cat, score in category_affinity.items() if isinstance(score, (int, float)) and score < 0),
            key=lambda cat: category_affinity[cat],
        )
        if avoided:
            lines.append(f"- Tends to remove/skip: {', '.join(avoided[:3])} — weight these lower unless clearly requested.")

    # Phase 4 (M2): episodic memory — a real, names-only "last time here"
    # summary for this specific destination, when one exists.
    episode_line = episodic_memory.episode_summary_line(facts, destination_text)
    if episode_line:
        lines.append(f"- {episode_line}")

    # taste_vector is a large float list meant for retrieval (taste_candidates),
    # not for the LLM prompt — exclude it (and the keys already handled above)
    # from the generic fallback dump below.
    known_keys = {
        "pace_preference", "budget_sensitivity", "start_time_preference", "meal_timing",
        "top_activity_categories", "hotel_quality_tier", "category_affinity", "taste_vector",
    }
    for f in profile.facts:
        key, val = f.get("key", ""), f.get("value", "")
        if key and val and key not in known_keys and not key.startswith(episodic_memory.EPISODE_FACT_PREFIX):
            lines.append(f"- {key}: {val}")

    return "\n".join(lines)


def _shift_away_from_red_eye(start_time: str, end_time: str) -> tuple:
    """
    Push a 00:00-05:00 departure forward to 05:00, preserving the leg's
    original duration (T2.2/Phase 0f: ConstraintEngine.is_valid_transport
    previously had zero callers, so avoid_red_eye was a no-op end-to-end).
    Malformed times are left untouched — is_valid_transport already treats
    unparsable times as valid, never blocking on missing/bad data.
    """
    try:
        s_h, s_m = (int(p) for p in start_time.split(":")[:2])
        e_h, e_m = (int(p) for p in end_time.split(":")[:2])
    except (ValueError, AttributeError, IndexError):
        return start_time, end_time
    start_mins = s_h * 60 + s_m
    end_mins = e_h * 60 + e_m
    duration = (end_mins - start_mins) % (24 * 60)
    new_start_mins = 5 * 60
    new_end_mins = (new_start_mins + duration) % (24 * 60)
    return (
        f"{new_start_mins // 60:02d}:{new_start_mins % 60:02d}",
        f"{new_end_mins // 60:02d}:{new_end_mins % 60:02d}",
    )


def _transport_infra_gaps(city_objs):
    """
    Cities in this trip with no Airport/RailwayStation on file — the real-
    world reason a Himalayan hill town like Gangtok has no train or flight
    leg. Bus/cab are never flagged: a BusStation gap is usually just
    incomplete seed data, not a genuine "unreachable by road" claim, and cab
    is always feasible everywhere.
    """
    from apps.reference.models import Airport, RailwayStation

    gaps = []
    for city in city_objs.values():
        missing = []
        if not Airport.objects.filter(city=city).exists():
            missing.append("no airport")
        if not RailwayStation.objects.filter(city=city).exists():
            missing.append("no railway station")
        if missing:
            gaps.append(
                f"{city.name}: {', '.join(missing)} — use the resolver's viable nearby hub plus a road feeder; "
                "never substitute a full-distance cab solely for missing local infrastructure"
            )
    return gaps


def _compose_days(
    draft, skeleton, pools, city_objs, constraint_engine=None, reporter=None,
    plan_context=None, currency_code=None, usage_budget=None, decision_trace=None,
    refinement_feedback=None,
):
    from google import genai
    from pydantic import BaseModel, Field
    from typing import List, Optional

    class ComposedBlock(BaseModel):
        kind: str = Field(description="'candidate' for a place from the catalog, 'transport' for a travel leg")
        candidate_id: Optional[str] = Field(default=None, description="EXACT id from the catalog, e.g. 'attraction:42'. Required when kind='candidate'.")
        transport_mode: Optional[str] = Field(default=None, description="flight | train | bus | cab. Required when kind='transport'. Must match the traveler's REQUIRED transport mode above when one is given.")
        from_place: Optional[str] = Field(default=None, description="Transport origin city")
        to_place: Optional[str] = Field(default=None, description="Transport destination city")
        start_time: str = Field(description="e.g. 09:30")
        end_time: str = Field(description="e.g. 11:00")
        note: str = Field(description="One helpful, factual sentence about the visit. No invented prices or facts.")

    class ComposedDay(BaseModel):
        day_number: int
        blocks: List[ComposedBlock]

    class ComposedItinerary(BaseModel):
        days: List[ComposedDay]

    skeleton_lines = "\n".join(
        f"Day {d['day_number']} ({d['date']}, {d['city']}): {d['title']} [{d['day_type']}]"
        for d in skeleton["days"]
    )

    intent_rules = {
        "hotel_only": "Compose ONE day listing the 3 best hotel candidates as blocks. No transport, food, or sightseeing.",
        "flight_only": "Compose ONE day with the arrival transport leg only (kind='transport', mode flight).",
        "transit_only": "Compose ONE day with transport legs only.",
        "activities_only": "Use only attraction/activity candidates. No hotels or transport.",
        "food_and_dining": "Use only restaurant candidates. No hotels or transport.",
    }
    rules = intent_rules.get(
        draft.intent,
        "Each city's first day starts with an arrival transport leg (kind='transport') and hotel check-in "
        "(the SAME hotel candidate for a city's whole stay — check-in block once, on the first day there). "
        "Then 2-4 sightseeing/activity candidates per day and 1-2 restaurant candidates (lunch/dinner). "
        "The final day ends with a departure transport leg.",
    )
    origin = draft.origin_text or (draft.metadata or {}).get("origin") or ""
    traveler_context = _traveler_context_summary(getattr(draft.workspace, "user", None), draft.destination_text)
    traveler_context_block = (
        f"\nKNOWN TRAVELER CONTEXT (apply silently, do not ask about these again):\n{traveler_context}\n"
        if traveler_context else ""
    )

    # Phase 1 anti-leak fix: dietary/cuisine/stay/cabin/accessibility/
    # ai_preferences were captured during conversation but this prompt
    # previously injected only adults/children/interests/budget_tier — the
    # compose LLM never saw the rest, so personalization never reached the
    # actual venue/sequencing choices. plan_context.prefs is the complete,
    # normalized capture (services/plan_context.py); rendered here so a
    # veg/slow/wheelchair trip actually composes differently.
    from apps.planner.services.plan_context import PlanContextBuilder, prefs_prompt_block

    if plan_context is None:
        plan_context = PlanContextBuilder.build(draft)
    prefs_block = prefs_prompt_block(plan_context)
    prefs_block_rendered = f"\n{prefs_block}\n" if prefs_block else ""
    selected_journey = getattr(plan_context, "selected_journey", None)
    journey_block = ""
    if selected_journey:
        journey_block = (
            "\nRESOLVED DOOR-TO-DOOR JOURNEY (MANDATORY; do not invent or replace its hubs/modes):\n"
            + json.dumps(selected_journey, default=str, sort_keys=True)
            + "\n"
        )
    refinement_block = ""
    if refinement_feedback:
        refinement_block = (
            "\nTARGETED REFINEMENT: preserve all core facts, commitments, accepted choices, and valid sections. "
            "Change only the weaknesses listed here:\n- " + "\n- ".join(refinement_feedback) + "\n"
        )

    # Ground transport choices in verified reference data before the LLM
    # picks a mode — a hard-coded "REQUIRED transport mode" instruction was
    # making the composer claim a train/flight leg to towns with no station
    # or airport at all (e.g. Gangtok has neither). "Look first, then plan":
    # surface the real gaps so the LLM routes around them instead of
    # fabricating infrastructure that doesn't exist.
    infra_gaps = _transport_infra_gaps(city_objs)
    infra_block_rendered = (
        "\nVERIFIED TRANSPORT GAPS (real reference data — do not invent a station/airport that isn't listed here):\n"
        + "\n".join(f"- {g}" for g in infra_gaps) + "\n"
        if infra_gaps else ""
    )

    prompt = f"""Schedule this trip using ONLY the real candidates below.

TRIP STRUCTURE:
{skeleton_lines}

Origin city (for arrival/departure transport): {origin or 'not specified'}
Travelers: {draft.adults} adults, {draft.children} children
Interests: {draft.interests}
Budget tier: {draft.budget_tier}
{traveler_context_block}{prefs_block_rendered}{journey_block}{refinement_block}{infra_block_rendered}
CANDIDATE CATALOG (id | name (rating, extra)):
{_candidate_catalog_lines(pools)}

RULES:
- {rules}
- candidate_id MUST be copied exactly from the catalog. NEVER invent an id or a venue.
- Prefer higher-rated candidates that match the traveler's interests; don't reuse a candidate on multiple days (except the hotel).
- Times must be realistic and sequential within each day.
- Notes must be factual and generic (what/when/why) — no made-up prices, no invented details.
- Any "MUST accommodate" preference above (dietary, accessibility) is a hard constraint — never violate it, even if it means picking a lower-rated candidate.
- If a RESOLVED DOOR-TO-DOOR JOURNEY is present, transport blocks are placeholders only: the server installs its exact mainline hubs and feeder segments. Never replace a requested train/flight with a full-distance cab merely because the destination lacks a local hub."""

    if usage_budget is not None and not usage_budget.claim_ai(refinement=bool(refinement_feedback)):
        raise GenerationFailed("AI/refinement call ceiling reached before composition.")

    from apps.common.ai import COMPOSE_GEMINI_MODEL, DEFAULT_GEMINI_COMPOSE_TIMEOUT_MS, get_genai_client
    client = get_genai_client()
    _call_started = timezone.now()
    response = client.models.generate_content(
        model=COMPOSE_GEMINI_MODEL,
        contents=prompt,
        config=genai.types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=ComposedItinerary,
            temperature=0.5,
            http_options=genai.types.HttpOptions(timeout=DEFAULT_GEMINI_COMPOSE_TIMEOUT_MS),
        ),
    )
    if reporter is not None:
        reporter.usage(
            "composing",
            model=COMPOSE_GEMINI_MODEL,
            response=response,
            duration_ms=round((timezone.now() - _call_started).total_seconds() * 1000),
        )
    if usage_budget is not None:
        usage_meta = getattr(response, "usage_metadata", None)
        usage_budget.add_tokens(getattr(usage_meta, "total_token_count", 0))
    composed = response.parsed
    if composed is None or not composed.days:
        raise GenerationFailed("Composer returned no days.")

    # Join composed ids back to real rows; reject hallucinations.
    candidate_index = {}
    for pool in pools.values():
        for category, rows in pool.items():
            for row in rows:
                candidate_index[f"{category}:{row.pk}"] = (category, row)

    composed_by_number = {d.day_number: d for d in composed.days}
    used_ids = set()
    days_out = []
    journey_emitted = False
    # OBS-02 (checklist 0.2): how much silent repair the join layer had to do.
    compose_metrics = {
        "hallucinated_ids": 0,   # composer invented a candidate id
        "substituted_blocks": 0, # duplicate candidate swapped for another
        "dropped_blocks": 0,     # no usable candidate left — block vanished
        "missing_days": 0,       # skeleton day absent from composer output
        "empty_days": 0,         # day rendered with zero activities
    }
    composition_gaps = []

    # Per-city stay span (arrival date, departure date, night count) so a
    # hotel candidate block can be stamped with real check-in/check-out
    # dates automatically — how many nights the itinerary already spends in
    # that city — instead of the frontend having no idea until the traveler
    # opens Hotel Canvas and replaces it by hand. Sourced from the skeleton's
    # own per-city arrival/departure (the same values TripCity.arrival_date/
    # departure_date end up as), not re-derived, so the two stay consistent.
    # VAL-01 (docs/planner-complete-current-audit-and-repair-plan.md §19
    # R8): this used to be a dict keyed by city name, so a loop trip that
    # revisits the same city (e.g. Gangtok -> Pelling -> Gangtok, a real
    # case observed in Phase B evidence) collapsed both visits' spans into
    # one entry — whichever skeleton city came last silently overwrote the
    # first, so the FIRST stay's hotel got stamped with the SECOND stay's
    # night count. Kept as a list of every stay episode instead, matched to
    # each day by which arrival/departure date range actually contains it.
    city_spans = [
        {
            "name": c["name"].strip().lower(),
            "check_in": c.get("arrival_date"),
            "check_out": c.get("departure_date"),
            "nights": max(c.get("nights") or 1, 1),
        }
        for c in skeleton["cities"]
    ]

    def _span_for_day(day_city_key, day_date):
        matches = [s for s in city_spans if s["name"] == day_city_key]
        if not matches:
            return None
        if len(matches) == 1:
            return matches[0]
        for span in matches:
            if span["check_in"] and span["check_out"] and span["check_in"] <= day_date <= span["check_out"]:
                return span
        return matches[0]

    for sk_day in skeleton["days"]:
        day_city_key = sk_day["city"].strip().lower()
        city_obj = city_objs.get(day_city_key) or next(iter(city_objs.values()))
        from apps.planner.services.currency import currency_for_city
        day_currency = currency_for_city(city_obj, currency_code)
        pool = pools.get(day_city_key) or next(iter(pools.values()))
        composed_day = composed_by_number.get(sk_day["day_number"])
        if composed_day is None:
            compose_metrics["missing_days"] += 1
            composition_gaps.append({
                "day": sk_day["day_number"],
                "category": "day",
                "reason": "The composer omitted this skeleton day; it needs verified selections.",
            })

        activities = []
        for block in (composed_day.blocks if composed_day else []):
            if block.kind == "transport" and block.transport_mode:
                if constraint_engine is not None and not constraint_engine.is_valid_transport(
                    block.transport_mode, block.start_time
                ):
                    block.start_time, block.end_time = _shift_away_from_red_eye(block.start_time, block.end_time)
                if selected_journey and not journey_emitted:
                    activities.extend(_journey_segment_blocks(selected_journey, block.start_time, day_currency))
                    journey_emitted = True
                else:
                    activities.append(_transport_block(block, city_obj, plan_context=plan_context, currency_code=day_currency))
                continue
            resolved = candidate_index.get(block.candidate_id or "")
            if resolved is None:
                # Hallucinated or missing id → heuristic fill: best unused
                # candidate of any sightseeing category in this city.
                compose_metrics["hallucinated_ids"] += 1
                intended_category = _intended_category(block.candidate_id)
                resolved = _heuristic_pick(pool, used_ids, prefer=intended_category)
                if resolved is None:
                    compose_metrics["dropped_blocks"] += 1
                    composition_gaps.append({
                        "day": sk_day["day_number"],
                        "category": intended_category or "activity",
                        "reason": "No verified candidate was available for a composed block.",
                    })
                    continue
            category, row = resolved
            key = f"{category}:{row.pk}"
            if key in used_ids and category != "hotel":
                replacement = _heuristic_pick(pool, used_ids, prefer=category)
                if replacement is None:
                    compose_metrics["dropped_blocks"] += 1
                    composition_gaps.append({
                        "day": sk_day["day_number"],
                        "category": category,
                        "reason": "No unused verified replacement was available.",
                    })
                    continue
                compose_metrics["substituted_blocks"] += 1
                category, row = replacement
                key = f"{category}:{row.pk}"
            used_ids.add(key)
            if decision_trace:
                decision_trace.add(
                    "candidate_selected", candidate=key, outcome="selected",
                    normalized_score=round(float(getattr(row, "_pref_score", 0)), 4),
                    commitment_level=9, provenance="verified_database", freshness="unknown",
                )
            activities.append(_candidate_block(
                category, row, block, pool, used_ids,
                day_date=sk_day.get("date"),
                city_span=_span_for_day(day_city_key, sk_day.get("date")) if category == "hotel" else None,
                currency_code=day_currency,
            ))

        if not activities:
            compose_metrics["empty_days"] += 1

        days_out.append(
            {
                "day_number": sk_day["day_number"],
                "date": sk_day["date"],
                "title": sk_day["title"],
                "day_type": sk_day["day_type"],
                "city": sk_day["city"],
                "activities": activities,
            }
        )

    _append_hotel_return_anchors(days_out)

    if reporter is not None:
        reporter.metrics("composing", **compose_metrics)
    if any(compose_metrics.values()):
        logger.info(
            "Compose repair metrics%s: %s",
            f" [trace_id={reporter.trace_id}]" if reporter is not None else "",
            compose_metrics,
        )

    return days_out, {
        "title": skeleton["title"],
        "summary": skeleton["summary"],
        "compose_metrics": compose_metrics,
        "composition_gaps": composition_gaps,
    }


def _append_hotel_return_anchors(days_out):
    """
    Phase 2g (docs/planner-north-star-audit-and-vision.md) — a deterministic,
    Python-only pass, NOT an LLM instruction: appends an evening "Back to
    <hotel>" anchor to the end of any day that (a) has at least one
    scheduled activity, (b) is in a city with an active hotel stay, and
    (c) isn't a departure or transit day (nothing to return to once you've
    left, and a transit day's own transport IS the day's structure).
    Deliberately deterministic rather than prompted: the compose LLM's
    output schema/prompt is a tuned, live contract with zero automated test
    coverage in this repo, and teaching it a new non-candidate block type
    risks a malformed or ignored instruction that can only be caught by
    burning real API calls. This reuses the exact block shape
    chat_edit_intents.propose_hotel_return_from_chat already produces
    (same helper, same fields), so a generated anchor and a chat-added one
    are identical — never a second, driftable copy of that shape.
    """
    from apps.planner.services.chat_edit_intents import _build_hotel_return_block

    def _hotel_title_for_city(city_name):
        for day in days_out:
            if day.get("city") != city_name:
                continue
            for act in day.get("activities") or []:
                if act.get("category") == "hotel":
                    return act.get("title")
        return None

    for day in days_out:
        if (day.get("day_type") or "") in ("departure", "transit"):
            continue
        activities = day.get("activities") or []
        if not activities:
            continue
        last = activities[-1]
        if (last.get("category") or "") in ("hotel", "hotel_return"):
            continue  # already ends at/checking into the hotel
        hotel_title = _hotel_title_for_city(day.get("city"))
        if not hotel_title:
            continue
        with_times = [a.get("end_time") or a.get("start_time") for a in activities if a.get("end_time") or a.get("start_time")]
        last_time = max(with_times) if with_times else None
        # Never place the anchor before the day's last real activity ends.
        start_time = max(last_time, "19:00") if last_time else "19:00"
        block = _build_hotel_return_block(hotel_title=hotel_title, start_time=start_time)
        activities.append(block)


def _journey_segment_blocks(journey, start_time, currency_code):
    """Render one grouped resolved journey as versioned canonical transport blocks."""
    from django.conf import settings

    try:
        hour, minute = [int(part) for part in str(start_time or "08:00").split(":")[:2]]
    except (TypeError, ValueError):
        hour, minute = 8, 0
    cursor = hour * 60 + minute
    blocks = []
    for segment in journey.get("segments") or []:
        duration = max(int(segment.get("duration_mins") or 60), 10)
        start = f"{(cursor // 60) % 24:02d}:{cursor % 60:02d}"
        cursor += duration
        end = f"{(cursor // 60) % 24:02d}:{cursor % 60:02d}"
        mode = str(segment.get("mode") or journey.get("mode") or "cab")
        origin = segment.get("origin") or "Origin"
        destination = segment.get("destination") or "Destination"
        source = segment.get("resolved_source") or {}
        target = segment.get("resolved_destination") or {}
        evidence_fields = {
            key: segment.get(key, journey.get(key))
            for key in (
                "provenance", "freshness", "booking_availability", "source_name", "as_of",
                "expires_at", "confidence", "verification_action", "requires_verification",
            )
        }
        blocks.append({
            "id": str(uuid.uuid4()),
            "category": mode,
            "title": f"{mode.replace('_', ' ').title()}: {origin} â†’ {destination}",
            "location_name": destination,
            "start_time": start,
            "end_time": end,
            "estimated_cost": segment.get("estimated_cost"),
            "currency_code": currency_code or settings.DEFAULT_CURRENCY_CODE,
            "status": "pending",
            "notes": "Booking verification required." if evidence_fields.get("booking_availability") != "available" else "Availability verified by provider evidence.",
            "latitude": target.get("latitude") if isinstance(target, dict) else None,
            "longitude": target.get("longitude") if isinstance(target, dict) else None,
            "metadata": {
                "transport": {
                    "schema_version": 2,
                    "journey_id": journey.get("id"),
                    "segment_id": f"{journey.get('id')}:{segment.get('segment_index', len(blocks))}",
                    "segment_index": segment.get("segment_index", len(blocks)),
                    "segment_role": segment.get("segment_role"),
                    "mode": mode,
                    "origin": origin,
                    "destination": destination,
                    "resolved_source": source,
                    "resolved_destination": target,
                    "planning_suitability": journey.get("planning_suitability"),
                    **evidence_fields,
                }
            },
        })
    return blocks


def _intended_category(candidate_id):
    prefix = str(candidate_id or "").split(":", 1)[0].strip().lower()
    return {"food": "restaurant"}.get(prefix, prefix) if prefix in {
        "hotel", "restaurant", "food", "attraction", "activity"
    } else None


def _heuristic_pick(pool, used_ids, prefer=None):
    """Best-rated unused candidate; deterministic, no LLM involved."""
    order = [prefer] if prefer else []
    order += [c for c in ("hotel", "attraction", "activity", "restaurant") if c not in order]
    for category in order:
        for row in pool.get(category, []):
            if f"{category}:{row.pk}" not in used_ids:
                return category, row
    return None


def _transport_block(block, city_obj, plan_context=None, currency_code=None):
    from django.conf import settings

    from apps.reference.models import Airport, RailwayStation, BusStation, City

    # The composer is instructed to always set transport_mode when a
    # preferred mode is captured (plan_context.prefs.transport.preferred_mode
    # — see prefs_prompt_block); this fallback only ever fires when the LLM
    # left it blank, so it should still honor that preference rather than
    # silently substituting cab (the bug this comment fixes: a traveler
    # asking for train got cab because this default ignored their choice).
    fallback_mode = "cab"
    if plan_context is not None:
        preferred = (plan_context.prefs.get("transport") or {}).get("preferred_mode")
        if preferred:
            preferred = preferred.strip().lower()
            if preferred in ("flight", "train", "bus", "cab", "plane", "air"):
                fallback_mode = "flight" if preferred in ("plane", "air") else preferred

    mode = (block.transport_mode or fallback_mode).lower()
    if mode not in ("flight", "train", "bus", "cab"):
        mode = fallback_mode
    origin = (block.from_place or "").strip()
    dest = (block.to_place or city_obj.name).strip()

    def resolve_hub(place_name, t_mode):
        """Returns (name, lat, lng, hub_confirmed). hub_confirmed is False
        only when the city is known to us AND genuinely has no station/
        airport for t_mode — the one case where forcing that mode would be
        fabricating infrastructure (e.g. a "train to Gangtok" leg, when
        Gangtok has no railway station at all)."""
        if not place_name:
            return None, None, None, True
        # R5/DATA-01: prefer an exact match before the fragile substring
        # `icontains` (which can bind the wrong same-named city, especially
        # across countries) — icontains stays only as the last-resort
        # fallback for a place_name that includes extra text (e.g. "Gangtok,
        # Sikkim") an iexact would miss.
        clean = place_name.split(",")[0].strip()
        city = City.objects.filter(name__iexact=clean).first() or City.objects.filter(name__icontains=place_name).first()
        if not city:
            # Unresolved city — nothing to verify against, so don't
            # second-guess the LLM off incomplete reference data.
            return place_name, None, None, True

        if t_mode == "flight":
            hub = Airport.objects.filter(city=city).first()
            if hub:
                return f"{hub.name} ({hub.iata_code})", hub.latitude, hub.longitude, True
            from apps.planner.services.journey_resolver import _nearest_hubs, _coords
            nearest = _nearest_hubs(city, "flight", limit=1)
            if nearest:
                _distance, hub = nearest[0]
                coords = _coords(hub)
                return f"{hub.name} ({hub.iata_code})", coords[0], coords[1], True
            return city.name, city.latitude, city.longitude, False
        elif t_mode == "train":
            hub = RailwayStation.objects.filter(city=city).first()
            if hub:
                return f"{hub.name} ({hub.code})", hub.latitude or city.latitude, hub.longitude or city.longitude, True
            from apps.planner.services.journey_resolver import _nearest_hubs, _coords
            nearest = _nearest_hubs(city, "train", limit=1)
            if nearest:
                _distance, hub = nearest[0]
                coords = _coords(hub)
                return f"{hub.name} ({hub.code})", coords[0], coords[1], True
            return city.name, city.latitude, city.longitude, False
        elif t_mode == "bus":
            hub = BusStation.objects.filter(city=city).first()
            if hub:
                return hub.name, city.latitude, city.longitude, True
            return city.name, city.latitude, city.longitude, False

        return city.name, city.latitude, city.longitude, True

    source_name, source_lat, source_lng, source_hub_ok = resolve_hub(origin, mode)
    dest_name, dest_lat, dest_lng, dest_hub_ok = resolve_hub(dest, mode)

    downgrade_note = ""
    if mode != "cab" and not (source_hub_ok and dest_hub_ok):
        # Backstop for the compose prompt's own transport-gap grounding
        # (VERIFIED TRANSPORT GAPS in _compose_days): if the LLM still
        # claimed a mode with no real station/airport on file, never render
        # it as if that infrastructure exists — degrade to cab (the honest
        # real-world answer for e.g. a hill town with no rail/air access)
        # and say so, rather than silently mislabeling a road transfer.
        unreachable = dest_name if not dest_hub_ok else source_name
        downgrade_note = f"No {mode} access to {unreachable} — road transfer used instead."
        mode = "cab"
        source_name, source_lat, source_lng, _ = resolve_hub(origin, mode)
        dest_name, dest_lat, dest_lng, _ = resolve_hub(dest, mode)

    source_name = source_name or origin
    dest_name = dest_name or dest or city_obj.name

    title = f"{mode.title()} to {dest_name}" if dest_name else f"{mode.title()} transfer"
    if source_name and dest_name:
        title = f"{mode.title()}: {source_name} → {dest_name}"

    is_arrival = (dest.lower() == city_obj.name.lower() or city_obj.name.lower() in dest.lower())
    
    if is_arrival:
        display_lat = dest_lat
        display_lng = dest_lng
        display_name = dest_name
    else:
        display_lat = source_lat
        display_lng = source_lng
        display_name = source_name

    if not display_lat:
        display_lat = city_obj.latitude
        display_lng = city_obj.longitude

    return {
        "id": str(uuid.uuid4()),
        "category": mode if mode != "cab" else "cab",
        "title": title,
        "location_name": display_name or city_obj.name,
        "start_time": block.start_time,
        "end_time": block.end_time,
        "estimated_cost": None,
        "currency_code": currency_code or settings.DEFAULT_CURRENCY_CODE,
        "status": "pending",
        "notes": f"{downgrade_note} {block.note}".strip() if downgrade_note else block.note,
        "latitude": float(display_lat) if display_lat is not None else None,
        "longitude": float(display_lng) if display_lng is not None else None,
        "metadata": {
            "transport": {
                "mode": mode,
                "origin": origin,
                "resolved_source": source_name,
                "destination": dest,
                "resolved_destination": dest_name
            }
        },
    }


def _normalize_skeleton_dates(skeleton, draft):
    """Server dates are immutable: exactly one day per inclusive requested date."""
    expected = []
    current = draft.start_date
    while current and draft.end_date and current <= draft.end_date:
        expected.append(current)
        current += timedelta(days=1)
    raw_days = sorted(list(skeleton.get("days") or []), key=lambda day: day.get("day_number") or 0)
    default_city = (skeleton.get("cities") or [{}])[0].get("name") or draft.destination_text
    normalized = []
    for index, day_date in enumerate(expected):
        source = raw_days[index] if index < len(raw_days) else {}
        day_type = source.get("day_type") or "exploration"
        if index == 0:
            day_type = "arrival"
        elif index == len(expected) - 1:
            day_type = "departure"
        normalized.append({
            "day_number": index + 1,
            "date": day_date.isoformat(),
            "title": source.get("title") or f"Day {index + 1} in {default_city}",
            "day_type": day_type,
            "city": (source.get("city") or default_city).strip(),
        })
    skeleton["days"] = normalized
    return skeleton


def _enrichment_for_row(row):
    """
    Phase 1: join the LLM enrichment layer (apps.reference.services.
    enrichment) into the generated block. Before this, _candidate_block
    only ever read raw row fields (rating/editorial_summary) — the
    consultant-grade judgment (signature dish backed by 3+ review mentions,
    a real visit duration from explicit review time-mentions, hype
    calibration, noise profile) was already being computed and cached in
    PlaceInsight, but only ever surfaced when a user opened a hover/detail
    card via reference/services/suggestions.py — never in the itinerary
    itself. Reuses that exact same cache (never a second enrichment path),
    so freshly-cached, not-yet-enriched places just degrade to raw fields —
    never a fabricated judgment.
    """
    from apps.reference.services.suggestions import _local_tips, _place_insights

    insights = _place_insights(row)
    tips = _local_tips(row)

    ai_tip_override = None
    signature_dish = insights.get("signature_dish")
    if signature_dish and signature_dish.get("name"):
        ai_tip_override = f"Signature dish: {signature_dish['name']}"
    else:
        for key in ("hype_calibration", "vantage_point", "noise_profile", "room_tier_verdict"):
            candidate = insights.get(key)
            if candidate and candidate.get("text"):
                ai_tip_override = candidate["text"]
                break

    real_duration = insights.get("real_duration") or {}
    estimated_duration_mins = real_duration.get("minutes")

    return ai_tip_override, estimated_duration_mins, insights, tips


def _tradeoff_sentence(alt, why_reasons):
    """M5 'expert reasoning shown': a grounded, deterministic 'chosen over
    this' sentence for a runner-up candidate — reuses the exact
    PreferenceScorer reasons already stamped in _build_candidate_pool for
    both sides, never a new LLM call and never an invented comparison."""
    alt_reasons = list(dict.fromkeys(getattr(alt, "_pref_reasons", None) or []))
    winner_top = why_reasons[0] if why_reasons else None
    alt_top = alt_reasons[0] if alt_reasons else None
    if winner_top and alt_top and winner_top != alt_top:
        return f"Chosen over {alt.name}, which stood out mainly for {alt_top}."
    if winner_top:
        return f"Chosen over {alt.name}: {winner_top}."
    return f"Ranked ahead of {alt.name} for this slot."


def _candidate_block(category, row, block, pool, used_ids, day_date=None, city_span=None, currency_code=None):
    """A block built from a real master-table row. Every displayed fact
    (rating, image, address, tip) comes from that row — nothing invented."""
    from django.conf import settings

    ai_tip_override, estimated_duration_mins, insights, tips = _enrichment_for_row(row)

    # Phase 2: every block carries a non-empty `why` — the PreferenceScorer
    # reasons this candidate was ranked where it was (services/ranking.py),
    # stamped onto the row in _build_candidate_pool. Never fabricated: a row
    # that reached _candidate_block via a path that never scored it (e.g. a
    # direct unit-test call) honestly falls back to a rating-based reason,
    # never an invented preference match. Computed before the alternatives
    # loop below so each alternative can carry a grounded trade-off sentence
    # against this same `why`.
    why_reasons = list(dict.fromkeys(getattr(row, "_pref_reasons", None) or []))
    if not why_reasons:
        rating = float(row.user_rating or 0)
        why_reasons = (
            [f"one of the best-reviewed {category} options nearby ({rating}★)"]
            if rating >= 4.0
            else [f"the best available {category} match for this slot"]
        )
    why = "; ".join(why_reasons)

    alternatives = []
    for alt in pool.get(category, []):
        alt_key = f"{category}:{alt.pk}"
        if alt_key in used_ids or alt.pk == row.pk:
            continue
        alternatives.append(
            {
                "id": f"cand-{category}-{alt.pk}",
                "title": alt.name,
                "subtitle": (alt.address or "")[:80],
                "rating": float(alt.user_rating) if alt.user_rating else None,
                "aiTip": (alt.editorial_summary or "")[:160] or None,
                "place_id": alt.place_id,
                # M5 'expert reasoning shown' — the "considered A, chose B
                # because..." rationale, inline on the block, computed at
                # generation time (not gated behind the reactive Explain
                # button call).
                "tradeoff": _tradeoff_sentence(alt, why_reasons),
            }
        )
        if len(alternatives) == 2:
            break

    # T2.4: annotate (never silently drop) a slot that's demonstrably closed
    # at its scheduled time — same opening_hours parser insight_engine uses.
    ai_insights = {"candidates": alternatives} if alternatives else {}
    opening_hours_list = getattr(row, "opening_hours", None) or []
    if opening_hours_list and day_date and block.start_time:
        from apps.planner.services.opening_hours import is_open_at

        open_status = is_open_at(opening_hours_list, day_date, block.start_time)
        if open_status is False:
            ai_insights["hours_conflict"] = True

    metadata = {"place_id": row.place_id, "master_ref": {"table": category, "id": row.pk}}
    enriched_at = getattr(row, "last_enriched_at", None) or getattr(row, "verified_at", None)
    ttl_days = int(getattr(row, "enrichment_ttl_days", 30) or 30)
    expires_at = enriched_at + timedelta(days=ttl_days) if enriched_at else None
    metadata.update({
        "provenance": "verified_database",
        "freshness": (
            "fresh" if expires_at and expires_at > timezone.now()
            else "stale" if expires_at else "unknown"
        ),
        "source_name": getattr(row, "source", None) or row.__class__.__name__,
        "as_of": enriched_at.isoformat() if enriched_at else None,
        "expires_at": expires_at.isoformat() if expires_at else None,
        "confidence": float(getattr(row, "data_completeness_score", 0) or 0) or 0.75,
        "booking_availability": (
            "available" if getattr(row, "is_available", None) is True
            else "unavailable" if getattr(row, "is_available", None) is False
            else "unverified"
        ),
        "verification_action": "verify_live_availability",
    })
    # Hotel stay span — automatic default is "how many nights the itinerary
    # already spends in this city" (city_span, from the skeleton). The
    # traveler can still override nights per-hotel via Hotel Canvas; this
    # just means a freshly generated plan already shows a real check-in/
    # check-out instead of nothing until they open it.
    if category == "hotel" and city_span:
        metadata["stay_nights"] = city_span["nights"]
        metadata["check_in"] = city_span["check_in"]
        metadata["check_out"] = city_span["check_out"]
    if insights:
        metadata["insights"] = insights
    if tips:
        metadata["local_tips"] = tips

    return {
        "id": str(uuid.uuid4()),
        "category": _CATEGORY_TO_BLOCK[category],
        "title": row.name,
        "location_name": row.address or "",
        "start_time": block.start_time,
        "end_time": block.end_time,
        "estimated_cost": None,
        "estimated_duration_mins": estimated_duration_mins or getattr(row, "suggested_duration_mins", None),
        "currency_code": currency_code or settings.DEFAULT_CURRENCY_CODE,
        "status": "pending",
        "notes": block.note,
        "why": why,
        "latitude": float(row.latitude) if row.latitude is not None else None,
        "longitude": float(row.longitude) if row.longitude is not None else None,
        "rating": float(row.user_rating) if row.user_rating else None,
        "image_url": row.image_url,
        # Prefer a real, review-grounded enrichment judgment (signature
        # dish backed by 3+ mentions, hype calibration, vantage point, noise
        # profile) over the raw Places editorial_summary when one exists.
        "ai_tip": ai_tip_override or (row.editorial_summary or "").strip() or None,
        "metadata": metadata,
        "_aiInsights": ai_insights or None,
    }


# ── Phase 5: routing ─────────────────────────────────────────────────────


def _stamp_transit_hints(days):
    from apps.planner.services.distance_service import DistanceService

    pairs = []
    pair_targets = {}
    for day in days:
        geo_blocks = [
            a for a in day["activities"]
            if a.get("latitude") is not None and a.get("longitude") is not None
        ]
        for a, b in zip(geo_blocks, geo_blocks[1:]):
            pair_id = f"{a['id']}:{b['id']}"
            pairs.append(
                {
                    "id": pair_id,
                    "origin": {"lat": a["latitude"], "lng": a["longitude"], "name": a["title"]},
                    "destination": {"lat": b["latitude"], "lng": b["longitude"], "name": b["title"]},
                }
            )
            pair_targets[pair_id] = day

    if not pairs:
        return 0

    results = DistanceService.fetch_batch_distances(pairs, mode="driving")
    for pair_id, result in results.items():
        day = pair_targets.get(pair_id)
        if day is None:
            continue
        day.setdefault("transit_hints", {})[pair_id] = {
            "distance_km": result["distance_km"],
            "duration_mins": result["duration_mins"],
            "source": result.get("source", "unknown"),
        }
    return len(results)


# ── Phase 6: pricing ─────────────────────────────────────────────────────


def _price_transport_blocks(days, draft):
    """Transport gets a price only when history/providers actually have one.
    Unpriced blocks stay suggested-tier with no amount — an honest gap."""
    from django.conf import settings

    from apps.reference.services.live_price import lookup_live_price

    priced = 0
    travelers = max((draft.adults or 1) + (draft.children or 0), 1)
    for day in days:
        for block in day["activities"]:
            category = (block.get("category") or "").lower()
            if category not in ("flight", "train", "bus", "cab"):
                continue
            transport_meta = (block.get("metadata") or {}).get("transport") or {}
            result = None
            try:
                result = lookup_live_price(
                    service_type=category,
                    date_str=day.get("date") or "",
                    origin=transport_meta.get("origin", ""),
                    destination=transport_meta.get("destination", ""),
                )
            except Exception as exc:
                logger.warning("Transport pricing lookup failed: %s", exc)
            if not result:
                continue
            per_head = float(result["exact_price"])
            total = per_head * travelers if category != "cab" else per_head
            block["estimated_cost"] = total
            block["currency_code"] = result.get("currency") or block.get("currency_code") or settings.DEFAULT_CURRENCY_CODE
            block["cost"] = {
                "amount": total,
                "currency": block["currency_code"],
                "provenance": result["provenance"],
            }
            priced += 1
    return priced


# ── Phase 7: finalize ────────────────────────────────────────────────────


def _stamp_weather_normals(days, city_objs):
    from apps.reference.models import WeatherNormals

    normals_cache = {}
    for day in days:
        city_obj = city_objs.get((day.get("city") or "").strip().lower())
        if city_obj is None:
            continue
        try:
            month = date_cls.fromisoformat(day["date"]).month
        except (ValueError, TypeError):
            continue
        cache_key = (city_obj.pk, month)
        if cache_key not in normals_cache:
            normals_cache[cache_key] = WeatherNormals.objects.filter(city=city_obj, month=month).first()
        normal = normals_cache[cache_key]
        if normal:
            day["weather_normal"] = {
                "month": month,
                "avg_temp_c": float(normal.avg_temp_c) if normal.avg_temp_c is not None else None,
                "precipitation_mm": float(normal.precipitation_mm) if normal.precipitation_mm is not None else None,
            }


def _assemble_itinerary(draft, skeleton, days, meta, city_objs):
    from apps.planner.services.currency import sum_matching_currency, trip_currency

    currency_code = trip_currency(draft, city_objs)
    known_costs, currency_gaps = sum_matching_currency(days, currency_code)

    cities_out = []
    for idx, c in enumerate(skeleton["cities"]):
        city_obj = city_objs.get(c["name"].strip().lower())
        cities_out.append(
            {
                "name": city_obj.name if city_obj else c["name"],
                "country": city_obj.country.name if city_obj else "",
                "order": idx + 1,
                "nights": c["nights"],
                "arrival_date": c["arrival_date"],
                "departure_date": c["departure_date"],
            }
        )

    return {
        "title": meta["title"],
        "summary": meta["summary"],
        "total_budget": float(known_costs or 0),
        "budget_cap": float(draft.budget_amount) if draft.budget_amount is not None else None,
        "budget_cap_currency": draft.budget_currency if draft.budget_amount is not None else None,
        "cost_confidence": "high" if not currency_gaps else "limited",
        "currency_code": currency_code,
        "cities": cities_out,
        "days": days,
        "gaps": currency_gaps,
    }


def _persist_trip(workspace, draft, itinerary):
    """Same persistence semantics as the legacy create_plan — one atomic
    write of trip + workspace + pristine snapshot + learned flow/facts."""
    from django.conf import settings

    from apps.planner.services.conversation_service import ConversationService

    # Phase 3: unresolved validation gaps (a residual overlap/backwards-time
    # violation the deterministic repair pass couldn't fix) are recorded
    # honestly on the trip, never silently dropped — the itinerary is still
    # a real success (job.degraded is a separate, harsher signal for a full
    # pipeline failure).
    validation_gaps = itinerary.get("gaps", [])
    # Phase 4: the quality scorecard, when the pipeline produced one (the
    # legacy fallback path never does — itinerary.get defaults it to {}
    # there, which is honest: a curated fallback was never scored).
    scorecard = itinerary.get("scorecard", {})
    # PROV-01 (docs/planner-complete-current-audit-and-repair-plan.md §19
    # R13): build_fallback_plan already tags its own return with
    # metadata.provenance="fallback" (fallback_plan.py) but this function
    # never read it — degraded=True previously existed ONLY on the
    # ephemeral PlanGenerationJob row, visible for the ~1.8s the loading
    # screen holds it, and nowhere on the persisted trip itself. A reload,
    # a closed tab during that window, or simply scrolling past the loading
    # screen left no way to know a plan was the curated placeholder rather
    # than the real AI-composed itinerary.
    is_degraded = (itinerary.get("metadata") or {}).get("provenance") == "fallback"
    choice_ids = []
    for day in itinerary.get("days", []):
        for block in day.get("activities", []):
            ref = (block.get("metadata") or {}).get("master_ref") or {}
            if ref.get("table") and ref.get("id") is not None:
                choice_ids.append(f"{ref['table']}:{ref['id']}")
    choice_ids = list(dict.fromkeys(choice_ids))

    with transaction.atomic():
        workspace = PlannerWorkspace.objects.select_for_update().get(pk=workspace.pk)
        trip, created = PlannerTrip.objects.get_or_create(
            workspace=workspace,
            defaults={
                "title": itinerary.get("title", f"{draft.destination_text} Trip"),
                "summary": itinerary.get("summary", "Generated itinerary."),
                "currency_code": itinerary.get("currency_code", settings.DEFAULT_CURRENCY_CODE),
                "total_budget": itinerary.get("total_budget", draft.budget_amount or 0),
                "cities": itinerary.get("cities", []),
                "days": itinerary.get("days", []),
                "scorecard": scorecard,
                "metadata": {
                    "status": "complete",
                    "travelers": draft.adults + draft.children,
                    "validation_gaps": validation_gaps,
                    "last_generation_choice_ids": choice_ids,
                    "budget_cap": itinerary.get("budget_cap"),
                    "budget_cap_currency": itinerary.get("budget_cap_currency"),
                    "cost_confidence": itinerary.get("cost_confidence"),
                    "selected_journey": itinerary.get("selected_journey"),
                    "degraded": is_degraded,
                },
            },
        )
        if not created:
            trip.title = itinerary.get("title", trip.title)
            trip.summary = itinerary.get("summary", trip.summary)
            trip.currency_code = itinerary.get("currency_code", trip.currency_code)
            trip.total_budget = itinerary.get("total_budget", trip.total_budget)
            trip.cities = itinerary.get("cities") or trip.cities
            trip.days = itinerary.get("days", trip.days)
            trip.scorecard = scorecard
            trip.metadata = {
                "status": "complete",
                "travelers": draft.adults + draft.children,
                "validation_gaps": validation_gaps,
                "last_generation_choice_ids": choice_ids,
                "budget_cap": itinerary.get("budget_cap"),
                "budget_cap_currency": itinerary.get("budget_cap_currency"),
                "cost_confidence": itinerary.get("cost_confidence"),
                "selected_journey": itinerary.get("selected_journey"),
                "degraded": is_degraded,
            }
            trip.save()

        workspace.status = PlannerWorkspace.STATUS_ACTIVE
        workspace.mode = PlannerWorkspace.MODE_PLANNING
        workspace.last_activity_at = timezone.now()
        workspace.title = trip.title
        # Generation publishes a new canonical trip snapshot. Bump the same
        # monotonic revision used by chat/manual/helper mutations so any
        # response that began before generation completed is stale by design.
        workspace.revision += 1
        workspace.save(update_fields=["status", "mode", "last_activity_at", "updated_at", "title", "revision"])

        PlannerTripOriginal.objects.get_or_create(
            workspace=workspace,
            defaults={
                "title": trip.title,
                "summary": trip.summary,
                "cities": trip.cities,
                "days": trip.days,
                "metadata": trip.metadata,
            },
        )

    service = ConversationService()
    try:
        service._record_traveler_facts(workspace, draft)
    except Exception as exc:
        logger.warning("Traveler fact recording failed (non-fatal): %s", exc)
    try:
        # REC-01 (docs/planner-complete-current-audit-and-repair-plan.md
        # §19 R9): the existing recency penalty in ranking.score_candidate
        # only ever sees `last_generation_choice_ids` on THIS trip's own
        # metadata — a different trip to the same city starts with zero
        # memory of what was already recommended. TravelerProfile is keyed
        # by user, not workspace, so this makes the signal genuinely
        # cross-trip. Capped at 50 so it stays a recency signal, not an
        # ever-growing list that eventually penalizes every real venue.
        from apps.planner.models import TravelerProfile

        profile, _ = TravelerProfile.objects.get_or_create(user=workspace.user)
        profile.upsert_fact("recent_choice_ids", choice_ids[:50], provenance="inferred", source_trip=workspace.id)
    except Exception as exc:
        logger.warning("Cross-trip choice recording failed (non-fatal): %s", exc)

    try:
        # Phase 4 (M2): every real, named place that survives into a
        # persisted plan is an implicit "kept" signal for the taste vector
        # — reuses the same choice_ids this function already computed for
        # recent_choice_ids above, no second pass over the itinerary.
        from apps.planner.models import TravelerProfile
        from apps.planner.services import taste as _taste

        profile, _ = TravelerProfile.objects.get_or_create(user=workspace.user)
        for choice_id in choice_ids:
            category, _, pk = choice_id.partition(":")
            if category and pk:
                _taste.update_taste_vector(profile, category, pk, direction=1.0, source_trip=workspace.id)
    except Exception as exc:
        logger.warning("Taste-vector update failed (non-fatal): %s", exc)

    return trip
