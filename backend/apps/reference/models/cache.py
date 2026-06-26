"""
Cache reference models: GooglePlaceCache, WeatherNormals
"""

from django.db import models
from apps.common.models import BaseModel


class GooglePlaceCache(BaseModel):
    """Cached Google Places API responses — reduces live API calls."""
    google_place_id = models.CharField(max_length=300, unique=True)
    name = models.CharField(max_length=250)
    address = models.TextField(blank=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    rating = models.DecimalField(max_digits=3, decimal_places=1, null=True, blank=True)
    types = models.JSONField(default=list, blank=True, help_text="Google place types")
    photos = models.JSONField(default=list, blank=True, help_text="Photo references")
    opening_hours = models.JSONField(default=dict, blank=True)
    phone = models.CharField(max_length=20, blank=True)
    website = models.URLField(max_length=500, blank=True)
    cached_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Google Place cache'
        verbose_name_plural = 'Google Place caches'

    def __str__(self):
        return self.name


class WeatherNormals(BaseModel):
    """Historical weather averages per city per month — no API needed for planning."""
    city = models.ForeignKey('reference.City', on_delete=models.CASCADE, related_name='weather_normals')
    month = models.PositiveSmallIntegerField(help_text="1-12")
    avg_temp_high = models.DecimalField(max_digits=5, decimal_places=1, null=True, blank=True, help_text="°C")
    avg_temp_low = models.DecimalField(max_digits=5, decimal_places=1, null=True, blank=True, help_text="°C")
    avg_rainfall_mm = models.DecimalField(max_digits=6, decimal_places=1, null=True, blank=True)
    avg_humidity = models.PositiveSmallIntegerField(null=True, blank=True, help_text="Percentage")
    weather_description = models.CharField(max_length=200, blank=True, help_text="e.g. Hot and humid")

    class Meta:
        unique_together = [('city', 'month')]
        ordering = ['city', 'month']
        verbose_name = 'weather normals'
        verbose_name_plural = 'weather normals'

    def __str__(self):
        months = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        return f"{self.city.name} — {months[self.month]}"
