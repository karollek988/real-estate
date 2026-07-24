"""Unit coverage for the shared Overpass tag-filter matcher — the single
piece every Overpass-backed provider (osm_poi, osm_construction, ...)
depends on for correct classification."""

from __future__ import annotations

from location_intelligence.providers.overpass_client import haversine_m, matches_filter


class TestMatchesFilter:
    def test_equality_filter(self) -> None:
        assert matches_filter({"amenity": "restaurant"}, '["amenity"="restaurant"]')
        assert not matches_filter({"amenity": "cafe"}, '["amenity"="restaurant"]')
        assert not matches_filter({}, '["amenity"="restaurant"]')

    def test_negation_filter(self) -> None:
        assert matches_filter({"railway": "station"}, '["railway"="station"]["station"!="subway"]')
        assert not matches_filter(
            {"railway": "station", "station": "subway"},
            '["railway"="station"]["station"!="subway"]',
        )

    def test_bare_key_existence_filter(self) -> None:
        # A bare `["construction"]` filter must require the key to be
        # present, not match unconditionally (regression: previously any
        # tags dict matched a bare-key filter since it had no "=" clause).
        assert matches_filter({"construction": "residential"}, '["construction"]')
        assert not matches_filter({"amenity": "restaurant"}, '["construction"]')
        assert not matches_filter({}, '["construction"]')


class TestHaversine:
    def test_zero_distance_for_identical_points(self) -> None:
        assert haversine_m(59.34, 18.05, 59.34, 18.05) == 0.0

    def test_known_distance_is_plausible(self) -> None:
        # Roughly 1 degree of latitude ~111km.
        distance = haversine_m(59.0, 18.0, 60.0, 18.0)
        assert 110_000 < distance < 112_000
