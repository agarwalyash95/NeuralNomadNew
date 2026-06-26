"""
Attractions app models
"""

from django.db import models
from apps.common.models import BaseModel


class Attraction(BaseModel):
    """Attractions and places of interest"""

    CATEGORY_CHOICES = [
        ('museum', 'Museum'),
        ('temple', 'Temple'),
        ('monument', 'Monument'),
        ('restaurant', 'Restaurant'),
        ('park', 'Park'),
        ('beach', 'Beach'),
        ('shopping', 'Shopping'),
        ('entertainment', 'Entertainment'),
        ('tourist_attraction', 'Tourist Attraction'),
        ('amusement_park', 'Amusement Park'),
        ('local_activities', 'Local Activities'),
        ('other', 'Other'),
    ]

    place_id = models.CharField(max_length=255, unique=True)  # External API ID
    name = models.CharField(max_length=255, db_index=True)
    description = models.TextField(blank=True)
    category = models.CharField(max_length=50, choices=CATEGORY_CHOICES, default='other')
    city = models.CharField(max_length=100, db_index=True)
    country = models.CharField(max_length=100, db_index=True)
    address = models.TextField(blank=True)
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    rating = models.FloatField(null=True, blank=True)
    review_count = models.IntegerField(default=0)
    image_url = models.URLField(max_length=1000, null=True, blank=True)
    opening_hours = models.JSONField(null=True, blank=True)  # e.g., {"Monday": "9:00-17:00"}
    entry_fee = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    price_level = models.IntegerField(null=True, blank=True)  # Google Places price level (0-4)
    website = models.URLField(null=True, blank=True)
    
    # --- Deep Detail Fields (Lazy Fetched) ---
    # General
    editorial_summary = models.TextField(blank=True, null=True)
    business_status = models.CharField(max_length=50, blank=True, null=True)
    google_maps_url = models.URLField(max_length=1000, null=True, blank=True)
    formatted_phone_number = models.CharField(max_length=50, blank=True, null=True)
    international_phone_number = models.CharField(max_length=50, blank=True, null=True)
    wheelchair_accessible_entrance = models.BooleanField(null=True, blank=True)
    reservable = models.BooleanField(null=True, blank=True)

    # Restaurant Specific
    serves_beer = models.BooleanField(null=True, blank=True)
    serves_wine = models.BooleanField(null=True, blank=True)
    serves_vegetarian_food = models.BooleanField(null=True, blank=True)
    dine_in = models.BooleanField(null=True, blank=True)
    takeout = models.BooleanField(null=True, blank=True)
    delivery = models.BooleanField(null=True, blank=True)

    # Rich Media & Reviews
    secondary_images = models.JSONField(default=list, blank=True)
    reviews = models.JSONField(default=list, blank=True)

    # Activity Specific
    ticket_info = models.JSONField(null=True, blank=True)
    estimated_duration = models.CharField(max_length=100, blank=True, null=True)

    class Meta:
        ordering = ['-rating']
        indexes = [
            models.Index(fields=['city', 'country']),
            models.Index(fields=['category']),
        ]

    def __str__(self):
        return f'{self.name} - {self.city}, {self.country}'

class Destination(BaseModel):
    country = models.CharField(max_length=100)

    city = models.CharField(max_length=100)

    description = models.TextField(blank=True)

    currency = models.CharField(max_length=10)

    timezone = models.CharField(max_length=100)

    best_time_to_visit = models.TextField(blank=True)

    popularity_score = models.FloatField(default=0)

    def __str__(self):
        return f"{self.city}, {self.country}"