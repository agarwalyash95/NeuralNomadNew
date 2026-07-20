from django.core.management.base import BaseCommand
from apps.reference.models import City, Airport, RailwayStation, BusStation, MetroArea, MetroAreaCity, WeatherNormals, TravelSeason
from apps.reference.utils import normalize_search_name, normalize_code

class Command(BaseCommand):
    help = "Validates constraints, checks coordinates, and offers safe, non-destructive fixes."

    def add_arguments(self, parser):
        parser.add_argument("--fix", action="store_true", help="Perform objectively safe fixes (trim whitespace, normalize names/codes, default timezones)")

    def handle(self, *args, **options):
        fix = options["fix"]
        self.stdout.write(self.style.MIGRATE_HEADING("=== VALIDATING REFERENCE DATA ==="))

        # 1. Validate MetroAreaCity primary constraint
        for metro in MetroArea.objects.all():
            primaries = MetroAreaCity.objects.filter(metro_area=metro, is_primary=True)
            if primaries.count() > 1:
                self.stdout.write(self.style.WARNING(f"Metro Area '{metro.name}' has multiple primary cities!"))
            
            # Check country consistency
            invalid_countries = MetroAreaCity.objects.filter(metro_area=metro).exclude(city__country=metro.country).exclude(membership_type="cross_border")
            if invalid_countries.exists():
                for membership in invalid_countries:
                    self.stdout.write(self.style.WARNING(
                        f"Metro Area City '{membership.city.name}' belongs to metro '{metro.name}' (country: {metro.country.code}) "
                        f"but city is in country '{membership.city.country.code}' without 'cross_border' membership classification!"
                    ))

        # 2. Validate WeatherNormals duplicates
        weather_dups = WeatherNormals.objects.all()
        # Find weather normals sharing city and month
        from django.db.models import Count
        dups = WeatherNormals.objects.values("city", "month").annotate(cnt=Count("id")).filter(cnt__gt=1)
        if dups.exists():
            self.stdout.write(self.style.WARNING(f"Found {dups.count()} duplicate weather normal pairs for (city, month)!"))

        # 3. Perform safe fixes if requested
        if fix:
            self.stdout.write(self.style.NOTICE("Applying safe fixes..."))
            
            # Trim whitespace and normalize names/codes
            # Cities
            updated_cities = 0
            for city in City.objects.all():
                original_name = city.name
                original_tz = city.timezone
                city.name = city.name.strip()
                city.normalized_name = normalize_search_name(city.name)
                
                # Fill default Indian timezone if empty and coords are close to India
                if not city.timezone and city.latitude and city.longitude:
                    # India bounding box approximate
                    if 8.0 <= float(city.latitude) <= 38.0 and 68.0 <= float(city.longitude) <= 98.0:
                        city.timezone = "Asia/Kolkata"
                
                if city.name != original_name or city.timezone != original_tz or not city.normalized_name:
                    city.save(update_fields=["name", "normalized_name", "timezone"])
                    updated_cities += 1
            self.stdout.write(f"Normalized names/timezones for {updated_cities} cities.")

            # Airports
            updated_airports = 0
            for ap in Airport.objects.all():
                original_name = ap.name
                ap.name = ap.name.strip()
                ap.normalized_name = normalize_search_name(ap.name)
                ap.normalized_code = normalize_code(ap.iata_code)
                if ap.name != original_name or not ap.normalized_name or not ap.normalized_code:
                    ap.save(update_fields=["name", "normalized_name", "normalized_code"])
                    updated_airports += 1
            self.stdout.write(f"Normalized names/codes for {updated_airports} airports.")

            # Railway Stations
            updated_stations = 0
            for st in RailwayStation.objects.all():
                original_name = st.name
                st.name = st.name.strip()
                st.normalized_name = normalize_search_name(st.name)
                st.normalized_code = normalize_code(st.code)
                if st.name != original_name or not st.normalized_name or not st.normalized_code:
                    st.save(update_fields=["name", "normalized_name", "normalized_code"])
                    updated_stations += 1
            self.stdout.write(f"Normalized names/codes for {updated_stations} railway stations.")

            # Bus Stations
            updated_bus = 0
            for bs in BusStation.objects.all():
                original_name = bs.name
                bs.name = bs.name.strip()
                bs.normalized_name = normalize_search_name(bs.name)
                if bs.code:
                    bs.normalized_code = normalize_code(bs.code)
                if bs.name != original_name or not bs.normalized_name:
                    bs.save(update_fields=["name", "normalized_name", "normalized_code"])
                    updated_bus += 1
            self.stdout.write(f"Normalized names/codes for {updated_bus} bus stations.")
            
            self.stdout.write(self.style.SUCCESS("Safe fixes completed successfully."))
        else:
            self.stdout.write(self.style.NOTICE("Run with --fix to automatically correct string spacing, fill Indian timezones, and sync denormalized names/codes."))
        
        self.stdout.write(self.style.SUCCESS("Validation complete."))
