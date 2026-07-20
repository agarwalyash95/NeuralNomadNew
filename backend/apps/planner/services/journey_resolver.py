"""Door-to-door multimodal journey resolution.

The resolver produces evidence-rich options consumed by chat, generation and
helper canvases.  It never writes an alternate trip; only TTL route evidence
is cached.
"""

from __future__ import annotations

import hashlib
from datetime import timedelta
from typing import Any, Dict, List, Optional, Tuple

from django.conf import settings
from django.db.models import Q
from django.utils import timezone

from apps.planner.models import JourneyRouteCache
from apps.planner.services.distance_service import haversine_distance_km
from apps.planner.services.foundation import DecisionTrace, UsageBudget, evidence


def resolve_journey_options(draft, *, usage: Optional[UsageBudget] = None, trace: Optional[DecisionTrace] = None) -> List[dict]:
    """Public entry point (Phase 4 thin-adapter dispatch).

    ``PLANNER_ROUTE_GRAPH_ENABLED`` (default ``False``) selects which
    implementation is *authoritative* — the byte-identical legacy resolver, or
    the new ``reference.services.route_graph``-backed one. Ships with the
    legacy path authoritative in every environment; flipping the flag is a
    deliberate owner decision after reviewing shadow-comparison evidence.

    ``PLANNER_MULTIMODAL_SHADOW_MODE`` (existing flag, now meaningful):
    when ``True``, *additionally* computes the non-authoritative
    implementation purely for comparison — logged to ``trace``, never
    affecting the returned value. Works in either direction.
    """
    usage = usage or UsageBudget()
    trace = trace or DecisionTrace()
    route_graph_enabled = bool(getattr(settings, "PLANNER_ROUTE_GRAPH_ENABLED", False))
    shadow_mode = bool(getattr(settings, "PLANNER_MULTIMODAL_SHADOW_MODE", False))

    primary_resolver = _route_graph_resolve_scheduled_mode if route_graph_enabled else _resolve_scheduled_mode
    result = _resolve_journey_options_impl(draft, usage=usage, trace=trace, scheduled_mode_resolver=primary_resolver)

    if shadow_mode:
        shadow_resolver = _resolve_scheduled_mode if route_graph_enabled else _route_graph_resolve_scheduled_mode
        try:
            shadow_result = _resolve_journey_options_impl(
                draft, usage=UsageBudget(), trace=DecisionTrace(),
                scheduled_mode_resolver=shadow_resolver,
            )
            trace.add(
                "shadow_comparison",
                primary_impl="route_graph" if route_graph_enabled else "legacy",
                primary_option_count=len(result),
                primary_recommended_mode=next((o["mode"] for o in result if o.get("recommended")), None),
                shadow_impl="legacy" if route_graph_enabled else "route_graph",
                shadow_option_count=len(shadow_result),
                shadow_recommended_mode=next((o["mode"] for o in shadow_result if o.get("recommended")), None),
            )
        except Exception as exc:
            trace.add("shadow_comparison_failed", error=type(exc).__name__)

    return result


def _resolve_journey_options_impl(draft, *, usage: UsageBudget, trace: DecisionTrace, scheduled_mode_resolver) -> List[dict]:
    origin_text = (draft.origin_text or (draft.metadata or {}).get("origin") or "").strip()
    destination_text = (draft.destination_text or "").strip()
    if not origin_text or not destination_text:
        trace.add("journey_blocked", reason="missing_origin_or_destination")
        return []

    # R5/DATA-01: destination already preferred the resolved-during-intake
    # FK over a fresh name-only lookup; origin didn't, even though
    # TripDraftState.origin_city exists and is set the same way — a plain
    # `_resolve_city(origin_text)` name match is the wrong-country risk
    # DATA-01 flagged, and the FK (when set) is exact and already
    # country-scoped, so it should win the same way destination's does.
    source_city = getattr(draft, "origin_city", None) or _resolve_city(origin_text)
    destination_city = getattr(draft, "destination_city", None) or _resolve_city(destination_text)
    if not source_city or not destination_city:
        trace.add("journey_blocked", reason="unresolved_city", origin=origin_text, destination=destination_text)
        return []

    # R5 (docs/planner-complete-current-audit-and-repair-plan.md §19):
    # confirmed for real — a City row can exist with no coordinates at all
    # (created by a path that never geocoded it, e.g. chat-intake
    # destination resolution) while a fresh geocode for that exact name
    # succeeds fine. This function runs BEFORE plan_generation's own city-
    # resolution phase (geocoding.resolve_or_create_city, which already
    # backfills) ever gets a chance to, and uses draft.origin_city/
    # destination_city directly — so without this, every mode (including
    # cab/self-drive, which need both endpoints' coordinates too) fails
    # with "no hubs"/"unresolved", not just scheduled ones.
    from apps.planner.services.geocoding import backfill_city_coordinates

    backfill_city_coordinates(source_city)
    backfill_city_coordinates(destination_city)

    preferred = str((draft.metadata or {}).get("preferred_mode") or "").lower()
    modes = [m for m in [preferred, "train", "flight", "bus", "cab", "self_drive"] if m]
    modes = list(dict.fromkeys("flight" if m in {"air", "plane"} else m for m in modes))
    options: List[dict] = []

    for mode in modes:
        if mode in {"train", "flight"}:
            option = scheduled_mode_resolver(draft, source_city, destination_city, mode, usage, trace)
            if option:
                options.append(option)
        elif mode in {"cab", "self_drive"}:
            option = _resolve_road_mode(draft, source_city, destination_city, mode, trace)
            if option:
                options.append(option)
        elif mode == "bus":
            option = _resolve_bus_mode(draft, source_city, destination_city, usage, trace)
            if option:
                options.append(option)

    for option in options:
        option["selected_by_user"] = option["mode"] == preferred
        option["recommended"] = False
    feasible = [o for o in options if o.get("feasible")]
    if feasible:
        # Explicit feasible preference wins; otherwise suitability wins.
        selected = next((o for o in feasible if o["mode"] == preferred), None)
        selected = selected or max(feasible, key=lambda o: o["planning_suitability"]["score"])
        selected["recommended"] = True
    return sorted(options, key=lambda o: (not o.get("recommended"), -o["planning_suitability"]["score"]))


def _resolve_city(name):
    from apps.reference.services.canonical_resolver import resolve_canonical_city

    # Simple parse: if comma exists, separate name and state/country context
    parts = [p.strip() for p in name.split(",")]
    if len(parts) > 1:
        query = parts[0]
        context = parts[-1]
        return resolve_canonical_city(query, country_context=context, state_context=context)
    return resolve_canonical_city(name)


def _coords(obj) -> Optional[Tuple[float, float]]:
    lat = getattr(obj, "latitude", None)
    lng = getattr(obj, "longitude", None)
    if lat is None or lng is None:
        city = getattr(obj, "city", None) or getattr(obj, "physical_city", None)
        lat, lng = getattr(city, "latitude", None), getattr(city, "longitude", None)
    if lat is None or lng is None:
        return None
    return float(lat), float(lng)


def _nearest_hubs(city, mode, limit=5):
    from apps.reference.models import Airport, RailwayStation

    model = Airport if mode == "flight" else RailwayStation
    city_coords = _coords(city)
    if not city_coords:
        return []
    ranked = []
    # R5 (docs/planner-complete-current-audit-and-repair-plan.md §19): was
    # filtered to city__country=city.country, so a genuinely-nearer hub just
    # across a border was invisible even when it was the obviously better
    # choice. Rank by real distance across every hub of this mode instead —
    # the haversine sort below already prefers the closer one regardless of
    # country, and reference tables are a bounded seeded dataset (not a
    # global live index), so scanning all of them is cheap.
    lat, lng = city_coords
    delta = 8 if mode == "flight" else 4
    queryset = model.objects.filter(
        Q(latitude__range=(lat - delta, lat + delta), longitude__range=(lng - delta, lng + delta))
        | Q(
            city__latitude__range=(lat - delta, lat + delta),
            city__longitude__range=(lng - delta, lng + delta),
        )
    ).select_related("city")
    for hub in queryset.iterator(chunk_size=1000):
        hub_coords = _coords(hub)
        if hub_coords:
            ranked.append((haversine_distance_km(*city_coords, *hub_coords), hub))
    ranked.sort(key=lambda item: (item[0], str(item[1].pk)))
    return ranked[:limit]


def _resolve_scheduled_mode(draft, source_city, destination_city, mode, usage, trace):
    from apps.reference.services.station_selector import select_optimal_hubs
    from apps.reference.models import Airport, RailwayStation

    hub_selection = select_optimal_hubs(
        service_type=mode,
        origin_city=source_city,
        destination_city=destination_city,
    )

    # Convert the selected hub IDs back to Airport/RailwayStation objects
    model = Airport if mode == "flight" else RailwayStation
    pairs = []

    # Map recommended candidate
    rec = hub_selection.get("recommended")
    if rec and "origin_hub_id" in rec:
        ohub = model.objects.filter(id=rec["origin_hub_id"]).first()
        dhub = model.objects.filter(id=rec["destination_hub_id"]).first()
        if ohub and dhub:
            source_coords = _coords(ohub)
            dest_coords = _coords(dhub)
            city_src_coords = _coords(source_city)
            city_dst_coords = _coords(destination_city)
            first_mile = haversine_distance_km(*city_src_coords, *source_coords) if city_src_coords and source_coords else 10.0
            last_mile = haversine_distance_km(*city_dst_coords, *dest_coords) if city_dst_coords and dest_coords else 10.0
            pairs.append((first_mile + last_mile, first_mile, last_mile, ohub, dhub))

    # Map alternatives
    for alt in hub_selection.get("alternatives", []):
        ohub = model.objects.filter(id=alt["origin_hub_id"]).first()
        dhub = model.objects.filter(id=alt["destination_hub_id"]).first()
        if ohub and dhub:
            source_coords = _coords(ohub)
            dest_coords = _coords(dhub)
            city_src_coords = _coords(source_city)
            city_dst_coords = _coords(destination_city)
            first_mile = haversine_distance_km(*city_src_coords, *source_coords) if city_src_coords and source_coords else 10.0
            last_mile = haversine_distance_km(*city_dst_coords, *dest_coords) if city_dst_coords and dest_coords else 10.0
            pairs.append((first_mile + last_mile, first_mile, last_mile, ohub, dhub))

    # If no pairs are returned by the station selector (e.g. no routes in DB),
    # fall back to nearest hubs to ensure we don't completely break if DB is not seeded/configured yet
    if not pairs:
        source_hubs = _nearest_hubs(source_city, mode)
        destination_hubs = _nearest_hubs(destination_city, mode)
        if not source_hubs or not destination_hubs:
            trace.add("mode_unavailable", mode=mode, reason="no_hubs")
            return None

        for source_distance, source_hub in source_hubs:
            for destination_distance, destination_hub in destination_hubs:
                pairs.append((source_distance + destination_distance, source_distance, destination_distance, source_hub, destination_hub))
        pairs.sort(key=lambda item: item[0])

    best = None
    max_pairs = int(getattr(settings, "PLANNER_MAX_HUB_PAIRS_PER_MODE", 5))
    score_breakdown = hub_selection.get("score_breakdown", {})

    for _, first_mile, last_mile, source_hub, destination_hub in pairs[:max_pairs]:
        route = _route_evidence(draft, mode, source_hub, destination_hub, usage, trace)
        if route.get("booking_availability") == "unavailable":
            continue
        
        base_score = _suitability_score(draft, mode, first_mile + last_mile, route)
        
        # Inject the door-to-door transit components score from the station_selector breakdown if available
        code_pair = f"{_hub_code(source_hub)}->{_hub_code(destination_hub)}"
        pair_components = score_breakdown.get(code_pair, {})
        
        candidate = _scheduled_option(
            draft, mode, source_city, destination_city, source_hub, destination_hub,
            first_mile, last_mile, route, base_score, components=pair_components
        )
        
        trace.add(
            "journey_candidate",
            mode=mode,
            source_hub=_hub_code(source_hub),
            destination_hub=_hub_code(destination_hub),
            planning_suitability=base_score,
            booking_availability=route["booking_availability"],
            provider_fallback_level=route["fallback_level"],
        )
        if best is None or base_score > best[0]:
            best = (base_score, candidate)
            
    return best[1] if best else None


def _route_graph_resolve_scheduled_mode(draft, source_city, destination_city, mode, usage, trace):
    """Phase 4 thin-adapter path: hub selection/ranking comes from
    ``reference.services.route_graph.search()`` (the V1 algorithm) instead of
    this module's own pairs-sort. Per-pair live/cache/DB evidence retrieval
    (``_route_evidence``) and final option assembly (``_scheduled_option``)
    are the exact same, already-tested functions the legacy path uses —
    only the candidate hub-pair *selection* differs, per the plan's "thin
    adapter" framing."""
    from apps.reference.models import Airport, RailwayStation
    from apps.reference.services import route_graph

    result = route_graph.search(source_city, destination_city, travel_date=draft.start_date)
    model = Airport if mode == "flight" else RailwayStation
    mode_options = [
        opt for opt in result.get("options", [])
        if opt["mode"] == mode and opt.get("source_hub") and opt.get("destination_hub")
    ]
    if not mode_options:
        trace.add("mode_unavailable", mode=mode, reason="no_hubs", impl="route_graph")
        return None

    max_pairs = int(getattr(settings, "PLANNER_MAX_HUB_PAIRS_PER_MODE", 5))
    best = None
    for opt in mode_options[:max_pairs]:
        source_hub = model.objects.filter(id=opt["source_hub"]["id"]).first()
        destination_hub = model.objects.filter(id=opt["destination_hub"]["id"]).first()
        if not source_hub or not destination_hub:
            continue
        first_mile = opt["access_leg"]["distance_km"] or 10.0
        last_mile = opt["egress_leg"]["distance_km"] or 10.0

        route = _route_evidence(draft, mode, source_hub, destination_hub, usage, trace)
        if route.get("booking_availability") == "unavailable":
            continue

        base_score = _suitability_score(draft, mode, first_mile + last_mile, route)
        candidate = _scheduled_option(
            draft, mode, source_city, destination_city, source_hub, destination_hub,
            first_mile, last_mile, route, base_score, components=opt.get("hub_score_components", {}),
        )
        trace.add(
            "journey_candidate", mode=mode,
            source_hub=_hub_code(source_hub), destination_hub=_hub_code(destination_hub),
            planning_suitability=base_score, booking_availability=route["booking_availability"],
            provider_fallback_level=route["fallback_level"], impl="route_graph",
        )
        if best is None or base_score > best[0]:
            best = (base_score, candidate)

    return best[1] if best else None


def _route_evidence(draft, mode, source_hub, destination_hub, usage, trace):
    source_code, destination_code = _hub_code(source_hub), _hub_code(destination_hub)
    travel_date = draft.start_date
    key_raw = f"{mode}:{source_code}:{destination_code}:{travel_date or ''}"
    route_key = hashlib.sha256(key_raw.encode()).hexdigest()
    now = timezone.now()

    live_result = None
    if getattr(settings, "LIVE_PROVIDERS_ENABLED", False) and usage.claim_provider():
        try:
            from apps.bookings.providers.registry import provider_registry

            params = {
                "origin": source_code,
                "destination": destination_code,
                "departureDate": travel_date.isoformat() if travel_date else "",
                "travellers": max((draft.adults or 1) + (draft.children or 0), 1),
            }
            rows = provider_registry.search(mode, params)
            rows = [row for row in rows if row.get("source") == "live_inventory"]
            if rows:
                live_result = _normalize_provider_row(rows[0], mode, fallback_level=1)
                JourneyRouteCache.objects.update_or_create(
                    route_key=route_key,
                    defaults={
                        "mode": mode,
                        "source_code": source_code,
                        "destination_code": destination_code,
                        "travel_date": travel_date,
                        "options": rows[:5],
                        "provenance": "live_provider",
                        "freshness": "live",
                        "source_name": (rows[0].get("provenance") or {}).get("label", "live_provider"),
                        "as_of": now,
                        "expires_at": now + timedelta(minutes=15),
                    },
                )
        except Exception as exc:
            trace.add("provider_failure", mode=mode, error=type(exc).__name__)
    if live_result:
        return live_result

    cached = JourneyRouteCache.objects.filter(route_key=route_key, is_deleted=False).first()
    if cached and cached.options:
        stale = cached.expires_at <= now
        row = cached.options[0]
        result = _normalize_provider_row(row, mode, fallback_level=4 if stale else 2)
        result.update(evidence(
            provenance="cached_provider",
            freshness="stale" if stale else "fresh",
            availability="unverified" if stale else result["booking_availability"],
            source_name=cached.source_name,
            as_of=cached.as_of,
            expires_at=cached.expires_at,
            confidence=0.45 if stale else 0.8,
            verification_action="verify_route",
        ))
        return result

    db_route = _database_route(mode, source_hub, destination_hub)
    if db_route:
        return {
            "duration_mins": db_route.duration_mins,
            "estimated_cost": None,
            "fallback_level": 3,
            **evidence(
                provenance="verified_database",
                freshness="unknown",
                availability="unverified",
                source_name=db_route.__class__.__name__,
                confidence=0.7,
                verification_action="verify_live_availability",
            ),
        }

    # Infrastructure proves the hubs exist, not that a dated service exists.
    return {
        "duration_mins": None,
        "estimated_cost": None,
        "fallback_level": 5,
        **evidence(
            provenance="estimated",
            freshness="unknown",
            availability="unverified",
            source_name="hub_geometry",
            confidence=0.35,
            verification_action="search_live_options",
        ),
    }


def _database_route(mode, source_hub, destination_hub):
    if mode == "flight":
        from apps.reference.models import AirportRoute
        return AirportRoute.objects.filter(source=source_hub, destination=destination_hub).order_by("duration_mins").first()
    from apps.reference.models import TrainRoute
    return TrainRoute.objects.filter(source=source_hub, destination=destination_hub).order_by("duration_mins").first()


def _normalize_provider_row(row, mode, fallback_level):
    price = None
    providers = row.get("providers") or []
    if providers:
        price = providers[0].get("price")
    availability = "available" if (row.get("is_active") is True) else "unverified"
    return {
        "duration_mins": _parse_duration(row.get("duration")),
        "estimated_cost": price,
        "fallback_level": fallback_level,
        **evidence(
            provenance="live_provider",
            freshness="live",
            availability=availability,
            source_name=(row.get("provenance") or {}).get("label", mode),
            as_of=timezone.now(),
            confidence=0.95,
            verification_action=None if availability == "available" else "verify_live_availability",
        ),
    }


def _scheduled_option(draft, mode, source_city, destination_city, source_hub, destination_hub, first_mile, last_mile, route, score, components=None):
    journey_id = hashlib.sha256(
        f"{draft.workspace_id}:{mode}:{_hub_code(source_hub)}:{_hub_code(destination_hub)}".encode()
    ).hexdigest()[:16]
    segments = []
    if first_mile > 5:
        segments.append(_road_segment(journey_id, len(segments), "first_mile", source_city.name, _hub_name(source_hub), first_mile, "cab"))
    segments.append({
        "journey_id": journey_id,
        "segment_index": len(segments),
        "segment_role": "mainline",
        "mode": mode,
        "origin": source_city.name,
        "destination": destination_city.name,
        "resolved_source": _hub_payload(source_hub, first_mile),
        "resolved_destination": _hub_payload(destination_hub, last_mile),
        **route,
    })
    if last_mile > 5:
        connector_mode = "self_drive" if _self_drive_ready(draft) else "cab"
        segments.append(_road_segment(journey_id, len(segments), "last_mile", _hub_name(destination_hub), destination_city.name, last_mile, connector_mode))
    return {
        "id": journey_id,
        "mode": mode,
        "feasible": True,
        "requires_verification": route["booking_availability"] != "available",
        "planning_suitability": {
            "score": score,
            "reasons": _suitability_reasons(draft, mode, first_mile + last_mile),
            "components": components or {}
        },
        "booking_availability": route["booking_availability"],
        **{
            key: route.get(key)
            for key in (
                "provenance", "freshness", "source_name", "as_of", "expires_at",
                "confidence", "verification_action",
            )
        },
        "segments": segments,
    }


def _resolve_road_mode(draft, source_city, destination_city, mode, trace):
    source, dest = _coords(source_city), _coords(destination_city)
    if not source or not dest:
        return None
    distance = round(haversine_distance_km(*source, *dest) * 1.25, 1)
    duration_mins = max(int(distance / 55 * 60), 30)
    self_drive_ready = _self_drive_ready(draft)
    mobility = (draft.metadata or {}).get("mobility") or {}
    max_daily_hours = int(mobility.get("max_driving_hours") or 6)
    if mode == "cab":
        feasible = distance <= 1500 and duration_mins <= 24 * 60
    else:
        # A single self-drive leg must fit a defensible daylight-scale route;
        # longer journeys require an explicit overnight road-trip structure.
        feasible = self_drive_ready and distance <= max(450, max_daily_hours * 75)
    if mode == "self_drive" and not self_drive_ready:
        reasons = ["Confirm driving readiness before self-drive can be recommended"]
    else:
        reasons = _suitability_reasons(draft, mode, 0)
    score = _suitability_score(draft, mode, 0, {"duration_mins": duration_mins, "booking_availability": "unverified"})
    if mode == "self_drive" and not self_drive_ready:
        score = min(score, 35.0)
    if not feasible:
        score = min(score, 25.0)
        reasons.append("road distance or driving-time limit makes this option unsuitable")
    journey_id = hashlib.sha256(f"{draft.workspace_id}:{mode}:road".encode()).hexdigest()[:16]
    trace.add("journey_candidate", mode=mode, distance_km=distance, planning_suitability=score, booking_availability="unverified")
    return {
        "id": journey_id,
        "mode": mode,
        "feasible": feasible,
        "requires_verification": True,
        "planning_suitability": {"score": score, "reasons": reasons},
        "booking_availability": "unverified",
        **evidence(
            provenance="estimated", freshness="unknown", availability="unverified",
            source_name="road_geometry", as_of=timezone.now(), confidence=0.55,
            verification_action="verify_road_route",
        ),
        "needs_questions": _self_drive_questions(draft) if mode == "self_drive" else [],
        "segments": [_road_segment(journey_id, 0, "mainline", source_city.name, destination_city.name, distance, mode, duration_mins)],
    }


def _resolve_bus_mode(draft, source_city, destination_city, usage, trace):
    road = _resolve_road_mode(draft, source_city, destination_city, "cab", trace)
    if not road:
        return None
    road["mode"] = "bus"
    road["id"] = hashlib.sha256(f"{draft.workspace_id}:bus:road".encode()).hexdigest()[:16]
    road["planning_suitability"]["score"] = min(80.0, road["planning_suitability"]["score"] + 5)
    road["segments"][0].update({"journey_id": road["id"], "mode": "bus"})
    return road


def _road_segment(journey_id, index, role, origin, destination, distance, mode, duration_mins=None):
    duration_mins = duration_mins or max(int(distance / 45 * 60), 10)
    return {
        "journey_id": journey_id,
        "segment_index": index,
        "segment_role": role,
        "mode": mode,
        "origin": origin,
        "destination": destination,
        "distance_km": distance,
        "duration_mins": duration_mins,
        "requires_verification": True,
        **evidence(
            provenance="estimated",
            freshness="unknown",
            availability="unverified",
            source_name="road_geometry",
            confidence=0.55,
            verification_action="verify_road_route",
        ),
    }


def _suitability_score(draft, mode, connector_km, route):
    preferred = str((draft.metadata or {}).get("preferred_mode") or "").lower()
    score = 55.0
    if mode == preferred:
        score += 25
    if route.get("booking_availability") == "available":
        score += 10
    elif route.get("booking_availability") == "unverified":
        score -= 5
    score -= min(connector_km / 10, 20)
    duration = route.get("duration_mins")
    if duration and duration > 12 * 60:
        score -= 15
    return round(max(0.0, min(score, 100.0)), 1)


def _suitability_reasons(draft, mode, connector_km):
    reasons = []
    preferred = str((draft.metadata or {}).get("preferred_mode") or "").lower()
    if mode == preferred:
        reasons.append("matches your selected transport preference")
    if connector_km:
        reasons.append(f"uses {round(connector_km, 1)} km of road connectors to viable hubs")
    if mode in {"train", "bus"}:
        reasons.append("lower-emission scheduled transport")
    return reasons or ["feasible door-to-door option"]


def _self_drive_ready(draft):
    mobility = (draft.metadata or {}).get("mobility") or {}
    return mobility.get("can_drive") is True and mobility.get("license_ready") is True


def _self_drive_questions(draft):
    mobility = (draft.metadata or {}).get("mobility") or {}
    if mobility.get("can_drive") is not True:
        return ["self_drive_openness"]
    if mobility.get("license_ready") is not True or not mobility.get("vehicle_access"):
        return ["self_drive_readiness"]
    if mobility.get("max_driving_hours") is None:
        return ["self_drive_route_comfort"]
    return []


def _hub_code(hub):
    return str(
        getattr(hub, "primary_code", None)
        or getattr(hub, "iata_code", None)
        or getattr(hub, "code", None)
        or hub.pk
    )


def _hub_name(hub):
    code = _hub_code(hub)
    return f"{hub.name} ({code})"


def _hub_payload(hub, connector_km):
    coords = _coords(hub)
    return {
        "id": str(hub.pk),
        "name": hub.name,
        "code": _hub_code(hub),
        "type": getattr(hub, "hub_type", None) or ("airport" if hasattr(hub, "iata_code") else "railway_station"),
        "latitude": coords[0] if coords else None,
        "longitude": coords[1] if coords else None,
        "connector_distance_km": round(connector_km, 1),
    }


def _parse_duration(value):
    if isinstance(value, (int, float)):
        return int(value)
    if not value:
        return None
    import re
    hours = re.search(r"(\d+)\s*h", str(value), re.I)
    mins = re.search(r"(\d+)\s*m", str(value), re.I)
    if not hours and not mins:
        return None
    return (int(hours.group(1)) * 60 if hours else 0) + (int(mins.group(1)) if mins else 0)
