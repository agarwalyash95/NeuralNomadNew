from django.contrib.auth import get_user_model
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from apps.planner.models import PlannerWorkspace, PlanProposal, TripDraftState
from apps.planner.serializers import (
    ChatResponseSerializer,
    PlannerChatMessageSerializer,
    PlannerTripSerializer,
    PlannerWorkspaceSerializer,
    PlanProposalSerializer,
    TripDraftStateSerializer,
    TripSerializer,
)
from apps.planner.services.conversation_service import ConversationService


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
    from apps.knowledge.services.enrichment import needs_enrichment
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
            
            db_transaction.on_commit(lambda aid=activity.get("id"), t=title: 
                generate_block_tip_task.delay(str(trip.workspace.id), str(aid), t))

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
        print(f"propose_day_retitle failed (non-fatal): {exc}")


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
        print(f"detect_and_propagate_changes failed (non-fatal): {exc}")


def get_planner_user(request):
    if request.user and request.user.is_authenticated:
        return request.user

    user_model = get_user_model()
    user, created = user_model.objects.get_or_create(
        email="planner-demo@neuralnomad.local",
        defaults={
            "name": "Planner Demo",
            "phone": "",
            "is_active": True,
        },
    )
    if created:
        user.set_unusable_password()
        user.save(update_fields=["password"])
    return user


class PlannerWorkspaceViewSet(viewsets.ModelViewSet):
    serializer_class = PlannerWorkspaceSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        user = get_planner_user(self.request)
        return (
            PlannerWorkspace.objects.filter(user=user, is_deleted=False)
            .prefetch_related("chat_messages")
            .select_related("draft_state")
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
            messages = workspace.chat_messages.all()
            return Response(PlannerChatMessageSerializer(messages, many=True).data)

        message = request.data.get("message", "")
        structured_value = request.data.get("structured_value")
        if not message and not structured_value:
            return Response(
                {"detail": "message or structured_value is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        result = ConversationService().send_message(
            get_planner_user(request),
            message=message,
            workspace=workspace,
            structured_value=structured_value,
        )
        return Response(ChatResponseSerializer(result).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"], url_path="draft")
    def draft(self, request, pk=None):
        workspace = self.get_object()
        draft, _ = TripDraftState.objects.get_or_create(workspace=workspace)
        return Response(TripDraftStateSerializer(draft).data)

    @action(detail=True, methods=["post", "get", "patch"], url_path="plan")
    def plan(self, request, pk=None):
        workspace = self.get_object()
        service = ConversationService()

        if request.method == "POST":
            # ?sync=1 keeps the old blocking single-request path (tests,
            # rollback valve). Default is the background pipeline + polling.
            if request.query_params.get("sync") == "1":
                try:
                    trip = service.create_plan(workspace)
                except ValueError as exc:
                    return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
                return Response(PlannerTripSerializer(trip).data, status=status.HTTP_201_CREATED)

            draft = getattr(workspace, "draft_state", None)
            if draft is None or not draft.is_ready_for_plan:
                return Response(
                    {"detail": "Destination and travel dates are required before creating a plan."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            from django.db import transaction as db_transaction

            from apps.planner.services.plan_generation import (
                serialize_job,
                spawn_generation_thread,
                start_generation_job,
            )

            job, created = start_generation_job(workspace)
            if created:
                # T3.3: prefer Celery (survives worker restarts, observable
                # via Flower); fall back to the bare thread if Celery/the
                # broker isn't available (e.g. dev without a worker running).
                # ATOMIC_REQUESTS wraps this view — dispatch only after the
                # job row is committed and visible to the task/thread.
                def _dispatch():
                    try:
                        from apps.planner.tasks import run_generation_job_task
                        run_generation_job_task.delay(job.id)
                    except Exception:
                        spawn_generation_thread(job.id)
                db_transaction.on_commit(_dispatch)
            return Response(serialize_job(job), status=status.HTTP_202_ACCEPTED)

        if not hasattr(workspace, "trip"):
            return Response({"detail": "Plan has not been created yet."}, status=status.HTTP_404_NOT_FOUND)

        if request.method == "PATCH":
            old_days = list(workspace.trip.days or [])
            serializer = PlannerTripSerializer(workspace.trip, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            workspace.is_modified = True
            workspace.save(update_fields=["is_modified", "updated_at"])
            _trigger_enrichment_for_trip_blocks(workspace.trip)
            _maybe_propose_day_retitle(workspace, old_days)
            _maybe_propagate_plan_changes(workspace, old_days)
            return Response(serializer.data)

        return Response(PlannerTripSerializer(workspace.trip).data)

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
        workspace.save(update_fields=["status", "is_modified", "updated_at"])
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
        workspace.save(update_fields=["status", "is_modified", "updated_at"])

        # Fire-and-forget: feeds this traveler's *next* trip via the
        # _compose_days context injection, not this one. A failure here must
        # never block the booking response itself.
        try:
            from apps.planner.tasks import infer_traveler_facts

            infer_traveler_facts.delay(str(workspace.id))
        except Exception as exc:
            print(f"infer_traveler_facts dispatch failed (non-fatal): {exc}")

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

        return Response({"verified": True, "block": block, "price": result})

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

        after_days = (proposal.diff or {}).get("after", {}).get("days", [])
        if not after_days:
            return Response({"detail": "Proposal has no applicable diff."}, status=status.HTTP_400_BAD_REQUEST)

        # Replace affected days by day_number, atomically
        days_by_number = {str(d.get("day_number")): d for d in after_days}
        new_days = [
            days_by_number.get(str(day.get("day_number")), day)
            for day in (trip.days or [])
        ]
        payload = upcast_trip_payload(
            {"currency_code": trip.currency_code, "days": new_days, "cities": trip.cities or []},
            default_currency=trip.currency_code or "INR",
        )
        trip.days = payload["days"]
        trip.save()

        workspace.is_modified = True
        workspace.save(update_fields=["is_modified", "updated_at"])

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
                print(f"Rejection fact recording failed (non-fatal): {exc}")

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

        from apps.knowledge.models import PlanInsightDismissal
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

        from apps.knowledge.models import PlanInsightDismissal

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

                elapsed = 0
                for message in pubsub.listen():
                    if message.get("type") == "message":
                        yield _sse("update", {"type": "workspace_updated"})
                    # Periodic ping keeps the connection alive through proxies
                    # that time out idle streams — get_message with a timeout
                    # lets us interleave pings without blocking forever on listen().
                    elapsed += 1
                    if elapsed % 30 == 0:
                        yield _sse("ping", {"type": "ping"})
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

_SLOT_CHIPS = {
    "destination": "Set a destination",
    "travel_dates": "Pick my dates",
    "origin": "Set departure city",
    "optional_details": "Add preferences",
    "nearby_cities": "Show nearby escapes",
}


def _suggested_replies(result):
    """Deterministic next-step chips from what the draft still needs —
    the proactive-planner feel without inventing anything."""
    chips = [_SLOT_CHIPS[slot] for slot in (result.get("missing_slots") or []) if slot in _SLOT_CHIPS]
    if result.get("ready_for_plan"):
        chips.insert(0, "Create my plan ✨")
    return chips[:4]


def _sse(event, payload):
    import json
    from rest_framework.utils.encoders import JSONEncoder

    return f"event: {event}\ndata: {json.dumps(payload, cls=JSONEncoder)}\n\n"


def _stream_chat_response(user, message, workspace, structured_value):
    """
    One SSE stream per turn. The engine call runs in its own transaction
    (the request itself is non-atomic so the connection isn't held open for
    the stream's lifetime); the reply is then delivered as token chunks so
    the client renders progressively, followed by widgets + done.
    """
    import time

    from django.db import transaction as db_transaction

    try:
        with db_transaction.atomic():
            result = ConversationService().send_message(
                user, message=message, workspace=workspace, structured_value=structured_value
            )
    except Exception as exc:
        yield _sse("error", {"detail": str(exc)[:300]})
        return

    assistant = result["assistant_message"]
    meta = assistant.metadata or {}

    yield _sse("state", {
        "workspace_id": str(result["workspace"].id),
        "detected_intent": meta.get("detected_intent"),
        "confidence_score": meta.get("confidence_score"),
        "ready_for_plan": result["ready_for_plan"],
        "missing_slots": result["missing_slots"],
        "user_message_id": str(result["user_message"].id),
    })

    # Word-chunked delivery of the persisted reply (~4 words per event).
    words = (assistant.message or "").split(" ")
    for i in range(0, len(words), 4):
        yield _sse("token", {"t": " ".join(words[i:i + 4]) + (" " if i + 4 < len(words) else "")})
        time.sleep(0.03)

    yield _sse("widgets", assistant.widgets or [])
    yield _sse("done", {
        "message_id": str(assistant.id),
        "workspace": PlannerWorkspaceSerializer(result["workspace"]).data,
        "ready_for_plan": result["ready_for_plan"],
        "missing_slots": result["missing_slots"],
        "metadata": meta,
        "suggested_replies": _suggested_replies(result),
    })


def _chat_stream_response(request, workspace):
    from django.http import StreamingHttpResponse

    message = request.data.get("message", "")
    structured_value = request.data.get("structured_value")
    if not message and not structured_value:
        return Response(
            {"detail": "message or structured_value is required"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    response = StreamingHttpResponse(
        _stream_chat_response(get_planner_user(request), message, workspace, structured_value),
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

    result = ConversationService().send_message(
        get_planner_user(request),
        message=message,
        structured_value=structured_value,
    )
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


@api_view(["POST"])
@permission_classes([AllowAny])
def batch_distances(request):
    """
    POST /api/v1/planner/distances/
    Body: { "pairs": [...], "mode": "driving" }
    """
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
            .prefetch_related("chat_messages")
            .select_related("draft_state", "draft_state__destination_city", "trip")
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

