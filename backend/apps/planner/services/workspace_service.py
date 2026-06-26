"""
Workspace Service — workspace CRUD and lifecycle management.
"""

import logging
from apps.planner.models import (
    PlannerWorkspace, PlannerMemory, WorkspaceContext, PlannerTrip,
    WorkspaceStatus,
)

logger = logging.getLogger(__name__)


class WorkspaceService:
    """Manages workspace lifecycle."""

    def create_workspace(self, user, title: str = 'New Trip') -> PlannerWorkspace:
        """Create a new workspace with associated memory and context."""
        workspace = PlannerWorkspace.objects.create(
            user=user,
            title=title,
            status=WorkspaceStatus.DRAFT,
        )

        # Create associated objects
        PlannerMemory.objects.create(workspace=workspace)
        WorkspaceContext.objects.create(workspace=workspace)
        PlannerTrip.objects.create(workspace=workspace, title=title)

        logger.info(f"Workspace created: {workspace.id} for user {user}")
        return workspace

    def get_workspace_summary(self, workspace_id: str) -> dict:
        """Get full workspace summary."""
        workspace = PlannerWorkspace.objects.get(id=workspace_id)

        summary = {
            'id': str(workspace.id),
            'title': workspace.title,
            'status': workspace.status,
            'mode': workspace.mode,
            'created_at': workspace.created_at.isoformat(),
            'last_activity_at': workspace.last_activity_at.isoformat(),
        }

        # Add context if exists
        try:
            ctx = workspace.context
            summary['context'] = {
                'origin': ctx.origin_location,
                'destination': ctx.destination_location,
                'start_date': str(ctx.start_date) if ctx.start_date else None,
                'end_date': str(ctx.end_date) if ctx.end_date else None,
                'adults': ctx.adults,
                'budget': float(ctx.budget) if ctx.budget else None,
                'travel_style': ctx.travel_style,
            }
        except WorkspaceContext.DoesNotExist:
            summary['context'] = {}

        # Add canvas count
        summary['active_canvases'] = workspace.canvas_instances.filter(
            is_active=True, is_deleted=False,
        ).count()

        # Add chat message count
        summary['chat_count'] = workspace.chats.filter(is_deleted=False).count()

        return summary
