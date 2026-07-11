from datetime import date

from django.test import TestCase
from rest_framework.test import APIClient

from apps.reference.models import (
    Airport, AirportRoute, Airline, BusRoute, BusStation, City, Country,
    RailwayStation, TrainRoute, TravelPriceHistory,
)


class TransportCompareApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        country = Country.objects.create(name="India", code="IN")
        self.delhi = City.objects.create(name="Delhi", country=country, latitude=28.6139, longitude=77.2090)
        self.manali = City.objects.create(name="Manali", country=country, latitude=32.2432, longitude=77.1892)

        del_airport = Airport.objects.create(city=self.delhi, name="Delhi Airport", iata_code="DEL")
        kuu_airport = Airport.objects.create(city=self.manali, name="Bhuntar Airport", iata_code="KUU")
        airline = Airline.objects.create(name="Test Air", iata_code="TA")
        self.flight_route = AirportRoute.objects.create(
            source=del_airport, destination=kuu_airport, airline=airline, duration_mins=75
        )

        del_station = RailwayStation.objects.create(city=self.delhi, name="Delhi Station", code="NDLS")
        manali_station = RailwayStation.objects.create(city=self.manali, name="Manali Station", code="MNLI")
        self.train_route = TrainRoute.objects.create(
            source=del_station, destination=manali_station,
            train_name="Test Express", train_number="12345", duration_mins=720,
        )

        del_bus = BusStation.objects.create(city=self.delhi, name="Delhi Bus Stand")
        manali_bus = BusStation.objects.create(city=self.manali, name="Manali Bus Stand")
        self.bus_route = BusRoute.objects.create(
            source=del_bus, destination=manali_bus, operator_name="Test Volvo", duration_mins=600,
        )

        TravelPriceHistory.objects.create(
            service_type="flight", date=date(2026, 10, 15), price=4500, currency="INR",
            provider="Test Air", code="TA101", airport_route=self.flight_route, provenance_tier="estimated",
        )
        TravelPriceHistory.objects.create(
            service_type="train", date=date(2026, 10, 15), price=1200, currency="INR",
            provider="Test Express", code="12345", train_route=self.train_route, provenance_tier="estimated",
        )
        TravelPriceHistory.objects.create(
            service_type="bus", date=date(2026, 10, 15), price=900, currency="INR",
            provider="Test Volvo", code="BUS1", bus_route=self.bus_route, provenance_tier="estimated",
        )

    def test_compare_returns_all_three_scheduled_modes_with_real_durations(self):
        response = self.client.get(
            "/api/planner/legs/compare/",
            {"origin": "Delhi", "destination": "Manali", "date": "2026-10-15"},
        )
        self.assertEqual(response.status_code, 200)
        modes = {row["mode"]: row for row in response.data["rows"]}
        self.assertEqual(modes["flight"]["duration_mins"], 75)
        self.assertEqual(modes["train"]["duration_mins"], 720)
        self.assertEqual(modes["bus"]["duration_mins"], 600)
        self.assertEqual(modes["flight"]["price"], 4500.0)

    def test_compare_recommends_the_fastest_mode_and_names_the_cheaper_tradeoff(self):
        response = self.client.get(
            "/api/planner/legs/compare/",
            {"origin": "Delhi", "destination": "Manali", "date": "2026-10-15"},
        )
        rec = response.data["recommendation"]
        self.assertEqual(rec["mode"], "flight")  # 75 mins beats everything
        self.assertEqual(rec["alternative_mode"], "bus")  # cheapest of the three (900 < 1200 < 4500)
        self.assertIn("bus", rec["reason"])

    def test_compare_requires_origin_and_destination(self):
        response = self.client.get("/api/planner/legs/compare/", {"origin": "Delhi"})
        self.assertEqual(response.status_code, 400)

    def test_compare_omits_a_mode_with_no_reference_route(self):
        response = self.client.get(
            "/api/planner/legs/compare/",
            {"origin": "Delhi", "destination": "Nowhereville", "date": "2026-10-15"},
        )
        self.assertEqual(response.status_code, 200)
        modes = [row["mode"] for row in response.data["rows"]]
        self.assertNotIn("flight", modes)
        self.assertNotIn("train", modes)
        self.assertNotIn("bus", modes)
