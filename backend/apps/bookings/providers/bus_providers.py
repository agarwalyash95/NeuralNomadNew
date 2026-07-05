"""
Bus Search Providers (Redbus API via RapidAPI + Dynamic Mock Fallback).
"""

import logging
import requests
from typing import List, Dict, Any
from .base import BaseBusProvider
from .utils import parse_location

logger = logging.getLogger(__name__)


class RedbusBusProvider(BaseBusProvider):
    """
    Bus provider using Redbus API via RapidAPI.
    RapidAPI Host: redbus-com.p.rapidapi.com
    """

    HOST = "redbus-com.p.rapidapi.com"

    def search(self, params: Dict[str, Any]) -> List[Dict[str, Any]]:
        raw_origin = params.get('origin', 'Delhi')
        raw_dest = params.get('destination', 'Manali')
        origin_city, origin_code = parse_location(raw_origin, 'Delhi', 'DEL')
        dest_city, dest_code = parse_location(raw_dest, 'Manali', 'MNL')
        date = params.get('departureDate', '2026-08-01')

        if not self.api_key:
            logger.info("RapidAPI key missing. Falling back to MockBusProvider.")
            return MockBusProvider().search(params)

        headers = {
            "x-rapidapi-key": self.api_key,
            "x-rapidapi-host": self.HOST
        }

        url = f"https://{self.HOST}/search"
        query_params = {
            "from": origin_city,
            "to": dest_city,
            "date": date
        }

        try:
            res = requests.get(url, headers=headers, params=query_params, timeout=8)
            if res.status_code == 200:
                buses = res.json().get('buses', [])
                if buses:
                    results = []
                    for idx, bus in enumerate(buses[:15]):
                        results.append({
                            "id": f"redbus-{bus.get('id', idx)}",
                            "service_type": "bus",
                            "title": bus.get('operator_name', 'Zingbus Volvo'),
                            "code": bus.get('bus_number', f"BUS-{idx+1}"),
                            "origin_city": origin_city,
                            "destination_city": dest_city,
                            "origin_code": origin_code,
                            "destination_code": dest_code,
                            "departure_time": bus.get('departure_time', '20:00'),
                            "arrival_time": bus.get('arrival_time', '08:30+1'),
                            "duration": bus.get('duration', '12h 30m'),
                            "days_of_week": ["Daily"],
                            "stops": 0,
                            "meta": {
                                "bus_type": bus.get('bus_type', 'AC Sleeper (2+1)'),
                                "rating": bus.get('rating', 4.6),
                                "seats": [
                                    {"type": "Upper Sleeper", "price": bus.get('fare', 1250), "available": 14},
                                    {"type": "Lower Sleeper", "price": bus.get('fare', 1450), "available": 8}
                                ]
                            },
                            "providers": [
                                {"provider": "Redbus Direct", "price": bus.get('fare', 1250), "deeplink": "#"}
                            ],
                            "is_active": True
                        })
                    return results

            logger.warning(f"Redbus API returned status {res.status_code}. Using mock fallback.")
        except Exception as e:
            logger.error(f"Error calling Redbus API: {e}. Falling back to mock.")

        return MockBusProvider().search(params)


class MockBusProvider(BaseBusProvider):
    """Dynamic Mock Bus Provider returning accurate matching routes for any origin/destination pair."""

    def search(self, params: Dict[str, Any]) -> List[Dict[str, Any]]:
        from apps.bookings.models import SearchInventory
        raw_origin = params.get('origin', 'Delhi')
        raw_dest = params.get('destination', 'Manali')
        origin_city, origin_code = parse_location(raw_origin, 'Delhi', 'DEL')
        dest_city, dest_code = parse_location(raw_dest, 'Manali', 'MNL')

        qs = SearchInventory.objects.filter(
            is_active=True,
            service_type='bus',
            origin_city__icontains=origin_city,
            destination_city__icontains=dest_city
        )

        results = []
        for obj in qs:
            results.append({
                "id": str(obj.id),
                "service_type": "bus",
                "title": obj.title,
                "code": obj.code,
                "origin_city": obj.origin_city,
                "destination_city": obj.destination_city,
                "origin_code": obj.origin_code or origin_code,
                "destination_code": obj.destination_code or dest_code,
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
                    "id": f"bus-dynamic-1-{origin_code}-{dest_code}",
                    "service_type": "bus",
                    "title": "Zingbus Multi-Axle Volvo",
                    "code": "ZB-901",
                    "origin_city": origin_city,
                    "destination_city": dest_city,
                    "origin_code": origin_code,
                    "destination_code": dest_code,
                    "departure_time": "19:30",
                    "arrival_time": "08:00+1",
                    "duration": "12h 30m",
                    "days_of_week": ["Daily"],
                    "stops": 0,
                    "meta": {
                        "bus_type": "A/C Multi-Axle Sleeper (2+1)",
                        "rating": 4.7,
                        "seats": [
                            {"type": "Upper Sleeper", "price": 1299, "available": 12},
                            {"type": "Lower Sleeper", "price": 1499, "available": 6}
                        ]
                    },
                    "providers": [
                        {"provider": "Zingbus", "price": 1299, "deeplink": "#"},
                        {"provider": "Redbus", "price": 1349, "deeplink": "#"}
                    ],
                    "is_active": True
                },
                {
                    "id": f"bus-dynamic-2-{origin_code}-{dest_code}",
                    "service_type": "bus",
                    "title": "InterCity SmartBus",
                    "code": "IC-402",
                    "origin_city": origin_city,
                    "destination_city": dest_city,
                    "origin_code": origin_code,
                    "destination_code": dest_code,
                    "departure_time": "21:00",
                    "arrival_time": "09:15+1",
                    "duration": "12h 15m",
                    "days_of_week": ["Daily"],
                    "stops": 0,
                    "meta": {
                        "bus_type": "A/C Seater / Sleeper",
                        "rating": 4.5,
                        "seats": [
                            {"type": "AC Seater", "price": 999, "available": 18}
                        ]
                    },
                    "providers": [
                        {"provider": "Redbus Direct", "price": 999, "deeplink": "#"}
                    ],
                    "is_active": True
                }
            ]

        return results
