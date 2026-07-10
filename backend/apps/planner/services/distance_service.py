import os
import math
import logging
import urllib.request
import urllib.parse
import json
from concurrent.futures import ThreadPoolExecutor, as_completed
from django.conf import settings
from apps.planner.models import LocationDistanceCache

logger = logging.getLogger(__name__)


def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the great circle distance between two points on the earth in km."""
    R = 6371.0  # Radius of the earth in km
    dLat = math.radians(lat2 - lat1)
    dLon = math.radians(lon2 - lon1)
    a = (
        math.sin(dLat / 2) * math.sin(dLat / 2)
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dLon / 2)
        * math.sin(dLon / 2)
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return round(R * c, 2)


def estimate_duration_mins(distance_km: float, mode: str = "driving") -> int:
    """Estimate travel time in minutes based on distance and mode."""
    speed_kmh = 30.0 if mode == "driving" else (5.0 if mode == "walking" else 20.0)
    mins = int((distance_km / speed_kmh) * 60)
    return max(mins, 3)  # minimum 3 mins


class DistanceService:
    @staticmethod
    def fetch_batch_distances(pairs: list, mode: str = "driving") -> dict:
        """
        Input pairs format:
        [
          {
            "id": "pair_1",
            "origin": {"lat": 32.2432, "lng": 77.1892, "name": "Hadimba Temple"},
            "destination": {"lat": 32.3167, "lng": 77.1333, "name": "Solang Valley"}
          }, ...
        ]
        Output format:
        {
          "pair_1": { "distance_km": 11.4, "duration_mins": 25, "cached": True }
        }
        """
        results = {}
        missing_pairs = []

        # 1. Check DB Cache first
        for item in pairs:
            pair_id = item.get("id")
            origin = item.get("origin", {})
            dest = item.get("destination", {})

            orig_lat = origin.get("lat")
            orig_lng = origin.get("lng")
            orig_name = origin.get("name") or f"{orig_lat},{orig_lng}"

            dest_lat = dest.get("lat")
            dest_lng = dest.get("lng")
            dest_name = dest.get("name") or f"{dest_lat},{dest_lng}"

            if not (orig_lat and orig_lng and dest_lat and dest_lng):
                origin_key = orig_name.strip().lower()
                dest_key = dest_name.strip().lower()
            else:
                origin_key = f"{round(float(orig_lat), 4)},{round(float(orig_lng), 4)}"
                dest_key = f"{round(float(dest_lat), 4)},{round(float(dest_lng), 4)}"

            cached_obj = LocationDistanceCache.objects.filter(
                origin_key=origin_key,
                destination_key=dest_key,
                mode=mode
            ).first()

            if cached_obj:
                results[pair_id] = {
                    "distance_km": cached_obj.distance_km,
                    "duration_mins": cached_obj.duration_mins,
                    "cached": True,
                    "source": "database"
                }
            else:
                missing_pairs.append((pair_id, origin, dest, origin_key, dest_key))

        if not missing_pairs:
            return results

        # 2. Fetch missing pairs from the Google Maps Distance Matrix API.
        # One request per pair: a combined origins|...&destinations|... call
        # returns (and bills) the full N x N matrix when we only need the
        # N diagonal elements, and misindexing the matrix silently mispairs
        # results. Per-pair requests bill exactly one element each.
        api_key = getattr(settings, "GOOGLE_PLACES_API_KEY", None) or os.getenv("GOOGLE_PLACES_API_KEY")

        if api_key and missing_pairs:
            fetched = []

            def _fetch_pair(pair):
                pair_id, orig, dest, orig_key, dest_key = pair
                origin_param = (
                    f"{orig.get('lat')},{orig.get('lng')}" if orig.get('lat') else orig.get('name', '')
                )
                dest_param = (
                    f"{dest.get('lat')},{dest.get('lng')}" if dest.get('lat') else dest.get('name', '')
                )
                url = (
                    "https://maps.googleapis.com/maps/api/distancematrix/json"
                    f"?origins={urllib.parse.quote(origin_param)}"
                    f"&destinations={urllib.parse.quote(dest_param)}"
                    f"&mode={mode}&key={api_key}"
                )
                req = urllib.request.Request(url, headers={"User-Agent": "NeuralNomad/1.0"})
                with urllib.request.urlopen(req, timeout=5) as resp:
                    data = json.loads(resp.read().decode("utf-8"))

                if data.get("status") != "OK":
                    return None
                element = data["rows"][0]["elements"][0]
                if element.get("status") != "OK":
                    return None

                dist_km = round(element["distance"]["value"] / 1000.0, 2)
                dur_mins = max(int(element["duration"]["value"] / 60.0), 3)
                return pair_id, orig_key, dest_key, dist_km, dur_mins

            try:
                with ThreadPoolExecutor(max_workers=min(8, len(missing_pairs))) as pool:
                    futures = {pool.submit(_fetch_pair, p): p for p in missing_pairs}
                    for future in as_completed(futures):
                        try:
                            row = future.result()
                            if row:
                                fetched.append(row)
                        except Exception as e:
                            logger.warning(f"Distance Matrix pair fetch failed: {e}")
            except Exception as e:
                logger.warning(f"Google Maps Distance API batch failed, falling back to Haversine: {e}")

            if fetched:
                # DB writes stay on the request thread; workers only do HTTP.
                new_cache_objects = []
                for pair_id, orig_key, dest_key, dist_km, dur_mins in fetched:
                    results[pair_id] = {
                        "distance_km": dist_km,
                        "duration_mins": dur_mins,
                        "cached": False,
                        "source": "google_maps"
                    }
                    new_cache_objects.append(LocationDistanceCache(
                        origin_key=orig_key,
                        destination_key=dest_key,
                        mode=mode,
                        distance_km=dist_km,
                        duration_mins=dur_mins
                    ))
                LocationDistanceCache.objects.bulk_create(new_cache_objects, ignore_conflicts=True)

        # 3. Haversine fallback for remaining missing pairs
        for pair_id, orig, dest, orig_key, dest_key in missing_pairs:
            if pair_id not in results:
                o_lat = orig.get("lat")
                o_lng = orig.get("lng")
                d_lat = dest.get("lat")
                d_lng = dest.get("lng")

                if o_lat and o_lng and d_lat and d_lng:
                    dist_km = haversine_distance_km(float(o_lat), float(o_lng), float(d_lat), float(d_lng))
                else:
                    dist_km = 4.5  # default baseline city fallback

                dur_mins = estimate_duration_mins(dist_km, mode)

                results[pair_id] = {
                    "distance_km": dist_km,
                    "duration_mins": dur_mins,
                    "cached": False,
                    "source": "haversine_estimate"
                }

                try:
                    LocationDistanceCache.objects.create(
                        origin_key=orig_key,
                        destination_key=dest_key,
                        mode=mode,
                        distance_km=dist_km,
                        duration_mins=dur_mins
                    )
                except Exception:
                    pass

        return results
