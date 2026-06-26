"""
Recommendation Engine — generates smart AI suggestions based on trip state.
"""

import logging
from apps.planner.models import (
    PlannerWorkspace, Recommendation, WorkspaceContext,
)

logger = logging.getLogger(__name__)


class RecommendationEngine:
    """
    Generates contextual recommendations based on current trip state.
    These become the preview cards in the Plan Canvas.
    """

    def generate_recommendations(self, workspace_id: str) -> list[Recommendation]:
        """
        Generate recommendations based on what's missing from the trip plan.
        """
        workspace = PlannerWorkspace.objects.get(id=workspace_id)
        recommendations = []

        try:
            context = workspace.context
        except WorkspaceContext.DoesNotExist:
            return recommendations

        # Check what's missing and suggest
        existing_types = set(
            workspace.recommendations.filter(
                is_dismissed=False, is_deleted=False,
            ).values_list('type', flat=True)
        )

        # If destination set but no flights searched
        if context.destination_location and 'flight' not in existing_types:
            rec, created = Recommendation.objects.get_or_create(
                workspace=workspace, type='flight',
                defaults={
                    'canvas_type': 'flight',
                    'title': 'Search Flights',
                    'description': 'Find the best flights for your trip',
                    'reason': 'You have a destination but no flights booked yet',
                    'priority': 1,
                    'impact': 'high',
                    'actions': [
                        {'label': 'Search Flights', 'command_type': 'OPEN_CANVAS', 'payload': {'canvas_type': 'flight'}},
                    ],
                },
            )
            if created:
                recommendations.append(rec)

        # If dates set but no hotel searched
        if context.start_date and 'hotel' not in existing_types:
            rec, created = Recommendation.objects.get_or_create(
                workspace=workspace, type='hotel',
                defaults={
                    'canvas_type': 'hotel',
                    'title': 'Find Hotels',
                    'description': 'Browse accommodation options',
                    'reason': 'You have dates set but no hotel selected',
                    'priority': 2,
                    'impact': 'high',
                    'actions': [
                        {'label': 'Search Hotels', 'command_type': 'OPEN_CANVAS', 'payload': {'canvas_type': 'hotel'}},
                    ],
                },
            )
            if created:
                recommendations.append(rec)

        # If destination is international, suggest visa check
        dest = context.destination_location
        if dest and dest.get('country') and dest.get('country') != 'India' and 'visa' not in existing_types:
            rec, created = Recommendation.objects.get_or_create(
                workspace=workspace, type='visa',
                defaults={
                    'canvas_type': 'visa',
                    'title': 'Check Visa Requirements',
                    'description': f"Verify visa requirements for {dest.get('country', 'your destination')}",
                    'reason': 'International trip — visa check recommended',
                    'priority': 1,
                    'impact': 'high',
                    'actions': [
                        {'label': 'Check Visa', 'command_type': 'OPEN_CANVAS', 'payload': {'canvas_type': 'visa'}},
                    ],
                },
            )
            if created:
                recommendations.append(rec)

        logger.info(f"Generated {len(recommendations)} new recommendations for {workspace_id}")
        return recommendations
