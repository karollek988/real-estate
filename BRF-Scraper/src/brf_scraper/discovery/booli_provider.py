"""Booli.se provider — extracts BRF and listing data from Booli.

Uses Camoufox browser automation since Booli blocks plain HTTP requests.

Data is extracted from:
- JSON-LD structured data (schema.org) on listing pages
- BRF page HTML for association-level data
- Breadcrumb navigation for BRF name resolution
"""

from __future__ import annotations

import asyncio
import json
import re
from typing import Any, Callable, Awaitable

from bs4 import BeautifulSoup
from pydantic import BaseModel, Field

from brf_scraper.utils.logging import get_logger

logger = get_logger(__name__)

BOOLI_BASE = "https://www.booli.se"


class BooliListing(BaseModel):
    """Data extracted from a Booli listing page."""

    url: str
    booli_id: int | None = None
    address: str | None = None
    postal_code: str | None = None
    city: str | None = None
    municipality: str | None = None
    asking_price: float | None = None
    valuation_low: float | None = None
    valuation_high: float | None = None
    area_sqm: float | None = None
    rooms: float | None = None
    monthly_fee: float | None = None
    year_built: int | None = None
    energy_class: str | None = None
    days_on_market: int | None = None
    brf_name: str | None = None
    brf_booli_id: int | None = None
    object_type: str | None = None
    raw: dict[str, Any] = Field(default_factory=dict)


class BooliBRF(BaseModel):
    """Data extracted from a Booli BRF page."""

    booli_id: int | None = None
    name: str | None = None
    city: str | None = None
    year_built: int | None = None
    energy_class: str | None = None
    total_apartments: int | None = None
    apartments: list[dict[str, Any]] = Field(default_factory=list)
    raw: dict[str, Any] = Field(default_factory=dict)


class BooliProvider:
    """Extracts BRF and listing data from Booli.se via Camoufox browser."""

    def __init__(
        self,
        browser_fetch: Callable[[str], Awaitable[str]] | None = None,
    ) -> None:
        self._browser_fetch = browser_fetch

    async def fetch_listing(self, url: str) -> BooliListing:
        """Fetch a Booli listing page and extract data."""
        html = await self._fetch_html(url)
        return self._parse_listing(url, html)

    async def fetch_brf_page(self, brf_booli_id: int) -> BooliBRF:
        """Fetch a Booli BRF page and extract association data."""
        url = f"{BOOLI_BASE}/bostadsrattsforening/{brf_booli_id}"
        html = await self._fetch_html(url)
        return self._parse_brf_page(url, html)

    async def search_listings(self, address: str, municipality: str | None = None) -> list[dict[str, Any]]:
        """Search Booli for listings matching an address.

        Uses the autocomplete API to resolve the street to an area ID,
        then fetches the area-based search page and extracts listings
        from the Apollo state.
        """
        clean_address = _normalize_address_for_search(address)
        area_id = await self._resolve_area_id(clean_address, municipality)
        if not area_id:
            logger.warning("booli_no_area_id", address=address, municipality=municipality)
            return []

        search_url = f"{BOOLI_BASE}/sok?areaIds={area_id}"
        html = await self._fetch_html(search_url)
        return self._parse_apollo_listings(html, address)

    async def search_brf(self, name: str, city: str | None = None) -> list[dict[str, Any]]:
        """Search for listings on Booli (legacy interface)."""
        return await self.search_listings(name, city)

    async def _resolve_area_id(self, address: str, municipality: str | None = None) -> str | None:
        """Resolve an address to a Booli area ID using the autocomplete API.

        Navigates to booli.se, types in the search field, and captures
        the autocomplete GraphQL response.
        """
        if self._browser_fetch is None:
            return None

        # We need a fresh browser session to interact with the search box
        try:
            from camoufox.async_api import AsyncCamoufox
        except ImportError:
            return None

        async with AsyncCamoufox(headless=True) as browser:
            page = await browser.new_page()
            try:
                captured: dict[str, Any] = {}

                async def on_response(response):
                    if "areaSuggestionSearch" in response.url:
                        try:
                            captured["suggestions"] = await response.json()
                        except Exception:
                            pass

                page.on("response", on_response)

                await page.goto(BOOLI_BASE, wait_until="load", timeout=30000)
                try:
                    await page.wait_for_load_state("networkidle", timeout=5000)
                except Exception:
                    pass

                # Dismiss cookie consent
                try:
                    btn = await page.query_selector("#didomi-notice-agree-button")
                    if btn:
                        await btn.click(timeout=3000)
                        await asyncio.sleep(0.5)
                except Exception:
                    pass

                # Type in search field to trigger autocomplete
                search_input = await page.query_selector("#area-search-field")
                if not search_input:
                    return None

                await search_input.click(timeout=5000)
                await asyncio.sleep(0.3)
                await search_input.type(address, delay=60)
                await asyncio.sleep(2)

                if "suggestions" not in captured:
                    return None

                suggestions = (
                    captured["suggestions"]
                    .get("data", {})
                    .get("areaSuggestionSearch", {})
                    .get("suggestions", [])
                )

                if not suggestions:
                    return None

                # Match by municipality if provided
                best = suggestions[0]
                if municipality:
                    muni_lower = municipality.lower().replace(" kommun", "")
                    for s in suggestions:
                        parent = (s.get("parentDisplayName", "") or "").lower()
                        if muni_lower in parent:
                            best = s
                            break

                area_id = best.get("id")
                logger.info(
                    "booli_area_resolved",
                    address=address,
                    area_id=area_id,
                    display_name=best.get("displayName"),
                    parent=best.get("parentDisplayName"),
                )
                return str(area_id) if area_id else None

            finally:
                await page.close()

    def _parse_apollo_listings(self, html: str, target_address: str) -> list[dict[str, Any]]:
        """Extract listings from Booli's Apollo state on a search results page."""
        soup = BeautifulSoup(html, "lxml")
        script = soup.find("script", id="__NEXT_DATA__")
        if not script or not script.string:
            return []

        try:
            data = json.loads(script.string)
        except json.JSONDecodeError:
            return []

        apollo = data.get("props", {}).get("pageProps", {}).get("__APOLLO_STATE__", {})
        if not apollo:
            return []

        # Extract all Listing entries from Apollo state
        results = []
        for key, val in apollo.items():
            if not key.startswith("Listing:") or not isinstance(val, dict):
                continue
            street = val.get("streetAddress", "")
            url = val.get("url", "")
            if not street or not url:
                continue
            if not url.startswith("http"):
                url = f"{BOOLI_BASE}{url}"
            results.append({
                "url": url,
                "name": street,
                "booli_id": val.get("booliId") or val.get("id"),
                "streetAddress": street,
            })

        # Sort: prefer exact address match, then same-street matches
        target_lower = target_address.lower().strip()
        target_parts = _split_address(target_lower)

        def match_score(item: dict[str, Any]) -> tuple[int, str]:
            item_lower = item["streetAddress"].lower().strip()
            item_parts = _split_address(item_lower)
            if item_parts == target_parts:
                return (0, item_lower)  # exact match first
            if item_parts[0] == target_parts[0]:
                return (1, item_lower)  # same street, different number
            return (2, item_lower)  # different street

        results.sort(key=match_score)
        return results

    def _parse_search_results(self, html: str) -> list[dict[str, Any]]:
        """Parse Booli search results (fallback for legacy callers)."""
        return self._parse_apollo_listings(html, "")

    async def _fetch_html(self, url: str) -> str:
        """Fetch a page using Camoufox browser."""
        if self._browser_fetch is None:
            raise RuntimeError("No browser_fetch configured for BooliProvider")
        logger.info("booli_fetch", url=url)
        return await self._browser_fetch(url)

    def _parse_listing(self, url: str, html: str) -> BooliListing:
        """Parse a Booli listing page."""
        soup = BeautifulSoup(html, "lxml")
        listing = BooliListing(url=url)

        # Parse JSON-LD structured data
        for script in soup.find_all("script", type="application/ld+json"):
            try:
                data = json.loads(script.string or "")
                self._extract_from_jsonld(listing, data)
            except (json.JSONDecodeError, TypeError, ValueError):
                continue

        # Parse breadcrumbs for BRF name
        self._extract_brf_from_breadcrumbs(listing, soup)

        # Parse HTML for additional fields
        try:
            self._extract_from_html(listing, soup)
        except (ValueError, TypeError):
            pass  # Non-critical parsing errors

        return listing

    def _extract_from_jsonld(self, listing: BooliListing, data: dict) -> None:
        """Extract data from JSON-LD structured data."""
        schema_type = data.get("@type", "")

        if schema_type == "Product":
            offers = data.get("offers", {})
            if offers.get("price"):
                listing.asking_price = float(offers["price"])
            desc = data.get("description", "")
            # Extract area from description like "83 m², 3 rum"
            area_match = re.search(r"(\d+)\s*m", desc)
            if area_match:
                listing.area_sqm = float(area_match.group(1))
            rooms_match = re.search(r"(\d+)\s*rum", desc)
            if rooms_match:
                listing.rooms = float(rooms_match.group(1))

        elif schema_type == "Place" or schema_type == "PostalAddress":
            listing.address = data.get("streetAddress", listing.address)
            listing.city = data.get("addressLocality", listing.city)
            listing.postal_code = data.get("postalCode", listing.postal_code)

        elif schema_type == "BreadcrumbList":
            items = data.get("itemListElement", [])
            for item in items:
                name = item.get("name", "")
                item_url = item.get("item", "")
                if "bostadsrattsforening" in item_url.lower():
                    listing.brf_name = name
                    # Extract BRF Booli ID from URL
                    id_match = re.search(r"/bostadsrattsforening/(\d+)", item_url)
                    if id_match:
                        listing.brf_booli_id = int(id_match.group(1))

    def _extract_brf_from_breadcrumbs(self, listing: BooliListing, soup: BeautifulSoup) -> None:
        """Extract BRF name from breadcrumb navigation."""
        if listing.brf_name:
            return

        # Look for breadcrumb links containing bostadsrättsförening
        for a in soup.find_all("a", href=True):
            href = a.get("href", "")
            text = a.get_text(strip=True)
            if "bostadsrattsforening" in href.lower() or "bostadsrättsförening" in text.lower():
                listing.brf_name = text
                id_match = re.search(r"/bostadsrattsforening/(\d+)", href)
                if id_match:
                    listing.brf_booli_id = int(id_match.group(1))
                break

    def _extract_from_html(self, listing: BooliListing, soup: BeautifulSoup) -> None:
        """Extract additional fields from HTML content."""
        text = soup.get_text(" ", strip=True)

        # Monthly fee
        fee_match = re.search(r"Avgift[:\s]*([\d\s\xa0]*)\s*kr", text)
        if fee_match and not listing.monthly_fee:
            fee_str = fee_match.group(1).replace("\xa0", "").replace(" ", "").strip()
            if fee_str:
                try:
                    listing.monthly_fee = float(fee_str)
                except ValueError:
                    pass

        # Year built
        year_match = re.search(r"Byggår[:\s]*(\d{4})", text)
        if year_match and not listing.year_built:
            listing.year_built = int(year_match.group(1))

        # Energy class
        energy_match = re.search(r"Energiklass[:\s]*([A-G])", text)
        if energy_match and not listing.energy_class:
            listing.energy_class = energy_match.group(1)

    def _parse_brf_page(self, url: str, html: str) -> BooliBRF:
        """Parse a Booli BRF page."""
        soup = BeautifulSoup(html, "lxml")
        brf = BooliBRF(raw={"url": url})

        # Extract BRF name from page title or heading
        h1 = soup.find("h1")
        if h1:
            brf.name = h1.get_text(strip=True)

        # Extract BRF ID from URL
        id_match = re.search(r"/bostadsrattsforening/(\d+)", url)
        if id_match:
            brf.booli_id = int(id_match.group(1))

        # Parse apartment list
        for table in soup.find_all("table"):
            for row in table.find_all("tr"):
                cells = row.find_all(["td", "th"])
                if len(cells) >= 2:
                    text = " ".join(c.get_text(strip=True) for c in cells)
                    if "m²" in text or "rum" in text:
                        brf.apartments.append({"text": text})

        # Extract year built and energy class from page
        text = soup.get_text(" ", strip=True)
        year_match = re.search(r"Byggår[:\s]*(\d{4})", text)
        if year_match:
            brf.year_built = int(year_match.group(1))

        energy_match = re.search(r"Energiklass[:\s]*([A-G])", text)
        if energy_match:
            brf.energy_class = energy_match.group(1)

        return brf


def _split_address(addr: str) -> tuple[str, str]:
    """Split 'street name 123A' into ('street name', '123a')."""
    match = re.match(r"^(.*?)\s+(\d+\w*)\s*$", addr.strip())
    if match:
        return (match.group(1).strip(), match.group(2).strip())
    return (addr.strip(), "")


def _normalize_address_for_search(address: str) -> str:
    """Strip apartment info like ', 6 tr', 'Lgh 1201', 'van 53' etc."""
    addr = address.strip()
    # Remove ", N tr" / ", N van" / ", N lgh" suffixes
    addr = re.sub(r",\s*\d+\s*(tr|van|lgh|plan|upd|etasg)\b.*$", "", addr, flags=re.IGNORECASE)
    # Remove "Lgh NNNN" suffix
    addr = re.sub(r"\s+Lgh\s+\d+.*$", "", addr, flags=re.IGNORECASE)
    # Remove trailing ", Stockholm" etc if present
    addr = re.sub(r",\s*[A-Z][a-z]+(\s+kommun)?$", "", addr)
    return addr.strip()
