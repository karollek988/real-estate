"""N-01 Definition of Done: Stockholm county returns current items, SVT
tier is manager_portal (0.85), län-level coverage tag present, honest
degradation on missing county / no feed / malformed feed / network
failure. All tests use a canned RSS body — no network."""

from __future__ import annotations

import urllib.error
import urllib.request
from datetime import UTC, datetime

from location_intelligence.config import EngineConfig
from location_intelligence.context import context_from_raw_input
from location_intelligence.http_client import HttpClient, HttpResponse
from location_intelligence.models import ProviderStatus, TrustTier
from location_intelligence.providers.svt_local_news import SvtLocalNewsProvider

RSS_BODY = """<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0">
 <channel>
  <title>Stockholm | SVT Nyheter</title>
  <item>
   <title>Test Headline One</title>
   <link>https://www.svt.se/nyheter/lokalt/stockholm/test-1</link>
   <description>Something happened.</description>
   <pubDate>Mon, 20 Jul 2026 11:30:20 +0200</pubDate>
  </item>
  <item>
   <title>Test Headline Two</title>
   <link>https://www.svt.se/nyheter/lokalt/stockholm/test-2</link>
   <description>Something else happened.</description>
   <pubDate>Mon, 20 Jul 2026 10:00:00 +0200</pubDate>
  </item>
 </channel>
</rss>
"""

EMPTY_RSS = """<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0"><channel><title>Empty</title></channel></rss>
"""


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


def make_provider(body: str | Exception) -> tuple[SvtLocalNewsProvider, CannedTransport]:
    transport = CannedTransport(body)
    client = HttpClient(EngineConfig(), transport=transport, sleep=lambda _: None)
    return SvtLocalNewsProvider(client, clock=fixed_clock), transport


class TestSvtLocalNewsProvider:
    def test_no_county_code_is_no_data(self) -> None:
        provider, _ = make_provider(RSS_BODY)
        result = provider.collect(context_from_raw_input("x"))
        assert result.status is ProviderStatus.NO_DATA

    def test_success_returns_items_with_lan_level_coverage_and_manager_portal_tier(self) -> None:
        provider, transport = make_provider(RSS_BODY)
        context = context_from_raw_input("x").patched(county_code="01")
        result = provider.collect(context)

        assert result.status is ProviderStatus.OK
        finding = result.findings[0]
        assert finding.trust_tier is TrustTier.MANAGER_PORTAL
        assert finding.coverage == "län-level (stockholm)"
        assert len(finding.value) == 2
        assert finding.value[0]["title"] == "Test Headline One"
        assert "/stockholm/rss.xml" in transport.requests[0].full_url

    def test_gotland_has_no_known_feed_honest_no_data(self) -> None:
        provider, transport = make_provider(RSS_BODY)
        context = context_from_raw_input("x").patched(county_code="09")
        result = provider.collect(context)
        assert result.status is ProviderStatus.NO_DATA
        assert result.detail is not None and "Gotland" in result.detail
        assert transport.requests == []  # never attempted a guessed URL

    def test_empty_feed_is_no_data(self) -> None:
        provider, _ = make_provider(EMPTY_RSS)
        context = context_from_raw_input("x").patched(county_code="01")
        result = provider.collect(context)
        assert result.status is ProviderStatus.NO_DATA

    def test_malformed_xml_degrades_to_error(self) -> None:
        provider, _ = make_provider("not xml at all <<<")
        context = context_from_raw_input("x").patched(county_code="01")
        result = provider.collect(context)
        assert result.status is ProviderStatus.ERROR

    def test_network_failure_degrades_to_error(self) -> None:
        provider, _ = make_provider(urllib.error.URLError("connection refused"))
        context = context_from_raw_input("x").patched(county_code="01")
        result = provider.collect(context)
        assert result.status is ProviderStatus.ERROR
