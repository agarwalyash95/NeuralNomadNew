"""
Bookings app serializers
"""

from rest_framework import serializers
from .models import Booking, SearchInventory, Location


class BookingSerializer(serializers.ModelSerializer):
    """Booking serializer"""

    class Meta:
        model = Booking
        fields = [
            'id', 'user', 'booking_type', 'reference_number', 'status',
            'amount', 'currency', 'booking_date', 'start_date', 'end_date',
            'details', 'payment_confirmed', 'payment_method', 'provider',
            'provider_booking_id', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'user', 'reference_number', 'created_at', 'updated_at']


class SearchInventorySerializer(serializers.ModelSerializer):
    """
    SearchInventory serializer.
    
    Returns all fields needed by the frontend for rendering:
    - Flights/Hotels/Buses/Cabs: Use 'providers' for price comparison
    - Trains: Use 'meta.classes' for availability
    """

    class Meta:
        model = SearchInventory
        fields = [
            'id', 'service_type', 'title', 'code',
            'origin_city', 'destination_city', 'origin_code', 'destination_code',
            'departure_time', 'arrival_time', 'duration', 'days_of_week', 'stops',
            'meta', 'providers', 'is_active',
        ]

class LocationSerializer(serializers.ModelSerializer):
    """Serializer for location autocomplete"""
    class Meta:
        model = Location
        fields = ['id', 'name', 'city', 'code', 'location_type', 'country']
