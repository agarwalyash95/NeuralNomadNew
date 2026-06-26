"""
Route Service — calculates distances and travel times via Google Maps.
"""

import logging
from django.conf import settings

logger = logging.getLogger(__name__)


class RouteService:
    """
    Calculates distances and travel times between locations.
    Uses Google Maps Distance Matrix / Directions API.
    Falls back to Haversine formula when API is unavailable.
    """

    def __init__(self):
        self.api_key = getattr(settings, 'GOOGLE_MAPS_API_KEY', '')

    def calculate_distance(self, origin: dict, destination: dict) -> dict:
        """
        Calculate distance and travel time between two points.

        Args:
            origin: {latitude, longitude} or {address}
            destination: {latitude, longitude} or {address}

        Returns:
            {distance_km, duration_minutes, transport_mode}
        """
        if not self.api_key:
            # Fallback to Haversine
            return self._haversine_distance(origin, destination)

        # TODO: Implement Google Maps Distance Matrix API call
        return self._haversine_distance(origin, destination)

    def _haversine_distance(self, origin: dict, destination: dict) -> dict:
        """Calculate straight-line distance using Haversine formula."""
        import math

        lat1 = float(origin.get('latitude', 0))
        lng1 = float(origin.get('longitude', 0))
        lat2 = float(destination.get('latitude', 0))
        lng2 = float(destination.get('longitude', 0))

        R = 6371  # Earth's radius in km

        dlat = math.radians(lat2 - lat1)
        dlng = math.radians(lng2 - lng1)
        a = (
            math.sin(dlat / 2) ** 2
            + math.cos(math.radians(lat1))
            * math.cos(math.radians(lat2))
            * math.sin(dlng / 2) ** 2
        )
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        distance = R * c

        # Rough estimate: 40 km/h average speed for city travel
        duration_minutes = int((distance / 40) * 60)

        return {
            'distance_km': round(distance, 1),
            'duration_minutes': duration_minutes,
            'transport_mode': 'driving',
            'source': 'haversine',
        }
