"""
Bookings app models

SearchInventory acts as the local travel inventory database.
In the future, replace the SearchInventoryViewSet.search() logic
with calls to a real third-party API (Amadeus, Skyscanner, etc.)
without changing anything in the frontend.
"""

from django.db import models
from django.contrib.auth import get_user_model
from apps.common.models import BaseModel

User = get_user_model()


class Booking(BaseModel):
    """Flight, hotel, and activity bookings"""

    BOOKING_TYPE_CHOICES = [
        ('flight', 'Flight'),
        ('train', 'Train'),
        ('bus', 'Bus'),
        ('hotel', 'Hotel'),
        ('cab', 'Cab'),
    ]

    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('confirmed', 'Confirmed'),
        ('cancelled', 'Cancelled'),
        ('completed', 'Completed'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='bookings')
    booking_type = models.CharField(max_length=20, choices=BOOKING_TYPE_CHOICES)
    reference_number = models.CharField(max_length=100, unique=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=3, default='INR')
    booking_date = models.DateTimeField(auto_now_add=True)
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    details = models.JSONField()  # Flexible storage for booking-specific details
    payment_confirmed = models.BooleanField(default=False)
    payment_method = models.CharField(max_length=50, blank=True)
    provider = models.CharField(
    max_length=100,
    blank=True
    )
    provider_booking_id = models.CharField(
        max_length=255,
        blank=True
    )

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'status']),
            models.Index(fields=['reference_number']),
        ]

    def __str__(self):
        return f'{self.reference_number} - {self.booking_type}'


class SearchInventory(BaseModel):
    """
    Local travel inventory for search results.
    
    HOW TO UPDATE DATA (No Code Required):
    1. Go to http://localhost:8000/admin/
    2. Find "Search Inventory" in the sidebar
    3. Click any entry to edit it, or "+ Add" for a new one
    4. For class/price changes: edit the `meta` JSON field and save.
    
    FUTURE API INTEGRATION:
    When you have a third-party API (e.g., Amadeus, Skyscanner),
    simply replace the search logic in views.SearchInventoryViewSet.search()
    to call the external API. The frontend needs NO changes.
    """

    SERVICE_CHOICES = [
        ('flight', 'Flight'),
        ('train', 'Train'),
        ('hotel', 'Hotel'),
        ('bus', 'Bus'),
        ('cab', 'Cab'),
    ]

    service_type = models.CharField(max_length=20, choices=SERVICE_CHOICES, db_index=True)
    
    # Identification
    title = models.CharField(max_length=200, help_text='e.g., IndiGo, Rajdhani Express, The Leela Palace')
    code = models.CharField(max_length=50, blank=True, help_text='e.g., 6E-312 for flights, 12301 for trains')
    
    # Route
    origin_city = models.CharField(max_length=100, blank=True, help_text='e.g., Delhi, New Delhi')
    destination_city = models.CharField(max_length=100, blank=True, help_text='e.g., Mumbai, Kolkata')
    origin_code = models.CharField(max_length=10, blank=True, help_text='IATA/Station code e.g., DEL, NDLS')
    destination_code = models.CharField(max_length=10, blank=True, help_text='IATA/Station code e.g., BOM, HWH')
    
    # Timing
    departure_time = models.CharField(max_length=20, blank=True, help_text='e.g., 06:00')
    arrival_time = models.CharField(max_length=20, blank=True, help_text='e.g., 08:15 or 09:55+1 for next day')
    duration = models.CharField(max_length=50, blank=True, help_text='e.g., 2h 15m')
    days_of_week = models.JSONField(default=list, blank=True, help_text='e.g., ["Mon", "Wed", "Fri"]')
    stops = models.IntegerField(default=0, help_text='0=Non-Stop, 1=1 Stop, etc.')
    
    # Service-specific data (prices, classes, availability, room types, etc.)
    # Structure depends on service_type — see plan documentation.
    meta = models.JSONField(default=dict, help_text='Service-specific data: cabin classes, train classes, hotel rooms, etc.')
    
    # Price comparison across providers (OTAs) — for all services except trains
    providers = models.JSONField(default=list, blank=True, help_text='List of {provider, price, deeplink} for comparison')
    
    is_active = models.BooleanField(default=True, help_text='Uncheck to hide from search results')

    class Meta:
        ordering = ['service_type', 'title']
        verbose_name = 'Search Inventory'
        verbose_name_plural = 'Search Inventory'
        indexes = [
            models.Index(fields=['service_type', 'is_active']),
            models.Index(fields=['origin_city', 'destination_city']),
        ]

    def __str__(self):
        return f'[{self.get_service_type_display()}] {self.title} ({self.origin_city} → {self.destination_city})'  

class Location(BaseModel):
    """
    Searchable locations for the autocomplete dropdown.
    Includes airports, train stations, cities, etc.
    """
    LOCATION_TYPE_CHOICES = [
        ('airport', 'Airport'),
        ('station', 'Train Station'),
        ('city', 'City'),
        ('bus_stop', 'Bus Stop'),
        ('poi', 'Point of Interest'),
    ]

    name = models.CharField(max_length=200, help_text='e.g., Indira Gandhi International, New Delhi Railway Station')
    city = models.CharField(max_length=100, help_text='e.g., Delhi, Mumbai')
    code = models.CharField(max_length=20, blank=True, help_text='e.g., DEL, NDLS')
    location_type = models.CharField(max_length=20, choices=LOCATION_TYPE_CHOICES, db_index=True)
    country = models.CharField(max_length=100, default='India')

    class Meta:
        ordering = ['city', 'name']
        indexes = [
            models.Index(fields=['location_type', 'city']),
            models.Index(fields=['code']),
        ]

    def __str__(self):
        code_str = f" ({self.code})" if self.code else ""
        return f"{self.name}{code_str}, {self.city}"
