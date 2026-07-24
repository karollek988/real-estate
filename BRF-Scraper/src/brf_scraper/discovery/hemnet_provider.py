"""Hemnet listing extraction - the entry point of the acquisition pipeline.

Hemnet does not expose a BRF directory; it exposes individual property
listings. This provider's only job is to turn one Hemnet listing URL
into the identifying facts needed to resolve the BRF elsewhere
(address, municipality, and the BRF name when Hemnet prints it):

    Hemnet URL -> HemnetListing(address, municipality, brf_name)

That output feeds :class:`~brf_scraper.discovery.allabrf_provider.AllabrfProvider`,
which does the actual BRF resolution and document acquisition. This
module does not parse PDFs, run OCR, or talk to allabrf.se itself.

Hemnet listing pages embed a Next.js ``__NEXT_DATA__`` JSON blob with
the structured listing data; that is the primary extraction path. A
plain-HTML fallback (address/breadcrumb selectors, "Bostadsrättsförening"
label lookup) covers pages where the JSON blob is absent or reshaped.
"""

from __future__ import annotations

import json
import re
from typing import Any

import httpx
from bs4 import BeautifulSoup
from pydantic import BaseModel

from brf_scraper.utils.logging import get_logger

logger = get_logger(__name__)

_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
)

_BRF_LABEL_RE = re.compile(r"bostadsr[aä]tt(?:s)?f[oö]rening(?:en)?", re.IGNORECASE)
_BRF_NAME_RE = re.compile(
    r"\b((?:Brf|BRF|Bostadsr[aä]ttsf[oö]reningen?)\s+[A-ZÅÄÖ][\wÅÄÖåäö\-\.]*(?:\s+[\wÅÄÖåäö\-\.]+){0,4})",
)


class HemnetListing(BaseModel):
    """Facts extracted from one Hemnet listing page."""

    url: str
    address: str | None = None
    municipality: str | None = None
    brf_name: str | None = None
    # Additional fields from Apollo state
    postal_code: str | None = None
    asking_price: float | None = None
    monthly_fee: float | None = None
    living_area_sqm: float | None = None
    rooms: float | None = None
    year_built: int | None = None
    district: str | None = None
    org_number: str | None = None
    raw: dict[str, Any] = {}

    @property
    def resolved(self) -> bool:
        """Whether enough was extracted to attempt BRF resolution."""
        return bool(self.brf_name or self.address)

    @property
    def search_name(self) -> str:
        """Best available name to search allabrf.se with.

        Prefers the BRF name when Hemnet printed one; falls back to the
        street address, which allabrf's autocomplete also matches
        against reasonably well for well-known buildings.
        """
        return self.brf_name or self.address or ""


class HemnetProvider:
    """Extracts address/municipality/BRF name from a Hemnet listing URL.

    Not a :class:`BaseDiscoveryProvider` - it doesn't discover BRF
    *websites*, it turns one listing URL into the query that lets
    :class:`AllabrfProvider` do that.
    """

    def __init__(self, timeout: float = 30.0, browser_fetch: Any | None = None) -> None:
        """Initialize the provider.

        Args:
            timeout: Per-request timeout in seconds.
            browser_fetch: Optional async callable ``(url) -> html`` used
                when plain HTTP is blocked (e.g. a Cloudflare challenge).
        """
        self._timeout = timeout
        self._browser_fetch = browser_fetch
        self._client: httpx.AsyncClient | None = None

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

    async def __aenter__(self) -> HemnetProvider:
        await self.initialize()
        return self

    async def __aexit__(self, *exc: Any) -> None:
        await self.close()

    async def fetch_listing(self, url: str) -> HemnetListing:
        """Fetch a Hemnet listing page and extract address/municipality/BRF name.

        Args:
            url: A ``hemnet.se`` listing URL.

        Returns:
            HemnetListing with whatever could be extracted. Fields the
            page doesn't provide are left ``None`` - callers decide
            whether that's enough to proceed.
        """
        html = await self._fetch_html(url)

        listing = self._parse_next_data(url, html)
        if listing is None:
            listing = self._parse_html_fallback(url, html)

        logger.info(
            "hemnet_listing_parsed",
            url=url,
            address=listing.address,
            municipality=listing.municipality,
            brf_name=listing.brf_name,
        )
        return listing

    async def _fetch_html(self, url: str) -> str:
        """Fetch a page over HTTP, escalating to the browser fallback if blocked."""
        assert self._client is not None, "provider not initialized"
        try:
            response = await self._client.get(url)
            if response.status_code in (403, 429, 503) and self._browser_fetch is not None:
                logger.warning("hemnet_http_blocked", url=url, status=response.status_code)
                return await self._browser_fetch(url)  # type: ignore[no-any-return]
            response.raise_for_status()
            return response.text
        except httpx.HTTPStatusError:
            raise
        except httpx.HTTPError:
            if self._browser_fetch is not None:
                logger.warning("hemnet_http_error_escalating", url=url)
                return await self._browser_fetch(url)  # type: ignore[no-any-return]
            raise

    # ------------------------------------------------------------------
    # __NEXT_DATA__ path (preferred)
    # ------------------------------------------------------------------

    def _parse_next_data(self, url: str, html: str) -> HemnetListing | None:
        soup = BeautifulSoup(html, "lxml")
        script = soup.find("script", id="__NEXT_DATA__")
        if script is None or not script.string:
            return None

        try:
            data = json.loads(script.string)
        except json.JSONDecodeError:
            return None

        apollo_listing = self._parse_apollo_state(url, data)

        # Also try HTML fallback to fill in missing fields
        html_listing = self._parse_html_fallback(url, html)

        if apollo_listing is not None:
            # Fill in missing fields from HTML fallback
            if apollo_listing.municipality is None and html_listing and html_listing.municipality:
                apollo_listing.municipality = html_listing.municipality
            if apollo_listing.brf_name is None and html_listing and html_listing.brf_name:
                apollo_listing.brf_name = html_listing.brf_name
            if apollo_listing.postal_code is None and html_listing and html_listing.postal_code:
                apollo_listing.postal_code = html_listing.postal_code
            return apollo_listing

        return html_listing

    def _parse_apollo_state(self, url: str, data: dict[str, Any]) -> HemnetListing | None:
        """Extract listing facts from Hemnet's Apollo GraphQL cache dump.

        ``__NEXT_DATA__.props.pageProps.__APOLLO_STATE__`` is a flat dict
        keyed ``"<Type>:<id>"``, with cross-references as
        ``{"__ref": "<Type>:<id>"}``. This is the ground truth for the
        listing (address, municipality, BRF name + registration number);
        prefer it over scraping rendered text.
        """
        try:
            apollo: dict[str, Any] = data["props"]["pageProps"]["__APOLLO_STATE__"]
        except (KeyError, TypeError):
            return None

        listing = next(
            (v for k, v in apollo.items() if k.startswith("ActivePropertyListing:") and isinstance(v, dict)),
            None,
        )
        if listing is None:
            return None

        address = _first_str(listing, ("streetAddress",))

        municipality = None
        municipality_ref = listing.get("municipality")
        if isinstance(municipality_ref, dict) and "__ref" in municipality_ref:
            municipality = _first_str(apollo.get(municipality_ref["__ref"], {}), ("fullName", "name"))
        if municipality is None:
            breadcrumbs = listing.get("breadcrumbs")
            if isinstance(breadcrumbs, list) and len(breadcrumbs) >= 2:
                municipality = breadcrumbs[1].get("label")

        brf_name = None
        org_number = None
        brf_ref = listing.get("brf")
        if isinstance(brf_ref, dict) and "__ref" in brf_ref:
            brf_data = apollo.get(brf_ref["__ref"], {})
            brf_name = _first_str(brf_data, ("name",))
            org_number = _first_str(brf_data, ("registrationNumber",))

        # Also check housingCooperative ref
        if brf_name is None:
            coop_ref = listing.get("housingCooperative")
            if isinstance(coop_ref, dict) and "__ref" in coop_ref:
                coop_data = apollo.get(coop_ref["__ref"], {})
                brf_name = _first_str(coop_data, ("name",))

        # Extract additional listing facts
        postal_code = None
        pc = listing.get("postCode")
        if pc is not None:
            postal_code = str(pc)

        asking_price = None
        ap = listing.get("askingPrice")
        if isinstance(ap, dict) and "amount" in ap:
            asking_price = float(ap["amount"])

        monthly_fee = None
        fee = listing.get("fee")
        if isinstance(fee, dict) and "amount" in fee:
            monthly_fee = float(fee["amount"])

        living_area = None
        la = listing.get("livingArea")
        if la is not None:
            try:
                living_area = float(la)
            except (ValueError, TypeError):
                pass

        rooms = None
        r = listing.get("numberOfRooms")
        if r is not None:
            try:
                rooms = float(r)
            except (ValueError, TypeError):
                pass

        year_built = None
        yb = listing.get("legacyConstructionYear")
        if yb is not None:
            try:
                year_built = int(yb)
            except (ValueError, TypeError):
                pass

        district = listing.get("area")

        if address is None and municipality is None and brf_name is None:
            return None

        return HemnetListing(
            url=url,
            address=address,
            municipality=municipality,
            brf_name=brf_name,
            postal_code=postal_code,
            asking_price=asking_price,
            monthly_fee=monthly_fee,
            living_area_sqm=living_area,
            rooms=rooms,
            year_built=year_built,
            district=district,
            org_number=org_number,
            raw={"organization_number": org_number} if org_number else {},
        )

    # ------------------------------------------------------------------
    # Plain-HTML fallback
    # ------------------------------------------------------------------

    def _parse_html_fallback(self, url: str, html: str) -> HemnetListing:
        soup = BeautifulSoup(html, "lxml")

        address = None
        heading = soup.find("h1")
        if heading:
            address = heading.get_text(" ", strip=True) or None

        municipality = None
        # First try breadcrumbs
        breadcrumbs = soup.select("nav[aria-label] a, ol li a")
        for crumb in breadcrumbs:
            text = crumb.get_text(strip=True)
            if text and text.lower() not in {"hemnet", "till salu", "bostäder"}:
                municipality = text
        # Fallback: find "Area, Municipality kommun" in visible text
        if municipality is None:
            for elem in soup.find_all(string=True):
                text = str(elem).strip()
                if "kommun" in text.lower():
                    match = re.search(r"([A-Za-z\u00c0-\u024f\s]+)\s*kommun", text)
                    if match:
                        municipality = match.group(1).strip() + " kommun"
                        break

        brf_name = None
        for element in soup.find_all(string=_BRF_LABEL_RE):
            parent_text = element.parent.get_text(" ", strip=True) if element.parent else str(element)
            brf_name = _extract_brf_name_from_text(parent_text)
            if brf_name:
                break
        if brf_name is None:
            body_text = soup.get_text(" ", strip=True)
            brf_name = _extract_brf_name_from_text(body_text)

        return HemnetListing(url=url, address=address, municipality=municipality, brf_name=brf_name)


# ----------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------


def _first_str(d: dict[str, Any], keys: tuple[str, ...]) -> str | None:
    for key in keys:
        value = d.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def _extract_brf_name_from_text(text: str) -> str | None:
    match = _BRF_NAME_RE.search(text)
    if not match:
        return None
    name = re.sub(r"\s+", " ", match.group(1)).strip().rstrip(".,")
    return name or None


def _find_listing_dict(data: Any, _depth: int = 0) -> dict[str, Any] | None:
    """Walk Next.js page props for the dict describing the listing.

    Hemnet's exact prop shape isn't public/stable, so this looks for any
    nested dict carrying listing-shaped keys rather than a fixed path.
    """
    if _depth > 8 or not isinstance(data, dict):
        return None

    listing_keys = {"streetAddress", "street_address", "housingCooperative", "listingId"}
    if listing_keys & data.keys():
        return data

    for value in data.values():
        if isinstance(value, dict):
            found = _find_listing_dict(value, _depth + 1)
            if found is not None:
                return found
        elif isinstance(value, list):
            for item in value:
                if isinstance(item, dict):
                    found = _find_listing_dict(item, _depth + 1)
                    if found is not None:
                        return found
    return None
