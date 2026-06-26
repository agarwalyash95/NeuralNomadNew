"""
Visa app admin
"""

from django.contrib import admin
from .models import VisaData


@admin.register(VisaData)
class VisaDataAdmin(admin.ModelAdmin):
    list_display = ('country', 'visa_required', 'visa_type', 'fees', 'currency', 'updated_at')
    list_filter = ('visa_required', 'currency')
    search_fields = ('country', 'visa_type')
    readonly_fields = ('created_at', 'updated_at')
    fieldsets = (
        ('Basic Info', {
            'fields': ('country', 'visa_required', 'visa_type')
        }),
        ('Processing', {
            'fields': ('processing_time', 'processing_time_days', 'validity')
        }),
        ('Fees', {
            'fields': ('fees', 'currency')
        }),
        ('Documents & Exemptions', {
            'fields': ('required_documents', 'exemptions')
        }),
        ('Additional Info', {
            'fields': ('official_link', 'notes')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
