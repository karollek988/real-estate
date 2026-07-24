"""Proximity framework Definition of Done: one shared distance/bucket/
inside-radius implementation, consumed identically by every provider."""

from __future__ import annotations

from location_intelligence.proximity import (
    RADIUS_BUCKETS,
    compute_proximity,
    enrich_finding,
    haversine_m,
    proximity_info,
    radius_bucket_for,
)
from tests.location_intelligence.conftest import make_finding

ORIGIN_LAT, ORIGIN_LON = 59.3435764, 18.0493643


class TestHaversine:
    def test_zero_distance_for_identical_points(self) -> None:
        assert haversine_m(ORIGIN_LAT, ORIGIN_LON, ORIGIN_LAT, ORIGIN_LON) == 0.0

    def test_known_distance_is_plausible(self) -> None:
        distance = haversine_m(59.0, 18.0, 60.0, 18.0)
        assert 110_000 < distance < 112_000


class TestRadiusBucketFor:
    def test_boundaries_are_exclusive_upper_bounds(self) -> None:
        assert radius_bucket_for(0) == "0-100m"
        assert radius_bucket_for(99.9) == "0-100m"
        assert radius_bucket_for(100) == "100-250m"
        assert radius_bucket_for(250) == "250-500m"
        assert radius_bucket_for(500) == "500-1000m"
        assert radius_bucket_for(1000) == "1000-3000m"
        assert radius_bucket_for(3000) == "3000-5000m"
        assert radius_bucket_for(5000) == "5000m+"
        assert radius_bucket_for(50_000) == "5000m+"

    def test_bucket_labels_match_public_standard(self) -> None:
        labels = [label for _, label in RADIUS_BUCKETS]
        assert labels == [
            "0-100m",
            "100-250m",
            "250-500m",
            "500-1000m",
            "1000-3000m",
            "3000-5000m",
        ]


class TestProximityInfo:
    def test_from_known_distance_rounds_and_buckets(self) -> None:
        info = proximity_info(59.35, 18.06, 123.456, requested_radius_m=1000)
        assert info.latitude == 59.35
        assert info.longitude == 18.06
        assert info.distance_m == 123.5
        assert info.radius_bucket == "100-250m"
        assert info.inside_requested_radius is True

    def test_outside_requested_radius_is_false_not_none(self) -> None:
        info = proximity_info(59.35, 18.06, 2000.0, requested_radius_m=1000)
        assert info.inside_requested_radius is False

    def test_no_requested_radius_leaves_inside_as_none(self) -> None:
        info = proximity_info(59.35, 18.06, 2000.0)
        assert info.inside_requested_radius is None

    def test_to_dict_has_the_five_standard_keys(self) -> None:
        info = proximity_info(59.35, 18.06, 50.0, requested_radius_m=100)
        assert info.to_dict() == {
            "latitude": 59.35,
            "longitude": 18.06,
            "distance_m": 50.0,
            "radius_bucket": "0-100m",
            "inside_requested_radius": True,
        }


class TestComputeProximity:
    def test_computes_distance_from_two_coordinate_pairs(self) -> None:
        # ~1000m north of origin.
        lat = ORIGIN_LAT + 0.009
        info = compute_proximity(ORIGIN_LAT, ORIGIN_LON, lat, ORIGIN_LON, requested_radius_m=1000)
        assert 950 < info.distance_m < 1050
        assert info.radius_bucket in ("500-1000m", "1000-3000m")

    def test_matches_proximity_info_given_the_same_distance(self) -> None:
        via_coords = compute_proximity(ORIGIN_LAT, ORIGIN_LON, ORIGIN_LAT + 0.001, ORIGIN_LON)
        distance = haversine_m(ORIGIN_LAT, ORIGIN_LON, ORIGIN_LAT + 0.001, ORIGIN_LON)
        via_distance = proximity_info(ORIGIN_LAT + 0.001, ORIGIN_LON, distance)
        assert via_coords == via_distance


class TestEnrichFinding:
    def test_populates_all_five_fields_on_a_copy(self) -> None:
        original = make_finding()
        enriched = enrich_finding(
            original,
            origin_lat=ORIGIN_LAT,
            origin_lon=ORIGIN_LON,
            lat=ORIGIN_LAT + 0.001,
            lon=ORIGIN_LON,
            requested_radius_m=500,
        )
        assert enriched.latitude == ORIGIN_LAT + 0.001
        assert enriched.longitude == ORIGIN_LON
        assert enriched.distance_m is not None and enriched.distance_m > 0
        assert enriched.radius_bucket is not None
        assert enriched.inside_requested_radius is True  # ~111m at 0.001deg lat is inside 500m

    def test_original_finding_is_unchanged(self) -> None:
        original = make_finding()
        enrich_finding(
            original,
            origin_lat=ORIGIN_LAT,
            origin_lon=ORIGIN_LON,
            lat=ORIGIN_LAT + 0.001,
            lon=ORIGIN_LON,
        )
        assert original.latitude is None
        assert original.radius_bucket is None
        assert original.inside_requested_radius is None
