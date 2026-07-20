import logging

from django.contrib.auth import get_user_model
from django.db.models import Count
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from apps.planner.models import PlannerChatMessage, PlannerWorkspace, PlanProposal, TripDraftState
from apps.planner.serializers import (
    ChatResponseSerializer,
    PlannerChatMessageSerializer,
    PlannerTripSerializer,
    PlannerWorkspaceSerializer,
    PlanProposalSerializer,
    TripDraftStateSerializer,
    TripSerializer,
    build_suggested_replies,
)
from apps.planner.services.conversation_service import ConversationService

logger = logging.getLogger(__name__)


def _trigger_enrichment_for_trip_blocks(trip):
    """
    A replaced/newly-added hotel/restaurant/attraction/activity block only
    gets its `metadata.master_ref` the moment the plan is saved here — the
    Helper Canvas selection and the details/hover views that would otherwise
    trigger enrichment (apps.reference.views._trigger_enrichment_if_needed)
    may never be hit again for that exact block afterward if the user
    doesn't linger on it. Kick enrichment off right at save time instead, so
    it has a head start on the ~5-15s Gemini call before anyone looks.

    Cheap even on every autosave: needs_enrichment() is a single indexed
    PlaceInsight lookup per block, and already-enriched blocks no-op.
    """
    from apps.reference.services.enrichment import needs_enrichment
    from apps.reference.services.places_explore import _category_config

    models_by_category = {cat: cfg["model"] for cat, cfg in _category_config().items()}
    seen = set()

    def _maybe_trigger(activity):
        if not activity:
            return
            
        if not activity.get("ai_tip"):
            from apps.planner.services.tip_sync import mark_pending_tip
            from apps.planner.tasks import generate_block_tip_task
            from django.db import transaction as db_transaction
            
            mark_pending_tip(trip, activity.get("id"))
            title = activity.get("title") or activity.get("location_name") or "this place"
            
            def _dispatch_tip(aid=activity.get("id"), t=title, workspace_id=str(trip.workspace.id)):
                import threading
                from django.conf import settings as dj_settings
                from apps.planner.services.tip_sync import set_tip_status
                from apps.planner.tasks import celery_worker_available

                if celery_worker_available():
                    try:
                        generate_block_tip_task.delay(workspace_id, str(aid), t)
                        return
                    except Exception:
                        logger.exception("Celery dispatch failed for tip %s", aid)
                if getattr(dj_settings, "PLANNER_ALLOW_THREAD_FALLBACK", False):
                    threading.Thread(
                        target=generate_block_tip_task,
                        args=(workspace_id, str(aid), t),
                        daemon=True,
                        name=f"planner-tip-{aid}",
                    ).start()
                    return
                set_tip_status(workspace_id, str(aid), "pending_worker_unavailable")

            db_transaction.on_commit(_dispatch_tip)

        master_ref = (activity.get("metadata") or {}).get("master_ref")
        if not master_ref:
            return
        category = master_ref.get("table")
        object_id = master_ref.get("id")
        
        model = models_by_category.get(category)
        if model is None or object_id is None or (category, object_id) in seen:
            return
        seen.add((category, object_id))
        instance = model.objects.filter(pk=object_id).first()
        if instance is not None and needs_enrichment(category, instance):
            from apps.reference.tasks import enrich_place
            enrich_place.delay(category, instance.pk)

    for day in trip.days or []:
        for activity in day.get("activities", []) or []:
            _maybe_trigger(activity)
    for city in trip.cities or []:
        _maybe_trigger(city.get("transitToNext"))


def _maybe_propose_day_retitle(workspace, old_days):
    """
    Replace-context refresh (docs/planner-product-audit-2026-07.md R2): if a
    PATCH just renamed a block that was its day's naming anchor, file a
    proposal to refresh the day title too. Best-effort — a failure here must
    never break the actual plan save that already succeeded.
    """
    try:
        from apps.planner.services.replace_context import propose_day_retitle

        propose_day_retitle(workspace, old_days, workspace.trip.days)
    except Exception as exc:
        logger.warning("propose_day_retitle failed (non-fatal): %s", exc)


def _maybe_propagate_plan_changes(workspace, old_days):
    """
    T7.1: after a plan PATCH saves, diff old_days against the new trip.days
    and run any detected time-shift through the app-layer planning graph's
    propagate() so downstream overlap bumps get filed as a proposal.
    Best-effort — a failure here must never break the actual save that
    already succeeded.
    """
    try:
        from apps.planner.services.planning_graph import detect_and_propagate_changes

        detect_and_propagate_changes(workspace, old_days)
    except Exception as exc:
        logger.warning("detect_and_propagate_changes failed (non-fatal): %s", exc)


def _maybe_learn_from_edits(workspace):
    """
    Phase 6 Learning Loop (docs/planner-output-generation-architecture.md):
    user edits are the highest-signal preference data available — revealed
    behavior, not a stated claim. Diffs against the AI's ORIGINAL proposal
    (PlannerTripOriginal, captured once at generation time), not just this
    PATCH's prior state, so the signal reflects cumulative drift from what
    the AI proposed to what the traveler actually kept. Best-effort — a
    failure here must never break the actual plan save that already
    succeeded.
    """
    try:
        original = getattr(workspace, "original_trip", None)
        if original is None:
            return
        from apps.planner.services.diff_engine import diff_trip
        from apps.planner.services.preference_learner import learn_from_edits

        original_days = original.days or []
        current_days = workspace.trip.days or []
        signals = diff_trip(original_days, current_days)
        if signals:
            learn_from_edits(workspace.user, workspace.id, signals)

        # Phase 4 (M2): episodic memory — same original/current snapshot,
        # same best-effort scope, just a different derived fact (real kept
        # vs. removed place names for this destination, not a signal kind).
        user = workspace.user
        if user is not None and getattr(user, "is_authenticated", False):
            cities = workspace.trip.cities or []
            destination_text = (cities[0] or {}).get("name") if cities else None
            if destination_text:
                from apps.planner.models import TravelerProfile
                from apps.planner.services.episodic_memory import record_trip_episode

                profile, _ = TravelerProfile.objects.get_or_create(user=user)
                record_trip_episode(profile, destination_text, original_days, current_days, source_trip=workspace.id)
    except Exception as exc:
        logger.warning("learn_from_edits failed (non-fatal): %s", exc)


def get_planner_user(request):
    """
    Phase 0c: anonymous traffic used to collapse onto ONE shared demo user
    (planner-demo@neuralnomad.local) — every anonymous visitor's workspaces,
    drafts, and TravelerProfile learned facts bled into every other
    visitor's, silently undermining any personalization built on top of
    them. Each browser/session now gets its own durable, isolated identity
    instead, with no change to the "just start chatting, no login required"
    UX — a session cookie is the only thing that changes hands, never a
    password. Clearing cookies simply starts a fresh identity, which is the
    correct behavior (never someone else's history).
    """
    if request.user and request.user.is_authenticated:
        return request.user

    if not request.session.session_key:
        request.session.save()  # force a real, persisted session key
    session_key = request.session.session_key

    user_model = get_user_model()
    user, created = user_model.objects.get_or_create(
        email=f"anon-{session_key}@neuralnomad.local",
        defaults={
            "name": "Guest Traveler",
            "phone": "",
            "is_active": True,
        },
    )
    if created:
        user.set_unusable_password()
        user.save(update_fields=["password"])
    return user


def _rate_limited(user, scope: str, *, limit: int, window_seconds: int) -> bool:
    """SEC-01 R12: simple fixed-window counter over Django's cache (the
    same backend celery_worker_available()'s heartbeat already relies on
    being consistent). Keyed per (scope, user) using get_planner_user's
    identity — real accounts and anonymous per-session identities are rate
    limited independently, so one visitor can never exhaust another's
    budget. Returns True when the caller should be BLOCKED (over limit)."""
    from django.core.cache import cache

    key = f"planner:ratelimit:{scope}:{user.id}"
    count = cache.get(key)
    if count is None:
        cache.set(key, 1, window_seconds)
        return False
    if count >= limit:
        return True
    try:
        cache.incr(key)
    except ValueError:
        cache.set(key, 1, window_seconds)
    return False


def _rate_limit_response():
    return Response(
        {
            "detail": "Too many requests right now. Please wait a moment and try again.",
            "code": "rate_limited",
        },
        status=status.HTTP_429_TOO_MANY_REQUESTS,
    )


class PlannerWorkspaceViewSet(viewsets.ModelViewSet):
    serializer_class = PlannerWorkspaceSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        user = get_planner_user(self.request)
        return (
            PlannerWorkspace.objects.filter(user=user, is_deleted=False)
            .annotate(chat_count_value=Count("chat_messages", distinct=True))
            .select_related("draft_state")
            .order_by("-last_activity_at")
        )

    def perform_create(self, serializer):
        serializer.save(user=get_planner_user(self.request))

    def perform_destroy(self, instance):
        instance.is_deleted = True
        instance.save(update_fields=["is_deleted"])

    @action(detail=True, methods=["get", "post"], url_path="chat")
    def chat(self, request, pk=None):
        workspace = self.get_object()
        if request.method == "GET":
            messages = list(workspace.chat_messages.order_by("created_at"))
            payload = PlannerChatMessageSerializer(messages, many=True).data
            last_assistant_id = next(
                (str(item.id) for item in reversed(messages) if item.role == PlannerChatMessage.ROLE_ASSISTANT),
                None,
            )
            for item in payload:
                if str(item["id"]) != last_assistant_id:
                    item["widgets"] = []
            return Response(payload)

        message = request.data.get("message", "")
        structured_value = request.data.get("structured_value")
        if not message and not structured_value:
            return Response(
                {"detail": "message or structured_value is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = get_planner_user(request)
        from django.conf import settings as dj_settings

        if _rate_limited(
            user, "chat",
            limit=getattr(dj_settings, "PLANNER_CHAT_RATE_LIMIT_PER_MINUTE", 30),
            window_seconds=60,
        ):
            return _rate_limit_response()

        try:
            result = ConversationService().send_message(
                user,
                message=message,
                workspace=workspace,
                structured_value=structured_value,
                turn_id=request.data.get("turn_id"),
            )
        except ValueError as exc:
            # REL-01 (docs/planner-complete-current-audit-and-repair-plan.md
            # §19 R12): _commit_turn_draft raises this on a revision CAS
            # conflict; the SSE stream path already turns any exception into
            # an honest error event, but this REST path let it propagate
            # into an unhandled 500. Any other ValueError is unexpected —
            # re-raise it rather than mask it as a conflict.
            if str(exc).startswith("planner_turn_conflict"):
                return Response(
                    {
                        "detail": "The trip changed while this reply was being prepared. Please retry.",
                        "code": "turn_conflict",
                    },
                    status=status.HTTP_409_CONFLICT,
                )
            raise
        return Response(ChatResponseSerializer(result).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"], url_path="draft")
    def draft(self, request, pk=None):
        workspace = self.get_object()
        draft, _ = TripDraftState.objects.get_or_create(workspace=workspace)
        return Response(TripDraftStateSerializer(draft).data)

    @action(detail=True, methods=["post"], url_path="journey-options")
    def journey_options(self, request, pk=None):
        """Resolve evidence-rich door-to-door options from canonical draft state."""
        workspace = self.get_object()
        expected_revision = request.data.get("expected_revision")
        if expected_revision is not None and int(expected_revision) != workspace.revision:
            return Response(
                {
                    "detail": "The trip changed while journey options were being resolved.",
                    "code": "stale_revision",
                    "current_revision": workspace.revision,
                },
                status=status.HTTP_409_CONFLICT,
            )
        from apps.planner.services.foundation import DecisionTrace, UsageBudget
        from apps.planner.services.journey_resolver import resolve_journey_options

        usage = UsageBudget()
        trace = DecisionTrace()
        options = resolve_journey_options(workspace.draft_state, usage=usage, trace=trace)
        return Response(
            {
                "revision": workspace.revision,
                "options": options,
                "needs_input": not any(option.get("feasible") for option in options),
                "usage": usage.to_dict(),
            }
        )

    @action(detail=True, methods=["post", "get", "patch"], url_path="plan")
    def plan(self, request, pk=None):
        workspace = self.get_object()
        service = ConversationService()

        if request.method == "POST":
            # SEC-01 R12: generation is the most expensive planner action
            # (multiple LLM calls + Places API growth) — capped separately
            # from the chat rate limit, and before either the sync dev path
            # or the real async path below so both are covered by one check.
            from django.conf import settings as dj_settings

            if _rate_limited(
                get_planner_user(request), "generation",
                limit=getattr(dj_settings, "PLANNER_GENERATION_RATE_LIMIT_PER_HOUR", 10),
                window_seconds=3600,
            ):
                return _rate_limit_response()

            # ?sync=1 keeps the old blocking single-request path — dev/test
            # only (Phase 0A, docs/planner-complete-audit-and-fix-plan.md):
            # production must never run a multi-second synchronous LLM
            # generation inside a request. Default is the durable background
            # job + polling.
            if request.query_params.get("sync") == "1":
                from django.conf import settings as dj_settings

                if not getattr(dj_settings, "PLANNER_ALLOW_SYNC_GENERATION", False):
                    return Response(
                        {
                            "detail": "Synchronous plan generation is disabled in this environment. "
                                      "Use the standard generation endpoint and poll plan/status.",
                            "code": "sync_generation_disabled",
                        },
                        status=status.HTTP_403_FORBIDDEN,
                    )
                try:
                    trip = service.create_plan(workspace)
                except ValueError as exc:
                    return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
                return Response(PlannerTripSerializer(trip).data, status=status.HTTP_201_CREATED)

            # ── The ONE atomic confirm-and-generate operation (audit CH-02,
            # checklist 2.2/2.5): validate the draft revision, verify
            # readiness, persist the confirmation (no LLM), and create-or-
            # return the idempotent job — all inside this request's
            # transaction (ATOMIC_REQUESTS + the workspace row lock inside
            # start_generation_job). The frontend confirmation button calls
            # only this; there is no second trigger path.
            from django.db import transaction as db_transaction
            from django.utils import timezone as dj_timezone

            from apps.planner.models import PlannerChatMessage
            from apps.planner.services.plan_generation import (
                serialize_job,
                spawn_generation_thread,
                start_generation_job,
            )
            from apps.planner.services.planner_state import GenerationBlocked, check_can_generate

            confirm = bool(request.data.get("confirm"))
            regenerate = bool(request.data.get("regenerate"))
            expected_draft_revision = request.data.get("expected_draft_revision")

            if expected_draft_revision is not None and int(expected_draft_revision) != workspace.revision:
                return Response(
                    {
                        "detail": "The trip changed while confirming. Review the latest details and try again.",
                        "code": "stale_revision",
                        "current_revision": workspace.revision,
                    },
                    status=status.HTTP_409_CONFLICT,
                )

            try:
                check_can_generate(workspace, regenerate=regenerate)
            except GenerationBlocked as exc:
                return Response(
                    {"detail": exc.detail, "code": exc.code, **exc.extra},
                    status=status.HTTP_400_BAD_REQUEST if exc.code == "not_ready" else status.HTTP_409_CONFLICT,
                )

            draft = workspace.draft_state
            if confirm:
                meta = dict(draft.metadata or {})
                if not meta.get("final_plan_confirmed"):
                    meta["final_plan_confirmed"] = True
                    meta["plan_confirmation_submitted"] = True
                    draft.metadata = meta
                    draft.save(update_fields=["metadata", "updated_at"])
                    # Deterministic transcript entry — never an LLM turn, so
                    # confirmation can't wander back into intake questions.
                    PlannerChatMessage.objects.create(
                        workspace=workspace,
                        role=PlannerChatMessage.ROLE_ASSISTANT,
                        message="Perfect — building your plan now. You'll see every step as it happens.",
                        metadata={"turn_action": "plan_confirmation", "deterministic": True},
                    )
                    workspace.revision += 1
                    workspace.last_activity_at = dj_timezone.now()
                    workspace.save(update_fields=["revision", "last_activity_at", "updated_at"])

            job, created = start_generation_job(workspace)
            if created:
                # T3.3 / Phase 0a: prefer Celery (survives worker restarts) —
                # but ONLY when a real worker proved itself via the heartbeat
                # task. Checklist 2.6: the daemon-thread fallback is
                # development-only; production without a worker records an
                # honest retryable worker_unavailable state instead.
                # ATOMIC_REQUESTS wraps this view — dispatch only after the
                # job row is committed and visible to the task/thread.
                def _dispatch(job_id=job.id):
                    from django.conf import settings as dj_settings

                    from apps.planner.models import PlanGenerationJob
                    from apps.planner.tasks import celery_worker_available

                    if celery_worker_available():
                        try:
                            from apps.planner.tasks import run_generation_job_task
                            run_generation_job_task.delay(job_id)
                            return
                        except Exception:
                            logger.exception("Celery dispatch failed for generation job %s", job_id)
                    if getattr(dj_settings, "PLANNER_ALLOW_THREAD_FALLBACK", False):
                        spawn_generation_thread(job_id)
                        return
                    PlanGenerationJob.objects.filter(id=job_id).update(
                        error="worker_unavailable: no Celery worker heartbeat and thread fallback is disabled",
                    )
                    logger.error(
                        "Generation job %s has no execution path (no worker heartbeat, thread fallback disabled)",
                        job_id,
                    )
                db_transaction.on_commit(_dispatch)
            return Response(serialize_job(job), status=status.HTTP_202_ACCEPTED)

        if not hasattr(workspace, "trip"):
            return Response({"detail": "Plan has not been created yet."}, status=status.HTTP_404_NOT_FOUND)

        if request.method == "PATCH":
            old_days = list(workspace.trip.days or [])
            import re
            for day in request.data.get("days") or []:
                value = day.get("date") if isinstance(day, dict) else None
                if value and not re.fullmatch(r"\d{4}-\d{2}-\d{2}", str(value)):
                    logger.warning("Non-ISO planner day date received for workspace %s: %r", workspace.id, value)
            from apps.planner.services.plan_mutations import (
                PlanMutationError,
                RevisionConflict,
                patch_trip,
            )

            try:
                trip = patch_trip(
                    workspace.id,
                    request.data,
                    expected_revision=request.data.get("expected_revision"),
                    mutation_id=request.data.get("mutation_id"),
                    source=request.data.get("source") or "manual_edit",
                )
            except RevisionConflict as exc:
                return Response(
                    {
                        "detail": "The plan changed while this edit was being saved. Reloaded the latest revision.",
                        "code": "stale_revision",
                        "current_revision": exc.current_revision,
                    },
                    status=status.HTTP_409_CONFLICT,
                )
            except PlanMutationError as exc:
                return Response(
                    {"detail": exc.detail, "code": exc.code, "violations": exc.violations},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            # patch_trip locks and returns its own fresh model instance. The
            # view's workspace may already have cached `workspace.trip` from
            # the pre-save read above; point existing post-save hooks at the
            # committed instance so learning/re-title never diff stale JSON.
            workspace._state.fields_cache["trip"] = trip
            _trigger_enrichment_for_trip_blocks(trip)
            _maybe_propose_day_retitle(workspace, old_days)
            _maybe_propagate_plan_changes(workspace, old_days)
            _maybe_learn_from_edits(workspace)
            return Response(PlannerTripSerializer(trip).data)

        return Response(PlannerTripSerializer(workspace.trip).data)

    @action(detail=True, methods=["post"], url_path="mutations")
    def mutations(self, request, pk=None):
        """Canonical mutation endpoint used by Helper Canvases.

        Selections are validated and committed before the client reports
        success; the response is the complete latest plan revision.
        """
        workspace = self.get_object()
        mutation_type = request.data.get("type")
        if mutation_type != "select_item":
            return Response(
                {"detail": "Unsupported planner mutation.", "code": "unsupported_mutation"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        target_block_id = request.data.get("target_block_id")
        selected_item = request.data.get("selected_item")
        if not target_block_id or not isinstance(selected_item, dict):
            return Response(
                {"detail": "target_block_id and selected_item are required.", "code": "invalid_mutation"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from apps.planner.services.plan_mutations import PlanMutationError, RevisionConflict, select_item

        try:
            trip = select_item(
                workspace.id,
                target_block_id=str(target_block_id),
                selected_item=selected_item,
                expected_revision=request.data.get("expected_revision"),
                mutation_id=request.data.get("mutation_id"),
                provider=str(request.data.get("provider") or "")[:200],
                selected_id=str(request.data.get("selected_id") or "")[:200],
                provenance=request.data.get("provenance") or "live_api",
            )
        except RevisionConflict as exc:
            return Response(
                {
                    "detail": "The plan changed before this selection was saved.",
                    "code": "stale_revision",
                    "current_revision": exc.current_revision,
                },
                status=status.HTTP_409_CONFLICT,
            )
        except PlanMutationError as exc:
            return Response(
                {"detail": exc.detail, "code": exc.code, "violations": exc.violations},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            from apps.planner.tasks import _publish_workspace_updated
            _publish_workspace_updated(str(workspace.id))
        except Exception:
            pass
        return Response(
            {
                "trip": PlannerTripSerializer(trip).data,
                "revision": trip.workspace.revision,
                "changed_sections": [str(target_block_id)],
            }
        )

    @action(detail=True, methods=["get"], url_path="plan/status")
    def plan_status(self, request, pk=None):
        """Real generation progress — the loading screen polls this ~1s."""
        workspace = self.get_object()

        from apps.planner.services.plan_generation import serialize_job

        job = workspace.generation_jobs.filter(is_deleted=False).order_by("-created_at").first()
        if job is None:
            return Response({"detail": "No generation job for this workspace."}, status=status.HTTP_404_NOT_FOUND)
        return Response(serialize_job(job))

    @action(detail=True, methods=["get"], url_path="plan/tips")
    def plan_tips(self, request, pk=None):
        """Lightweight endpoint to poll for tip readiness without pulling the whole plan."""
        workspace = self.get_object()
        if not hasattr(workspace, "trip"):
            return Response({})
            
        from apps.planner.services.commitments import _iter_active_blocks
        
        tips = {}
        for block in _iter_active_blocks(workspace.trip):
            block_id = str(block.get("id"))
            tips[block_id] = {
                "ai_tip": block.get("ai_tip"),
                "ai_tip_status": (block.get("metadata") or {}).get("ai_tip_status")
            }
        return Response(tips)

    # ── Plan lifecycle: Recent → Saved → Booked ──────────────────────────────

    @action(detail=True, methods=["post"], url_path="save")
    def save_plan(self, request, pk=None):
        """
        Save the current plan: the workspace leaves the Recent bucket and
        appears under Saved until it's modified again. The pristine generated
        snapshot (PlannerTripOriginal) is untouched — save records intent,
        not history.
        """
        workspace = self.get_object()
        if not hasattr(workspace, "trip"):
            return Response({"detail": "Plan has not been created yet."}, status=status.HTTP_404_NOT_FOUND)

        from django.utils import timezone

        trip = workspace.trip
        trip.metadata = {**(trip.metadata or {}), "saved_snapshot_at": timezone.now().isoformat()}
        # Only metadata: bumping trip.updated_at here would expire open
        # proposals via the staleness guard even though the plan didn't change.
        trip.save(update_fields=["metadata"])

        workspace.status = PlannerWorkspace.STATUS_SAVED
        workspace.is_modified = False
        workspace.revision += 1
        workspace.save(update_fields=["status", "is_modified", "revision", "updated_at"])
        return Response(PlannerWorkspaceSerializer(workspace).data)

    @action(detail=True, methods=["post"], url_path="book")
    def book(self, request, pk=None):
        """
        Book the whole trip. Strict by default: every active block that has a
        cost must already hold a booked/ticketed commitment — otherwise 409
        with the blocking blocks so Checkout can drive them through
        blocks/transition/ first. {"allow_partial": true} acknowledges the
        gaps without marking the trip booked.
        """
        workspace = self.get_object()
        if not hasattr(workspace, "trip"):
            return Response({"detail": "Plan has not been created yet."}, status=status.HTTP_404_NOT_FOUND)

        from apps.planner.models import PlanBlockCommitment
        from apps.planner.services.block_schema import upcast_activity
        from apps.planner.services.commitments import _iter_active_blocks

        trip = workspace.trip
        booked_ids = set(
            workspace.commitments.filter(
                is_deleted=False,
                status__in=[PlanBlockCommitment.STATUS_BOOKED, PlanBlockCommitment.STATUS_TICKETED],
            ).values_list("block_id", flat=True)
        )

        blocking = []
        for block in _iter_active_blocks(trip):
            upcast_activity(block, trip.currency_code or "INR")
            # Costless blocks (free attractions, walks) never gate booking
            if (block.get("cost") or {}).get("amount") is None:
                continue
            if str(block.get("id")) not in booked_ids:
                blocking.append({
                    "block_id": str(block.get("id")),
                    "title": block.get("title", ""),
                    "status": block.get("block_status", "planned"),
                })

        if blocking:
            if request.data.get("allow_partial"):
                return Response({
                    "detail": "Committed blocks are booked; trip stays un-booked until all items are.",
                    "blocking_blocks": blocking,
                    "workspace": PlannerWorkspaceSerializer(workspace).data,
                })
            return Response(
                {"detail": "Some items are not booked yet.", "blocking_blocks": blocking},
                status=status.HTTP_409_CONFLICT,
            )

        workspace.status = PlannerWorkspace.STATUS_BOOKED
        workspace.is_modified = False
        workspace.revision += 1
        workspace.save(update_fields=["status", "is_modified", "revision", "updated_at"])

        # Fire-and-forget: feeds this traveler's *next* trip via the
        # _compose_days context injection, not this one. A failure here must
        # never block the booking response itself.
        try:
            from apps.planner.tasks import infer_traveler_facts

            infer_traveler_facts.delay(str(workspace.id))
        except Exception as exc:
            logger.warning("infer_traveler_facts dispatch failed (non-fatal): %s", exc)

        return Response({
            "workspace": PlannerWorkspaceSerializer(workspace).data,
            "trip": PlannerTripSerializer(trip).data,
        })

    @action(detail=True, methods=["post"], url_path=r"blocks/(?P<block_id>[^/]+)/verify")
    def verify_block(self, request, pk=None, block_id=None):
        """
        Check a block's price against real data and record provenance.

        The client supplies search context (service_type, origin, destination,
        date, provider, code) because the view model owns display context;
        the server owns the write. A miss returns 404 and the block keeps its
        current tier — an honest "couldn't verify" is a valid outcome.
        """
        workspace = self.get_object()
        if not hasattr(workspace, "trip"):
            return Response({"detail": "Plan has not been created yet."}, status=status.HTTP_404_NOT_FOUND)

        from apps.planner.services.block_schema import apply_price_result, find_block
        from apps.reference.services.live_price import lookup_live_price

        trip = workspace.trip
        block, _day = find_block(trip, block_id)
        if block is None:
            return Response({"detail": "Block not found in this plan."}, status=status.HTTP_404_NOT_FOUND)

        service_type = request.data.get("service_type") or (block.get("category") or "").lower()
        if service_type == "taxi":
            service_type = "cab"
        date_str = request.data.get("date") or ""
        if not date_str:
            return Response({"detail": "date is required to verify a price."}, status=status.HTTP_400_BAD_REQUEST)

        result = lookup_live_price(
            service_type=service_type,
            date_str=date_str,
            provider=request.data.get("provider", block.get("title", "")),
            code=request.data.get("code", ""),
            origin=request.data.get("origin", ""),
            destination=request.data.get("destination", ""),
        )

        if result is None:
            return Response(
                {"detail": "No live or historical price found for this item.", "verified": False},
                status=status.HTTP_404_NOT_FOUND,
            )

        apply_price_result(block, result, default_currency=trip.currency_code)
        trip.save()
        workspace.revision += 1
        workspace.save(update_fields=["revision", "updated_at"])

        return Response({"verified": True, "block": block, "price": result, "revision": workspace.revision})

    # ── Commitments — money state machine + the ledger ──────────────────────

    @action(detail=True, methods=["post"], url_path="blocks/transition")
    def transition_blocks(self, request, pk=None):
        """
        Move blocks up the commitment ladder: priced → held → booked → ticketed.
        Body: {to, block_ids: [...], quote?, refundable_until?, provider_ref?}
        Invalid jumps fail per-block instead of silently corrupting money state.
        """
        workspace = self.get_object()
        to = request.data.get("to")
        block_ids = request.data.get("block_ids") or []
        if not to or not block_ids:
            return Response({"detail": "to and block_ids are required."}, status=status.HTTP_400_BAD_REQUEST)

        from apps.planner.services.commitments import TransitionError, transition_blocks

        try:
            updated, errors = transition_blocks(
                workspace,
                block_ids,
                to,
                quote=request.data.get("quote"),
                refundable_until=request.data.get("refundable_until"),
                provider_ref=request.data.get("provider_ref", ""),
            )
        except TransitionError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        if updated:
            workspace.revision += 1
            workspace.save(update_fields=["revision", "updated_at"])

        return Response({
            "transitioned": [c.block_id for c in updated],
            "errors": errors,
            "trip": PlannerTripSerializer(workspace.trip).data,
        })

    @action(detail=True, methods=["get"], url_path="ledger")
    def ledger(self, request, pk=None):
        """One honest home for money: committed vs planned vs budget, by tier."""
        workspace = self.get_object()

        from apps.planner.services.commitments import compute_ledger

        ledger = compute_ledger(workspace)
        if ledger is None:
            return Response({"detail": "Plan has not been created yet."}, status=status.HTTP_404_NOT_FOUND)
        return Response(ledger)

    # ── Proposals — every agent/tool change flows through accept/reject ──────

    @action(detail=True, methods=["post"], url_path="optimize-route")
    def optimize_route(self, request, pk=None):
        """
        Computes a shorter stop order per day server-side and files the
        result as a PlanProposal — never mutates the plan directly. See
        apps.planner.services.route_optimizer.
        """
        workspace = self.get_object()
        if not hasattr(workspace, "trip"):
            return Response({"detail": "Plan has not been created yet."}, status=status.HTTP_404_NOT_FOUND)

        from apps.planner.services.route_optimizer import (
            propose_route_optimization,
            propose_whole_trip_optimization,
        )

        # T6.2: per-day TSP first; whole-trip load balancing as a fallback.
        proposal = propose_route_optimization(workspace)
        if proposal is None:
            proposal = propose_whole_trip_optimization(workspace)
        if proposal is None:
            return Response({
                "detail": "Your routes are already efficient — reordering would not save meaningful travel time.",
                "proposal": None,
            })
        return Response({"detail": None, "proposal": PlanProposalSerializer(proposal).data}, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get", "post"], url_path="proposals")
    def proposals(self, request, pk=None):
        workspace = self.get_object()

        if request.method == "GET":
            qs = workspace.proposals.filter(is_deleted=False)[:20]
            return Response(PlanProposalSerializer(qs, many=True).data)

        if not hasattr(workspace, "trip"):
            return Response({"detail": "Plan has not been created yet."}, status=status.HTTP_404_NOT_FOUND)

        serializer = PlanProposalSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        proposal = serializer.save(
            workspace=workspace,
            base_trip_updated_at=workspace.trip.updated_at,
        )
        return Response(PlanProposalSerializer(proposal).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path=r"proposals/(?P<proposal_id>[^/]+)/accept")
    def accept_proposal(self, request, pk=None, proposal_id=None):
        """
        Apply a proposal's diff atomically. If the plan changed since the
        proposal was computed, it expires instead of mis-merging — the user
        sees "plan changed since this was suggested", never a corrupted merge.
        """
        workspace = self.get_object()
        try:
            proposal = workspace.proposals.get(id=proposal_id, is_deleted=False)
        except PlanProposal.DoesNotExist:
            return Response({"detail": "Proposal not found."}, status=status.HTTP_404_NOT_FOUND)

        if proposal.status != PlanProposal.STATUS_OPEN:
            return Response({"detail": f"Proposal is already {proposal.status}."}, status=status.HTTP_409_CONFLICT)
        if not hasattr(workspace, "trip"):
            return Response({"detail": "Plan has not been created yet."}, status=status.HTTP_404_NOT_FOUND)

        from django.utils import timezone

        trip = workspace.trip

        # Staleness guard
        if proposal.base_trip_updated_at and trip.updated_at > proposal.base_trip_updated_at:
            proposal.status = PlanProposal.STATUS_EXPIRED
            proposal.resolved_at = timezone.now()
            proposal.save(update_fields=["status", "resolved_at", "updated_at"])
            return Response(
                {"detail": "The plan changed since this was suggested.", "status": "expired"},
                status=status.HTTP_409_CONFLICT,
            )

        from apps.planner.services.block_schema import upcast_trip_payload
        from apps.planner.services.plan_mutations import PlanMutationError, _validate_commitment_hierarchy

        diff = proposal.diff or {}
        after_days = diff.get("after", {}).get("days", [])
        deltas = diff.get("deltas") or {}
        # Plan Evolution (docs/ai-chat-implementation-plan.md Phase 8.2): a
        # day-scoped add/remove, explicit in the diff rather than inferred
        # from day_number matching — additive to the retime case below,
        # existing proposals with empty deltas are unaffected.
        add_days = deltas.get("add_days") or []
        remove_day_numbers = {str(n) for n in (deltas.get("remove_day_numbers") or [])}
        if not after_days and not add_days and not remove_day_numbers:
            return Response({"detail": "Proposal has no applicable diff."}, status=status.HTTP_400_BAD_REQUEST)

        # Replace affected days by day_number, drop removed ones, append new ones
        days_by_number = {str(d.get("day_number")): d for d in after_days}
        new_days = [
            days_by_number.get(str(day.get("day_number")), day)
            for day in (trip.days or [])
            if str(day.get("day_number")) not in remove_day_numbers
        ]
        if add_days:
            new_days = sorted(new_days + add_days, key=lambda d: d.get("day_number") or 0)

        # Phase 1 (docs/planner-north-star-audit-and-vision.md): accept_proposal
        # previously wrote `new_days` straight to the trip with no commitment
        # check at all — patch_trip and select_item both already guard this via
        # _validate_commitment_hierarchy, but this path never did. Harmless while
        # every proposal kind only ever retimed a block or added/removed whole
        # empty days; a real gap once a proposal (chat-derived block
        # remove/move/swap, route optimization) can touch a NAMED existing
        # block that might be booked/locked. Reuses the exact same guard, same
        # error shape, as the other two mutation entry points.
        try:
            _validate_commitment_hierarchy(trip.days or [], new_days)
        except PlanMutationError as exc:
            return Response(
                {"detail": exc.detail, "code": exc.code, "violations": exc.violations},
                status=status.HTTP_400_BAD_REQUEST,
            )

        payload = upcast_trip_payload(
            {"currency_code": trip.currency_code, "days": new_days, "cities": trip.cities or []},
            default_currency=trip.currency_code or "INR",
        )
        trip.days = payload["days"]
        trip.save()

        workspace.is_modified = True
        workspace.revision += 1
        workspace.save(update_fields=["is_modified", "revision", "updated_at"])

        proposal.status = PlanProposal.STATUS_ACCEPTED
        proposal.resolved_at = timezone.now()
        proposal.save(update_fields=["status", "resolved_at", "updated_at"])

        try:
            from apps.planner.tasks import _publish_workspace_updated
            _publish_workspace_updated(str(workspace.id))
        except Exception:
            pass

        return Response({
            "status": "accepted",
            "proposal": PlanProposalSerializer(proposal).data,
            "trip": PlannerTripSerializer(trip).data,
        })

    @action(detail=True, methods=["post"], url_path=r"proposals/(?P<proposal_id>[^/]+)/reject")
    def reject_proposal(self, request, pk=None, proposal_id=None):
        """Rejections carry the reason — the agent must never re-propose rejected ideas."""
        workspace = self.get_object()
        try:
            proposal = workspace.proposals.get(id=proposal_id, is_deleted=False)
        except PlanProposal.DoesNotExist:
            return Response({"detail": "Proposal not found."}, status=status.HTTP_404_NOT_FOUND)

        if proposal.status != PlanProposal.STATUS_OPEN:
            return Response({"detail": f"Proposal is already {proposal.status}."}, status=status.HTTP_409_CONFLICT)

        from django.utils import timezone

        proposal.status = PlanProposal.STATUS_REJECTED
        proposal.rejection_reason = (request.data.get("reason") or "")[:300]
        proposal.resolved_at = timezone.now()
        proposal.save(update_fields=["status", "rejection_reason", "resolved_at", "updated_at"])

        # Traveler memory: a rejection with a reason is a durable preference
        if proposal.rejection_reason:
            try:
                from apps.planner.models import TravelerProfile

                profile, _ = TravelerProfile.objects.get_or_create(user=workspace.user)
                profile.upsert_fact(
                    f"rejected.{proposal.kind}",
                    proposal.rejection_reason,
                    provenance="stated",
                    source_trip=workspace.id,
                )
            except Exception as exc:
                logger.warning("Rejection fact recording failed (non-fatal): %s", exc)

        return Response({"status": "rejected", "proposal": PlanProposalSerializer(proposal).data})

    # ── Price watches — standing tasks; findings arrive as proposals ─────────

    @action(detail=True, methods=["post", "delete"], url_path=r"blocks/(?P<block_id>[^/]+)/watch")
    def watch_block(self, request, pk=None, block_id=None):
        """POST creates/activates a watch on this block's price; DELETE deactivates it."""
        workspace = self.get_object()
        if not hasattr(workspace, "trip"):
            return Response({"detail": "Plan has not been created yet."}, status=status.HTTP_404_NOT_FOUND)

        from apps.planner.models import PriceWatch
        from apps.planner.services.block_schema import find_block

        block, _day = find_block(workspace.trip, block_id)
        if block is None:
            return Response({"detail": "Block not found in this plan."}, status=status.HTTP_404_NOT_FOUND)

        if request.method == "DELETE":
            PriceWatch.objects.filter(workspace=workspace, block_id=str(block_id)).update(active=False)
            return Response({"watching": False})

        watch, _created = PriceWatch.objects.update_or_create(
            workspace=workspace,
            block_id=str(block_id),
            defaults={
                "active": True,
                "threshold_amount": request.data.get("threshold_amount"),
                "last_price": (block.get("cost") or {}).get("amount"),
            },
        )
        return Response({"watching": True, "block_id": watch.block_id}, status=status.HTTP_201_CREATED)

    # ── Proactive insights — advisory only; dismissal is persisted per plan-version ──

    @action(detail=True, methods=["get"], url_path="insights")
    def insights(self, request, pk=None):
        """
        Runs PlanInsightEngine fresh against the current trip (cheap — pure
        Python over already-loaded JSON, no external calls) and filters out
        anything already dismissed for this exact plan content. See
        apps.planner.services.insight_engine and
        docs/travel-intelligence-implementation-roadmap.md §2.6.
        """
        workspace = self.get_object()
        if not hasattr(workspace, "trip"):
            return Response([])

        import hashlib

        from apps.planner.models import PlanInsightDismissal
        from apps.planner.services.insight_engine import PlanInsightEngine

        trip = workspace.trip
        dismissed = set(
            PlanInsightDismissal.objects.filter(workspace=workspace).values_list("context_hash", flat=True)
        )

        result = []
        for insight in PlanInsightEngine.run(trip):
            # Scoped to this exact plan version, not "forever" — once the
            # trip changes enough to move updated_at, a dismissed insight is
            # eligible to resurface (it may no longer even apply, or a new
            # variant of it will get a new hash).
            related = ",".join(str(i) for i in sorted(insight.get("related_block_ids") or []))
            basis = f"{insight['rule']}:{insight.get('day_number')}:{related}:{insight['message']}:{trip.updated_at.isoformat()}"
            context_hash = hashlib.sha256(basis.encode()).hexdigest()[:32]
            if context_hash in dismissed:
                continue
            result.append({**insight, "context_hash": context_hash})

        return Response(result)

    @action(detail=True, methods=["post"], url_path=r"insights/(?P<context_hash>[^/]+)/dismiss")
    def dismiss_insight(self, request, pk=None, context_hash=None):
        workspace = self.get_object()

        from apps.planner.models import PlanInsightDismissal

        PlanInsightDismissal.objects.get_or_create(workspace=workspace, context_hash=context_hash)
        return Response({"dismissed": True})

    @action(detail=True, methods=["get"], url_path="live")
    def live(self, request, pk=None):
        """
        SSE endpoint for real-time workspace updates (T3.2).
        Uses Redis Pub/Sub when available (near-zero-latency push); falls
        back to a 30s DB-poll heartbeat so the channel stays open through a
        Redis outage instead of erroring out.
        """
        workspace = self.get_object()  # enforces auth + ownership before streaming starts
        workspace_id = str(workspace.id)

        def event_stream():
            yield _sse("connected", {"type": "connected"})
            try:
                import redis
                from django.conf import settings

                r = redis.from_url(settings.CELERY_BROKER_URL)
                pubsub = r.pubsub()
                pubsub.subscribe(f"workspace:{workspace_id}:updated")

                for event, payload in _redis_workspace_events(pubsub):
                    yield _sse(event, payload)
                return

                import time

                last_ping = time.monotonic()
                while True:
                    message = pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
                    if message and message.get("type") == "message":
                        yield _sse("update", {"type": "workspace_updated"})
                    # Periodic ping keeps the connection alive through proxies
                    # that time out idle streams — get_message with a timeout
                    # lets us interleave pings without blocking forever on listen().
                    if time.monotonic() - last_ping >= 30:
                        yield _sse("ping", {"type": "ping"})
                        last_ping = time.monotonic()
            except Exception:
                # Redis unavailable — fall back to a slow DB-poll heartbeat
                # so the stream degrades honestly instead of dying silently.
                import time

                from apps.planner.models import PlannerWorkspace as _PW

                last_seen = None
                while True:
                    time.sleep(30)
                    updated_at = (
                        _PW.objects.filter(id=workspace_id).values_list("updated_at", flat=True).first()
                    )
                    if updated_at and updated_at != last_seen:
                        last_seen = updated_at
                        yield _sse("update", {"type": "workspace_updated"})
                    else:
                        yield _sse("ping", {"type": "ping"})

        from django.http import StreamingHttpResponse

        response = StreamingHttpResponse(event_stream(), content_type="text/event-stream")
        response["Cache-Control"] = "no-cache"
        response["X-Accel-Buffering"] = "no"
        return response


# ── SSE chat streaming ───────────────────────────────────────────────────

def _sse(event, payload):
    import json
    from rest_framework.utils.encoders import JSONEncoder

    return f"event: {event}\ndata: {json.dumps(payload, cls=JSONEncoder)}\n\n"


def _redis_workspace_events(pubsub, monotonic=None):
    """Yield Redis events while guaranteeing a nonblocking 30s heartbeat."""
    import time

    clock = monotonic or time.monotonic
    last_ping = clock()
    while True:
        message = pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
        if message and message.get("type") == "message":
            yield "update", {"type": "workspace_updated"}
        if clock() - last_ping >= 30:
            yield "ping", {"type": "ping"}
            last_ping = clock()


def _post_plan_insights(workspace, limit=2):
    """
    Proactive +1 completeness, inline (docs/ai-chat-implementation-plan.md
    Phase 5): the same PlanInsightEngine + dismissal filtering the `insights`
    REST action already uses (see PlannerWorkspaceViewSet.insights above),
    reused here so a chat turn surfaces at most `limit` warning-severity
    insights without duplicating the rule engine. Never fabricates — a
    plan with no trip yet, or no firing rules, yields nothing.
    """
    if not hasattr(workspace, "trip"):
        return []

    try:
        import hashlib

        from apps.planner.models import PlanInsightDismissal
        from apps.planner.services.insight_engine import PlanInsightEngine

        trip = workspace.trip
        dismissed = set(
            PlanInsightDismissal.objects.filter(workspace=workspace).values_list("context_hash", flat=True)
        )

        result = []
        for insight in PlanInsightEngine.run(trip):
            if insight.get("severity") != "warning":
                continue  # info-level insights stay in the panel, not inline chat
            related = ",".join(str(i) for i in sorted(insight.get("related_block_ids") or []))
            basis = f"{insight['rule']}:{insight.get('day_number')}:{related}:{insight['message']}:{trip.updated_at.isoformat()}"
            context_hash = hashlib.sha256(basis.encode()).hexdigest()[:32]
            if context_hash in dismissed:
                continue
            result.append({**insight, "context_hash": context_hash})
            if len(result) >= limit:
                break
        return result
    except Exception as exc:
        logger.warning("[_post_plan_insights] failed (non-fatal): %s", exc)
        return []


def _stream_chat_response(user, message, workspace, structured_value, turn_id=None):
    """
    One SSE stream per turn. The engine call runs in its own transaction
    (the request itself is non-atomic so the connection isn't held open for
    the stream's lifetime); the reply is then delivered as token chunks so
    the client renders progressively, followed by widgets + done.
    """
    try:
        result = ConversationService().send_message(
            user,
            message=message,
            workspace=workspace,
            structured_value=structured_value,
            turn_id=turn_id,
        )
    except Exception as exc:
        yield _sse("error", {"detail": str(exc)[:300]})
        return

    assistant = result["assistant_message"]
    meta = assistant.metadata or {}

    yield _sse("state", {
        "workspace_id": str(result["workspace"].id),
        "revision": result["workspace"].revision,
        "detected_intent": meta.get("detected_intent"),
        "confidence_score": meta.get("confidence_score"),
        "ready_for_plan": result["ready_for_plan"],
        "missing_slots": result["missing_slots"],
        "user_message_id": str(result["user_message"].id),
        # Additive (docs/ai-chat-implementation-plan.md Phase 0) — ignored by
        # old clients, read by new ones.
        "intent_confidence": meta.get("intent_confidence"),
        "mode": meta.get("mode"),
        "pending_clusters": meta.get("pending_clusters"),
        "confidence_factors": meta.get("confidence_factors"),
    })

    # Word-chunked delivery of the persisted reply (~6 words per event —
    # real model-token streaming is a bigger lift, tracked separately; this
    # just makes the typing effect feel less sluggish in the meantime).
    words = (assistant.message or "").split(" ")
    for i in range(0, len(words), 6):
        yield _sse("token", {"t": " ".join(words[i:i + 6]) + (" " if i + 6 < len(words) else "")})

    yield _sse("widgets", assistant.widgets or [])

    # Additive events (docs/ai-chat-implementation-plan.md §3.2) — new SSE
    # types old clients simply never subscribe to.
    capabilities = meta.get("capabilities") or []
    if capabilities:
        yield _sse("capabilities", capabilities)

    insights = _post_plan_insights(result["workspace"])
    if insights:
        yield _sse("insights", insights)

    yield _sse("done", {
        "message_id": str(assistant.id),
        "workspace": PlannerWorkspaceSerializer(result["workspace"]).data,
        "ready_for_plan": result["ready_for_plan"],
        "missing_slots": result["missing_slots"],
        "metadata": meta,
        "suggested_replies": build_suggested_replies(meta),
    })


def _chat_stream_response(request, workspace):
    from django.http import StreamingHttpResponse

    message = request.data.get("message", "")
    structured_value = request.data.get("structured_value")
    turn_id = request.data.get("turn_id")
    if not message and not structured_value:
        return Response(
            {"detail": "message or structured_value is required"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user = get_planner_user(request)
    # SEC-01 R12: checked before the StreamingHttpResponse is constructed so
    # a 429 is a normal JSON response, not something injected into an SSE
    # stream a client may not even parse errors out of.
    from django.conf import settings as dj_settings

    if _rate_limited(
        user, "chat",
        limit=getattr(dj_settings, "PLANNER_CHAT_RATE_LIMIT_PER_MINUTE", 30),
        window_seconds=60,
    ):
        return _rate_limit_response()

    response = StreamingHttpResponse(
        _stream_chat_response(user, message, workspace, structured_value, turn_id),
        content_type="text/event-stream",
    )
    response["Cache-Control"] = "no-cache"
    response["X-Accel-Buffering"] = "no"  # proxies must not buffer the stream
    return response


from django.db import transaction as _transaction


@_transaction.non_atomic_requests
@api_view(["POST"])
@permission_classes([AllowAny])
def lazy_chat_stream(request):
    """SSE variant of lazy_chat — first message, workspace created lazily."""
    return _chat_stream_response(request, workspace=None)


@_transaction.non_atomic_requests
@api_view(["POST"])
@permission_classes([AllowAny])
def workspace_chat_stream(request, workspace_id=None):
    """SSE variant of the workspace chat action."""
    workspace = PlannerWorkspace.objects.filter(
        id=workspace_id, user=get_planner_user(request), is_deleted=False
    ).first()
    if workspace is None:
        return Response({"detail": "Workspace not found."}, status=status.HTTP_404_NOT_FOUND)
    return _chat_stream_response(request, workspace)


@api_view(["POST"])
@permission_classes([AllowAny])
def lazy_chat(request):
    message = request.data.get("message", "")
    structured_value = request.data.get("structured_value")
    if not message and not structured_value:
        return Response(
            {"detail": "message or structured_value is required"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user = get_planner_user(request)
    from django.conf import settings as dj_settings

    if _rate_limited(
        user, "chat",
        limit=getattr(dj_settings, "PLANNER_CHAT_RATE_LIMIT_PER_MINUTE", 30),
        window_seconds=60,
    ):
        return _rate_limit_response()

    try:
        result = ConversationService().send_message(
            user,
            message=message,
            structured_value=structured_value,
            turn_id=request.data.get("turn_id"),
        )
    except ValueError as exc:
        # REL-01 R12: see the matching handler on the `chat` action above.
        if str(exc).startswith("planner_turn_conflict"):
            return Response(
                {
                    "detail": "The trip changed while this reply was being prepared. Please retry.",
                    "code": "turn_conflict",
                },
                status=status.HTTP_409_CONFLICT,
            )
        raise
    return Response(ChatResponseSerializer(result).data, status=status.HTTP_201_CREATED)


@api_view(["GET", "PUT", "DELETE"])
@permission_classes([AllowAny])
def traveler_profile(request):
    """
    The consent surface for traveler memory. GET lists every remembered fact
    with its provenance and source trip; DELETE ?key=... forgets one; PUT
    sets the transport_preference fact (the one fact this surface accepts a
    direct write for — a generic "write any fact" endpoint is a bigger trust
    surface than the transport preferences panel needs).
    Memory the user cannot inspect and delete is memory we don't keep.
    """
    from apps.planner.models import TravelerProfile

    user = get_planner_user(request)
    profile, _ = TravelerProfile.objects.get_or_create(user=user)

    if request.method == "DELETE":
        key = request.query_params.get("key")
        if not key:
            return Response({"detail": "key query param is required"}, status=status.HTTP_400_BAD_REQUEST)
        before = len(profile.facts or [])
        profile.facts = [f for f in (profile.facts or []) if f.get("key") != key]
        profile.save(update_fields=["facts", "updated_at"])
        return Response({"deleted": before - len(profile.facts)})

    if request.method == "PUT":
        value = request.data.get("transport_preference")
        if value is None:
            return Response({"detail": "transport_preference is required"}, status=status.HTTP_400_BAD_REQUEST)
        profile.upsert_fact("transport_preference", value, provenance="stated")
        profile.save(update_fields=["facts", "updated_at"])

    return Response({"facts": profile.facts or []})


@api_view(["POST"])
@permission_classes([AllowAny])
def explain_recommendation(request):
    """
    POST /api/v1/planner/recommendations/explain/
    Body: {"block": {"title", "category", "city", "note"}, "context": "..."}

    Wires the (previously dormant) RecommendationEngine into every card's
    "Explain" action (T2.1/T5.1). Caches by content hash so re-opening the
    same explanation doesn't re-call Gemini.
    """
    import hashlib
    from dataclasses import asdict

    from django.core.cache import cache

    get_planner_user(request)  # auth-enforced, result unused — matches traveler_profile's pattern

    block = request.data.get("block") or {}
    context_text = (request.data.get("context") or "").strip()
    title = (block.get("title") or "").strip()
    if not title:
        return Response({"detail": "block.title is required"}, status=status.HTTP_400_BAD_REQUEST)

    prompt_lines = [f"Explain why this recommendation makes sense for the traveler: {title}."]
    if block.get("category"):
        prompt_lines.append(f"Category: {block['category']}.")
    if block.get("city"):
        prompt_lines.append(f"City: {block['city']}.")
    if block.get("note"):
        prompt_lines.append(f"Known detail: {block['note']}.")
    if context_text:
        prompt_lines.append(f"Trip context: {context_text}.")
    prompt = " ".join(prompt_lines)

    cache_key = "rec_explain:" + hashlib.sha256(prompt.encode()).hexdigest()[:20]
    cached = cache.get(cache_key)
    if cached is not None:
        return Response(cached)

    from apps.planner.services.recommendation_engine import RecommendationEngine

    rec = RecommendationEngine().generate_recommendation(prompt)
    if rec is None:
        return Response({"detail": "Could not generate an explanation right now."}, status=status.HTTP_502_BAD_GATEWAY)

    result = asdict(rec)
    cache.set(cache_key, result, 1800)  # 30 min
    return Response(result)


@api_view(["GET"])
@permission_classes([AllowAny])
def trip_prep_status(request, workspace_id=None):
    """
    GET /api/v1/planner/workspaces/<id>/trip-prep/

    Real weather + packing guidance (T2.3) and the trip health index (T1.1)
    for the header/prep surfaces. Every field carries honest provenance.
    """
    workspace = PlannerWorkspace.objects.filter(
        id=workspace_id, user=get_planner_user(request), is_deleted=False
    ).first()
    if workspace is None:
        return Response({"detail": "Workspace not found."}, status=status.HTTP_404_NOT_FOUND)

    from apps.planner.services.live_status import get_trip_prep_status
    from apps.planner.services.trip_health import evaluate_trip_health

    prep = get_trip_prep_status(workspace)
    trip = getattr(workspace, "trip", None)
    prep["health"] = evaluate_trip_health(trip) if trip else {"score": 0, "metrics": {}}
    return Response(prep)


@api_view(["GET"])
@permission_classes([AllowAny])
def committed_bookings(request):
    """
    GET /api/v1/planner/committed-bookings/

    Read-only bridge between this app's two parallel booking surfaces
    (docs/planner-north-star-audit-and-vision.md Phase 0e): an item booked
    INSIDE a generated trip goes through PlanBlockCommitment (the planner's
    own money-state ladder, see services/commitments.py) and never becomes
    an apps.bookings.Booking row — but the "My Bookings" vault page
    (frontend hooks/use-bookings.ts) only ever queried bookings.Booking, so
    a user who booked a flight from inside a trip never saw it there.

    This lists every BOOKED/TICKETED commitment across the user's own
    workspaces, shaped exactly like a bookings.Booking row, so the existing
    vault UI can merge and render both lists with no rendering changes.
    Deliberately read-only and additive — it does not touch either
    system's write path, money-state machine, or schema. Reconciling the
    two into one system is a larger, separately-scoped decision; this only
    restores the visibility a real user is missing today.
    """
    from apps.planner.models import PlanBlockCommitment
    from apps.planner.services.block_schema import find_block

    user = get_planner_user(request)
    commitments = (
        PlanBlockCommitment.objects.filter(
            workspace__user=user,
            status__in=[PlanBlockCommitment.STATUS_BOOKED, PlanBlockCommitment.STATUS_TICKETED],
            is_deleted=False,
        )
        .select_related("workspace", "workspace__trip")
        .order_by("-updated_at")
    )

    results = []
    for commitment in commitments:
        trip = getattr(commitment.workspace, "trip", None)
        if trip is None:
            continue
        block, day = find_block(trip, commitment.block_id)
        if block is None:
            continue

        category = (block.get("category") or "").lower()
        booking_type = "cab" if category == "taxi" else category
        if booking_type not in {"flight", "train", "bus", "hotel", "cab"}:
            # attraction/activity/food/rest/hotel_return were never bookable
            # through this ladder — nothing to reconcile for them.
            continue

        metadata = block.get("metadata") or {}
        transport = metadata.get("transport") or {}
        start_date = (day or {}).get("date") or ""
        end_date = None
        if booking_type == "hotel":
            details = {"address": block.get("location_name") or "", "city": (day or {}).get("city") or ""}
            start_date = metadata.get("check_in") or start_date
            end_date = metadata.get("check_out")
        elif booking_type == "cab":
            details = {"pickup": transport.get("origin") or "", "dropoff": transport.get("destination") or ""}
        else:
            details = {"origin": transport.get("origin") or "", "destination": transport.get("destination") or ""}

        results.append({
            "id": str(commitment.id),
            "user": str(user.id),
            "booking_type": booking_type,
            "reference_number": commitment.provider_ref or f"TRIP-{str(commitment.id)[:8].upper()}",
            "status": "confirmed",
            "amount": float(commitment.amount) if commitment.amount is not None else 0,
            "currency": commitment.currency or "INR",
            "booking_date": commitment.created_at.isoformat(),
            "start_date": start_date,
            "end_date": end_date,
            "details": details,
            # Honest, not aspirational: CheckoutCanvas is explicit that
            # confirming a trip item reserves it and collects no payment —
            # booked/ticketed here means "committed", not "paid".
            "payment_confirmed": False,
            "payment_method": "",
            "provider": block.get("title") or "",
            "provider_booking_id": commitment.provider_ref or "",
            "created_at": commitment.created_at.isoformat(),
            "updated_at": commitment.updated_at.isoformat(),
            "source": "trip_planner",
            "workspace_id": str(commitment.workspace_id),
        })

    return Response(results)


@api_view(["GET"])
@permission_classes([AllowAny])
def price_lookup(request):
    """
    GET /api/v1/planner/price-lookup/?service_type=hotel&date=YYYY-MM-DD&
        provider=<name>&destination=<city>

    Phase 2e (docs/planner-north-star-audit-and-vision.md) — a read-only
    price check for something NOT YET in the plan (e.g. a hotel search
    result in HotelCanvas), as opposed to `verify_block` above, which
    requires an existing block. Both are thin wrappers over the exact same
    `apps.reference.services.live_price.lookup_live_price` — this endpoint
    does not touch or duplicate that service's logic, and never fabricates
    a price: a miss returns 404, the same honest "couldn't find one"
    outcome `verify_block` already gives for a placed block.
    """
    get_planner_user(request)  # auth-enforced, result unused — matches other GETs here

    service_type = (request.query_params.get("service_type") or "").strip().lower()
    date_str = (request.query_params.get("date") or "").strip()
    if not service_type or not date_str:
        return Response({"detail": "service_type and date are required."}, status=status.HTTP_400_BAD_REQUEST)

    from apps.reference.services.live_price import lookup_live_price

    result = lookup_live_price(
        service_type=service_type,
        date_str=date_str,
        provider=request.query_params.get("provider", ""),
        code=request.query_params.get("code", ""),
        origin=request.query_params.get("origin", ""),
        destination=request.query_params.get("destination", ""),
    )
    if result is None:
        return Response(
            {"detail": "No live or historical price found for this item.", "found": False},
            status=status.HTTP_404_NOT_FOUND,
        )
    return Response({"found": True, "price": result})


@api_view(["POST"])
@permission_classes([AllowAny])
def batch_distances(request):
    """
    POST /api/v1/planner/distances/
    Body: { "pairs": [...], "mode": "driving" }
    """
    get_planner_user(request)
    pairs = request.data.get("pairs", [])
    mode = request.data.get("mode", "driving")
    if not pairs:
        return Response({"detail": "pairs list is required"}, status=status.HTTP_400_BAD_REQUEST)

    from apps.planner.services.distance_service import DistanceService
    results = DistanceService.fetch_batch_distances(pairs, mode=mode)
    return Response({"distances": results})


@api_view(["GET"])
@permission_classes([AllowAny])
def compare_transport_legs(request):
    """
    GET /api/planner/legs/compare/?origin=X&destination=Y&date=YYYY-MM-DD
    Flight/train/bus/cab compared for one inter-city leg — real durations
    from reference routes, real prices from lookup_live_price, a templated
    (not LLM-authored) WHY line. See apps.planner.services.transport_compare.
    """
    get_planner_user(request)
    origin = request.query_params.get("origin")
    destination = request.query_params.get("destination")
    date_str = request.query_params.get("date", "")
    travelers = int(request.query_params.get("travelers") or 1)

    if not origin or not destination:
        return Response({"detail": "origin and destination are required"}, status=status.HTTP_400_BAD_REQUEST)

    from apps.planner.services.transport_compare import compare_legs

    result = compare_legs(origin, destination, date_str, travelers=travelers)
    return Response(result)


class TripViewSet(viewsets.ModelViewSet):
    serializer_class = TripSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        user = get_planner_user(self.request)
        return (
            PlannerWorkspace.objects.filter(user=user, is_deleted=False)
            .annotate(chat_count_value=Count("chat_messages", distinct=True))
            .select_related("draft_state", "draft_state__destination_city", "trip")
            .order_by("-last_activity_at")
        )

    def perform_create(self, serializer):
        from apps.planner.models import TripDraftState
        workspace = serializer.save(user=get_planner_user(self.request))
        TripDraftState.objects.get_or_create(workspace=workspace)

    @action(detail=False, methods=["get"], url_path="upcoming")
    def upcoming(self, request):
        from datetime import date
        user = get_planner_user(request)
        today = date.today()
        workspaces = (
            PlannerWorkspace.objects.filter(user=user, is_deleted=False, status="booked", draft_state__start_date__gt=today)
            .select_related("draft_state", "draft_state__destination_city", "trip")
        )
        if not workspaces.exists():
            workspaces = (
                PlannerWorkspace.objects.filter(user=user, is_deleted=False)
                .exclude(draft_state__end_date__lt=today)
                .select_related("draft_state", "draft_state__destination_city", "trip")
            )
        return Response(self.get_serializer(workspaces, many=True).data)

    @action(detail=False, methods=["get"], url_path="past")
    def past(self, request):
        from datetime import date
        user = get_planner_user(request)
        today = date.today()
        workspaces = (
            PlannerWorkspace.objects.filter(user=user, is_deleted=False, draft_state__end_date__lt=today)
            .select_related("draft_state", "draft_state__destination_city", "trip")
        )
        return Response(self.get_serializer(workspaces, many=True).data)

