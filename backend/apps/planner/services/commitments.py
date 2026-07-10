"""
Commitment transitions and the trip ledger.

Rules enforced here:
  - State machine is forward-only (held may re-price). Invalid jumps fail
    loudly instead of silently corrupting money state.
  - Every transition syncs the block's JSON (block_status, legacy status,
    provenance on booking) so all readers agree.
  - Ledger totals inherit the weakest provenance tier of their inputs —
    a total containing estimates is an estimated total and says so.
"""

from django.utils import timezone

from apps.planner.models import PlanBlockCommitment
from apps.planner.services.block_schema import (
    TIER_ESTIMATED,
    TIER_SUGGESTED,
    TIER_VERIFIED,
    find_block,
    make_provenance,
    upcast_activity,
)

# JSON block_status values for each commitment status
_BLOCK_STATUS_FOR = {
    PlanBlockCommitment.STATUS_PRICED: "priced",
    PlanBlockCommitment.STATUS_HELD: "priced",  # held is a commitment nuance; block shows priced
    PlanBlockCommitment.STATUS_BOOKED: "booked",
    PlanBlockCommitment.STATUS_TICKETED: "booked",
}

_TIER_RANK = {TIER_VERIFIED: 3, TIER_ESTIMATED: 2, TIER_SUGGESTED: 1}


class TransitionError(Exception):
    pass


def transition_blocks(workspace, block_ids, to, quote=None, refundable_until=None, provider_ref=""):
    """
    Move one or more blocks to a new commitment status atomically-per-block.
    Returns (updated_commitments, errors) — errors are per-block messages.
    """
    if to not in PlanBlockCommitment.STATUS_RANK:
        raise TransitionError(f"Unknown target status: {to}")
    if not hasattr(workspace, "trip"):
        raise TransitionError("Plan has not been created yet.")

    trip = workspace.trip
    now = timezone.now().isoformat()
    updated = []
    errors = {}
    trip_dirty = False

    for block_id in block_ids:
        block, _day = find_block(trip, block_id)
        if block is None:
            errors[str(block_id)] = "Block not found in plan."
            continue

        commitment = PlanBlockCommitment.objects.filter(
            workspace=workspace, block_id=str(block_id), is_deleted=False
        ).first()

        if commitment and not commitment.can_transition_to(to):
            errors[str(block_id)] = f"Cannot move from {commitment.status} to {to}."
            continue

        upcast_activity(block, trip.currency_code or "INR")
        amount = (quote or {}).get("amount")
        if amount is None:
            amount = block.get("cost", {}).get("amount")

        if commitment is None:
            commitment = PlanBlockCommitment(
                workspace=workspace, block_id=str(block_id), history=[]
            )

        commitment.status = to
        if amount is not None:
            commitment.amount = amount
        commitment.currency = block.get("cost", {}).get("currency") or trip.currency_code or "INR"
        if quote:
            commitment.quote = quote
        if refundable_until:
            commitment.refundable_until = refundable_until
        if provider_ref:
            commitment.provider_ref = provider_ref
        commitment.history = (commitment.history or []) + [
            {"to": to, "at": now, "amount": float(amount) if amount is not None else None}
        ]
        commitment.save()

        # Sync the block JSON so every reader agrees
        block["block_status"] = _BLOCK_STATUS_FOR[to]
        if to in (PlanBlockCommitment.STATUS_BOOKED, PlanBlockCommitment.STATUS_TICKETED):
            block["status"] = "booked"  # legacy readers
            block["cost"]["provenance"] = make_provenance(TIER_VERIFIED, source="booking")
            if amount is not None:
                block["cost"]["amount"] = float(amount)
                block["estimated_cost"] = float(amount)
        trip_dirty = True
        updated.append(commitment)

    if trip_dirty:
        trip.save()
        workspace.is_modified = True
        workspace.save(update_fields=["is_modified", "updated_at"])

    return updated, errors


def _iter_active_blocks(trip):
    for day in trip.days or []:
        for act in day.get("activities") or []:
            if act.get("is_active") is False or act.get("status") == "inactive":
                continue
            yield act
    for city in trip.cities or []:
        transit = city.get("transitToNext")
        if isinstance(transit, dict) and transit.get("is_active") is not False:
            yield transit


def compute_ledger(workspace):
    """
    One honest home for money. Committed = booked/ticketed commitment rows.
    Planned = remaining active blocks' costs, labeled by their weakest tier.
    """
    trip = getattr(workspace, "trip", None)
    if trip is None:
        return None

    commitments = list(
        workspace.commitments.filter(is_deleted=False)
    )
    committed_rows = [
        c for c in commitments
        if c.status in (PlanBlockCommitment.STATUS_BOOKED, PlanBlockCommitment.STATUS_TICKETED)
    ]
    committed_ids = {c.block_id for c in committed_rows}
    committed_total = sum(float(c.amount) for c in committed_rows if c.amount is not None)

    planned_total = 0.0
    weakest_rank = 4  # better than any real tier
    for block in _iter_active_blocks(trip):
        if str(block.get("id")) in committed_ids:
            continue
        upcast_activity(block, trip.currency_code or "INR")
        amount = block.get("cost", {}).get("amount")
        if amount is None:
            continue
        planned_total += float(amount)
        tier = block.get("cost", {}).get("provenance", {}).get("tier", TIER_SUGGESTED)
        weakest_rank = min(weakest_rank, _TIER_RANK.get(tier, 1))

    planned_tier = {3: TIER_VERIFIED, 2: TIER_ESTIMATED, 1: TIER_SUGGESTED}.get(weakest_rank, TIER_SUGGESTED)

    return {
        "currency": trip.currency_code or "INR",
        "budget": float(trip.total_budget) if trip.total_budget is not None else None,
        "committed": committed_total,
        "planned_estimate": planned_total,
        # A total containing estimates is an estimated total — and says so
        "planned_tier": planned_tier if planned_total > 0 else None,
        "commitments": [
            {
                "block_id": c.block_id,
                "status": c.status,
                "amount": float(c.amount) if c.amount is not None else None,
                "currency": c.currency,
                "refundable_until": c.refundable_until.isoformat() if c.refundable_until else None,
                "provider_ref": c.provider_ref,
            }
            for c in commitments
        ],
    }
