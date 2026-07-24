"""Allabrf.se discovery provider - the MVP acquisition path.

Resolves a BRF name to the correct BRF via allabrf.se's public
autocomplete endpoint, extracts metadata from the BRF profile page,
finds annual reports and other documents on the /dokument page, and
downloads the publicly available PDFs.

Endpoints used (all plain HTTP, none under the robots.txt-disallowed
/api prefix; verified live 2026-07-18):

- ``GET /items/names?query=<q>`` -> JSON candidates with exact legal
  name, organisation number, slug and county.
- ``GET /<slug>`` -> profile page with a key/value metadata table.
- ``GET /<slug>/dokument`` -> document list. Public documents live at
  ``/documents/<slug>-<type>[-<year>]/public`` which 302-redirects to a
  signed S3 PDF URL. Login-gated documents link to
  ``/users/authentication/login`` instead and are recorded but not
  downloadable.

HTTP-first by design; an optional browser fallback (Camoufox) is only
invoked when a page fetch is blocked (403/429/challenge).
"""

from __future__ import annotations

import asyncio
import hashlib
import re
from datetime import datetime
from enum import StrEnum
from pathlib import Path
from typing import Any
from urllib.parse import urljoin, urlparse

import httpx
from bs4 import BeautifulSoup
from pydantic import BaseModel, Field

from brf_scraper.discovery.base import BaseDiscoveryProvider
from brf_scraper.discovery.matching import name_similarity
from brf_scraper.discovery.models import (
    DiscoveredBRF,
    DiscoveryResult,
    DiscoverySource,
)
from brf_scraper.utils.logging import get_logger

logger = get_logger(__name__)

BASE_URL = "https://www.allabrf.se"
SEARCH_PATH = "/items/names"

# A runner-up candidate within this margin of the top match makes the match
# ambiguous - two BRFs are both plausible, and auto-selecting one risks
# attributing the wrong association's annual report to this property.
AMBIGUITY_GAP = 0.15


def _normalize_org_number(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = value.replace("-", "").replace(" ", "")
    return cleaned or None

_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
)

# Domains that appear on every allabrf page (partners, infra) and can
# never be a BRF's official website.
_NON_OFFICIAL_DOMAINS = (
    "allabrf.se",
    "brfdata.se",
    "anbudskollen.se",
    "bosak.se",
    "hedvig.com",
    "bankid.com",
    "hemnet.se",
    "tilda",
    "mapbox.com",
    "google",
    "gstatic.com",
    "facebook.com",
    "instagram.com",
    "linkedin.com",
)

# /documents/<slug>-<type>[-<year>]/public
_DOC_URL_RE = re.compile(r"/documents/(?P<key>[^/]+)/public")
_YEAR_RE = re.compile(r"(19|20)\d{2}")


class AllabrfDocumentType(StrEnum):
    """Document types observed on allabrf.se document pages."""

    ANNUAL_REPORT = "annual_report"
    BYLAW = "bylaw"
    CERTIFICATE = "certificate"
    ECONOMIC_PLAN = "economic_plan"
    OTHER = "other"

    @classmethod
    def from_key(cls, key: str, title: str) -> AllabrfDocumentType:
        """Classify a document from its URL key and link title."""
        text = f"{key} {title}".lower()
        if "annual_report" in text or "rsredovisning" in text:
            return cls.ANNUAL_REPORT
        if "bylaw" in text or "stadgar" in text:
            return cls.BYLAW
        if "certificate" in text or "betygscertifikat" in text:
            return cls.CERTIFICATE
        if "economic_plan" in text or "ekonomisk plan" in text:
            return cls.ECONOMIC_PLAN
        return cls.OTHER


class AllabrfCandidate(BaseModel):
    """One BRF returned by the allabrf autocomplete endpoint."""

    name: str
    org_number: str | None = None
    slug: str
    county: str | None = None
    match_score: float = Field(default=0.0, ge=0.0, le=1.0)

    @property
    def profile_url(self) -> str:
        """URL of the BRF's allabrf profile page."""
        return f"{BASE_URL}/{self.slug}"


class AllabrfDocument(BaseModel):
    """A document found on the BRF's allabrf document page."""

    title: str
    doc_type: AllabrfDocumentType
    year: int | None = None
    url: str | None = None
    requires_login: bool = False

    @property
    def is_downloadable(self) -> bool:
        """Whether the document is publicly downloadable."""
        return self.url is not None and not self.requires_login


class AllabrfDownload(BaseModel):
    """Result of downloading one document."""

    document: AllabrfDocument
    status: str  # "completed" | "failed"
    file_path: str | None = None
    sha256: str | None = None
    size_bytes: int | None = None
    error: str | None = None


class AllabrfAcquisition(BaseModel):
    """Structured end-to-end result for one BRF name."""

    query: str
    resolved: bool = False
    # "resolved" | "ambiguous_match" | "low_match_score" | "no_candidates" | "search_failed" | "unresolved"
    status: str = "unresolved"
    candidate: AllabrfCandidate | None = None
    candidates_considered: int = 0
    metadata: dict[str, str] = Field(default_factory=dict)
    official_website: str | None = None
    documents: list[AllabrfDocument] = Field(default_factory=list)
    downloads: list[AllabrfDownload] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)
    started_at: datetime = Field(default_factory=datetime.now)
    completed_at: datetime | None = None

    @property
    def annual_reports(self) -> list[AllabrfDocument]:
        """All annual reports found (public and gated)."""
        return [d for d in self.documents if d.doc_type == AllabrfDocumentType.ANNUAL_REPORT]

    @property
    def downloaded_ok(self) -> list[AllabrfDownload]:
        """Downloads that completed successfully."""
        return [d for d in self.downloads if d.status == "completed"]


class AllabrfProvider(BaseDiscoveryProvider):
    """Discovery provider backed by allabrf.se.

    HTTP-first; if a page fetch is blocked (403/429), the optional
    ``browser_fetch`` fallback (e.g. Camoufox) is used for that page.
    """

    def __init__(
        self,
        delay_between_requests: float = 0.7,
        timeout: float = 30.0,
        browser_fetch: Any | None = None,
    ) -> None:
        """Initialize the provider.

        Args:
            delay_between_requests: Politeness delay between page fetches.
            timeout: Per-request timeout in seconds.
            browser_fetch: Optional async callable ``(url) -> html`` used
                when plain HTTP is blocked (Camoufox escalation hook).
        """
        self._delay = delay_between_requests
        self._timeout = timeout
        self._browser_fetch = browser_fetch
        self._client: httpx.AsyncClient | None = None

    @property
    def name(self) -> str:
        """Provider name."""
        return "allabrf"

    @property
    def is_available(self) -> bool:
        """Provider is available whenever httpx is importable (always)."""
        return True

    async def initialize(self) -> None:
        """Create the HTTP client."""
        if self._client is None:
            self._client = httpx.AsyncClient(
                timeout=self._timeout,
                follow_redirects=True,
                headers={"User-Agent": _USER_AGENT, "Accept-Language": "sv-SE,sv;q=0.9"},
            )

    async def close(self) -> None:
        """Close the HTTP client."""
        if self._client:
            await self._client.aclose()
            self._client = None

    # ------------------------------------------------------------------
    # BaseDiscoveryProvider contract
    # ------------------------------------------------------------------

    async def discover(self, **kwargs: Any) -> DiscoveryResult:
        """Discover BRF candidates for a name via allabrf autocomplete.

        Args:
            brf_name: Name to search for (required).
            city: Optional city/county hint used for ranking.
            max_candidates: Max candidates to return (default 5).

        Returns:
            DiscoveryResult with one DiscoveredBRF per candidate, best
            match first.
        """
        brf_name: str = kwargs["brf_name"]
        city: str | None = kwargs.get("city")
        max_candidates: int = kwargs.get("max_candidates", 5)

        result = DiscoveryResult(source=DiscoverySource.DIRECTORY)
        try:
            candidates = await self.search(brf_name, city=city)
        except Exception as e:  # noqa: BLE001 - report, don't crash the pipeline
            result.add_error(f"allabrf search failed for '{brf_name}': {e!s}")
            return result

        for cand in candidates[:max_candidates]:
            result.add_brf(
                DiscoveredBRF(
                    name=cand.name,
                    website_url=cand.profile_url,
                    source=DiscoverySource.DIRECTORY,
                    county=cand.county,
                    organization_number=cand.org_number,
                    confidence_score=cand.match_score,
                    raw_data=cand.model_dump(),
                )
            )
        result.completed_at = datetime.now()
        return result

    # ------------------------------------------------------------------
    # Search / resolution
    # ------------------------------------------------------------------

    async def search(self, brf_name: str, city: str | None = None) -> list[AllabrfCandidate]:
        """Search allabrf's autocomplete and rank candidates.

        Tries the full name first; if nothing comes back, retries with a
        simplified query (generic prefixes stripped).

        Args:
            brf_name: BRF name to search for.
            city: Optional city/county hint; a candidate whose county
                matches gets a ranking boost.

        Returns:
            Candidates sorted by match score, best first.
        """
        queries = [brf_name]
        simplified = _simplify_name(brf_name)
        if simplified and simplified.lower() != brf_name.lower():
            queries.append(simplified)

        items: list[dict[str, Any]] = []
        for query in queries:
            items = await self._search_raw(query)
            if items:
                break

        candidates: list[AllabrfCandidate] = []
        for item in items:
            if item.get("type") != "org" or not item.get("slug"):
                continue
            clean_name = _strip_highlight(item.get("name", ""))
            score = name_similarity(_normalize_name(brf_name), _normalize_name(clean_name))
            county = item.get("county")
            if city and county and city.strip().lower() == county.strip().lower():
                score = min(1.0, score + 0.15)
            candidates.append(
                AllabrfCandidate(
                    name=clean_name,
                    org_number=item.get("org_number"),
                    slug=item["slug"],
                    county=county,
                    match_score=round(score, 3),
                )
            )

        candidates.sort(key=lambda c: c.match_score, reverse=True)
        return candidates

    async def _search_raw(self, query: str) -> list[dict[str, Any]]:
        """Call the autocomplete endpoint and return raw items."""
        assert self._client is not None, "provider not initialized"
        response = await self._client.get(
            f"{BASE_URL}{SEARCH_PATH}",
            params={"query": query},
            headers={"Accept": "application/json"},
        )
        response.raise_for_status()
        data = response.json()
        items = data.get("items", [])
        logger.info("allabrf_search", query=query, results=len(items))
        return items  # type: ignore[no-any-return]

    # ------------------------------------------------------------------
    # Profile page / metadata
    # ------------------------------------------------------------------

    async def fetch_profile(self, candidate: AllabrfCandidate) -> tuple[dict[str, str], str | None]:
        """Fetch the BRF profile page and extract metadata + website.

        Returns:
            (metadata key/value dict, official website URL or None).
        """
        html = await self._fetch_html(candidate.profile_url)
        soup = BeautifulSoup(html, "lxml")

        metadata: dict[str, str] = {}
        for table in soup.find_all("table"):
            for row in table.find_all("tr"):
                cells = row.find_all(["th", "td"])
                if len(cells) == 2:
                    key = cells[0].get_text(" ", strip=True)
                    value = cells[1].get_text(" ", strip=True)
                    if key and value and len(key) < 40 and len(value) < 120:
                        metadata.setdefault(key, value)

        website = _find_official_website(soup)
        return metadata, website

    # ------------------------------------------------------------------
    # Documents
    # ------------------------------------------------------------------

    async def fetch_documents(self, candidate: AllabrfCandidate) -> list[AllabrfDocument]:
        """Fetch the /dokument page and extract all document references."""
        url = f"{candidate.profile_url}/dokument"
        html = await self._fetch_html(url)
        soup = BeautifulSoup(html, "lxml")

        documents: dict[str, AllabrfDocument] = {}
        for anchor in soup.select("a[href]"):
            href = anchor.get("href", "")
            title = anchor.get_text(" ", strip=True)
            if not title:
                continue

            match = _DOC_URL_RE.search(href)
            if match:
                key = match.group("key")
                doc = AllabrfDocument(
                    title=title,
                    doc_type=AllabrfDocumentType.from_key(key, title),
                    year=_extract_year(key) or _extract_year(title),
                    url=urljoin(BASE_URL, href),
                    requires_login=False,
                )
                documents.setdefault(key, doc)
            elif "authentication/login" in href and _looks_like_document_title(title):
                doc = AllabrfDocument(
                    title=title,
                    doc_type=AllabrfDocumentType.from_key("", title),
                    year=_extract_year(title),
                    url=None,
                    requires_login=True,
                )
                documents.setdefault(f"gated:{title}", doc)

        return list(documents.values())

    # ------------------------------------------------------------------
    # Download
    # ------------------------------------------------------------------

    async def download_documents(
        self,
        candidate: AllabrfCandidate,
        documents: list[AllabrfDocument],
        download_dir: Path,
        only_annual_reports: bool = True,
    ) -> list[AllabrfDownload]:
        """Download publicly available documents to disk.

        Files are stored as ``<slug>_<type>[_<year>].pdf`` and verified
        to start with the %PDF magic bytes before being kept.
        """
        assert self._client is not None, "provider not initialized"
        download_dir.mkdir(parents=True, exist_ok=True)
        results: list[AllabrfDownload] = []

        for doc in documents:
            if only_annual_reports and doc.doc_type != AllabrfDocumentType.ANNUAL_REPORT:
                continue
            if not doc.is_downloadable:
                results.append(
                    AllabrfDownload(document=doc, status="failed", error="requires_login")
                )
                continue

            try:
                response = await self._client.get(doc.url)  # follows 302 to signed S3 URL
                response.raise_for_status()
                content = response.content
                if not content.startswith(b"%PDF"):
                    results.append(
                        AllabrfDownload(
                            document=doc,
                            status="failed",
                            error=f"not a PDF (content-type={response.headers.get('content-type')})",
                        )
                    )
                    continue

                suffix = f"_{doc.year}" if doc.year else ""
                filename = f"{candidate.slug}_{doc.doc_type.value}{suffix}.pdf"
                path = download_dir / filename
                path.write_bytes(content)
                results.append(
                    AllabrfDownload(
                        document=doc,
                        status="completed",
                        file_path=str(path),
                        sha256=hashlib.sha256(content).hexdigest(),
                        size_bytes=len(content),
                    )
                )
                logger.info("allabrf_downloaded", file=filename, bytes=len(content))
            except Exception as e:  # noqa: BLE001
                results.append(AllabrfDownload(document=doc, status="failed", error=str(e)))

            if self._delay > 0:
                await asyncio.sleep(self._delay)

        return results

    # ------------------------------------------------------------------
    # End-to-end
    # ------------------------------------------------------------------

    async def acquire(
        self,
        brf_name: str,
        download_dir: Path,
        city: str | None = None,
        org_number: str | None = None,
        min_match_score: float = 0.4,
        download: bool = True,
    ) -> AllabrfAcquisition:
        """Full pipeline: name -> correct BRF -> metadata -> documents -> PDFs.

        Args:
            brf_name: BRF name to resolve.
            download_dir: Where to store downloaded PDFs.
            city: Optional city hint for disambiguation.
            org_number: Optional organisationsnummer. A near-unambiguous
                identifier - an exact match against a candidate settles
                resolution outright and skips the ambiguity check below.
            min_match_score: Refuse to resolve below this score.
            download: Whether to download annual reports.

        Returns:
            AllabrfAcquisition with everything found. Never auto-selects
            between multiple plausible candidates - see AMBIGUITY_GAP.
        """
        acq = AllabrfAcquisition(query=brf_name)
        await self.initialize()

        try:
            candidates = await self.search(brf_name, city=city)
        except Exception as e:  # noqa: BLE001
            acq.errors.append(f"search_failed: {e!s}")
            acq.status = "search_failed"
            acq.completed_at = datetime.now()
            return acq

        acq.candidates_considered = len(candidates)
        if not candidates:
            acq.errors.append("no_candidates")
            acq.status = "no_candidates"
            acq.completed_at = datetime.now()
            return acq

        target_org = _normalize_org_number(org_number)
        org_match = next(
            (c for c in candidates if target_org and _normalize_org_number(c.org_number) == target_org),
            None,
        )

        if org_match is not None:
            # Organization number match is ground truth - bypasses the name
            # score floor and the ambiguity check entirely.
            best = org_match
        else:
            best = candidates[0]
            if best.match_score < min_match_score:
                acq.errors.append(
                    f"low_match_score: best '{best.name}' scored {best.match_score:.2f}"
                )
                acq.status = "low_match_score"
                acq.completed_at = datetime.now()
                return acq

            if len(candidates) > 1:
                runner_up = candidates[1]
                if best.match_score - runner_up.match_score < AMBIGUITY_GAP:
                    acq.errors.append(
                        f"ambiguous_match: '{best.name}' ({best.match_score:.2f}) and "
                        f"'{runner_up.name}' ({runner_up.match_score:.2f}) are too close "
                        "to auto-select safely"
                    )
                    acq.status = "ambiguous_match"
                    acq.completed_at = datetime.now()
                    return acq

        acq.candidate = best
        acq.resolved = True
        acq.status = "resolved"

        if self._delay > 0:
            await asyncio.sleep(self._delay)
        try:
            acq.metadata, acq.official_website = await self.fetch_profile(best)
        except Exception as e:  # noqa: BLE001
            acq.errors.append(f"profile_failed: {e!s}")

        if self._delay > 0:
            await asyncio.sleep(self._delay)
        try:
            acq.documents = await self.fetch_documents(best)
        except Exception as e:  # noqa: BLE001
            acq.errors.append(f"documents_failed: {e!s}")

        if download and acq.documents:
            acq.downloads = await self.download_documents(best, acq.documents, download_dir)

        acq.completed_at = datetime.now()
        return acq

    # ------------------------------------------------------------------
    # Fetching with browser escalation
    # ------------------------------------------------------------------

    async def _fetch_html(self, url: str) -> str:
        """Fetch a page over HTTP, escalating to the browser fallback if blocked."""
        assert self._client is not None, "provider not initialized"
        try:
            response = await self._client.get(url)
            if response.status_code in (403, 429, 503) and self._browser_fetch is not None:
                logger.warning("allabrf_http_blocked", url=url, status=response.status_code)
                return await self._browser_fetch(url)  # type: ignore[no-any-return]
            response.raise_for_status()
            return response.text
        except httpx.HTTPStatusError:
            raise
        except httpx.HTTPError:
            if self._browser_fetch is not None:
                logger.warning("allabrf_http_error_escalating", url=url)
                return await self._browser_fetch(url)  # type: ignore[no-any-return]
            raise


# ----------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------


def _strip_highlight(name: str) -> str:
    """Remove <em> highlight tags that allabrf embeds in result names."""
    return re.sub(r"</?em>", "", name).strip()


def _normalize_name(name: str) -> str:
    """Normalize a BRF name for comparison (lowercase, generic words unified)."""
    text = name.lower().strip()
    text = text.replace("bostadsrättsföreningen", "brf").replace("bostadsrättsförening", "brf")
    text = re.sub(r"\s+", " ", text)
    return text


def _simplify_name(name: str) -> str:
    """Strip generic prefixes to build a fallback search query."""
    text = re.sub(
        r"^(brf|hsb|riksbyggen|bostadsrättsföreningen|bostadsrättsförening)\s+",
        "",
        name.strip(),
        flags=re.IGNORECASE,
    )
    return text.strip()


def _extract_year(text: str) -> int | None:
    """Extract a plausible year from a document key or title."""
    match = _YEAR_RE.search(text)
    return int(match.group(0)) if match else None


def _looks_like_document_title(title: str) -> bool:
    """Whether a login-gated link's text names a document (vs nav chrome)."""
    lowered = title.lower()
    keywords = ("årsredovisning", "arsredovisning", "stadgar", "ekonomisk plan", "protokoll")
    return any(k in lowered for k in keywords)


def _find_official_website(soup: BeautifulSoup) -> str | None:
    """Best-effort extraction of the BRF's own website from its profile page.

    Any external link whose domain is not a known allabrf partner/infra
    domain is a candidate; the first one found wins.
    """
    for anchor in soup.select("a[href^=http]"):
        href = anchor.get("href", "")
        domain = urlparse(href).netloc.lower()
        if not domain:
            continue
        if any(blocked in domain for blocked in _NON_OFFICIAL_DOMAINS):
            continue
        return href
    return None
