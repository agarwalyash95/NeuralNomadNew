"""
Seed script for SearchInventory dummy data.

Usage (from backend directory):
    python manage.py shell < apps/bookings/seed_inventory.py
    
Or run it as a management command:
    python manage.py runscript seed_inventory  (requires django-extensions)
"""

import os
import django
import sys

# Allow running directly: python seed_inventory.py
if __name__ == '__main__':
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.base')
    django.setup()

from apps.bookings.models import SearchInventory

# Clear existing inventory
SearchInventory.objects.all().delete()
print("Cleared existing inventory...")

inventory = [
    # ── FLIGHTS ──────────────────────────────────────────────────────────────
    {
        "service_type": "flight",
        "title": "IndiGo",
        "code": "6E-312",
        "origin_city": "Delhi", "origin_code": "DEL",
        "destination_city": "Mumbai", "destination_code": "BOM",
        "departure_time": "06:00", "arrival_time": "08:15",
        "duration": "2h 15m",
        "days_of_week": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        "stops": 0,
        "meta": {
            "cabin_classes": [
                {"class": "Economy", "fare_type": "Regular", "price": 4500, "seats_available": 62},
                {"class": "Economy", "fare_type": "Flexi",   "price": 5800, "seats_available": 24},
            ],
            "baggage": "15kg", "meal": "Paid"
        },
        "providers": [
            {"provider": "Skyscanner",  "price": 4500, "deeplink": "#"},
            {"provider": "MakeMyTrip",  "price": 4620, "deeplink": "#"},
            {"provider": "GoIbibo",     "price": 4750, "deeplink": "#"},
            {"provider": "EaseMyTrip",  "price": 4900, "deeplink": "#"},
        ]
    },
    {
        "service_type": "flight",
        "title": "Air India",
        "code": "AI-101",
        "origin_city": "Delhi", "origin_code": "DEL",
        "destination_city": "Mumbai", "destination_code": "BOM",
        "departure_time": "07:30", "arrival_time": "09:50",
        "duration": "2h 20m",
        "days_of_week": ["Mon", "Wed", "Fri", "Sun"],
        "stops": 0,
        "meta": {
            "cabin_classes": [
                {"class": "Economy",  "fare_type": "Regular", "price": 5200, "seats_available": 48},
                {"class": "Business", "fare_type": "Regular", "price": 18500,"seats_available": 8},
            ],
            "baggage": "25kg", "meal": "Complimentary"
        },
        "providers": [
            {"provider": "Air India Direct", "price": 5200, "deeplink": "#"},
            {"provider": "MakeMyTrip",       "price": 5350, "deeplink": "#"},
            {"provider": "Expedia",          "price": 5600, "deeplink": "#"},
        ]
    },
    {
        "service_type": "flight",
        "title": "Vistara",
        "code": "UK-836",
        "origin_city": "Mumbai", "origin_code": "BOM",
        "destination_city": "Bangalore", "destination_code": "BLR",
        "departure_time": "10:00", "arrival_time": "11:45",
        "duration": "1h 45m",
        "days_of_week": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        "stops": 0,
        "meta": {
            "cabin_classes": [
                {"class": "Economy",  "fare_type": "Regular", "price": 3800, "seats_available": 55},
                {"class": "Economy",  "fare_type": "Flexi",   "price": 5100, "seats_available": 20},
                {"class": "Business", "fare_type": "Regular", "price": 14000,"seats_available": 6},
            ],
            "baggage": "20kg", "meal": "Complimentary"
        },
        "providers": [
            {"provider": "Skyscanner",  "price": 3800, "deeplink": "#"},
            {"provider": "EaseMyTrip",  "price": 3900, "deeplink": "#"},
            {"provider": "GoIbibo",     "price": 4000, "deeplink": "#"},
        ]
    },
    {
        "service_type": "flight",
        "title": "SpiceJet",
        "code": "SG-8169",
        "origin_city": "Delhi", "origin_code": "DEL",
        "destination_city": "Goa", "destination_code": "GOI",
        "departure_time": "14:30", "arrival_time": "17:00",
        "duration": "2h 30m",
        "days_of_week": ["Tue", "Thu", "Sat", "Sun"],
        "stops": 0,
        "meta": {
            "cabin_classes": [
                {"class": "Economy", "fare_type": "Regular", "price": 5100, "seats_available": 38},
                {"class": "Economy", "fare_type": "SpiceMax","price": 6800, "seats_available": 12},
            ],
            "baggage": "15kg", "meal": "Paid"
        },
        "providers": [
            {"provider": "SpiceJet Direct","price": 5100, "deeplink": "#"},
            {"provider": "MakeMyTrip",     "price": 5250, "deeplink": "#"},
            {"provider": "Skyscanner",     "price": 5400, "deeplink": "#"},
        ]
    },

    # ── TRAINS ────────────────────────────────────────────────────────────────
    {
        "service_type": "train",
        "title": "Rajdhani Express",
        "code": "12301",
        "origin_city": "New Delhi", "origin_code": "NDLS",
        "destination_city": "Kolkata", "destination_code": "HWH",
        "departure_time": "16:55", "arrival_time": "09:55+1",
        "duration": "17h",
        "days_of_week": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        "stops": 4,
        "meta": {
            "classes": [
                {"class": "2A", "label": "AC 2-Tier",    "price": 2745, "availability": "AVAILABLE-34"},
                {"class": "3A", "label": "AC 3-Tier",    "price": 1845, "availability": "AVAILABLE-112"},
                {"class": "1A", "label": "First AC",     "price": 4620, "availability": "AVAILABLE-4"},
            ],
            "quotas": ["GN", "TQ", "LD", "HP"], "pantry": True
        },
        "providers": []
    },
    {
        "service_type": "train",
        "title": "Vande Bharat Express",
        "code": "20978",
        "origin_city": "Delhi", "origin_code": "NDLS",
        "destination_city": "Jaipur", "destination_code": "JP",
        "departure_time": "06:10", "arrival_time": "10:30",
        "duration": "4h 20m",
        "days_of_week": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
        "stops": 2,
        "meta": {
            "classes": [
                {"class": "CC", "label": "AC Chair Car", "price": 1050, "availability": "AVAILABLE-42"},
                {"class": "EC", "label": "Exec Chair Car","price": 2150, "availability": "WL/12"},
            ],
            "quotas": ["GN", "TQ", "LD"], "pantry": True
        },
        "providers": []
    },
    {
        "service_type": "train",
        "title": "Duronto Express",
        "code": "12267",
        "origin_city": "Mumbai", "origin_code": "MMCT",
        "destination_city": "Delhi", "destination_code": "NDLS",
        "departure_time": "23:00", "arrival_time": "17:25+1",
        "duration": "18h 25m",
        "days_of_week": ["Mon", "Wed", "Fri"],
        "stops": 0,
        "meta": {
            "classes": [
                {"class": "SL", "label": "Sleeper Class", "price": 590,  "availability": "AVAILABLE-200"},
                {"class": "3A", "label": "AC 3-Tier",     "price": 1565, "availability": "AVAILABLE-64"},
                {"class": "2A", "label": "AC 2-Tier",     "price": 2345, "availability": "RAC-8"},
                {"class": "1A", "label": "First AC",      "price": 3950, "availability": "AVAILABLE-2"},
            ],
            "quotas": ["GN", "TQ", "HP"], "pantry": True
        },
        "providers": []
    },

    # ── HOTELS ────────────────────────────────────────────────────────────────
    {
        "service_type": "hotel",
        "title": "The Leela Palace",
        "code": "",
        "origin_city": "", "destination_city": "Goa",
        "meta": {
            "star_rating": 5,
            "address": "Mobor, Cavelossim, South Goa",
            "amenities": ["Pool", "Spa", "WiFi", "Gym", "Restaurant", "Beach Access"],
            "rooms": [
                {"type": "Deluxe Room",    "price_per_night": 8500, "max_guests": 2},
                {"type": "Premier Suite",  "price_per_night": 22000,"max_guests": 4},
            ]
        },
        "providers": [
            {"provider": "Booking.com",  "price": 8500, "deeplink": "#"},
            {"provider": "Hotels.com",   "price": 8750, "deeplink": "#"},
            {"provider": "Agoda",        "price": 9000, "deeplink": "#"},
        ]
    },
    {
        "service_type": "hotel",
        "title": "Taj Mahal Palace",
        "code": "",
        "origin_city": "", "destination_city": "Mumbai",
        "meta": {
            "star_rating": 5,
            "address": "Apollo Bunder, Colaba, Mumbai",
            "amenities": ["Pool", "Spa", "WiFi", "Gym", "5 Restaurants", "Sea View"],
            "rooms": [
                {"type": "Luxury Room",    "price_per_night": 15000, "max_guests": 2},
                {"type": "Sea View Suite", "price_per_night": 35000, "max_guests": 3},
            ]
        },
        "providers": [
            {"provider": "Taj Direct",   "price": 15000, "deeplink": "#"},
            {"provider": "Booking.com",  "price": 15500, "deeplink": "#"},
            {"provider": "Expedia",      "price": 16000, "deeplink": "#"},
        ]
    },
    {
        "service_type": "hotel",
        "title": "Zostel Delhi",
        "code": "",
        "origin_city": "", "destination_city": "Delhi",
        "meta": {
            "star_rating": 3,
            "address": "Paharganj, New Delhi",
            "amenities": ["WiFi", "Common Kitchen", "Lockers"],
            "rooms": [
                {"type": "Dorm Bed (8-Bed)", "price_per_night": 650, "max_guests": 1},
                {"type": "Private Room",     "price_per_night": 2200,"max_guests": 2},
            ]
        },
        "providers": [
            {"provider": "Zostel Direct", "price": 650, "deeplink": "#"},
            {"provider": "Hostelworld",   "price": 700, "deeplink": "#"},
        ]
    },

    # ── BUSES ─────────────────────────────────────────────────────────────────
    {
        "service_type": "bus",
        "title": "VRL Travels",
        "code": "VRL-1245",
        "origin_city": "Bangalore", "destination_city": "Goa",
        "departure_time": "21:30", "arrival_time": "07:00+1",
        "duration": "9h 30m",
        "days_of_week": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        "stops": 3,
        "meta": {
            "bus_type": "AC Sleeper",
            "seats": [
                {"type": "Sleeper",      "price": 850, "seats_available": 22},
                {"type": "Semi-Sleeper", "price": 650, "seats_available": 14},
            ]
        },
        "providers": [
            {"provider": "RedBus",   "price": 850, "deeplink": "#"},
            {"provider": "AbhiBus",  "price": 875, "deeplink": "#"},
        ]
    },
    {
        "service_type": "bus",
        "title": "KSRTC Airavata",
        "code": "KSRTC-A1",
        "origin_city": "Bangalore", "destination_city": "Mysore",
        "departure_time": "07:00", "arrival_time": "10:30",
        "duration": "3h 30m",
        "days_of_week": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        "stops": 2,
        "meta": {
            "bus_type": "AC Seater",
            "seats": [
                {"type": "AC Seater", "price": 380, "seats_available": 40},
            ]
        },
        "providers": [
            {"provider": "KSRTC Official", "price": 380, "deeplink": "#"},
            {"provider": "RedBus",         "price": 395, "deeplink": "#"},
        ]
    },

    # ── CABS ──────────────────────────────────────────────────────────────────
    {
        "service_type": "cab",
        "title": "Delhi → Agra Outstation",
        "code": "",
        "origin_city": "Delhi", "destination_city": "Agra",
        "duration": "3h 30m",
        "meta": {
            "cab_types": [
                {"type": "Hatchback (Swift)",  "price_per_km": 12, "base_fare": 200, "max_seats": 4},
                {"type": "Sedan (Dzire)",      "price_per_km": 14, "base_fare": 250, "max_seats": 4},
                {"type": "SUV (Innova)",       "price_per_km": 18, "base_fare": 350, "max_seats": 7},
            ]
        },
        "providers": [
            {"provider": "Ola Outstation", "price_per_km": 12, "deeplink": "#"},
            {"provider": "Uber Intercity", "price_per_km": 13, "deeplink": "#"},
            {"provider": "Meru",           "price_per_km": 14, "deeplink": "#"},
        ]
    },
    {
        "service_type": "cab",
        "title": "Mumbai Airport Transfer",
        "code": "",
        "origin_city": "Mumbai", "destination_city": "Mumbai",
        "duration": "Varies",
        "meta": {
            "cab_types": [
                {"type": "Hatchback (Alto)",  "price_per_km": 14, "base_fare": 100, "max_seats": 4},
                {"type": "Sedan (Dzire)",     "price_per_km": 16, "base_fare": 150, "max_seats": 4},
                {"type": "SUV (Crysta)",      "price_per_km": 22, "base_fare": 250, "max_seats": 7},
            ]
        },
        "providers": [
            {"provider": "Ola",        "price_per_km": 14, "deeplink": "#"},
            {"provider": "Uber",       "price_per_km": 15, "deeplink": "#"},
            {"provider": "InDriver",   "price_per_km": 13, "deeplink": "#"},
        ]
    },
]

created_count = 0
for item in inventory:
    SearchInventory.objects.create(**item)
    created_count += 1

print(f"[OK] Seeded {created_count} inventory records successfully!")
print(f"   Flights: {SearchInventory.objects.filter(service_type='flight').count()}")
print(f"   Trains:  {SearchInventory.objects.filter(service_type='train').count()}")
print(f"   Hotels:  {SearchInventory.objects.filter(service_type='hotel').count()}")
print(f"   Buses:   {SearchInventory.objects.filter(service_type='bus').count()}")
print(f"   Cabs:    {SearchInventory.objects.filter(service_type='cab').count()}")
