"""
Homepage CMS serializers
"""
from rest_framework import serializers
from .models import Destination, MoodCategory, SeasonalInsight, AIFeatureTile


class MoodCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = MoodCategory
        fields = ['id', 'name', 'slug', 'emoji', 'order']


class DestinationSerializer(serializers.ModelSerializer):
    popularity_score = serializers.SerializerMethodField()

    class Meta:
        model = Destination
        fields = [
            'id', 'name', 'country', 'continent', 'image_url',
            'price_inr', 'duration_days', 'mood_tags',
            'view_count', 'popularity_score',
        ]

    def get_popularity_score(self, obj):
        return round(obj.popularity_score(), 2)


class SeasonalInsightSerializer(serializers.ModelSerializer):
    class Meta:
        model = SeasonalInsight
        fields = ['id', 'country_code', 'continent', 'month', 'tip_text']


class AIFeatureTileSerializer(serializers.ModelSerializer):
    class Meta:
        model = AIFeatureTile
        fields = ['id', 'title', 'description', 'emoji', 'cta_label', 'cta_url', 'order']
