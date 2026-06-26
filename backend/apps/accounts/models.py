"""
Accounts app models
Custom User model and authentication-related models
"""

from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from apps.common.models import BaseModel


class UserManager(BaseUserManager):
    """Custom user manager for email-based authentication"""

    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('The Email field must be set')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin, BaseModel):
    """
    Custom User model for NeuralNomad
    Replaces default Django User model
    """

    CURRENCY_CHOICES = [
        ('INR', 'Indian Rupee'),
        ('USD', 'US Dollar'),
        ('EUR', 'Euro'),
        ('GBP', 'British Pound'),
        ('AED', 'UAE Dirham'),
        ('SGD', 'Singapore Dollar'),
        ('MYR', 'Malaysian Ringgit'),
    ]

    email = models.EmailField(unique=True)
    name = models.CharField(max_length=255)
    phone = models.CharField(max_length=20)
    avatar = models.ImageField(upload_to='avatars/', null=True, blank=True)
    preferred_currency = models.CharField(
        max_length=3,
        choices=CURRENCY_CHOICES,
        default='INR'
    )
    is_email_verified = models.BooleanField(
    default=False
    )

    is_phone_verified = models.BooleanField(
        default=False
    )

    home_city = models.CharField(
        max_length=100,
        blank=True
    )
    home_airport = models.CharField(max_length=10, null=True, blank=True)

    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    is_superuser = models.BooleanField(default=False)

    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['name']

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['email']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return self.email


class UserPreference(BaseModel):
    """User travel preferences and settings"""

    TRAVEL_STYLE_CHOICES = [
        ('luxury', 'Luxury'),
        ('budget', 'Budget'),
        ('mid-range', 'Mid-Range'),
        ('adventure', 'Adventure'),
    ]

    SEAT_PREFERENCE_CHOICES = [
        ('aisle', 'Aisle'),
        ('window', 'Window'),
        ('any', 'Any'),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='preferences')
    budget_range_min = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    budget_range_max = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    favorite_destinations = models.JSONField(default=list, blank=True)
    travel_style = models.CharField(
        max_length=20,
        choices=TRAVEL_STYLE_CHOICES,
        default='mid-range'
    )
    seat_preference = models.CharField(
        max_length=10,
        choices=SEAT_PREFERENCE_CHOICES,
        default='any'
    )

    class Meta:
        verbose_name_plural = 'User Preferences'

    def __str__(self):
        return f'{self.user.email} - Preferences'


class UploadedDocument(BaseModel):
    """Documents uploaded by users (passport, visa, etc.)"""

    DOCUMENT_TYPE_CHOICES = [
        ('passport', 'Passport'),
        ('visa', 'Visa'),
        ('ticket', 'Ticket'),
        ('hotel_booking', 'Hotel Booking'),
        ('insurance', 'Insurance'),
        ('other', 'Other'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='documents')
    document_type = models.CharField(max_length=50, choices=DOCUMENT_TYPE_CHOICES)
    file_path = models.FileField(upload_to='documents/')
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-uploaded_at']
        indexes = [
            models.Index(fields=['user', 'document_type']),
        ]

    def __str__(self):
        return f'{self.user.email} - {self.document_type}'


class ActivityLog(BaseModel):
    """Activity log for user actions"""

    ACTION_CHOICES = [
        ('login', 'Login'),
        ('logout', 'Logout'),
        ('create_trip', 'Create Trip'),
        ('update_trip', 'Update Trip'),
        ('delete_trip', 'Delete Trip'),
        ('save_place', 'Save Place'),
        ('unsave_place', 'Unsave Place'),
        ('send_message', 'Send Message'),
        ('other', 'Other'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='activity_logs')
    action = models.CharField(max_length=100, choices=ACTION_CHOICES)
    description = models.TextField(blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'created_at']),
        ]

    def __str__(self):
        return f'{self.user.email} - {self.action}'
