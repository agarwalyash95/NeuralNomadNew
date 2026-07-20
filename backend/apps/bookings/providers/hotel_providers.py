"""
Hotel Search Providers (Booking.com via DataCrawler / Hotels.com via Api Dojo + Dynamic Mock Fallback).
"""

import logging
import requests
from typing import List, Dict, Any
from .base import BaseHotelProvider
from .utils import parse_location

logger = logging.getLogger(__name__)


class BookingComHotelProvider(BaseHotelProvider):
    """
    Hotel provider using Booking.com API (by DataCrawler) via RapidAPI.
    RapidAPI Host: booking-com15.p.rapidapi.com
    """

    HOST = "booking-com15.p.rapidapi.com"

    def search(self, params: Dict[str, Any]) -> List[Dict[str, Any]]:
        raw_city = params.get('city', 'Manali')
        city_name, _ = parse_location(raw_city, 'Manali', 'MNL')
        checkin = params.get('checkIn', '2026-08-01')
        checkout = params.get('checkOut', '2026-08-03')

        if not self.api_key:
            logger.info("RapidAPI key missing. Falling back to MockHotelProvider.")
            return MockHotelProvider().search(params)

        headers = {
            "x-rapidapi-key": self.api_key,
            "x-rapidapi-host": self.HOST
        }

        try:
            dest_url = f"https://{self.HOST}/api/v1/hotels/searchDestination"
            dest_res = requests.get(dest_url, headers=headers, params={"query": city_name}, timeout=6)
            if dest_res.status_code == 200:
                dest_data = dest_res.json()
                dest_list = dest_data.get('data', [])
                if dest_list:
                    dest_id = dest_list[0].get('dest_id')
                    search_url = f"https://{self.HOST}/api/v1/hotels/searchHotels"
                    search_params = {
                        "dest_id": dest_id,
                        "search_type": "CITY",
                        "arrival_date": checkin,
                        "departure_date": checkout,
                        "adults": params.get('travellers', '2'),
                        "room_qty": params.get('roomCount', '1'),
                        "page_number": "1"
                    }
                    search_res = requests.get(search_url, headers=headers, params=search_params, timeout=8)
                    if search_res.status_code == 200:
                        hotels_data = search_res.json().get('data', {}).get('hotels', [])
                        results = []
                        for idx, h in enumerate(hotels_data[:15]):
                            property_info = h.get('property', {})
                            gross_price = property_info.get('priceBreakdown', {}).get('grossPrice', {})
                            price_val = gross_price.get('value')
                            results.append({
                                "id": f"bcom-{h.get('hotel_id', idx)}",
                                "service_type": "hotel",
                                "title": property_info.get('name') or "Unnamed provider property",
                                "code": f"HTL-{idx+1}",
                                "origin_city": "",
                                "destination_city": city_name,
                                "origin_code": "",
                                "destination_code": "",
                                "departure_time": "14:00 Check-In",
                                "arrival_time": "11:00 Check-Out",
                                "duration": "Per Night",
                                "days_of_week": [],
                                "stops": 0,
                                "meta": {
                                    "review_score": property_info.get('reviewScore'),
                                    "address": property_info.get('address'),
                                    "photo_url": property_info.get('photoUrls', [''])[0],
                                    "currency": gross_price.get('currency'),
                                },
                                "providers": ([{"provider": "Booking.com Direct", "price": round(price_val), "currency": gross_price.get('currency'), "deeplink": property_info.get('url')}]
                                              if price_val is not None else []),
                                "is_active": True
                            })
                        if results:
                            return results

            logger.warning("BookingCom API response status issue. Using mock fallback.")
        except Exception as e:
            logger.error(f"Error calling BookingCom Hotel API: {e}. Falling back to mock.")

        return MockHotelProvider().search(params)


class HotelsDojoProvider(BaseHotelProvider):
    """
    Hotel provider using Hotels (by Api Dojo) via RapidAPI.
    """

    def search(self, params: Dict[str, Any]) -> List[Dict[str, Any]]:
        return MockHotelProvider().search(params)


class MockHotelProvider(BaseHotelProvider):
    """Dynamic Mock Hotel Provider returning matching properties for any requested city."""

    def search(self, params: Dict[str, Any]) -> List[Dict[str, Any]]:
        from apps.bookings.models import SearchInventory
        raw_city = params.get('city', 'Manali')
        city_name, _ = parse_location(raw_city, 'Manali', 'MNL')

        qs = SearchInventory.objects.filter(
            is_active=True,
            service_type='hotel',
            destination_city__icontains=city_name
        )

        results = []
        for obj in qs:
            results.append({
                "id": str(obj.id),
                "service_type": "hotel",
                "title": obj.title,
                "code": obj.code,
                "origin_city": obj.origin_city,
                "destination_city": obj.destination_city,
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

        for item in results:
            item["source"] = "mock_inventory"
        return results
