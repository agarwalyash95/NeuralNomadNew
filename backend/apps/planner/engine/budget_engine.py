"""
Budget Engine — tracks estimated vs actual spending in real-time.
"""

import logging
from decimal import Decimal
from apps.planner.models import PlannerTrip, TripActivity, BookingOrder

logger = logging.getLogger(__name__)


class BudgetEngine:
    """Tracks budget and recalculates on item events."""

    def recalculate(self, workspace_id: str) -> dict:
        """Recalculate total estimated and spent budget."""
        try:
            trip = PlannerTrip.objects.get(workspace_id=workspace_id)
        except PlannerTrip.DoesNotExist:
            return {'estimated': 0, 'spent': 0, 'remaining': 0}

        # Sum estimated costs from timeline activities
        activities = TripActivity.objects.filter(
            day__trip=trip, is_deleted=False,
        )
        estimated = sum(
            a.estimated_cost or Decimal('0')
            for a in activities
        )

        # Sum confirmed booking costs
        orders = BookingOrder.objects.filter(
            workspace_id=workspace_id,
            status='confirmed',
            is_deleted=False,
        )
        spent = sum(o.price or Decimal('0') for o in orders)

        # Update trip
        trip.spent_budget = spent
        trip.save(update_fields=['spent_budget'])

        total_budget = trip.total_budget or Decimal('0')
        remaining = total_budget - estimated

        return {
            'estimated': float(estimated),
            'spent': float(spent),
            'total_budget': float(total_budget),
            'remaining': float(remaining),
            'currency': trip.currency_code,
        }

    # ─── Event Handlers ────────────────────────────────

    def on_item_selected(self, workspace_id: str, payload: dict):
        """Recalculate when an item is selected."""
        self.recalculate(workspace_id)
        logger.info(f"Budget: Recalculated after item selected in {workspace_id}")

    def on_item_removed(self, workspace_id: str, payload: dict):
        """Recalculate when an item is removed."""
        self.recalculate(workspace_id)
        logger.info(f"Budget: Recalculated after item removed in {workspace_id}")

    def on_item_modified(self, workspace_id: str, payload: dict):
        """Recalculate when an item is modified."""
        self.recalculate(workspace_id)
        logger.info(f"Budget: Recalculated after item modified in {workspace_id}")
