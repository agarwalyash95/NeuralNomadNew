"""
Notifications app models
"""

from django.db import models
from django.contrib.auth import get_user_model
from apps.common.models import BaseModel

User = get_user_model()


class Notification(BaseModel):
    """User notifications"""

    NOTIFICATION_TYPE_CHOICES = [
        ('trip_reminder', 'Trip Reminder'),
        ('booking_update', 'Booking Update'),
        ('visa_alert', 'Visa Alert'),
        ('price_drop', 'Price Drop'),
        ('offer', 'Offer'),
        ('system', 'System'),
        ('other', 'Other'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    notification_type = models.CharField(max_length=50, choices=NOTIFICATION_TYPE_CHOICES)
    title = models.CharField(max_length=255)
    message = models.TextField()
    icon_url = models.URLField(null=True, blank=True)
    action_url = models.URLField(null=True, blank=True)
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'is_read']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return f'{self.user.email} - {self.title}'
