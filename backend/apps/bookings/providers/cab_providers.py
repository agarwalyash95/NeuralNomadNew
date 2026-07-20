"""
Cab & Taxi Search Providers (Booking.com Taxi API via RapidAPI + Dynamic Mock Fallback).
"""

import logging
import requests
from typing import List, Dict, Any
from .base import BaseCabProvider
from .utils import parse_location

logger = logging.getLogger(__name__)


class BookingComTaxiProvider(BaseCabProvider):
    """
    Cab provider using Booking.com Taxi API (by DataCrawler) via RapidAPI.
    RapidAPI Host: booking-com15.p.rapidapi.com
    """

    HOST = "booking-com15.p.rapidapi.com"

    def search(self, params: Dict[str, Any]) -> List[Dict[str, Any]]:
        raw_pickup = params.get('pickup', params.get('origin', 'Delhi'))
        raw_drop = params.get('drop', params.get('destination', 'Manali'))
        pickup_city, _ = parse_location(raw_pickup, 'Delhi', 'DEL')
        drop_city, _ = parse_location(raw_drop, 'Manali', 'MNL')
        date = params.get('departureDate', '2026-08-01')

        if not self.api_key:
            logger.info("RapidAPI key missing. Falling back to MockCabProvider.")
            return MockCabProvider().search(params)

        headers = {
            "x-rapidapi-key": self.api_key,
            "x-rapidapi-host": self.HOST
        }

        url = f"https://{self.HOST}/api/v1/taxi/searchTaxi"
        query_params = {
            "pickUpLocation": pickup_city,
            "dropOffLocation": drop_city,
            "pickUpDate": date,
            "passengers": params.get('travellers', '2')
        }

        try:
            res = requests.get(url, headers=headers, params=query_params, timeout=8)
            if res.status_code == 200:
                taxis = res.json().get('data', {}).get('taxis', [])
                if taxis:
                    results = []
                    for idx, taxi in enumerate(taxis[:15]):
                        price_val = taxi.get('price', {}).get('amount')
                        if not isinstance(price_val, (int, float)):
                            continue
                        results.append({
                            "id": f"taxi-{taxi.get('id', idx)}",
                            "service_type": "cab",
                            "title": taxi.get('name', f"Sedan ({pickup_city} to {drop_city})"),
                            "code": f"CAB-{idx+1}",
                            "origin_city": pickup_city,
                            "destination_city": drop_city,
                            "origin_code": "",
                            "destination_code": "",
                            "departure_time": "Flexible Pickup",
                            "arrival_time": "Direct Drop",
                            "duration": taxi.get('duration', 'Outstation Transfer'),
                            "days_of_week": [],
                            "stops": 0,
                            "meta": {
                                "vehicle_type": taxi.get('category', 'Sedan (Dzire / Etios)'),
                                "capacity": taxi.get('passengers', 4),
                                "luggage": taxi.get('luggage', 2),
                                "cab_types": [
                                    {"name": "Sedan", "base_fare": round(price_val), "capacity": "4 Passengers"},
                                    {"name": "SUV (Innova / Ertiga)", "base_fare": round(price_val * 1.4), "capacity": "6 Passengers"}
                                ]
                            },
                            "providers": [
                                {"provider": "Booking.com Taxi", "price": round(price_val), "deeplink": "#"}
                            ],
                            "is_active": True
                        })
                    return results

            logger.warning(f"BookingCom Taxi API returned status {res.status_code}. Using mock fallback.")
        except Exception as e:
            logger.error(f"Error calling Taxi API: {e}. Falling back to mock.")

        return MockCabProvider().search(params)


class MockCabProvider(BaseCabProvider):
    """Dynamic Mock Cab Provider returning matching cabs for any pickup/drop pair."""

    def search(self, params: Dict[str, Any]) -> List[Dict[str, Any]]:
        from apps.bookings.models import SearchInventory
        raw_pickup = params.get('pickup', params.get('origin', 'Delhi'))
        raw_drop = params.get('drop', params.get('destination', 'Manali'))
        pickup_city, _ = parse_location(raw_pickup, 'Delhi', 'DEL')
        drop_city, _ = parse_location(raw_drop, 'Manali', 'MNL')

        qs = SearchInventory.objects.filter(
            is_active=True,
            service_type='cab',
            origin_city__icontains=pickup_city
        )

        results = []
        for obj in qs:
            results.append({
                "id": str(obj.id),
                "service_type": "cab",
                "title": obj.title,
                "code": obj.code,
                "origin_city": obj.origin_city,
                "destination_city": obj.destination_city or drop_city,
                "origin_code": obj.origin_code,
                "destination_code": obj.destination_code,
                "departure_time": obj.departure_time,
                "arrival_time": obj.arrival_time,
                "duration": obj.duration,
                "days_of_week": obj.days_of_week,
                "stops": obj.stops,
                "meta": obj.meta,
                "providers": obj.providers,
                "is_active": obj.is_active
            })

        if not results:
            results = [
                {
                    "id": f"cab-dynamic-1-{pickup_city.lower()}-{drop_city.lower()}",
                    "service_type": "cab",
                    "title": f"Outstation Private Cab ({pickup_city} to {drop_city})",
                    "code": "CAB-SDN",
                    "origin_city": pickup_city,
                    "destination_city": drop_city,
                    "origin_code": "",
                    "destination_code": "",
                    "departure_time": "Flexible Pickup",
                    "arrival_time": "Direct Drop",
                    "duration": "Point to Point",
                    "days_of_week": [],
                    "stops": 0,
                    "meta": {
                        "cab_types": [
                            {"name": "Sedan (Swift Dzire)", "base_fare": 4200, "capacity": "4 Passengers, 2 Bags"},
                            {"name": "SUV (Ertiga)", "base_fare": 5800, "capacity": "6 Passengers, 4 Bags"},
                            {"name": "Premium SUV (Innova Crysta)", "base_fare": 8200, "capacity": "6 Passengers, 5 Bags"}
                        ]
                    },
                    "providers": [
                        {"provider": "MakeMyTrip Cabs", "price": 4200, "deeplink": "#"},
                        {"provider": "Goibibo Cabs", "price": 4350, "deeplink": "#"}
                    ],
                    "is_active": True
                },
                {
                    "id": f"cab-dynamic-2-{pickup_city.lower()}-{drop_city.lower()}",
                    "service_type": "cab",
                    "title": f"Airport Transfer ({pickup_city})",
                    "code": "CAB-APT",
                    "origin_city": pickup_city,
                    "destination_city": pickup_city,
                    "origin_code": "",
                    "destination_code": "",
                    "departure_time": "On Demand",
                    "arrival_time": "Instant",
                    "duration": "City Transfer",
                    "days_of_week": [],
                    "stops": 0,
                    "meta": {
                        "cab_types": [
                            {"name": "Hatchback (WagonR)", "base_fare": 850, "capacity": "4 Passengers, 1 Bag"},
                            {"name": "Sedan (Etios)", "base_fare": 1200, "capacity": "4 Passengers, 2 Bags"}
                        ]
                    },
                    "providers": [
                        {"provider": "Uber Airport", "price": 850, "deeplink": "#"},
                        {"provider": "Ola Cabs", "price": 890, "deeplink": "#"}
                    ],
                    "is_active": True
                }
            ]

        for item in results:
            item["source"] = "mock_inventory"
        return results
