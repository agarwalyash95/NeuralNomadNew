"""
Attractions reference models: AttractionMaster, ActivityMaster
"""

from django.db import models
from apps.common.models import BaseModel


class AttractionMaster(BaseModel):
    """Attraction / landmark / point of interest knowledge base."""
    city = models.ForeignKey('reference.City', on_delete=models.CASCADE, related_name='attractions')
    name = models.CharField(max_length=250)
    category = models.CharField(
        max_length=30,
        choices=[
            ('monument', 'Monument'),
            ('temple', 'Temple'),
            ('museum', 'Museum'),
            ('park', 'Park'),
            ('beach', 'Beach'),
            ('fort', 'Fort'),
            ('palace', 'Palace'),
            ('market', 'Market'),
            ('viewpoint', 'Viewpoint'),
            ('zoo', 'Zoo'),
            ('waterfall', 'Waterfall'),
            ('lake', 'Lake'),
            ('garden', 'Garden'),
            ('religious', 'Religious Site'),
            ('historic', 'Historic Site'),
            ('other', 'Other'),
        ],
        default='other',
    )
    description = models.TextField(blank=True)
    address = models.TextField(blank=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    rating = models.DecimalField(max_digits=3, decimal_places=1, null=True, blank=True)
    entry_fee = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    fee_currency = models.CharField(max_length=3, default='INR')
    duration_minutes = models.PositiveIntegerField(null=True, blank=True, help_text="Recommended visit duration")
    opening_hours = models.JSONField(default=dict, blank=True)
    best_time = models.CharField(max_length=100, blank=True, help_text="e.g. Morning, October-March")
    images = models.JSONField(default=list, blank=True)

    class Meta:
        ordering = ['-rating', 'name']
        verbose_name = 'attraction'
        verbose_name_plural = 'attractions'

    def __str__(self):
        return f"{self.name} — {self.city.name}"


class ActivityMaster(BaseModel):
    """Activity / experience knowledge base."""
    city = models.ForeignKey('reference.City', on_delete=models.CASCADE, related_name='activities')
    name = models.CharField(max_length=250)
    category = models.CharField(
        max_length=30,
        choices=[
            ('adventure', 'Adventure'),
            ('water_sport', 'Water Sport'),
            ('cultural', 'Cultural'),
            ('food_tour', 'Food Tour'),
            ('nightlife', 'Nightlife'),
            ('wellness', 'Wellness'),
            ('shopping', 'Shopping'),
            ('photography', 'Photography'),
            ('wildlife', 'Wildlife'),
            ('trekking', 'Trekking'),
            ('cycling', 'Cycling'),
            ('cooking_class', 'Cooking Class'),
            ('workshop', 'Workshop'),
            ('other', 'Other'),
        ],
        default='other',
    )
    description = models.TextField(blank=True)
    duration_minutes = models.PositiveIntegerField(null=True, blank=True)
    price_range = models.CharField(
        max_length=20,
        choices=[
            ('free', 'Free'),
            ('budget', 'Budget'),
            ('mid_range', 'Mid-range'),
            ('premium', 'Premium'),
            ('luxury', 'Luxury'),
        ],
        default='mid_range',
    )
    difficulty_level = models.CharField(
        max_length=15,
        choices=[
            ('easy', 'Easy'),
            ('moderate', 'Moderate'),
            ('challenging', 'Challenging'),
            ('extreme', 'Extreme'),
        ],
        default='easy',
    )
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    provider = models.CharField(max_length=200, blank=True)
    booking_required = models.BooleanField(default=False)
    rating = models.DecimalField(max_digits=3, decimal_places=1, null=True, blank=True)
    images = models.JSONField(default=list, blank=True)

    class Meta:
        ordering = ['-rating', 'name']
        verbose_name = 'activity'
        verbose_name_plural = 'activities'

    def __str__(self):
        return f"{self.name} — {self.city.name}"
