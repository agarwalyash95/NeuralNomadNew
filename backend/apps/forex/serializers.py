"""
Forex app serializers
"""

from rest_framework import serializers
from .models import ForexData, ForexVendor, VendorCurrencyInventory, ForexDeliveryRequest


class ForexDataSerializer(serializers.ModelSerializer):
    """Forex data serializer"""

    class Meta:
        model = ForexData
        fields = [
            'id', 'currency', 'exchange_rate', 'base_currency',
            'source', 'last_updated'
        ]
        read_only_fields = ['id', 'last_updated']


class VendorCurrencyInventorySerializer(serializers.ModelSerializer):
    """Serializer for a vendor's currency inventory item"""

    class Meta:
        model = VendorCurrencyInventory
        fields = [
            'id', 'currency', 'exchange_rate',
            'quantity_available', 'is_available'
        ]
        read_only_fields = ['id']


class ForexVendorSerializer(serializers.ModelSerializer):
    """Serializer for a local forex vendor with nested inventory"""

    inventory = VendorCurrencyInventorySerializer(many=True, read_only=True)

    class Meta:
        model = ForexVendor
        fields = [
            'id', 'name', 'address', 'latitude', 'longitude',
            'contact_number', 'rating', 'is_delivery_available',
            'opening_hours', 'inventory'
        ]
        read_only_fields = ['id']


class ForexDeliveryRequestSerializer(serializers.ModelSerializer):
    """Serializer for a user's forex delivery/pickup request"""

    user = serializers.HiddenField(default=serializers.CurrentUserDefault())
    vendor_name = serializers.CharField(source='vendor.name', read_only=True)
    vendor_address = serializers.CharField(source='vendor.address', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    request_type_display = serializers.CharField(source='get_request_type_display', read_only=True)

    class Meta:
        model = ForexDeliveryRequest
        fields = [
            'id', 'user', 'vendor', 'vendor_name', 'vendor_address',
            'from_currency', 'to_currency', 'amount',
            'exchange_rate', 'converted_amount',
            'request_type', 'request_type_display',
            'status', 'status_display',
            'preferred_date', 'preferred_time', 'contact_number',
            'delivery_address', 'delivery_latitude', 'delivery_longitude',
            'notes', 'created_at'
        ]
        read_only_fields = ['id', 'status', 'exchange_rate', 'converted_amount', 'created_at']

    def validate(self, data):
        """Validate delivery fields and compute converted_amount"""
        request_type = data.get('request_type', 'PICKUP')
        if request_type == 'DELIVERY' and not data.get('delivery_address'):
            raise serializers.ValidationError(
                {'delivery_address': 'Delivery address is required for home delivery requests.'}
            )

        vendor = data.get('vendor')
        to_currency = data.get('to_currency')
        amount = data.get('amount')

        # Look up the vendor's inventory for the requested currency
        try:
            inventory = VendorCurrencyInventory.objects.get(
                vendor=vendor, currency=to_currency, is_available=True
            )
        except VendorCurrencyInventory.DoesNotExist:
            raise serializers.ValidationError(
                {'to_currency': f'Vendor does not have {to_currency} in stock.'}
            )

        rate = inventory.exchange_rate
        data['exchange_rate'] = rate
        data['converted_amount'] = round(float(amount) / float(rate), 2)

        return data
