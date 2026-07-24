"""SVT local news provider (task N-01, provider P11a).

"What's happening in this area that could matter later?" — SVT Nyheter
Lokalt publishes a stable, public RSS feed per län (confirmed live,
20 of 21 län — Gotland has no dedicated SVT lokalt feed found, reported
as an honest coverage gap rather than guessed at, matching doc 36 §2.7's
finding that no single Swedish local-news API exists). Coverage is
län-level, not per-kommun — tagged explicitly so the package can't be
mistaken for hyperlocal.

Parsed with the stdlib (`xml.etree.ElementTree`) rather than adding a new
dependency for one well-formed RSS 2.0 feed — doc 30 flagged `feedparser`
as the eventual pick once the news-plugin family grows (SVT + a
kommun-feed registry, doc 36 §4.1's `news/` plugin family); this single
feed doesn't need it yet.
"""

from __future__ import annotations

import xml.etree.ElementTree as ET

from location_intelligence.context import AddressContext
from location_intelligence.http_client import HttpClient, HttpError
from location_intelligence.models import (
    Clock,
    Finding,
    ProviderResult,
    ProviderStatus,
    Source,
    TrustTier,
    utcnow,
)
from location_intelligence.providers.base import Provider, Stage

SVT_BASE_URL = "https://www.svt.se/nyheter/lokalt"
SVT_HOST = "www.svt.se"
SVT_RATE_LIMITS = {SVT_HOST: 1.0}

MAX_ITEMS = 15

#: County code (SCB) -> SVT Nyheter Lokalt URL slug. Verified live against
#: https://www.svt.se/nyheter/lokalt/<slug>/rss.xml. Gotland (09) has no
#: confirmed dedicated feed — omitted rather than guessed.
_COUNTY_SLUGS: dict[str, str] = {
    "01": "stockholm",
    "03": "uppsala",
    "04": "sormland",
    "05": "ost",  # Östergötland
    "06": "jonkoping",
    "07": "smaland",  # Kronobergs län shares SVT Smålandsnytt
    "08": "smaland",  # Kalmar län shares SVT Smålandsnytt
    "10": "blekinge",
    "12": "skane",
    "13": "halland",
    "14": "vast",  # Västra Götalands län
    "17": "varmland",
    "18": "orebro",
    "19": "vastmanland",
    "20": "dalarna",
    "21": "gavleborg",
    "22": "vasternorrland",
    "23": "jamtland",
    "24": "vasterbotten",
    "25": "norrbotten",
}

_SOURCE = Source(
    name="SVT Nyheter Lokalt",
    url=SVT_BASE_URL,
    license="Public-service content, source attribution required",
)


class SvtLocalNewsProvider(Provider):
    id = "svt_local_news"
    stage = Stage.PARALLEL
    trust_tier = TrustTier.MANAGER_PORTAL
    cache_ttl = None
    deadline_s = 10.0

    def __init__(self, client: HttpClient, clock: Clock = utcnow) -> None:
        self._client = client
        self._clock = clock

    def collect(self, context: AddressContext) -> ProviderResult:
        if context.county_code is None:
            return ProviderResult(
                provider_id=self.id,
                status=ProviderStatus.NO_DATA,
                detail="no county resolved for this address yet",
            )
        slug = _COUNTY_SLUGS.get(context.county_code)
        if slug is None:
            return ProviderResult(
                provider_id=self.id,
                status=ProviderStatus.NO_DATA,
                detail=f"no SVT Nyheter Lokalt feed known for county code "
                f"{context.county_code} (Gotland has no dedicated feed as of this "
                "provider's last verification — a real coverage gap, not a bug)",
            )

        try:
            body = self._client.get_text(f"{SVT_BASE_URL}/{slug}/rss.xml")
        except (HttpError, OSError) as exc:
            return ProviderResult(
                provider_id=self.id,
                status=ProviderStatus.ERROR,
                detail=f"SVT RSS request failed: {exc}",
            )

        try:
            items = _parse_rss(body)
        except ET.ParseError as exc:
            return ProviderResult(
                provider_id=self.id,
                status=ProviderStatus.ERROR,
                detail=f"SVT RSS feed was not well-formed XML: {exc}",
            )

        if not items:
            return ProviderResult(
                provider_id=self.id,
                status=ProviderStatus.NO_DATA,
                detail=f"SVT feed for {slug} returned no items",
            )

        fetched_at = self._clock().isoformat()
        finding = Finding(
            domain="news",
            key="local_news_items",
            value=items[:MAX_ITEMS],
            source=_SOURCE,
            trust_tier=self.trust_tier,
            fetched_at=fetched_at,
            coverage=f"län-level ({slug})",
            detail="collection only — no relevance judgment or sentiment applied",
        )
        return ProviderResult(provider_id=self.id, status=ProviderStatus.OK, findings=[finding])


def _parse_rss(body: str) -> list[dict[str, object]]:
    root = ET.fromstring(body)  # noqa: S314 — trusted first-party SVT feed, not user input
    items: list[dict[str, object]] = []
    for item in root.iterfind("./channel/item"):
        title = _text(item, "title")
        link = _text(item, "link")
        if title is None or link is None:
            continue
        items.append(
            {
                "title": title,
                "link": link,
                "description": _text(item, "description"),
                "published_at": _text(item, "pubDate"),
            }
        )
    return items


def _text(item: ET.Element, tag: str) -> str | None:
    element = item.find(tag)
    if element is None or element.text is None:
        return None
    return element.text.strip() or None
