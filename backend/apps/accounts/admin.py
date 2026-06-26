"""
Accounts app admin configuration
"""

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, UserPreference, UploadedDocument, ActivityLog


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    """Custom User admin"""

    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        ('Personal Info', {'fields': ('name', 'phone', 'avatar')}),
        ('Preferences', {'fields': ('preferred_currency', 'home_airport')}),
        ('Permissions', {'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        ('Important dates', {'fields': ('last_login', 'created_at', 'updated_at')}),
    )

    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'password1', 'password2'),
        }),
    )

    list_display = ('email', 'name', 'is_active', 'created_at')
    list_filter = ('is_active', 'is_staff', 'created_at')
    search_fields = ('email', 'name')
    ordering = ('-created_at',)
    readonly_fields = ('created_at', 'updated_at', 'last_login')


@admin.register(UserPreference)
class UserPreferenceAdmin(admin.ModelAdmin):
    """User preference admin"""

    list_display = ('user', 'travel_style', 'seat_preference', 'created_at')
    list_filter = ('travel_style', 'seat_preference')
    search_fields = ('user__email',)
    readonly_fields = ('created_at', 'updated_at')


@admin.register(UploadedDocument)
class UploadedDocumentAdmin(admin.ModelAdmin):
    """Uploaded document admin"""

    list_display = ('user', 'document_type', 'uploaded_at')
    list_filter = ('document_type', 'uploaded_at')
    search_fields = ('user__email', 'document_type')
    readonly_fields = ('created_at', 'updated_at', 'uploaded_at')


@admin.register(ActivityLog)
class ActivityLogAdmin(admin.ModelAdmin):
    """Activity log admin"""

    list_display = ('user', 'action', 'created_at')
    list_filter = ('action', 'created_at')
    search_fields = ('user__email', 'action')
    readonly_fields = ('created_at', 'updated_at')
