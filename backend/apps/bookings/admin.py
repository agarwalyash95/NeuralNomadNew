"""
Bookings app admin

HOW TO UPDATE SEARCH INVENTORY DATA (No Code Required):
1. Go to http://localhost:8000/admin/
2. Log in with your superuser credentials
3. Find "Search Inventory" in the left sidebar
4. Click any row to edit, or click "+ Add" to create a new entry

EDITING THE `meta` FIELD:
  The meta field is a JSON object. Each service type has a different structure:
  
  FLIGHT meta:
  {
    "cabin_classes": [
      {"class": "Economy", "fare_type": "Regular", "price": 4500, "seats_available": 42},
      {"class": "Business","fare_type": "Regular", "price": 14500,"seats_available": 6}
    ],
    "baggage": "15kg",
    "meal": "Paid"
  }
  
  TRAIN meta:
  {
    "classes": [
      {"class": "SL", "label": "Sleeper Class",  "price": 690,  "availability": "AVAILABLE-142"},
      {"class": "3A", "label": "AC 3-Tier",       "price": 1845, "availability": "WL/12"},
      {"class": "2A", "label": "AC 2-Tier",       "price": 2745, "availability": "AVAILABLE-8"}
    ],
    "pantry": true
  }
  
  HOTEL meta:
  {
    "star_rating": 5,
    "address": "Goa Beach Road",
    "amenities": ["Pool", "Spa", "WiFi"],
    "rooms": [
      {"type": "Deluxe Room", "price_per_night": 8500, "max_guests": 2}
    ]
  }
  
  BUS meta:
  {
    "bus_type": "AC Sleeper",
    "seats": [
      {"type": "Sleeper", "price": 850, "seats_available": 22},
      {"type": "Semi-Sleeper", "price": 650, "seats_available": 14}
    ]
  }
  
  CAB meta:
  {
    "cab_types": [
      {"type": "Hatchback", "price_per_km": 12, "base_fare": 200, "max_seats": 4},
      {"type": "Sedan",     "price_per_km": 14, "base_fare": 250, "max_seats": 4},
      {"type": "SUV",       "price_per_km": 18, "base_fare": 350, "max_seats": 7}
    ]
  }
"""

from django.contrib import admin
from .models import Booking, SearchInventory


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = ('reference_number', 'user', 'booking_type', 'status', 'amount', 'created_at')
    list_filter = ('booking_type', 'status', 'payment_confirmed', 'created_at')
    search_fields = ('user__email', 'reference_number')
    readonly_fields = ('reference_number', 'created_at', 'updated_at')
    fieldsets = (
        ('User & Booking Info', {
            'fields': ('user', 'booking_type', 'reference_number', 'status')
        }),
        ('Dates', {
            'fields': ('booking_date', 'start_date', 'end_date')
        }),
        ('Payment', {
            'fields': ('amount', 'currency', 'payment_confirmed', 'payment_method')
        }),
        ('Details', {
            'fields': ('details',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(SearchInventory)
class SearchInventoryAdmin(admin.ModelAdmin):
    list_display = ('title', 'service_type', 'origin_city', 'destination_city', 'code', 'departure_time', 'arrival_time', 'is_active')
    list_filter = ('service_type', 'is_active', 'stops')
    search_fields = ('title', 'code', 'origin_city', 'destination_city', 'origin_code', 'destination_code')
    list_editable = ('is_active',)
    readonly_fields = ('created_at', 'updated_at')
    fieldsets = (
        ('Service & Identification', {
            'fields': ('service_type', 'title', 'code', 'is_active')
        }),
        ('Route', {
            'fields': ('origin_city', 'origin_code', 'destination_city', 'destination_code')
        }),
        ('Schedule', {
            'fields': ('departure_time', 'arrival_time', 'duration', 'days_of_week', 'stops')
        }),
        ('Pricing & Classes (meta)', {
            'description': 'Edit the JSON below to change prices, add/remove classes, availability, etc. See the admin.py comments for the exact structure per service type.',
            'fields': ('meta',)
        }),
        ('Price Comparison Providers', {
            'description': 'OTA providers for price comparison (flights, hotels, buses, cabs). Leave empty for trains.',
            'fields': ('providers',),
            'classes': ('collapse',),
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
