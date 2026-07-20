"""
Flight Search Providers (Sky Scrapper by apiheya via RapidAPI + Dynamic Mock Fallback).
"""

import logging
import requests
from typing import List, Dict, Any
from .base import BaseFlightProvider
from .utils import parse_location

logger = logging.getLogger(__name__)

# Pre-cached Entity IDs for major Indian & International airports to save API requests
POPULAR_AIRPORT_ENTITIES = {
    'DEL': '95673498',
    'BOM': '95673370',
    'CCU': '95673516',
    'COK': '95673504',
    'BLR': '95673523',
    'MAA': '95673489',
    'HYD': '95673511',
    'GOI': '95673500',
    'JAI': '95673508',
    'IXC': '95673495',
    'CDG': '95673495',
    'AMD': '95673486',
    'PNQ': '95673528',
    'KUU': '95673500'
}


class SkyScrapperFlightProvider(BaseFlightProvider):
    """
    Flight provider using Sky Scrapper / Air Scraper (by apiheya) via RapidAPI.
    RapidAPI Host: sky-scrapper.p.rapidapi.com
    """

    HOST = "sky-scrapper.p.rapidapi.com"

    def _get_entity_params(self, code: str, headers: dict) -> dict:
        """Helper to fetch skyId and entityId from pre-cached list or searchAirport endpoint."""
        code_upper = code.upper().strip()
        if code_upper in POPULAR_AIRPORT_ENTITIES:
            return {'skyId': code_upper, 'entityId': POPULAR_AIRPORT_ENTITIES[code_upper]}

        url = f"https://{self.HOST}/api/v1/flights/searchAirport"
        try:
            res = requests.get(url, headers=headers, params={"query": code_upper}, timeout=6)
            if res.status_code == 200:
                data = res.json().get('data', [])
                if data:
                    nav = data[0].get('navigation', {}).get('relevantFlightParams', {})
                    return {
                        'skyId': nav.get('skyId', code_upper),
                        'entityId': nav.get('entityId', '')
                    }
        except Exception as e:
            logger.warning(f"Error resolving airport entity for {code}: {e}")
        return {'skyId': code_upper, 'entityId': ''}

    def search(self, params: Dict[str, Any]) -> List[Dict[str, Any]]:
        raw_origin = params.get('origin', 'DEL')
        raw_dest = params.get('destination', 'BOM')
        date = params.get('departureDate', '2026-08-01')

        origin_city, origin_code = parse_location(raw_origin, 'Delhi', 'DEL')
        dest_city, dest_code = parse_location(raw_dest, 'Mumbai', 'BOM')

        if not self.api_key:
            logger.info("RapidAPI key missing. Falling back to MockFlightProvider.")
            return MockFlightProvider().search(params)

        headers = {
            "x-rapidapi-key": self.api_key,
            "x-rapidapi-host": self.HOST
        }

        # Step 1: Resolve valid entity IDs for Skyscanner search
        orig_info = self._get_entity_params(origin_code, headers)
        dest_info = self._get_entity_params(dest_code, headers)

        if not orig_info.get('entityId') or not dest_info.get('entityId'):
            logger.warning("Could not resolve entity IDs for flight search. Using mock fallback.")
            return MockFlightProvider().search(params)

        url = f"https://{self.HOST}/api/v1/flights/searchFlights"
        query_params = {
            "originSkyId": orig_info['skyId'],
            "destinationSkyId": dest_info['skyId'],
            "originEntityId": orig_info['entityId'],
            "destinationEntityId": dest_info['entityId'],
            "date": date,
            "cabinClass": params.get('cabinClass', 'economy').lower(),
            "adults": params.get('travellers', '1'),
            "currency": "INR",
            "market": "en-IN",
            "locale": "en-GB"
        }

        try:
            res = requests.get(url, headers=headers, params=query_params, timeout=12)
            if res.status_code == 200:
                data = res.json()
                # If RapidAPI basic plan quota limit message returned
                if not data.get('status') and data.get('message') and 'quota' in data.get('message').lower():
                    logger.warning("RapidAPI SkyScrapper quota limit reached. Serving dynamic Rupee mock data.")
                    return MockFlightProvider().search(params)

                itineraries = data.get('data', {}).get('itineraries', [])
                if itineraries:
                    results = []
                    for idx, itin in enumerate(itineraries[:15]):
                        leg = itin.get('legs', [{}])[0]
                        price_val = itin.get('price', {}).get('raw')
                        if not isinstance(price_val, (int, float)):
                            continue

                        carrier = leg.get('carriers', {}).get('marketing', [{}])[0]
                        carrier_name = carrier.get('name', 'Airline')
                        flight_num = carrier.get('code', 'FL') + f"-{100 + idx*12}"

                        dep_time = leg.get('departure', '')
                        arr_time = leg.get('arrival', '')
                        dep_str = dep_time.split('T')[1][:5] if 'T' in dep_time else '06:00'
                        arr_str = arr_time.split('T')[1][:5] if 'T' in arr_time else '08:45'

                        results.append({
                            "id": str(itin.get('id', f"sky-live-{idx}")),
                            "service_type": "flight",
                            "title": carrier_name,
                            "code": flight_num,
                            "origin_city": origin_city,
                            "destination_city": dest_city,
                            "origin_code": origin_code,
                            "destination_code": dest_code,
                            "departure_time": dep_str,
                            "arrival_time": arr_str,
                            "duration": f"{leg.get('durationInMinutes', 145) // 60}h {leg.get('durationInMinutes', 145) % 60}m",
                            "days_of_week": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
                            "stops": leg.get('stopCount', 0),
                            "meta": {
                                "cabin_classes": [{
                                    "name": params.get('cabinClass', 'Economy').capitalize(),
                                    "price": round(price_val),
                                    "seats_left": 6
                                }],
                                "baggage": "15kg check-in, 7kg cabin",
                                "airline_logo": carrier.get('logoUrl', '')
                            },
                            "providers": [
                                {"provider": "Skyscanner Live", "price": round(price_val), "deeplink": itin.get('deeplink', '#')}
                            ],
                            "is_active": True
                        })
                    if results:
                        return results

            logger.warning(f"SkyScrapper API returned status {res.status_code}. Using mock fallback.")
        except Exception as e:
            logger.error(f"Error calling SkyScrapper API: {e}. Falling back to mock.")

        return MockFlightProvider().search(params)


class MockFlightProvider(BaseFlightProvider):
    """Dynamic Mock Flight Provider that returns accurate matching flights in INR (Rupees) for any origin/destination pair."""

    def search(self, params: Dict[str, Any]) -> List[Dict[str, Any]]:
        from apps.bookings.models import SearchInventory
        raw_origin = params.get('origin', 'Delhi')
        raw_dest = params.get('destination', 'Mumbai')

        origin_city, origin_code = parse_location(raw_origin, 'Delhi', 'DEL')
        dest_city, dest_code = parse_location(raw_dest, 'Mumbai', 'BOM')

        qs = SearchInventory.objects.filter(
            is_active=True,
            service_type='flight',
            origin_city__icontains=origin_city,
            destination_city__icontains=dest_city
        )

        results = []
        for obj in qs:
            results.append({
                "id": str(obj.id),
                "service_type": "flight",
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
                    "id": f"flight-dynamic-1-{origin_code}-{dest_code}",
                    "service_type": "flight",
                    "title": "IndiGo",
                    "code": "6E-512",
                    "origin_city": origin_city,
                    "destination_city": dest_city,
                    "origin_code": origin_code,
                    "destination_code": dest_code,
                    "departure_time": "06:30",
                    "arrival_time": "09:15",
                    "duration": "2h 45m",
                    "days_of_week": ["Daily"],
                    "stops": 0,
                    "meta": {
                        "cabin_classes": [
                            {"name": "Economy", "price": 5400, "seats_left": 8},
                            {"name": "Flexi Plus", "price": 6800, "seats_left": 4}
                        ],
                        "baggage": "15kg check-in, 7kg cabin"
                    },
                    "providers": [{"provider": "IndiGo Direct", "price": 5400, "deeplink": "#"}],
                    "is_active": True
                },
                {
                    "id": f"flight-dynamic-2-{origin_code}-{dest_code}",
                    "service_type": "flight",
                    "title": "Air India",
                    "code": "AI-773",
                    "origin_city": origin_city,
                    "destination_city": dest_city,
                    "origin_code": origin_code,
                    "destination_code": dest_code,
                    "departure_time": "11:45",
                    "arrival_time": "14:30",
                    "duration": "2h 45m",
                    "days_of_week": ["Daily"],
                    "stops": 0,
                    "meta": {
                        "cabin_classes": [
                            {"name": "Economy", "price": 5950, "seats_left": 14},
                            {"name": "Business", "price": 16200, "seats_left": 3}
                        ],
                        "baggage": "25kg check-in, 8kg cabin"
                    },
                    "providers": [{"provider": "Air India Direct", "price": 5950, "deeplink": "#"}],
                    "is_active": True
                },
                {
                    "id": f"flight-dynamic-3-{origin_code}-{dest_code}",
                    "service_type": "flight",
                    "title": "Akasa Air",
                    "code": "QP-1382",
                    "origin_city": origin_city,
                    "destination_city": dest_city,
                    "origin_code": origin_code,
                    "destination_code": dest_code,
                    "departure_time": "17:20",
                    "arrival_time": "20:05",
                    "duration": "2h 45m",
                    "days_of_week": ["Daily"],
                    "stops": 0,
                    "meta": {
                        "cabin_classes": [
                            {"name": "Saver", "price": 4999, "seats_left": 5}
                        ],
                        "baggage": "15kg check-in, 7kg cabin"
                    },
                    "providers": [{"provider": "Akasa Direct", "price": 4999, "deeplink": "#"}],
                    "is_active": True
                }
            ]

        for item in results:
            item["source"] = "mock_inventory"
        return results
