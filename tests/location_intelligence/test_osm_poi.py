"""O-01..O-04 Definition of Done: exact counts, real-computed nearest-N
distances (never fake-nearest from unsorted samples), precision gating,
honest degradation. All tests use a canned Overpass response — no network."""

from __future__ import annotations

import json
import urllib.error
import urllib.request
from datetime import UTC, datetime

from location_intelligence.config import EngineConfig
from location_intelligence.context import GeocodePrecision, context_from_raw_input
from location_intelligence.http_client import HttpClient, HttpResponse
from location_intelligence.models import ProviderStatus
from location_intelligence.providers.osm_poi import OsmPoiProvider

# Origin: Dalagatan 30, Stockholm-ish coordinates.
ORIGIN_LAT, ORIGIN_LON = 59.3435764, 18.0493643

ELEMENTS = [
    {
        "type": "node",
        "lat": ORIGIN_LAT + 0.0005,  # ~55m north
        "lon": ORIGIN_LON,
        "tags": {"amenity": "restaurant", "name": "Nearby Bistro"},
    },
    {
        "type": "node",
        "lat": ORIGIN_LAT + 0.002,  # further away
        "lon": ORIGIN_LON,
        "tags": {"amenity": "restaurant", "name": "Farther Diner"},
    },
    {
        "type": "way",
        "center": {"lat": ORIGIN_LAT, "lon": ORIGIN_LON + 0.001},
        "tags": {"amenity": "cafe", "name": "Corner Cafe"},
    },
    {
        "type": "node",
        "lat": ORIGIN_LAT,
        "lon": ORIGIN_LON + 0.0005,
        "tags": {"railway": "station", "station": "subway", "name": "T-Centralen"},
    },
    {
        "type": "node",
        "lat": ORIGIN_LAT,
        "lon": ORIGIN_LON - 0.0005,
        "tags": {"railway": "station", "name": "Central Station"},
    },
    {
        # No tags matching any category — must be silently ignored.
        "type": "node",
        "lat": ORIGIN_LAT,
        "lon": ORIGIN_LON,
        "tags": {"natural": "tree"},
    },
]


def fixed_clock() -> datetime:
    return datetime(2026, 7, 20, 10, 0, tzinfo=UTC)


class CannedTransport:
    def __init__(self, payload: object | Exception) -> None:
        self.payload = payload
        self.requests: list[urllib.request.Request] = []

    def __call__(self, request: urllib.request.Request, timeout: float) -> HttpResponse:
        self.requests.append(request)
        if isinstance(self.payload, Exception):
            raise self.payload
        return HttpResponse(200, json.dumps(self.payload).encode("utf-8"))


def make_provider(payload: object | Exception) -> tuple[OsmPoiProvider, CannedTransport]:
    transport = CannedTransport(payload)
    client = HttpClient(EngineConfig(), transport=transport, sleep=lambda _: None)
    return OsmPoiProvider(client, clock=fixed_clock), transport


def geocoded_context():
    return context_from_raw_input("Dalagatan 30, Stockholm").patched(
        latitude=ORIGIN_LAT, longitude=ORIGIN_LON, precision=GeocodePrecision.ROOFTOP
    )


class TestOsmPoiProvider:
    def test_counts_and_nearest_are_computed_from_real_coordinates(self) -> None:
        provider, transport = make_provider({"elements": ELEMENTS})
        result = provider.collect(geocoded_context())

        assert result.status is ProviderStatus.OK
        by_key = {f.key: f for f in result.findings}

        assert by_key["restaurant_count_within_1000m"].value == 2
        nearest = by_key["restaurant_nearest"].value
        assert nearest[0]["name"] == "Nearby Bistro"  # closer one sorted first
        assert nearest[0]["distance_m"] < nearest[1]["distance_m"]

        # Proximity framework: every nearest-item dict carries the five
        # standard spatial-context keys, computed from real coordinates.
        assert nearest[0]["radius_bucket"] == "0-100m"  # ~55m north
        assert nearest[0]["inside_requested_radius"] is True
        assert nearest[1]["inside_requested_radius"] is True  # ~222m, still within 1000m

        assert by_key["cafe_count_within_1000m"].value == 1

        # station=subway must classify as subway, not train, despite shared tags.
        assert by_key["subway_station_count_within_1000m"].value == 1
        assert by_key["train_station_count_within_1000m"].value == 1

        # A category with zero matches still reports an honest zero count.
        assert by_key["gym_count_within_1000m"].value == 0
        assert "gym_nearest" not in by_key

    def test_sends_user_agent_via_post(self) -> None:
        provider, transport = make_provider({"elements": []})
        provider.collect(geocoded_context())
        assert transport.requests[0].get_header("User-agent") == EngineConfig().user_agent
        assert transport.requests[0].data is not None

    def test_missing_coordinates_is_no_data(self) -> None:
        provider, _ = make_provider({"elements": []})
        result = provider.collect(context_from_raw_input("Dalagatan 30, Stockholm"))
        assert result.status is ProviderStatus.NO_DATA
        assert result.detail is not None and "coordinates" in result.detail

    def test_network_failure_degrades_to_error(self) -> None:
        provider, _ = make_provider(urllib.error.URLError("connection refused"))
        result = provider.collect(geocoded_context())
        assert result.status is ProviderStatus.ERROR
        assert result.detail is not None and "Overpass request failed" in result.detail

    def test_malformed_response_degrades_to_error(self) -> None:
        transport = CannedTransport("not-a-dict")
        client = HttpClient(EngineConfig(), transport=transport, sleep=lambda _: None)
        provider = OsmPoiProvider(client, clock=fixed_clock)
        result = provider.collect(geocoded_context())
        assert result.status is ProviderStatus.ERROR
