"""
Accommodation reference model: HotelMaster
"""

from django.db import models
from apps.common.models import BaseModel


class HotelMaster(BaseModel):
    """Hotel knowledge base — static reference data, not live availability."""
    city = models.ForeignKey('reference.City', on_delete=models.CASCADE, related_name='hotels')
    name = models.CharField(max_length=250)
    stars = models.PositiveSmallIntegerField(
        null=True, blank=True,
        choices=[(i, f'{i} Star') for i in range(1, 6)],
    )
    hotel_type = models.CharField(
        max_length=30,
        choices=[
            ('hotel', 'Hotel'),
            ('resort', 'Resort'),
            ('boutique', 'Boutique'),
            ('hostel', 'Hostel'),
            ('homestay', 'Homestay'),
            ('villa', 'Villa'),
            ('guesthouse', 'Guesthouse'),
            ('apartment', 'Apartment'),
        ],
        default='hotel',
    )
    address = models.TextField(blank=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    amenities = models.JSONField(default=list, blank=True, help_text='e.g. ["pool","spa","wifi"]')
    price_range = models.CharField(
        max_length=20,
        choices=[
            ('budget', 'Budget'),
            ('mid_range', 'Mid-range'),
            ('premium', 'Premium'),
            ('luxury', 'Luxury'),
        ],
        default='mid_range',
    )
    rating = models.DecimalField(max_digits=3, decimal_places=1, null=True, blank=True)
    review_count = models.PositiveIntegerField(default=0)
    images = models.JSONField(default=list, blank=True, help_text="List of image URLs")
    description = models.TextField(blank=True)
    website = models.URLField(max_length=500, blank=True)

    class Meta:
        ordering = ['-rating', 'name']
        verbose_name = 'hotel'
        verbose_name_plural = 'hotels'

    def __str__(self):
        stars = f" {'★' * self.stars}" if self.stars else ''
        return f"{self.name}{stars} — {self.city.name}"
