"""
Context Manager — manages workspace context and coordinates with memory.
"""

import logging
from apps.planner.models import PlannerWorkspace, WorkspaceContext, PlannerMemory
from .event_bus import event_bus, WorkspaceEventType

logger = logging.getLogger(__name__)


class ContextManager:
    """Manages workspace context updates and publishes events."""

    def update_context(self, workspace_id: str, updates: dict) -> WorkspaceContext:
        """
        Update trip parameters. Publishes appropriate events based on what changed.
        """
        workspace = PlannerWorkspace.objects.get(id=workspace_id)
        context, _ = WorkspaceContext.objects.get_or_create(workspace=workspace)

        changed_fields = []
        for field, value in updates.items():
            if hasattr(context, field):
                setattr(context, field, value)
                changed_fields.append(field)

        context.save()

        # Publish specific events based on what changed
        if 'start_date' in changed_fields or 'end_date' in changed_fields:
            event_bus.publish(workspace_id, WorkspaceEventType.DATES_CHANGED, {
                'start_date': str(context.start_date) if context.start_date else None,
                'end_date': str(context.end_date) if context.end_date else None,
            })

        if 'budget' in changed_fields:
            event_bus.publish(workspace_id, WorkspaceEventType.BUDGET_CHANGED, {
                'budget': float(context.budget) if context.budget else None,
                'currency': context.budget_currency,
            })

        if any(f in changed_fields for f in ('adults', 'children', 'infants')):
            event_bus.publish(workspace_id, WorkspaceEventType.TRAVELERS_CHANGED, {
                'adults': context.adults,
                'children': context.children,
                'infants': context.infants,
            })

        # Always publish generic context update
        event_bus.publish(workspace_id, WorkspaceEventType.CONTEXT_UPDATED, {
            'changed_fields': changed_fields,
        })

        logger.info(f"Context updated for workspace {workspace_id}: {changed_fields}")
        return context

    def get_context(self, workspace_id: str) -> dict:
        """Get current workspace context as a dictionary."""
        try:
            context = WorkspaceContext.objects.get(workspace_id=workspace_id)
            return {
                'origin': context.origin_location,
                'destination': context.destination_location,
                'start_date': str(context.start_date) if context.start_date else None,
                'end_date': str(context.end_date) if context.end_date else None,
                'adults': context.adults,
                'children': context.children,
                'infants': context.infants,
                'budget': float(context.budget) if context.budget else None,
                'budget_currency': context.budget_currency,
                'travel_style': context.travel_style,
                'interests': context.interests,
            }
        except WorkspaceContext.DoesNotExist:
            return {}
