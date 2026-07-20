import pytest
from django.core.management import call_command
from apps.reference.models import City, CityAlias, MetroArea, MetroAreaCity, Country, RailwayStation, TrainRoute
from apps.reference.services.canonical_resolver import resolve_canonical_city, resolve_canonical_metro
from apps.reference.services.station_selector import select_optimal_hubs

@pytest.mark.django_db
def test_canonical_city_resolutions():
    # Setup test cities and aliases
    india = Country.objects.create(code="IN", name="India", currency_code="INR")
    
    mumbai = City.objects.create(name="Mumbai", country=india, normalized_name="mumbai")
    CityAlias.objects.create(city=mumbai, alias_name="Bombay", alias_type="old", verification_status="verified")
    
    bengaluru = City.objects.create(name="Bengaluru", country=india, normalized_name="bengaluru")
    CityAlias.objects.create(city=bengaluru, alias_name="Bangalore", alias_type="common", verification_status="verified")
    
    gurugram = City.objects.create(name="Gurugram", country=india, normalized_name="gurugram")
    CityAlias.objects.create(city=gurugram, alias_name="Gurgaon", alias_type="common", verification_status="verified")
    
    noida = City.objects.create(name="Noida", country=india, normalized_name="noida")

    # Assert Bombay -> Mumbai
    assert resolve_canonical_city("Bombay") == mumbai
    assert resolve_canonical_city("Mumbai") == mumbai

    # Assert Bangalore -> Bengaluru
    assert resolve_canonical_city("Bangalore") == bengaluru
    assert resolve_canonical_city("Bengaluru") == bengaluru

    # Assert Gurgaon -> Gurugram
    assert resolve_canonical_city("Gurgaon") == gurugram
    assert resolve_canonical_city("Gurugram") == gurugram

    # Assert Noida resolves as a separate city
    assert resolve_canonical_city("Noida") == noida
    assert resolve_canonical_city("Noida") != delhi_alias_if_exists()

def delhi_alias_if_exists():
    return None

@pytest.mark.django_db
def test_metro_area_resolution():
    india = Country.objects.create(code="IN", name="India", currency_code="INR")
    delhi = City.objects.create(name="New Delhi", country=india, normalized_name="new delhi")
    gurugram = City.objects.create(name="Gurugram", country=india, normalized_name="gurugram")
    
    ncr = MetroArea.objects.create(name="Delhi NCR", country=india, primary_city=delhi)
    MetroAreaCity.objects.create(metro_area=ncr, city=delhi, membership_type="core", is_primary=True)
    MetroAreaCity.objects.create(metro_area=ncr, city=gurugram, membership_type="satellite")

    # Assert Delhi NCR resolves correctly
    resolved_metro = resolve_canonical_metro("Delhi NCR", india)
    assert resolved_metro == ncr
    assert resolved_metro.primary_city == delhi
    assert ncr.member_cities.filter(city=gurugram).exists()

@pytest.mark.django_db
def test_station_selector_route_eligibility():
    india = Country.objects.create(code="IN", name="India", currency_code="INR")
    city_a = City.objects.create(name="City A", country=india)
    city_b = City.objects.create(name="City B", country=india)

    station_a = RailwayStation.objects.create(
        name="Station A", code="STA", city=city_a, latitude=28.6139, longitude=77.2090
    )
    station_b = RailwayStation.objects.create(
        name="Station B", code="STB", city=city_b, latitude=19.0760, longitude=72.8777
    )

    # 1. No routes seeded -> select_optimal_hubs should return empty/no eligibility
    sel = select_optimal_hubs("train", city_a, city_b)
    assert not sel.get("recommended")

    # 2. Add route -> select_optimal_hubs should resolve it
    route = TrainRoute.objects.create(source=station_a, destination=station_b, train_name="Express", train_number="123", duration_mins=120)
    sel2 = select_optimal_hubs("train", city_a, city_b)
    assert sel2["recommended"]["origin_code"] == "STA"
    assert sel2["recommended"]["destination_code"] == "STB"
    assert "STA->STB" in sel2["score_breakdown"]
