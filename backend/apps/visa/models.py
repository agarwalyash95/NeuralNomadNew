"""
Visa app models
"""

from django.db import models
from apps.common.models import BaseModel


class VisaData(BaseModel):
    """Visa requirements and information"""

    country = models.CharField(max_length=100, unique=True, db_index=True)
    visa_required = models.BooleanField(default=False)
    visa_type = models.CharField(max_length=100, blank=True)  # e.g., 'Tourist Visa', 'Business Visa'
    processing_time = models.CharField(max_length=100, blank=True)  # e.g., '15-20 days'
    processing_time_days = models.IntegerField(null=True, blank=True)
    fees = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    currency = models.CharField(max_length=3, default='USD')
    validity = models.CharField(max_length=100, blank=True)  # e.g., '6 months'
    entry_type = models.CharField(
        max_length=20,
        choices=[('SINGLE', 'Single Entry'), ('MULTIPLE', 'Multiple Entry'), ('UNKNOWN', 'Unknown')],
        default='UNKNOWN',
        blank=True
    )
    max_stay_duration = models.CharField(max_length=100, blank=True)  # e.g., '30 Days per visit'
    required_documents = models.JSONField(default=list, blank=True)  # e.g., ['Passport', 'Photo', 'Bank Statement']
    exemptions = models.JSONField(default=list, blank=True)  # Countries/regions exempted from visa
    official_link = models.URLField(null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        verbose_name_plural = 'Visa Data'
        ordering = ['country']
        indexes = [
            models.Index(fields=['country']),
            models.Index(fields=['visa_required']),
        ]

    def __str__(self):
        return f'{self.country} - Visa Info'
