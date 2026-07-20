import os
import logging
import urllib.request
import urllib.parse
import json
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import timedelta

from django.conf import settings
from django.utils import timezone

from apps.reference.services.geo import haversine_km

logger = logging.getLogger(__name__)

# Published per-km emission factor averages (kg CO2e/km, passenger-km basis) —
# approximate, widely-cited figures (comparable order of magnitude to
# UK DEFRA / EPA passenger transport averages), used only to produce an
# "estimated" tier carbon figure, never presented as a precise measurement.
_CARBON_KG_PER_KM = {
    "driving": 0.171, "cab": 0.171, "flight": 0.255, "train": 0.041,
    "bus": 0.105, "walking": 0.0, "cycling": 0.0, "transit": 0.06,
}

# Inter-city modes read directly from reference routes — no Maps API call.
_INTERCITY_MODES = {"flight", "train", "bus"}

# TTL by mode: scheduled routes (flight/train/bus) change far less often
# than road/transit conditions.
_EDGE_TTL_DAYS = {
    "flight": 180, "train": 180, "bus": 180,
    "driving": 60, "walking": 60, "cycling": 60, "transit": 60, "cab": 60,
}


def _carbon_kg(distance_km, mode):
    factor = _CARBON_KG_PER_KM.get(mode)
    if factor is None or distance_km is None:
        return None
    return round(distance_km * factor, 2)


def _scenic_score(orig_lat, orig_lng, dest_lat, dest_lng):
    """
    Heuristic, always "estimated" tier: density of real AttractionMaster rows
    near the route midpoint, normalized 0-1. Not a claim about the route's
    actual visual quality — a proxy signal, same trust tier as any other
    "suggested" fact in the Knowledge Engine.
    """
    if None in (orig_lat, orig_lng, dest_lat, dest_lng):
        return None
    try:
        from apps.reference.models import AttractionMaster

        mid_lat = (float(orig_lat) + float(dest_lat)) / 2
        mid_lng = (float(orig_lng) + float(dest_lng)) / 2
        nearby = 0
        # Bounded scan: a ~0.02deg box (~2km) around the midpoint keeps this
        # cheap without a spatial index, which the reference app doesn't have.
        candidates = AttractionMaster.objects.filter(
            latitude__range=(mid_lat - 0.02, mid_lat + 0.02),
            longitude__range=(mid_lng - 0.02, mid_lng + 0.02),
        )[:50]
        for c in candidates:
            if c.latitude is not None and c.longitude is not None:
                if haversine_km(mid_lat, mid_lng, c.latitude, c.longitude) <= 1.0:
                    nearby += 1
        return round(min(nearby / 10.0, 1.0), 2)
    except Exception:
        return None


def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Compatibility wrapper preserving the planner API's two-decimal result."""
    return round(haversine_km(lat1, lon1, lat2, lon2), 2)


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

        Persists to reference.DistanceEdge (TTL'd) — this used to write the
        older planner.LocationDistanceCache, which had no expiry and was a
        confirmed duplicate of DistanceEdge's key shape. Retired in the
        production-readiness pass; see docs/planner-production-plan.md Phase 1.
        """
        from apps.reference.models import DistanceEdge

        results = {}
        missing_pairs = []

        # 1. Check DB Cache first — only rows that haven't expired count as hits.
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

            cached_obj = DistanceEdge.objects.filter(
                origin_key=origin_key,
                destination_key=dest_key,
                mode=mode,
                expires_at__gt=timezone.now(),
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
                ttl_days = _EDGE_TTL_DAYS.get(mode, 60)
                for pair_id, orig_key, dest_key, dist_km, dur_mins in fetched:
                    results[pair_id] = {
                        "distance_km": dist_km,
                        "duration_mins": dur_mins,
                        "cached": False,
                        "source": "google_maps"
                    }
                    DistanceEdge.objects.update_or_create(
                        origin_key=orig_key, destination_key=dest_key, mode=mode,
                        defaults={
                            "distance_km": dist_km, "duration_mins": dur_mins,
                            "source": "google_distance_matrix",
                            "carbon_kg": _carbon_kg(dist_km, mode),
                            "expires_at": timezone.now() + timedelta(days=ttl_days),
                        },
                    )

        # 3. Haversine fallback for remaining missing pairs
        for pair_id, orig, dest, orig_key, dest_key in missing_pairs:
            if pair_id not in results:
                o_lat = orig.get("lat")
                o_lng = orig.get("lng")
                d_lat = dest.get("lat")
                d_lng = dest.get("lng")

                if all(value is not None for value in (o_lat, o_lng, d_lat, d_lng)):
                    dist_km = haversine_distance_km(float(o_lat), float(o_lng), float(d_lat), float(d_lng))
                else:
                    results[pair_id] = {
                        "distance_km": None,
                        "duration_mins": None,
                        "cached": False,
                        "source": "unavailable",
                    }
                    continue

                dur_mins = estimate_duration_mins(dist_km, mode)

                results[pair_id] = {
                    "distance_km": dist_km,
                    "duration_mins": dur_mins,
                    "cached": False,
                    "source": "haversine_estimate"
                }

                try:
                    ttl_days = _EDGE_TTL_DAYS.get(mode, 60)
                    DistanceEdge.objects.update_or_create(
                        origin_key=orig_key, destination_key=dest_key, mode=mode,
                        defaults={
                            "distance_km": dist_km, "duration_mins": dur_mins,
                            "source": "haversine_estimate",
                            "carbon_kg": _carbon_kg(dist_km, mode),
                            "expires_at": timezone.now() + timedelta(days=ttl_days),
                        },
                    )
                except Exception:
                    pass

        return results

    @staticmethod
    def fetch_multi_mode_edges(pairs: list, modes: list) -> dict:
        """
        Same pairs shape as fetch_batch_distances, but returns a per-mode
        breakdown and persists knowledge.DistanceEdge rows (TTL'd, with
        carbon/scenic estimates) rather than only LocationDistanceCache —
        see docs/travel-knowledge-engine-plan.md §6. Reuses
        fetch_batch_distances per mode for the actual road/transit fetch
        (proven cache -> Google Distance Matrix -> haversine path); this
        method's job is the multi-mode fan-out and the DistanceEdge write.

        Output: { pair_id: { mode: {distance_km, duration_mins, source, carbon_kg, scenic_score} } }
        """
        from apps.reference.models import DistanceEdge

        by_pair = {p["id"]: {} for p in pairs}
        edge_rows = []

        for mode in modes:
            if mode in _INTERCITY_MODES:
                mode_results = DistanceService._fetch_intercity_mode(pairs, mode)
            else:
                mode_results = DistanceService.fetch_batch_distances(pairs, mode=mode)

            pairs_by_id = {p["id"]: p for p in pairs}
            for pair_id, result in mode_results.items():
                pair = pairs_by_id.get(pair_id)
                if pair is None or result is None:
                    continue
                origin, dest = pair.get("origin", {}), pair.get("destination", {})
                carbon_kg = _carbon_kg(result.get("distance_km"), mode)
                scenic_score = (
                    _scenic_score(origin.get("lat"), origin.get("lng"), dest.get("lat"), dest.get("lng"))
                    if mode in ("walking", "cycling") else None
                )
                entry = {
                    "distance_km": result.get("distance_km"),
                    "duration_mins": result.get("duration_mins"),
                    "source": result.get("source"),
                    "carbon_kg": carbon_kg,
                    "scenic_score": scenic_score,
                }
                by_pair[pair_id][mode] = entry

                origin_key = f"{origin.get('lat')},{origin.get('lng')}" if origin.get("lat") else origin.get("name", "")
                dest_key = f"{dest.get('lat')},{dest.get('lng')}" if dest.get("lat") else dest.get("name", "")
                ttl_days = _EDGE_TTL_DAYS.get(mode, 60)
                edge_rows.append(DistanceEdge(
                    origin_key=origin_key, destination_key=dest_key, mode=mode,
                    distance_km=entry["distance_km"], duration_mins=entry["duration_mins"],
                    carbon_kg=carbon_kg, scenic_score=scenic_score,
                    source=result.get("source") or "unknown",
                    expires_at=timezone.now() + timedelta(days=ttl_days),
                ))

        if edge_rows:
            try:
                # Manual upsert: unique_together(origin_key, destination_key, mode)
                # has no bulk "on conflict update" without a raw query, and this
                # is a low-frequency batch write, so a per-row get_or_create/update
                # is simpler and clearer than hand-rolling ON CONFLICT here.
                for edge in edge_rows:
                    DistanceEdge.objects.update_or_create(
                        origin_key=edge.origin_key, destination_key=edge.destination_key, mode=edge.mode,
                        defaults={
                            "distance_km": edge.distance_km, "duration_mins": edge.duration_mins,
                            "carbon_kg": edge.carbon_kg, "scenic_score": edge.scenic_score,
                            "source": edge.source, "expires_at": edge.expires_at,
                        },
                    )
            except Exception as e:
                logger.warning(f"DistanceEdge upsert failed: {e}")

        return by_pair

    @staticmethod
    def _fetch_intercity_mode(pairs: list, mode: str) -> dict:
        """
        Flight/train/bus distances read from the reference routes tables
        (AirportRoute/TrainRoute/BusRoute.duration_mins) — a Maps API call
        makes no sense for a scheduled inter-city leg. Best-effort city-name
        matching; unmatched pairs are simply omitted (never fabricated).
        """
        from apps.reference.models import AirportRoute, BusRoute, TrainRoute

        route_model = {"flight": AirportRoute, "train": TrainRoute, "bus": BusRoute}[mode]
        city_field = {
            "flight": "source__city__name", "train": "source__city__name", "bus": "source__city__name",
        }[mode]
        dest_field = {
            "flight": "destination__city__name", "train": "destination__city__name",
            "bus": "destination__city__name",
        }[mode]

        results = {}
        for pair in pairs:
            origin_name = pair.get("origin", {}).get("name", "")
            dest_name = pair.get("destination", {}).get("name", "")
            if not origin_name or not dest_name:
                continue
            route = route_model.objects.filter(**{
                f"{city_field}__icontains": origin_name.split(",")[0].strip(),
                f"{dest_field}__icontains": dest_name.split(",")[0].strip(),
            }).first()
            if route is None or route.duration_mins is None:
                continue
            results[pair["id"]] = {
                "distance_km": None,  # scheduled routes carry duration, not a road/air distance figure
                "duration_mins": route.duration_mins,
                "source": "reference_route",
            }
        return results
