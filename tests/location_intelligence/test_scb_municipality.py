"""M-01 Definition of Done: real values via metadata-driven year + column
resolution (doc 28 bugs #2/#3 fixed, ported from the TS provider), no
municipality_code -> honest no_data, no fabricated values on partial
upstream failure. All tests use canned PxWeb responses — no network."""

from __future__ import annotations

import json
import urllib.error
import urllib.request
from datetime import UTC, datetime

from location_intelligence.config import EngineConfig
from location_intelligence.context import context_from_raw_input
from location_intelligence.http_client import HttpClient, HttpResponse
from location_intelligence.models import ProviderStatus
from location_intelligence.providers.scb_municipality import (
    EDUCATION_TABLE,
    INCOME_TABLE,
    POPULATION_TABLE,
    ScbMunicipalityProvider,
)


def fixed_clock() -> datetime:
    return datetime(2026, 7, 20, 10, 0, tzinfo=UTC)


def _population_meta() -> dict[str, object]:
    return {
        "variables": [{"code": "Tid", "values": ["2019", "2020", "2021", "2022", "2023", "2024"]}]
    }


def _population_data(value: float) -> dict[str, object]:
    return {
        "columns": [{"code": "Region"}, {"code": "ContentsCode"}],
        "data": [{"key": ["0180"], "values": [str(value)]}],
    }


def _income_meta() -> dict[str, object]:
    return {"variables": [{"code": "Tid", "values": ["2023", "2024"]}]}


def _income_data(value: float) -> dict[str, object]:
    return {"columns": [{"code": "Region"}], "data": [{"key": ["0180"], "values": [str(value)]}]}


def _education_meta() -> dict[str, object]:
    return {"variables": [{"code": "Tid", "values": ["2024", "2025"]}]}


def _education_data() -> dict[str, object]:
    return {
        "columns": [{"code": "Region"}, {"code": "UtbildningsNiva"}, {"code": "Kon"}],
        "data": [
            {"key": ["0180", "1", "1"], "values": ["100"]},
            {"key": ["0180", "5", "1"], "values": ["60"]},
        ],
    }


class ScriptedTransport:
    """Routes GET requests to metadata canned responses and POST bodies to
    data canned responses, keyed on which table URL the request targets."""

    def __init__(self, tables: dict[str, tuple[dict[str, object], dict[str, object]]]) -> None:
        self.tables = tables
        self.requests: list[urllib.request.Request] = []

    def __call__(self, request: urllib.request.Request, timeout: float) -> HttpResponse:
        self.requests.append(request)
        url = request.full_url
        if url not in self.tables:
            raise urllib.error.URLError(f"unexpected URL {url}")
        meta, data = self.tables[url]
        # GET (metadata lookup, no body) vs POST (data query, has a body).
        payload = data if request.data is not None else meta
        return HttpResponse(200, json.dumps(payload).encode("utf-8"))


def full_transport() -> ScriptedTransport:
    return ScriptedTransport(
        {
            POPULATION_TABLE: (_population_meta(), _population_data(950_000.0)),
            INCOME_TABLE: (_income_meta(), _income_data(361.0)),
            EDUCATION_TABLE: (_education_meta(), _education_data()),
        }
    )


def make_provider(transport: ScriptedTransport) -> ScbMunicipalityProvider:
    client = HttpClient(EngineConfig(), transport=transport, sleep=lambda _: None)
    return ScbMunicipalityProvider(client, clock=fixed_clock)


class TestScbMunicipalityProvider:
    def test_no_municipality_code_is_no_data(self) -> None:
        provider = make_provider(full_transport())
        result = provider.collect(context_from_raw_input("Dalagatan 30, Stockholm"))
        assert result.status is ProviderStatus.NO_DATA
        assert result.detail is not None and "no municipality" in result.detail

    def test_full_success_reports_all_findings_with_kommun_level_coverage(self) -> None:
        provider = make_provider(full_transport())
        context = context_from_raw_input("Dalagatan 30, Stockholm").patched(
            municipality="Stockholm", municipality_code="0180"
        )
        result = provider.collect(context)

        assert result.status is ProviderStatus.OK
        by_key = {f.key: f for f in result.findings}
        assert by_key["population_total"].value == 950_000
        assert by_key["population_total"].coverage == "kommun-level"
        assert by_key["median_income_sek_thousands"].value == 361.0
        assert by_key["share_post_secondary_education_pct"].value == 37.5  # 60/160

    def test_latest_year_resolved_from_metadata_not_assumed(self) -> None:
        provider = make_provider(full_transport())
        context = context_from_raw_input("x").patched(municipality_code="0180")
        provider.collect(context)
        # Two population calls (latest + latest-5); both must use the
        # metadata's real latest year (2024), never "current year - 1".
        population_posts = [
            r
            for r in provider._client._transport.requests
            if r.full_url == POPULATION_TABLE and r.data
        ]
        bodies = [json.loads(r.data.decode()) for r in population_posts]
        years_queried = {
            sel["selection"]["values"][0]
            for body in bodies
            for sel in body["query"]
            if sel["code"] == "Tid"
        }
        assert years_queried == {"2024", "2019"}

    def test_partial_upstream_failure_is_reported_honestly(self) -> None:
        transport = ScriptedTransport(
            {
                POPULATION_TABLE: (_population_meta(), _population_data(950_000.0)),
                INCOME_TABLE: (_income_meta(), _income_data(361.0)),
                # Education table missing entirely -> triggers an error path.
            }
        )
        provider = make_provider(transport)
        context = context_from_raw_input("x").patched(municipality_code="0180")
        result = provider.collect(context)

        assert result.status is ProviderStatus.PARTIAL
        assert result.detail is not None and "education" in result.detail
        keys = {f.key for f in result.findings}
        assert "population_total" in keys
        assert "share_post_secondary_education_pct" not in keys

    def test_total_network_failure_is_no_data(self) -> None:
        def dead_transport(request: object, timeout: float) -> object:
            raise urllib.error.URLError("network unreachable")

        client = HttpClient(EngineConfig(), transport=dead_transport, sleep=lambda _: None)  # type: ignore[arg-type]
        provider = ScbMunicipalityProvider(client, clock=fixed_clock)
        context = context_from_raw_input("x").patched(municipality_code="0180")
        result = provider.collect(context)
        assert result.status is ProviderStatus.NO_DATA
