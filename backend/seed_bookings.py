import datetime
import uuid
from django.utils import timezone
from django.contrib.auth import get_user_model
from apps.bookings.models import Booking

User = get_user_model()

try:
    user = User.objects.get(email='yash30076472@gmail.com')
except User.DoesNotExist:
    print("User not found!")
    exit(1)

# Clear existing bookings for this user
Booking.objects.filter(user=user).delete()

now = timezone.now().date()

fake_bookings = [
    {
        'booking_type': 'flight',
        'status': 'confirmed',
        'amount': 4500.00,
        'start_date': now + datetime.timedelta(days=10),
        'end_date': now + datetime.timedelta(days=10),
        'provider': 'Indigo',
        'payment_confirmed': True,
        'payment_method': 'upi',
        'details': {
            'origin': 'DEL',
            'destination': 'BOM',
            'flight_number': '6E-452',
            'departure_time': '10:00 AM',
            'arrival_time': '12:15 PM',
            'passengers': 1,
            'class': 'Economy'
        }
    },
    {
        'booking_type': 'hotel',
        'status': 'confirmed',
        'amount': 12000.00,
        'start_date': now + datetime.timedelta(days=10),
        'end_date': now + datetime.timedelta(days=14),
        'provider': 'Taj Lands End',
        'payment_confirmed': True,
        'payment_method': 'card',
        'details': {
            'city': 'Mumbai',
            'address': 'Band Stand, Bandra West',
            'room_type': 'Deluxe Sea View',
            'guests': 2,
            'check_in': '14:00',
            'check_out': '12:00'
        }
    },
    {
        'booking_type': 'train',
        'status': 'completed',
        'amount': 1200.00,
        'start_date': now - datetime.timedelta(days=30),
        'end_date': now - datetime.timedelta(days=29),
        'provider': 'IRCTC',
        'payment_confirmed': True,
        'payment_method': 'netbanking',
        'details': {
            'train_name': 'Rajdhani Express',
            'train_number': '12952',
            'from': 'NDLS',
            'to': 'BCT',
            'class': '2AC',
            'pnr': '2938475610'
        }
    },
    {
        'booking_type': 'cab',
        'status': 'pending',
        'amount': 500.00,
        'start_date': now + datetime.timedelta(days=10),
        'end_date': now + datetime.timedelta(days=10),
        'provider': 'Uber',
        'payment_confirmed': False,
        'payment_method': '',
        'details': {
            'pickup': 'CSMIA Airport, Mumbai',
            'dropoff': 'Taj Lands End, Bandra',
            'car_type': 'UberGo',
            'driver_details': 'Pending Assignment'
        }
    },
    {
        'booking_type': 'flight',
        'status': 'cancelled',
        'amount': 8500.00,
        'start_date': now + datetime.timedelta(days=45),
        'end_date': now + datetime.timedelta(days=45),
        'provider': 'Air India',
        'payment_confirmed': True,
        'payment_method': 'card',
        'details': {
            'origin': 'BOM',
            'destination': 'DXB',
            'flight_number': 'AI-983',
            'cancellation_reason': 'Change in plans',
            'refund_status': 'Refund Processed'
        }
    }
]

for b in fake_bookings:
    Booking.objects.create(
        user=user,
        booking_type=b['booking_type'],
        reference_number=f"NN-{uuid.uuid4().hex[:8].upper()}",
        status=b['status'],
        amount=b['amount'],
        start_date=b['start_date'],
        end_date=b['end_date'],
        details=b['details'],
        payment_confirmed=b['payment_confirmed'],
        payment_method=b['payment_method'],
        provider=b['provider'],
        provider_booking_id=f"PROV-{uuid.uuid4().hex[:6].upper()}"
    )

print("Successfully seeded fake bookings for yash30076472@gmail.com")
