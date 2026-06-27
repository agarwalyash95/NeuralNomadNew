"""
Google Maps Provider — Distance Matrix & Directions API.

Uses the abstract MapsProvider interface so it can be swapped
without touching business logic.
"""

import logging
import requests
from django.conf import settings
from .base import MapsProvider

logger = logging.getLogger(__name__)

DISTANCE_MATRIX_URL = 'https://maps.googleapis.com/maps/api/distancematrix/json'
DIRECTIONS_URL = 'https://maps.googleapis.com/maps/api/directions/json'


class GoogleMapsProvider(MapsProvider):
    """Google Maps Distance Matrix + Directions implementation."""

    def __init__(self):
        self.api_key = getattr(settings, 'GOOGLE_MAPS_API_KEY', '')

    # ─── Distance Matrix ─────────────────────────────────

    def get_distance_matrix(
        self,
        origins: list[dict],
        destinations: list[dict],
        mode: str = 'driving',
    ) -> dict:
        """
        Calculate distances between origins and destinations.

        Args:
            origins: [{"lat": 28.6139, "lng": 77.209}]
            destinations: [{"lat": 19.076, "lng": 72.8777}]
            mode: driving | walking | transit | bicycling

        Returns:
            {
                "rows": [
                    {
                        "elements": [
                            {
                                "distance_km": 1400.5,
                                "duration_minutes": 1080,
                                "status": "OK"
                            }
                        ]
                    }
                ]
            }
        """
        if not self.api_key:
            logger.warning('Google Maps API key not configured — returning estimate')
            return self._estimate_distance(origins, destinations)

        origin_str = '|'.join(f"{o['lat']},{o['lng']}" for o in origins)
        dest_str = '|'.join(f"{d['lat']},{d['lng']}" for d in destinations)

        try:
            resp = requests.get(DISTANCE_MATRIX_URL, params={
                'origins': origin_str,
                'destinations': dest_str,
                'mode': mode,
                'key': self.api_key,
            }, timeout=10)
            data = resp.json()

            if data.get('status') != 'OK':
                logger.error(f"Distance Matrix API error: {data.get('status')}")
                return self._estimate_distance(origins, destinations)

            rows = []
            for row in data.get('rows', []):
                elements = []
                for el in row.get('elements', []):
                    elements.append({
                        'distance_km': round(el.get('distance', {}).get('value', 0) / 1000, 1),
                        'duration_minutes': round(el.get('duration', {}).get('value', 0) / 60),
                        'status': el.get('status', 'UNKNOWN'),
                    })
                rows.append({'elements': elements})

            return {'rows': rows}

        except Exception as e:
            logger.error(f'Distance Matrix API call failed: {e}')
            return self._estimate_distance(origins, destinations)

    # ─── Directions ──────────────────────────────────────

    def get_directions(
        self,
        origin: dict,
        destination: dict,
        mode: str = 'driving',
    ) -> dict:
        """
        Get turn-by-turn directions and encoded polyline.

        Args:
            origin: {"lat": 28.6139, "lng": 77.209}
            destination: {"lat": 19.076, "lng": 72.8777}
            mode: driving | walking | transit | bicycling

        Returns:
            {
                "distance_km": 1400.5,
                "duration_minutes": 1080,
                "polyline": "encoded_polyline_string",
                "steps": [...],
                "summary": "NH48",
            }
        """
        if not self.api_key:
            logger.warning('Google Maps API key not configured — returning stub')
            return self._stub_directions(origin, destination)

        try:
            resp = requests.get(DIRECTIONS_URL, params={
                'origin': f"{origin['lat']},{origin['lng']}",
                'destination': f"{destination['lat']},{destination['lng']}",
                'mode': mode,
                'key': self.api_key,
            }, timeout=10)
            data = resp.json()

            if data.get('status') != 'OK' or not data.get('routes'):
                logger.error(f"Directions API error: {data.get('status')}")
                return self._stub_directions(origin, destination)

            route = data['routes'][0]
            leg = route['legs'][0]

            steps = []
            for step in leg.get('steps', []):
                steps.append({
                    'instruction': step.get('html_instructions', ''),
                    'distance_km': round(step.get('distance', {}).get('value', 0) / 1000, 2),
                    'duration_minutes': round(step.get('duration', {}).get('value', 0) / 60, 1),
                })

            return {
                'distance_km': round(leg.get('distance', {}).get('value', 0) / 1000, 1),
                'duration_minutes': round(leg.get('duration', {}).get('value', 0) / 60),
                'polyline': route.get('overview_polyline', {}).get('points', ''),
                'steps': steps,
                'summary': route.get('summary', ''),
            }

        except Exception as e:
            logger.error(f'Directions API call failed: {e}')
            return self._stub_directions(origin, destination)

    # ─── Fallbacks ───────────────────────────────────────

    @staticmethod
    def _haversine(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
        """Haversine distance in km."""
        import math
        R = 6371
        dlat = math.radians(lat2 - lat1)
        dlng = math.radians(lng2 - lng1)
        a = (
            math.sin(dlat / 2) ** 2
            + math.cos(math.radians(lat1))
            * math.cos(math.radians(lat2))
            * math.sin(dlng / 2) ** 2
        )
        return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    def _estimate_distance(self, origins: list[dict], destinations: list[dict]) -> dict:
        """Estimate using haversine when API is unavailable."""
        rows = []
        for o in origins:
            elements = []
            for d in destinations:
                km = round(self._haversine(o['lat'], o['lng'], d['lat'], d['lng']), 1)
                elements.append({
                    'distance_km': km,
                    'duration_minutes': round(km / 60 * 60),  # ~60 km/h average
                    'status': 'ESTIMATED',
                })
            rows.append({'elements': elements})
        return {'rows': rows}

    def _stub_directions(self, origin: dict, destination: dict) -> dict:
        """Return stub directions when API is unavailable."""
        km = round(self._haversine(
            origin['lat'], origin['lng'],
            destination['lat'], destination['lng'],
        ), 1)
        return {
            'distance_km': km,
            'duration_minutes': round(km / 60 * 60),
            'polyline': '',
            'steps': [],
            'summary': 'Estimated route',
        }
