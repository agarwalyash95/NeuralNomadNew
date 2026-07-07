from django.core.management.base import BaseCommand
from apps.reference.models import Country, State, City, Airport, Airline, AttractionMaster, ActivityMaster

class Command(BaseCommand):
    help = 'Seeds initial reference data'

    def handle(self, *args, **kwargs):
        self.stdout.write("Seeding reference data...")

        # 1. Countries
        india, _ = Country.objects.get_or_create(name="India", code="IN", currency_code="INR")
        japan, _ = Country.objects.get_or_create(name="Japan", code="JP", currency_code="JPY")
        uae, _ = Country.objects.get_or_create(name="United Arab Emirates", code="AE", currency_code="AED")

        # 2. States (India)
        maharashtra, _ = State.objects.get_or_create(country=india, name="Maharashtra", code="MH")
        karnataka, _ = State.objects.get_or_create(country=india, name="Karnataka", code="KA")
        delhi_state, _ = State.objects.get_or_create(country=india, name="Delhi", code="DL")
        goa, _ = State.objects.get_or_create(country=india, name="Goa", code="GA")

        # 3. Cities
        mumbai, _ = City.objects.get_or_create(country=india, state=maharashtra, name="Mumbai", latitude=19.0760, longitude=72.8777)
        blr, _ = City.objects.get_or_create(country=india, state=karnataka, name="Bengaluru", latitude=12.9716, longitude=77.5946)
        delhi, _ = City.objects.get_or_create(country=india, state=delhi_state, name="New Delhi", latitude=28.6139, longitude=77.2090)
        tokyo, _ = City.objects.get_or_create(country=japan, name="Tokyo", latitude=35.6762, longitude=139.6503)
        dubai, _ = City.objects.get_or_create(country=uae, name="Dubai", latitude=25.2048, longitude=55.2708)

        # 4. Airports (Handled by seed_all_bulk.py)
        # Airport.objects.get_or_create(city=mumbai, name="Chhatrapati Shivaji Maharaj International Airport", iata_code="BOM")
        # Airport.objects.get_or_create(city=blr, name="Kempegowda International Airport", iata_code="BLR")
        # Airport.objects.get_or_create(city=delhi, name="Indira Gandhi International Airport", iata_code="DEL")
        # Airport.objects.get_or_create(city=tokyo, name="Haneda Airport", iata_code="HND")
        # Airport.objects.get_or_create(city=tokyo, name="Narita International Airport", iata_code="NRT")
        # Airport.objects.get_or_create(city=dubai, name="Dubai International Airport", iata_code="DXB")

        # 5. Airlines
        Airline.objects.get_or_create(name="Air India", iata_code="AI")
        Airline.objects.get_or_create(name="IndiGo", iata_code="6E")
        Airline.objects.get_or_create(name="Emirates", iata_code="EK")
        Airline.objects.get_or_create(name="All Nippon Airways", iata_code="NH")

        # 6. Attractions & Activities
        AttractionMaster.objects.get_or_create(city=mumbai, name="Gateway of India", category="Monument", user_rating=4.6)
        AttractionMaster.objects.get_or_create(city=delhi, name="Red Fort", category="Monument", user_rating=4.5)
        AttractionMaster.objects.get_or_create(city=dubai, name="Burj Khalifa", category="Landmark", user_rating=4.8)
        AttractionMaster.objects.get_or_create(city=tokyo, name="Tokyo Tower", category="Landmark", user_rating=4.5)

        ActivityMaster.objects.get_or_create(city=dubai, name="Desert Safari", category="Adventure", price_estimate=150)
        ActivityMaster.objects.get_or_create(city=tokyo, name="Sushi Making Class", category="Food", price_estimate=80)

        self.stdout.write(self.style.SUCCESS("Successfully seeded reference data."))
