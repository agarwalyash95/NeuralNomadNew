"""V1 multimodal route graph search (master plan §9.1/§9.2).

Nodes: City (anchors) + transport hubs (Airport/RailwayStation/BusStation).
Access/egress edges: existing ``*ServiceArea`` rows, or an on-the-fly
``geo.nearest()`` fallback when a publishable city has none. Scheduled
edges: AirportRoute/TrainRoute/BusRoute rows (Phase 4 extensions). Road
edges: computed, never stored. NOT built: all-pairs precomputation,
persistent multi-hop paths, RAPTOR, contraction hierarchies — this module
assembles a graph in memory per call from indexed relational reads.

This module is reference-owned and provenance-*generic* — it must never
import ``apps.planner`` (``check_layer_boundaries`` enforces the
``planner -> reference -> common`` direction). ``JourneyRouteCache`` is a
planner model; caching stays the caller's (``journey_resolver``) job. Pricing
is a Phase-5 concern — every option's ``cost`` is honestly ``available: False``
until ``price_estimator`` exists (an interface stub, not a fabricated number).
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from apps.common.provenance import TIER_ESTIMATED, TIER_VERIFIED, make_provenance
from apps.reference.models import Airport, AirportRoute, BusRoute, BusStation, RailwayStation, TrainRoute, TransferProfile
from apps.reference.services.geo import bbox_prefilter, haversine_km, nearest, valid_coordinates
from apps.reference.services.station_selector import select_optimal_hubs

MAX_HUBS_PER_SIDE = 4
MAX_PAIRS_PER_MODE = 16
PARETO_TOP_K = 5
ROAD_FACTOR = 1.25
ROAD_SPEED_KMH = 55.0
CAB_MAX_FEASIBLE_KM = 1500.0

_MODEL_BY_MODE = {"flight": Airport, "train": RailwayStation, "bus": BusStation}
_ROUTE_MODEL_BY_MODE = {"flight": AirportRoute, "train": TrainRoute, "bus": BusRoute}


def _no_cost():
    return {"available": False, "min": None, "expected": None, "max": None, "currency": "INR"}


def _hub_code(hub):
    return str(getattr(hub, "iata_code", None) or getattr(hub, "code", None) or hub.pk)


def _transfer_profile(hub):
    """§9.4 S12: accessibility signals are surfaced, never used to silently
    exclude an option. Returns None when no profile exists (the common case
    today — TransferProfile has no populated source yet)."""
    profile = TransferProfile.objects.filter(location_code=_hub_code(hub)).first()
    if not profile:
        return None
    return {
        "typical_min_connection_mins": profile.typical_min_connection_mins,
        "terminal_change_common": profile.terminal_change_common,
        "stair_heavy": profile.stair_heavy,
        "source": profile.source,
    }


def _hub_dict(hub, mode):
    return {
        "id": hub.pk, "name": hub.name, "code": _hub_code(hub), "mode": mode,
        "latitude": float(hub.latitude) if hub.latitude is not None else None,
        "longitude": float(hub.longitude) if hub.longitude is not None else None,
        "transfer_profile": _transfer_profile(hub),
    }


def _access_leg(city, hub, minutes_hint=None):
    city_coords = (city.latitude, city.longitude)
    hub_coords = (hub.latitude, hub.longitude)
    if valid_coordinates(*city_coords) and valid_coordinates(*hub_coords):
        distance = haversine_km(*city_coords, *hub_coords)
    else:
        distance = None
    duration = minutes_hint
    if duration is None and distance is not None:
        duration = max(10, int(distance / 40 * 60))
    return {"distance_km": distance, "duration_mins": duration}


def _road_edge(origin_city, destination_city):
    """Direct city-to-city road estimate — computed, never stored (§9.1)."""
    if not (valid_coordinates(origin_city.latitude, origin_city.longitude)
            and valid_coordinates(destination_city.latitude, destination_city.longitude)):
        return None
    distance = haversine_km(
        origin_city.latitude, origin_city.longitude,
        destination_city.latitude, destination_city.longitude,
    ) * ROAD_FACTOR
    duration_mins = max(int(distance / ROAD_SPEED_KMH * 60), 30)
    return {"distance_km": round(distance, 1), "duration_mins": duration_mins}


_NEAREST_FALLBACK_RADIUS_KM = {"flight": 400, "train": 300, "bus": 150}


def _candidate_hubs(service_area_model, hub_field, city, mode, limit=MAX_HUBS_PER_SIDE):
    """Ordered hub candidates for one city/mode (§9.2 step 1).

    ServiceArea rows first (the common, richer case). When a publishable
    city has none — the exact gap report 5 measures — falls back to
    ``geo.nearest()`` over every hub of that mode, mirroring
    ``journey_resolver._nearest_hubs``'s legacy behavior: a real hub search
    can still surface a geometrically-plausible pair even where the
    ServiceArea backfill hasn't reached yet."""
    areas = (
        service_area_model.objects.filter(city=city)
        .select_related(hub_field)
        .order_by("-is_primary_hub", "distance_km")[: limit * 2]
    )
    hubs = []
    seen = set()
    for area in areas:
        hub = getattr(area, hub_field)
        if hub.pk in seen:
            continue
        seen.add(hub.pk)
        hubs.append((hub, area.distance_km, area.typical_transfer_mins))
        if len(hubs) >= limit:
            break
    if hubs:
        return hubs

    if not valid_coordinates(city.latitude, city.longitude):
        return []
    model = _MODEL_BY_MODE[mode]
    radius = _NEAREST_FALLBACK_RADIUS_KM.get(mode, 200)
    nearby = nearest(model.objects.all(), city.latitude, city.longitude, radius, limit=limit)
    return [(hub, hub.distance_km, None) for hub in nearby]


def _scheduled_edge(mode, source_hub, destination_hub):
    route_model = _ROUTE_MODEL_BY_MODE[mode]
    route = (
        route_model.objects.filter(source=source_hub, destination=destination_hub, is_active=True)
        .order_by("duration_mins").first()
    )
    if not route:
        return None
    tier = route.provenance_tier or "derived"
    return {
        "duration_mins": route.duration_mins,
        "distance_km": route.distance_km,
        "frequency_per_day": route.frequency_per_day,
        "operating_days": route.operating_days,
        **make_provenance(
            TIER_VERIFIED if tier == "authoritative" else TIER_ESTIMATED,
            source=f"{mode}_route", basis=f"{route_model.__name__}#{route.pk}",
        ),
        "route_confidence": route.confidence,
        "route_provenance_tier": tier,
    }


def _mode_options(mode, origin_city, destination_city):
    """One mode's Pareto-eligible options (§9.2 steps 2-3)."""
    from apps.reference.models import AirportServiceArea, BusStationServiceArea, RailwayStationServiceArea
    service_area_model, hub_field = {
        "flight": (AirportServiceArea, "airport"),
        "train": (RailwayStationServiceArea, "station"),
        "bus": (BusStationServiceArea, "bus_station"),
    }[mode]

    origin_hubs = _candidate_hubs(service_area_model, hub_field, origin_city, mode)
    dest_hubs = _candidate_hubs(service_area_model, hub_field, destination_city, mode)
    if not origin_hubs or not dest_hubs:
        return [], False  # (options, any_hub_pair_existed)

    # station_selector hard-filters on route existence + scores door-to-door
    # components (§9.2 step 5) — reused, not reimplemented, per the plan.
    hub_selection = select_optimal_hubs(service_type=mode, origin_city=origin_city, destination_city=destination_city)
    score_breakdown = hub_selection.get("score_breakdown", {})

    options = []
    any_hub_pair = False
    best_unscheduled = None  # honest geometry-only fallback (mirrors journey_resolver's fallback_level 5)
    pairs_checked = 0
    for source_hub, o_dist, o_mins in origin_hubs:
        for destination_hub, d_dist, d_mins in dest_hubs:
            if source_hub.pk == destination_hub.pk:
                continue
            pairs_checked += 1
            if pairs_checked > MAX_PAIRS_PER_MODE:
                break
            any_hub_pair = True
            access = _access_leg(origin_city, source_hub, o_mins)
            egress = _access_leg(destination_city, destination_hub, d_mins)
            edge = _scheduled_edge(mode, source_hub, destination_hub)
            if not edge:
                # No confirmed schedule for this pair — track the geographically
                # closest one as a candidate honest estimate, never fabricated
                # as "scheduled". A real hub search finding a plausible pair is
                # not the same as inventing a route (§9.2 step 7).
                combined = (access["distance_km"] or 0) + (egress["distance_km"] or 0)
                if best_unscheduled is None or combined < best_unscheduled[0]:
                    best_unscheduled = (combined, source_hub, destination_hub, access, egress)
                continue
            wait_buffer = {"flight": 90, "train": 30, "bus": 20}.get(mode, 20)
            total_duration = (
                (access["duration_mins"] or 0) + wait_buffer
                + (edge["duration_mins"] or 0) + (egress["duration_mins"] or 0)
            )
            code_pair = f"{_hub_code(source_hub)}->{_hub_code(destination_hub)}"
            options.append({
                "mode": mode,
                "source_hub": _hub_dict(source_hub, mode),
                "destination_hub": _hub_dict(destination_hub, mode),
                "access_leg": access,
                "egress_leg": egress,
                "scheduled_edge": edge,
                "total_duration_mins": total_duration,
                "transfers": 0,
                "cost": _no_cost(),
                "confidence": edge["route_confidence"],
                "provenance": edge["tier"],
                "hub_score_components": score_breakdown.get(code_pair, {}),
                "no_scheduled_route": False,
                "multileg_candidate": False,
            })

    if not options and best_unscheduled:
        combined, source_hub, destination_hub, access, egress = best_unscheduled
        wait_buffer = {"flight": 90, "train": 30, "bus": 20}.get(mode, 20)
        options.append({
            "mode": mode,
            "source_hub": _hub_dict(source_hub, mode),
            "destination_hub": _hub_dict(destination_hub, mode),
            "access_leg": access,
            "egress_leg": egress,
            "scheduled_edge": None,
            "total_duration_mins": (access["duration_mins"] or 0) + wait_buffer + (egress["duration_mins"] or 0),
            "transfers": 0,
            "cost": _no_cost(),
            "confidence": 0.35,
            "provenance": make_provenance(TIER_ESTIMATED, source="hub_geometry", basis="nearest_hub_no_confirmed_schedule")["tier"],
            "hub_score_components": {},
            "no_scheduled_route": True,
            "multileg_candidate": False,
        })

    return options, any_hub_pair


def _pareto_prune(options, limit=PARETO_TOP_K):
    def dominates(a, b):
        a_cost = a["cost"]["expected"] if a["cost"]["available"] else float("inf")
        b_cost = b["cost"]["expected"] if b["cost"]["available"] else float("inf")
        better_or_equal = (
            a["total_duration_mins"] <= b["total_duration_mins"]
            and a_cost <= b_cost and a["transfers"] <= b["transfers"]
        )
        strictly_better = (
            a["total_duration_mins"] < b["total_duration_mins"]
            or a_cost < b_cost or a["transfers"] < b["transfers"]
        )
        return better_or_equal and strictly_better

    non_dominated = [
        opt for opt in options
        if not any(dominates(other, opt) for other in options if other is not opt)
    ]
    best_per_mode = {}
    for opt in options:
        current = best_per_mode.get(opt["mode"])
        if current is None or opt["total_duration_mins"] < current["total_duration_mins"]:
            best_per_mode[opt["mode"]] = opt
    merged = {id(o): o for o in non_dominated}
    for opt in best_per_mode.values():
        merged[id(opt)] = opt
    ranked = sorted(merged.values(), key=lambda o: (o["total_duration_mins"], o["transfers"]))
    return ranked[:limit]


def search(origin_city, destination_city, travel_date=None, prefs=None) -> Dict[str, Any]:
    """V1 route search (§9.2). Returns a version-agnostic, leg-typed option list
    with provenance — callers (journey_resolver) adapt this into their own
    per-mode contract; this function never writes ``JourneyRouteCache``
    (planner-owned) and never fabricates a price (Phase 5 concern)."""
    prefs = prefs or {}
    all_options: List[dict] = []
    reasons: Dict[str, Any] = {}

    for mode in ("flight", "train", "bus"):
        options, any_hub_pair = _mode_options(mode, origin_city, destination_city)
        if options:
            all_options.extend(options)
        elif any_hub_pair:
            reasons[mode] = "hubs_exist_but_no_scheduled_route"
        else:
            reasons[mode] = "no_publishable_hubs_on_file"

    road = _road_edge(origin_city, destination_city)
    road_options = []
    if road:
        cab_feasible = road["distance_km"] <= CAB_MAX_FEASIBLE_KM
        road_options.append({
            "mode": "cab",
            "source_hub": None, "destination_hub": None,
            "access_leg": {"distance_km": 0.0, "duration_mins": 0},
            "egress_leg": {"distance_km": 0.0, "duration_mins": 0},
            "scheduled_edge": None,
            "total_duration_mins": road["duration_mins"],
            "transfers": 0,
            "cost": _no_cost(),
            "confidence": 0.55,
            "provenance": make_provenance(TIER_ESTIMATED, source="road_geometry", basis="haversine_x_1.25_at_55kmh")["tier"],
            "hub_score_components": {},
            "no_scheduled_route": not all_options,
            "multileg_candidate": False,
            "feasible": cab_feasible,
            "distance_km": road["distance_km"],
        })
    all_options.extend(road_options)

    # §9.2 step 7: a missing direct hub never silently recommends a full-distance
    # cab when scheduled alternatives might combine (V1.5) — mark, don't fabricate.
    if reasons and not any(o["mode"] in ("flight", "train", "bus") for o in all_options):
        for opt in road_options:
            opt["multileg_candidate"] = any(r == "hubs_exist_but_no_scheduled_route" for r in reasons.values())

    pruned = _pareto_prune(all_options)
    return {
        "options": pruned,
        "all_option_count": len(all_options),
        "no_scheduled_option_reasons": reasons,
        "feasible": bool(pruned),
    }
