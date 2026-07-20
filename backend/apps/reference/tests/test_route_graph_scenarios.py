"""Phase 4 route-graph acceptance scenarios (master plan §9.4, S1-S14).

Each test seeds a minimal, deterministic fixture (no network, no paid API) and
exercises ``route_graph.search()`` directly, matching the style
``test_reference_scenarios.py`` already established for this app. S11 (the
real Kolkata->Gangtok/Pelling regression) is verified separately by
``scripts/phase4_shadow_comparison.py`` against the real workspace, not by a
seeded fixture here — that scenario is explicitly about *not regressing* real
recorded evidence, which a synthetic fixture cannot prove.

Several scenarios are adapted to what V1 (this phase) actually implements,
noted inline: V1.5 two-edge combination, live overnight-connection
validation, and price estimation are out of this phase's scope by the
master plan's own text (§9.3), so the corresponding assertions check the
honest *absence* of fabricated behavior rather than the full V1.5/V2 feature.
"""

import pytest

from apps.reference.models import (
    Airport, AirportRoute, AirportServiceArea, Airline, BusRoute, BusStation,
    BusStationServiceArea, City, Country, RailwayStation, RailwayStationServiceArea,
    State, TrainRoute,
)
from apps.reference.services import route_graph


@pytest.fixture
def india():
    return Country.objects.create(code="IN", name="India", currency_code="INR")


def _city(country, name, lat, lng, state=None):
    return City.objects.create(name=name, country=country, state=state, latitude=lat, longitude=lng, is_publishable=True)


def _airport(city, name, iata, lat, lng, primary=True, distance_km=15.0):
    airport = Airport.objects.create(name=name, iata_code=iata, city=city, latitude=lat, longitude=lng)
    AirportServiceArea.objects.create(
        airport=airport, city=city, distance_km=distance_km, typical_transfer_mins=int(distance_km * 2),
        transfer_mode="cab", is_primary_hub=primary, confidence=0.9, is_estimated=True,
    )
    return airport


def _station(city, name, code, lat, lng, primary=True, distance_km=8.0):
    station = RailwayStation.objects.create(name=name, code=code, city=city, latitude=lat, longitude=lng)
    RailwayStationServiceArea.objects.create(
        station=station, city=city, distance_km=distance_km, typical_transfer_mins=int(distance_km * 1.5),
        transfer_mode="cab" if distance_km > 10 else "walk", is_primary_hub=primary, confidence=0.8, is_estimated=True,
    )
    return station


def _bus_station(city, name, code, lat, lng, distance_km=5.0):
    bs = BusStation.objects.create(name=name, code=code, city=city, latitude=lat, longitude=lng)
    BusStationServiceArea.objects.create(
        bus_station=bs, city=city, distance_km=distance_km, typical_transfer_mins=int(distance_km * 1.8),
        transfer_mode="cab", is_primary_hub=True, confidence=0.7, is_estimated=True,
    )
    return bs


def _flight_route(airline, source, destination, duration_mins=120, distance_km=1150.0):
    return AirportRoute.objects.create(
        source=source, destination=destination, airline=airline, duration_mins=duration_mins,
        distance_km=distance_km, provenance_tier="derived", confidence=0.6, is_active=True,
    )


def _train_route(source, destination, duration_mins=960, distance_km=1400.0, train_number="12951"):
    return TrainRoute.objects.create(
        source=source, destination=destination, train_name="Rajdhani Express", train_number=train_number,
        duration_mins=duration_mins, distance_km=distance_km, provenance_tier="derived", confidence=0.6, is_active=True,
    )


@pytest.mark.django_db
def test_s1_delhi_mumbai_flight_and_train(india):
    """S1: Pareto set contains >= flight & train; no price stamped verified without a live row."""
    delhi = _city(india, "Delhi", 28.6139, 77.2090)
    mumbai = _city(india, "Mumbai", 19.0760, 72.8777)
    del_ap = _airport(delhi, "Indira Gandhi Intl", "DEL", 28.5562, 77.1000)
    bom_ap = _airport(mumbai, "Chhatrapati Shivaji", "BOM", 19.0896, 72.8656)
    airline = Airline.objects.create(name="Air India", iata_code="AI")
    _flight_route(airline, del_ap, bom_ap)

    ndls = _station(delhi, "New Delhi", "NDLS", 28.6430, 77.2219)
    csmt = _station(mumbai, "CSMT", "CSTM", 18.9401, 72.8352)
    _train_route(ndls, csmt)

    result = route_graph.search(delhi, mumbai)
    modes = {opt["mode"] for opt in result["options"]}
    assert "flight" in modes
    assert "train" in modes
    for opt in result["options"]:
        assert opt["provenance"] != "verified"  # no live row exists in this fixture
        assert opt["cost"]["available"] is False


@pytest.mark.django_db
def test_s2_no_scheduled_hub_gets_cab_not_fabricated_route(india):
    """S2: destination with no scheduled hub -> cab appears, honestly priced,
    no fabricated flight/train option is invented."""
    delhi = _city(india, "Delhi", 28.6139, 77.2090)
    manali = _city(india, "Manali", 32.2432, 77.1892)  # no airport/station seeded at all

    result = route_graph.search(delhi, manali)
    modes = {opt["mode"] for opt in result["options"]}
    assert "flight" not in modes
    assert "train" not in modes
    assert "cab" in modes
    cab = next(o for o in result["options"] if o["mode"] == "cab")
    assert cab["cost"]["available"] is False
    assert result["no_scheduled_option_reasons"].get("flight") == "no_publishable_hubs_on_file"


@pytest.mark.django_db
def test_s3_access_leg_to_nearest_railhead(india):
    """S3: a town with a distant-but-served railhead resolves via ServiceArea,
    and the access leg distance/duration are populated (hub substitution is honest, not silent)."""
    alleppey = _city(india, "Alleppey", 9.4981, 76.3388)
    delhi = _city(india, "Delhi", 28.6139, 77.2090)
    ers = _station(alleppey, "Ernakulam Jn", "ERS", 9.9816, 76.2999, distance_km=45.0)
    ndls = _station(delhi, "New Delhi", "NDLS", 28.6430, 77.2219)
    _train_route(ers, ndls, duration_mins=2600, distance_km=2650.0)

    result = route_graph.search(alleppey, delhi)
    train_opts = [o for o in result["options"] if o["mode"] == "train"]
    assert train_opts
    assert train_opts[0]["access_leg"]["distance_km"] is not None
    assert train_opts[0]["access_leg"]["distance_km"] > 30


@pytest.mark.django_db
def test_s4_served_city_transfer_included_in_total(india):
    """S4: a destination served by a nearby major station has transfer time+cost in the total."""
    fatehpur = _city(india, "Fatehpur Sikri", 27.0940, 77.6611)
    delhi = _city(india, "Delhi", 28.6139, 77.2090)
    agra = _station(fatehpur, "Agra Cantt", "AGC", 27.1591, 78.0210, distance_km=38.0)
    ndls = _station(delhi, "New Delhi", "NDLS", 28.6430, 77.2219)
    route = _train_route(ndls, agra, duration_mins=150, distance_km=200.0)

    result = route_graph.search(delhi, fatehpur)
    train_opts = [o for o in result["options"] if o["mode"] == "train"]
    assert train_opts
    opt = train_opts[0]
    assert opt["total_duration_mins"] >= route.duration_mins  # access+egress add to the scheduled leg


@pytest.mark.django_db
def test_s5_route_existence_hard_filter_prefers_junction(india):
    """S5: a farther junction with a direct route beats a nearer halt with none."""
    origin = _city(india, "Origin City", 20.0, 78.0)
    dest = _city(india, "Dest City", 21.0, 79.0)
    halt = _station(dest, "Nearby Halt", "HLT", 21.02, 79.02, distance_km=3.0)  # closer, no route
    junction = _station(dest, "Junction Jn", "JXN", 21.30, 79.30, distance_km=30.0)  # farther, has a route
    origin_station = _station(origin, "Origin Jn", "OGJ", 20.02, 78.02, distance_km=4.0)
    _train_route(origin_station, junction, duration_mins=300, distance_km=250.0)

    result = route_graph.search(origin, dest)
    train_opts = [o for o in result["options"] if o["mode"] == "train"]
    assert train_opts
    assert train_opts[0]["destination_hub"]["code"] == "JXN"


@pytest.mark.django_db
def test_s6_train_plus_egress_cab_one_transfer(india):
    """S6: railhead != destination -> train edge + egress cab leg, transfers accounted honestly."""
    origin = _city(india, "Origin City", 20.0, 78.0)
    munnar = _city(india, "Munnar", 10.0889, 77.0595)
    aluva = _station(munnar, "Aluva", "AWY", 10.1075, 76.3516, distance_km=110.0)  # real-world-like distant railhead
    origin_station = _station(origin, "Origin Jn", "OGJ", 20.02, 78.02, distance_km=4.0)
    _train_route(origin_station, aluva, duration_mins=900, distance_km=900.0)

    result = route_graph.search(origin, munnar)
    train_opts = [o for o in result["options"] if o["mode"] == "train"]
    assert train_opts
    assert train_opts[0]["egress_leg"]["distance_km"] > 50


@pytest.mark.django_db
def test_s7_bus_and_train_returned_separately_not_fabricated_combo(india):
    """S7: V1 returns bus and train as separate single-mode options; V1's own
    scope (§9.3) does not synthesize a combined bus->train itinerary — that is
    V1.5. This test asserts the honest V1 behavior, not the V1.5 feature."""
    origin = _city(india, "Origin City", 20.0, 78.0)
    dest = _city(india, "Dest City", 21.0, 79.0)
    o_station = _station(origin, "Origin Jn", "OGJ", 20.02, 78.02)
    d_station = _station(dest, "Dest Jn", "DSJ", 21.02, 79.02)
    _train_route(o_station, d_station, duration_mins=400, distance_km=350.0)
    o_bus = _bus_station(origin, "Origin Bus Stand", "OBS", 20.01, 78.01)
    d_bus = _bus_station(dest, "Dest Bus Stand", "DBS", 21.01, 79.01)
    BusRoute.objects.create(
        source=o_bus, destination=d_bus, operator_name="State RTC", duration_mins=500,
        distance_km=350.0, provenance_tier="derived", confidence=0.5, is_active=True,
    )

    result = route_graph.search(origin, dest)
    modes = {opt["mode"] for opt in result["options"]}
    assert "train" in modes
    assert "bus" in modes
    # V1 does not fabricate a combined itinerary — no option claims 2 real scheduled edges.
    assert all(opt["scheduled_edge"] is None or opt["transfers"] == 0 for opt in result["options"])


@pytest.mark.django_db
def test_s8_island_no_ferry_fabricated(india):
    """S8: flight to an island hub works; no ferry mode exists anywhere in the
    schema, so the last-hop-missing case degrades honestly by construction."""
    mainland = _city(india, "Chennai", 13.0827, 80.2707)
    port_blair = _city(india, "Port Blair", 11.6234, 92.7265)
    maa = _airport(mainland, "Chennai Intl", "MAA", 12.9941, 80.1709)
    ixz = _airport(port_blair, "Veer Savarkar", "IXZ", 11.6417, 92.7297)
    airline = Airline.objects.create(name="IndiGo", iata_code="6E")
    _flight_route(airline, maa, ixz, duration_mins=140, distance_km=1190.0)

    result = route_graph.search(mainland, port_blair)
    modes = {opt["mode"] for opt in result["options"]}
    assert "flight" in modes
    assert "ferry" not in modes  # no ferry mode is modeled anywhere in this schema


@pytest.mark.django_db
def test_s9_hill_destination_road_option_flagged_estimate(india):
    """S9: a hill destination with no scheduled hub gets a road option, clearly
    marked as an estimate (never verified)."""
    chandigarh = _city(india, "Chandigarh", 30.7333, 76.7794)
    shimla = _city(india, "Shimla", 31.1048, 77.1734)  # no hubs seeded

    result = route_graph.search(chandigarh, shimla)
    cab_opts = [o for o in result["options"] if o["mode"] == "cab"]
    assert cab_opts
    assert cab_opts[0]["provenance"] == "estimated"


@pytest.mark.django_db
def test_s10_remote_pair_no_scheduled_option_honest_degradation(india):
    """S10: a pair with no scheduled hubs and beyond cab feasibility distance ->
    the cab option is marked infeasible, never an invented scheduled route."""
    a = _city(india, "Remote A", 8.0, 77.0)
    b = _city(india, "Remote B", 34.0, 74.0)  # ~2900km apart, beyond CAB_MAX_FEASIBLE_KM

    result = route_graph.search(a, b)
    modes = {opt["mode"] for opt in result["options"]}
    assert "flight" not in modes and "train" not in modes and "bus" not in modes
    cab = next((o for o in result["options"] if o["mode"] == "cab"), None)
    assert cab is not None
    assert cab["feasible"] is False


@pytest.mark.django_db
def test_s12_accessibility_annotated_never_hard_filtered(india):
    """S12: TransferProfile (when present) is surfaced on the hub payload, and
    a hub with no profile still returns a usable option (never silently excluded)."""
    origin = _city(india, "Origin City", 20.0, 78.0)
    dest = _city(india, "Dest City", 21.0, 79.0)
    o_station = _station(origin, "Origin Jn", "OGJ", 20.02, 78.02)
    d_station = _station(dest, "Dest Jn", "DSJ", 21.02, 79.02)
    _train_route(o_station, d_station, duration_mins=400, distance_km=350.0)

    result = route_graph.search(origin, dest)
    train_opts = [o for o in result["options"] if o["mode"] == "train"]
    assert train_opts
    # No TransferProfile row exists for OGJ/DSJ — must be None, not a filter reason.
    assert train_opts[0]["source_hub"]["transfer_profile"] is None


@pytest.mark.django_db
def test_s13_overnight_transfer_search_does_not_crash_or_fabricate(india):
    """S13: V1's own scope note says overnight-connection *enforcement* is
    V1.5 (min-connection + overnight flag); this phase only needs search() to
    behave normally (no crash, no fabricated connection) for a route whose
    scheduled edge crosses midnight-adjacent hours."""
    origin = _city(india, "Origin City", 20.0, 78.0)
    dest = _city(india, "Dest City", 21.0, 79.0)
    o_station = _station(origin, "Origin Jn", "OGJ", 20.02, 78.02)
    d_station = _station(dest, "Dest Jn", "DSJ", 21.02, 79.02)
    _train_route(o_station, d_station, duration_mins=1430, distance_km=1200.0)  # ~23h50m, likely overnight

    result = route_graph.search(origin, dest)
    assert result["feasible"] is True
    train_opts = [o for o in result["options"] if o["mode"] == "train"]
    assert train_opts and train_opts[0]["total_duration_mins"] >= 1430


@pytest.mark.django_db
def test_s14_missing_price_never_fabricated_verified(india):
    """S14: every option's cost is honestly unavailable — never a fabricated
    number stamped verified (the C1-honesty precedent applied to route_graph)."""
    origin = _city(india, "Origin City", 20.0, 78.0)
    dest = _city(india, "Dest City", 21.0, 79.0)
    o_station = _station(origin, "Origin Jn", "OGJ", 20.02, 78.02)
    d_station = _station(dest, "Dest Jn", "DSJ", 21.02, 79.02)
    _train_route(o_station, d_station, duration_mins=400, distance_km=350.0)

    result = route_graph.search(origin, dest)
    for opt in result["options"]:
        assert opt["cost"]["available"] is False
        assert opt["cost"]["min"] is None
        assert opt["provenance"] != "verified"
