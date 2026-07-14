from celery import shared_task
from django.utils import timezone

def _run_price_watches():
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

        already_open = PlanProposal.objects.filter(
            workspace=workspace,
            kind=PlanProposal.KIND_PRICE_WATCH,
            status=PlanProposal.STATUS_OPEN,
            diff__deltas__block_id=str(watch.block_id),
        ).exists()
        if already_open:
            continue

        saved = float(current) - new_price if current is not None else 0.0
        block_title = block.get("title", "watched item")
        PlanProposal.objects.create(
            workspace=workspace,
            kind=PlanProposal.KIND_PRICE_WATCH,
            title=f"Price drop: {block_title}",
            rationale=(
                f"You asked me to watch this price. It's now "
                f"{result['price']} ({result['provenance']['tier']}, {result['provenance']['basis']})."
            ),
            diff={
                "deltas": {"cost_delta": -saved if saved > 0 else 0, "block_id": str(watch.block_id)},
                "price_result": result,
            },
            metadata={
                "diff_explanation": {
                    "what_changed": f"Price for {block_title} dropped from the previously known value.",
                    "why": f"Live price check returned {result['price']} — {result['provenance']['basis']}.",
                    "what_improved": [f"Save ₹{saved:.0f}" if saved > 0 else "Price is now at or below your threshold"],
                    "what_got_worse": [],
                    "confidence": result["provenance"]["tier"],
                    "can_undo": True,
                },
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
    Behavioral-fact learning from a completed trip — all plain aggregates,
    no LLM. Feeds _compose_days traveler-context injection on the
    traveler's next trip (T6.1). Called when a trip moves to booked/completed.
    """
    from collections import Counter

    from apps.planner.models import PlannerWorkspace, TravelerProfile
    from apps.planner.services.commitments import compute_ledger
    from apps.planner.services.insight_engine import _to_minutes

    try:
        workspace = PlannerWorkspace.objects.select_related("user").get(id=workspace_id)
    except PlannerWorkspace.DoesNotExist:
        return {"inferred": False, "reason": "workspace not found"}

    trip = getattr(workspace, "trip", None)
    if trip is None or not trip.days:
        return {"inferred": False, "reason": "no trip data"}

    all_activities = [a for day in trip.days for a in (day.get("activities") or [])]
    profile, _ = TravelerProfile.objects.get_or_create(user=workspace.user)
    updated = []

    # Pace — items-per-day average
    items_per_day = [len(day.get("activities") or []) for day in trip.days if day.get("activities")]
    if items_per_day:
        avg_items = sum(items_per_day) / len(items_per_day)
        pace = "packed" if avg_items >= 5 else "slow" if avg_items <= 2 else "moderate"
        profile.upsert_fact("pace_preference", pace, provenance="inferred", source_trip=workspace.id)
        updated.append("pace_preference")

    # Budget sensitivity — committed / stated budget
    ledger = compute_ledger(workspace)
    if ledger and ledger.get("budget"):
        committed = ledger.get("committed") or 0.0
        ratio = committed / ledger["budget"]
        sensitivity = "value" if ratio <= 0.85 else "premium" if ratio >= 1.1 else "moderate"
        profile.upsert_fact("budget_sensitivity", sensitivity, provenance="inferred", source_trip=workspace.id)
        updated.append("budget_sensitivity")

    # Start-time preference — when the first non-hotel block of each day begins
    first_start_mins = []
    for day in trip.days:
        acts = [a for a in (day.get("activities") or []) if a.get("category") != "hotel"]
        acts_sorted = sorted(acts, key=lambda a: _to_minutes(a.get("start_time")) or 999)
        if acts_sorted:
            mins = _to_minutes(acts_sorted[0].get("start_time"))
            if mins is not None:
                first_start_mins.append(mins)
    if first_start_mins:
        avg_start = sum(first_start_mins) / len(first_start_mins)
        start_pref = "early_riser" if avg_start < 8 * 60 + 30 else "late_starter" if avg_start > 10 * 60 else "standard"
        profile.upsert_fact("start_time_preference", start_pref, provenance="inferred", source_trip=workspace.id)
        updated.append("start_time_preference")

    # Meal timing — average time for food blocks
    meal_times = [
        _to_minutes(a.get("start_time"))
        for a in all_activities
        if a.get("category") == "food" and _to_minutes(a.get("start_time")) is not None
    ]
    if meal_times:
        avg_meal = sum(meal_times) / len(meal_times)
        meal_pref = "early_diner" if avg_meal < 12 * 60 + 30 else "late_diner" if avg_meal > 14 * 60 + 30 else "standard_diner"
        profile.upsert_fact("meal_timing", meal_pref, provenance="inferred", source_trip=workspace.id)
        updated.append("meal_timing")

    # Top activity categories — what this traveler actually visits
    categories = [a.get("category") for a in all_activities if a.get("category") not in ("hotel", "food", None)]
    if categories:
        top_cats = [cat for cat, _ in Counter(categories).most_common(3)]
        profile.upsert_fact("top_activity_categories", ",".join(top_cats), provenance="inferred", source_trip=workspace.id)
        updated.append("top_activity_categories")

    # Hotel quality tier — average rating of booked hotels
    hotel_ratings = [float(a.get("rating")) for a in all_activities if a.get("category") == "hotel" and a.get("rating")]
    if hotel_ratings:
        avg_rating = sum(hotel_ratings) / len(hotel_ratings)
        hotel_tier = "luxury" if avg_rating >= 4.5 else "budget" if avg_rating < 3.5 else "mid_range"
        profile.upsert_fact("hotel_quality_tier", hotel_tier, provenance="inferred", source_trip=workspace.id)
        updated.append("hotel_quality_tier")

    return {"inferred": True, "facts": updated}


@shared_task(name="apps.planner.tasks.infer_traveler_facts")
def infer_traveler_facts(workspace_id):
    return _infer_traveler_facts(workspace_id)


@shared_task(name="apps.planner.tasks.generate_block_tip")
def generate_block_tip_task(workspace_id, block_id, title):
    from apps.planner.services.tip_sync import apply_generated_tip
    from apps.common.ai import get_genai_client
    
    prompt = (
        f"Write a single short sentence (max 15 words) giving an insider tip or "
        f"practical advice for visiting {title}."
    )
    try:
        client = get_genai_client()
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt
        )
        tip = response.text.strip()
    except Exception:
        tip = f"Enjoy your time at {title}!"

    apply_generated_tip(workspace_id, block_id, tip)


def _run_trip_watch():
    """
    Ambient intelligence loop (T3.1) — re-evaluates every active/upcoming
    workspace's trip against PlanInsightEngine (walk-load, gaps, opening-
    hours conflicts, overloaded days, local holidays, natural phenomena —
    the same rule set the real-time GET .../insights endpoint uses) and
    publishes workspace_updated when findings exist, so connected SSE
    clients refetch and see them without a page reload. Also runs route
    optimization (per-day TSP) and files a PlanProposal when a meaningful
    improvement exists.

    Insights are intentionally never persisted here: PlanInsightEngine is
    cheap pure-Python (no LLM, no external calls) and the real /insights
    endpoint already recomputes them fresh on every request — persisting a
    second copy would just be a second source of truth to keep in sync.

    Called by the Celery beat schedule every 15 minutes. Route optimization
    is de-duped against already-open proposals so it doesn't refile every run.
    """
    from datetime import date

    from apps.planner.models import PlannerWorkspace, PlanProposal
    from apps.planner.services.insight_engine import PlanInsightEngine

    today = date.today()
    workspaces = (
        PlannerWorkspace.objects.filter(
            is_deleted=False,
            draft_state__end_date__gte=today,
        )
        .select_related("draft_state", "trip")
        .exclude(trip__isnull=True)
    )

    engine = PlanInsightEngine()
    notified = 0
    skipped = 0

    for workspace in workspaces:
        trip = workspace.trip
        if not trip or not trip.days:
            continue
        try:
            insights = engine.run(trip)
        except Exception:
            skipped += 1
            continue

        if insights:
            notified += 1
            _publish_workspace_updated(str(workspace.id))

        # Ambient route optimization — skipped when an open proposal already
        # exists so the loop doesn't spam a new one every 15 min.
        has_open_route_proposal = PlanProposal.objects.filter(
            workspace=workspace,
            kind=PlanProposal.KIND_ROUTE_OPTIMIZATION,
            status=PlanProposal.STATUS_OPEN,
        ).exists()
        if not has_open_route_proposal:
            try:
                from apps.planner.services.route_optimizer import (
                    propose_route_optimization,
                    propose_whole_trip_optimization,
                )

                # T6.2: per-day TSP first; whole-trip load balancing as a
                # fallback when no single day has a shorter-route win.
                proposal = propose_route_optimization(workspace)
                if proposal is None:
                    proposal = propose_whole_trip_optimization(workspace)
                if proposal is not None:
                    notified += 1
                    _publish_workspace_updated(str(workspace.id))
            except Exception:
                skipped += 1

    return {"evaluated": workspaces.count(), "notified": notified, "skipped": skipped}


def _publish_workspace_updated(workspace_id: str):
    """Publish a lightweight Redis Pub/Sub message so SSE clients wake immediately."""
    import json
    try:
        import redis
        from django.conf import settings
        r = redis.from_url(settings.CELERY_BROKER_URL)
        r.publish(f"workspace:{workspace_id}:updated", json.dumps({"type": "workspace_updated"}))
    except Exception:
        pass


@shared_task(name="apps.planner.tasks.run_trip_watch")
def run_trip_watch():
    return _run_trip_watch()


@shared_task(name="apps.planner.tasks.run_generation_job_task", bind=True, max_retries=2)
def run_generation_job_task(self, job_id):
    """Celery-native generation task (T3.3) — replaces the bare threading.Thread."""
    from django.db import close_old_connections
    from apps.planner.services.plan_generation import run_generation_job
    close_old_connections()
    run_generation_job(job_id, manage_connections=True)
