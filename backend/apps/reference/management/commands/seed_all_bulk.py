import os
import requests
from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Q
from apps.reference.models import Country, State, City, Airport, RailwayStation
from apps.bookings.models import Location, SearchInventory

class Command(BaseCommand):
    help = 'Seeds entire reference & bookings.Location database programmatically via public bulk APIs and datasets in high-performance batches'

    def handle(self, *args, **options):
        self.stdout.write(self.style.MIGRATE_HEADING("[START] Initializing High-Performance Bulk Database Seeder..."))

        try:
            with transaction.atomic():
                # 1. Clear Existing Data
                self.stdout.write("[CLEANUP] Cleaning up old geography, transit and autocomplete records...")
                SearchInventory.objects.all().delete()
                Location.objects.all().delete()
                Airport.objects.all().delete()
                RailwayStation.objects.all().delete()
                City.objects.all().delete()
                State.objects.all().delete()
                Country.objects.all().delete()

                # 2. Fetch Countries via Stable mledoze/countries GitHub Dataset
                self.stdout.write("[DOWNLOAD] Downloading global country datasets from GitHub (mledoze/countries)...")
                countries_url = "https://raw.githubusercontent.com/mledoze/countries/master/countries.json"
                countries_resp = requests.get(countries_url, timeout=15)
                
                countries_to_create = []
                countries_by_code = {}
                countries_by_name = {}

                if countries_resp.status_code == 200:
                    countries_data = countries_resp.json()
                    self.stdout.write(f"  Downloaded {len(countries_data)} country definitions. Ingesting...")
                    for c_item in countries_data:
                        name = c_item.get("name", {}).get("common", "")
                        code = c_item.get("cca2", "").upper()
                        if not name or not code:
                            continue
                        
                        # Parse currency code
                        currencies = c_item.get("currencies", {})
                        currency_code = list(currencies.keys())[0] if currencies else "USD"

                        country_obj = Country(name=name, code=code, currency_code=currency_code)
                        countries_to_create.append(country_obj)
                        countries_by_code[code] = country_obj
                        countries_by_name[name.lower()] = country_obj

                    Country.objects.bulk_create(countries_to_create, batch_size=1000)
                    
                    # Refresh memory mappings with database IDs
                    countries_by_code = {c.code: c for c in Country.objects.all()}
                    countries_by_name = {c.name.lower(): c for c in Country.objects.all()}
                    
                    self.stdout.write(self.style.SUCCESS(f"  Successfully ingested {len(countries_by_code)} countries!"))
                else:
                    self.stderr.write("  [Error] Failed to download countries. Aborting.")
                    return

                # Ensure India exists as a fallback
                if "IN" not in countries_by_code:
                    india = Country.objects.create(name="India", code="IN", currency_code="INR")
                    countries_by_code["IN"] = india
                    countries_by_name["india"] = india

                # Ensure USA exists as a fallback
                if "US" not in countries_by_code:
                    usa = Country.objects.create(name="United States", code="US", currency_code="USD")
                    countries_by_code["US"] = usa
                    countries_by_name["united states"] = usa

                # 3. Fetch Airports & Cities via MWGG Airports Dataset
                self.stdout.write("[DOWNLOAD] Downloading global airport datasets from raw.githubusercontent.com...")
                airports_url = "https://raw.githubusercontent.com/mwgg/Airports/master/airports.json"
                airports_resp = requests.get(airports_url, timeout=15)

                if airports_resp.status_code == 200:
                    airports_data = airports_resp.json()
                    self.stdout.write(f"  Downloaded {len(airports_data)} airport definitions. Filtering and parsing...")

                    # Filter and extract valid airports mapping to known countries
                    airports_to_process = []
                    for icao_code, item in airports_data.items():
                        iata = item.get("iata", "").strip().upper()
                        city_name = item.get("city")
                        country_code = item.get("country", "").upper()
                        name = item.get("name")
                        # Ensure IATA code is exactly 3 characters and alphabetic to match database constraints and commercial flights
                        if not iata or len(iata) != 3 or not iata.isalpha() or not city_name or not country_code or not name:
                            continue
                        
                        country_obj = countries_by_code.get(country_code)
                        if not country_obj:
                            continue
                        
                        airports_to_process.append((iata, item, country_obj))

                    self.stdout.write(f"  Processing {len(airports_to_process)} valid global commercial airports...")

                    # Collect unique State objects to bulk create them
                    states_to_create = {}
                    for iata, item, country_obj in airports_to_process:
                        state_name = item.get("state", "").strip()
                        if state_name:
                            state_key = (state_name.lower(), country_obj.id)
                            if state_key not in states_to_create:
                                states_to_create[state_key] = State(country=country_obj, name=state_name)

                    self.stdout.write(f"  Bulk creating {len(states_to_create)} airport states/regions...")
                    State.objects.bulk_create(list(states_to_create.values()), batch_size=1000)
                    
                    # Pre-load all states into memory dictionary for quick lookup
                    states_by_key = {(s.name.lower(), s.country_id): s for s in State.objects.all()}

                    # Collect unique City objects to bulk create them
                    cities_to_create = {}
                    for iata, item, country_obj in airports_to_process:
                        city_name = item.get("city")
                        state_name = item.get("state", "").strip()
                        state_obj = None
                        if state_name:
                            state_obj = states_by_key.get((state_name.lower(), country_obj.id))

                        city_key = (city_name.lower(), country_obj.id)
                        if city_key not in cities_to_create:
                            cities_to_create[city_key] = City(
                                country=country_obj,
                                state=state_obj,
                                name=city_name,
                                latitude=item.get("lat"),
                                longitude=item.get("lon"),
                                timezone=item.get("tz")
                            )

                    self.stdout.write(f"  Bulk creating {len(cities_to_create)} cities across the globe...")
                    City.objects.bulk_create(list(cities_to_create.values()), batch_size=1000)
                    
                    # Pre-load all cities into memory dictionary for Airport mapping
                    cities_by_key = {(c.name.lower(), c.country_id): c for c in City.objects.all()}

                    # Now generate Airport objects and autocomplete Location objects
                    airports_to_create = []
                    locations_to_create = []
                    seen_airport_codes = set()
                    seen_location_cities = set()

                    for iata, item, country_obj in airports_to_process:
                        city_name = item.get("city")
                        city_obj = cities_by_key.get((city_name.lower(), country_obj.id))
                        if not city_obj or iata in seen_airport_codes:
                            continue
                        
                        seen_airport_codes.add(iata)

                        # Create Airport reference object
                        airports_to_create.append(Airport(
                            city=city_obj,
                            name=item.get("name"),
                            iata_code=iata,
                            latitude=item.get("lat"),
                            longitude=item.get("lon")
                        ))

                        # Create autocomplete entry for the Airport
                        locations_to_create.append(Location(
                            name=item.get("name"),
                            city=city_name,
                            code=iata,
                            location_type="airport",
                            country=country_obj.name
                        ))

                        # Create autocomplete entry for the City (if not already done)
                        city_loc_key = (city_name.lower(), country_obj.name.lower())
                        if city_loc_key not in seen_location_cities:
                            seen_location_cities.add(city_loc_key)
                            locations_to_create.append(Location(
                                name=city_name,
                                city=city_name,
                                code="",
                                location_type="city",
                                country=country_obj.name
                            ))

                    self.stdout.write(f"  Bulk creating {len(airports_to_create)} airports and {len(locations_to_create)} autocomplete records...")
                    Airport.objects.bulk_create(airports_to_create, batch_size=1000)
                    Location.objects.bulk_create(locations_to_create, batch_size=1000)

                    self.stdout.write(self.style.SUCCESS(f"  Successfully ingested geography and airport reference data!"))
                else:
                    self.stderr.write("  [Error] Failed to download airports dataset. Aborting.")
                    return

                # 4. Fetch Indian Railway Stations via open-source Indian Railways JSON (Datameet GeoJSON)
                self.stdout.write("[DOWNLOAD] Downloading Indian railway stations from raw.githubusercontent.com (datameet/railways)...")
                railways_url = "https://raw.githubusercontent.com/datameet/railways/master/stations.json"
                railways_resp = requests.get(railways_url, timeout=15)

                if railways_resp.status_code == 200:
                    railways_data = railways_resp.json()
                    features = railways_data.get("features", [])
                    self.stdout.write(f"  Downloaded {len(features)} Indian railway station definitions. Parsing...")

                    india_obj = countries_by_code.get("IN")
                    db_cities = {c.name.lower(): c for c in City.objects.filter(country=india_obj)}

                    # Collect valid stations
                    stations_to_process = []
                    for feature in features:
                        properties = feature.get("properties", {})
                        code = properties.get("code", "").strip().upper()
                        name = properties.get("name", "").strip()
                        if not code or not name or len(code) > 10:
                            continue
                        stations_to_process.append((code, name))

                    # Parse clean city names and identify missing cities to bulk-create them
                    cities_to_create_railway = {}
                    for code, name in stations_to_process:
                        # Extract city name heuristically from station name
                        city_name = name.title()
                        for term in [" Junction", " Terminal", " Central", " Cantt", " Road", " City", " Town", " Jn", " Terminus"]:
                            city_name = city_name.replace(term, "")
                        city_name = city_name.strip()

                        # If not already present in memory, stage for bulk creation
                        if city_name.lower() not in db_cities and city_name.lower() not in cities_to_create_railway:
                            cities_to_create_railway[city_name.lower()] = City(
                                country=india_obj,
                                name=city_name,
                                latitude=20.5937, # Default Center of India coordinates
                                longitude=78.9629
                            )

                    if cities_to_create_railway:
                        self.stdout.write(f"  Bulk creating {len(cities_to_create_railway)} missing cities in India for station mapping...")
                        City.objects.bulk_create(list(cities_to_create_railway.values()), batch_size=1000)
                        
                        # Re-populate the India cities dict
                        db_cities = {c.name.lower(): c for c in City.objects.filter(country=india_obj)}

                    # Generate RailwayStation and bookings.Location autocomplete models
                    stations_to_create = []
                    locations_to_create_railway = []
                    seen_station_codes = set()

                    for code, name in stations_to_process:
                        if code in seen_station_codes:
                            continue
                        seen_station_codes.add(code)

                        city_name = name.title()
                        for term in [" Junction", " Terminal", " Central", " Cantt", " Road", " City", " Town", " Jn", " Terminus"]:
                            city_name = city_name.replace(term, "")
                        city_name = city_name.strip()

                        city_obj = db_cities.get(city_name.lower())
                        if not city_obj:
                            city_obj = db_cities.get("delhi") or list(db_cities.values())[0]

                        # Create RailwayStation object
                        stations_to_create.append(RailwayStation(
                            city=city_obj,
                            name=f"{name.title()} Railway Station",
                            code=code
                        ))

                        # Create bookings.Location autocomplete node
                        locations_to_create_railway.append(Location(
                            name=f"{name.title()} Railway Station",
                            city=city_obj.name,
                            code=code,
                            location_type="station",
                            country="India"
                        ))

                    self.stdout.write(f"  Bulk creating {len(stations_to_create)} railway stations and {len(locations_to_create_railway)} autocomplete nodes...")
                    RailwayStation.objects.bulk_create(stations_to_create, batch_size=1000)
                    Location.objects.bulk_create(locations_to_create_railway, batch_size=1000)

                    self.stdout.write(self.style.SUCCESS(f"  Successfully ingested {len(stations_to_create)} railway stations!"))
                else:
                    self.stderr.write("  [Warning] Failed to download railway stations dataset. Skipping railways.")

                # 5. Populate bookings.SearchInventory with rich travel routes
                self.stdout.write("[GENERATE] Generating dynamic travel search inventory (flights & trains)...")
                
                # Fetch key cities to wire active routes
                delhi_city = City.objects.filter(name__iexact="Delhi").first() or City.objects.filter(name__icontains="Delhi").first()
                mumbai_city = City.objects.filter(name__iexact="Mumbai").first() or City.objects.filter(name__icontains="Mumbai").first()
                blr_city = City.objects.filter(name__iexact="Bangalore").first() or City.objects.filter(name__iexact="Bengaluru").first()
                tokyo_city = City.objects.filter(name__iexact="Tokyo").first()

                inventory_to_create = []

                if delhi_city and mumbai_city:
                    # FLIGHT: Delhi to Mumbai
                    inventory_to_create.append(SearchInventory(
                        service_type='flight', title='IndiGo', code='6E-2451',
                        origin_city=delhi_city.name, destination_city=mumbai_city.name,
                        origin_code='DEL', destination_code='BOM',
                        departure_time='06:15', arrival_time='08:20', duration='2h 05m', stops=0,
                        meta={'cabin_classes': [{'name': 'Economy', 'price': 5420}, {'name': 'Business', 'price': 18500}]},
                        providers=[{'provider': 'Ixigo', 'price': 5420}, {'provider': 'MakeMyTrip', 'price': 5499}]
                    ))
                    inventory_to_create.append(SearchInventory(
                        service_type='flight', title='Air India', code='AI-865',
                        origin_city=delhi_city.name, destination_city=mumbai_city.name,
                        origin_code='DEL', destination_code='BOM',
                        departure_time='10:00', arrival_time='12:15', duration='2h 15m', stops=0,
                        meta={'cabin_classes': [{'name': 'Economy', 'price': 6200}, {'name': 'Business', 'price': 22000}]},
                        providers=[{'provider': 'Air India', 'price': 6200}, {'provider': 'Cleartrip', 'price': 6350}]
                    ))
                    # TRAIN: Delhi to Mumbai
                    inventory_to_create.append(SearchInventory(
                        service_type='train', title='Mumbai Rajdhani', code='12952',
                        origin_city=delhi_city.name, destination_city=mumbai_city.name,
                        origin_code='NDLS', destination_code='MMCT',
                        departure_time='16:55', arrival_time='08:35+1', duration='15h 40m', stops=5,
                        meta={'classes': [
                            {'code': '3A', 'name': 'AC 3-Tier', 'price': 2100, 'availability': 'Available 85%'},
                            {'code': '2A', 'name': 'AC 2-Tier', 'price': 2865, 'availability': 'Available 34%'},
                            {'code': '1A', 'name': 'First AC', 'price': 4155, 'availability': 'RAC 2'}
                        ]}
                    ))

                if blr_city and mumbai_city:
                    # FLIGHT: Bangalore to Mumbai
                    inventory_to_create.append(SearchInventory(
                        service_type='flight', title='Akasa Air', code='QP-1102',
                        origin_city=blr_city.name, destination_city=mumbai_city.name,
                        origin_code='BLR', destination_code='BOM',
                        departure_time='08:30', arrival_time='10:15', duration='1h 45m', stops=0,
                        meta={'cabin_classes': [{'name': 'Economy', 'price': 4100}]},
                        providers=[{'provider': 'Akasa', 'price': 4100}, {'provider': 'EaseMyTrip', 'price': 4150}]
                    ))

                if tokyo_city and delhi_city:
                    # FLIGHT: Tokyo to Delhi
                    inventory_to_create.append(SearchInventory(
                        service_type='flight', title='Japan Airlines', code='JL-039',
                        origin_city=tokyo_city.name, destination_city=delhi_city.name,
                        origin_code='HND', destination_code='DEL',
                        departure_time='11:15', arrival_time='17:05', duration='8h 20m', stops=0,
                        meta={'cabin_classes': [{'name': 'Economy', 'price': 45000}, {'name': 'Business', 'price': 125000}]},
                        providers=[{'provider': 'JAL', 'price': 45000}, {'provider': 'Skyscanner', 'price': 45200}]
                    ))

                # Add generic default hotel & cab options so other searches return content
                all_cities = City.objects.filter(country__code="IN")[:5]
                for city_item in all_cities:
                    # HOTELS
                    inventory_to_create.append(SearchInventory(
                        service_type='hotel', title=f'The Grand {city_item.name} Palace',
                        origin_city=city_item.name, destination_city=city_item.name,
                        duration='Check-in 14:00',
                        meta={
                            'stars': 5,
                            'rating': 4.7,
                            'reviews': 1200,
                            'image': 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800',
                            'amenities': ['Pool', 'Spa', 'Free WiFi'],
                            'rooms': [{'name': 'Deluxe Room', 'price_per_night': 8500, 'features': ['King Bed']}]
                        }
                    ))
                    # CABS
                    inventory_to_create.append(SearchInventory(
                        service_type='cab', title='Local Taxi Partner', code='Standard',
                        origin_city=city_item.name, destination_city=city_item.name,
                        duration='On Demand',
                        meta={'cab_types': [{'name': 'Sedan', 'price_per_km': 15, 'base_fare': 150}]},
                        providers=[{'provider': 'LocalPartner', 'price': 400}]
                    ))

                SearchInventory.objects.bulk_create(inventory_to_create, batch_size=1000)
                self.stdout.write(self.style.SUCCESS(f"  Successfully seeded travel search inventory!"))

        except Exception as e:
            self.stderr.write(f"[ERROR] [Database Error] Ingestion transaction failed: {e}")
            import traceback
            traceback.print_exc()
            return

        self.stdout.write(self.style.SUCCESS("\n[SUCCESS] Bulk programmatic database seeding and mapping completed successfully!"))
