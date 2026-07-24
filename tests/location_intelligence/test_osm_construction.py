"""K-01 Definition of Done: known construction sites appear with real
computed distances, honest zero when none found, honest degradation on
failure. All tests use a canned Overpass response — no network."""

from __future__ import annotations

import json
import urllib.error
import urllib.request
from datetime import UTC, datetime

from location_intelligence.config import EngineConfig
from location_intelligence.context import context_from_raw_input
from location_intelligence.http_client import HttpClient, HttpResponse
from location_intelligence.models import ProviderStatus
from location_intelligence.providers.osm_construction import OsmConstructionProvider

ORIGIN_LAT, ORIGIN_LON = 59.3435764, 18.0493643

ELEMENTS = [
    {
        "type": "node",
        "lat": ORIGIN_LAT + 0.001,
        "lon": ORIGIN_LON,
        "tags": {"building": "construction", "name": "Kvarteret Vasen"},
    },
    {
        "type": "way",
        "center": {"lat": ORIGIN_LAT, "lon": ORIGIN_LON + 0.002},
        "tags": {"construction": "residential"},
    },
    {
        # Not a construction tag — must be ignored.
        "type": "node",
        "lat": ORIGIN_LAT,
        "lon": ORIGIN_LON,
        "tags": {"amenity": "restaurant", "name": "Not Construction"},
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


def make_provider(payload: object | Exception) -> OsmConstructionProvider:
    transport = CannedTransport(payload)
    client = HttpClient(EngineConfig(), transport=transport, sleep=lambda _: None)
    return OsmConstructionProvider(client, clock=fixed_clock)


def geocoded_context():
    return context_from_raw_input("Dalagatan 30, Stockholm").patched(
        latitude=ORIGIN_LAT, longitude=ORIGIN_LON
    )


class TestOsmConstructionProvider:
    def test_counts_and_nearest_sites_with_real_distances(self) -> None:
        provider = make_provider({"elements": ELEMENTS})
        result = provider.collect(geocoded_context())

        assert result.status is ProviderStatus.OK
        by_key = {f.key: f for f in result.findings}
        assert by_key["construction_site_count_within_1500m"].value == 2

        nearest = by_key["construction_sites_nearest"].value
        assert len(nearest) == 2
        assert nearest[0]["name"] == "Kvarteret Vasen"  # closer one first
        assert nearest[0]["construction_type"] == "construction"
        assert nearest[1]["construction_type"] == "residential"

        # Proximity framework: standard spatial-context keys on each item.
        assert nearest[0]["radius_bucket"] is not None
        assert nearest[0]["inside_requested_radius"] is True  # ~111m within 1500m
        assert nearest[1]["inside_requested_radius"] is True  # ~222m within 1500m

    def test_zero_sites_is_an_honest_zero_not_no_data(self) -> None:
        provider = make_provider({"elements": []})
        result = provider.collect(geocoded_context())
        assert result.status is ProviderStatus.OK
        by_key = {f.key: f for f in result.findings}
        assert by_key["construction_site_count_within_1500m"].value == 0
        assert "construction_sites_nearest" not in by_key

    def test_missing_coordinates_is_no_data(self) -> None:
        provider = make_provider({"elements": []})
        result = provider.collect(context_from_raw_input("Dalagatan 30, Stockholm"))
        assert result.status is ProviderStatus.NO_DATA

    def test_network_failure_degrades_to_error(self) -> None:
        provider = make_provider(urllib.error.URLError("connection refused"))
        result = provider.collect(geocoded_context())
        assert result.status is ProviderStatus.ERROR
        assert result.detail is not None and "Overpass request failed" in result.detail
