"""
Travel Pass app admin
"""

from django.contrib import admin
from .models import TravelPass


@admin.register(TravelPass)
class TravelPassAdmin(admin.ModelAdmin):
    list_display = ('reference_number', 'user', 'document_type', 'valid_from', 'valid_until', 'created_at')
    list_filter = ('document_type', 'valid_from', 'valid_until')
    search_fields = ('user__email', 'reference_number', 'title')
    readonly_fields = ('reference_number', 'created_at', 'updated_at')
