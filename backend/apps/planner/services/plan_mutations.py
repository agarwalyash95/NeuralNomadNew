"""Transactional mutation boundary for the canonical planner trip.

Chat/widget draft changes, manual Plan Canvas edits, and Helper Canvas
selections all converge here.  The workspace revision is the compare-and-
swap token shared by REST and SSE clients; a stale caller receives a 409 and
the last valid plan is left untouched.
"""

import logging
from copy import deepcopy
from dataclasses import asdict
from datetime import date
from typing import Any, Dict, Iterable, Optional
from uuid import uuid4

from django.db import transaction
from django.utils import timezone

from apps.planner.models import PlannerTrip, PlannerWorkspace
from apps.planner.services.block_schema import find_block, upcast_activity, upcast_trip_payload
from apps.planner.services.validation import validate_plan

logger = logging.getLogger(__name__)


class RevisionConflict(Exception):
    def __init__(self, current_revision: int):
        self.current_revision = current_revision
        super().__init__(f"Plan is now at revision {current_revision}.")


class PlanMutationError(Exception):
    def __init__(self, detail: str, *, code: str = "invalid_plan", violations=None):
        self.detail = detail
        self.code = code
        self.violations = violations or []
        super().__init__(detail)


def _error_keys(days: Iterable[Dict[str, Any]]) -> set[tuple]:
    report = validate_plan(list(days))
    return {
        (v.code, str(v.day_number), str(v.block_id))
        for v in report.violations
        if v.severity == "error"
    }


def _validate_stable_ids(days, cities) -> None:
    seen: set[str] = set()
    missing = []
    duplicates = []
    for day in days or []:
        day_id = day.get("id")
        if not day_id:
            missing.append(f"day:{day.get('day_number')}")
        for block in day.get("activities") or []:
            block_id = str(block.get("id") or "")
            if not block_id:
                missing.append(f"block:{block.get('title') or '?'}")
            elif block_id in seen:
                duplicates.append(block_id)
            seen.add(block_id)
    for city in cities or []:
        transit = city.get("transitToNext")
        if isinstance(transit, dict):
            block_id = str(transit.get("id") or "")
            if not block_id:
                missing.append(f"transit:{city.get('name') or '?'}")
            elif block_id in seen:
                duplicates.append(block_id)
            seen.add(block_id)
    if missing or duplicates:
        raise PlanMutationError(
            "Every plan section and item must keep a stable, unique ID.",
            code="invalid_stable_ids",
            violations={"missing": missing, "duplicates": sorted(set(duplicates))},
        )


def _stabilize_ids(old_days, new_days, cities) -> None:
    """Upcast legacy JSON once so every subsequent revision keeps its IDs."""
    old_by_number = {str(d.get("day_number")): d for d in old_days or []}
    for day in new_days or []:
        old_day = old_by_number.get(str(day.get("day_number"))) or {}
        day.setdefault("id", old_day.get("id") or f"day-{uuid4()}")
        old_blocks = old_day.get("activities") or []
        for index, block in enumerate(day.get("activities") or []):
            old_id = old_blocks[index].get("id") if index < len(old_blocks) else None
            block.setdefault("id", old_id or f"block-{uuid4()}")
    for city in cities or []:
        transit = city.get("transitToNext")
        if isinstance(transit, dict):
            transit.setdefault("id", f"transit-{uuid4()}")


def _validate_candidate(old_days, new_days, new_cities) -> None:
    _stabilize_ids(old_days, new_days, new_cities)
    _validate_stable_ids(new_days, new_cities)
    _validate_commitment_hierarchy(old_days, new_days)
    old_errors = _error_keys(old_days or [])
    report = validate_plan(new_days or [])
    introduced = [
        asdict(v)
        for v in report.violations
        if v.severity == "error" and (v.code, str(v.day_number), str(v.block_id)) not in old_errors
    ]
    if introduced:
        raise PlanMutationError(
            "The change would make the itinerary invalid. The previous plan was preserved.",
            code="plan_validation_failed",
            violations=introduced,
        )


def _validate_commitment_hierarchy(old_days, new_days) -> None:
    """Lower-priority edits cannot silently destroy committed plan items."""
    old_blocks = {
        str(block.get("id")): block
        for day in old_days or [] for block in day.get("activities") or []
        if block.get("id")
    }
    new_blocks = {
        str(block.get("id")): block
        for day in new_days or [] for block in day.get("activities") or []
        if block.get("id")
    }
    for block_id, old in old_blocks.items():
        metadata = old.get("metadata") or {}
        status = str(old.get("block_status") or old.get("status") or "")
        level = None
        if status == "booked":
            level = "booked"
        elif old.get("locked") or metadata.get("locked") or old.get("pinned") or metadata.get("pinned"):
            level = "locked"
        elif status in {"selected", "accepted"}:
            level = "accepted"
        if not level:
            continue
        replacement = new_blocks.get(block_id)
        if replacement is None or replacement != old:
            code = "booked_item" if level == "booked" else "locked_item"
            raise PlanMutationError(
                f"The {level} item '{old.get('title') or block_id}' must be explicitly unlocked or cancelled first.",
                code=code,
            )


def _check_revision(workspace: PlannerWorkspace, expected_revision: Optional[int]) -> None:
    # Legacy clients may omit the token while rolling out. New clients always
    # send it; when present it is strict compare-and-swap.
    if expected_revision is not None and int(expected_revision) != workspace.revision:
        raise RevisionConflict(workspace.revision)


def _mutation_was_applied(trip: PlannerTrip, mutation_id: Optional[str]) -> bool:
    if not mutation_id:
        return False
    return mutation_id in ((trip.metadata or {}).get("applied_mutation_ids") or [])


def _record_mutation(trip: PlannerTrip, mutation_id: Optional[str], audit: Dict[str, Any]) -> None:
    metadata = deepcopy(trip.metadata or {})
    ids = list(metadata.get("applied_mutation_ids") or [])
    if mutation_id:
        ids.append(mutation_id)
    metadata["applied_mutation_ids"] = ids[-100:]
    log = list(metadata.get("mutation_log") or [])
    log.append({**audit, "at": timezone.now().isoformat()})
    metadata["mutation_log"] = log[-100:]
    trip.metadata = metadata


def _resolve_regeneration_scopes(trip: PlannerTrip, resolved: set[str], *, reason: str) -> None:
    """Resolve only scopes a committed mutation actually satisfies."""
    metadata = deepcopy(trip.metadata or {})
    state = deepcopy(metadata.get("targeted_regeneration") or {})
    pending = set(state.get("scopes") or [])
    completed = pending.intersection(resolved)
    if not completed:
        return
    remaining = pending - completed
    history = list(state.get("resolution_history") or [])
    history.append({
        "scopes": sorted(completed),
        "reason": reason,
        "at": timezone.now().isoformat(),
    })
    state["scopes"] = sorted(remaining)
    state["resolved_scopes"] = sorted(set(state.get("resolved_scopes") or []).union(completed))
    state["resolution_history"] = history[-30:]
    state["status"] = "pending" if remaining else "complete"
    if not remaining:
        state["completed_at"] = timezone.now().isoformat()
    metadata["targeted_regeneration"] = state
    trip.metadata = metadata


def _finish(workspace: PlannerWorkspace, trip: PlannerTrip) -> None:
    workspace.revision += 1
    workspace.is_modified = True
    workspace.last_activity_at = timezone.now()
    workspace.save(update_fields=["revision", "is_modified", "last_activity_at", "updated_at"])
    trip.save()


def _iter_blocks(days, cities):
    for day in days or []:
        for block in day.get("activities") or []:
            yield block
    for city in cities or []:
        transit = city.get("transitToNext")
        if isinstance(transit, dict):
            yield transit


def _parse_iso(value):
    if isinstance(value, date):
        return value
    try:
        return date.fromisoformat(str(value))
    except (TypeError, ValueError):
        return None


def sync_draft_to_trip(workspace: PlannerWorkspace, before: Dict[str, Any], draft) -> list[str]:
    """Apply only deterministic consequences of a chat/widget correction.

    User-selected/booked blocks are preserved. Date- or party-sensitive live
    facts are invalidated for later enrichment instead of fabricated, and the
    precise regeneration scopes are recorded on the trip.
    """
    try:
        trip = PlannerTrip.objects.select_for_update().get(workspace=workspace, is_deleted=False)
    except PlannerTrip.DoesNotExist:
        return []

    old_days = deepcopy(trip.days or [])
    days = deepcopy(old_days)
    cities = deepcopy(trip.cities or [])
    scopes: set[str] = set()
    invalidated: set[str] = set()

    old_start, new_start = before.get("start_date"), draft.start_date
    old_end, new_end = before.get("end_date"), draft.end_date
    dates_changed = (old_start, old_end) != (new_start, new_end)
    party_changed = (
        before.get("adults"), before.get("children"), before.get("infants")
    ) != (draft.adults, draft.children, draft.infants)
    old_meta = before.get("metadata") or {}
    new_meta = draft.metadata or {}
    pace_changed = old_meta.get("trip_pace") != new_meta.get("trip_pace")
    mode_changed = old_meta.get("preferred_mode") != new_meta.get("preferred_mode")
    destination_changed = before.get("destination_text") != draft.destination_text

    # A move with unchanged duration can safely shift structured dates without
    # recomposing any selected content. Duration changes are queued as a
    # day-structure scope so locked/booked days are never silently dropped.
    if dates_changed:
        scopes.update({"dates", "weather", "prices", "availability", "transport"})
        invalidated.update({"weather", "live_prices", "availability", "opening_status"})
        old_start_date, new_start_date = _parse_iso(old_start), _parse_iso(new_start)
        old_duration = (old_end - old_start).days if old_start and old_end else None
        new_duration = (new_end - new_start).days if new_start and new_end else None
        if old_start_date and new_start_date and old_duration == new_duration:
            delta = new_start_date - old_start_date
            for day in days:
                parsed = _parse_iso(day.get("date"))
                if parsed:
                    day["date"] = (parsed + delta).isoformat()
                day.pop("forecast", None)
                day.pop("weather", None)
                day["weather_status"] = "needs_refresh"
            for city in cities:
                for field in ("arrival_date", "departure_date"):
                    parsed = _parse_iso(city.get(field))
                    if parsed:
                        city[field] = (parsed + delta).isoformat()
        else:
            scopes.add("day_structure")

    if party_changed:
        scopes.update({"rooms", "transport_capacity", "prices"})
        invalidated.update({"live_prices", "availability"})
    if pace_changed:
        scopes.update({"daily_density", "buffers"})
    if mode_changed:
        scopes.update({"transport", "connectors"})
    if destination_changed:
        scopes.update({"destination", "all_days"})

    if not scopes:
        return []

    if dates_changed or party_changed:
        for block in _iter_blocks(days, cities):
            if block.get("status") == "booked" or block.get("block_status") == "booked":
                continue
            metadata = deepcopy(block.get("metadata") or {})
            metadata["requires_live_refresh"] = sorted(invalidated)
            block["metadata"] = metadata
            cost = block.get("cost")
            provenance = (cost or {}).get("provenance") or {}
            if isinstance(cost, dict) and provenance.get("tier") == "verified":
                cost = deepcopy(cost)
                cost["amount"] = None
                cost["provenance"] = {
                    "tier": "suggested",
                    "source": "invalidated_by_trip_change",
                    "basis": "Dates or traveler count changed; re-check required.",
                }
                block["cost"] = cost

    metadata = deepcopy(trip.metadata or {})
    metadata["travelers"] = draft.adults + draft.children + draft.infants
    metadata["traveler_breakdown"] = {
        "adults": draft.adults,
        "children": draft.children,
        "infants": draft.infants,
    }
    metadata["targeted_regeneration"] = {
        "status": "pending",
        "scopes": sorted(scopes),
        "invalidated": sorted(invalidated),
        "preserve": ["selected", "booked", "locked", "rejected"],
        "requested_at": timezone.now().isoformat(),
    }
    trip.days = days
    trip.cities = cities
    trip.metadata = metadata
    _validate_candidate(old_days, days, cities)
    trip.save()
    return sorted(scopes)


@transaction.atomic
def patch_trip(
    workspace_id,
    payload: Dict[str, Any],
    *,
    expected_revision: Optional[int] = None,
    mutation_id: Optional[str] = None,
    source: str = "manual_edit",
) -> PlannerTrip:
    """Apply a validated partial trip PATCH at the canonical lock boundary."""
    workspace = PlannerWorkspace.objects.select_for_update().get(id=workspace_id, is_deleted=False)
    trip = PlannerTrip.objects.select_for_update().get(workspace=workspace, is_deleted=False)
    _check_revision(workspace, expected_revision)
    if _mutation_was_applied(trip, mutation_id):
        return trip

    from apps.planner.serializers import PlannerTripSerializer

    clean_payload = {k: v for k, v in payload.items() if k not in {"revision", "expected_revision", "mutation_id"}}
    candidate_days = deepcopy(clean_payload.get("days", trip.days or []))
    candidate_cities = deepcopy(clean_payload.get("cities", trip.cities or []))
    upcast_trip_payload(
        {"days": candidate_days, "cities": candidate_cities, "currency_code": clean_payload.get("currency_code", trip.currency_code)},
        default_currency=clean_payload.get("currency_code", trip.currency_code) or "INR",
    )
    _validate_candidate(trip.days or [], candidate_days, candidate_cities)
    clean_payload["days"] = candidate_days
    clean_payload["cities"] = candidate_cities

    serializer = PlannerTripSerializer(trip, data=clean_payload, partial=True)
    serializer.is_valid(raise_exception=True)
    trip = serializer.save()
    _record_mutation(trip, mutation_id, {"type": "patch", "source": source})
    _finish(workspace, trip)
    return trip


@transaction.atomic
def select_item(
    workspace_id,
    *,
    target_block_id: str,
    selected_item: Dict[str, Any],
    expected_revision: Optional[int],
    mutation_id: Optional[str] = None,
    provider: str = "",
    selected_id: str = "",
    provenance: str = "live_api",
) -> PlannerTrip:
    """Persist a Helper Canvas selection immediately, preserving the slot ID."""
    allowed_provenance = {
        "user_input", "widget", "manual_edit", "database", "cached_api",
        "live_api", "model_knowledge", "model_inference",
    }
    if provenance not in allowed_provenance:
        raise PlanMutationError("Unsupported data provenance.", code="invalid_provenance")
    workspace = PlannerWorkspace.objects.select_for_update().get(id=workspace_id, is_deleted=False)
    trip = PlannerTrip.objects.select_for_update().get(workspace=workspace, is_deleted=False)
    _check_revision(workspace, expected_revision)
    if _mutation_was_applied(trip, mutation_id):
        return trip

    days = deepcopy(trip.days or [])
    cities = deepcopy(trip.cities or [])
    shadow = type("TripShadow", (), {"days": days, "cities": cities})()
    current, _day = find_block(shadow, target_block_id)
    if current is None:
        raise PlanMutationError("The selected plan item no longer exists.", code="target_not_found")
    if current.get("block_status") == "booked" or current.get("status") == "booked":
        raise PlanMutationError("Booked items must be unlocked or cancelled before replacement.", code="booked_item")
    if current.get("locked") or (current.get("metadata") or {}).get("locked"):
        raise PlanMutationError("This plan item is locked.", code="locked_item")

    replacement = deepcopy(selected_item or {})
    replacement["id"] = current.get("id")
    replacement["start_time"] = replacement.get("start_time") or current.get("start_time") or ""
    replacement["end_time"] = replacement.get("end_time") or current.get("end_time") or ""
    replacement["status"] = "pending"
    replacement["is_active"] = True
    replacement["block_status"] = replacement.get("block_status") or "planned"
    replacement["currency_code"] = replacement.get("currency_code") or trip.currency_code or "INR"
    replacement.setdefault("category", current.get("category") or "activity")
    replacement.setdefault("title", provider or "Selected option")
    metadata = deepcopy(replacement.get("metadata") or {})
    metadata["selection"] = {
        "selected_id": selected_id or str(selected_item.get("id") or ""),
        "provider": provider or replacement.get("title") or "",
        "provenance": provenance,
        "selected_at": timezone.now().isoformat(),
    }
    if not metadata.get("master_ref"):
        metadata["master_ref"] = {
            "table": "provider_result" if provenance in {"live_api", "cached_api", "database"} else "provisional_suggestion",
            "id": selected_id or str(selected_item.get("id") or uuid4()),
        }
    replacement["metadata"] = metadata
    upcast_activity(replacement, trip.currency_code or "INR")

    # Captured BEFORE the in-place mutation below — `copied_current` is the
    # exact same dict object `current` points to (both came from the same
    # find_block(shadow, ...) call on the same shadow structure), so
    # `.clear()`/`.update()` would silently overwrite `current`'s metadata
    # too if read afterward (Phase 4 taste-vector signal, below).
    old_master_ref = deepcopy((current.get("metadata") or {}).get("master_ref") or {})

    # Replace in the copied canonical structure.
    copied_current, _ = find_block(shadow, target_block_id)
    copied_current.clear()
    copied_current.update(replacement)
    _validate_candidate(trip.days or [], days, cities)

    trip.days = days
    trip.cities = cities
    category = (replacement.get("category") or "").lower()
    if category == "hotel":
        resolved_scopes = {"rooms", "prices", "availability"}
    elif category in {"flight", "train", "bus", "cab", "taxi", "transit", "transport"}:
        resolved_scopes = {"transport", "connectors", "transport_capacity", "prices", "availability"}
    else:
        resolved_scopes = set()
    _resolve_regeneration_scopes(
        trip,
        resolved_scopes,
        reason=f"Committed {category or 'helper'} selection {metadata['selection']['selected_id']}",
    )
    _record_mutation(
        trip,
        mutation_id,
        {
            "type": "select_item",
            "source": "helper_canvas",
            "target_block_id": str(target_block_id),
            "selected_id": metadata["selection"]["selected_id"],
            "provider": metadata["selection"]["provider"],
            "provenance": provenance,
            "affected_sections": [str((_day or {}).get("id") or (_day or {}).get("day_number") or "transport")],
        },
    )
    _finish(workspace, trip)

    # Phase 4 (M2): a canvas "swap this" is the cleanest, structurally
    # unambiguous negative/positive taste signal in the whole app — the
    # traveler is explicitly saying "not this one, THIS one instead" for
    # the exact same slot. Best-effort; must never affect whether the swap
    # itself succeeded (already committed above).
    try:
        old_ref = old_master_ref
        new_ref = metadata.get("master_ref") or {}
        if (
            old_ref.get("table") and old_ref.get("id") is not None
            and new_ref.get("table") and new_ref.get("id") is not None
            and str(old_ref.get("id")) != str(new_ref.get("id"))
        ):
            from apps.planner.models import TravelerProfile
            from apps.planner.services import taste as _taste

            profile, _ = TravelerProfile.objects.get_or_create(user=workspace.user)
            _taste.update_taste_vector(profile, old_ref["table"], old_ref["id"], direction=-1.0, source_trip=trip.id)
            _taste.update_taste_vector(profile, new_ref["table"], new_ref["id"], direction=1.0, source_trip=trip.id)
    except Exception:
        logger.warning("Taste-vector update failed for select_item swap (non-fatal)", exc_info=True)

    return trip
