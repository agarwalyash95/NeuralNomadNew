import pytest

from apps.reference.services.canonical_resolver import calculate_distance
from apps.reference.services.geo import bounding_box, haversine_km, is_placeholder, valid_coordinates
from apps.reference.services.places_explore import haversine


def test_known_city_pair_distance_and_compatibility_wrappers():
    # Straight-line Delhi ↔ Mumbai distance is approximately 1,153 km.
    distance = haversine_km(28.6139, 77.2090, 19.0760, 72.8777)
    assert distance == pytest.approx(1153.0, rel=0.005)
    assert calculate_distance(28.6139, 77.2090, 19.0760, 72.8777) == distance
    assert haversine(28.6139, 77.2090, 19.0760, 72.8777) == distance


def test_bounding_box_accounts_for_latitude():
    equator = bounding_box(0, 0, 50)
    high_latitude = bounding_box(60, 0, 50)
    equator_lng_width = equator[3] - equator[2]
    high_latitude_lng_width = high_latitude[3] - high_latitude[2]
    assert high_latitude_lng_width > equator_lng_width * 1.9


def test_coordinate_validation_and_placeholder_detection():
    assert valid_coordinates(90, 180)
    assert not valid_coordinates(91, 0)
    assert not valid_coordinates(None, 0)
    assert is_placeholder(20.5937, 78.9629)
    assert not is_placeholder(20.6, 78.9629)
