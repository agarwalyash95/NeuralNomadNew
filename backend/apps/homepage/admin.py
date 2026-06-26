"""
Homepage CMS admin registration
"""
from django.contrib import admin
from .models import Destination, MoodCategory, SeasonalInsight, AIFeatureTile


@admin.register(Destination)
class DestinationAdmin(admin.ModelAdmin):
    list_display = ['name', 'country', 'continent', 'price_inr', 'duration_days', 'view_count', 'is_active']
    list_filter = ['continent', 'is_active']
    search_fields = ['name', 'country']
    list_editable = ['is_active']
    ordering = ['-view_count']


@admin.register(MoodCategory)
class MoodCategoryAdmin(admin.ModelAdmin):
    list_display = ['emoji', 'name', 'slug', 'order', 'is_active']
    list_editable = ['order', 'is_active']
    ordering = ['order']


@admin.register(SeasonalInsight)
class SeasonalInsightAdmin(admin.ModelAdmin):
    list_display = ['country_code', 'month', 'tip_text', 'is_active']
    list_filter = ['country_code', 'month', 'is_active']
    list_editable = ['is_active']
    ordering = ['country_code', 'month']


@admin.register(AIFeatureTile)
class AIFeatureTileAdmin(admin.ModelAdmin):
    list_display = ['emoji', 'title', 'cta_label', 'cta_url', 'order', 'is_active']
    list_editable = ['order', 'is_active']
    ordering = ['order']
