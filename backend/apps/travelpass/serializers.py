"""
Travel Pass app serializers
"""

from rest_framework import serializers

from .models import TravelPass


class TravelPassSerializer(serializers.ModelSerializer):
    """Travel Pass Serializer"""

    class Meta:
        model = TravelPass
        fields = [
            "id",
            "user",
            "title",
            "description",
            "document_type",
            "origin",
            "destination",
            "document_path",
            "pdf_path",
            "valid_from",
            "valid_until",
            "reference_number",
            "status",
            "issuer",
            "seat_info",
            "created_at",
            "updated_at",
        ]

        read_only_fields = (
            "id",
            "user",
            "reference_number",
            "created_at",
            "updated_at",
        )