"""M-02 Definition of Done: KPIs return for test kommuner, each finding
tagged `coverage: kommun-level`, latest period resolved from the response
(never assumed), honest degradation without a municipality code or on
upstream failure. All tests use canned Kolada responses — no network."""

from __future__ import annotations

import json
import urllib.error
import urllib.request
from datetime import UTC, datetime

from location_intelligence.config import EngineConfig
from location_intelligence.context import context_from_raw_input
from location_intelligence.http_client import HttpClient, HttpResponse
from location_intelligence.models import ProviderStatus
from location_intelligence.providers.kolada import KPIS, KoladaProvider


def fixed_clock() -> datetime:
    return datetime(2026, 7, 20, 10, 0, tzinfo=UTC)


def _kolada_payload(kpi_id: str, periods: dict[int, float]) -> dict[str, object]:
    return {
        "values": [
            {
                "kpi": kpi_id,
                "municipality": "0180",
                "period": period,
                "values": [{"gender": "T", "value": value, "status": ""}],
            }
            for period, value in periods.items()
        ]
    }


class ScriptedTransport:
    def __init__(self, by_kpi: dict[str, object]) -> None:
        self.by_kpi = by_kpi
        self.requests: list[urllib.request.Request] = []

    def __call__(self, request: urllib.request.Request, timeout: float) -> HttpResponse:
        self.requests.append(request)
        for kpi_id, payload in self.by_kpi.items():
            if f"/kpi/{kpi_id}/municipality/" in request.full_url:
                if isinstance(payload, Exception):
                    raise payload
                return HttpResponse(200, json.dumps(payload).encode("utf-8"))
        raise urllib.error.URLError(f"unexpected URL {request.full_url}")


def make_provider(by_kpi: dict[str, object]) -> KoladaProvider:
    transport = ScriptedTransport(by_kpi)
    client = HttpClient(EngineConfig(), transport=transport, sleep=lambda _: None)
    return KoladaProvider(client, clock=fixed_clock)


def full_payloads(value: float = 42.0) -> dict[str, object]:
    return {kpi.id: _kolada_payload(kpi.id, {2023: value - 1, 2024: value}) for kpi in KPIS}


class TestKoladaProvider:
    def test_no_municipality_code_is_no_data(self) -> None:
        provider = make_provider(full_payloads())
        result = provider.collect(context_from_raw_input("Dalagatan 30, Stockholm"))
        assert result.status is ProviderStatus.NO_DATA
        assert result.detail is not None and "no municipality" in result.detail

    def test_all_kpis_resolve_with_kommun_level_coverage_and_latest_period(self) -> None:
        provider = make_provider(full_payloads(42.0))
        context = context_from_raw_input("x").patched(municipality_code="0180")
        result = provider.collect(context)

        assert result.status is ProviderStatus.OK
        assert len(result.findings) == len(KPIS)
        for finding in result.findings:
            assert finding.coverage == "kommun-level"
            assert finding.value == 42.0
            assert "period=2024" in finding.detail  # latest, not the older 2023 entry

    def test_partial_failure_when_some_kpis_unavailable(self) -> None:
        payloads = full_payloads()
        failing_kpi = KPIS[0].id
        payloads[failing_kpi] = urllib.error.URLError("upstream error")
        provider = make_provider(payloads)
        context = context_from_raw_input("x").patched(municipality_code="0180")
        result = provider.collect(context)

        assert result.status is ProviderStatus.PARTIAL
        assert len(result.findings) == len(KPIS) - 1
        assert result.detail is not None and KPIS[0].key in result.detail

    def test_total_network_failure_is_no_data(self) -> None:
        def dead_transport(request: object, timeout: float) -> object:
            raise urllib.error.URLError("network unreachable")

        client = HttpClient(EngineConfig(), transport=dead_transport, sleep=lambda _: None)  # type: ignore[arg-type]
        provider = KoladaProvider(client, clock=fixed_clock)
        context = context_from_raw_input("x").patched(municipality_code="0180")
        result = provider.collect(context)
        assert result.status is ProviderStatus.NO_DATA

    def test_empty_values_is_treated_as_missing_not_zero(self) -> None:
        payloads = full_payloads()
        payloads[KPIS[0].id] = {"values": []}
        provider = make_provider(payloads)
        context = context_from_raw_input("x").patched(municipality_code="0180")
        result = provider.collect(context)
        keys = {f.key for f in result.findings}
        assert KPIS[0].key not in keys
