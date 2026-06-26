import datetime
from django.utils import timezone
from django.contrib.auth import get_user_model
from apps.wallet.models import SavedPaymentMethod, TransactionRecord

User = get_user_model()

try:
    user = User.objects.get(email='yash30076472@gmail.com')
except User.DoesNotExist:
    print("User not found!")
    exit(1)

# Clear existing test data
SavedPaymentMethod.objects.filter(user=user).delete()
TransactionRecord.objects.filter(user=user).delete()

# Add Saved Cards
SavedPaymentMethod.objects.create(
    user=user, method_type='card', provider='HDFC Bank Visa', identifier='4242', is_default=True
)
SavedPaymentMethod.objects.create(
    user=user, method_type='card', provider='ICICI Bank Mastercard', identifier='5581', is_default=False
)

# Add UPI
SavedPaymentMethod.objects.create(
    user=user, method_type='upi', provider='Google Pay', identifier='yash@okicici', is_default=True
)
SavedPaymentMethod.objects.create(
    user=user, method_type='upi', provider='PhonePe', identifier='9876543210@ybl', is_default=False
)

# Add Wallets
SavedPaymentMethod.objects.create(
    user=user, method_type='wallet', provider='Paytm Wallet', identifier='9876543210', is_default=True
)
SavedPaymentMethod.objects.create(
    user=user, method_type='wallet', provider='Amazon Pay', identifier='yash_amazon', is_default=False
)

# Add Transaction History
now = timezone.now()

transactions = [
    {
        'amount': 1500.00, 'status': 'completed', 'description': 'Flight Booking - Delhi to Mumbai',
        'razorpay_order_id': 'order_Lkf39shfk2', 'days_ago': 2
    },
    {
        'amount': 450.50, 'status': 'completed', 'description': 'Hotel Advance - Taj Lands End',
        'razorpay_order_id': 'order_Lkf334dfsdf', 'days_ago': 5
    },
    {
        'amount': 120.00, 'status': 'failed', 'description': 'Travel Pass Subscription',
        'razorpay_order_id': 'order_Kkfj934f23', 'days_ago': 10
    },
    {
        'amount': 3000.00, 'status': 'completed', 'description': 'Forex Exchange - USD to INR',
        'razorpay_order_id': 'order_Lk19kdfjs2', 'days_ago': 20
    },
    {
        'amount': 500.00, 'status': 'pending', 'description': 'Visa Processing Fee',
        'razorpay_order_id': 'order_Mk9kdfjs22', 'days_ago': 0
    },
]

for t in transactions:
    record = TransactionRecord.objects.create(
        user=user,
        amount=t['amount'],
        status=t['status'],
        description=t['description'],
        razorpay_order_id=t['razorpay_order_id']
    )
    # Update created_at (requires saving again since auto_now_add overrides on first create)
    record.created_at = now - datetime.timedelta(days=t['days_ago'])
    record.save(update_fields=['created_at'])

print("Successfully seeded fake data for yash30076472@gmail.com")
