"""C-02 Definition of Done: events appear with type/place/date, every
finding tagged county-level granularity, honest degradation. All tests
use a canned Polisen response — no network."""

from __future__ import annotations

import json
import urllib.error
import urllib.request
from datetime import UTC, datetime

from location_intelligence.config import EngineConfig
from location_intelligence.context import context_from_raw_input
from location_intelligence.http_client import HttpClient, HttpResponse
from location_intelligence.models import ProviderStatus
from location_intelligence.providers.polisen_crime import PolisenCrimeProvider

FIXED_NOW = datetime(2026, 7, 20, 12, 0, tzinfo=UTC)


def _event(id_: int, name: str, dt: str, event_type: str = "Stöld") -> dict[str, object]:
    return {
        "id": id_,
        "datetime": dt,
        "name": name,
        "summary": "summary text",
        "url": f"/aktuellt/handelser/{id_}/",
        "type": event_type,
        "location": {"name": "Stockholms län", "gps": "59.6,18.1"},
    }


EVENTS = [
    _event(1, "Recent event", "2026-07-19 10:00:00 +02:00"),
    _event(2, "Old event", "2025-01-01 10:00:00 +01:00"),
    _event(3, "Another recent event", "2026-07-15 08:00:00 +02:00"),
]


def fixed_clock() -> datetime:
    return FIXED_NOW


class CannedTransport:
    def __init__(self, payload: object | Exception) -> None:
        self.payload = payload
        self.requests: list[urllib.request.Request] = []

    def __call__(self, request: urllib.request.Request, timeout: float) -> HttpResponse:
        self.requests.append(request)
        if isinstance(self.payload, Exception):
            raise self.payload
        return HttpResponse(200, json.dumps(self.payload).encode("utf-8"))


def make_provider(payload: object | Exception) -> tuple[PolisenCrimeProvider, CannedTransport]:
    transport = CannedTransport(payload)
    client = HttpClient(EngineConfig(), transport=transport, sleep=lambda _: None)
    return PolisenCrimeProvider(client, clock=fixed_clock), transport


class TestPolisenCrimeProvider:
    def test_no_county_code_is_no_data(self) -> None:
        provider, _ = make_provider(EVENTS)
        result = provider.collect(context_from_raw_input("x"))
        assert result.status is ProviderStatus.NO_DATA

    def test_success_counts_recent_window_and_sorts_newest_first(self) -> None:
        provider, transport = make_provider(EVENTS)
        context = context_from_raw_input("x").patched(county_code="01")
        result = provider.collect(context)

        assert result.status is ProviderStatus.OK
        by_key = {f.key: f for f in result.findings}
        # Only the two 2026-07 events fall within the last 30 days of FIXED_NOW.
        assert by_key["police_event_count_last_30d"].value == 2
        assert by_key["police_event_count_last_30d"].coverage == "county-level (Stockholms län)"

        recent = by_key["police_events_recent"].value
        assert recent[0]["title"] == "Recent event"  # newest first
        assert recent[-1]["title"] == "Old event"
        assert "locationname=Stockholms" in transport.requests[0].full_url

    def test_no_events_is_no_data(self) -> None:
        provider, _ = make_provider([])
        context = context_from_raw_input("x").patched(county_code="01")
        result = provider.collect(context)
        assert result.status is ProviderStatus.NO_DATA

    def test_malformed_response_degrades_to_error(self) -> None:
        provider, _ = make_provider({"not": "a list"})
        context = context_from_raw_input("x").patched(county_code="01")
        result = provider.collect(context)
        assert result.status is ProviderStatus.ERROR

    def test_network_failure_degrades_to_error(self) -> None:
        provider, _ = make_provider(urllib.error.URLError("connection refused"))
        context = context_from_raw_input("x").patched(county_code="01")
        result = provider.collect(context)
        assert result.status is ProviderStatus.ERROR
