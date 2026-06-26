"""
Accounts app serializers
"""

from rest_framework import serializers
from django.contrib.auth import authenticate
from .models import User, UserPreference, UploadedDocument, ActivityLog


class UserSerializer(serializers.ModelSerializer):
    """User profile serializer"""

    class Meta:
        model = User
        fields = [
            'id', 'email', 'name', 'phone', 'avatar',
            'preferred_currency', 'home_airport', 'is_active',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'is_active']


class UserDetailSerializer(UserSerializer):
    """Detailed user serializer with preferences"""

    preferences = serializers.SerializerMethodField()

    class Meta(UserSerializer.Meta):
        fields = UserSerializer.Meta.fields + ['preferences']

    def get_preferences(self, obj):
        try:
            preferences = obj.preferences
            return UserPreferenceSerializer(preferences).data
        except UserPreference.DoesNotExist:
            return None


class LoginSerializer(serializers.Serializer):
    """Login serializer"""

    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, data):
        user = authenticate(
            username=data.get('email'),
            password=data.get('password')
        )
        if not user:
            raise serializers.ValidationError('Invalid credentials')
        data['user'] = user
        return data


class RegisterSerializer(serializers.ModelSerializer):
    """User registration serializer"""

    password = serializers.CharField(write_only=True, min_length=8)
    password2 = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ['email', 'name', 'phone', 'password', 'password2']

    def validate(self, data):
        if data['password'] != data['password2']:
            raise serializers.ValidationError('Passwords do not match')
        return data

    def create(self, validated_data):
        validated_data.pop('password2')
        user = User.objects.create_user(**validated_data)
        return user


class UserPreferenceSerializer(serializers.ModelSerializer):
    """User preference serializer"""

    class Meta:
        model = UserPreference
        fields = [
            'id', 'user', 'budget_range_min', 'budget_range_max',
            'favorite_destinations', 'travel_style', 'seat_preference',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class UploadedDocumentSerializer(serializers.ModelSerializer):
    """Uploaded document serializer"""

    class Meta:
        model = UploadedDocument
        fields = ['id', 'user', 'document_type', 'file_path', 'uploaded_at']
        read_only_fields = ['id', 'uploaded_at']


class ActivityLogSerializer(serializers.ModelSerializer):
    """Activity log serializer"""

    class Meta:
        model = ActivityLog
        fields = ['id', 'user', 'action', 'description', 'ip_address', 'created_at']
        read_only_fields = ['id', 'created_at']
