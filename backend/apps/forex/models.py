"""
Forex app models
"""

from django.db import models
from django.conf import settings
from apps.common.models import BaseModel


class ForexData(BaseModel):
    """Currency exchange rate data"""

    CURRENCY_CHOICES = [
        ('INR', 'Indian Rupee'),
        ('USD', 'US Dollar'),
        ('EUR', 'Euro'),
        ('GBP', 'British Pound'),
        ('AED', 'UAE Dirham'),
        ('SGD', 'Singapore Dollar'),
        ('MYR', 'Malaysian Ringgit'),
        ('JPY', 'Japanese Yen'),
        ('AUD', 'Australian Dollar'),
        ('CAD', 'Canadian Dollar'),
    ]

    currency = models.CharField(max_length=3, unique=True, db_index=True, choices=CURRENCY_CHOICES)
    exchange_rate = models.DecimalField(max_digits=15, decimal_places=6)  # Rate relative to base currency (INR)
    base_currency = models.CharField(max_length=3, default='INR')
    source = models.CharField(max_length=100, blank=True)  # e.g., 'RBI', 'ECB', etc.
    last_updated = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = 'Forex Data'
        ordering = ['currency']
        indexes = [
            models.Index(fields=['currency']),
        ]

    def __str__(self):
        return f'{self.currency} - {self.exchange_rate}'


class ForexVendor(BaseModel):
    """Local forex vendor / money exchange outlet"""

    name = models.CharField(max_length=200)
    address = models.TextField()
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    contact_number = models.CharField(max_length=20, blank=True)
    rating = models.DecimalField(max_digits=3, decimal_places=1, default=0.0)
    is_delivery_available = models.BooleanField(default=False)
    opening_hours = models.CharField(max_length=100, blank=True)  # e.g., "9am - 6pm"

    class Meta:
        verbose_name = 'Forex Vendor'
        verbose_name_plural = 'Forex Vendors'
        ordering = ['-rating']

    def __str__(self):
        return f'{self.name} ({self.address[:40]})'


class VendorCurrencyInventory(BaseModel):
    """Tracks which currencies a vendor has and at what rate"""

    CURRENCY_CHOICES = ForexData.CURRENCY_CHOICES

    vendor = models.ForeignKey(
        ForexVendor,
        on_delete=models.CASCADE,
        related_name='inventory'
    )
    currency = models.CharField(max_length=3, choices=CURRENCY_CHOICES)
    exchange_rate = models.DecimalField(max_digits=15, decimal_places=6)  # Vendor-specific rate
    quantity_available = models.DecimalField(
        max_digits=15, decimal_places=2, null=True, blank=True,
        help_text='Available foreign currency quantity'
    )
    is_available = models.BooleanField(default=True)

    class Meta:
        verbose_name = 'Vendor Currency Inventory'
        verbose_name_plural = 'Vendor Currency Inventories'
        unique_together = ('vendor', 'currency')
        ordering = ['currency']

    def __str__(self):
        return f'{self.vendor.name} — {self.currency} @ {self.exchange_rate}'


class ForexDeliveryRequest(BaseModel):
    """A user's request for forex via pickup or home delivery"""

    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('APPROVED', 'Approved'),
        ('DELIVERED', 'Delivered'),
        ('CANCELLED', 'Cancelled'),
    ]

    REQUEST_TYPE_CHOICES = [
        ('PICKUP', 'Store Pickup'),
        ('DELIVERY', 'Home Delivery'),
    ]

    CURRENCY_CHOICES = ForexData.CURRENCY_CHOICES

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='forex_requests'
    )
    vendor = models.ForeignKey(
        ForexVendor,
        on_delete=models.CASCADE,
        related_name='delivery_requests'
    )
    from_currency = models.CharField(max_length=3, choices=CURRENCY_CHOICES, default='INR')
    to_currency = models.CharField(max_length=3, choices=CURRENCY_CHOICES)
    amount = models.DecimalField(max_digits=15, decimal_places=2)  # Amount in from_currency
    exchange_rate = models.DecimalField(max_digits=15, decimal_places=6)  # Rate locked at time of request
    converted_amount = models.DecimalField(max_digits=15, decimal_places=2)  # Amount in to_currency

    request_type = models.CharField(max_length=10, choices=REQUEST_TYPE_CHOICES, default='PICKUP')
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='PENDING')

    # Scheduling
    preferred_date = models.DateField()
    preferred_time = models.TimeField()
    contact_number = models.CharField(max_length=20)

    # Delivery-specific (required if request_type == 'DELIVERY')
    delivery_address = models.TextField(blank=True)
    delivery_latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    delivery_longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)

    notes = models.TextField(blank=True)

    class Meta:
        verbose_name = 'Forex Delivery Request'
        verbose_name_plural = 'Forex Delivery Requests'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.user} — {self.from_currency} to {self.to_currency} ({self.request_type})'
