from rest_framework import serializers
from .models import Attraction, Destination

class DestinationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Destination
        fields = [
            'id', 'city', 'country', 'description', 
            'popularity_score', 'best_time_to_visit', 
            'currency', 'timezone'
        ]

class AttractionSerializer(serializers.ModelSerializer):
    # Dynamically build the destination object and missing fields to satisfy the frontend contract
    destination = serializers.SerializerMethodField()
    ticket_price = serializers.DecimalField(source='entry_fee', max_digits=10, decimal_places=2, read_only=True)
    is_featured = serializers.SerializerMethodField()

    class Meta:
        model = Attraction
        fields = [
            'id', 'destination', 'name', 'description', 'place_id',
            'latitude', 'longitude', 'address', 'category', 'rating',
            'review_count', 'opening_hours', 'ticket_price', 'image_url', 'is_featured',
            'price_level', 'editorial_summary', 'business_status', 'google_maps_url',
            'formatted_phone_number', 'international_phone_number',
            'wheelchair_accessible_entrance', 'reservable',
            'serves_beer', 'serves_wine', 'serves_vegetarian_food',
            'dine_in', 'takeout', 'delivery',
            'secondary_images', 'reviews', 'ticket_info', 'estimated_duration'
        ]

    def get_destination(self, obj):
        # Attempt to link rich Destination data if it exists in the DB
        dest = Destination.objects.filter(city__iexact=obj.city, country__iexact=obj.country).first()
        if dest:
            return DestinationSerializer(dest).data
        
        # Fallback payload matching the frontend TypeScript interface
        return {
            "id": 0,
            "city": obj.city,
            "country": obj.country,
            "description": "",
            "popularity_score": 0,
            "best_time_to_visit": "",
            "currency": "",
            "timezone": ""
        }

    def get_is_featured(self, obj):
        # Simulate 'featured' logic based on high ratings since it's not a database column
        return obj.rating is not None and obj.rating >= 4.5