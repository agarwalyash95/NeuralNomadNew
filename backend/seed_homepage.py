"""
seed_homepage.py — Populate homepage CMS with initial data.
Run: python manage.py shell -c "exec(open('seed_homepage.py', encoding='utf-8').read())" --settings=config.settings.base
"""
import os
import django

from apps.homepage.models import Destination, MoodCategory, SeasonalInsight, AIFeatureTile

# ─────────────────────────────────────────
# 1. Mood Categories
# ─────────────────────────────────────────
MoodCategory.objects.all().delete()

moods = [
    {'name': 'All',          'slug': 'all',         'emoji': '✨', 'order': 0},
    {'name': 'Beach',        'slug': 'beach',        'emoji': '🏖', 'order': 1},
    {'name': 'Mountains',    'slug': 'mountains',    'emoji': '🏔', 'order': 2},
    {'name': 'City Break',   'slug': 'city',         'emoji': '🏙', 'order': 3},
    {'name': 'Nature',       'slug': 'nature',       'emoji': '🌿', 'order': 4},
    {'name': 'Romantic',     'slug': 'romantic',     'emoji': '💍', 'order': 5},
    {'name': 'Family',       'slug': 'family',       'emoji': '👨‍👩‍👧', 'order': 6},
    {'name': 'Budget',       'slug': 'budget',       'emoji': '💰', 'order': 7},
    {'name': 'Adventure',    'slug': 'adventure',    'emoji': '🎒', 'order': 8},
]
for m in moods:
    MoodCategory.objects.create(**m)

print(f"[OK] Created {len(moods)} mood categories")

# ─────────────────────────────────────────
# 2. Destinations
# ─────────────────────────────────────────
Destination.objects.all().delete()

destinations = [
    {
        'name': 'Bali',
        'country': 'Indonesia',
        'continent': 'Asia',
        'image_url': 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=800&q=80',
        'price_inr': 45000,
        'duration_days': 5,
        'mood_tags': ['beach', 'romantic', 'nature'],
        'view_count': 1240,
        'booking_count': 87,
    },
    {
        'name': 'Tokyo',
        'country': 'Japan',
        'continent': 'Asia',
        'image_url': 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=800&q=80',
        'price_inr': 89999,
        'duration_days': 7,
        'mood_tags': ['city', 'adventure', 'family'],
        'view_count': 980,
        'booking_count': 62,
    },
    {
        'name': 'Dubai',
        'country': 'UAE',
        'continent': 'Asia',
        'image_url': 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=800&q=80',
        'price_inr': 39999,
        'duration_days': 4,
        'mood_tags': ['city', 'budget', 'family'],
        'view_count': 875,
        'booking_count': 95,
    },
    {
        'name': 'Singapore',
        'country': 'Singapore',
        'continent': 'Asia',
        'image_url': 'https://images.unsplash.com/photo-1508964942454-1a56651d54ac?w=800&q=80',
        'price_inr': 55000,
        'duration_days': 5,
        'mood_tags': ['city', 'family', 'adventure'],
        'view_count': 720,
        'booking_count': 54,
    },
    {
        'name': 'Paris',
        'country': 'France',
        'continent': 'Europe',
        'image_url': 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800&q=80',
        'price_inr': 120000,
        'duration_days': 7,
        'mood_tags': ['city', 'romantic'],
        'view_count': 650,
        'booking_count': 43,
    },
    {
        'name': 'Goa',
        'country': 'India',
        'continent': 'Asia',
        'image_url': 'https://images.unsplash.com/photo-1614082242765-7c98ca0f3df3?w=800&q=80',
        'price_inr': 15000,
        'duration_days': 3,
        'mood_tags': ['beach', 'budget', 'nature'],
        'view_count': 1100,
        'booking_count': 120,
    },
    {
        'name': 'Maldives',
        'country': 'Maldives',
        'continent': 'Asia',
        'image_url': 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80',
        'price_inr': 180000,
        'duration_days': 6,
        'mood_tags': ['beach', 'romantic'],
        'view_count': 540,
        'booking_count': 31,
    },
    {
        'name': 'Manali',
        'country': 'India',
        'continent': 'Asia',
        'image_url': 'https://images.unsplash.com/photo-1598862901406-7b8c40c6f1d7?w=800&q=80',
        'price_inr': 18000,
        'duration_days': 5,
        'mood_tags': ['mountains', 'adventure', 'nature', 'budget'],
        'view_count': 860,
        'booking_count': 78,
    },
]

for d in destinations:
    Destination.objects.create(**d)

print(f"[OK] Created {len(destinations)} destinations")

# ─────────────────────────────────────────
# 3. Seasonal Insights (India — all 12 months)
# ─────────────────────────────────────────
SeasonalInsight.objects.all().delete()

insights = [
    {'country_code': 'IN', 'month': 1,  'tip_text': '❄️ Perfect time for Rajasthan & South India — cool & dry weather.'},
    {'country_code': 'IN', 'month': 2,  'tip_text': '🌸 February is ideal for Goa beach trips before the summer heat.'},
    {'country_code': 'IN', 'month': 3,  'tip_text': '🌺 Holi season! Great time to visit Mathura, Vrindavan & Jaipur.'},
    {'country_code': 'IN', 'month': 4,  'tip_text': '🏔 Book Himachal & Uttarakhand before summer crowds arrive.'},
    {'country_code': 'IN', 'month': 5,  'tip_text': '🌊 Head to hill stations — Ooty, Coorg, Shimla for a summer escape.'},
    {'country_code': 'IN', 'month': 6,  'tip_text': '🌧 Monsoon begins — Kerala & Coorg are stunning in the rains.'},
    {'country_code': 'IN', 'month': 7,  'tip_text': '🌿 July is great for Spiti Valley & Ladakh — clear skies in the high altitude.'},
    {'country_code': 'IN', 'month': 8,  'tip_text': '🏞 Independence Day long weekend — great time for Northeast India.'},
    {'country_code': 'IN', 'month': 9,  'tip_text': '✈️ Shoulder season for Europe — cheaper flights, fewer crowds.'},
    {'country_code': 'IN', 'month': 10, 'tip_text': '🌴 Maldives & Bali peak season starts — book now for best prices.'},
    {'country_code': 'IN', 'month': 11, 'tip_text': '🐅 Best time for Ranthambore & Corbett National Park wildlife safaris.'},
    {'country_code': 'IN', 'month': 12, 'tip_text': '🎄 December is peak Goa season — Christmas parties & beach vibes!'},
]

for insight in insights:
    SeasonalInsight.objects.create(**insight)

print(f"[OK] Created {len(insights)} seasonal insights")

# ─────────────────────────────────────────
# 4. AI Feature Tiles
# ─────────────────────────────────────────
AIFeatureTile.objects.all().delete()

features = [
    {
        'title': 'AI Itinerary Builder',
        'description': 'Tell our AI your dream destination and get a full day-by-day plan in seconds.',
        'emoji': '🤖',
        'cta_label': 'Plan a trip →',
        'cta_url': '#',
        'order': 1,
    },
    {
        'title': 'Forex Intelligence',
        'description': 'Live exchange rates, best time to convert, and instant currency calculator.',
        'emoji': '💱',
        'cta_label': 'Check rates →',
        'cta_url': '/travel-prep',
        'order': 2,
    },
    {
        'title': 'Visa Guide',
        'description': 'Country-specific visa requirements, processing times, and document checklist.',
        'emoji': '🛂',
        'cta_label': 'Check visa →',
        'cta_url': '/travel-prep',
        'order': 3,
    },
]

for f in features:
    AIFeatureTile.objects.create(**f)

print(f"[OK] Created {len(features)} AI feature tiles")
print("\n[DONE] Homepage seed complete!")
