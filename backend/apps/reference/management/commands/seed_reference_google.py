import re
import os
import random
import requests
from django.core.management.base import BaseCommand
from django.core.management import call_command
from django.conf import settings
from django.db import transaction
from apps.reference.models import (
    Country, State, City, Airport, RailwayStation, BusStation, MetroStation,
    HotelMaster, RestaurantMaster, AttractionMaster, ActivityMaster
)

# Predefined lookups to handle unique constraints and provide realistic codes
AIRPORT_IATA_FALLBACKS = {
    "Mumbai": "BOM",
    "Bengaluru": "BLR",
    "New Delhi": "DEL",
    "Delhi": "DEL",
    "Tokyo": "HND",
    "Dubai": "DXB",
    "Goa": "GOI",
    "Jaipur": "JAI",
    "Agra": "AGR",
    "Chennai": "MAA",
    "Hyderabad": "HYD",
    "Kolkata": "CCU",
    "Pune": "PNQ",
    "Udaipur": "UDR",
    "Kochi": "COK",
    "Abu Dhabi": "AUH",
    "Kyoto": "UKY",
    "Osaka": "KIX",
    "Singapore": "SIN",
    "Paris": "CDG",
    "London": "LHR",
    "New York": "JFK"
}

STATION_CODE_FALLBACKS = {
    "New Delhi": "NDLS",
    "Delhi": "DLI",
    "Mumbai": "CSMT",
    "Bengaluru": "SBC",
    "Bangalore": "SBC",
    "Kolkata": "HWH",
    "Jaipur": "JP",
    "Ahmedabad": "ADI",
    "Pune": "PUNE",
    "Chennai": "MAS",
    "Hyderabad": "HYB",
    "Dubai": "DXB-MET",
    "Tokyo": "TYO-STN"
}

class Command(BaseCommand):
    help = 'Seeds reference tables with high-fidelity, real-world Google Places data'

    def handle(self, *args, **kwargs):
        self.stdout.write("Initializing Google Places Reference Seeder...")

        # 1. Run base seeder first if no cities exist
        if City.objects.count() == 0:
            self.stdout.write("No cities found in database. Seeding base cities structure first...")
            call_command('seed_reference')

        # 2. Retrieve API Key
        api_key = getattr(settings, 'GOOGLE_PLACES_API_KEY', '')
        if not api_key:
            # Try loading directly from environment fallback
            api_key = os.getenv("GOOGLE_PLACES_API_KEY", "")
        
        if not api_key:
            self.stderr.write("Error: GOOGLE_PLACES_API_KEY is not configured in settings or environment.")
            return

        cities = City.objects.all()
        self.stdout.write(f"Found {cities.count()} cities in the database. Fetching real-world details...")

        # Maintain runtime trackers to satisfy unique constraints
        existing_airport_codes = set(Airport.objects.values_list('iata_code', flat=True))
        existing_station_codes = set(RailwayStation.objects.values_list('code', flat=True))

        def make_unique_iata(code, city_name):
            code = code.strip().upper()[:3]
            if not code or len(code) < 3:
                code = AIRPORT_IATA_FALLBACKS.get(city_name, "XYZ")[:3]
            char_code = ord('A')
            original_code = code
            while code in existing_airport_codes:
                code = f"{original_code[:2]}{chr(char_code)}"
                char_code += 1
                if char_code > ord('Z'):
                    code = f"{original_code[:2]}{random.randint(1, 9)}"
                    break
            existing_airport_codes.add(code)
            return code

        def make_unique_station_code(name, city_name):
            # Check custom fallback
            matched_code = None
            for k, v in STATION_CODE_FALLBACKS.items():
                if k.lower() in name.lower() or k.lower() in city_name.lower():
                    matched_code = v
                    break
            
            if not matched_code:
                # Generate from station name
                clean_name = re.sub(r'\W+', '', name).upper()
                matched_code = clean_name[:4] if len(clean_name) >= 4 else f"{clean_name}STN"[:4]
            
            base_code = matched_code[:8].upper()
            code = base_code
            suffix = 1
            while code in existing_station_codes:
                code = f"{base_code[:7]}{suffix}"
                suffix += 1
            existing_station_codes.add(code)
            return code

        def fetch_places(query, limit=10):
            url = f"https://maps.googleapis.com/maps/api/place/textsearch/json?query={query}&key={api_key}"
            try:
                resp = requests.get(url, timeout=10)
                if resp.status_code == 200:
                    results = resp.json().get('results', [])
                    return results[:limit]
            except Exception as e:
                self.stdout.write(self.style.WARNING(f"  [API Error] Failed to search for '{query}': {e}"))
            return []

        def get_photo_url(place):
            photos = place.get('photos', [])
            if photos:
                photo_ref = photos[0].get('photo_reference')
                return f"https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference={photo_ref}&key={api_key}"
            return None

        # 3. Main loop over cities
        for city in cities:
            self.stdout.write(self.style.MIGRATE_HEADING(f"\nSeeding real-world data for {city.name}, {city.country.name}..."))

            # --- A. GEOCODING FALLBACK FOR CITY COORDINATES ---
            if not city.latitude or not city.longitude:
                self.stdout.write(f"  City coordinates missing. Geocoding {city.name}...")
                geo_url = f"https://maps.googleapis.com/maps/api/geocode/json?address={city.name},{city.country.name}&key={api_key}"
                try:
                    geo_resp = requests.get(geo_url, timeout=5)
                    geo_data = geo_resp.json()
                    if geo_data.get('results'):
                        loc = geo_data['results'][0]['geometry']['location']
                        city.latitude = loc['lat']
                        city.longitude = loc['lng']
                        city.save()
                        self.stdout.write(self.style.SUCCESS(f"  Resolved coordinates: ({city.latitude}, {city.longitude})"))
                except Exception as e:
                    self.stdout.write(self.style.WARNING(f"  Geocoding failed: {e}"))

            # --- B. SEED TRANSIT: AIRPORTS ---
            self.stdout.write("  Fetching Airports...")
            airport_results = fetch_places(f"airports near {city.name} {city.country.name}", limit=3)
            for place in airport_results:
                name = place.get('name')
                geom = place.get('geometry', {}).get('location', {})
                
                # Try to extract 3-letter IATA code from name or address
                iata_code = ""
                iata_match = re.search(r'\b([A-Z]{3})\b', name)
                if not iata_match and place.get('formatted_address'):
                    iata_match = re.search(r'\b([A-Z]{3})\b', place.get('formatted_address'))
                if iata_match:
                    iata_code = iata_match.group(1)
                
                iata_code = make_unique_iata(iata_code, city.name)
                
                Airport.objects.get_or_create(
                    iata_code=iata_code,
                    defaults={
                        'city': city,
                        'name': name,
                        'latitude': geom.get('lat'),
                        'longitude': geom.get('lng')
                    }
                )

            # --- C. SEED TRANSIT: RAILWAY STATIONS ---
            self.stdout.write("  Fetching Railway Stations...")
            train_results = fetch_places(f"railway station in {city.name}", limit=3)
            # Fallback if no railway station results
            if not train_results:
                train_results = fetch_places(f"train station in {city.name}", limit=3)
            for place in train_results:
                name = place.get('name')
                code = make_unique_station_code(name, city.name)
                RailwayStation.objects.get_or_create(
                    code=code,
                    defaults={
                        'city': city,
                        'name': name
                    }
                )

            # --- D. SEED TRANSIT: BUS STATIONS ---
            self.stdout.write("  Fetching Bus Stations...")
            bus_results = fetch_places(f"bus station in {city.name}", limit=3)
            if not bus_results:
                bus_results = fetch_places(f"bus stand in {city.name}", limit=3)
            for place in bus_results:
                name = place.get('name')
                BusStation.objects.get_or_create(
                    city=city,
                    name=name
                )

            # --- E. SEED TRANSIT: METRO STATIONS ---
            self.stdout.write("  Fetching Metro Stations...")
            metro_results = fetch_places(f"metro station in {city.name}", limit=3)
            if not metro_results and city.name in ["Tokyo", "New Delhi", "Mumbai", "Dubai", "Bengaluru"]:
                metro_results = fetch_places(f"subway station in {city.name}", limit=3)
            for place in metro_results:
                name = place.get('name')
                # Extract colors from metro names if present (e.g. Yellow Line)
                line_color = "Main Line"
                color_match = re.search(r'\b(Red|Yellow|Blue|Green|Orange|Violet|Purple|Pink|Aqua|Magenta|Grey|Silver)\s+Line\b', name, re.IGNORECASE)
                if color_match:
                    line_color = color_match.group(1).capitalize()
                
                MetroStation.objects.get_or_create(
                    city=city,
                    name=name,
                    defaults={'line_color': line_color}
                )

            # --- F. SEED HOSPITALITY: HOTELS ---
            self.stdout.write("  Fetching Hotels...")
            hotel_results = fetch_places(f"best hotels in {city.name}", limit=10)
            for place in hotel_results:
                name = place.get('name')
                geom = place.get('geometry', {}).get('location', {})
                rating = place.get('rating', 4.0)
                price_level = place.get('price_level', 2)
                
                # Derive realistic star rating
                star_rating = 4.0
                if price_level >= 3:
                    star_rating = 5.0
                elif price_level == 1:
                    star_rating = 3.0
                
                HotelMaster.objects.get_or_create(
                    city=city,
                    name=name,
                    defaults={
                        'star_rating': star_rating,
                        'user_rating': rating,
                        'address': place.get('formatted_address', ''),
                        'image_url': get_photo_url(place),
                        'latitude': geom.get('lat'),
                        'longitude': geom.get('lng')
                    }
                )

            # --- G. SEED HOSPITALITY: RESTAURANTS ---
            self.stdout.write("  Fetching Restaurants...")
            restaurant_results = fetch_places(f"best restaurants in {city.name}", limit=10)
            for place in restaurant_results:
                name = place.get('name')
                rating = place.get('rating', 4.0)
                price_level = place.get('price_level', 2)
                types = place.get('types', [])
                
                # Parse cuisine
                cuisine = "Multi-cuisine"
                type_cuisine_map = {
                    'sushi': 'Japanese/Sushi',
                    'pizza': 'Italian/Pizza',
                    'indian_restaurant': 'Indian',
                    'mexican_restaurant': 'Mexican',
                    'chinese_restaurant': 'Chinese',
                    'japanese_restaurant': 'Japanese',
                    'italian_restaurant': 'Italian',
                    'cafe': 'Cafe/Bakery',
                    'bakery': 'Bakery/Desserts',
                    'bar': 'Bar/Pub/Lounge',
                    'seafood_restaurant': 'Seafood',
                    'steakhouse': 'Steakhouse',
                    'vegetarian_restaurant': 'Pure Vegetarian'
                }
                for t, c in type_cuisine_map.items():
                    if t in types:
                        cuisine = c
                        break

                price_range = '$' * price_level if price_level else '$$'
                
                RestaurantMaster.objects.get_or_create(
                    city=city,
                    name=name,
                    defaults={
                        'cuisine': cuisine,
                        'price_range': price_range,
                        'user_rating': rating,
                        'image_url': get_photo_url(place)
                    }
                )

            # --- H. SEED POINTS-OF-INTEREST: ATTRACTIONS ---
            self.stdout.write("  Fetching Attractions...")
            attraction_results = fetch_places(f"top tourist attractions in {city.name}", limit=10)
            for place in attraction_results:
                name = place.get('name')
                rating = place.get('rating', 4.0)
                types = place.get('types', [])
                
                # Determine category choice
                category = 'tourist_attraction'
                if 'museum' in types or 'art_gallery' in types:
                    category = 'museum'
                elif any(t in types for t in ['hindu_temple', 'place_of_worship', 'church', 'mosque']):
                    category = 'temple'
                elif any(t in types for t in ['park', 'zoo', 'aquarium']):
                    category = 'park'
                elif 'amusement_park' in types:
                    category = 'amusement_park'
                elif any(t in types for t in ['shopping_mall', 'department_store']):
                    category = 'shopping'
                elif any(t in types for t in ['movie_theater', 'casino', 'bowling_alley']):
                    category = 'entertainment'
                elif 'natural_feature' in types:
                    category = 'beach' if 'beach' in types else 'park'

                # Durations mapping
                duration_map = {
                    'museum': 120,
                    'temple': 60,
                    'monument': 45,
                    'park': 90,
                    'beach': 120,
                    'shopping': 180,
                    'entertainment': 120,
                    'tourist_attraction': 60,
                    'amusement_park': 240,
                    'other': 60
                }
                suggested_duration_mins = duration_map.get(category, 60)

                AttractionMaster.objects.get_or_create(
                    city=city,
                    name=name,
                    defaults={
                        'category': category,
                        'user_rating': rating,
                        'image_url': get_photo_url(place),
                        'suggested_duration_mins': suggested_duration_mins
                    }
                )

            # --- I. SEED POINTS-OF-INTEREST: ACTIVITIES ---
            self.stdout.write("  Fetching Activities...")
            activity_results = fetch_places(f"things to do in {city.name}", limit=10)
            if not activity_results:
                activity_results = fetch_places(f"top activities in {city.name}", limit=10)
            for place in activity_results:
                name = place.get('name')
                types = place.get('types', [])
                
                # Categories: Adventure, Food, Culture, Sightseeing, Shopping, Nature
                category = 'Sightseeing'
                if any(t in types for t in ['restaurant', 'food', 'cafe']):
                    category = 'Food'
                elif any(t in types for t in ['shopping_mall', 'store']):
                    category = 'Shopping'
                elif any(t in types for t in ['park', 'natural_feature', 'campground']):
                    category = 'Nature'
                elif any(t in types for t in ['museum', 'place_of_worship', 'art_gallery']):
                    category = 'Culture'
                elif any(t in types for t in ['amusement_park', 'sports_activity', 'stadium']):
                    category = 'Adventure'

                # Estimate price realistically based on location (India vs International)
                is_india = (city.country.code == "IN")
                if is_india:
                    price_estimate = random.randint(300, 2500)
                else:
                    price_estimate = random.randint(15, 120)

                ActivityMaster.objects.get_or_create(
                    city=city,
                    name=name,
                    defaults={
                        'category': category,
                        'price_estimate': price_estimate,
                        'image_url': get_photo_url(place)
                    }
                )

            self.stdout.write(self.style.SUCCESS(f"  Successfully finished seeding {city.name}!"))

        self.stdout.write(self.style.SUCCESS("\nSuccessfully seeded all real-world database reference records!"))
