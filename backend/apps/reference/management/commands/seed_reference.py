"""
Management command to seed reference data.
Usage: python manage.py seed_reference [--flush]
"""

from django.core.management.base import BaseCommand
from django.db import transaction
from apps.reference.models import (
    Country, State, City, TimeZoneInfo,
    Airport, Airline, AirportRoute,
    RailwayStation, TrainRoute,
    BusStation, BusRoute,
    HotelMaster, RestaurantMaster,
    AttractionMaster, ActivityMaster,
    VisaRequirement, Currency,
    WeatherNormals, TravelSeason,
)


class Command(BaseCommand):
    help = 'Seed reference data (countries, cities, airports, stations, hotels, attractions, etc.)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--flush', action='store_true',
            help='Delete all existing reference data before seeding',
        )

    @transaction.atomic
    def handle(self, *args, **options):
        if options['flush']:
            self.stdout.write(self.style.WARNING('Flushing existing reference data...'))
            for model in [
                WeatherNormals, TravelSeason, VisaRequirement, Currency,
                ActivityMaster, AttractionMaster, RestaurantMaster, HotelMaster,
                BusRoute, BusStation, TrainRoute, RailwayStation,
                AirportRoute, Airline, Airport,
                City, State, TimeZoneInfo, Country,
            ]:
                model.objects.all().delete()

        self._seed_countries()
        self._seed_states_and_cities()
        self._seed_timezones()
        self._seed_airports()
        self._seed_airlines()
        self._seed_airport_routes()
        self._seed_railway_stations()
        self._seed_train_routes()
        self._seed_bus_stations()
        self._seed_hotels()
        self._seed_restaurants()
        self._seed_attractions()
        self._seed_activities()
        self._seed_currencies()
        self._seed_visa_requirements()
        self._seed_weather()
        self._seed_travel_seasons()

        self.stdout.write(self.style.SUCCESS('✅ Reference data seeded successfully!'))

    # ────────────────────────────────────────────────────
    # Countries
    # ────────────────────────────────────────────────────
    def _seed_countries(self):
        countries = [
            {'name': 'India', 'iso_code': 'IN', 'iso_code_3': 'IND', 'currency_code': 'INR', 'phone_code': '+91', 'continent': 'asia', 'timezone_default': 'Asia/Kolkata', 'flag_emoji': '🇮🇳'},
            {'name': 'Thailand', 'iso_code': 'TH', 'iso_code_3': 'THA', 'currency_code': 'THB', 'phone_code': '+66', 'continent': 'asia', 'timezone_default': 'Asia/Bangkok', 'flag_emoji': '🇹🇭'},
            {'name': 'Japan', 'iso_code': 'JP', 'iso_code_3': 'JPN', 'currency_code': 'JPY', 'phone_code': '+81', 'continent': 'asia', 'timezone_default': 'Asia/Tokyo', 'flag_emoji': '🇯🇵'},
            {'name': 'Indonesia', 'iso_code': 'ID', 'iso_code_3': 'IDN', 'currency_code': 'IDR', 'phone_code': '+62', 'continent': 'asia', 'timezone_default': 'Asia/Jakarta', 'flag_emoji': '🇮🇩'},
            {'name': 'Singapore', 'iso_code': 'SG', 'iso_code_3': 'SGP', 'currency_code': 'SGD', 'phone_code': '+65', 'continent': 'asia', 'timezone_default': 'Asia/Singapore', 'flag_emoji': '🇸🇬'},
            {'name': 'United Arab Emirates', 'iso_code': 'AE', 'iso_code_3': 'ARE', 'currency_code': 'AED', 'phone_code': '+971', 'continent': 'asia', 'timezone_default': 'Asia/Dubai', 'flag_emoji': '🇦🇪'},
            {'name': 'Sri Lanka', 'iso_code': 'LK', 'iso_code_3': 'LKA', 'currency_code': 'LKR', 'phone_code': '+94', 'continent': 'asia', 'timezone_default': 'Asia/Colombo', 'flag_emoji': '🇱🇰'},
            {'name': 'Nepal', 'iso_code': 'NP', 'iso_code_3': 'NPL', 'currency_code': 'NPR', 'phone_code': '+977', 'continent': 'asia', 'timezone_default': 'Asia/Kathmandu', 'flag_emoji': '🇳🇵'},
            {'name': 'United States', 'iso_code': 'US', 'iso_code_3': 'USA', 'currency_code': 'USD', 'phone_code': '+1', 'continent': 'north_america', 'timezone_default': 'America/New_York', 'flag_emoji': '🇺🇸'},
            {'name': 'United Kingdom', 'iso_code': 'GB', 'iso_code_3': 'GBR', 'currency_code': 'GBP', 'phone_code': '+44', 'continent': 'europe', 'timezone_default': 'Europe/London', 'flag_emoji': '🇬🇧'},
            {'name': 'France', 'iso_code': 'FR', 'iso_code_3': 'FRA', 'currency_code': 'EUR', 'phone_code': '+33', 'continent': 'europe', 'timezone_default': 'Europe/Paris', 'flag_emoji': '🇫🇷'},
            {'name': 'Italy', 'iso_code': 'IT', 'iso_code_3': 'ITA', 'currency_code': 'EUR', 'phone_code': '+39', 'continent': 'europe', 'timezone_default': 'Europe/Rome', 'flag_emoji': '🇮🇹'},
            {'name': 'Australia', 'iso_code': 'AU', 'iso_code_3': 'AUS', 'currency_code': 'AUD', 'phone_code': '+61', 'continent': 'oceania', 'timezone_default': 'Australia/Sydney', 'flag_emoji': '🇦🇺'},
            {'name': 'Malaysia', 'iso_code': 'MY', 'iso_code_3': 'MYS', 'currency_code': 'MYR', 'phone_code': '+60', 'continent': 'asia', 'timezone_default': 'Asia/Kuala_Lumpur', 'flag_emoji': '🇲🇾'},
            {'name': 'Maldives', 'iso_code': 'MV', 'iso_code_3': 'MDV', 'currency_code': 'MVR', 'phone_code': '+960', 'continent': 'asia', 'timezone_default': 'Indian/Maldives', 'flag_emoji': '🇲🇻'},
        ]
        for c in countries:
            Country.objects.get_or_create(iso_code=c['iso_code'], defaults=c)
        self.stdout.write(f'  → {len(countries)} countries seeded')

    # ────────────────────────────────────────────────────
    # Indian States + Major Cities
    # ────────────────────────────────────────────────────
    def _seed_states_and_cities(self):
        india = Country.objects.get(iso_code='IN')

        states_cities = {
            'Goa': {
                'code': 'GA',
                'cities': [
                    {'name': 'Panaji', 'lat': 15.4909, 'lng': 73.8278, 'pop': 114405, 'major': True,
                     'desc': 'Capital of Goa, known for its Portuguese heritage and vibrant nightlife'},
                    {'name': 'Margao', 'lat': 15.2832, 'lng': 73.9862, 'pop': 88000, 'major': False,
                     'desc': 'Commercial capital of Goa with colonial churches and markets'},
                    {'name': 'Vasco da Gama', 'lat': 15.3982, 'lng': 73.8113, 'pop': 100000, 'major': False,
                     'desc': 'Port city near Dabolim Airport'},
                ],
            },
            'Maharashtra': {
                'code': 'MH',
                'cities': [
                    {'name': 'Mumbai', 'lat': 19.0760, 'lng': 72.8777, 'pop': 12442373, 'major': True,
                     'desc': 'Financial capital of India, home of Bollywood'},
                    {'name': 'Pune', 'lat': 18.5204, 'lng': 73.8567, 'pop': 3124458, 'major': True,
                     'desc': 'Cultural capital of Maharashtra, IT hub'},
                ],
            },
            'Delhi': {
                'code': 'DL',
                'cities': [
                    {'name': 'New Delhi', 'lat': 28.6139, 'lng': 77.2090, 'pop': 16787941, 'major': True,
                     'desc': 'Capital city of India, rich in Mughal and colonial history'},
                ],
            },
            'Karnataka': {
                'code': 'KA',
                'cities': [
                    {'name': 'Bengaluru', 'lat': 12.9716, 'lng': 77.5946, 'pop': 8443675, 'major': True,
                     'desc': 'Silicon Valley of India, pleasant weather year-round'},
                    {'name': 'Mysuru', 'lat': 12.2958, 'lng': 76.6394, 'pop': 920550, 'major': False,
                     'desc': 'City of Palaces, famous for Dussehra celebrations'},
                ],
            },
            'Tamil Nadu': {
                'code': 'TN',
                'cities': [
                    {'name': 'Chennai', 'lat': 13.0827, 'lng': 80.2707, 'pop': 4681087, 'major': True,
                     'desc': 'Gateway to South India, cultural hub'},
                ],
            },
            'Rajasthan': {
                'code': 'RJ',
                'cities': [
                    {'name': 'Jaipur', 'lat': 26.9124, 'lng': 75.7873, 'pop': 3073350, 'major': True,
                     'desc': 'The Pink City, known for palaces, forts, and vibrant culture'},
                    {'name': 'Udaipur', 'lat': 24.5854, 'lng': 73.7125, 'pop': 451735, 'major': False,
                     'desc': 'City of Lakes, romantic destination'},
                    {'name': 'Jodhpur', 'lat': 26.2389, 'lng': 73.0243, 'pop': 1033918, 'major': False,
                     'desc': 'The Blue City, gateway to Thar Desert'},
                ],
            },
            'Kerala': {
                'code': 'KL',
                'cities': [
                    {'name': 'Kochi', 'lat': 9.9312, 'lng': 76.2673, 'pop': 602046, 'major': True,
                     'desc': 'Queen of the Arabian Sea, gateway to Kerala'},
                    {'name': 'Thiruvananthapuram', 'lat': 8.5241, 'lng': 76.9366, 'pop': 957730, 'major': True,
                     'desc': 'Capital of Kerala, temples and backwaters'},
                ],
            },
            'West Bengal': {
                'code': 'WB',
                'cities': [
                    {'name': 'Kolkata', 'lat': 22.5726, 'lng': 88.3639, 'pop': 4486679, 'major': True,
                     'desc': 'City of Joy, cultural capital of India'},
                ],
            },
            'Telangana': {
                'code': 'TG',
                'cities': [
                    {'name': 'Hyderabad', 'lat': 17.3850, 'lng': 78.4867, 'pop': 6809970, 'major': True,
                     'desc': 'City of Pearls, biryani capital, tech hub'},
                ],
            },
            'Uttarakhand': {
                'code': 'UK',
                'cities': [
                    {'name': 'Rishikesh', 'lat': 30.0869, 'lng': 78.2676, 'pop': 102138, 'major': False,
                     'desc': 'Yoga capital of the world, gateway to the Himalayas'},
                    {'name': 'Dehradun', 'lat': 30.3165, 'lng': 78.0322, 'pop': 578420, 'major': True,
                     'desc': 'Capital of Uttarakhand, valley surrounded by mountains'},
                ],
            },
            'Himachal Pradesh': {
                'code': 'HP',
                'cities': [
                    {'name': 'Shimla', 'lat': 31.1048, 'lng': 77.1734, 'pop': 169578, 'major': False,
                     'desc': 'Queen of Hills, former summer capital of British India'},
                    {'name': 'Manali', 'lat': 32.2396, 'lng': 77.1887, 'pop': 8096, 'major': False,
                     'desc': 'Adventure capital in the Himalayas'},
                ],
            },
        }

        # International cities
        international_cities = [
            {'country': 'TH', 'name': 'Bangkok', 'lat': 13.7563, 'lng': 100.5018, 'pop': 8280925, 'major': True,
             'desc': 'Capital of Thailand, temples, street food, and nightlife'},
            {'country': 'TH', 'name': 'Phuket', 'lat': 7.8804, 'lng': 98.3923, 'pop': 416582, 'major': True,
             'desc': 'Thailand\'s largest island, stunning beaches'},
            {'country': 'JP', 'name': 'Tokyo', 'lat': 35.6762, 'lng': 139.6503, 'pop': 13960000, 'major': True,
             'desc': 'Capital of Japan, ultramodern meets traditional'},
            {'country': 'JP', 'name': 'Kyoto', 'lat': 35.0116, 'lng': 135.7681, 'pop': 1475183, 'major': True,
             'desc': 'Ancient capital, temples, geisha districts, bamboo forests'},
            {'country': 'ID', 'name': 'Bali', 'lat': -8.3405, 'lng': 115.0920, 'pop': 4225000, 'major': True,
             'desc': 'Island of the Gods, beaches, temples, rice terraces'},
            {'country': 'SG', 'name': 'Singapore', 'lat': 1.3521, 'lng': 103.8198, 'pop': 5686000, 'major': True,
             'desc': 'Garden City, futuristic architecture, food paradise'},
            {'country': 'AE', 'name': 'Dubai', 'lat': 25.2048, 'lng': 55.2708, 'pop': 3331420, 'major': True,
             'desc': 'City of superlatives, luxury shopping, ultramodern architecture'},
            {'country': 'LK', 'name': 'Colombo', 'lat': 6.9271, 'lng': 79.8612, 'pop': 752993, 'major': True,
             'desc': 'Capital of Sri Lanka, colonial heritage meets modern'},
            {'country': 'NP', 'name': 'Kathmandu', 'lat': 27.7172, 'lng': 85.3240, 'pop': 1442271, 'major': True,
             'desc': 'Capital of Nepal, gateway to the Himalayas'},
            {'country': 'MY', 'name': 'Kuala Lumpur', 'lat': 3.1390, 'lng': 101.6869, 'pop': 1768000, 'major': True,
             'desc': 'Capital of Malaysia, Petronas Towers, diverse food'},
            {'country': 'MV', 'name': 'Malé', 'lat': 4.1755, 'lng': 73.5093, 'pop': 252768, 'major': True,
             'desc': 'Capital of Maldives, tropical island paradise'},
        ]

        for state_name, data in states_cities.items():
            state, _ = State.objects.get_or_create(
                country=india, name=state_name,
                defaults={'code': data['code']},
            )
            for city_data in data['cities']:
                City.objects.get_or_create(
                    country=india, name=city_data['name'],
                    defaults={
                        'state': state,
                        'latitude': city_data['lat'],
                        'longitude': city_data['lng'],
                        'population': city_data['pop'],
                        'is_major': city_data['major'],
                        'timezone': 'Asia/Kolkata',
                        'description': city_data['desc'],
                    },
                )

        for city_data in international_cities:
            country = Country.objects.get(iso_code=city_data['country'])
            City.objects.get_or_create(
                country=country, name=city_data['name'],
                defaults={
                    'latitude': city_data['lat'],
                    'longitude': city_data['lng'],
                    'population': city_data['pop'],
                    'is_major': city_data['major'],
                    'timezone': country.timezone_default,
                    'description': city_data['desc'],
                },
            )

        total = City.objects.count()
        self.stdout.write(f'  → {total} cities seeded')

    # ────────────────────────────────────────────────────
    # Timezones
    # ────────────────────────────────────────────────────
    def _seed_timezones(self):
        timezones = [
            {'name': 'Asia/Kolkata', 'utc_offset': '+05:30', 'abbreviation': 'IST'},
            {'name': 'Asia/Tokyo', 'utc_offset': '+09:00', 'abbreviation': 'JST'},
            {'name': 'Asia/Bangkok', 'utc_offset': '+07:00', 'abbreviation': 'ICT'},
            {'name': 'Asia/Singapore', 'utc_offset': '+08:00', 'abbreviation': 'SGT'},
            {'name': 'Asia/Dubai', 'utc_offset': '+04:00', 'abbreviation': 'GST'},
            {'name': 'Asia/Jakarta', 'utc_offset': '+07:00', 'abbreviation': 'WIB'},
            {'name': 'Asia/Colombo', 'utc_offset': '+05:30', 'abbreviation': 'IST'},
            {'name': 'Asia/Kathmandu', 'utc_offset': '+05:45', 'abbreviation': 'NPT'},
            {'name': 'Asia/Kuala_Lumpur', 'utc_offset': '+08:00', 'abbreviation': 'MYT'},
            {'name': 'Europe/London', 'utc_offset': '+00:00', 'dst_offset': '+01:00', 'abbreviation': 'GMT'},
            {'name': 'Europe/Paris', 'utc_offset': '+01:00', 'dst_offset': '+02:00', 'abbreviation': 'CET'},
            {'name': 'America/New_York', 'utc_offset': '-05:00', 'dst_offset': '-04:00', 'abbreviation': 'EST'},
            {'name': 'Australia/Sydney', 'utc_offset': '+10:00', 'dst_offset': '+11:00', 'abbreviation': 'AEST'},
            {'name': 'Indian/Maldives', 'utc_offset': '+05:00', 'abbreviation': 'MVT'},
        ]
        for tz in timezones:
            TimeZoneInfo.objects.get_or_create(name=tz['name'], defaults=tz)
        self.stdout.write(f'  → {len(timezones)} timezones seeded')

    # ────────────────────────────────────────────────────
    # Airports
    # ────────────────────────────────────────────────────
    def _seed_airports(self):
        airports = [
            # India
            {'city': 'New Delhi', 'iata': 'DEL', 'name': 'Indira Gandhi International Airport', 'display': 'Delhi Airport', 'intl': True, 'lat': 28.5562, 'lng': 77.1000},
            {'city': 'Mumbai', 'iata': 'BOM', 'name': 'Chhatrapati Shivaji Maharaj International Airport', 'display': 'Mumbai Airport', 'intl': True, 'lat': 19.0896, 'lng': 72.8656},
            {'city': 'Bengaluru', 'iata': 'BLR', 'name': 'Kempegowda International Airport', 'display': 'Bengaluru Airport', 'intl': True, 'lat': 13.1986, 'lng': 77.7066},
            {'city': 'Kolkata', 'iata': 'CCU', 'name': 'Netaji Subhas Chandra Bose International Airport', 'display': 'Kolkata Airport', 'intl': True, 'lat': 22.6520, 'lng': 88.4463},
            {'city': 'Chennai', 'iata': 'MAA', 'name': 'Chennai International Airport', 'display': 'Chennai Airport', 'intl': True, 'lat': 12.9941, 'lng': 80.1709},
            {'city': 'Hyderabad', 'iata': 'HYD', 'name': 'Rajiv Gandhi International Airport', 'display': 'Hyderabad Airport', 'intl': True, 'lat': 17.2403, 'lng': 78.4294},
            {'city': 'Kochi', 'iata': 'COK', 'name': 'Cochin International Airport', 'display': 'Kochi Airport', 'intl': True, 'lat': 10.1520, 'lng': 76.4019},
            {'city': 'Panaji', 'iata': 'GOI', 'name': 'Manohar International Airport', 'display': 'Goa Airport', 'intl': True, 'lat': 15.3808, 'lng': 73.8314},
            {'city': 'Jaipur', 'iata': 'JAI', 'name': 'Jaipur International Airport', 'display': 'Jaipur Airport', 'intl': True, 'lat': 26.8242, 'lng': 75.8122},
            {'city': 'Pune', 'iata': 'PNQ', 'name': 'Pune Airport', 'display': 'Pune Airport', 'intl': False, 'lat': 18.5822, 'lng': 73.9197},
            {'city': 'Dehradun', 'iata': 'DED', 'name': 'Jolly Grant Airport', 'display': 'Dehradun Airport', 'intl': False, 'lat': 30.1897, 'lng': 78.1803},
            # International
            {'city': 'Bangkok', 'iata': 'BKK', 'name': 'Suvarnabhumi Airport', 'display': 'Bangkok Airport', 'intl': True, 'lat': 13.6900, 'lng': 100.7501},
            {'city': 'Tokyo', 'iata': 'NRT', 'name': 'Narita International Airport', 'display': 'Tokyo Narita', 'intl': True, 'lat': 35.7647, 'lng': 140.3864},
            {'city': 'Bali', 'iata': 'DPS', 'name': 'Ngurah Rai International Airport', 'display': 'Bali Airport', 'intl': True, 'lat': -8.7482, 'lng': 115.1672},
            {'city': 'Singapore', 'iata': 'SIN', 'name': 'Singapore Changi Airport', 'display': 'Changi Airport', 'intl': True, 'lat': 1.3644, 'lng': 103.9915},
            {'city': 'Dubai', 'iata': 'DXB', 'name': 'Dubai International Airport', 'display': 'Dubai Airport', 'intl': True, 'lat': 25.2532, 'lng': 55.3657},
            {'city': 'Colombo', 'iata': 'CMB', 'name': 'Bandaranaike International Airport', 'display': 'Colombo Airport', 'intl': True, 'lat': 7.1808, 'lng': 79.8841},
            {'city': 'Kathmandu', 'iata': 'KTM', 'name': 'Tribhuvan International Airport', 'display': 'Kathmandu Airport', 'intl': True, 'lat': 27.6966, 'lng': 85.3591},
            {'city': 'Kuala Lumpur', 'iata': 'KUL', 'name': 'Kuala Lumpur International Airport', 'display': 'KL Airport', 'intl': True, 'lat': 2.7456, 'lng': 101.7099},
            {'city': 'Phuket', 'iata': 'HKT', 'name': 'Phuket International Airport', 'display': 'Phuket Airport', 'intl': True, 'lat': 8.1132, 'lng': 98.3169},
            {'city': 'Malé', 'iata': 'MLE', 'name': 'Velana International Airport', 'display': 'Malé Airport', 'intl': True, 'lat': 4.1918, 'lng': 73.5292},
        ]
        for a in airports:
            city = City.objects.filter(name=a['city']).first()
            if city:
                Airport.objects.get_or_create(
                    iata_code=a['iata'],
                    defaults={
                        'city': city, 'name': a['name'], 'display_name': a['display'],
                        'is_international': a['intl'], 'latitude': a['lat'], 'longitude': a['lng'],
                        'timezone': city.timezone,
                    },
                )
        self.stdout.write(f'  → {len(airports)} airports seeded')

    # ────────────────────────────────────────────────────
    # Airlines
    # ────────────────────────────────────────────────────
    def _seed_airlines(self):
        india = Country.objects.get(iso_code='IN')
        airlines = [
            {'iata': '6E', 'name': 'IndiGo', 'alliance': 'none', 'low_cost': True, 'country': india},
            {'iata': 'AI', 'name': 'Air India', 'alliance': 'star_alliance', 'low_cost': False, 'country': india},
            {'iata': 'UK', 'name': 'Vistara', 'alliance': 'none', 'low_cost': False, 'country': india},
            {'iata': 'SG', 'name': 'SpiceJet', 'alliance': 'none', 'low_cost': True, 'country': india},
            {'iata': 'G8', 'name': 'Go First', 'alliance': 'none', 'low_cost': True, 'country': india},
            {'iata': 'QP', 'name': 'Akasa Air', 'alliance': 'none', 'low_cost': True, 'country': india},
            {'iata': 'EK', 'name': 'Emirates', 'alliance': 'none', 'low_cost': False, 'country': None},
            {'iata': 'SQ', 'name': 'Singapore Airlines', 'alliance': 'star_alliance', 'low_cost': False, 'country': None},
            {'iata': 'TG', 'name': 'Thai Airways', 'alliance': 'star_alliance', 'low_cost': False, 'country': None},
        ]
        for a in airlines:
            Airline.objects.get_or_create(
                iata_code=a['iata'],
                defaults={
                    'name': a['name'], 'alliance': a['alliance'],
                    'is_low_cost': a['low_cost'], 'country': a['country'],
                },
            )
        self.stdout.write(f'  → {len(airlines)} airlines seeded')

    # ────────────────────────────────────────────────────
    # Airport Routes
    # ────────────────────────────────────────────────────
    def _seed_airport_routes(self):
        routes = [
            # Domestic India
            ('DEL', 'GOI', 150, 5500, 1885),
            ('DEL', 'BOM', 130, 4500, 1148),
            ('DEL', 'BLR', 170, 5000, 1740),
            ('DEL', 'CCU', 135, 4000, 1305),
            ('DEL', 'MAA', 170, 5200, 1760),
            ('BOM', 'GOI', 60, 3000, 450),
            ('BOM', 'BLR', 90, 3500, 842),
            ('CCU', 'GOI', 165, 6000, 1850),
            ('CCU', 'BLR', 165, 5500, 1560),
            ('CCU', 'DEL', 135, 4000, 1305),
            ('BLR', 'COK', 60, 2500, 356),
            ('DEL', 'JAI', 55, 2500, 260),
            # International from India
            ('DEL', 'BKK', 240, 15000, 2918),
            ('DEL', 'DXB', 210, 12000, 2208),
            ('DEL', 'SIN', 330, 18000, 4140),
            ('BOM', 'DXB', 195, 10000, 1936),
            ('BOM', 'SIN', 330, 17000, 3912),
            ('BOM', 'BKK', 270, 16000, 3334),
            ('CCU', 'BKK', 195, 14000, 2288),
            ('DEL', 'NRT', 420, 30000, 5841),
            ('DEL', 'KTM', 90, 8000, 800),
            ('COK', 'DXB', 240, 11000, 2810),
            ('CCU', 'KTM', 60, 5000, 560),
            ('BLR', 'SIN', 240, 15000, 3013),
        ]
        for from_code, to_code, duration, price, dist in routes:
            from_apt = Airport.objects.filter(iata_code=from_code).first()
            to_apt = Airport.objects.filter(iata_code=to_code).first()
            if from_apt and to_apt:
                AirportRoute.objects.get_or_create(
                    from_airport=from_apt, to_airport=to_apt,
                    defaults={
                        'avg_duration_minutes': duration,
                        'avg_price': price,
                        'distance_km': dist,
                    },
                )
        self.stdout.write(f'  → {len(routes)} airport routes seeded')

    # ────────────────────────────────────────────────────
    # Railway Stations
    # ────────────────────────────────────────────────────
    def _seed_railway_stations(self):
        stations = [
            ('New Delhi', 'NDLS', 'New Delhi Railway Station', 'junction_terminal', 28.6422, 77.2199, 'NR'),
            ('Mumbai', 'CSMT', 'Chhatrapati Shivaji Maharaj Terminus', 'terminal', 18.9398, 72.8355, 'CR'),
            ('Mumbai', 'BCT', 'Mumbai Central', 'terminal', 18.9692, 72.8198, 'WR'),
            ('Kolkata', 'HWH', 'Howrah Junction', 'junction_terminal', 22.5836, 88.3424, 'ER'),
            ('Kolkata', 'SDAH', 'Sealdah', 'terminal', 22.5656, 88.3698, 'ER'),
            ('Chennai', 'MAS', 'Chennai Central', 'terminal', 13.0827, 80.2751, 'SR'),
            ('Bengaluru', 'SBC', 'KSR Bengaluru City Junction', 'junction', 12.9779, 77.5700, 'SWR'),
            ('Hyderabad', 'SC', 'Secunderabad Junction', 'junction', 17.4337, 78.5016, 'SCR'),
            ('Jaipur', 'JP', 'Jaipur Junction', 'junction', 26.9196, 75.7879, 'NWR'),
            ('Panaji', 'MAO', 'Madgaon Junction', 'junction', 15.2894, 73.9379, 'KR'),
            ('Kochi', 'ERS', 'Ernakulam Junction', 'junction', 9.9683, 76.2888, 'SR'),
            ('Pune', 'PUNE', 'Pune Junction', 'junction', 18.5286, 73.8734, 'CR'),
            ('Dehradun', 'DDN', 'Dehradun', 'terminal', 30.3215, 78.0441, 'NR'),
        ]
        for city_name, code, name, stype, lat, lng, zone in stations:
            city = City.objects.filter(name=city_name).first()
            if city:
                RailwayStation.objects.get_or_create(
                    code=code,
                    defaults={
                        'city': city, 'name': name, 'station_type': stype,
                        'latitude': lat, 'longitude': lng, 'zone': zone,
                    },
                )
        self.stdout.write(f'  → {len(stations)} railway stations seeded')

    # ────────────────────────────────────────────────────
    # Train Routes
    # ────────────────────────────────────────────────────
    def _seed_train_routes(self):
        routes = [
            ('NDLS', 'HWH', 'Rajdhani Express', '12301', 1020, 1451, ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], ['1A', '2A', '3A']),
            ('NDLS', 'CSMT', 'Rajdhani Express', '12951', 960, 1384, ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], ['1A', '2A', '3A']),
            ('HWH', 'MAS', 'Coromandel Express', '12841', 1620, 1662, ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], ['1A', '2A', '3A', 'SL']),
            ('NDLS', 'JP', 'Shatabdi Express', '12015', 275, 308, ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], ['CC', 'EC']),
            ('CSMT', 'MAO', 'Konkan Kanya Express', '10111', 720, 586, ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], ['2A', '3A', 'SL']),
            ('SBC', 'MAS', 'Shatabdi Express', '12007', 300, 362, ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], ['CC', 'EC']),
        ]
        for from_code, to_code, tname, tnum, dur, dist, days, classes in routes:
            from_st = RailwayStation.objects.filter(code=from_code).first()
            to_st = RailwayStation.objects.filter(code=to_code).first()
            if from_st and to_st:
                TrainRoute.objects.get_or_create(
                    train_number=tnum,
                    defaults={
                        'from_station': from_st, 'to_station': to_st,
                        'train_name': tname, 'avg_duration_minutes': dur,
                        'distance_km': dist, 'days_of_week': days, 'classes': classes,
                    },
                )
        self.stdout.write(f'  → {len(routes)} train routes seeded')

    # ────────────────────────────────────────────────────
    # Bus Stations
    # ────────────────────────────────────────────────────
    def _seed_bus_stations(self):
        stations = [
            ('New Delhi', 'ISBT Kashmere Gate', 'ISBT-KG', 'isbt'),
            ('Mumbai', 'Mumbai Central Bus Station', 'MCBS', 'terminal'),
            ('Bengaluru', 'Majestic Bus Station', 'MBS', 'terminal'),
            ('Panaji', 'Panaji KTC Bus Stand', 'KTC-PNJ', 'stand'),
            ('Pune', 'Pune Station Bus Stand', 'PSBS', 'stand'),
            ('Jaipur', 'Sindhi Camp Bus Stand', 'SCBS', 'isbt'),
            ('Manali', 'Manali Bus Stand', 'MNLBS', 'stand'),
            ('Shimla', 'Shimla ISBT', 'SMLA-ISBT', 'isbt'),
        ]
        for city_name, name, code, stype in stations:
            city = City.objects.filter(name=city_name).first()
            if city:
                BusStation.objects.get_or_create(
                    code=code,
                    defaults={'city': city, 'name': name, 'station_type': stype},
                )
        self.stdout.write(f'  → {len(stations)} bus stations seeded')

    # ────────────────────────────────────────────────────
    # Hotels
    # ────────────────────────────────────────────────────
    def _seed_hotels(self):
        hotels = [
            # Goa
            ('Panaji', 'Taj Fort Aguada Resort & Spa', 5, 'resort', 'luxury', 4.6, 350,
             ['pool', 'spa', 'wifi', 'beach', 'gym', 'restaurant'], 'Luxury beachfront resort with private beach'),
            ('Panaji', 'Radisson Goa Candolim', 4, 'hotel', 'premium', 4.3, 200,
             ['pool', 'wifi', 'gym', 'restaurant', 'bar'], 'Premium hotel near Candolim Beach'),
            ('Panaji', 'Zostel Goa', 0, 'hostel', 'budget', 4.2, 85,
             ['wifi', 'common_area', 'kitchen'], 'Popular backpacker hostel'),
            # Delhi
            ('New Delhi', 'The Imperial', 5, 'hotel', 'luxury', 4.7, 280,
             ['pool', 'spa', 'wifi', 'gym', 'restaurant', 'bar', 'business_center'], 'Heritage luxury hotel on Janpath'),
            ('New Delhi', 'The Oberoi', 5, 'hotel', 'luxury', 4.8, 250,
             ['pool', 'spa', 'wifi', 'gym', 'restaurant', 'concierge'], 'World-class luxury in the heart of Delhi'),
            ('New Delhi', 'Zostel Delhi', 0, 'hostel', 'budget', 4.0, 120,
             ['wifi', 'common_area', 'tours'], 'Budget hostel near Paharganj'),
            # Tokyo
            ('Tokyo', 'Park Hyatt Tokyo', 5, 'hotel', 'luxury', 4.7, 180,
             ['pool', 'spa', 'wifi', 'gym', 'restaurant', 'bar', 'concierge'], 'Iconic luxury hotel from Lost in Translation'),
            ('Tokyo', 'Shinjuku Granbell Hotel', 3, 'hotel', 'mid_range', 4.2, 300,
             ['wifi', 'restaurant'], 'Modern hotel in vibrant Shinjuku'),
            # Bali
            ('Bali', 'COMO Uma Ubud', 5, 'resort', 'luxury', 4.8, 120,
             ['pool', 'spa', 'wifi', 'yoga', 'restaurant'], 'Serene luxury in the Ubud jungle'),
            ('Bali', 'The Mulia Bali', 5, 'resort', 'luxury', 4.9, 150,
             ['beach', 'pool', 'spa', 'wifi', 'gym', 'restaurant'], 'Beachfront luxury in Nusa Dua'),
            # Bangkok
            ('Bangkok', 'Mandarin Oriental Bangkok', 5, 'hotel', 'luxury', 4.8, 200,
             ['pool', 'spa', 'wifi', 'gym', 'restaurant', 'river_view'], 'Legendary luxury on the Chao Phraya'),
            ('Bangkok', 'Lub d Bangkok Silom', 0, 'hostel', 'budget', 4.1, 400,
             ['wifi', 'pool', 'common_area', 'bar'], 'Stylish hostel in Silom district'),
        ]
        for city_name, name, stars, htype, price_range, rating, reviews, amenities, desc in hotels:
            city = City.objects.filter(name=city_name).first()
            if city:
                HotelMaster.objects.get_or_create(
                    city=city, name=name,
                    defaults={
                        'stars': stars if stars > 0 else None,
                        'hotel_type': htype, 'price_range': price_range,
                        'rating': rating, 'review_count': reviews,
                        'amenities': amenities, 'description': desc,
                    },
                )
        self.stdout.write(f'  → {len(hotels)} hotels seeded')

    # ────────────────────────────────────────────────────
    # Restaurants
    # ────────────────────────────────────────────────────
    def _seed_restaurants(self):
        restaurants = [
            ('Panaji', 'Fisherman\'s Wharf', 'Goan, Seafood', 3, 4.3, False),
            ('Panaji', 'Gunpowder', 'South Indian, Kerala', 3, 4.5, True),
            ('New Delhi', 'Indian Accent', 'Modern Indian', 4, 4.7, False),
            ('New Delhi', 'Bukhara', 'North Indian, Tandoor', 4, 4.6, False),
            ('New Delhi', 'Karim\'s', 'Mughlai', 2, 4.4, False),
            ('Mumbai', 'Trishna', 'Seafood, Coastal', 3, 4.5, False),
            ('Tokyo', 'Sukiyabashi Jiro', 'Japanese, Sushi', 4, 4.9, False),
            ('Bangkok', 'Gaggan Anand', 'Progressive Indian', 4, 4.8, False),
            ('Bali', 'Locavore', 'Contemporary, Farm-to-table', 4, 4.7, True),
            ('Jaipur', 'Suvarna Mahal', 'Rajasthani, Indian', 4, 4.5, True),
        ]
        for city_name, name, cuisine, price, rating, veg in restaurants:
            city = City.objects.filter(name=city_name).first()
            if city:
                RestaurantMaster.objects.get_or_create(
                    city=city, name=name,
                    defaults={
                        'cuisine_type': cuisine, 'price_level': price,
                        'rating': rating, 'is_vegetarian_friendly': veg,
                    },
                )
        self.stdout.write(f'  → {len(restaurants)} restaurants seeded')

    # ────────────────────────────────────────────────────
    # Attractions
    # ────────────────────────────────────────────────────
    def _seed_attractions(self):
        attractions = [
            # Goa
            ('Panaji', 'Basilica of Bom Jesus', 'religious', 'UNESCO World Heritage church', 4.5, 0, 60, 'Morning'),
            ('Panaji', 'Fort Aguada', 'fort', '17th-century Portuguese fort', 4.3, 0, 90, 'Evening'),
            ('Panaji', 'Calangute Beach', 'beach', 'Queen of Beaches — most popular in Goa', 4.2, 0, 180, 'Evening'),
            # Delhi
            ('New Delhi', 'Red Fort', 'fort', 'UNESCO World Heritage Mughal fort', 4.4, 35, 120, 'Morning'),
            ('New Delhi', 'Qutub Minar', 'monument', 'Tallest brick minaret in the world', 4.5, 35, 90, 'Morning'),
            ('New Delhi', 'India Gate', 'monument', 'War memorial and iconic landmark', 4.6, 0, 45, 'Evening'),
            ('New Delhi', 'Humayun\'s Tomb', 'monument', 'Precursor to the Taj Mahal', 4.5, 35, 90, 'Morning'),
            # Jaipur
            ('Jaipur', 'Amber Fort', 'fort', 'Magnificent hilltop fort', 4.7, 200, 180, 'Morning'),
            ('Jaipur', 'Hawa Mahal', 'palace', 'Palace of Winds — 953 windows', 4.5, 50, 60, 'Morning'),
            ('Jaipur', 'City Palace', 'palace', 'Royal residence and museum', 4.5, 300, 120, 'Morning'),
            # Tokyo
            ('Tokyo', 'Senso-ji Temple', 'temple', 'Tokyo\'s oldest temple in Asakusa', 4.6, 0, 90, 'Morning'),
            ('Tokyo', 'Meiji Shrine', 'temple', 'Peaceful Shinto shrine in Harajuku', 4.5, 0, 60, 'Morning'),
            ('Tokyo', 'Tokyo Tower', 'viewpoint', 'Iconic 333m communications tower', 4.4, 1200, 90, 'Evening'),
            # Bali
            ('Bali', 'Uluwatu Temple', 'temple', 'Clifftop temple with sunset views', 4.7, 50000, 120, 'Evening'),
            ('Bali', 'Tegallalang Rice Terraces', 'viewpoint', 'Iconic stepped rice paddies', 4.5, 15000, 120, 'Morning'),
            # Bangkok
            ('Bangkok', 'Grand Palace', 'palace', 'Former royal residence, Wat Phra Kaew', 4.6, 500, 180, 'Morning'),
            ('Bangkok', 'Wat Arun', 'temple', 'Temple of Dawn on the Chao Phraya', 4.5, 100, 60, 'Evening'),
        ]
        for city_name, name, cat, desc, rating, fee, dur, best_time in attractions:
            city = City.objects.filter(name=city_name).first()
            if city:
                AttractionMaster.objects.get_or_create(
                    city=city, name=name,
                    defaults={
                        'category': cat, 'description': desc,
                        'rating': rating, 'entry_fee': fee, 'fee_currency': 'INR',
                        'duration_minutes': dur, 'best_time': best_time,
                    },
                )
        self.stdout.write(f'  → {len(attractions)} attractions seeded')

    # ────────────────────────────────────────────────────
    # Activities
    # ────────────────────────────────────────────────────
    def _seed_activities(self):
        activities = [
            ('Panaji', 'Scuba Diving at Grande Island', 'water_sport', 'Explore marine life', 180, 'mid_range', 'moderate'),
            ('Panaji', 'Sunset River Cruise', 'cultural', 'Mandovi river cruise with music', 120, 'budget', 'easy'),
            ('Rishikesh', 'White Water Rafting', 'adventure', 'Rafting on the Ganges', 240, 'mid_range', 'moderate'),
            ('Rishikesh', 'Bungee Jumping', 'adventure', '83m bungee jump', 30, 'premium', 'challenging'),
            ('Manali', 'Solang Valley Paragliding', 'adventure', 'Tandem paragliding in the valley', 30, 'mid_range', 'easy'),
            ('Jaipur', 'Rajasthani Cooking Class', 'cooking_class', 'Learn to cook authentic Rajasthani', 180, 'budget', 'easy'),
            ('Tokyo', 'Tsukiji Fish Market Tour', 'food_tour', 'Guided tour of the outer market', 180, 'mid_range', 'easy'),
            ('Bali', 'Ubud Cycling Tour', 'cycling', 'Cycle through rice paddies', 240, 'mid_range', 'moderate'),
            ('Bangkok', 'Floating Market Tour', 'cultural', 'Visit Damnoen Saduak market', 300, 'budget', 'easy'),
        ]
        for city_name, name, cat, desc, dur, price, diff in activities:
            city = City.objects.filter(name=city_name).first()
            if city:
                ActivityMaster.objects.get_or_create(
                    city=city, name=name,
                    defaults={
                        'category': cat, 'description': desc,
                        'duration_minutes': dur, 'price_range': price,
                        'difficulty_level': diff,
                    },
                )
        self.stdout.write(f'  → {len(activities)} activities seeded')

    # ────────────────────────────────────────────────────
    # Currencies
    # ────────────────────────────────────────────────────
    def _seed_currencies(self):
        currencies = [
            ('INR', 'Indian Rupee', '₹', 'IN'),
            ('USD', 'US Dollar', '$', 'US'),
            ('EUR', 'Euro', '€', 'FR'),
            ('GBP', 'British Pound', '£', 'GB'),
            ('JPY', 'Japanese Yen', '¥', 'JP'),
            ('THB', 'Thai Baht', '฿', 'TH'),
            ('SGD', 'Singapore Dollar', 'S$', 'SG'),
            ('AED', 'UAE Dirham', 'د.إ', 'AE'),
            ('IDR', 'Indonesian Rupiah', 'Rp', 'ID'),
            ('LKR', 'Sri Lankan Rupee', 'Rs', 'LK'),
            ('NPR', 'Nepalese Rupee', 'Rs', 'NP'),
            ('MYR', 'Malaysian Ringgit', 'RM', 'MY'),
            ('AUD', 'Australian Dollar', 'A$', 'AU'),
            ('MVR', 'Maldivian Rufiyaa', 'Rf', 'MV'),
        ]
        for code, name, symbol, country_iso in currencies:
            country = Country.objects.filter(iso_code=country_iso).first()
            Currency.objects.get_or_create(
                code=code,
                defaults={'name': name, 'symbol': symbol, 'country': country},
            )
        self.stdout.write(f'  → {len(currencies)} currencies seeded')

    # ────────────────────────────────────────────────────
    # Visa Requirements (from India)
    # ────────────────────────────────────────────────────
    def _seed_visa_requirements(self):
        india = Country.objects.get(iso_code='IN')
        visas = [
            ('TH', False, 'visa_free', 0, 0, '30 days', 'Visa-free for Indian passport holders'),
            ('NP', False, 'visa_free', 0, 0, 'Unlimited', 'No visa required — open border'),
            ('ID', True, 'on_arrival', 0, 35, '30 days', 'Visa on Arrival at Bali'),
            ('SG', True, 'e_visa', 3, 30, '30 days', 'Apply online via ICA'),
            ('AE', True, 'on_arrival', 0, 0, '14 days', 'Visa on arrival for Indian nationals'),
            ('JP', True, 'sticker', 5, 25, '90 days', 'Apply at embassy/consulate'),
            ('LK', True, 'eta', 1, 20, '30 days', 'ETA available online'),
            ('MY', True, 'e_visa', 2, 25, '30 days', 'eNTRI or eVisa'),
            ('GB', True, 'sticker', 15, 140, '6 months', 'Apply via VFS Global'),
            ('US', True, 'sticker', 30, 160, '10 years', 'B1/B2 visitor visa'),
            ('FR', True, 'sticker', 10, 80, '90 days', 'Schengen visa via VFS'),
            ('AU', True, 'e_visa', 10, 145, '12 months', 'Apply online via immi.gov.au'),
            ('MV', True, 'on_arrival', 0, 0, '30 days', 'Free visa on arrival for all'),
        ]
        for to_iso, required, vtype, days, fee, validity, notes in visas:
            to_country = Country.objects.filter(iso_code=to_iso).first()
            if to_country:
                VisaRequirement.objects.get_or_create(
                    from_country=india, to_country=to_country,
                    defaults={
                        'visa_required': required, 'visa_type': vtype,
                        'processing_days': days, 'fee': fee, 'fee_currency': 'USD',
                        'validity': validity, 'notes': notes,
                    },
                )
        self.stdout.write(f'  → {len(visas)} visa requirements seeded')

    # ────────────────────────────────────────────────────
    # Weather Normals
    # ────────────────────────────────────────────────────
    def _seed_weather(self):
        weather_data = {
            'Panaji': [
                (1, 33, 20, 0, 60, 'Dry and pleasant'),
                (2, 34, 21, 0, 58, 'Dry and warm'),
                (3, 34, 23, 1, 60, 'Hot'),
                (4, 34, 25, 15, 68, 'Hot and humid'),
                (5, 33, 26, 100, 75, 'Pre-monsoon showers'),
                (6, 30, 25, 600, 85, 'Heavy monsoon rains'),
                (7, 29, 24, 900, 88, 'Peak monsoon'),
                (8, 29, 24, 500, 85, 'Monsoon continuing'),
                (9, 30, 24, 250, 80, 'Monsoon retreating'),
                (10, 33, 24, 125, 72, 'Post-monsoon, clearing up'),
                (11, 34, 22, 20, 65, 'Pleasant and dry'),
                (12, 33, 20, 5, 62, 'Cool and pleasant'),
            ],
            'New Delhi': [
                (1, 21, 7, 18, 55, 'Cold and foggy'),
                (2, 24, 10, 15, 50, 'Cool'),
                (3, 31, 15, 10, 35, 'Warming up'),
                (4, 38, 22, 8, 25, 'Hot'),
                (5, 42, 27, 18, 25, 'Very hot'),
                (6, 40, 29, 55, 45, 'Hot with dust storms'),
                (7, 36, 27, 200, 75, 'Monsoon begins'),
                (8, 35, 27, 220, 78, 'Peak monsoon'),
                (9, 35, 25, 115, 65, 'Monsoon retreating'),
                (10, 34, 19, 15, 45, 'Post-monsoon, pleasant'),
                (11, 29, 12, 5, 40, 'Cool'),
                (12, 23, 8, 8, 50, 'Cold'),
            ],
            'Tokyo': [
                (1, 10, 2, 52, 50, 'Cold and dry'),
                (2, 11, 3, 56, 52, 'Cold'),
                (3, 14, 6, 117, 58, 'Warming up'),
                (4, 19, 11, 125, 62, 'Cherry blossom season'),
                (5, 24, 16, 138, 65, 'Pleasant'),
                (6, 26, 19, 168, 75, 'Rainy season begins'),
                (7, 30, 23, 154, 78, 'Hot and humid'),
                (8, 31, 24, 168, 72, 'Peak summer'),
                (9, 27, 21, 210, 70, 'Typhoon season'),
                (10, 22, 15, 198, 65, 'Autumn foliage'),
                (11, 17, 9, 93, 58, 'Cool'),
                (12, 12, 4, 51, 52, 'Cold'),
            ],
        }
        count = 0
        for city_name, months in weather_data.items():
            city = City.objects.filter(name=city_name).first()
            if city:
                for month, high, low, rain, humidity, desc in months:
                    WeatherNormals.objects.get_or_create(
                        city=city, month=month,
                        defaults={
                            'avg_temp_high': high, 'avg_temp_low': low,
                            'avg_rainfall_mm': rain, 'avg_humidity': humidity,
                            'weather_description': desc,
                        },
                    )
                    count += 1
        self.stdout.write(f'  → {count} weather records seeded')

    # ────────────────────────────────────────────────────
    # Travel Seasons
    # ────────────────────────────────────────────────────
    def _seed_travel_seasons(self):
        seasons = [
            ('Panaji', 'peak', 11, 2, 'Best weather, high tourist season', 'very_high'),
            ('Panaji', 'shoulder', 3, 5, 'Hot but fewer crowds', 'moderate'),
            ('Panaji', 'off_peak', 6, 10, 'Monsoon season, many places closed', 'low'),
            ('New Delhi', 'peak', 10, 3, 'Pleasant weather, festival season', 'high'),
            ('New Delhi', 'shoulder', 4, 5, 'Getting hot', 'moderate'),
            ('New Delhi', 'off_peak', 6, 9, 'Extreme heat then monsoon', 'low'),
            ('Tokyo', 'peak', 3, 5, 'Cherry blossom and spring', 'very_high'),
            ('Tokyo', 'peak', 10, 11, 'Autumn foliage', 'very_high'),
            ('Tokyo', 'shoulder', 6, 9, 'Summer and typhoon season', 'moderate'),
            ('Jaipur', 'peak', 10, 3, 'Cool, dry, perfect for sightseeing', 'very_high'),
            ('Jaipur', 'off_peak', 4, 9, 'Extreme heat then monsoon', 'low'),
            ('Bali', 'peak', 4, 10, 'Dry season', 'very_high'),
            ('Bali', 'off_peak', 11, 3, 'Wet season but fewer crowds', 'moderate'),
            ('Bangkok', 'peak', 11, 2, 'Cool and dry', 'very_high'),
            ('Bangkok', 'off_peak', 6, 10, 'Monsoon rains', 'low'),
        ]
        for city_name, stype, start, end, desc, crowd in seasons:
            city = City.objects.filter(name=city_name).first()
            if city:
                TravelSeason.objects.get_or_create(
                    city=city, season_type=stype, start_month=start,
                    defaults={
                        'end_month': end, 'description': desc, 'crowd_level': crowd,
                    },
                )
        self.stdout.write(f'  → {len(seasons)} travel seasons seeded')
