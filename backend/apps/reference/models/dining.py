"""
Dining reference model: RestaurantMaster
"""

from django.db import models
from apps.common.models import BaseModel


class RestaurantMaster(BaseModel):
    """Restaurant knowledge base — curated dining options per city."""
    city = models.ForeignKey('reference.City', on_delete=models.CASCADE, related_name='restaurants')
    name = models.CharField(max_length=250)
    cuisine_type = models.CharField(max_length=100, blank=True, help_text="e.g. Indian, Japanese, Italian")
    price_level = models.PositiveSmallIntegerField(
        null=True, blank=True,
        choices=[(1, '₹'), (2, '₹₹'), (3, '₹₹₹'), (4, '₹₹₹₹')],
        help_text="1=Budget, 4=Fine dining",
    )
    address = models.TextField(blank=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    rating = models.DecimalField(max_digits=3, decimal_places=1, null=True, blank=True)
    is_vegetarian_friendly = models.BooleanField(default=False)
    opening_hours = models.JSONField(
        default=dict, blank=True,
        help_text='e.g. {"mon": "09:00-22:00", "tue": "09:00-22:00"}',
    )
    phone = models.CharField(max_length=20, blank=True)
    website = models.URLField(max_length=500, blank=True)
    description = models.TextField(blank=True)
    images = models.JSONField(default=list, blank=True)

    class Meta:
        ordering = ['-rating', 'name']
        verbose_name = 'restaurant'
        verbose_name_plural = 'restaurants'

    def __str__(self):
        return f"{self.name} — {self.city.name}"
