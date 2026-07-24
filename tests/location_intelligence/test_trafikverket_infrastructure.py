"""T-02 Definition of Done: known project appears with validity window
distinct from fetch time, honest not_connected without a key, honest
degradation on auth/network failure. All tests use canned Trafikverket
responses — no network."""

from __future__ import annotations

import json
import urllib.error
import urllib.request
from datetime import UTC, datetime

from location_intelligence.config import EngineConfig
from location_intelligence.context import context_from_raw_input
from location_intelligence.http_client import HttpClient, HttpResponse
from location_intelligence.models import ProviderStatus
from location_intelligence.providers.trafikverket_infrastructure import (
    TrafikverketInfrastructureProvider,
)

SUCCESS_PAYLOAD = {
    "RESPONSE": {
        "RESULT": [
            {
                "Situation": [
                    {
                        "Deviation": [
                            {
                                "Header": "Vägarbete på Sveavägen",
                                "MessageType": "Vägarbete",
                                "RoadNumber": "E4",
                                "StartTime": "2026-08-01T00:00:00.000+02:00",
                                "EndTime": "2027-06-01T00:00:00.000+02:00",
                            }
                        ]
                    }
                ]
            }
        ]
    }
}

EMPTY_PAYLOAD = {"RESPONSE": {"RESULT": [{"Situation": []}]}}

AUTH_ERROR_PAYLOAD = {
    "RESPONSE": {"RESULT": [{"ERROR": {"SOURCE": "Security", "MESSAGE": "Invalid authentication"}}]}
}


def fixed_clock() -> datetime:
    return datetime(2026, 7, 20, 10, 0, tzinfo=UTC)


class CannedTransport:
    def __init__(self, status: int, payload: object) -> None:
        self.status = status
        self.payload = payload
        self.requests: list[urllib.request.Request] = []

    def __call__(self, request: urllib.request.Request, timeout: float) -> HttpResponse:
        self.requests.append(request)
        return HttpResponse(self.status, json.dumps(self.payload).encode("utf-8"))


def make_provider(status: int, payload: object, api_key: str | None = "test-key"):
    transport = CannedTransport(status, payload)
    client = HttpClient(EngineConfig(), transport=transport, sleep=lambda _: None)
    return TrafikverketInfrastructureProvider(client, api_key=api_key, clock=fixed_clock), transport


def geocoded_context():
    return context_from_raw_input("x").patched(latitude=59.3435764, longitude=18.0493643)


class TestTrafikverketInfrastructureProvider:
    def test_no_api_key_is_not_connected(self) -> None:
        provider, _ = make_provider(200, SUCCESS_PAYLOAD, api_key=None)
        result = provider.collect(geocoded_context())
        assert result.status is ProviderStatus.NOT_CONNECTED
        assert result.detail is not None and "TRAFIKVERKET_API_KEY" in result.detail

    def test_success_reports_project_with_validity_window(self) -> None:
        provider, transport = make_provider(200, SUCCESS_PAYLOAD)
        result = provider.collect(geocoded_context())

        assert result.status is ProviderStatus.OK
        by_key = {f.key: f for f in result.findings}
        assert by_key["infrastructure_project_count_within_2000m"].value == 1
        project = by_key["infrastructure_projects_nearest"].value[0]
        assert project["header"] == "Vägarbete på Sveavägen"
        assert project["start_time"] == "2026-08-01T00:00:00.000+02:00"

        # WGS84 filter must be "lon lat" order (Trafikverket's documented shape).
        body = transport.requests[0].data.decode("utf-8")
        assert 'value="18.0493643 59.3435764"' in body

    def test_empty_results_is_honest_zero(self) -> None:
        provider, _ = make_provider(200, EMPTY_PAYLOAD)
        result = provider.collect(geocoded_context())
        assert result.status is ProviderStatus.OK
        by_key = {f.key: f for f in result.findings}
        assert by_key["infrastructure_project_count_within_2000m"].value == 0
        assert "infrastructure_projects_nearest" not in by_key

    def test_auth_error_status_degrades_to_error(self) -> None:
        provider, _ = make_provider(401, AUTH_ERROR_PAYLOAD)
        result = provider.collect(geocoded_context())
        assert result.status is ProviderStatus.ERROR

    def test_missing_coordinates_is_no_data(self) -> None:
        provider, _ = make_provider(200, SUCCESS_PAYLOAD)
        result = provider.collect(context_from_raw_input("x"))
        assert result.status is ProviderStatus.NO_DATA

    def test_network_failure_degrades_to_error(self) -> None:
        def dead_transport(request: object, timeout: float) -> object:
            raise urllib.error.URLError("network unreachable")

        client = HttpClient(EngineConfig(), transport=dead_transport, sleep=lambda _: None)  # type: ignore[arg-type]
        provider = TrafikverketInfrastructureProvider(client, api_key="k", clock=fixed_clock)
        result = provider.collect(geocoded_context())
        assert result.status is ProviderStatus.ERROR
