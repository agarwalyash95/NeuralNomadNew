"""
Wallet app admin
"""

from django.contrib import admin
from .models import SavedPaymentMethod, TransactionRecord

@admin.register(SavedPaymentMethod)
class SavedPaymentMethodAdmin(admin.ModelAdmin):
    list_display = ['user', 'method_type', 'provider', 'identifier', 'is_default', 'created_at']
    list_filter = ['method_type', 'provider', 'is_default']
    search_fields = ['user__email', 'provider', 'identifier']

@admin.register(TransactionRecord)
class TransactionRecordAdmin(admin.ModelAdmin):
    list_display = ['user', 'amount', 'currency', 'status', 'created_at']
    list_filter = ['status', 'currency', 'created_at']
    search_fields = ['user__email', 'razorpay_order_id', 'description']
