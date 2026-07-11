"""
Celery tasks for the planner app.

`run_price_watches` was previously only reachable as a manual management
command (`python manage.py run_price_watches`) — real logic, but nothing
ever scheduled it, so the PriceWatch feature promised monitoring and
silently did nothing (see docs/travel-knowledge-engine-plan.md K0/§4 and
the adversarial audit's price-watch finding). The logic is unchanged here;
only the entry point is new. `CELERY_BEAT_SCHEDULE` (config/settings/base.py)
now calls this task directly instead of relying on someone to run the command.
"""

from celery import shared_task
from django.utils import timezone


def _run_price_watches():
    """The real implementation — shared by the Celery task and the (now thin) management command."""
    from apps.planner.models import PlanProposal, PriceWatch
    from apps.planner.services.block_schema import find_block

    checked = 0
    filed = 0

    for watch in PriceWatch.objects.filter(active=True, is_deleted=False).select_related("workspace"):
        workspace = watch.workspace
        trip = getattr(workspace, "trip", None)
        if trip is None:
            continue

        block, day = find_block(trip, watch.block_id)
        if block is None:
            watch.active = False
            watch.save(update_fields=["active", "updated_at"])
            continue

        service_type = (block.get("category") or "").lower()
        if service_type == "taxi":
            service_type = "cab"
        date_str = (day or {}).get("date") or timezone.now().date().isoformat()

        from apps.reference.services.live_price import lookup_live_price

        result = lookup_live_price(
            service_type=service_type,
            date_str=date_str,
            provider=block.get("title", ""),
            origin="",
            destination=block.get("location_name", ""),
        )

        watch.last_checked_at = timezone.now()
        checked += 1

        if result is None:
            watch.save(update_fields=["last_checked_at", "updated_at"])
            continue

        new_price = result["exact_price"]
        current = (block.get("cost") or {}).get("amount")
        watch.last_price = new_price
        watch.save(update_fields=["last_checked_at", "last_price", "updated_at"])

        threshold = float(watch.threshold_amount) if watch.threshold_amount is not None else None
        dropped = current is not None and new_price < float(current)
        under_threshold = threshold is not None and new_price <= threshold

        if not (dropped or under_threshold):
            continue

        # Don't stack duplicate findings for the same block
        already_open = PlanProposal.objects.filter(
            workspace=workspace,
            kind=PlanProposal.KIND_PRICE_WATCH,
            status=PlanProposal.STATUS_OPEN,
            diff__deltas__block_id=str(watch.block_id),
        ).exists()
        if already_open:
            continue

        saved = float(current) - new_price if current is not None else 0.0
        PlanProposal.objects.create(
            workspace=workspace,
            kind=PlanProposal.KIND_PRICE_WATCH,
            title=f"Price drop: {block.get('title', 'watched item')}",
            rationale=(
                f"You asked me to watch this price. It's now "
                f"{result['price']} ({result['provenance']['tier']}, {result['provenance']['basis']})."
            ),
            diff={
                "deltas": {"cost_delta": -saved if saved > 0 else 0, "block_id": str(watch.block_id)},
                "price_result": result,
            },
            created_by="agent",
            base_trip_updated_at=trip.updated_at,
        )
        filed += 1

    return {"checked": checked, "filed": filed}


@shared_task(name="apps.planner.tasks.run_price_watches")
def run_price_watches():
    return _run_price_watches()


def _infer_traveler_facts(workspace_id):
    """
    Plain aggregates, no LLM — pace_preference from items-per-day,
    budget_sensitivity from committed spend vs. stated budget. Feeds the
    _compose_days traveler-context injection (see plan_generation.py) on the
    traveler's *next* trip. Called when a trip moves to booked/completed
    (see apps.planner.views — wired at the book action).
    """
    from apps.planner.models import PlannerWorkspace, TravelerProfile
    from apps.planner.services.commitments import compute_ledger

    try:
        workspace = PlannerWorkspace.objects.select_related("user").get(id=workspace_id)
    except PlannerWorkspace.DoesNotExist:
        return {"inferred": False, "reason": "workspace not found"}

    trip = getattr(workspace, "trip", None)
    if trip is None or not trip.days:
        return {"inferred": False, "reason": "no trip data"}

    updated = []

    items_per_day = [len(day.get("activities") or []) for day in trip.days if day.get("activities")]
    if items_per_day:
        avg_items = sum(items_per_day) / len(items_per_day)
        pace = "packed" if avg_items >= 5 else "slow" if avg_items <= 2 else "moderate"
        profile, _ = TravelerProfile.objects.get_or_create(user=workspace.user)
        profile.upsert_fact("pace_preference", pace, provenance="inferred", source_trip=workspace.id)
        updated.append("pace_preference")

    ledger = compute_ledger(workspace)
    if ledger and ledger.get("budget"):
        committed = ledger.get("committed") or 0.0
        ratio = committed / ledger["budget"]
        sensitivity = "value" if ratio <= 0.85 else "premium" if ratio >= 1.1 else "moderate"
        profile, _ = TravelerProfile.objects.get_or_create(user=workspace.user)
        profile.upsert_fact("budget_sensitivity", sensitivity, provenance="inferred", source_trip=workspace.id)
        updated.append("budget_sensitivity")

    return {"inferred": True, "facts": updated}


@shared_task(name="apps.planner.tasks.infer_traveler_facts")
def infer_traveler_facts(workspace_id):
    return _infer_traveler_facts(workspace_id)
