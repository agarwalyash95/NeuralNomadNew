"""
Notifications app serializers
"""

from rest_framework import serializers
from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    """Notification serializer"""

    class Meta:
        model = Notification
        fields = [
            'id', 'user', 'notification_type', 'title', 'message',
            'icon_url', 'action_url', 'is_read', 'read_at', 'created_at'
        ]
        read_only_fields = ['id', 'user', 'created_at']
