"""
Load test data for Travel Pass module.
Creates sample Trips and TravelPasses for a test user.
Run: python load_travelpass_data.py
"""

import os
import sys
import uuid
import django
from decimal import Decimal

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.base')
django.setup()

from django.contrib.auth import get_user_model
from apps.planner.models import Trip
from apps.travelpass.models import TravelPass

User = get_user_model()


def get_or_create_test_user():
    """Get or create a test user for demo data"""
    email = 'testuser@neuralnomad.com'
    user, created = User.objects.get_or_create(
        email=email,
        defaults={
            'name': 'Test Traveler',
            'phone': '9999999999',
            'is_active': True,
        }
    )
    if created:
        user.set_password('testpass123')
        user.save()
        print(f"  Created test user: {email}")
    else:
        print(f"  Using existing test user: {email}")
    return user


def load_trips(user):
    """Create sample trips"""
    print("\nLoading Trips...")
    trips_data = [
        {
            'destination': 'Tokyo, Japan',
            'destination_country': 'Japan',
            'destination_city': 'Tokyo',
            'start_date': '2025-10-15',
            'end_date': '2025-10-28',
            'budget': Decimal('150000.00'),
            'estimated_budget': Decimal('150000.00'),
            'actual_budget': Decimal('0.00'),
            'status': 'booked',
            'trip_type': 'leisure',
            'description': 'Cherry blossom and anime trip!',
        },
        {
            'destination': 'Paris, France',
            'destination_country': 'France',
            'destination_city': 'Paris',
            'start_date': '2025-12-20',
            'end_date': '2025-12-30',
            'budget': Decimal('200000.00'),
            'estimated_budget': Decimal('200000.00'),
            'actual_budget': Decimal('0.00'),
            'status': 'planning',
            'trip_type': 'leisure',
            'description': 'Christmas in Paris!',
        },
        {
            'destination': 'Dubai, UAE',
            'destination_country': 'UAE',
            'destination_city': 'Dubai',
            'start_date': '2025-08-01',
            'end_date': '2025-08-07',
            'budget': Decimal('80000.00'),
            'estimated_budget': Decimal('80000.00'),
            'actual_budget': Decimal('75000.00'),
            'status': 'completed',
            'trip_type': 'leisure',
            'description': 'Summer in Dubai!',
        },
    ]

    created_trips = []
    for td in trips_data:
        trip, _ = Trip.objects.update_or_create(
            user=user,
            destination=td['destination'],
            defaults=td
        )
        print(f"  ✓ {trip.destination}")
        created_trips.append(trip)
    return created_trips


def load_travel_passes(user, trips):
    """Create sample travel passes linked to trips"""
    print("\nLoading Travel Passes...")
    tokyo_trip = trips[0]
    paris_trip = trips[1]
    dubai_trip = trips[2]

    passes_data = [
        # Tokyo trip documents
        {
            'trip': tokyo_trip,
            'title': 'IndiGo Flight — BOM to NRT',
            'document_type': 'FLIGHT',
            'origin': 'Mumbai (BOM)',
            'destination': 'Tokyo Narita (NRT)',
            'valid_from': '2025-10-15',
            'valid_until': '2025-10-15',
            'status': 'UPCOMING',
            'issuer': 'IndiGo Airlines',
            'seat_info': '14B — Economy',
        },
        {
            'trip': tokyo_trip,
            'title': 'Japan Tourist Visa',
            'document_type': 'VISA',
            'origin': '',
            'destination': 'Japan',
            'valid_from': '2025-10-10',
            'valid_until': '2026-01-10',
            'status': 'ACTIVE',
            'issuer': 'Embassy of Japan',
            'seat_info': '',
        },
        {
            'trip': tokyo_trip,
            'title': 'APA Hotel Tokyo Shinjuku',
            'document_type': 'HOTEL',
            'origin': 'Tokyo',
            'destination': '',
            'valid_from': '2025-10-15',
            'valid_until': '2025-10-28',
            'status': 'UPCOMING',
            'issuer': 'APA Hotels',
            'seat_info': 'Room 608, Superior Twin',
        },
        {
            'trip': tokyo_trip,
            'title': 'HDFC Travel Insurance — Japan',
            'document_type': 'INSURANCE',
            'origin': '',
            'destination': 'Japan',
            'valid_from': '2025-10-14',
            'valid_until': '2025-10-29',
            'status': 'UPCOMING',
            'issuer': 'HDFC ERGO',
            'seat_info': 'Cover: ₹1 Cr Medical',
        },
        # Paris trip documents
        {
            'trip': paris_trip,
            'title': 'Air France — BOM to CDG',
            'document_type': 'FLIGHT',
            'origin': 'Mumbai (BOM)',
            'destination': 'Paris CDG',
            'valid_from': '2025-12-20',
            'valid_until': '2025-12-20',
            'status': 'UPCOMING',
            'issuer': 'Air France',
            'seat_info': '22C — Economy',
        },
        {
            'trip': paris_trip,
            'title': 'Schengen Visa — France',
            'document_type': 'VISA',
            'origin': '',
            'destination': 'Schengen Area',
            'valid_from': '2025-12-15',
            'valid_until': '2026-06-15',
            'status': 'ACTIVE',
            'issuer': 'French Embassy',
            'seat_info': 'Multiple Entry — 90 Days',
        },
        # Dubai trip (completed)
        {
            'trip': dubai_trip,
            'title': 'Emirates — BOM to DXB',
            'document_type': 'FLIGHT',
            'origin': 'Mumbai (BOM)',
            'destination': 'Dubai (DXB)',
            'valid_from': '2025-08-01',
            'valid_until': '2025-08-01',
            'status': 'USED',
            'issuer': 'Emirates',
            'seat_info': '8A — Business',
        },
        {
            'trip': dubai_trip,
            'title': 'Dubai Metro Day Pass',
            'document_type': 'OTHER',
            'origin': 'Dubai Metro',
            'destination': '',
            'valid_from': '2025-08-02',
            'valid_until': '2025-08-07',
            'status': 'USED',
            'issuer': 'RTA Dubai',
            'seat_info': '',
        },
        # Standalone (no trip)
        {
            'trip': None,
            'title': 'Indian Passport',
            'document_type': 'PASSPORT',
            'origin': '',
            'destination': '',
            'valid_from': '2020-03-01',
            'valid_until': '2030-03-01',
            'status': 'ACTIVE',
            'issuer': 'Government of India',
            'seat_info': 'P1234567',
        },
    ]

    for pd in passes_data:
        ref = f"TP-{uuid.uuid4().hex[:8].upper()}"
        # Avoid duplicates by title+user
        existing = TravelPass.objects.filter(user=user, title=pd['title']).first()
        if existing:
            print(f"  ↩ Skipping existing: {pd['title']}")
            continue
        TravelPass.objects.create(
            user=user,
            reference_number=ref,
            **pd
        )
        print(f"  ✓ {pd['document_type']}: {pd['title']}")

    print(f"\n✅ Done! {TravelPass.objects.filter(user=user).count()} travel passes loaded for {user.email}.")
    print(f"\n   Test login: {user.email} / testpass123")


if __name__ == '__main__':
    print("=== Loading Travel Pass Test Data ===")
    user = get_or_create_test_user()
    trips = load_trips(user)
    load_travel_passes(user, trips)
