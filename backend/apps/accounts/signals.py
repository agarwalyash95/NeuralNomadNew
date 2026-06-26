"""
Accounts app signals
"""

from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import User, UserPreference


@receiver(post_save, sender=User)
def create_user_preference(sender, instance, created, **kwargs):
    """Create user preference when user is created"""
    if created:
        UserPreference.objects.get_or_create(user=instance)
