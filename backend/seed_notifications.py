import datetime
from django.utils import timezone
from django.contrib.auth import get_user_model
from apps.notifications.models import Notification

User = get_user_model()

try:
    user = User.objects.get(email='yash30076472@gmail.com')
except User.DoesNotExist:
    print("User not found!")
    exit(1)

# Clear existing notifications
Notification.objects.filter(user=user).delete()

now = timezone.now()

# Create fake notifications
notifications = [
    {
        'notification_type': 'trip_reminder',
        'title': 'Flight Check-in Open',
        'message': 'Web check-in for your flight AI-101 to Mumbai is now open.',
        'is_read': False,
        'action_url': '/bookings',
        'days_ago': 0,
        'hours_ago': 2
    },
    {
        'notification_type': 'price_drop',
        'title': 'Price Drop Alert',
        'message': 'Flights to Paris have dropped by 15% for your saved dates.',
        'is_read': False,
        'action_url': '/bookings',
        'days_ago': 0,
        'hours_ago': 5
    },
    {
        'notification_type': 'visa_alert',
        'title': 'Schengen Visa Required',
        'message': 'Your upcoming trip to Paris requires a Schengen Visa. Start your application now.',
        'is_read': True,
        'action_url': '/travel-prep',
        'days_ago': 1,
        'hours_ago': 0
    },
    {
        'notification_type': 'booking_update',
        'title': 'Hotel Confirmed',
        'message': 'Your booking at Taj Mahal Palace has been confirmed.',
        'is_read': True,
        'action_url': '/my-bookings',
        'days_ago': 2,
        'hours_ago': 0
    },
    {
        'notification_type': 'system',
        'title': 'Welcome to NeuralNomad',
        'message': 'Your account has been successfully set up. Let us start planning your first trip!',
        'is_read': True,
        'action_url': '/dashboard',
        'days_ago': 5,
        'hours_ago': 0
    }
]

for n in notifications:
    noti = Notification.objects.create(
        user=user,
        notification_type=n['notification_type'],
        title=n['title'],
        message=n['message'],
        is_read=n['is_read'],
        action_url=n['action_url']
    )
    noti.created_at = now - datetime.timedelta(days=n['days_ago'], hours=n['hours_ago'])
    noti.save(update_fields=['created_at'])

print("Successfully seeded fake notifications for yash30076472@gmail.com")
