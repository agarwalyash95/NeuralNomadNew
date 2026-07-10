import datetime
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils.timezone import make_aware
from apps.reference.models import (
    Country, State, City, Airport, Airline, AirportRoute,
    RailwayStation, TrainRoute, BusStation, BusRoute,
    HotelMaster, TravelPriceHistory
)
import math

def safe_get_or_create(model, lookup, defaults):
    obj = model.objects.filter(**lookup).first()
    if obj:
        return obj, False
    return model.objects.create(**lookup, **defaults), True

class Command(BaseCommand):
    help = 'Seeds real-world master reference data and 3 years of daily travel price history'

    def handle(self, *args, **kwargs):
        self.stdout.write("Starting Travel Price History Seeding...")

        # 1. Ensure basic Geo Data exists (fallback if seed_all_bulk wasn't run)
        india, _ = safe_get_or_create(Country, {'code': "IN"}, {'name': "India", 'currency_code': "INR"})
        
        # States
        maharashtra, _ = safe_get_or_create(State, {'country': india, 'name': "Maharashtra"}, {'code': "MH"})
        karnataka, _ = safe_get_or_create(State, {'country': india, 'name': "Karnataka"}, {'code': "KA"})
        delhi_state, _ = safe_get_or_create(State, {'country': india, 'name': "Delhi"}, {'code': "DL"})
        goa_state, _ = safe_get_or_create(State, {'country': india, 'name': "Goa"}, {'code': "GA"})
        hp_state, _ = safe_get_or_create(State, {'country': india, 'name': "Himachal Pradesh"}, {'code': "HP"})

        # Cities (match on name and country)
        mumbai, _ = safe_get_or_create(City, {'country': india, 'name': "Mumbai"}, {'state': maharashtra, 'latitude': 19.0760, 'longitude': 72.8777})
        blr, _ = safe_get_or_create(City, {'country': india, 'name': "Bengaluru"}, {'state': karnataka, 'latitude': 12.9716, 'longitude': 77.5946})
        delhi, _ = safe_get_or_create(City, {'country': india, 'name': "New Delhi"}, {'state': delhi_state, 'latitude': 28.6139, 'longitude': 77.2090})
        goa, _ = safe_get_or_create(City, {'country': india, 'name': "Goa"}, {'state': goa_state, 'latitude': 15.2993, 'longitude': 74.1240})
        manali, _ = safe_get_or_create(City, {'country': india, 'name': "Manali"}, {'state': hp_state, 'latitude': 32.2396, 'longitude': 77.1887})

        # 2. Airports (match on unique iata_code)
        bom_apt, _ = safe_get_or_create(Airport, {'iata_code': "BOM"}, {'city': mumbai, 'name': "Chhatrapati Shivaji Maharaj International Airport", 'latitude': 19.0896, 'longitude': 72.8656})
        del_apt, _ = safe_get_or_create(Airport, {'iata_code': "DEL"}, {'city': delhi, 'name': "Indira Gandhi International Airport", 'latitude': 28.5562, 'longitude': 77.1000})
        blr_apt, _ = safe_get_or_create(Airport, {'iata_code': "BLR"}, {'city': blr, 'name': "Kempegowda International Airport", 'latitude': 13.1986, 'longitude': 77.7066})
        goi_apt, _ = safe_get_or_create(Airport, {'iata_code': "GOI"}, {'city': goa, 'name': "Goa International Airport", 'latitude': 15.3808, 'longitude': 73.8314})
        kuu_apt, _ = safe_get_or_create(Airport, {'iata_code': "KUU"}, {'city': manali, 'name': "Kullu Manali Airport", 'latitude': 31.8767, 'longitude': 77.1528})

        # 3. Airlines (match on unique iata_code)
        indigo, _ = safe_get_or_create(Airline, {'iata_code': "6E"}, {'name': "IndiGo"})
        air_india, _ = safe_get_or_create(Airline, {'iata_code': "AI"}, {'name': "Air India"})
        akasa, _ = safe_get_or_create(Airline, {'iata_code': "QP"}, {'name': "Akasa Air"})

        # 4. Airport Routes (Real Flights)
        flight_routes_data = [
            (del_apt, bom_apt, indigo, 130), # DEL -> BOM
            (bom_apt, del_apt, air_india, 135), # BOM -> DEL
            (blr_apt, goi_apt, akasa, 75), # BLR -> GOI
            (del_apt, kuu_apt, indigo, 80), # DEL -> KUU (Manali)
        ]
        flight_routes = []
        for src, dest, airline, duration in flight_routes_data:
            route, _ = safe_get_or_create(AirportRoute, {'source': src, 'destination': dest, 'airline': airline}, {'duration_mins': duration})
            flight_routes.append(route)

        # 5. Railway Stations (match on unique code)
        ndls_stn, _ = safe_get_or_create(RailwayStation, {'code': "NDLS"}, {'city': delhi, 'name': "New Delhi Railway Station"})
        bct_stn, _ = safe_get_or_create(RailwayStation, {'code': "MMCT"}, {'city': mumbai, 'name': "Mumbai Central"})
        sbc_stn, _ = safe_get_or_create(RailwayStation, {'code': "SBC"}, {'city': blr, 'name': "KSR Bengaluru City"})
        mao_stn, _ = safe_get_or_create(RailwayStation, {'code': "MAO"}, {'city': goa, 'name': "Madgaon Railway Station"})

        # 6. Train Routes (Real Trains)
        train_routes_data = [
            (ndls_stn, bct_stn, "Mumbai Rajdhani", "12952", 940), # NDLS -> MMCT (15h 40m)
            (ndls_stn, bct_stn, "Vande Bharat Express", "22222", 720), # NDLS -> MMCT (12h)
            (sbc_stn, mao_stn, "Yesvantpur Vasco Express", "17309", 750), # SBC -> MAO
        ]
        train_routes = []
        for src, dest, train_name, train_num, duration in train_routes_data:
            route, _ = safe_get_or_create(TrainRoute, {'source': src, 'destination': dest, 'train_name': train_name, 'train_number': train_num}, {'duration_mins': duration})
            train_routes.append(route)

        # 7. Bus Stations
        delhi_bus, _ = safe_get_or_create(BusStation, {'city': delhi, 'name': "Kashmere Gate ISBT"}, {})
        manali_bus, _ = safe_get_or_create(BusStation, {'city': manali, 'name': "Manali Private Bus Stand"}, {})
        blr_bus, _ = safe_get_or_create(BusStation, {'city': blr, 'name': "Kempegowda Bus Station"}, {})
        goa_bus, _ = safe_get_or_create(BusStation, {'city': goa, 'name': "Panaji Bus Stand"}, {})

        # 8. Bus Routes
        bus_routes_data = [
            (delhi_bus, manali_bus, "Zingbus Volvo AC", 720),
            (blr_bus, goa_bus, "KSRTC Ambari Utsav", 660),
        ]
        bus_routes = []
        for src, dest, operator, duration in bus_routes_data:
            route, _ = safe_get_or_create(BusRoute, {'source': src, 'destination': dest, 'operator_name': operator}, {'duration_mins': duration})
            bus_routes.append(route)

        # 9. Hotel Masters (match on name and city)
        hotels_data = [
            (delhi, "The Leela Palace Delhi", 5.0, 4.8, "Chanakyapuri, New Delhi", 18500),
            (mumbai, "The Taj Mahal Palace Mumbai", 5.0, 4.9, "Apollo Bandar, Colaba, Mumbai", 22000),
            (goa, "Cidade de Goa Resort", 4.0, 4.5, "Vainguinim Beach, Panaji, Goa", 9500),
            (manali, "Zostel Manali", 3.0, 4.4, "Old Manali, Himachal Pradesh", 3500),
        ]
        hotels = []
        for city_item, name, stars, rating, addr, base_price in hotels_data:
            hotel_obj, _ = safe_get_or_create(HotelMaster, {'city': city_item, 'name': name}, {'star_rating': stars, 'user_rating': rating, 'address': addr})
            hotels.append((hotel_obj, base_price))

        # 10. Generate 3 Years of Daily Pricing Records (Bulk Insert for Speed)
        # Date range: July 9, 2023 to Dec 31, 2026 (includes future dates for searches)
        start_date = datetime.date(2023, 7, 9)
        end_date = datetime.date(2026, 12, 31)
        delta = end_date - start_date
        total_days = delta.days + 1

        self.stdout.write(f"Pre-generating pricing data for {total_days} days across all routes...")

        pricing_records = []
        
        # Clear old pricing history first
        TravelPriceHistory.objects.all().delete()

        for d_idx in range(total_days):
            current_date = start_date + datetime.timedelta(days=d_idx)
            is_weekend = current_date.weekday() in [4, 5, 6] # Fri, Sat, Sun
            month = current_date.month
            is_peak = month in [5, 6, 10, 11, 12] # May, June, Oct, Nov, Dec (Indian peak travel)

            # Seasonal wave factor using sine
            seasonal_wave = math.sin(d_idx / 45) * 0.15

            # Weekend multiplier
            weekend_multiplier = 0.15 if is_weekend else 0.0

            # Peak season multiplier
            peak_multiplier = 0.20 if is_peak else 0.0

            total_multiplier = 1.0 + seasonal_wave + weekend_multiplier + peak_multiplier

            # A. Flights
            for f_route in flight_routes:
                base_price = 5000 if f_route.airline.iata_code == "6E" else 6200
                price = round(base_price * total_multiplier)
                pricing_records.append(TravelPriceHistory(
                    service_type='flight',
                    date=current_date,
                    price=price,
                    currency='INR',
                    provider=f_route.airline.name,
                    code=f"{f_route.airline.iata_code}-{100 + f_route.id * 12}",
                    airport_route=f_route,
                    details={
                        "duration": f"{f_route.duration_mins // 60}h {f_route.duration_mins % 60}m",
                        "departure_time": "07:15" if f_route.id % 2 == 0 else "14:30",
                        "arrival_time": "09:25" if f_route.id % 2 == 0 else "16:45",
                        "stops": 0,
                        "cabin_classes": [
                            {"name": "Economy", "price": price, "seats_left": 9},
                            {"name": "Business", "price": price * 3, "seats_left": 4}
                        ]
                    }
                ))

            # B. Trains
            for t_route in train_routes:
                base_price = 1000 if "Vande" in t_route.train_name else 2100
                price = round(base_price * total_multiplier)
                pricing_records.append(TravelPriceHistory(
                    service_type='train',
                    date=current_date,
                    price=price,
                    currency='INR',
                    provider="IRCTC Official",
                    code=t_route.train_number,
                    train_route=t_route,
                    details={
                        "duration": f"{t_route.duration_mins // 60}h {t_route.duration_mins % 60}m",
                        "departure_time": "16:55" if t_route.id % 2 == 0 else "06:15",
                        "arrival_time": "08:35" if t_route.id % 2 == 0 else "11:00",
                        "platform": "PF 3",
                        "classes": [
                            {"class": "3A", "label": "3rd AC", "price": price, "availability": "AVAILABLE-15"},
                            {"class": "2A", "label": "2nd AC", "price": round(price * 1.4), "availability": "AVAILABLE-8"},
                            {"class": "1A", "label": "First AC", "price": round(price * 2.0), "availability": "WL 4"}
                        ]
                    }
                ))

            # C. Buses
            for b_route in bus_routes:
                base_price = 1200 if "Zing" in b_route.operator_name else 1500
                price = round(base_price * total_multiplier)
                pricing_records.append(TravelPriceHistory(
                    service_type='bus',
                    date=current_date,
                    price=price,
                    currency='INR',
                    provider=b_route.operator_name.split()[0],
                    code="Volvo Sleeper",
                    bus_route=b_route,
                    details={
                        "duration": f"{b_route.duration_mins // 60}h {b_route.duration_mins % 60}m",
                        "departure_time": "21:30" if b_route.id % 2 == 0 else "22:00",
                        "arrival_time": "08:30",
                        "seats_available": 14,
                        "bus_type": b_route.operator_name
                    }
                ))

            # D. Hotels
            for h_master, base_price in hotels:
                price = round(base_price * total_multiplier)
                pricing_records.append(TravelPriceHistory(
                    service_type='hotel',
                    date=current_date,
                    price=price,
                    currency='INR',
                    provider=h_master.name,
                    code="Standard Room",
                    hotel=h_master,
                    details={
                        "stars": h_master.star_rating,
                        "rating": h_master.user_rating,
                        "address": h_master.address,
                        "rooms": [
                            {"name": "Deluxe Room", "price_per_night": price, "features": ["Free WiFi", "King Bed"]},
                            {"name": "Suite", "price_per_night": round(price * 1.8), "features": ["Free Breakfast", "King Bed"]}
                        ]
                    }
                ))

            # E. Cabs
            for city_item in [delhi, mumbai, blr, goa, manali]:
                base_rate = 14 if city_item.name == "Manali" else 18
                price_per_km = round(base_rate * (1.0 + seasonal_wave * 0.5 + weekend_multiplier * 0.3))
                pricing_records.append(TravelPriceHistory(
                    service_type='cab',
                    date=current_date,
                    price=price_per_km,
                    currency='INR',
                    provider="Uber India" if city_item.name != "Manali" else "Local Taxi Union",
                    code="Sedan Cab",
                    city=city_item,
                    details={
                        "base_fare": 150 if city_item.name != "Manali" else 200,
                        "max_seats": 4,
                        "cab_types": [
                            {"name": "Hatchback", "price_per_km": price_per_km - 2, "base_fare": 100},
                            {"name": "Sedan", "price_per_km": price_per_km, "base_fare": 150},
                            {"name": "SUV", "price_per_km": price_per_km + 5, "base_fare": 250}
                        ]
                    }
                ))

            # Bulk create in batches to optimize memory and execution time
            if len(pricing_records) >= 2000:
                TravelPriceHistory.objects.bulk_create(pricing_records)
                pricing_records = []

        # Insert remaining records
        if pricing_records:
            TravelPriceHistory.objects.bulk_create(pricing_records)

        self.stdout.write(self.style.SUCCESS(f"Successfully seeded travel price history data for the last 3 years!"))
