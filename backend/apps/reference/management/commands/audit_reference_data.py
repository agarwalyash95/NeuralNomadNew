import json
from collections import defaultdict

from django.core.management.base import BaseCommand
from django.db.models import Q

from apps.reference.models import (
    ActivityMaster,
    Airport,
    AirportRoute,
    AirportServiceArea,
    AttractionMaster,
    BusRoute,
    BusStation,
    BusStationServiceArea,
    City,
    CityAlias,
    HotelMaster,
    MetroArea,
    MetroAreaCity,
    MetroStation,
    ProviderEntityMap,
    RailwayStation,
    RailwayStationServiceArea,
    RestaurantMaster,
    StagingRecord,
    TrainRoute,
    TravelPriceHistory,
)
from apps.reference.services.geo import haversine_km, is_placeholder, valid_coordinates
from apps.reference.services.provenance import is_publishable_instance
from django.contrib.contenttypes.models import ContentType

DUPLICATE_DISTANCE_KM = 5.0
TOP_N_CITIES_FOR_DEMAND_PROXY = 20


def _report_5_missing_hub_mappings():
    """Report 5: publishable cities with no ServiceArea row at all, per mode."""
    cities = City.objects.filter(is_publishable=True)
    total = cities.count()
    rail_covered = set(RailwayStationServiceArea.objects.values_list("city_id", flat=True).distinct())
    air_covered = set(AirportServiceArea.objects.values_list("city_id", flat=True).distinct())
    bus_covered = set(BusStationServiceArea.objects.values_list("city_id", flat=True).distinct())
    city_ids = set(cities.values_list("id", flat=True))
    return {
        "metric": "publishable cities with zero ServiceArea rows, per mode",
        "denominator": total,
        "rail_missing": len(city_ids - rail_covered),
        "air_missing": len(city_ids - air_covered),
        "bus_missing": len(city_ids - bus_covered),
        "rail_radius_km": 80, "air_radius_km": 120, "bus_radius_km": 40,
    }


def _report_6_missing_road_connectors():
    """Report 6: G6-G9 curated destination pairs with no road-feasibility record.
    G6-G9 curated fixtures are explicit Phase 6 scope (master plan §14) — this
    report is wired and will read real numbers once City.destination_tags is
    populated. Reporting 0/0 today is honest, not a placeholder fabrication."""
    tagged_count = City.objects.exclude(destination_tags={}).count()
    return {
        "metric": "G6-G9 curated destination pairs with no cab/self-drive feasibility record",
        "status": "not yet measurable — G6-G9 curated fixtures are Phase 6 scope",
        "cities_with_any_destination_tag": tagged_count,
    }


def _report_7_missing_transport_routes():
    """Report 7: top-N-by-population city pairs (a population-based demand
    PROXY — not real search/booking volume, which doesn't exist) with no
    scheduled route in any mode."""
    from apps.reference.services import route_graph

    top_cities = list(City.objects.filter(population__isnull=False).order_by("-population")[:TOP_N_CITIES_FOR_DEMAND_PROXY])
    total_pairs = 0
    pairs_with_route = 0
    unresolved_pairs = []
    for i in range(len(top_cities)):
        for j in range(i + 1, len(top_cities)):
            a, b = top_cities[i], top_cities[j]
            total_pairs += 1
            result = route_graph.search(a, b)
            has_scheduled = any(opt["mode"] in ("flight", "train", "bus") for opt in result["options"])
            if has_scheduled:
                pairs_with_route += 1
            else:
                unresolved_pairs.append(f"{a.name} <-> {b.name}")
    return {
        "metric": "top-N-by-population city pairs (population proxy, NOT real demand data) with >=1 scheduled route",
        "denominator_note": "population-based proxy computed live from City.population; not a frozen official demand list",
        "cities_considered": len(top_cities),
        "total_pairs": total_pairs,
        "pairs_with_scheduled_route": pairs_with_route,
        "coverage_fraction": round(pairs_with_route / total_pairs, 4) if total_pairs else 0.0,
        "unresolved_pairs_sample": unresolved_pairs[:20],
    }


def _report_3_duplicate_candidates():
    """Report 3: same normalized name + <5km distance, grouped by state."""
    by_normalized_name = defaultdict(list)
    for city in City.objects.select_related("state", "country").only(
        "id", "name", "normalized_name", "latitude", "longitude", "state", "country"
    ):
        key = city.normalized_name or ""
        if key:
            by_normalized_name[key].append(city)

    pairs = []
    for norm_name, cities in by_normalized_name.items():
        if len(cities) < 2:
            continue
        for i in range(len(cities)):
            for j in range(i + 1, len(cities)):
                a, b = cities[i], cities[j]
                if not (valid_coordinates(a.latitude, a.longitude) and valid_coordinates(b.latitude, b.longitude)):
                    continue
                distance = haversine_km(a.latitude, a.longitude, b.latitude, b.longitude)
                if distance <= DUPLICATE_DISTANCE_KM:
                    pairs.append({
                        "normalized_name": norm_name,
                        "a": {"id": a.pk, "name": a.name, "state": a.state.name if a.state else None},
                        "b": {"id": b.pk, "name": b.name, "state": b.state.name if b.state else None},
                        "distance_km": round(distance, 3),
                    })
    return {
        "metric": "City rows sharing a normalized name within 5km of each other",
        "denominator": "publishable City rows",
        "count": len(pairs),
        "pairs": pairs,
    }


def _report_4_missing_aliases():
    """Report 4: publishable cities with zero CityAlias rows, per state."""
    cities_with_alias = set(CityAlias.objects.values_list("city_id", flat=True).distinct())
    by_state = defaultdict(int)
    total_missing = 0
    for city in City.objects.filter(is_publishable=True).select_related("state", "country").only(
        "id", "state", "country"
    ):
        if city.pk in cities_with_alias:
            continue
        total_missing += 1
        state_name = city.state.name if city.state else f"(no state — {city.country.code if city.country_id else 'unknown'})"
        by_state[state_name] += 1
    return {
        "metric": "publishable City rows with zero CityAlias rows",
        "denominator": "publishable City rows",
        "total_missing": total_missing,
        "by_state": dict(sorted(by_state.items())),
    }


def _report_8_unresolved_mappings():
    """Report 8: staging rows never resolved to a canonical entity, and
    canonical entities (City) with no source mapping at all."""
    from django.db.models import Count
    staging_by_status = {
        row["match_status"]: row["count"]
        for row in StagingRecord.objects.values("match_status").annotate(count=Count("id"))
    }
    city_content_type = ContentType.objects.filter(app_label="reference", model="city").first()
    cities_with_mapping = set()
    if city_content_type:
        cities_with_mapping = set(
            ProviderEntityMap.objects.filter(content_type=city_content_type).values_list("object_id", flat=True)
        )
    total_cities = City.objects.count()
    cities_no_mapping_no_geonameid = City.objects.filter(geonameid__isnull=True).exclude(
        pk__in=[int(pk) for pk in cities_with_mapping if pk.isdigit()]
    ).count()
    return {
        "metric": "staging rows not yet matched, and canonical entities with no source mapping",
        "staging_by_match_status": staging_by_status,
        "cities_total": total_cities,
        "cities_with_no_geonameid_and_no_provider_map": cities_no_mapping_no_geonameid,
    }


def _report_10_stale_google_entities():
    """Report 10 (Phase 6): rows across the four place-entity master tables
    that are Google-sourced (``source="google_places"``) and past their own
    ``enrichment_ttl_days`` — surfaced for visibility, never deleted/blocked.
    ``refresh_stale_entities`` (Celery beat, every 3h) is already the only
    writer of Google-sourced fields on these tables, so this report closes
    the plan's "flag stale Google fields" requirement without adding any new
    write path — the gap was visibility, not enforcement."""
    from django.utils import timezone

    now = timezone.now()
    by_entity = {}
    total_stale = 0
    for label, model in (
        ("hotels", HotelMaster), ("restaurants", RestaurantMaster),
        ("attractions", AttractionMaster), ("activities", ActivityMaster),
    ):
        google_rows = model.objects.filter(source="google_places")
        stale_count = 0
        never_enriched = 0
        for row in google_rows.only("last_enriched_at", "enrichment_ttl_days").iterator(chunk_size=2000):
            if row.last_enriched_at is None:
                never_enriched += 1
                continue
            if now >= row.last_enriched_at + timezone.timedelta(days=row.enrichment_ttl_days):
                stale_count += 1
        by_entity[label] = {
            "google_sourced_total": google_rows.count(),
            "stale": stale_count,
            "never_enriched": never_enriched,
        }
        total_stale += stale_count
    return {
        "metric": "Google-sourced rows past their own enrichment_ttl_days (never enforced, only surfaced)",
        "total_stale": total_stale,
        "by_entity": by_entity,
    }


ENTITY_SPECS = (
    ("cities", City),
    ("airports", Airport),
    ("railway_stations", RailwayStation),
    ("bus_stations", BusStation),
    ("metro_stations", MetroStation),
    ("hotels", HotelMaster),
    ("restaurants", RestaurantMaster),
    ("attractions", AttractionMaster),
    ("activities", ActivityMaster),
)


def _state_name(row):
    city = row if isinstance(row, City) else getattr(row, "city", None)
    state = getattr(city, "state", None) if city else None
    if state:
        return state.name
    country = getattr(city, "country", None) if city else None
    return f"(no state — {getattr(country, 'code', 'unknown')})"


def _reason_codes(row):
    latitude = getattr(row, "latitude", None)
    longitude = getattr(row, "longitude", None)
    reasons = []
    if latitude is None or longitude is None:
        reasons.append("no_coords")
    elif not valid_coordinates(latitude, longitude):
        reasons.append("out_of_range")
    elif is_placeholder(latitude, longitude):
        reasons.append("placeholder")
    if getattr(row, "is_quarantined", False) or getattr(row, "verification_status", None) == "quarantined":
        reasons.append("quarantined")
    if not str(getattr(row, "name", "") or "").strip():
        reasons.append("missing_identity")
    if isinstance(row, City) and not row.country_id:
        reasons.append("missing_identity")
    if hasattr(row, "iata_code") and not str(row.iata_code or "").strip():
        reasons.append("missing_identity")
    if hasattr(row, "code") and not str(row.code or "").strip():
        reasons.append("missing_identity")
    if hasattr(row, "place_id") and hasattr(row, "external_id"):
        if not str(row.place_id or row.external_id or "").strip():
            reasons.append("missing_identity")
    if isinstance(row, City) and not row.is_publishable and not reasons:
        reasons.append("publishability_flag_false")
    if not reasons and not is_publishable_instance(row):
        reasons.append("not_publishable")
    return sorted(set(reasons))


class Command(BaseCommand):
    help = "Audit reference data and emit Phase 2 coordinate coverage reports 1, 2, and 9."

    def add_arguments(self, parser):
        parser.add_argument("--json", action="store_true", help="Output report in JSON format")
        parser.add_argument(
            "--details",
            action="store_true",
            help="Include every non-publishable row with deterministic reason codes.",
        )
        parser.add_argument(
            "--full-reports",
            action="store_true",
            help="Include reports 5/6/7 (Phase 4). Report 7 runs a route_graph.search() "
                 "per top-city pair and is slower than the default 1/2/3/4/8/9 set.",
        )

    def handle(self, *args, **options):
        details = options["details"]
        missing_by_state = defaultdict(lambda: defaultdict(int))
        placeholder_by_state = defaultdict(lambda: defaultdict(int))
        non_publishable_by_state = defaultdict(lambda: defaultdict(int))
        out_of_range_by_state = defaultdict(lambda: defaultdict(int))
        entity_summaries = {}
        non_publishable_rows = []

        for label, model in ENTITY_SPECS:
            queryset = model.objects.select_related("city__state", "city__country") if model is not City else model.objects.select_related("state", "country")
            summary = {
                "total": 0,
                "missing_coordinates": 0,
                "placeholder_coordinates": 0,
                "out_of_range_coordinates": 0,
                "non_publishable": 0,
            }
            for row in queryset.iterator(chunk_size=2000):
                summary["total"] += 1
                state = _state_name(row)
                latitude = getattr(row, "latitude", None)
                longitude = getattr(row, "longitude", None)
                if latitude is None or longitude is None:
                    summary["missing_coordinates"] += 1
                    missing_by_state[state][label] += 1
                elif not valid_coordinates(latitude, longitude):
                    summary["out_of_range_coordinates"] += 1
                    out_of_range_by_state[state][label] += 1
                elif is_placeholder(latitude, longitude):
                    summary["placeholder_coordinates"] += 1
                    placeholder_by_state[state][label] += 1

                reasons = _reason_codes(row)
                if reasons:
                    summary["non_publishable"] += 1
                    non_publishable_by_state[state][label] += 1
                    if details:
                        non_publishable_rows.append(
                            {
                                "entity": label,
                                "id": row.pk,
                                "state": state,
                                "reasons": reasons,
                            }
                        )
            entity_summaries[label] = summary

        prices = TravelPriceHistory.objects.all()
        report = {
            **entity_summaries,
            "pricing": {
                "total": prices.count(),
                "negative_prices": prices.filter(price__lt=0).count(),
                "missing_provenance": prices.filter(provenance_tier__isnull=True).count(),
            },
            "metro_areas": {
                "total": MetroArea.objects.count(),
                "memberships": MetroAreaCity.objects.count(),
            },
            "coverage_reports": {
                "1_missing_coordinates": {
                    "metric": "rows where latitude OR longitude is null",
                    "denominator": "all rows in each coordinate-bearing reference model",
                    "phase_gate": "railway coordinate coverage >= 95%",
                    "by_state": {state: dict(values) for state, values in sorted(missing_by_state.items())},
                },
                "2_placeholder_coordinates": {
                    "metric": "rows matching a registered coordinate sentinel",
                    "denominator": "all rows in each coordinate-bearing reference model",
                    "phase_gate": "zero publishable centroid-placeholder cities",
                    "sentinels": [[20.5937, 78.9629]],
                    "by_state": {state: dict(values) for state, values in sorted(placeholder_by_state.items())},
                },
                "out_of_range_coordinates": {
                    "metric": "non-null latitude outside [-90,90] or longitude outside [-180,180]",
                    "country_bbox_status": "deferred: no approved country-bbox registry exists before Phase 3",
                    "by_state": {state: dict(values) for state, values in sorted(out_of_range_by_state.items())},
                },
                "9_non_publishable_entities": {
                    "metric": "rows failing coordinate, placeholder, quarantine, or identity gates",
                    "denominator": "all rows in each coordinate-bearing reference model",
                    "phase_gate": "all candidate paths consume publishable rows only",
                    "by_state": {state: dict(values) for state, values in sorted(non_publishable_by_state.items())},
                    "rows": non_publishable_rows if details else "use --details for the full reason-coded row list",
                },
                "3_duplicate_candidates": _report_3_duplicate_candidates(),
                "4_missing_aliases": _report_4_missing_aliases(),
                "8_unresolved_mappings": _report_8_unresolved_mappings(),
                "10_stale_google_entities": _report_10_stale_google_entities(),
            },
        }

        if options["full_reports"]:
            report["coverage_reports"]["5_missing_hub_mappings"] = _report_5_missing_hub_mappings()
            report["coverage_reports"]["6_missing_road_connectors"] = _report_6_missing_road_connectors()
            report["coverage_reports"]["7_missing_transport_routes"] = _report_7_missing_transport_routes()

        # Preserve the Phase 0 keys used by existing evidence consumers.
        report["cities"]["default_coordinates_india"] = report["cities"]["placeholder_coordinates"]
        report["cities"]["missing_timezone"] = City.objects.filter(timezone__isnull=True).count()
        report["airports"]["orphans"] = Airport.objects.filter(city__isnull=True).count()
        report["railway_stations"]["orphans"] = RailwayStation.objects.filter(city__isnull=True).count()
        report["bus_stations"]["orphans"] = BusStation.objects.filter(city__isnull=True).count()

        if options["json"]:
            self.stdout.write(json.dumps(report, indent=2, sort_keys=True))
            return

        self.stdout.write(self.style.MIGRATE_HEADING("=== REFERENCE DATA AUDIT REPORT ==="))
        for label, summary in entity_summaries.items():
            self.stdout.write(
                f"{label}: total={summary['total']} missing={summary['missing_coordinates']} "
                f"placeholder={summary['placeholder_coordinates']} "
                f"out_of_range={summary['out_of_range_coordinates']} "
                f"non_publishable={summary['non_publishable']}"
            )
        self.stdout.write("Reports 1, 2, and 9 include per-state counts in --json output.")
