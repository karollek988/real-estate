"""S-02 Definition of Done: kommun-level status counts, named planned
schools with real computed distances (sorted nearest-first), honest
degradation. All tests use canned Skolverket responses — no network.

Regression note: Skolverket's documented `kommunkod` query parameter does
not actually filter server-side (verified live) — this provider always
fetches the full bulk list and filters client-side; these tests exercise
that filtering, not a server-side filter."""

from __future__ import annotations

import json
import urllib.error
import urllib.request
from datetime import UTC, datetime

from location_intelligence.config import EngineConfig
from location_intelligence.context import context_from_raw_input
from location_intelligence.http_client import HttpClient, HttpResponse
from location_intelligence.models import ProviderStatus
from location_intelligence.providers.skolverket_schools import SkolverketSchoolsProvider


def _unit(code: str, kommun: str, name: str, status: str) -> dict[str, str]:
    return {
        "Skolenhetskod": code,
        "Kommunkod": kommun,
        "Skolenhetsnamn": name,
        "Status": status,
    }


BULK_LIST = {
    "Uttagsdatum": "2026-07-20T00:00:00",
    "Skolenheter": [
        _unit("111", "0180", "Aktiv Skola", "Aktiv"),
        _unit("222", "0180", "Vilande Skola", "Vilande"),
        _unit("333", "0180", "Ny Skola Nara", "Planerad"),
        _unit("444", "0180", "Ny Skola Langre Bort", "Planerad"),
        _unit("555", "0192", "Annan Kommun Skola", "Aktiv"),
    ],
}


def _detail(code: str, name: str, lat: float, lon: float) -> dict[str, object]:
    return {
        "SkolenhetInfo": {
            "Namn": name,
            "Skolenhetskod": code,
            "Skolformer": [{"Benamning": "Grundskola"}],
            "Besoksadress": {
                "Adress": "Testgatan 1",
                "Postnr": "11111",
                "GeoData": {"Koordinat_WGS84_Lat": str(lat), "Koordinat_WGS84_Lng": str(lon)},
            },
            "Startdatum": "2027-08-01",
        }
    }


ORIGIN_LAT, ORIGIN_LON = 59.3435764, 18.0493643


def fixed_clock() -> datetime:
    return datetime(2026, 7, 20, 10, 0, tzinfo=UTC)


class ScriptedTransport:
    def __init__(self, detail_by_code: dict[str, object]) -> None:
        self.detail_by_code = detail_by_code
        self.requests: list[urllib.request.Request] = []

    def __call__(self, request: urllib.request.Request, timeout: float) -> HttpResponse:
        self.requests.append(request)
        url = request.full_url
        if url.endswith("/skolenhet"):
            return HttpResponse(200, json.dumps(BULK_LIST).encode("utf-8"))
        for code, payload in self.detail_by_code.items():
            if url.endswith(f"/skolenhet/{code}"):
                if isinstance(payload, Exception):
                    raise payload
                return HttpResponse(200, json.dumps(payload).encode("utf-8"))
        raise urllib.error.URLError(f"unexpected URL {url}")


def make_provider(detail_by_code: dict[str, object]) -> SkolverketSchoolsProvider:
    transport = ScriptedTransport(detail_by_code)
    client = HttpClient(EngineConfig(), transport=transport, sleep=lambda _: None)
    return SkolverketSchoolsProvider(client, clock=fixed_clock)


class TestSkolverketSchoolsProvider:
    def test_no_municipality_code_is_no_data(self) -> None:
        provider = make_provider({})
        result = provider.collect(context_from_raw_input("x"))
        assert result.status is ProviderStatus.NO_DATA

    def test_kommun_level_counts_are_client_side_filtered(self) -> None:
        provider = make_provider(
            {
                "333": _detail("333", "Ny Skola Nara", ORIGIN_LAT + 0.001, ORIGIN_LON),
                "444": _detail("444", "Ny Skola Langre Bort", ORIGIN_LAT + 0.02, ORIGIN_LON),
            }
        )
        context = context_from_raw_input("x").patched(
            municipality_code="0180", latitude=ORIGIN_LAT, longitude=ORIGIN_LON
        )
        result = provider.collect(context)

        assert result.status is ProviderStatus.OK
        by_key = {f.key: f for f in result.findings}
        # 0192's "Annan Kommun Skola" must not leak into Stockholm's counts.
        assert by_key["active_school_count"].value == 1
        assert by_key["dormant_school_count"].value == 1
        assert by_key["planned_school_count"].value == 2

        planned = by_key["planned_schools"].value
        assert len(planned) == 2
        assert planned[0]["name"] == "Ny Skola Nara"  # closer one sorted first
        assert planned[0]["distance_m"] < planned[1]["distance_m"]

        # Proximity framework: bucket is computed, but this is a kommun-wide
        # bulk list, not a radius query — "inside" is not a meaningful
        # question, so it stays None rather than a fabricated True/False.
        assert planned[0]["radius_bucket"] is not None
        assert planned[0]["inside_requested_radius"] is None

    def test_planned_schools_without_coordinates_are_unsorted_but_present(self) -> None:
        provider = make_provider(
            {
                "333": _detail("333", "Ny Skola Nara", 59.35, 18.05),
                "444": _detail("444", "Ny Skola Langre Bort", 59.36, 18.06),
            }
        )
        context = context_from_raw_input("x").patched(municipality_code="0180")
        result = provider.collect(context)
        by_key = {f.key: f for f in result.findings}
        assert len(by_key["planned_schools"].value) == 2

    def test_partial_failure_on_one_planned_school_detail(self) -> None:
        provider = make_provider(
            {
                "333": _detail("333", "Ny Skola Nara", ORIGIN_LAT + 0.001, ORIGIN_LON),
                "444": urllib.error.URLError("upstream error"),
            }
        )
        context = context_from_raw_input("x").patched(
            municipality_code="0180", latitude=ORIGIN_LAT, longitude=ORIGIN_LON
        )
        result = provider.collect(context)
        assert result.status is ProviderStatus.PARTIAL
        by_key = {f.key: f for f in result.findings}
        assert len(by_key["planned_schools"].value) == 1

    def test_bulk_list_network_failure_is_error(self) -> None:
        def dead_transport(request: object, timeout: float) -> object:
            raise urllib.error.URLError("network unreachable")

        client = HttpClient(EngineConfig(), transport=dead_transport, sleep=lambda _: None)  # type: ignore[arg-type]
        provider = SkolverketSchoolsProvider(client, clock=fixed_clock)
        context = context_from_raw_input("x").patched(municipality_code="0180")
        result = provider.collect(context)
        assert result.status is ProviderStatus.ERROR
