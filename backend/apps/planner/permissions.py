from rest_framework import permissions

class IsWorkspaceOwner(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        # obj could be PlannerWorkspace or related object
        if hasattr(obj, 'user'):
            return obj.user == request.user
        elif hasattr(obj, 'workspace'):
            return obj.workspace.user == request.user
        return False
