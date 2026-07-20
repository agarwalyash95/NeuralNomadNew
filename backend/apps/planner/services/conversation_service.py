import logging
from copy import deepcopy
from datetime import timedelta

from django.db import transaction
from django.utils import timezone

logger = logging.getLogger(__name__)

from apps.planner.models import (
    PlannerChatMessage, PlannerTrip, PlannerTripOriginal,
    PlannerWorkspace, TripDraftState,
)
# pyrefly: ignore [missing-import]
from apps.planner.services.conversation_engine import ConversationEngine


class ConversationService:
    def __init__(self):
        self.engine = ConversationEngine()

    def send_message(self, user, message, workspace=None, structured_value=None, turn_id=None):
        from django.db.models import F
        from apps.planner.models import PlannerQuestionBank, PlannerChatMessage

        existing_user_message = None
        if turn_id:
            existing_user_message = PlannerChatMessage.objects.select_related("workspace").filter(
                turn_id=turn_id, workspace__user=user, role=PlannerChatMessage.ROLE_USER
            ).first()
            if existing_user_message:
                workspace = existing_user_message.workspace
                existing_assistant = workspace.chat_messages.filter(
                    role=PlannerChatMessage.ROLE_ASSISTANT,
                    metadata__turn_id=turn_id,
                ).first()
                if existing_assistant:
                    draft = workspace.draft_state
                    return {
                        "workspace": workspace, "draft_state": draft,
                        "user_message": existing_user_message, "assistant_message": existing_assistant,
                        "ready_for_plan": draft.is_ready_for_plan,
                        "missing_slots": draft.missing_slots(), "command_results": [],
                    }

        workspace = workspace or self._create_workspace(user, message)
        workspace = PlannerWorkspace.objects.get(pk=workspace.pk)
        base_revision = workspace.revision
        draft, _ = TripDraftState.objects.get_or_create(workspace=workspace)
        draft_before = {
            "destination_text": draft.destination_text,
            "destination_city_id": draft.destination_city_id,
            "start_date": draft.start_date,
            "end_date": draft.end_date,
            "adults": draft.adults,
            "children": draft.children,
            "infants": draft.infants,
            "budget_tier": draft.budget_tier,
            "budget_amount": draft.budget_amount,
            "budget_currency": draft.budget_currency,
            "interests": deepcopy(draft.interests or []),
            "intent": draft.intent,
            "metadata": deepcopy(draft.metadata or {}),
        }

        from django.conf import settings as dj_settings

        question_bank_enabled = getattr(dj_settings, "PLANNER_QUESTION_BANK_ENABLED", False)

        # 1. Track preceding widget interaction and update success count
        # (CH-08: flag-gated â€” off by default until its value is measured)
        if structured_value and question_bank_enabled:
            field = structured_value.get("field")
            widget_type_mapped = None
            if field == "destination":
                widget_type_mapped = "destination_search"
            elif field == "origin":
                widget_type_mapped = "origin_search"
            elif field == "travel_dates":
                widget_type_mapped = "date_range_picker"
            elif field == "optional_trip_details":
                widget_type_mapped = "optional_trip_details"
            elif field == "add_nearby_city":
                widget_type_mapped = "nearby_cities_recommendation"
            elif field == "cluster_submit":
                # A cluster the user actually confirmed â€” count it as success
                # (docs/ai-chat-implementation-plan.md Phase 1). A cluster_skip
                # is a decline, not a success, so it deliberately isn't tracked
                # here â€” that would reinforce a question the user skipped.
                cluster_name = (structured_value.get("value") or {}).get("cluster")
                widget_type_mapped = f"cluster_{cluster_name}" if cluster_name else None

            if widget_type_mapped:
                last_assistant_msg = workspace.chat_messages.filter(
                    role=PlannerChatMessage.ROLE_ASSISTANT
                ).order_by("-created_at").first()
                if last_assistant_msg:
                    # Update success count for the exact intent + destination combination
                    PlannerQuestionBank.objects.filter(
                        intent=draft.intent or "full_trip",
                        destination_text=draft.destination_text or "",
                        widget_type=widget_type_mapped,
                        question_text=last_assistant_msg.message
                    ).update(success_count=F("success_count") + 1)
                    # Also try wildcard destination entry
                    PlannerQuestionBank.objects.filter(
                        intent=draft.intent or "full_trip",
                        destination_text="*",
                        widget_type=widget_type_mapped,
                        question_text=last_assistant_msg.message
                    ).update(success_count=F("success_count") + 1)

        user_message = existing_user_message or PlannerChatMessage.objects.create(
            workspace=workspace, role=PlannerChatMessage.ROLE_USER,
            message=message, turn_id=turn_id,
        )

        history = list(workspace.chat_messages.filter(
            created_at__lt=user_message.created_at
        ).order_by("created_at"))

        from apps.planner.services.turn_intent import is_answer_only_turn, is_browse_only_turn

        # A browse/lookup turn ("hotels in Goa", "how's the weather") is
        # answer-only too (audit CH-12): the capability card still surfaces
        # via message metadata, but the draft snapshot is restored so a
        # browsing mention can never hijack destination/dates.
        answer_only = is_answer_only_turn(message, structured_value) or is_browse_only_turn(
            message, structured_value
        )
        # LLM calls happen outside a database transaction. The detached draft
        # is committed only after a revision-CAS below.
        result = self.engine.process(
            draft, message, history=history, structured_value=structured_value, persist=False
        )

        targeted_scopes = []
        if answer_only:
            # The model supplies the answer, never the state transition. Restore
            # the canonical snapshot even if extraction returned tempting slot
            # values from a question such as "Is October rainy in Goa?".
            for field, value in draft_before.items():
                if field == "destination_city_id":
                    draft.destination_city_id = value
                else:
                    setattr(draft, field, deepcopy(value))
            result.widgets = []
            result.commands = []
            result.ready = draft.is_ready_for_plan
            result.missing_slots = draft.missing_slots()
        else:
            # Canonical trip synchronization is deferred to the short
            # compare-and-swap transaction after the model call completes
            # (DEAD-01: this branch used to contain a second, unreachable
            # copy of the targeted_scopes reply-annotation logic below —
            # `targeted_scopes = []` immediately followed by `if
            # targeted_scopes:` could never be True. The real logic runs
            # once, after _commit_turn_draft returns the actual scopes.)
            pass

        # Sync detected intent back to draft if engine changed it
        if not answer_only and result.detected_intent and result.detected_intent != draft.intent:
            draft.intent = result.detected_intent

        from apps.planner.services.intelligence.clusters import pending_clusters as _pending_clusters

        workspace, draft, targeted_scopes = self._commit_turn_draft(
            workspace,
            draft,
            expected_revision=base_revision,
            draft_before=draft_before,
            sync_trip=not answer_only,
        )
        if targeted_scopes:
            scope_labels = {
                "rooms": "rooms", "transport_capacity": "vehicle capacity",
                "prices": "live prices", "availability": "availability",
                "weather": "weather", "transport": "transport options",
                "connectors": "travel connectors", "daily_density": "daily pace",
                "buffers": "travel buffers", "day_structure": "day structure",
                "destination": "destination plan", "all_days": "daily itinerary",
            }
            visible = [scope_labels.get(scope, scope.replace("_", " ")) for scope in targeted_scopes[:3]]
            detail = ", ".join(visible)
            if len(targeted_scopes) > 3:
                detail += f", and {len(targeted_scopes) - 3} more"
            result.reply = (
                f"{result.reply.rstrip()} The change is saved. Affected details—{detail}—are marked "
                "for review in the Plan Canvas, while selected and booked items stay protected."
            )

        draft_meta = draft.metadata or {}
        assistant_message = PlannerChatMessage.objects.create(
            workspace=workspace,
            role=PlannerChatMessage.ROLE_ASSISTANT,
            message=result.reply,
            widgets=result.widgets,
            commands=result.commands,
            metadata={
                "extraction_tier": result.extraction_tier,
                "ready_for_plan": result.ready,
                "missing_slots": result.missing_slots,
                "detected_intent": result.detected_intent,
                "confidence_score": draft_meta.get("confidence_score", 50),
                "confidence_explanation": draft_meta.get("confidence_explanation", ""),
                "intent_confidence": getattr(result, "intent_confidence", 70),
                "mode": getattr(result, "mode", "gathering"),
                # Additive (docs/ai-chat-implementation-plan.md Phase 0/2/3) â€” browse/live
                # capability cards for this turn. Stored in metadata (no schema migration)
                # the same way confidence_score already rides here.
                "capabilities": getattr(result, "capabilities", []),
                # Additive â€” cluster steps still ahead of the user (drives the
                # "step N of 5" progress UI + the next-pending-cluster chip)
                # and the âœ“/â€¢ confidence checklist (score/explanation kept
                # above for back-compat, factors are the new structured form).
                "pending_clusters": _pending_clusters(draft),
                "confidence_factors": draft_meta.get("confidence_factors", []),
                # Journey Feed (intelligence/journey_feed.py) â€” one ambient
                # "Did you knowâ€¦" fact, or None most turns.
                "journey_fact": getattr(result, "journey_fact", None),
                "revision": workspace.revision,
                "turn_action": "answer_only" if answer_only else "update_trip",
                "changed_sections": targeted_scopes,
                "turn_id": turn_id,
                "question_intent": getattr(result, "question_intent", None),
            },
        )

        # OBS-01 (checklist 0.1): one structured line per turn â€” prompted step
        # vs emitted widgets is the CH-01 desync signal.
        from apps.planner.services.turn_log import log_turn

        log_turn(
            workspace_id=workspace.id,
            prompted_step=getattr(result, "prompted_step", None),
            emitted_widgets=[w.get("type") for w in (result.widgets or [])],
            answer_only=answer_only,
            extracted_fields=getattr(result, "extracted_fields", []),
            extraction_tier=result.extraction_tier,
            detected_intent=result.detected_intent,
            ready_for_plan=result.ready,
        )

        # 2. Record new clarification questions/widgets in the PlannerQuestionBank
        # (intent-aware; CH-08: flag-gated, off by default)
        for widget in (result.widgets if question_bank_enabled else []):
            widget_type = widget.get("type")
            if widget_type:
                q_bank_entry, created = PlannerQuestionBank.objects.get_or_create(
                    intent=draft.intent or "full_trip",
                    destination_text=draft.destination_text or "*",
                    widget_type=widget_type,
                    question_text=result.reply,
                    defaults={
                        "missing_slots": result.missing_slots,
                        "widget_data": widget.get("data", {}),
                        "occurrence_count": 1,
                    }
                )
                if not created:
                    q_bank_entry.occurrence_count = F("occurrence_count") + 1
                    q_bank_entry.save(update_fields=["occurrence_count"])

        # Chat-edit intents (docs/planner-product-audit-2026-07.md CH1;
        # Plan Evolution docs/ai-chat-implementation-plan.md Phase 8.2;
        # docs/planner-north-star-audit-and-vision.md Phase 1): narrow,
        # regex-scoped detectors, additive only â€” never alter the reply
        # above, never raise into this transaction. Each is independently
        # scoped/disjoint (see chat_edit_intents.py docstrings); running
        # all of them is safe even if more than one matches the same
        # message, since each files its own separately-titled, separately
        # de-duped proposal the user reviews before anything is applied.
        from apps.planner.services.chat_edit_intents import (
            propose_add_place_from_chat,
            propose_add_rest_from_chat,
            propose_extend_stay_from_chat,
            propose_hotel_return_from_chat,
            propose_move_block_from_chat,
            propose_remove_block_from_chat,
            propose_remove_day_from_chat,
            propose_remove_last_day_from_chat,
            propose_retime_from_chat,
            propose_swap_block_from_chat,
        )

        propose_retime_from_chat(workspace, message)
        propose_extend_stay_from_chat(workspace, message)
        propose_remove_last_day_from_chat(workspace, message)
        propose_remove_day_from_chat(workspace, message)
        propose_add_rest_from_chat(workspace, message)
        propose_hotel_return_from_chat(workspace, message)
        propose_remove_block_from_chat(workspace, message)
        propose_move_block_from_chat(workspace, message)
        propose_swap_block_from_chat(workspace, message)
        propose_add_place_from_chat(workspace, message)

        # Progressive planning (Phase 8.1): once destination + dates are
        # known, warm phases 1-2 of the generation pipeline in the
        # background so Create Plan feels near-instant. Throttled,
        # best-effort, never raises.
        if draft.destination_text and draft.start_date and draft.end_date:
            from apps.planner.services.intelligence import progressive as _progressive

            _progressive.trigger_warm_plan(workspace)

        return {
            "workspace": workspace,
            "draft_state": draft,
            "user_message": user_message,
            "assistant_message": assistant_message,
            "ready_for_plan": result.ready,
            "missing_slots": result.missing_slots,
            "command_results": [],
        }

    @transaction.atomic
    def _commit_turn_draft(
        self, workspace, draft, *, expected_revision, draft_before, sync_trip
    ):
        locked_workspace = PlannerWorkspace.objects.select_for_update().get(pk=workspace.pk)
        if locked_workspace.revision != expected_revision:
            raise ValueError("planner_turn_conflict: workspace changed while the response was being prepared")
        persisted = TripDraftState.objects.select_for_update().get(workspace=locked_workspace)
        for field in TripDraftState._meta.concrete_fields:
            if field.name in {"id", "workspace", "created_at", "updated_at"}:
                continue
            setattr(persisted, field.attname, deepcopy(getattr(draft, field.attname)))
        persisted.save()
        targeted_scopes = []
        if sync_trip:
            from apps.planner.services.plan_mutations import sync_draft_to_trip

            targeted_scopes = sync_draft_to_trip(locked_workspace, draft_before, persisted)
        locked_workspace.last_activity_at = timezone.now()
        locked_workspace.revision += 1
        locked_workspace.save(update_fields=["last_activity_at", "revision", "updated_at"])
        return locked_workspace, persisted, targeted_scopes


    def create_plan(self, workspace):
        """Development/test sync wrapper around the single modern pipeline."""
        from apps.planner.models import PlanGenerationJob
        from apps.planner.services.plan_generation import run_generation_job, start_generation_job

        workspace = PlannerWorkspace.objects.get(pk=workspace.pk)
        if not workspace.draft_state.is_ready_for_plan:
            raise ValueError("Source, destination, inclusive dates, and traveler breakdown are required before creating a plan.")
        job, created = start_generation_job(workspace)
        if created or job.status in (PlanGenerationJob.STATUS_QUEUED, PlanGenerationJob.STATUS_RUNNING):
            run_generation_job(job.id, manage_connections=False)
        job.refresh_from_db()
        if job.status != PlanGenerationJob.STATUS_DONE:
            raise ValueError(job.error or "Plan generation failed.")
        return PlannerTrip.objects.get(workspace=workspace)
    def _record_traveler_facts(self, workspace, draft):
        from apps.planner.models import TravelerProfile

        profile, _ = TravelerProfile.objects.get_or_create(user=workspace.user)

        origin = draft.origin_text or (draft.metadata or {}).get("origin")
        if origin:
            profile.upsert_fact("home_origin", origin, source_trip=workspace.id)

        party = draft.adults + draft.children
        if party > 0:
            profile.upsert_fact("typical_party_size", party, source_trip=workspace.id)

        if draft.budget_tier:
            profile.upsert_fact("budget_tier", draft.budget_tier, source_trip=workspace.id)
        if draft.budget_amount:
            profile.upsert_fact(
                "recent_trip_budget",
                {"amount": float(draft.budget_amount), "currency": draft.budget_currency},
                source_trip=workspace.id,
            )

        if draft.interests:
            profile.upsert_fact("interests", draft.interests, source_trip=workspace.id)

    def _create_workspace(self, user, message):
        return PlannerWorkspace.objects.create(
            user=user,
            title=self._title_from_first_message(message),
        )

    def _title_from_first_message(self, message):
        clean = " ".join(message.split())
        if not clean:
            return "New Trip"
        return clean[:57] + "..." if len(clean) > 60 else clean
