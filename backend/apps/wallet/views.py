"""
Wallet app views (Payment Methods & Billing)
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
import datetime

from .models import SavedPaymentMethod, TransactionRecord
from .serializers import SavedPaymentMethodSerializer, TransactionRecordSerializer
from .payment_gateway import create_order, verify_payment_signature


class PaymentMethodViewSet(viewsets.ModelViewSet):
    """Viewset for managing Saved Payment Methods"""
    serializer_class = SavedPaymentMethodSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return SavedPaymentMethod.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class TransactionViewSet(viewsets.ReadOnlyModelViewSet):
    """Viewset for Transaction History with time filtering"""
    serializer_class = TransactionRecordSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = TransactionRecord.objects.filter(user=self.request.user)
        
        # Time-based filters
        time_filter = self.request.query_params.get('time_filter', 'all')
        now = timezone.now()
        
        if time_filter == '7days':
            queryset = queryset.filter(created_at__gte=now - datetime.timedelta(days=7))
        elif time_filter == 'this_month':
            queryset = queryset.filter(created_at__year=now.year, created_at__month=now.month)
        elif time_filter == '3months':
            queryset = queryset.filter(created_at__gte=now - datetime.timedelta(days=90))
            
        return queryset


class CheckoutViewSet(viewsets.ViewSet):
    """Viewset for initiating and verifying payments"""
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['post'])
    def create_order(self, request):
        amount = request.data.get('amount')
        description = request.data.get('description', 'Booking Payment')
        
        if not amount or float(amount) <= 0:
            return Response({'error': 'Invalid amount'}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            # Create transaction record as pending
            record = TransactionRecord.objects.create(
                user=request.user,
                amount=float(amount),
                description=description,
                status='pending'
            )
            
            # Create Razorpay order
            order = create_order(float(amount), receipt_id=str(record.id))
            
            # Update record with order id
            record.razorpay_order_id = order['id']
            record.save()
            
            return Response({
                'order_id': order['id'],
                'amount': order['amount'],
                'currency': order['currency']
            })
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['post'])
    def verify_payment(self, request):
        razorpay_payment_id = request.data.get('razorpay_payment_id')
        razorpay_order_id = request.data.get('razorpay_order_id')
        razorpay_signature = request.data.get('razorpay_signature')
        
        if verify_payment_signature(razorpay_order_id, razorpay_payment_id, razorpay_signature):
            try:
                record = TransactionRecord.objects.get(razorpay_order_id=razorpay_order_id, user=request.user)
                record.status = 'completed'
                record.razorpay_payment_id = razorpay_payment_id
                record.save()
                return Response({'status': 'Payment successful'})
            except TransactionRecord.DoesNotExist:
                return Response({'error': 'Transaction not found'}, status=status.HTTP_404_NOT_FOUND)
        else:
            try:
                record = TransactionRecord.objects.get(razorpay_order_id=razorpay_order_id, user=request.user)
                record.status = 'failed'
                record.save()
            except TransactionRecord.DoesNotExist:
                pass
            return Response({'error': 'Invalid payment signature'}, status=status.HTTP_400_BAD_REQUEST)
