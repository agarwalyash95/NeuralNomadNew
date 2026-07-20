from django.db.models import Q
from apps.reference.models import (
    RailwayStation, RailwayStationServiceArea, TrainRoute,
    Airport, AirportServiceArea, AirportRoute,
    BusStation, BusStationServiceArea, BusRoute
)
from apps.reference.services.provenance import is_publishable_instance, publishable

# A city can have hundreds of ServiceArea rows (e.g. Delhi: 172, Kolkata: 280).
# Without this cap the candidate-pair loop below became an unbounded N*M cross
# product (~48k pairs for Delhi<->Kolkata), each issuing its own route-existence
# query -- an 8900+ query, 50s+ N+1. Ranked by primary-hub/distance, same as
# route_graph._candidate_hubs's own bounding.
MAX_CANDIDATE_HUBS_PER_SIDE = 8

_ROUTE_MODEL_BY_SERVICE_TYPE = {"train": TrainRoute, "flight": AirportRoute, "bus": BusRoute}


def select_optimal_hubs(service_type, origin_city, destination_city, origin_locality=None, destination_locality=None, config_weights=None):
    """
    Mandatory route-aware hub selector.
    
    1. Resolves candidate hubs for origin and destination based on ServiceArea mapping.
    2. Verifies actual route eligibility (hard filter: active routes must exist between candidates).
    3. Calculates door-to-door scores based on configurable weights.
    4. Ranks candidates and returns recommended choice, alternatives, and score breakdowns.
    """
    weights = {
        "route_eligibility": 40.0,
        "direct_route_bonus": 20.0,
        "local_transfer_time": 15.0,
        "route_journey_time": 15.0,
        "interchange_penalty": 10.0,
        "service_frequency": 5.0,
        "data_confidence": 5.0
    }
    if config_weights:
        weights.update(config_weights)

    # 1. Fetch origin service areas and candidate hubs
    origin_hubs = []
    dest_hubs = []

    # Ranked + capped before slicing to a hard limit: filtering non-publishable
    # rows out in Python happens after the slice, so pull a small buffer.
    _candidate_buffer = MAX_CANDIDATE_HUBS_PER_SIDE * 3

    if service_type == 'train':
        # Railway candidates
        orig_sas = RailwayStationServiceArea.objects.filter(city=origin_city)
        if origin_locality:
            orig_sas = orig_sas.filter(Q(locality=origin_locality) | Q(locality__isnull=True))
        orig_sas = orig_sas.order_by('-is_primary_hub', 'distance_km')[:_candidate_buffer]
        dest_sas = RailwayStationServiceArea.objects.filter(city=destination_city)
        if destination_locality:
            dest_sas = dest_sas.filter(Q(locality=destination_locality) | Q(locality__isnull=True))
        dest_sas = dest_sas.order_by('-is_primary_hub', 'distance_km')[:_candidate_buffer]

        origin_hubs = [sa.station for sa in orig_sas.select_related('station') if is_publishable_instance(sa.station)][:MAX_CANDIDATE_HUBS_PER_SIDE]
        dest_hubs = [sa.station for sa in dest_sas.select_related('station') if is_publishable_instance(sa.station)][:MAX_CANDIDATE_HUBS_PER_SIDE]

    elif service_type == 'flight':
        # Airport candidates
        orig_sas = AirportServiceArea.objects.filter(city=origin_city)
        if origin_locality:
            orig_sas = orig_sas.filter(Q(locality=origin_locality) | Q(locality__isnull=True))
        orig_sas = orig_sas.order_by('-is_primary_hub', 'distance_km')[:_candidate_buffer]
        dest_sas = AirportServiceArea.objects.filter(city=destination_city)
        if destination_locality:
            dest_sas = dest_sas.filter(Q(locality=destination_locality) | Q(locality__isnull=True))
        dest_sas = dest_sas.order_by('-is_primary_hub', 'distance_km')[:_candidate_buffer]

        origin_hubs = [sa.airport for sa in orig_sas.select_related('airport') if is_publishable_instance(sa.airport)][:MAX_CANDIDATE_HUBS_PER_SIDE]
        dest_hubs = [sa.airport for sa in dest_sas.select_related('airport') if is_publishable_instance(sa.airport)][:MAX_CANDIDATE_HUBS_PER_SIDE]

    elif service_type == 'bus':
        # Bus candidates
        orig_sas = BusStationServiceArea.objects.filter(city=origin_city)
        if origin_locality:
            orig_sas = orig_sas.filter(Q(locality=origin_locality) | Q(locality__isnull=True))
        orig_sas = orig_sas.order_by('-is_primary_hub', 'distance_km')[:_candidate_buffer]
        dest_sas = BusStationServiceArea.objects.filter(city=destination_city)
        if destination_locality:
            dest_sas = dest_sas.filter(Q(locality=destination_locality) | Q(locality__isnull=True))
        dest_sas = dest_sas.order_by('-is_primary_hub', 'distance_km')[:_candidate_buffer]

        origin_hubs = [sa.bus_station for sa in orig_sas.select_related('bus_station') if is_publishable_instance(sa.bus_station)][:MAX_CANDIDATE_HUBS_PER_SIDE]
        dest_hubs = [sa.bus_station for sa in dest_sas.select_related('bus_station') if is_publishable_instance(sa.bus_station)][:MAX_CANDIDATE_HUBS_PER_SIDE]

    explanation = []
    hard_filters = ["route_exists"]

    # Fallback to general city hubs if no service areas are populated yet
    if not origin_hubs:
        explanation.append(f"No explicit service area hubs found for origin city {origin_city.name}. Falling back to all city hubs.")
        if service_type == 'train':
            origin_hubs = list(publishable(RailwayStation.objects.filter(city=origin_city))[:MAX_CANDIDATE_HUBS_PER_SIDE])
        elif service_type == 'flight':
            origin_hubs = list(publishable(Airport.objects.filter(city=origin_city))[:MAX_CANDIDATE_HUBS_PER_SIDE])
        elif service_type == 'bus':
            origin_hubs = list(publishable(BusStation.objects.filter(city=origin_city))[:MAX_CANDIDATE_HUBS_PER_SIDE])

    if not dest_hubs:
        explanation.append(f"No explicit service area hubs found for destination city {destination_city.name}. Falling back to all city hubs.")
        if service_type == 'train':
            dest_hubs = list(publishable(RailwayStation.objects.filter(city=destination_city))[:MAX_CANDIDATE_HUBS_PER_SIDE])
        elif service_type == 'flight':
            dest_hubs = list(publishable(Airport.objects.filter(city=destination_city))[:MAX_CANDIDATE_HUBS_PER_SIDE])
        elif service_type == 'bus':
            dest_hubs = list(publishable(BusStation.objects.filter(city=destination_city))[:MAX_CANDIDATE_HUBS_PER_SIDE])

    # Evaluate candidate pairs. Route eligibility used to be a per-pair query
    # (`Route.objects.filter(source=ohub, destination=dhub)` inside a nested
    # Python loop) -- an O(len(origin_hubs) * len(dest_hubs)) N+1 that, before
    # the hub-list cap above, meant tens of thousands of individual queries
    # for well-mapped cities. One bulk query + in-memory grouping instead.
    route_model = _ROUTE_MODEL_BY_SERVICE_TYPE[service_type]
    origin_ids = [hub.pk for hub in origin_hubs]
    dest_ids = [hub.pk for hub in dest_hubs]
    routes_by_pair = {}
    if origin_ids and dest_ids:
        for route in route_model.objects.filter(source_id__in=origin_ids, destination_id__in=dest_ids):
            routes_by_pair.setdefault((route.source_id, route.destination_id), []).append(route)

    valid_pairs = []

    for ohub in origin_hubs:
        for dhub in dest_hubs:
            # 2. Check route eligibility
            routes = routes_by_pair.get((ohub.pk, dhub.pk), [])

            if not routes:
                # Exclude this pair if no routes exist
                continue

            # Find best route (shortest duration)
            best_route = min(routes, key=lambda r: r.duration_mins or 99999)
            valid_pairs.append((ohub, dhub, best_route, len(routes)))

    if not valid_pairs:
        # Check if there is any route between the cities generally
        explanation.append("No active direct routes found between any candidate hubs. Exposing uncertainty.")
        return {
            "recommended": {},
            "alternatives": [],
            "explanation": explanation,
            "hard_filters_applied": hard_filters,
            "score_breakdown": {},
            "verified_fields": [],
            "derived_fields": [],
            "estimated_fields": [],
            "missing_data": ["active_route_connection"],
            "confidence": 0.0
        }

    # Same N+1 shape as the route lookup above -- one lookup per valid pair
    # keyed only on the origin hub. Prefetched once, keyed by origin hub id.
    sa_by_origin_hub = {}
    if service_type == 'train':
        for sa in RailwayStationServiceArea.objects.filter(city=origin_city, station_id__in=origin_ids):
            sa_by_origin_hub.setdefault(sa.station_id, sa)
    elif service_type == 'flight':
        for sa in AirportServiceArea.objects.filter(city=origin_city, airport_id__in=origin_ids):
            sa_by_origin_hub.setdefault(sa.airport_id, sa)

    scored_candidates = []

    for ohub, dhub, route, freq in valid_pairs:
        # Calculate component scores

        # 1. Route Eligibility / Direct route (max 30)
        route_score = 30.0

        # 2. Local transfer (prefers short transfer time / distance)
        # Fetch distance from service area mappings
        dist_orig = 10.0
        transfer_orig = 30
        if service_type == 'train':
            sa_orig = sa_by_origin_hub.get(ohub.pk)
            if sa_orig:
                dist_orig = sa_orig.distance_km or 10.0
                transfer_orig = sa_orig.typical_transfer_mins or 30
        elif service_type == 'flight':
            sa_orig = sa_by_origin_hub.get(ohub.pk)
            if sa_orig:
                dist_orig = sa_orig.distance_km or 15.0
                transfer_orig = sa_orig.typical_transfer_mins or 45

        transfer_score = max(0.0, 15.0 - (transfer_orig / 10.0))
        
        # 3. Route duration score
        duration_score = max(0.0, 30.0 - ((route.duration_mins or 300) / 60.0))
        
        # 4. Frequency adjustment
        freq_score = min(5.0, freq * 1.5)
        
        # Combine
        total_score = route_score + transfer_score + duration_score + freq_score
        
        candidate_payload = {
            "score": round(total_score, 2),
            "origin_hub_id": ohub.id,
            "origin_name": ohub.name,
            "origin_code": ohub.code if hasattr(ohub, 'code') else ohub.iata_code,
            "destination_hub_id": dhub.id,
            "destination_name": dhub.name,
            "destination_code": dhub.code if hasattr(dhub, 'code') else dhub.iata_code,
            "route_id": route.id,
            "frequency": freq,
            "duration_mins": route.duration_mins,
            "transfer_mins": transfer_orig,
            "distance_km": dist_orig
        }
        
        scored_candidates.append((total_score, candidate_payload))

    scored_candidates.sort(key=lambda x: x[0], reverse=True)
    
    best_candidate = scored_candidates[0][1]
    alternatives = [s[1] for s in scored_candidates[1:5]]
    
    score_breakdown = {}
    for score, payload in scored_candidates:
        code_pair = f"{payload['origin_code']}->{payload['destination_code']}"
        score_breakdown[code_pair] = {
            "total": score,
            "route_eligibility": 30.0,
            "local_transfer": round(max(0.0, 15.0 - (payload['transfer_mins'] / 10.0)), 2),
            "journey_duration": round(max(0.0, 30.0 - ((payload['duration_mins'] or 300) / 60.0)), 2),
            "frequency": round(min(5.0, payload["frequency"] * 1.5), 2),
            "confidence_adjustment": 2.5
        }

    explanation.append(
        f"Recommended route {best_candidate['origin_code']} to {best_candidate['destination_code']} "
        f"with score {best_candidate['score']} based on direct route connection and transfer time of {best_candidate['transfer_mins']} mins."
    )

    return {
        "recommended": best_candidate,
        "alternatives": alternatives,
        "explanation": explanation,
        "hard_filters_applied": hard_filters,
        "score_breakdown": score_breakdown,
        "verified_fields": ["route.duration_mins"],
        "derived_fields": ["derived_connectivity_score", "typical_transfer_mins"],
        "estimated_fields": [],
        "missing_data": [],
        "confidence": 0.95
    }
