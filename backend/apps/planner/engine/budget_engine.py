from decimal import Decimal
from apps.planner.models import PlannerTrip, TripActivity, WorkspaceContext

class BudgetEngine:
    """
    Calculates and tracks budget across the trip.
    """
    @staticmethod
    def calculate_total_spent(workspace):
        total = Decimal('0.00')
        if hasattr(workspace, 'trip'):
            activities = TripActivity.objects.filter(
                trip_day__trip_city__trip=workspace.trip, 
                cost__isnull=False
            )
            for activity in activities:
                total += activity.cost
        return total

    @staticmethod
    def get_budget_summary(workspace):
        context = getattr(workspace, 'context', None)
        budget_total = context.budget_total if context and context.budget_total else Decimal('0.00')
        spent = BudgetEngine.calculate_total_spent(workspace)
        return {
            'total_budget': budget_total,
            'total_spent': spent,
            'remaining': budget_total - spent if budget_total else Decimal('0.00'),
            'currency': context.currency if context else 'USD'
        }
