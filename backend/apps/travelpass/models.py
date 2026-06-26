"""
Travel Pass app models — Digital document wallet for travelers
"""

from django.db import models
from django.contrib.auth import get_user_model
from apps.common.models import BaseModel

User = get_user_model()


class TravelPass(BaseModel):
    """Digital travel passes and documents owned by a user"""

    DOCUMENT_TYPE_CHOICES = [
        ('FLIGHT', 'Flight Ticket'),
        ('TRAIN', 'Train Ticket'),
        ('BUS', 'Bus Ticket'),
        ('FERRY', 'Ferry / Cruise'),
        ('VISA', 'Visa'),
        ('HOTEL', 'Hotel Booking'),
        ('INSURANCE', 'Travel Insurance'),
        ('PASSPORT', 'Passport Copy'),
        ('OTHER', 'Other Document'),
    ]

    STATUS_CHOICES = [
        ('ACTIVE', 'Active'),
        ('EXPIRED', 'Expired'),
        ('UPCOMING', 'Upcoming'),
        ('USED', 'Used'),
    ]

    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='travel_passes'
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    document_type = models.CharField(
        max_length=20, choices=DOCUMENT_TYPE_CHOICES, default='OTHER'
    )
    # For transport tickets: origin → destination
    origin = models.CharField(max_length=255, blank=True)
    destination = models.CharField(max_length=255, blank=True)

    document_path = models.FileField(upload_to='travel_passes/', null=True, blank=True)
    pdf_path = models.FileField(upload_to='travel_passes_pdf/', null=True, blank=True)

    valid_from = models.DateField(null=True, blank=True)
    valid_until = models.DateField(null=True, blank=True)
    reference_number = models.CharField(max_length=100, unique=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='UPCOMING')
    issuer = models.CharField(max_length=255, blank=True)  # e.g. 'IndiGo', 'IRCTC'
    seat_info = models.CharField(max_length=100, blank=True)  # e.g. 'Seat 14B, Economy'

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'document_type']),
            models.Index(fields=['user', 'status']),
        ]

    def __str__(self):
        return f'{self.user.email} — {self.title} ({self.document_type})'
