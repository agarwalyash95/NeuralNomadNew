"""
Geography reference models: Country, State, City, TimeZoneInfo
"""

from django.db import models
from apps.common.models import BaseModel


class Country(BaseModel):
    """Country master data."""
    name = models.CharField(max_length=100, unique=True)
    iso_code = models.CharField(max_length=2, unique=True, help_text="ISO 3166-1 alpha-2")
    iso_code_3 = models.CharField(max_length=3, unique=True, help_text="ISO 3166-1 alpha-3")
    currency_code = models.CharField(max_length=3, blank=True, help_text="Default ISO 4217 code")
    phone_code = models.CharField(max_length=10, blank=True)
    continent = models.CharField(
        max_length=20,
        choices=[
            ('africa', 'Africa'),
            ('antarctica', 'Antarctica'),
            ('asia', 'Asia'),
            ('europe', 'Europe'),
            ('north_america', 'North America'),
            ('oceania', 'Oceania'),
            ('south_america', 'South America'),
        ],
        blank=True,
    )
    timezone_default = models.CharField(max_length=50, blank=True)
    flag_emoji = models.CharField(max_length=10, blank=True)

    class Meta:
        verbose_name_plural = 'countries'
        ordering = ['name']

    def __str__(self):
        return f"{self.flag_emoji} {self.name}" if self.flag_emoji else self.name


class State(BaseModel):
    """State / province / region within a country."""
    country = models.ForeignKey(Country, on_delete=models.CASCADE, related_name='states')
    name = models.CharField(max_length=150)
    code = models.CharField(max_length=10, blank=True, help_text="State/province code")

    class Meta:
        ordering = ['name']
        unique_together = [('country', 'name')]

    def __str__(self):
        return f"{self.name}, {self.country.name}"


class City(BaseModel):
    """City master data — the central reference node."""
    state = models.ForeignKey(State, on_delete=models.CASCADE, related_name='cities', null=True, blank=True)
    country = models.ForeignKey(Country, on_delete=models.CASCADE, related_name='cities')
    name = models.CharField(max_length=150)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    population = models.PositiveIntegerField(null=True, blank=True)
    is_major = models.BooleanField(default=False, help_text="Is a major/metro city")
    timezone = models.CharField(max_length=50, blank=True)
    description = models.TextField(blank=True)
    image_url = models.URLField(max_length=500, blank=True)

    class Meta:
        verbose_name_plural = 'cities'
        ordering = ['name']
        unique_together = [('country', 'name')]

    def __str__(self):
        return f"{self.name}, {self.country.name}"


class TimeZoneInfo(BaseModel):
    """Timezone reference data."""
    name = models.CharField(max_length=50, unique=True, help_text="e.g. Asia/Kolkata")
    utc_offset = models.CharField(max_length=10, help_text="e.g. +05:30")
    dst_offset = models.CharField(max_length=10, blank=True, help_text="DST offset if applicable")
    abbreviation = models.CharField(max_length=10, blank=True, help_text="e.g. IST, EST")

    class Meta:
        verbose_name = 'timezone'
        verbose_name_plural = 'timezones'
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.abbreviation})"
