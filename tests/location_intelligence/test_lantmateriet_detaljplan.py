"""Lantmäteriet detaljplan provider Definition of Done: OAuth2 token exchange
and caching, real computed distances, honest degradation, axis-order
self-correction (the one genuinely unverified-live detail — see module
docstring). All tests use canned token/search responses — no network."""

from __future__ import annotations

import json
import urllib.error
import urllib.request
from datetime import UTC, datetime

from location_intelligence.config import EngineConfig
from location_intelligence.context import context_from_raw_input
from location_intelligence.http_client import HttpClient, HttpResponse
from location_intelligence.models import ProviderStatus
from location_intelligence.providers.lantmateriet_detaljplan import (
    LantmaterietDetaljplanProvider,
    _representative_point,
    _to_lat_lon,
)

ORIGIN_LAT, ORIGIN_LON = 59.3435764, 18.0493643

TOKEN_RESPONSE = {"access_token": "test-token-abc", "expires_in": 3600}


def _feature(
    plan_id: str,
    name: str,
    status: str,
    lat: float,
    lon: float,
    *,
    swap_axes: bool = False,
) -> dict[str, object]:
    # GeoJSON/OGC API Features convention: [lon, lat]. `swap_axes` lets a
    # test simulate the other real-world convention to prove self-correction.
    a, b = (lat, lon) if swap_axes else (lon, lat)
    return {
        "type": "Feature",
        "geometry": {"type": "Polygon", "coordinates": [[[a, b], [a, b], [a, b], [a, b]]]},
        "bbox": [a, b, a, b],
        "assets": {
            "beslutshandling1": {
                "href": f"https://example.se/{plan_id}/beslut.pdf",
                "title": "Beslut",
                "roles": ["beslutshandling"],
            }
        },
        "properties": {
            "datetime": "2026-06-01T00:00:00+00:00",
            "feature": {"typ": "detaljplan", "etikett": name},
            "detaljplan": {
                "objektidentitet": plan_id,
                "beteckning": f"DP-{plan_id}",
                "namn": name,
                "status": status,
                "datumStatusforandring": "2026-05-01",
                "typ": "detaljplan",
                "datumPaborjat": "2025-01-01",
            },
        },
    }


def fixed_clock() -> datetime:
    return datetime(2026, 7, 20, 10, 0, tzinfo=UTC)


class RoutedTransport:
    def __init__(self, search_payload: object | Exception) -> None:
        self.search_payload = search_payload
        self.requests: list[urllib.request.Request] = []
        self.token_calls = 0
        self.search_calls = 0

    def __call__(self, request: urllib.request.Request, timeout: float) -> HttpResponse:
        self.requests.append(request)
        if request.full_url.startswith("https://api.lantmateriet.se/token"):
            self.token_calls += 1
            return HttpResponse(200, json.dumps(TOKEN_RESPONSE).encode("utf-8"))
        self.search_calls += 1
        if isinstance(self.search_payload, Exception):
            raise self.search_payload
        return HttpResponse(200, json.dumps(self.search_payload).encode("utf-8"))


def make_provider(
    search_payload: object | Exception,
) -> tuple[LantmaterietDetaljplanProvider, RoutedTransport]:
    transport = RoutedTransport(search_payload)
    client = HttpClient(EngineConfig(), transport=transport, sleep=lambda _: None)
    provider = LantmaterietDetaljplanProvider(
        client, client_id="id", client_secret="secret", clock=fixed_clock
    )
    return provider, transport


def geocoded_context():
    return context_from_raw_input("Dalagatan 30, Stockholm").patched(
        latitude=ORIGIN_LAT, longitude=ORIGIN_LON, municipality="Stockholm"
    )


class TestAxisOrderSelfCorrection:
    def test_lat_lon_order_is_detected(self) -> None:
        assert _to_lat_lon(59.34, 18.05) == (59.34, 18.05)

    def test_lon_lat_order_is_detected_and_swapped(self) -> None:
        assert _to_lat_lon(18.05, 59.34) == (59.34, 18.05)

    def test_representative_point_averages_vertices(self) -> None:
        geometry = {"type": "Polygon", "coordinates": [[[18.0, 59.3], [18.2, 59.3]]]}
        point = _representative_point(geometry)
        assert point is not None
        lat, lon = point
        assert 59.29 < lat < 59.31
        assert 18.0 < lon < 18.2


class TestLantmaterietDetaljplanProvider:
    def test_missing_credentials_is_not_connected(self) -> None:
        transport = RoutedTransport({"features": []})
        client = HttpClient(EngineConfig(), transport=transport, sleep=lambda _: None)
        provider = LantmaterietDetaljplanProvider(client, clock=fixed_clock)
        result = provider.collect(geocoded_context())
        assert result.status is ProviderStatus.NOT_CONNECTED
        assert result.detail is not None and "LANTMATERIET_CLIENT_ID" in result.detail

    def test_missing_coordinates_is_no_data(self) -> None:
        provider, _ = make_provider({"features": []})
        result = provider.collect(context_from_raw_input("Dalagatan 30, Stockholm"))
        assert result.status is ProviderStatus.NO_DATA

    def test_counts_and_nearest_plans_with_real_distances_and_status_gloss(self) -> None:
        features = [
            _feature("aaa", "Kvarteret Vasen", "samråd", ORIGIN_LAT + 0.0005, ORIGIN_LON),
            _feature("bbb", "Kvarteret Bocken", "laga kraft", ORIGIN_LAT + 0.005, ORIGIN_LON),
        ]
        provider, transport = make_provider({"features": features})
        result = provider.collect(geocoded_context())

        assert result.status is ProviderStatus.OK
        by_key = {f.key: f for f in result.findings}
        assert by_key["detaljplan_count_within_2000m"].value == 2

        nearest = by_key["detaljplans_nearest"].value
        assert nearest[0]["name"] == "Kvarteret Vasen"  # closer one sorted first
        assert nearest[0]["distance_m"] < nearest[1]["distance_m"]
        assert nearest[0]["status"] == "samråd"
        assert nearest[0]["status_meaning"] == "in public consultation (samråd)"
        assert nearest[0]["authority"] == "Stockholm"
        assert nearest[0]["radius_bucket"] is not None
        assert nearest[0]["inside_requested_radius"] is True
        assert nearest[0]["case_reference"] == "DP-aaa"
        assert nearest[0]["documents"][0]["role"] == "beslutshandling"
        assert nearest[0]["documents"][0]["url"] == "https://example.se/aaa/beslut.pdf"
        assert nearest[0]["raw"]["detaljplan"]["objektidentitet"] == "aaa"

    def test_plans_outside_true_radius_are_excluded_despite_bbox_prefilter(self) -> None:
        # A point far north-east of the origin can still fall inside the
        # square bbox prefilter while being outside the true circular
        # radius — must be dropped, matching the "never fake nearest,
        # exact counts within a radius" rule used by every other provider.
        far = _feature("ccc", "Corner Plan", "antagen", ORIGIN_LAT + 0.017, ORIGIN_LON + 0.017)
        provider, _ = make_provider({"features": [far]})
        result = provider.collect(geocoded_context())
        by_key = {f.key: f for f in result.findings}
        assert by_key["detaljplan_count_within_2000m"].value == 0
        assert "detaljplans_nearest" not in by_key

    def test_axis_order_swap_still_yields_correct_coordinates(self) -> None:
        swapped = _feature(
            "ddd", "Swapped Plan", "granskning", ORIGIN_LAT + 0.0005, ORIGIN_LON, swap_axes=True
        )
        provider, _ = make_provider({"features": [swapped]})
        result = provider.collect(geocoded_context())
        by_key = {f.key: f for f in result.findings}
        nearest = by_key["detaljplans_nearest"].value
        assert abs(nearest[0]["latitude"] - (ORIGIN_LAT + 0.0005)) < 0.001
        assert abs(nearest[0]["longitude"] - ORIGIN_LON) < 0.001

    def test_token_is_cached_across_two_collect_calls(self) -> None:
        provider, transport = make_provider({"features": []})
        provider.collect(geocoded_context())
        provider.collect(geocoded_context())
        assert transport.token_calls == 1
        assert transport.search_calls == 2

    def test_zero_plans_is_an_honest_zero_not_no_data(self) -> None:
        provider, _ = make_provider({"features": []})
        result = provider.collect(geocoded_context())
        assert result.status is ProviderStatus.OK
        by_key = {f.key: f for f in result.findings}
        assert by_key["detaljplan_count_within_2000m"].value == 0
        assert "detaljplans_nearest" not in by_key

    def test_network_failure_degrades_to_error(self) -> None:
        provider, _ = make_provider(urllib.error.URLError("connection refused"))
        result = provider.collect(geocoded_context())
        assert result.status is ProviderStatus.ERROR
        assert result.detail is not None and "Lantmäteriet" in result.detail

    def test_malformed_response_degrades_to_error(self) -> None:
        provider, _ = make_provider("not-a-dict")
        result = provider.collect(geocoded_context())
        assert result.status is ProviderStatus.ERROR
