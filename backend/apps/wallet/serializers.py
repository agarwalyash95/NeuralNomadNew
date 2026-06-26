"""
Wallet app serializers
"""

from rest_framework import serializers
from .models import SavedPaymentMethod, TransactionRecord

class SavedPaymentMethodSerializer(serializers.ModelSerializer):
    class Meta:
        model = SavedPaymentMethod
        fields = ['id', 'method_type', 'provider', 'identifier', 'is_default', 'created_at']
        read_only_fields = ['id', 'created_at']

class TransactionRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = TransactionRecord
        fields = ['id', 'amount', 'currency', 'status', 'description', 'created_at', 'razorpay_order_id']
        read_only_fields = ['id', 'created_at']
