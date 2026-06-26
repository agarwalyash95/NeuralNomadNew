"""
Homepage CMS models — drives the dynamic landing page.
All data is public (not user-specific) and managed via Django admin.
"""
from django.db import models
from apps.common.models import BaseModel


class MoodCategory(BaseModel):
    """Mood pill labels shown in the navbar filter on the homepage."""

    name = models.CharField(max_length=50)
    slug = models.SlugField(unique=True)
    emoji = models.CharField(max_length=10)
    order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['order']
        verbose_name_plural = 'Mood Categories'

    def __str__(self):
        return f'{self.emoji} {self.name}'


class Destination(BaseModel):
    """
    A travel destination card shown on the landing page.
    mood_tags is a JSON array of slugs matching MoodCategory.slug,
    e.g. ["beach", "romantic"]
    """

    CONTINENT_CHOICES = [
        ('Asia', 'Asia'),
        ('Europe', 'Europe'),
        ('Africa', 'Africa'),
        ('North America', 'North America'),
        ('South America', 'South America'),
        ('Oceania', 'Oceania'),
    ]

    name = models.CharField(max_length=100)
    country = models.CharField(max_length=100)
    continent = models.CharField(max_length=50, choices=CONTINENT_CHOICES)
    image_url = models.URLField(max_length=500)
    price_inr = models.PositiveIntegerField(help_text='Starting price in INR')
    duration_days = models.PositiveSmallIntegerField()
    # JSON array of mood slugs: ["beach", "romantic"]
    mood_tags = models.JSONField(default=list, blank=True)
    is_active = models.BooleanField(default=True)
    # Popularity signals
    view_count = models.PositiveIntegerField(default=0)
    booking_count = models.PositiveIntegerField(
        default=0,
        help_text='Manually updated or synced from bookings'
    )

    class Meta:
        ordering = ['-view_count']

    def popularity_score(self):
        return (self.view_count * 0.6) + (self.booking_count * 0.4)

    def __str__(self):
        return f'{self.name}, {self.country}'


class SeasonalInsight(BaseModel):
    """
    Location + month-based travel tips shown in the insights ribbon.
    country_code is ISO 3166-1 alpha-2 (e.g. "IN" for India).
    month is 1–12.
    """

    country_code = models.CharField(
        max_length=2,
        help_text='ISO 2-letter country code, e.g. IN'
    )
    continent = models.CharField(
        max_length=50,
        blank=True,
        help_text='Continent-level fallback if country not matched'
    )
    month = models.PositiveSmallIntegerField(
        help_text='Month number 1–12'
    )
    tip_text = models.CharField(max_length=255)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['month']
        unique_together = ['country_code', 'month']

    def __str__(self):
        return f'{self.country_code} — Month {self.month}: {self.tip_text[:50]}'


class AIFeatureTile(BaseModel):
    """
    The 3-tile AI features strip at the bottom of the homepage.
    Managed entirely from Django admin.
    """

    title = models.CharField(max_length=100)
    description = models.CharField(max_length=200)
    emoji = models.CharField(max_length=10)
    cta_label = models.CharField(max_length=50, default='Try it →')
    cta_url = models.CharField(max_length=200, help_text='Internal path, e.g. /ai-planner')
    order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return self.title
