from apps.planner.models import WorkspaceContext
from apps.planner.engine.event_bus import EventBus, Events

class ContextManager:
    """
    Manages the overall context of a workspace.
    """
    @staticmethod
    def get_context(workspace):
        context, _ = WorkspaceContext.objects.get_or_create(workspace=workspace)
        return context

    @staticmethod
    def update_budget(workspace, new_budget):
        context = ContextManager.get_context(workspace)
        context.budget_total = new_budget
        context.save()
        EventBus.publish(Events.BUDGET_CHANGED, workspace_id=workspace.id, new_budget=new_budget)

    @staticmethod
    def update_checklist(workspace, key, status):
        context = ContextManager.get_context(workspace)
        context.checklist_status[key] = status
        context.save()
