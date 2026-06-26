"""
Visa app serializers
"""

from rest_framework import serializers
from .models import VisaData


class VisaDataSerializer(serializers.ModelSerializer):
    """Visa data serializer"""

    class Meta:
        model = VisaData
        fields = [
            'id', 'country', 'visa_required', 'visa_type', 'processing_time',
            'processing_time_days', 'fees', 'currency', 'validity',
            'entry_type', 'max_stay_duration',
            'required_documents', 'exemptions', 'official_link', 'notes', 'updated_at'
        ]
        read_only_fields = ['id', 'updated_at']
