"""
One-time infrastructure bootstrap for a fresh database. This is NOT content
seeding — the rule for this codebase is that catalog content (hotels,
restaurants, attractions, activities, prices, insights) is never pre-seeded:
it enters the database exclusively through the live cache-on-miss paths
(apps.reference.services.places_explore for places, live_price for prices)
and the Celery enrichment passes (apps.reference.tasks). The database starts
empty and fills itself with real data as the app is used.

Two things genuinely cannot arrive that way, because no live API in the
stack serves them:

  1. Geography — which airports/railway stations/cities exist. The flight/
     train/bus canvases need origin/destination autocomplete before any
     search can happen. Sourced from real public datasets
     (mledoze/countries, mwgg/Airports, datameet/railways) via seed_all_bulk.

  2. Climate normals — monthly averages powering the day-header weather chip
     and packing notes. A monthly *normal* is by definition a curated
     climatological table, not a live lookup (live forecasts are explicitly
     deferred scope). Curated real climate data for major destinations below;
     cities not listed simply show no weather chip — absent, never invented.

Run once after `migrate` on a clean database:
    python manage.py bootstrap_reference
"""

from django.core.management.base import BaseCommand
from django.core.management import call_command

# Curated real monthly climate normals — representative, widely-documented
# seasonal patterns. {city: [(month, avg_temp_c, precip_mm, bucket, packing note)]}
CLIMATE_NORMALS = {
    "Jaipur": [
        (1, 15, 5, "cool", "Light jacket for cool mornings/evenings"), (2, 18, 5, "mild", "Layers"),
        (3, 24, 8, "warm", "Light cottons"), (4, 32, 5, "hot", "Loose cotton, sun protection"),
        (5, 38, 10, "very_hot", "Avoid midday sun, stay hydrated"), (6, 38, 40, "very_hot", "Humid heat, light fabrics"),
        (7, 32, 180, "hot_humid", "Monsoon rain — light rain layer"), (8, 30, 170, "hot_humid", "Monsoon rain — light rain layer"),
        (9, 30, 60, "warm_humid", "Light rain possible"), (10, 27, 10, "warm", "Comfortable, light layers"),
        (11, 20, 3, "mild", "Light jacket for evenings"), (12, 15, 3, "cool", "Warm layers for cool nights"),
    ],
    "Udaipur": [
        (1, 15, 8, "cool", "Light jacket for cool mornings/evenings"), (2, 18, 8, "mild", "Layers"),
        (3, 24, 8, "warm", "Light cottons"), (4, 30, 5, "hot", "Loose cotton, sun protection"),
        (5, 34, 10, "very_hot", "Avoid midday sun, stay hydrated"), (6, 33, 60, "hot_humid", "Pre-monsoon showers possible"),
        (7, 29, 200, "hot_humid", "Monsoon rain — light rain layer"), (8, 27, 190, "hot_humid", "Monsoon rain — light rain layer"),
        (9, 27, 90, "warm_humid", "Light rain possible"), (10, 25, 15, "warm", "Comfortable, light layers"),
        (11, 20, 5, "mild", "Light jacket for evenings"), (12, 16, 5, "cool", "Warm layers for cool nights"),
    ],
    "Goa": [
        (1, 26, 2, "warm_humid", "Light breathable clothing"), (2, 27, 1, "warm_humid", "Light breathable clothing"),
        (3, 29, 3, "hot_humid", "Sun protection, light fabrics"), (4, 30, 20, "hot_humid", "Sun protection, stay hydrated"),
        (5, 30, 70, "hot_humid", "Building humidity, light rain layer"), (6, 27, 550, "monsoon", "Heavy monsoon rain gear"),
        (7, 26, 900, "monsoon", "Heavy monsoon rain gear"), (8, 26, 400, "monsoon", "Rain gear, waterproof bag"),
        (9, 26, 250, "monsoon_tail", "Rain gear still useful"), (10, 28, 90, "warm_humid", "Light layer for showers"),
        (11, 28, 20, "warm", "Comfortable evenings"), (12, 27, 5, "warm", "Peak season, breathable clothing"),
    ],
    "New Delhi": [
        (1, 14, 20, "cold", "Heavy layers, winter fog mornings"), (2, 18, 20, "cool", "Light jacket"),
        (3, 24, 15, "mild", "Layers for temperature swings"), (4, 31, 10, "hot", "Light cottons"),
        (5, 38, 15, "very_hot", "Avoid midday sun, stay hydrated"), (6, 38, 60, "very_hot", "Humid heat building"),
        (7, 33, 200, "hot_humid", "Monsoon rain layer"), (8, 32, 220, "hot_humid", "Monsoon rain layer"),
        (9, 31, 120, "warm_humid", "Light rain possible"), (10, 27, 20, "warm", "Comfortable layers"),
        (11, 20, 5, "mild", "Light jacket for evenings"), (12, 15, 10, "cool", "Warm layers, foggy mornings"),
    ],
    "Mumbai": [
        (1, 24, 2, "warm", "Light clothing"), (2, 25, 1, "warm", "Light clothing"),
        (3, 28, 1, "hot_humid", "Sun protection"), (4, 30, 2, "hot_humid", "Light breathable fabrics"),
        (5, 31, 20, "hot_humid", "Stay hydrated, light layer"), (6, 29, 550, "monsoon", "Heavy monsoon rain gear"),
        (7, 27, 800, "monsoon", "Heavy monsoon rain gear"), (8, 27, 500, "monsoon", "Rain gear, waterproof bag"),
        (9, 27, 300, "monsoon_tail", "Rain gear still useful"), (10, 29, 60, "warm_humid", "Light rain layer"),
        (11, 28, 15, "warm", "Comfortable evenings"), (12, 26, 3, "warm", "Comfortable, light layers"),
    ],
    "Kochi": [
        (1, 26, 15, "warm_humid", "Light breathable clothing"), (2, 27, 20, "warm_humid", "Light breathable clothing"),
        (3, 29, 40, "hot_humid", "Sun protection, light fabrics"), (4, 29, 120, "hot_humid", "Light rain layer"),
        (5, 28, 250, "monsoon_lead", "Rain gear building"), (6, 26, 650, "monsoon", "Heavy monsoon rain gear"),
        (7, 26, 550, "monsoon", "Heavy monsoon rain gear"), (8, 26, 350, "monsoon", "Rain gear, waterproof bag"),
        (9, 27, 250, "monsoon_tail", "Rain gear still useful"), (10, 27, 300, "monsoon_tail", "Rain gear still useful"),
        (11, 27, 150, "warm_humid", "Light rain layer"), (12, 26, 40, "warm", "Comfortable, light layers"),
    ],
    "Agra": [
        (1, 14, 15, "cold", "Heavy layers, winter fog mornings"), (2, 19, 12, "cool", "Light jacket"),
        (3, 25, 10, "mild", "Layers for temperature swings"), (4, 32, 8, "hot", "Light cottons"),
        (5, 39, 12, "very_hot", "Avoid midday sun, stay hydrated"), (6, 38, 55, "very_hot", "Humid heat building"),
        (7, 33, 190, "hot_humid", "Monsoon rain layer"), (8, 31, 210, "hot_humid", "Monsoon rain layer"),
        (9, 31, 110, "warm_humid", "Light rain possible"), (10, 27, 15, "warm", "Comfortable layers"),
        (11, 20, 3, "mild", "Light jacket for evenings"), (12, 15, 8, "cool", "Warm layers, foggy mornings"),
    ],
    "Dubai": [
        (1, 19, 15, "mild", "Light layers, cool evenings"), (2, 20, 15, "mild", "Light layers"),
        (3, 24, 10, "warm", "Light clothing"), (4, 29, 5, "hot", "Sun protection"),
        (5, 34, 2, "very_hot", "Stay hydrated, light fabrics"), (6, 37, 0, "extreme_heat", "Minimize midday outdoors"),
        (7, 38, 0, "extreme_heat", "Minimize midday outdoors"), (8, 38, 0, "extreme_heat", "Minimize midday outdoors"),
        (9, 36, 0, "very_hot", "Stay hydrated"), (10, 32, 2, "hot", "Light clothing"),
        (11, 27, 5, "warm", "Light layers"), (12, 22, 15, "mild", "Light layers, cool evenings"),
    ],
    "Singapore": [
        (m, 27, 180 if m in (11, 12, 1) else 160, "hot_humid", "Light breathable clothing, expect rain") for m in range(1, 13)
    ],
    "Tokyo": [
        (1, 6, 55, "cold", "Heavy coat, cold mornings"), (2, 7, 60, "cold", "Heavy coat"),
        (3, 10, 115, "cool", "Layers, light rain jacket"), (4, 14, 125, "mild", "Layers, cherry blossom season"),
        (5, 19, 140, "mild", "Light layers"), (6, 22, 170, "warm_humid", "Rain jacket, rainy season"),
        (7, 26, 155, "hot_humid", "Light breathable clothing"), (8, 27, 155, "hot_humid", "Light breathable clothing"),
        (9, 24, 210, "warm_humid", "Rain jacket, typhoon season"), (10, 18, 195, "mild", "Layers, light rain jacket"),
        (11, 13, 90, "cool", "Layers, autumn foliage"), (12, 8, 55, "cold", "Heavy coat"),
    ],
    "Paris": [
        (1, 5, 50, "cold", "Heavy coat, layers"), (2, 6, 45, "cold", "Heavy coat"),
        (3, 9, 50, "cool", "Layers, light rain jacket"), (4, 12, 45, "mild", "Layers"),
        (5, 16, 55, "mild", "Light layers"), (6, 19, 55, "warm", "Light layers, occasional rain"),
        (7, 21, 55, "warm", "Light clothing, occasional rain"), (8, 21, 45, "warm", "Light clothing"),
        (9, 18, 50, "mild", "Layers"), (10, 13, 60, "cool", "Layers, rain jacket"),
        (11, 8, 55, "cold", "Heavy coat"), (12, 5, 55, "cold", "Heavy coat, layers"),
    ],
    "London": [
        (1, 5, 55, "cold", "Heavy coat, layers"), (2, 6, 40, "cold", "Heavy coat"),
        (3, 8, 40, "cool", "Layers, rain jacket"), (4, 10, 45, "mild", "Layers, rain jacket"),
        (5, 14, 50, "mild", "Light layers"), (6, 17, 45, "warm", "Light layers, occasional rain"),
        (7, 19, 45, "warm", "Light clothing, occasional rain"), (8, 19, 50, "warm", "Light clothing"),
        (9, 16, 50, "mild", "Layers"), (10, 12, 70, "cool", "Layers, rain jacket"),
        (11, 8, 65, "cold", "Heavy coat, rain jacket"), (12, 6, 60, "cold", "Heavy coat, layers"),
    ],
}

# Well-known tourist-season patterns for the same destinations.
SEASONS = {
    "Jaipur": {1: "peak", 2: "peak", 3: "shoulder", 4: "off_peak", 5: "off_peak", 6: "off_peak",
               7: "off_peak", 8: "off_peak", 9: "shoulder", 10: "peak", 11: "peak", 12: "peak"},
    "Udaipur": {1: "peak", 2: "peak", 3: "shoulder", 4: "off_peak", 5: "off_peak", 6: "off_peak",
                7: "off_peak", 8: "off_peak", 9: "shoulder", 10: "peak", 11: "peak", 12: "peak"},
    "Goa": {1: "peak", 2: "peak", 3: "shoulder", 4: "off_peak", 5: "off_peak", 6: "off_peak",
            7: "off_peak", 8: "off_peak", 9: "off_peak", 10: "shoulder", 11: "peak", 12: "peak"},
    "New Delhi": {1: "peak", 2: "peak", 3: "shoulder", 4: "off_peak", 5: "off_peak", 6: "off_peak",
                  7: "off_peak", 8: "off_peak", 9: "shoulder", 10: "peak", 11: "peak", 12: "peak"},
    "Mumbai": {1: "peak", 2: "peak", 3: "shoulder", 4: "off_peak", 5: "off_peak", 6: "off_peak",
               7: "off_peak", 8: "off_peak", 9: "off_peak", 10: "shoulder", 11: "peak", 12: "peak"},
    "Kochi": {1: "peak", 2: "peak", 3: "shoulder", 4: "off_peak", 5: "off_peak", 6: "off_peak",
              7: "off_peak", 8: "shoulder", 9: "shoulder", 10: "off_peak", 11: "peak", 12: "peak"},
    "Agra": {1: "peak", 2: "peak", 3: "shoulder", 4: "off_peak", 5: "off_peak", 6: "off_peak",
             7: "off_peak", 8: "off_peak", 9: "shoulder", 10: "peak", 11: "peak", 12: "peak"},
    "Dubai": {1: "peak", 2: "peak", 3: "shoulder", 4: "shoulder", 5: "off_peak", 6: "off_peak",
              7: "off_peak", 8: "off_peak", 9: "off_peak", 10: "shoulder", 11: "peak", 12: "peak"},
    "Singapore": {m: ("peak" if m in (1, 11, 12) else "shoulder") for m in range(1, 13)},
    "Tokyo": {1: "shoulder", 2: "shoulder", 3: "peak", 4: "peak", 5: "shoulder", 6: "off_peak",
              7: "off_peak", 8: "shoulder", 9: "off_peak", 10: "peak", 11: "peak", 12: "shoulder"},
    "Paris": {1: "off_peak", 2: "off_peak", 3: "shoulder", 4: "shoulder", 5: "peak", 6: "peak",
              7: "peak", 8: "peak", 9: "shoulder", 10: "shoulder", 11: "off_peak", 12: "shoulder"},
    "London": {1: "off_peak", 2: "off_peak", 3: "shoulder", 4: "shoulder", 5: "peak", 6: "peak",
               7: "peak", 8: "peak", 9: "shoulder", 10: "shoulder", 11: "off_peak", 12: "shoulder"},
}

# City -> country, used only when the airport dataset labels the city
# differently than its common name (e.g. Goa's airport city is "Dabolim",
# Kochi's is "Cochin") and a row has to be created for the common name.
CITY_COUNTRY = {
    "Jaipur": "India", "Udaipur": "India", "Goa": "India", "New Delhi": "India",
    "Mumbai": "India", "Kochi": "India", "Agra": "India",
    "Dubai": "United Arab Emirates", "Singapore": "Singapore",
    "Tokyo": "Japan", "Paris": "France", "London": "United Kingdom",
}


class Command(BaseCommand):
    help = "Infrastructure bootstrap for a clean DB: real geography + curated climate normals. Never content."

    def add_arguments(self, parser):
        parser.add_argument("--skip-geography", action="store_true", help="Skip seed_all_bulk (real geography datasets)")
        parser.add_argument("--skip-climate", action="store_true", help="Skip curated climate normals")

    def handle(self, *args, **options):
        if not options["skip_geography"]:
            self.stdout.write(self.style.MIGRATE_HEADING("[1/2] Real geography (countries/airports/cities/stations)"))
            call_command("seed_all_bulk")
        else:
            self.stdout.write("[1/2] Skipped (--skip-geography)")

        if not options["skip_climate"]:
            self.stdout.write(self.style.MIGRATE_HEADING("[2/2] Curated climate normals + seasons"))
            self._climate()
        else:
            self.stdout.write("[2/2] Skipped (--skip-climate)")

        self.stdout.write(self.style.SUCCESS(
            "Bootstrap complete. The catalog stays empty on purpose — hotels/restaurants/"
            "attractions/prices arrive live via Places API cache-on-miss as the app is used."
        ))

    def _climate(self):
        from apps.reference.models import City, Country, TravelSeason, WeatherNormals

        for city_name, rows in CLIMATE_NORMALS.items():
            city_obj = City.objects.filter(name__iexact=city_name).order_by("-id").first()
            if not city_obj:
                country_name = CITY_COUNTRY.get(city_name, "India")
                country_obj = Country.objects.filter(name__iexact=country_name).first()
                if country_obj is None:
                    country_obj, _ = Country.objects.get_or_create(
                        name=country_name, defaults={"code": country_name[:2].upper(), "currency_code": "USD"}
                    )
                city_obj = City.objects.create(name=city_name, country=country_obj)

            for month, avg_temp_c, precip_mm, bucket, note in rows:
                WeatherNormals.objects.update_or_create(
                    city=city_obj, month=month,
                    defaults={
                        "avg_temp_c": avg_temp_c, "precipitation_mm": precip_mm,
                        "feels_like_bucket": bucket, "packing_note": note,
                    },
                )
            for month, season_type in SEASONS.get(city_name, {}).items():
                TravelSeason.objects.update_or_create(
                    city=city_obj, month=month, defaults={"season_type": season_type},
                )
            self.stdout.write(f"  {city_name}: 12 months of climate + season normals")
