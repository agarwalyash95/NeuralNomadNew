"""
Server-side route optimizer — the "moves server-side" half of
docs/travel-knowledge-engine-plan.md §6. A faithful port of the frontend's
optimizeDayRoute (haversine nearest-neighbor + brute-force permutation for
<=7 optimizable stops), operating on trip.days block dicts directly.

This always returns a PlanProposal — never a direct mutation. The audit
flagged that the old client-side "Optimize Route" button applied changes
directly while PlannerWorkspace's own proposal flow wrapped the identical
computation in an accept/reject step; this service is meant to become the
one path both call through (frontend migration is a K4 item), closing that
inconsistency rather than adding a third way to do the same thing.
"""

from itertools import permutations

from apps.planner.services.distance_service import haversine_distance_km

_OPTIMIZABLE_CATEGORIES = {"attraction", "activity"}
_MAX_PERMUTATION_SIZE = 7
_MIN_SAVING_KM = 0.5


def _route_km(blocks):
    total = 0.0
    for a, b in zip(blocks, blocks[1:]):
        if None in (a.get("latitude"), a.get("longitude"), b.get("latitude"), b.get("longitude")):
            continue
        total += haversine_distance_km(a["latitude"], a["longitude"], b["latitude"], b["longitude"])
    return round(total, 2)


def _best_order_by_permutation(activities, optimizable_indices, optimizable):
    best_order = optimizable
    best_km = _route_km(activities)
    for perm in permutations(optimizable):
        candidate = list(activities)
        for idx, block in zip(optimizable_indices, perm):
            candidate[idx] = block
        km = _route_km(candidate)
        if km < best_km:
            best_km = km
            best_order = list(perm)
    return best_order


def _best_order_by_nearest_neighbor(activities, optimizable_indices, optimizable):
    unvisited = list(optimizable)
    ref_idx = optimizable_indices[0] - 1
    current_ref = activities[ref_idx] if ref_idx >= 0 else None
    ordered = []
    while unvisited:
        if current_ref is not None and current_ref.get("latitude") is not None:
            unvisited.sort(key=lambda b: (
                haversine_distance_km(
                    current_ref["latitude"], current_ref["longitude"], b["latitude"], b["longitude"]
                )
                if b.get("latitude") is not None else float("inf")
            ))
        current_ref = unvisited.pop(0)
        ordered.append(current_ref)
    return ordered


def _optimize_day(day):
    """Returns (optimized_day, saved_km) or (None, 0.0) if no meaningful improvement exists."""
    activities = day.get("activities", [])
    if len(activities) <= 2:
        return None, 0.0

    optimizable_indices = [
        i for i, a in enumerate(activities)
        if (a.get("category") or "").lower() in _OPTIMIZABLE_CATEGORIES
    ]
    optimizable = [activities[i] for i in optimizable_indices]
    if len(optimizable) <= 1:
        return None, 0.0

    original_km = _route_km(activities)
    if len(optimizable) <= _MAX_PERMUTATION_SIZE:
        best_order = _best_order_by_permutation(activities, optimizable_indices, optimizable)
    else:
        best_order = _best_order_by_nearest_neighbor(activities, optimizable_indices, optimizable)

    candidate = list(activities)
    for idx, block in zip(optimizable_indices, best_order):
        candidate[idx] = block
    new_km = _route_km(candidate)

    saved_km = round(original_km - new_km, 2)
    if saved_km <= _MIN_SAVING_KM:
        return None, 0.0

    optimized_day = dict(day)
    optimized_day["activities"] = candidate
    return optimized_day, saved_km


def propose_route_optimization(workspace):
    """
    Computes an optimized stop order per day; if any day improves
    meaningfully, creates and returns a PlanProposal
    (kind=KIND_ROUTE_OPTIMIZATION). Returns None if no day improves — never
    files a no-op proposal.
    """
    from apps.planner.models import PlanProposal

    trip = getattr(workspace, "trip", None)
    if trip is None:
        return None

    before_days, after_days = [], []
    total_saved_km = 0.0
    improved_day_numbers = []

    for day in trip.days or []:
        optimized_day, saved_km = _optimize_day(day)
        if optimized_day is not None:
            before_days.append(day)
            after_days.append(optimized_day)
            total_saved_km += saved_km
            improved_day_numbers.append(day.get("day_number"))

    if not improved_day_numbers:
        return None

    day_list = ", ".join(str(n) for n in improved_day_numbers)
    return PlanProposal.objects.create(
        workspace=workspace,
        kind=PlanProposal.KIND_ROUTE_OPTIMIZATION,
        title=f"Reorder day {day_list} to cut travel time",
        rationale=(
            f"Reordering the stops on day {day_list} shortens the route between "
            f"them — same places, less time in transit."
        ),
        diff={
            "before": {"days": before_days},
            "after": {"days": after_days},
            "deltas": {"saved_km": round(total_saved_km, 2)},
        },
        created_by="agent",
        base_trip_updated_at=trip.updated_at,
    )
