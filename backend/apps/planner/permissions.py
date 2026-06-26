"""
Planner permissions — workspace ownership enforcement.
"""

from rest_framework.permissions import BasePermission


class IsWorkspaceOwner(BasePermission):
    """
    Only the workspace owner can access workspace-nested endpoints.
    """
    message = 'You do not have access to this workspace.'

    def has_permission(self, request, view):
        # Must be authenticated
        return request.user and request.user.is_authenticated

    def has_object_permission(self, request, view, obj):
        # Check workspace ownership
        if hasattr(obj, 'user'):
            return obj.user == request.user
        if hasattr(obj, 'workspace'):
            return obj.workspace.user == request.user
        return False
