"""
Attractions app admin
"""

from django.contrib import admin
from .models import Attraction


@admin.register(Attraction)
class AttractionAdmin(admin.ModelAdmin):
    list_display = ('name', 'city', 'country', 'category', 'rating', 'created_at')
    list_filter = ('category', 'country', 'city', 'rating')
    search_fields = ('name', 'city', 'country', 'description')
    readonly_fields = ('created_at', 'updated_at', 'place_id')
    fieldsets = (
        ('Basic Info', {
            'fields': ('place_id', 'name', 'category', 'description')
        }),
        ('Location', {
            'fields': ('city', 'country', 'address', 'latitude', 'longitude')
        }),
        ('Details', {
            'fields': ('rating', 'review_count', 'entry_fee', 'phone', 'website')
        }),
        ('Media', {
            'fields': ('image_url',)
        }),
        ('Hours', {
            'fields': ('opening_hours',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
