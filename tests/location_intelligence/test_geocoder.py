"""A-03/A-04 Definition of Done: forward geocoding with precision level,
reverse geocoding for coordinate input, honest degradation on failure.
All unit tests use canned Nominatim responses — no network."""

from __future__ import annotations

import json
import urllib.error
import urllib.request
from datetime import UTC, datetime

from location_intelligence.config import EngineConfig
from location_intelligence.context import GeocodePrecision, context_from_raw_input
from location_intelligence.http_client import HttpClient, HttpResponse
from location_intelligence.models import ProviderStatus
from location_intelligence.providers.nominatim_geocoder import NominatimGeocoder

FORWARD_HIT = [
    {
        "lat": "59.3435764",
        "lon": "18.0493643",
        "addresstype": "building",
        "display_name": "Dalagatan 30, 113 24 Stockholm, Sverige",
        "address": {
            "house_number": "30",
            "road": "Dalagatan",
            "postcode": "113 24",
            "city": "Stockholm",
            "municipality": "Stockholms kommun",
        },
    }
]

STREET_ONLY_HIT = [
    {
        "lat": "59.34",
        "lon": "18.05",
        "addresstype": "road",
        "display_name": "Dalagatan, Stockholm, Sverige",
        "address": {"road": "Dalagatan", "city": "Stockholm"},
    }
]

REVERSE_HIT = {
    "lat": "59.3435764",
    "lon": "18.0493643",
    "addresstype": "building",
    "display_name": "Dalagatan 30, 113 24 Stockholm, Sverige",
    "address": {
        "house_number": "30",
        "road": "Dalagatan",
        "postcode": "113 24",
        "municipality": "Stockholms kommun",
    },
}


def fixed_clock() -> datetime:
    return datetime(2026, 7, 20, 10, 0, tzinfo=UTC)


class CannedTransport:
    def __init__(self, payload: object | Exception) -> None:
        self.payload = payload
        self.urls: list[str] = []

    def __call__(self, request: urllib.request.Request, timeout: float) -> HttpResponse:
        self.urls.append(request.full_url)
        if isinstance(self.payload, Exception):
            raise self.payload
        return HttpResponse(200, json.dumps(self.payload).encode("utf-8"))


def make_geocoder(payload: object | Exception) -> tuple[NominatimGeocoder, CannedTransport]:
    transport = CannedTransport(payload)
    client = HttpClient(EngineConfig(), transport=transport, sleep=lambda _: None)
    return NominatimGeocoder(client, clock=fixed_clock), transport


class TestForwardGeocoding:
    def test_full_hit_patches_coordinates_precision_and_identity(self) -> None:
        geocoder, transport = make_geocoder(FORWARD_HIT)
        result = geocoder.collect(context_from_raw_input("Dalagatan 30, Stockholm"))

        assert result.status is ProviderStatus.OK
        patch = result.context_patch
        assert patch["latitude"] == 59.3435764
        assert patch["longitude"] == 18.0493643
        assert patch["precision"] is GeocodePrecision.ROOFTOP
        assert patch["municipality"] == "Stockholm"  # canonical SCB name, not Nominatim's
        assert patch["municipality_code"] == "0180"
        assert patch["postal_code"] == "113 24"
        assert "countrycodes=se" in transport.urls[0]

        finding = result.findings[0]
        assert finding.domain == "geocoding"
        assert finding.source.license is not None and "OpenStreetMap" in finding.source.license

    def test_street_only_hit_gets_street_precision(self) -> None:
        geocoder, _ = make_geocoder(STREET_ONLY_HIT)
        result = geocoder.collect(context_from_raw_input("Dalagatan, Stockholm"))
        assert result.context_patch["precision"] is GeocodePrecision.STREET

    def test_resolver_set_identity_is_not_overwritten(self) -> None:
        geocoder, _ = make_geocoder(FORWARD_HIT)
        context = context_from_raw_input("Dalagatan 30, Stockholm").patched(
            municipality="Stockholm", municipality_code="0180", postal_code="113 24"
        )
        result = geocoder.collect(context)
        # Already-resolved identity fields are left alone.
        assert "municipality" not in result.context_patch
        assert "postal_code" not in result.context_patch

    def test_no_result_is_no_data_with_detail(self) -> None:
        geocoder, _ = make_geocoder([])
        result = geocoder.collect(context_from_raw_input("Nowhere 999, Atlantis"))
        assert result.status is ProviderStatus.NO_DATA
        assert result.detail is not None and "no result" in result.detail

    def test_network_failure_degrades_to_error_status(self) -> None:
        geocoder, _ = make_geocoder(urllib.error.URLError("connection refused"))
        result = geocoder.collect(context_from_raw_input("Dalagatan 30, Stockholm"))
        assert result.status is ProviderStatus.ERROR
        assert result.detail is not None and "Nominatim request failed" in result.detail
        assert result.context_patch == {}  # never a guessed coordinate


class TestReverseGeocoding:
    def test_coordinate_input_reverse_resolves_identity(self) -> None:
        geocoder, transport = make_geocoder(REVERSE_HIT)
        result = geocoder.collect(context_from_raw_input("59.3435764, 18.0493643"))

        assert result.status is ProviderStatus.OK
        assert "/reverse" in transport.urls[0]
        patch = result.context_patch
        assert patch["municipality_code"] == "0180"
        assert patch["postal_code"] == "113 24"
        assert patch["precision"] is GeocodePrecision.ROOFTOP
        assert "latitude" not in patch  # coords came from the user, not Nominatim

    def test_reverse_miss_is_no_data(self) -> None:
        geocoder, _ = make_geocoder({"error": "Unable to geocode"})
        result = geocoder.collect(context_from_raw_input("57.0, 3.0"))
        assert result.status is ProviderStatus.NO_DATA
