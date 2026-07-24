"""G-01 Definition of Done: CSV parsed, test-kommun trend findings
present, latest period selected, honest degradation. All tests use a
canned CSV body — no network."""

from __future__ import annotations

import urllib.error
import urllib.request
from datetime import UTC, datetime

from location_intelligence.config import EngineConfig
from location_intelligence.context import context_from_raw_input
from location_intelligence.http_client import HttpClient, HttpResponse
from location_intelligence.models import ProviderStatus
from location_intelligence.providers.bolagsverket_companies import (
    BolagsverketCompaniesProvider,
)

_HEADER = (
    "ar,manad,handelse,regfam,regfamtext,SATELAN,SATEKOMMUN,LANTEXT,KOMTEXT,"
    "AB,BAB,BF,BRF,EK,E,SE,FL,FAB,HB,I,KB,KHF,MB,SF,SB,TSF,BFL,OFB,SCE,S,"
    "EGTS,FOF,TPAB,OTPB,TPF,LADDATUM,armanad"
)


def _row(year: str, month: str, handelse: str, lan: str, kommun: str, ab: str) -> str:
    # 26 legal-form columns after AB; only AB is populated, rest blank.
    blanks = ",".join([""] * 25)
    armanad = f"{year}{month.zfill(2)}"
    return (
        f"{year},{month},{handelse},1,Storstadsregioner,{lan},{kommun},"
        f"Test län,Test kommun,{ab},{blanks},01JUL2026:00:00:00,{armanad}"
    )


CSV_BODY = "\n".join(
    [
        _HEADER,
        _row("2026", "5", "1", "1", "80", "900"),  # older month, Stockholm
        _row("2026", "6", "1", "1", "80", "988"),  # newest, Stockholm, new regs
        _row("2026", "6", "2", "1", "80", "175819"),  # newest, Stockholm, stock
        _row("2026", "6", "3", "1", "80", "183"),  # newest, Stockholm, deregs
        _row("2026", "6", "1", "3", "80", "50"),  # different län, ignored
    ]
)


def fixed_clock() -> datetime:
    return datetime(2026, 7, 20, 10, 0, tzinfo=UTC)


class CannedTransport:
    def __init__(self, body: str | Exception) -> None:
        self.body = body
        self.requests: list[urllib.request.Request] = []

    def __call__(self, request: urllib.request.Request, timeout: float) -> HttpResponse:
        self.requests.append(request)
        if isinstance(self.body, Exception):
            raise self.body
        return HttpResponse(200, self.body.encode("utf-8"))


def make_provider(body: str | Exception) -> BolagsverketCompaniesProvider:
    transport = CannedTransport(body)
    client = HttpClient(EngineConfig(), transport=transport, sleep=lambda _: None)
    return BolagsverketCompaniesProvider(client, clock=fixed_clock)


def stockholm_context():
    return context_from_raw_input("x").patched(municipality_code="0180", county_code="01")


class TestBolagsverketCompaniesProvider:
    def test_no_municipality_or_county_is_no_data(self) -> None:
        provider = make_provider(CSV_BODY)
        result = provider.collect(context_from_raw_input("x"))
        assert result.status is ProviderStatus.NO_DATA

    def test_latest_period_only_and_kommun_filtered(self) -> None:
        provider = make_provider(CSV_BODY)
        result = provider.collect(stockholm_context())

        assert result.status is ProviderStatus.OK
        by_key = {f.key: f for f in result.findings}
        # Only June (newest armanad) should appear, not May's 900.
        assert by_key["new_registrations_aktiebolag"].value == 988
        assert by_key["deregistrations_aktiebolag"].value == 183
        assert by_key["active_total_aktiebolag"].value == 175819
        for f in result.findings:
            assert f.coverage == "kommun-level"

    def test_no_matching_rows_is_no_data(self) -> None:
        provider = make_provider(CSV_BODY)
        context = context_from_raw_input("x").patched(municipality_code="9999", county_code="99")
        result = provider.collect(context)
        assert result.status is ProviderStatus.NO_DATA

    def test_network_failure_degrades_to_error(self) -> None:
        provider = make_provider(urllib.error.URLError("connection refused"))
        result = provider.collect(stockholm_context())
        assert result.status is ProviderStatus.ERROR
