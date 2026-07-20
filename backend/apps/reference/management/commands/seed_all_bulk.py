import re
import requests
import unicodedata
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from apps.reference.models import Country, State, City, Airport, RailwayStation
from apps.bookings.models import Location, SearchInventory

def normalize_search_name(text):
    if not text:
        return ""
    text = unicodedata.normalize("NFC", text)
    text = text.lower().strip()
    text = re.sub(r"[''`\-–—.,/]", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()

def normalize_code(text):
    if not text:
        return ""
    text = re.sub(r"[^a-zA-Z0-9]", "", text)
    return text.upper().strip()

class Command(BaseCommand):
    help = 'Seeds entire reference & bookings.Location database programmatically via public bulk APIs and datasets in high-performance batches'

    def add_arguments(self, parser):
        parser.add_argument('--reset', action='store_true', help='Destructively clear database tables before seeding.')
        parser.add_argument('--confirm-destructive', action='store_true', help='Confirm destructive table clears.')
        parser.add_argument('--acknowledge-backup', action='store_true', help='Acknowledge that database backup has been made before clearing.')
        parser.add_argument('--dry-run', action='store_true', help='Process data but do not write changes to database.')

    def handle(self, *args, **options):
        reset = options.get('reset', False)
        confirm_destructive = options.get('confirm_destructive', False)
        acknowledge_backup = options.get('acknowledge_backup', False)
        dry_run = options.get('dry-run', False)

        self.stdout.write(self.style.MIGRATE_HEADING("[START] Initializing High-Performance Database Seeder..."))

        affected_tables = ["SearchInventory", "Location", "Airport", "RailwayStation", "City", "State", "Country"]

        if reset:
            if not confirm_destructive or not acknowledge_backup:
                raise CommandError(
                    "CRITICAL ERROR: Destructive database clearing (--reset) requires both "
                    "--confirm-destructive and --acknowledge-backup to proceed.\n"
                    f"This operation will delete all records in: {', '.join(affected_tables)}."
                )
            
            self.stdout.write(self.style.WARNING(
                f"[WARNING] Destructive execution enabled. The following tables will be cleared: {', '.join(affected_tables)}."
            ))
            if dry_run:
                self.stdout.write(self.style.NOTICE(
                    f"[DRY RUN] Would delete all records in: {', '.join(affected_tables)}"
                ))
            else:
                self.stdout.write("[CLEANUP] Cleaning up old geography, transit and autocomplete records...")
                SearchInventory.objects.all().delete()
                Location.objects.all().delete()
                Airport.objects.all().delete()
                RailwayStation.objects.all().delete()
                City.objects.all().delete()
                State.objects.all().delete()
                Country.objects.all().delete()

        # Ingestion metrics
        metrics = {
            "Country": {"scanned": 0, "unchanged": 0, "updated": 0, "created": 0, "skipped": 0, "failed": 0},
            "State": {"scanned": 0, "unchanged": 0, "updated": 0, "created": 0, "skipped": 0, "failed": 0},
            "City": {"scanned": 0, "unchanged": 0, "updated": 0, "created": 0, "skipped": 0, "failed": 0},
            "Airport": {"scanned": 0, "unchanged": 0, "updated": 0, "created": 0, "skipped": 0, "failed": 0},
            "RailwayStation": {"scanned": 0, "unchanged": 0, "updated": 0, "created": 0, "skipped": 0, "failed": 0},
            "Location": {"scanned": 0, "unchanged": 0, "updated": 0, "created": 0, "skipped": 0, "failed": 0},
            "SearchInventory": {"scanned": 0, "unchanged": 0, "updated": 0, "created": 0, "skipped": 0, "failed": 0},
        }

        try:
            with transaction.atomic():
                # 1. Fetch Countries via Stable mledoze/countries GitHub Dataset
                self.stdout.write("[DOWNLOAD] Downloading global country datasets from GitHub (mledoze/countries)...")
                countries_url = "https://raw.githubusercontent.com/mledoze/countries/master/countries.json"
                countries_resp = requests.get(countries_url, timeout=15)
                
                countries_by_code = {c.code.upper(): c for c in Country.objects.all()}
                countries_by_name = {normalize_search_name(c.name): c for c in Country.objects.all()}

                if countries_resp.status_code == 200:
                    countries_data = countries_resp.json()
                    self.stdout.write(f"  Downloaded {len(countries_data)} country definitions. Ingesting...")
                    
                    for c_item in countries_data:
                        name = c_item.get("name", {}).get("common", "")
                        code = c_item.get("cca2", "").upper()
                        if not name or not code:
                            metrics["Country"]["skipped"] += 1
                            continue
                        
                        metrics["Country"]["scanned"] += 1
                        currencies = c_item.get("currencies", {})
                        currency_code = list(currencies.keys())[0] if currencies else "USD"

                        existing = countries_by_code.get(code)
                        if existing:
                            changed = False
                            if existing.name != name:
                                existing.name = name
                                changed = True
                            if existing.currency_code != currency_code:
                                existing.currency_code = currency_code
                                changed = True
                            
                            if changed:
                                if not dry_run:
                                    existing.save()
                                metrics["Country"]["updated"] += 1
                            else:
                                metrics["Country"]["unchanged"] += 1
                        else:
                            new_country = Country(name=name, code=code, currency_code=currency_code)
                            if not dry_run:
                                new_country.save()
                            countries_by_code[code] = new_country
                            countries_by_name[normalize_search_name(name)] = new_country
                            metrics["Country"]["created"] += 1

                    self.stdout.write(self.style.SUCCESS(f"  Country metrics: {metrics['Country']}"))
                else:
                    self.stderr.write("  [Error] Failed to download countries. Aborting.")
                    return

                # Fallback countries
                for name, code, currency in [("India", "IN", "INR"), ("United States", "US", "USD")]:
                    metrics["Country"]["scanned"] += 1
                    if code not in countries_by_code:
                        new_country = Country(name=name, code=code, currency_code=currency)
                        if not dry_run:
                            new_country.save()
                        countries_by_code[code] = new_country
                        countries_by_name[normalize_search_name(name)] = new_country
                        metrics["Country"]["created"] += 1
                    else:
                        metrics["Country"]["unchanged"] += 1

                # 2. Fetch Airports & Cities via MWGG Airports Dataset
                self.stdout.write("[DOWNLOAD] Downloading global airport datasets...")
                airports_url = "https://raw.githubusercontent.com/mwgg/Airports/master/airports.json"
                airports_resp = requests.get(airports_url, timeout=15)

                if airports_resp.status_code == 200:
                    airports_data = airports_resp.json()
                    self.stdout.write(f"  Downloaded {len(airports_data)} airport definitions. Filtering and parsing...")

                    airports_to_process = []
                    for icao_code, item in airports_data.items():
                        iata = normalize_code(item.get("iata", ""))
                        city_name = item.get("city")
                        country_code = item.get("country", "").upper()
                        name = item.get("name")
                        if not iata or len(iata) != 3 or not iata.isalpha() or not city_name or not country_code or not name:
                            continue
                        
                        country_obj = countries_by_code.get(country_code)
                        if not country_obj:
                            continue
                        
                        airports_to_process.append((iata, item, country_obj))

                    self.stdout.write(f"  Processing {len(airports_to_process)} valid global commercial airports...")

                    # Idempotent State processing
                    existing_states = {(s.name.lower(), s.country_id): s for s in State.objects.all()}
                    states_to_create = {}
                    for iata, item, country_obj in airports_to_process:
                        state_name = item.get("state", "").strip()
                        if state_name:
                            state_key = (state_name.lower(), country_obj.id)
                            metrics["State"]["scanned"] += 1
                            if state_key not in existing_states and state_key not in states_to_create:
                                states_to_create[state_key] = State(country=country_obj, name=state_name)
                                metrics["State"]["created"] += 1
                            else:
                                metrics["State"]["unchanged"] += 1

                    if states_to_create and not dry_run:
                        State.objects.bulk_create(list(states_to_create.values()), batch_size=1000)
                    
                    # Refresh state maps
                    states_by_key = {(s.name.lower(), s.country_id): s for s in State.objects.all()}

                    # Idempotent City processing
                    existing_cities = {(c.name.lower(), c.country_id): c for c in City.objects.all()}
                    cities_to_create = {}
                    for iata, item, country_obj in airports_to_process:
                        city_name = item.get("city")
                        state_name = item.get("state", "").strip()
                        state_obj = None
                        if state_name:
                            state_obj = states_by_key.get((state_name.lower(), country_obj.id))

                        city_key = (city_name.lower(), country_obj.id)
                        metrics["City"]["scanned"] += 1
                        
                        lat = item.get("lat")
                        lon = item.get("lon")
                        tz = item.get("tz")

                        existing_city = existing_cities.get(city_key)
                        if existing_city:
                            changed = False
                            # Only update if existing details are null or defaults
                            if existing_city.latitude is None or (existing_city.latitude == 20.5937 and lat != 20.5937):
                                existing_city.latitude = lat
                                changed = True
                            if existing_city.longitude is None or (existing_city.longitude == 78.9629 and lon != 78.9629):
                                existing_city.longitude = lon
                                changed = True
                            if not existing_city.timezone and tz:
                                existing_city.timezone = tz
                                changed = True
                            
                            if changed:
                                if not dry_run:
                                    existing_city.save()
                                metrics["City"]["updated"] += 1
                            else:
                                metrics["City"]["unchanged"] += 1
                        else:
                            if city_key not in cities_to_create:
                                cities_to_create[city_key] = City(
                                    country=country_obj,
                                    state=state_obj,
                                    name=city_name,
                                    latitude=lat,
                                    longitude=lon,
                                    timezone=tz
                                )
                                metrics["City"]["created"] += 1

                    if cities_to_create and not dry_run:
                        City.objects.bulk_create(list(cities_to_create.values()), batch_size=1000)
                    
                    # Refresh city maps
                    cities_by_key = {(c.name.lower(), c.country_id): c for c in City.objects.all()}

                    # Idempotent Airport & autocomplete Location processing
                    existing_airports = {a.iata_code.upper(): a for a in Airport.objects.all()}
                    existing_locations = {(normalize_search_name(l.name), normalize_search_name(l.city), l.code, l.location_type): l for l in Location.objects.all()}
                    
                    airports_to_create = []
                    locations_to_create = []
                    seen_airport_codes = set()
                    seen_location_cities = set()

                    for iata, item, country_obj in airports_to_process:
                        city_name = item.get("city")
                        city_obj = cities_by_key.get((city_name.lower(), country_obj.id))
                        if not city_obj or iata in seen_airport_codes:
                            metrics["Airport"]["skipped"] += 1
                            continue
                        seen_airport_codes.add(iata)

                        # Airport Reference
                        metrics["Airport"]["scanned"] += 1
                        existing_airport = existing_airports.get(iata)
                        lat = item.get("lat")
                        lon = item.get("lon")
                        
                        if existing_airport:
                            changed = False
                            if existing_airport.name != item.get("name"):
                                existing_airport.name = item.get("name")
                                changed = True
                            if existing_airport.latitude != lat:
                                existing_airport.latitude = lat
                                changed = True
                            if existing_airport.longitude != lon:
                                existing_airport.longitude = lon
                                changed = True
                            
                            if changed:
                                if not dry_run:
                                    existing_airport.save()
                                metrics["Airport"]["updated"] += 1
                            else:
                                metrics["Airport"]["unchanged"] += 1
                        else:
                            airports_to_create.append(Airport(
                                city=city_obj,
                                name=item.get("name"),
                                iata_code=iata,
                                latitude=lat,
                                longitude=lon
                            ))
                            metrics["Airport"]["created"] += 1

                        # Autocomplete locations
                        loc_key_ap = (normalize_search_name(item.get("name")), normalize_search_name(city_name), iata, "airport")
                        metrics["Location"]["scanned"] += 1
                        if loc_key_ap not in existing_locations:
                            locations_to_create.append(Location(
                                name=item.get("name"),
                                city=city_name,
                                code=iata,
                                location_type="airport",
                                country=country_obj.name
                            ))
                            metrics["Location"]["created"] += 1
                        else:
                            metrics["Location"]["unchanged"] += 1

                        # City Autocomplete Location
                        city_loc_key = (city_name.lower(), country_obj.name.lower())
                        if city_loc_key not in seen_location_cities:
                            seen_location_cities.add(city_loc_key)
                            loc_key_city = (normalize_search_name(city_name), normalize_search_name(city_name), "", "city")
                            metrics["Location"]["scanned"] += 1
                            if loc_key_city not in existing_locations:
                                locations_to_create.append(Location(
                                    name=city_name,
                                    city=city_name,
                                    code="",
                                    location_type="city",
                                    country=country_obj.name
                                ))
                                metrics["Location"]["created"] += 1
                            else:
                                metrics["Location"]["unchanged"] += 1

                    if not dry_run:
                        if airports_to_create:
                            Airport.objects.bulk_create(airports_to_create, batch_size=1000)
                        if locations_to_create:
                            Location.objects.bulk_create(locations_to_create, batch_size=1000)

                    self.stdout.write(self.style.SUCCESS(f"  Airport metrics: {metrics['Airport']}"))
                    self.stdout.write(self.style.SUCCESS(f"  State metrics: {metrics['State']}"))
                    self.stdout.write(self.style.SUCCESS(f"  City metrics: {metrics['City']}"))
                else:
                    self.stderr.write("  [Error] Failed to download airports dataset. Aborting.")
                    return

                # 3. Fetch Indian Railway Stations via open-source Indian Railways JSON (Datameet GeoJSON)
                self.stdout.write("[DOWNLOAD] Downloading Indian railway stations from Datameet...")
                railways_url = "https://raw.githubusercontent.com/datameet/railways/master/stations.json"
                railways_resp = requests.get(railways_url, timeout=15)

                if railways_resp.status_code == 200:
                    railways_data = railways_resp.json()
                    features = railways_data.get("features", [])
                    self.stdout.write(f"  Downloaded {len(features)} Indian railway station definitions. Ingesting...")

                    india_obj = countries_by_code.get("IN")
                    db_cities = {c.name.lower(): c for c in City.objects.filter(country=india_obj)}

                    stations_to_process = []
                    for feature in features:
                        properties = feature.get("properties", {})
                        code = normalize_code(properties.get("code", ""))
                        name = properties.get("name", "").strip()
                        if not code or not name or len(code) > 10:
                            continue
                        stations_to_process.append((code, name))

                    # Idempotent City check
                    cities_to_create_railway = {}
                    for code, name in stations_to_process:
                        city_name = name.title()
                        for term in [" Junction", " Terminal", " Central", " Cantt", " Road", " City", " Town", " Jn", " Terminus"]:
                            city_name = city_name.replace(term, "")
                        city_name = city_name.strip()

                        if city_name.lower() not in db_cities and city_name.lower() not in cities_to_create_railway:
                            cities_to_create_railway[city_name.lower()] = City(
                                country=india_obj,
                                name=city_name,
                                latitude=20.5937, # Fallback coordinate
                                longitude=78.9629
                            )
                            metrics["City"]["scanned"] += 1
                            metrics["City"]["created"] += 1

                    if cities_to_create_railway and not dry_run:
                        City.objects.bulk_create(list(cities_to_create_railway.values()), batch_size=1000)
                        db_cities = {c.name.lower(): c for c in City.objects.filter(country=india_obj)}

                    # Refresh existing stations mapping
                    existing_stations = {s.code.upper(): s for s in RailwayStation.objects.all()}
                    existing_locations = {(normalize_search_name(l.name), normalize_search_name(l.city), l.code, l.location_type): l for l in Location.objects.all()}
                    
                    stations_to_create = []
                    locations_to_create_railway = []
                    seen_station_codes = set()

                    for code, name in stations_to_process:
                        if code in seen_station_codes:
                            metrics["RailwayStation"]["skipped"] += 1
                            continue
                        seen_station_codes.add(code)

                        city_name = name.title()
                        for term in [" Junction", " Terminal", " Central", " Cantt", " Road", " City", " Town", " Jn", " Terminus"]:
                            city_name = city_name.replace(term, "")
                        city_name = city_name.strip()

                        city_obj = db_cities.get(city_name.lower())
                        if not city_obj:
                            city_obj = db_cities.get("delhi") or list(db_cities.values())[0]

                        metrics["RailwayStation"]["scanned"] += 1
                        existing_stn = existing_stations.get(code)
                        expected_name = f"{name.title()} Railway Station"
                        
                        if existing_stn:
                            changed = False
                            if existing_stn.name != expected_name:
                                existing_stn.name = expected_name
                                changed = True
                            if existing_stn.city_id != city_obj.id:
                                existing_stn.city = city_obj
                                changed = True
                            
                            if changed:
                                if not dry_run:
                                    existing_stn.save()
                                metrics["RailwayStation"]["updated"] += 1
                            else:
                                metrics["RailwayStation"]["unchanged"] += 1
                        else:
                            stations_to_create.append(RailwayStation(
                                city=city_obj,
                                name=expected_name,
                                code=code
                            ))
                            metrics["RailwayStation"]["created"] += 1

                        # Autocomplete Station location
                        loc_key_stn = (normalize_search_name(expected_name), normalize_search_name(city_obj.name), code, "station")
                        metrics["Location"]["scanned"] += 1
                        if loc_key_stn not in existing_locations:
                            locations_to_create_railway.append(Location(
                                name=expected_name,
                                city=city_obj.name,
                                code=code,
                                location_type="station",
                                country="India"
                            ))
                            metrics["Location"]["created"] += 1
                        else:
                            metrics["Location"]["unchanged"] += 1

                    if not dry_run:
                        if stations_to_create:
                            RailwayStation.objects.bulk_create(stations_to_create, batch_size=1000)
                        if locations_to_create_railway:
                            Location.objects.bulk_create(locations_to_create_railway, batch_size=1000)

                    self.stdout.write(self.style.SUCCESS(f"  RailwayStation metrics: {metrics['RailwayStation']}"))
                    self.stdout.write(self.style.SUCCESS(f"  Location metrics: {metrics['Location']}"))
                else:
                    self.stderr.write("  [Warning] Failed to download railway stations dataset. Skipping railways.")

                # 4. Populate bookings.SearchInventory with rich travel routes
                self.stdout.write("[GENERATE] Generating travel search inventory (flights & trains)...")
                
                # Fetch key cities to wire active routes
                delhi_city = City.objects.filter(name__iexact="Delhi").first() or City.objects.filter(name__icontains="Delhi").first()
                mumbai_city = City.objects.filter(name__iexact="Mumbai").first() or City.objects.filter(name__icontains="Mumbai").first()
                blr_city = City.objects.filter(name__iexact="Bangalore").first() or City.objects.filter(name__iexact="Bengaluru").first()
                tokyo_city = City.objects.filter(name__iexact="Tokyo").first()

                inventory_candidates = []

                if delhi_city and mumbai_city:
                    # FLIGHT: Delhi to Mumbai
                    inventory_candidates.append(SearchInventory(
                        service_type='flight', title='IndiGo', code='6E-2451',
                        origin_city=delhi_city.name, destination_city=mumbai_city.name,
                        origin_code='DEL', destination_code='BOM',
                        departure_time='06:15', arrival_time='08:20', duration='2h 05m', stops=0,
                        meta={'cabin_classes': [{'name': 'Economy', 'price': 5420}, {'name': 'Business', 'price': 18500}]},
                        providers=[{'provider': 'Ixigo', 'price': 5420}, {'provider': 'MakeMyTrip', 'price': 5499}]
                    ))
                    inventory_candidates.append(SearchInventory(
                        service_type='flight', title='Air India', code='AI-865',
                        origin_city=delhi_city.name, destination_city=mumbai_city.name,
                        origin_code='DEL', destination_code='BOM',
                        departure_time='10:00', arrival_time='12:15', duration='2h 15m', stops=0,
                        meta={'cabin_classes': [{'name': 'Economy', 'price': 6200}, {'name': 'Business', 'price': 22000}]},
                        providers=[{'provider': 'Air India', 'price': 6200}, {'provider': 'Cleartrip', 'price': 6350}]
                    ))
                    # TRAIN: Delhi to Mumbai
                    inventory_candidates.append(SearchInventory(
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
                    inventory_candidates.append(SearchInventory(
                        service_type='flight', title='Akasa Air', code='QP-1102',
                        origin_city=blr_city.name, destination_city=mumbai_city.name,
                        origin_code='BLR', destination_code='BOM',
                        departure_time='08:30', arrival_time='10:15', duration='1h 45m', stops=0,
                        meta={'cabin_classes': [{'name': 'Economy', 'price': 4100}]},
                        providers=[{'provider': 'Akasa', 'price': 4100}, {'provider': 'EaseMyTrip', 'price': 4150}]
                    ))

                if tokyo_city and delhi_city:
                    # FLIGHT: Tokyo to Delhi
                    inventory_candidates.append(SearchInventory(
                        service_type='flight', title='Japan Airlines', code='JL-039',
                        origin_city=tokyo_city.name, destination_city=delhi_city.name,
                        origin_code='HND', destination_code='DEL',
                        departure_time='11:15', arrival_time='17:05', duration='8h 20m', stops=0,
                        meta={'cabin_classes': [{'name': 'Economy', 'price': 45000}, {'name': 'Business', 'price': 125000}]},
                        providers=[{'provider': 'JAL', 'price': 45000}, {'provider': 'Skyscanner', 'price': 45200}]
                    ))

                # Cabs and Hotels
                all_cities = City.objects.filter(country__code="IN")[:5]
                for city_item in all_cities:
                    # HOTEL
                    inventory_candidates.append(SearchInventory(
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
                    # CAB
                    inventory_candidates.append(SearchInventory(
                        service_type='cab', title='Local Taxi Partner', code='Standard',
                        origin_city=city_item.name, destination_city=city_item.name,
                        duration='On Demand',
                        meta={'cab_types': [{'name': 'Sedan', 'price_per_km': 15, 'base_fare': 150}]},
                        providers=[{'provider': 'LocalPartner', 'price': 400}]
                    ))

                # Idempotent upsert of SearchInventory
                existing_inventory = {(si.service_type, si.code, si.origin_city, si.destination_city, si.title): si for si in SearchInventory.objects.all()}
                
                inv_to_create = []
                for candidate in inventory_candidates:
                    metrics["SearchInventory"]["scanned"] += 1
                    key = (candidate.service_type, candidate.code, candidate.origin_city, candidate.destination_city, candidate.title)
                    existing = existing_inventory.get(key)
                    if existing:
                        # Compare fields to check if changed
                        changed = False
                        if existing.departure_time != candidate.departure_time:
                            existing.departure_time = candidate.departure_time
                            changed = True
                        if existing.arrival_time != candidate.arrival_time:
                            existing.arrival_time = candidate.arrival_time
                            changed = True
                        if existing.duration != candidate.duration:
                            existing.duration = candidate.duration
                            changed = True
                        if existing.meta != candidate.meta:
                            existing.meta = candidate.meta
                            changed = True
                        
                        if changed:
                            if not dry_run:
                                existing.save()
                            metrics["SearchInventory"]["updated"] += 1
                        else:
                            metrics["SearchInventory"]["unchanged"] += 1
                    else:
                        inv_to_create.append(candidate)
                        metrics["SearchInventory"]["created"] += 1

                if inv_to_create and not dry_run:
                    SearchInventory.objects.bulk_create(inv_to_create, batch_size=1000)

                self.stdout.write(self.style.SUCCESS(f"  SearchInventory metrics: {metrics['SearchInventory']}"))

        except Exception as e:
            self.stderr.write(f"[ERROR] [Database Error] Ingestion transaction failed: {e}")
            import traceback
            traceback.print_exc()
            return

        self.stdout.write(self.style.SUCCESS(f"\n[SUCCESS] Seeding completed. Reports:\n{metrics}"))
