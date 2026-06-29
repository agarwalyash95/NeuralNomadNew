from apps.planner.models import PlannerWorkspace, PlannerMemory, WorkspaceContext, PlannerTrip

class WorkspaceService:
    @staticmethod
    def create_workspace(user, name="New Trip"):
        workspace = PlannerWorkspace.objects.create(user=user, name=name)
        # Initialize required related models
        PlannerMemory.objects.create(workspace=workspace)
        WorkspaceContext.objects.create(workspace=workspace)
        PlannerTrip.objects.create(workspace=workspace)
        return workspace

    @staticmethod
    def get_full_workspace_state(workspace):
        # Fetch everything needed to bootstrap the UI
        pass
