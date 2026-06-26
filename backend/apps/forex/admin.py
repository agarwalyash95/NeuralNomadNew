"""
Forex app admin
"""

from django.contrib import admin
from .models import ForexData


@admin.register(ForexData)
class ForexDataAdmin(admin.ModelAdmin):
    list_display = ('currency', 'exchange_rate', 'base_currency', 'source', 'last_updated')
    list_filter = ('currency', 'base_currency')
    search_fields = ('currency', 'source')
    readonly_fields = ('created_at', 'updated_at', 'last_updated')
