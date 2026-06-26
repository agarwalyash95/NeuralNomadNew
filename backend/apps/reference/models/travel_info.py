"""
Travel info reference models: VisaRequirement, Currency, HolidayCalendar, TravelSeason
"""

from django.db import models
from apps.common.models import BaseModel


class VisaRequirement(BaseModel):
    """Visa rules matrix between countries."""
    from_country = models.ForeignKey(
        'reference.Country', on_delete=models.CASCADE, related_name='visa_from',
    )
    to_country = models.ForeignKey(
        'reference.Country', on_delete=models.CASCADE, related_name='visa_to',
    )
    visa_required = models.BooleanField(default=True)
    visa_type = models.CharField(
        max_length=30,
        choices=[
            ('e_visa', 'E-Visa'),
            ('on_arrival', 'On Arrival'),
            ('sticker', 'Sticker Visa'),
            ('visa_free', 'Visa Free'),
            ('eta', 'ETA'),
        ],
        blank=True,
    )
    processing_days = models.PositiveIntegerField(null=True, blank=True)
    fee = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    fee_currency = models.CharField(max_length=3, default='USD')
    validity = models.CharField(max_length=100, blank=True, help_text="e.g. 30 days, 90 days, 1 year")
    required_documents = models.JSONField(default=list, blank=True)
    exemptions = models.JSONField(default=list, blank=True)
    official_link = models.URLField(max_length=500, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        unique_together = [('from_country', 'to_country')]
        verbose_name = 'visa requirement'
        verbose_name_plural = 'visa requirements'

    def __str__(self):
        status = "Required" if self.visa_required else "Not Required"
        return f"{self.from_country.iso_code} → {self.to_country.iso_code}: {status}"


class Currency(BaseModel):
    """Currency master data."""
    code = models.CharField(max_length=3, unique=True, help_text="ISO 4217 code")
    name = models.CharField(max_length=100)
    symbol = models.CharField(max_length=10)
    country = models.ForeignKey(
        'reference.Country', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='currencies',
    )
    decimal_places = models.PositiveSmallIntegerField(default=2)

    class Meta:
        verbose_name_plural = 'currencies'
        ordering = ['code']

    def __str__(self):
        return f"{self.code} ({self.symbol})"


class HolidayCalendar(BaseModel):
    """Public holidays per country."""
    country = models.ForeignKey(
        'reference.Country', on_delete=models.CASCADE, related_name='holidays',
    )
    name = models.CharField(max_length=200)
    date = models.DateField()
    holiday_type = models.CharField(
        max_length=20,
        choices=[
            ('national', 'National'),
            ('regional', 'Regional'),
            ('religious', 'Religious'),
            ('optional', 'Optional'),
        ],
        default='national',
    )
    is_public = models.BooleanField(default=True)

    class Meta:
        ordering = ['date']
        verbose_name = 'holiday'
        verbose_name_plural = 'holidays'

    def __str__(self):
        return f"{self.name} ({self.country.iso_code}) — {self.date}"


class TravelSeason(BaseModel):
    """Tourism seasonality data for a city."""
    city = models.ForeignKey('reference.City', on_delete=models.CASCADE, related_name='travel_seasons')
    season_type = models.CharField(
        max_length=20,
        choices=[
            ('peak', 'Peak Season'),
            ('shoulder', 'Shoulder Season'),
            ('off_peak', 'Off-Peak Season'),
        ],
    )
    start_month = models.PositiveSmallIntegerField(help_text="1-12")
    end_month = models.PositiveSmallIntegerField(help_text="1-12")
    description = models.TextField(blank=True)
    crowd_level = models.CharField(
        max_length=15,
        choices=[
            ('low', 'Low'),
            ('moderate', 'Moderate'),
            ('high', 'High'),
            ('very_high', 'Very High'),
        ],
        default='moderate',
    )

    class Meta:
        ordering = ['city', 'start_month']
        verbose_name = 'travel season'
        verbose_name_plural = 'travel seasons'

    def __str__(self):
        return f"{self.city.name} — {self.get_season_type_display()} ({self.start_month}-{self.end_month})"
