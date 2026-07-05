"""
Seed script for Manali trip inventory.

Adds Manali-specific SearchInventory records (flights DEL→KUU, hotels,
Volvo buses, local cabs) and Manali ForexVendor records.

Usage (from backend directory):
    python manage.py shell < apps/bookings/seed_manali.py

Or if you have django-extensions:
    python manage.py runscript seed_manali
"""

import os
import django
import sys

if __name__ == '__main__':
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.base')
    django.setup()

from apps.bookings.models import SearchInventory, Location
from apps.forex.models import ForexVendor, VendorCurrencyInventory

print("Seeding Manali trip data...")

# ─────────────────────────────────────────────────────────────────────────────
# PART 1: SearchInventory — Manali-specific data
# ─────────────────────────────────────────────────────────────────────────────

manali_inventory = [

    # ── FLIGHTS: Delhi (DEL) → Bhuntar/Kullu (KUU) ──────────────────────────
    # KUU is the closest airport to Manali (~50km drive away)
    {
        "service_type": "flight",
        "title": "IndiGo",
        "code": "6E-2345",
        "origin_city": "Delhi", "origin_code": "DEL",
        "destination_city": "Bhuntar", "destination_code": "KUU",
        "departure_time": "06:30", "arrival_time": "08:15",
        "duration": "1h 45m",
        "days_of_week": ["Mon", "Wed", "Fri", "Sun"],
        "stops": 0,
        "meta": {
            "cabin_classes": [
                {"class": "Economy", "fare_type": "Regular", "price": 5200, "seats_available": 48},
                {"class": "Economy", "fare_type": "Flexi",   "price": 6800, "seats_available": 12},
            ],
            "baggage": "15 kg",
            "meal": "Paid",
            "note": "Nearest airport to Manali — 50 km drive from Bhuntar"
        },
        "providers": [
            {"provider": "IndiGo Direct", "price": 5200, "deeplink": "#"},
            {"provider": "MakeMyTrip",    "price": 5450, "deeplink": "#"},
            {"provider": "EaseMyTrip",    "price": 5600, "deeplink": "#"},
        ]
    },
    {
        "service_type": "flight",
        "title": "SpiceJet",
        "code": "SG-147",
        "origin_city": "Delhi", "origin_code": "DEL",
        "destination_city": "Bhuntar", "destination_code": "KUU",
        "departure_time": "10:15", "arrival_time": "12:00",
        "duration": "1h 45m",
        "days_of_week": ["Tue", "Thu", "Sat"],
        "stops": 0,
        "meta": {
            "cabin_classes": [
                {"class": "Economy",  "fare_type": "Regular",  "price": 4850, "seats_available": 38},
                {"class": "Economy",  "fare_type": "SpiceMax", "price": 6200, "seats_available": 8},
            ],
            "baggage": "15 kg",
            "meal": "Paid",
            "note": "Mid-morning option — more time to explore Manali on arrival day"
        },
        "providers": [
            {"provider": "SpiceJet Direct", "price": 4850, "deeplink": "#"},
            {"provider": "GoIbibo",         "price": 4980, "deeplink": "#"},
        ]
    },
    {
        "service_type": "flight",
        "title": "Air India",
        "code": "AI-443",
        "origin_city": "Delhi", "origin_code": "DEL",
        "destination_city": "Bhuntar", "destination_code": "KUU",
        "departure_time": "07:00", "arrival_time": "08:45",
        "duration": "1h 45m",
        "days_of_week": ["Mon", "Wed", "Fri"],
        "stops": 0,
        "meta": {
            "cabin_classes": [
                {"class": "Economy",  "fare_type": "Regular", "price": 6100,  "seats_available": 42},
                {"class": "Business", "fare_type": "Regular", "price": 18500, "seats_available": 4},
            ],
            "baggage": "25 kg",
            "meal": "Complimentary"
        },
        "providers": [
            {"provider": "Air India Direct", "price": 6100, "deeplink": "#"},
            {"provider": "MakeMyTrip",       "price": 6350, "deeplink": "#"},
        ]
    },

    # ── HOTELS: Manali ────────────────────────────────────────────────────────
    {
        "service_type": "hotel",
        "title": "Zostel Manali",
        "origin_city": "", "destination_city": "Manali",
        "meta": {
            "star_rating": 3,
            "address": "Drifter's Inn, Old Manali Road, Manali, HP 175131",
            "amenities": ["Free WiFi", "Bonfire Area", "Common Lounge", "Mountain View", "Lockers"],
            "rooms": [
                {"type": "Mixed Dorm (8-Bed)", "price_per_night": 650,  "max_guests": 1},
                {"type": "Private Room",       "price_per_night": 2800, "max_guests": 2},
                {"type": "Quad Room",          "price_per_night": 4500, "max_guests": 4},
            ],
            "highlights": "Budget-friendly with great traveller community. 5-min walk from Old Manali cafes."
        },
        "providers": [
            {"provider": "Zostel Direct", "price": 650,  "deeplink": "#"},
            {"provider": "Hostelworld",   "price": 680,  "deeplink": "#"},
        ]
    },
    {
        "service_type": "hotel",
        "title": "The Himalayan",
        "origin_city": "", "destination_city": "Manali",
        "meta": {
            "star_rating": 5,
            "address": "The Mall Road, Manali, HP 175131",
            "amenities": ["Spa", "Multi-Cuisine Restaurant", "Mountain View Rooms", "Gym", "Free WiFi", "Room Service"],
            "rooms": [
                {"type": "Deluxe Mountain View", "price_per_night": 8500,  "max_guests": 2},
                {"type": "Premium Suite",        "price_per_night": 15000, "max_guests": 3},
                {"type": "Family Suite",         "price_per_night": 22000, "max_guests": 5},
            ],
            "highlights": "Flagship 5-star. Rooftop views of Beas River valley. 1km from Mall Road."
        },
        "providers": [
            {"provider": "Himalayan Direct", "price": 8500,  "deeplink": "#"},
            {"provider": "Booking.com",      "price": 8800,  "deeplink": "#"},
            {"provider": "Hotels.com",       "price": 9200,  "deeplink": "#"},
        ]
    },
    {
        "service_type": "hotel",
        "title": "Snow Valley Resorts",
        "origin_city": "", "destination_city": "Manali",
        "meta": {
            "star_rating": 4,
            "address": "Hadimba Devi Road, Manali, HP 175131",
            "amenities": ["Free WiFi", "Restaurant", "Bonfire", "Indoor Games", "Mountain View"],
            "rooms": [
                {"type": "Deluxe Room",    "price_per_night": 4200, "max_guests": 2},
                {"type": "Cottage Suite",  "price_per_night": 7500, "max_guests": 4},
            ],
            "highlights": "Walking distance to Hadimba Temple. Cozy mountain cottages."
        },
        "providers": [
            {"provider": "MakeMyTrip", "price": 4200, "deeplink": "#"},
            {"provider": "Agoda",      "price": 4400, "deeplink": "#"},
        ]
    },
    {
        "service_type": "hotel",
        "title": "The Hosteller Kasol",
        "origin_city": "", "destination_city": "Kasol",
        "meta": {
            "star_rating": 3,
            "address": "Riverside, Kasol, Parvati Valley, HP 175105",
            "amenities": ["Free WiFi", "River View", "Common Kitchen", "Bonfire", "Events"],
            "rooms": [
                {"type": "Dorm Bed (6-Bed)", "price_per_night": 699,  "max_guests": 1},
                {"type": "Private Room",     "price_per_night": 3200, "max_guests": 2},
            ],
            "highlights": "Right on the Parvati river bank. Best social hostel in Kasol."
        },
        "providers": [
            {"provider": "The Hosteller Direct", "price": 699,  "deeplink": "#"},
            {"provider": "Booking.com",          "price": 720,  "deeplink": "#"},
        ]
    },
    {
        "service_type": "hotel",
        "title": "Chalal River Camp",
        "origin_city": "", "destination_city": "Kasol",
        "meta": {
            "star_rating": 3,
            "address": "Chalal Village, 1km from Kasol, Parvati Valley",
            "amenities": ["River View", "Bonfire", "Meal Included", "Trek Access"],
            "rooms": [
                {"type": "Swiss Tent",     "price_per_night": 1800, "max_guests": 2},
                {"type": "Deluxe Cottage", "price_per_night": 3500, "max_guests": 2},
            ],
            "highlights": "Riverside camp near Chalal trek. All meals included. No ATM nearby — carry cash."
        },
        "providers": [
            {"provider": "MakeMyTrip", "price": 1800, "deeplink": "#"},
        ]
    },

    # ── BUSES: Delhi → Manali ─────────────────────────────────────────────────
    {
        "service_type": "bus",
        "title": "Zingbus Volvo",
        "code": "ZB-MNL-01",
        "origin_city": "Delhi", "destination_city": "Manali",
        "departure_time": "18:00", "arrival_time": "08:30+1",
        "duration": "14h 30m",
        "days_of_week": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        "stops": 2,
        "meta": {
            "bus_type": "Volvo AC Multi-Axle Sleeper",
            "seats": [
                {"type": "Lower Sleeper", "price": 1200, "seats_available": 18},
                {"type": "Upper Sleeper", "price": 1100, "seats_available": 12},
            ],
            "amenities": ["Blanket", "Water Bottle", "Charging Point", "GPS Tracked"],
            "boarding_point": "Majnu Ka Tila, Delhi",
            "dropping_point": "Bus Stand, Manali"
        },
        "providers": [
            {"provider": "Zingbus",  "price": 1200, "deeplink": "#"},
            {"provider": "RedBus",   "price": 1250, "deeplink": "#"},
            {"provider": "AbhiBus",  "price": 1280, "deeplink": "#"},
        ]
    },
    {
        "service_type": "bus",
        "title": "HRTC Volvo",
        "code": "HRTC-DL-MNL",
        "origin_city": "Delhi", "destination_city": "Manali",
        "departure_time": "17:30", "arrival_time": "09:00+1",
        "duration": "15h 30m",
        "days_of_week": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        "stops": 3,
        "meta": {
            "bus_type": "Volvo Semi-Sleeper AC",
            "seats": [
                {"type": "Semi-Sleeper", "price": 950, "seats_available": 40},
            ],
            "amenities": ["AC", "Charging Point"],
            "boarding_point": "ISBT Kashmiri Gate, Delhi",
            "dropping_point": "HRTC Bus Stand, Manali",
            "note": "Government bus — reliable and budget option"
        },
        "providers": [
            {"provider": "HRTC Official", "price": 950, "deeplink": "#"},
            {"provider": "RedBus",        "price": 975, "deeplink": "#"},
        ]
    },

    # ── CABS: Local Manali ────────────────────────────────────────────────────
    {
        "service_type": "cab",
        "title": "Solang Valley Full Day",
        "origin_city": "Manali", "destination_city": "Manali",
        "duration": "Full Day (8-9 hrs)",
        "meta": {
            "cab_types": [
                {"type": "Innova / Crysta (7-seater)", "base_fare": 2800, "max_seats": 7,  "note": "Includes Solang, Atal Tunnel, Dhundi"},
                {"type": "Traveller (10-seater)",      "base_fare": 4500, "max_seats": 10, "note": "Best for groups"},
            ],
            "includes": ["Pickup from hotel", "Full day (9 AM – 6 PM)", "Driver allowance"],
            "note": "Atal Rohtang Tunnel permit required separately (₹50/person)"
        },
        "providers": [
            {"provider": "Local Tour Operator, Manali", "price": 2800, "deeplink": "#"},
        ]
    },
    {
        "service_type": "cab",
        "title": "Kasol → Manikaran Day Trip",
        "origin_city": "Kasol", "destination_city": "Manikaran",
        "duration": "Half Day (5-6 hrs)",
        "meta": {
            "cab_types": [
                {"type": "Sumo / Bolero (6-seater)", "base_fare": 1500, "max_seats": 6, "note": "Manikaran hot springs + Sikh Gurudwara"},
                {"type": "Alto / i10 (4-seater)",    "base_fare": 1100, "max_seats": 4},
            ],
            "includes": ["Pickup from Kasol", "Wait at Manikaran (2-3 hrs)", "Drop back to Kasol"]
        },
        "providers": [
            {"provider": "Kasol Local Cabs", "price": 1500, "deeplink": "#"},
        ]
    },
    {
        "service_type": "cab",
        "title": "Rohtang Pass Day Trip",
        "origin_city": "Manali", "destination_city": "Rohtang",
        "duration": "Full Day (9-10 hrs)",
        "meta": {
            "cab_types": [
                {"type": "Innova / Crysta (7-seater)",  "base_fare": 3800, "max_seats": 7},
                {"type": "Traveller (10-seater)",        "base_fare": 5500, "max_seats": 10},
            ],
            "includes": ["Pickup from hotel", "Rohtang Pass (snow activities)", "Driver allowance"],
            "note": "NGT permit required (₹500 for car). Only open May–November."
        },
        "providers": [
            {"provider": "Manali Tour Operators", "price": 3800, "deeplink": "#"},
        ]
    },
]

# ── Locations: Bhuntar/Kullu airport + Manali bus stand ──────────────────────
manali_locations = [
    {
        "name": "Kullu-Manali Airport (Bhuntar)",
        "city": "Bhuntar",
        "code": "KUU",
        "location_type": "airport",
        "country": "India",
    },
    {
        "name": "HRTC Bus Stand Manali",
        "city": "Manali",
        "code": "",
        "location_type": "bus_stop",
        "country": "India",
    },
    {
        "name": "Kasol Village",
        "city": "Kasol",
        "code": "",
        "location_type": "city",
        "country": "India",
    },
]

# Seed inventory
created = 0
for item in manali_inventory:
    SearchInventory.objects.get_or_create(
        service_type=item["service_type"],
        title=item["title"],
        origin_city=item.get("origin_city", ""),
        destination_city=item.get("destination_city", ""),
        defaults=item,
    )
    created += 1

print(f"[OK] Seeded {created} Manali inventory records")

# Seed locations
for loc in manali_locations:
    Location.objects.get_or_create(
        name=loc["name"],
        city=loc["city"],
        defaults=loc,
    )

print(f"[OK] Seeded {len(manali_locations)} Manali location records")

# ─────────────────────────────────────────────────────────────────────────────
# PART 2: Forex — Manali / Kullu vendors
# ─────────────────────────────────────────────────────────────────────────────

manali_forex_vendors = [
    {
        "name": "State Bank of India — Manali Branch",
        "address": "The Mall Road, Manali, Himachal Pradesh 175131",
        "rating": 4.0,
        "is_delivery_available": False,
        "opening_hours": "10:00 AM – 4:00 PM (Mon–Sat, closed 2nd & 4th Sat)",
        "contact_number": "01902-252012",
        "currencies": [],  # INR only — show ATM advisory
        "cash_advisory": "Primary ATM in Manali. May run out during peak season (Oct). Withdraw before leaving Bhuntar."
    },
    {
        "name": "Bhuntar Forex Exchange",
        "address": "Near Bus Stand, Bhuntar, Kullu, HP 175125",
        "rating": 4.2,
        "is_delivery_available": False,
        "opening_hours": "9:00 AM – 6:00 PM (Mon–Sat)",
        "contact_number": "",
        "currencies": ["USD", "EUR", "GBP"],
        "rates": {"USD": 83.50, "EUR": 90.10, "GBP": 105.20},
        "cash_advisory": "Best option for currency exchange near Manali. Limited EUR/GBP stock."
    },
    {
        "name": "Thomas Cook — Kullu",
        "address": "Dhalpur Ground Road, Kullu, HP 175101",
        "rating": 4.5,
        "is_delivery_available": False,
        "opening_hours": "9:30 AM – 6:30 PM (Mon–Sat)",
        "currencies": ["USD", "EUR", "GBP", "SGD"],
        "rates": {"USD": 83.20, "EUR": 89.80, "GBP": 104.90, "SGD": 62.30},
        "cash_advisory": "Most reliable forex outlet near Manali. 30km from Manali town."
    },
]

vendor_created = 0
for v in manali_forex_vendors:
    currencies = v.pop("currencies", [])
    rates = v.pop("rates", {})
    advisory = v.pop("cash_advisory", "")

    vendor, _ = ForexVendor.objects.get_or_create(
        name=v["name"],
        defaults=v,
    )

    for currency in currencies:
        rate = rates.get(currency, 83.0)
        VendorCurrencyInventory.objects.get_or_create(
            vendor=vendor,
            currency=currency,
            defaults={
                "exchange_rate": rate,
                "is_available": True,
            }
        )

    vendor_created += 1

print(f"[OK] Seeded {vendor_created} Manali forex vendor records")
print("\n=== Manali Seeding Complete ===")
print(f"  Flights (DEL→KUU): {SearchInventory.objects.filter(service_type='flight', destination_city__icontains='Bhuntar').count()}")
print(f"  Hotels (Manali):   {SearchInventory.objects.filter(service_type='hotel', destination_city='Manali').count()}")
print(f"  Hotels (Kasol):    {SearchInventory.objects.filter(service_type='hotel', destination_city='Kasol').count()}")
print(f"  Buses (→Manali):   {SearchInventory.objects.filter(service_type='bus', destination_city='Manali').count()}")
print(f"  Cabs (Manali):     {SearchInventory.objects.filter(service_type='cab', origin_city='Manali').count()}")
print(f"  Forex Vendors:     {ForexVendor.objects.filter(address__icontains='Manali').count() + ForexVendor.objects.filter(address__icontains='Kullu').count()}")
