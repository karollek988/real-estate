"""Unified BRF Profile Engine.

Orchestrates Hemnet + Booli + Allabrf + official website providers,
merges their output into a single ``BRFProfile``, and makes it available
to the analysis engine.
"""

from __future__ import annotations

import asyncio
from typing import Any, Callable, Awaitable

from brf_scraper.discovery.hemnet_provider import HemnetProvider, HemnetListing
from brf_scraper.discovery.allabrf_provider import AllabrfProvider, AllabrfCandidate
from brf_scraper.discovery.booli_provider import BooliProvider, BooliListing, BooliBRF
from brf_scraper.discovery.official_website import scrape_official_website, OfficialBRFData
from brf_scraper.profile.models import (
    BRFProfile, BRFIdentity, BRFApartments, BRFProperty,
    BRFPersonnel, BRFFinancials, SourcedValue, ApartmentListing,
    DocumentInfo, LoanInfo,
)
from brf_scraper.profile.merge import merge_profiles, DEFAULT_SOURCE_PRIORITY
from brf_scraper.extractor.engine import extract_annual_report
from brf_scraper.utils.logging import get_logger

logger = get_logger(__name__)


def _sv(value: Any, source: str, confidence: float = 1.0, **kw: Any) -> SourcedValue | None:
    """Create a SourcedValue if value is not None/empty."""
    if value is None or value == "":
        return None
    return SourcedValue(
        value=value,
        sources=[source],
        confidence=confidence,
        **kw,
    )


class ProfileEngine:
    """Builds a unified BRFProfile from multiple sources.

    Usage::

        engine = ProfileEngine(browser_fetch=camoufox_fetch)
        profile = await engine.build(hemnet_url="https://www.hemnet.se/...")
    """

    def __init__(
        self,
        browser_fetch: Callable[[str], Awaitable[str]] | None = None,
        source_priority: list[str] | None = None,
    ) -> None:
        self._browser_fetch = browser_fetch
        self._priority = source_priority or DEFAULT_SOURCE_PRIORITY

    async def build(
        self,
        hemnet_url: str | None = None,
        brf_name: str | None = None,
        municipality: str | None = None,
    ) -> BRFProfile:
        """Build a unified profile from available sources.

        Args:
            hemnet_url: Optional Hemnet listing URL to start from.
            brf_name: Optional BRF name (if no Hemnet URL).
            municipality: Optional city/municipality hint.

        Returns:
            Merged BRFProfile with data from all available sources.
        """
        profiles: dict[str, BRFProfile] = {}
        errors: list[str] = []

        # Stage 1: Hemnet
        hemnet_listing = None
        if hemnet_url:
            try:
                hemnet_listing = await self._fetch_hemnet(hemnet_url)
                profiles["hemnet"] = self._hemnet_to_profile(hemnet_listing)
                # Use Hemnet data to improve subsequent searches
                if not brf_name and hemnet_listing.brf_name:
                    brf_name = hemnet_listing.brf_name
                if not municipality and hemnet_listing.municipality:
                    municipality = hemnet_listing.municipality
                if not brf_name and hemnet_listing.address:
                    brf_name = hemnet_listing.address
            except Exception as e:
                errors.append(f"hemnet: {e}")
                logger.warning("hemnet_failed", error=str(e))

        # Stage 2: Booli
        booli_listing = None
        booli_brf = None
        if brf_name:
            try:
                booli_listing, booli_brf = await self._fetch_booli(
                    brf_name, municipality, hemnet_listing
                )
                if booli_listing or booli_brf:
                    profiles["booli"] = self._booli_to_profile(
                        booli_listing, booli_brf
                    )
            except Exception as e:
                errors.append(f"booli: {e}")
                logger.warning("booli_failed", error=str(e))

        # Stage 3: Allabrf
        allabrf_acq = None
        if brf_name:
            try:
                org_number = hemnet_listing.org_number if hemnet_listing else None
                allabrf_acq = await self._fetch_allabrf(brf_name, municipality, org_number)
                if allabrf_acq:
                    profiles["allabrf"] = self._allabrf_to_profile(allabrf_acq)
            except Exception as e:
                errors.append(f"allabrf: {e}")
                logger.warning("allabrf_failed", error=str(e))

        # Stage 4: Official BRF website (Allabrf discovery + search engine fallback)
        official_url = None
        if allabrf_acq and allabrf_acq.official_website:
            official_url = allabrf_acq.official_website

        # If Allabrf didn't find a website, try DuckDuckGo
        if not official_url and brf_name:
            official_url = await self._search_official_website(brf_name, municipality)

        if official_url:
            try:
                official_data = await self._fetch_official_website(official_url)
                if official_data:
                    profiles["official_website"] = self._official_website_to_profile(
                        official_data, official_url
                    )
            except Exception as e:
                errors.append(f"official_website: {e}")
                logger.warning("official_website_failed", url=official_url, error=str(e))

        # Stage 4: Merge
        if not profiles:
            # No data at all — return empty profile
            return BRFProfile(meta={
                "sources_queried": [],
                "profile_confidence": 0.0,
                "errors": errors,
            })

        merged = merge_profiles(profiles, self._priority)
        merged.meta["errors"] = errors

        # Merge documents from Allabrf
        if allabrf_acq:
            for doc in allabrf_acq.documents:
                merged.documents.append(DocumentInfo(
                    title=doc.title,
                    doc_type=doc.doc_type.value,
                    year=doc.year,
                    url=doc.url,
                    downloadable=doc.is_downloadable,
                    source="allabrf",
                ))

        # Stage 5: Extract financial data from annual reports
        # (checks .documents, not .downloads — _extract_annual_reports fetches
        # the target PDF itself and never reads allabrf_acq.downloads, which
        # stays empty because _fetch_allabrf intentionally calls acquire()
        # with download=False to skip persisting every annual report to disk)
        if allabrf_acq and allabrf_acq.documents:
            try:
                await self._extract_annual_reports(merged, allabrf_acq)
            except Exception as e:
                errors.append(f"extraction: {e}")
                logger.warning("extraction_failed", error=str(e))

        logger.info(
            "profile_built",
            sources=list(profiles.keys()),
            confidence=merged.meta.get("profile_confidence", 0),
            errors=len(errors),
        )

        return merged

    async def _fetch_hemnet(self, url: str) -> HemnetListing:
        """Fetch Hemnet listing."""
        provider = HemnetProvider(browser_fetch=self._browser_fetch)
        try:
            await provider.initialize()
            return await provider.fetch_listing(url)
        finally:
            await provider.close()

    async def _fetch_booli(
        self,
        brf_name: str,
        municipality: str | None,
        hemnet_listing: HemnetListing | None,
    ) -> tuple[BooliListing | None, BooliBRF | None]:
        """Fetch Booli listing and BRF page."""
        provider = BooliProvider(browser_fetch=self._browser_fetch)
        booli_listing = None
        booli_brf = None

        # Try to find a matching Booli listing
        if hemnet_listing and hemnet_listing.address:
            # Search Booli for the same address
            try:
                results = await provider.search_brf(hemnet_listing.address, municipality)
                if results:
                    first_url = results[0].get("url", "")
                    if first_url:
                        if not first_url.startswith("http"):
                            first_url = f"https://www.booli.se{first_url}"
                        booli_listing = await provider.fetch_listing(first_url)
            except Exception as e:
                logger.warning("booli_listing_search_failed", error=str(e))

        # If we found a BRF link, fetch the BRF page
        if booli_listing and booli_listing.brf_booli_id:
            try:
                booli_brf = await provider.fetch_brf_page(booli_listing.brf_booli_id)
            except Exception as e:
                logger.warning("booli_brf_page_failed", error=str(e))

        # If no listing found, try searching by name
        if not booli_listing and brf_name:
            try:
                results = await provider.search_brf(brf_name, municipality)
                if results:
                    first_url = results[0].get("url", "")
                    if first_url:
                        if not first_url.startswith("http"):
                            first_url = f"https://www.booli.se{first_url}"
                        booli_listing = await provider.fetch_listing(first_url)
                        if booli_listing and booli_listing.brf_booli_id:
                            booli_brf = await provider.fetch_brf_page(booli_listing.brf_booli_id)
            except Exception as e:
                logger.warning("booli_name_search_failed", error=str(e))

        return booli_listing, booli_brf

    async def _fetch_allabrf(
        self, brf_name: str, municipality: str | None, org_number: str | None = None
    ) -> Any:
        """Fetch Allabrf data."""
        provider = AllabrfProvider()
        try:
            await provider.initialize()
            return await provider.acquire(
                brf_name=brf_name,
                city=municipality,
                org_number=org_number,
                download_dir=None,  # Don't download PDFs in profile build
                download=False,
            )
        finally:
            await provider.close()

    # ── Converters: provider output → BRFProfile ───────────────────

    def _hemnet_to_profile(self, listing: HemnetListing) -> BRFProfile:
        """Convert HemnetListing to BRFProfile."""
        return BRFProfile(
            brf=BRFIdentity(
                name=_sv(listing.brf_name, "hemnet", 0.9) if listing.brf_name else None,
                address=_sv(listing.address, "hemnet", 0.95) if listing.address else None,
                municipality=_sv(listing.municipality, "hemnet", 0.9) if listing.municipality else None,
                postal_code=_sv(listing.postal_code, "hemnet", 0.95) if listing.postal_code else None,
                organization_number=_sv(listing.org_number, "hemnet", 1.0) if listing.org_number else None,
            ),
            apartments=BRFApartments(
                avg_monthly_fee=_sv(listing.monthly_fee, "hemnet", 0.9) if listing.monthly_fee else None,
            ),
            property=BRFProperty(
                year_built=_sv(listing.year_built, "hemnet", 0.85) if listing.year_built else None,
            ),
            meta={"source": "hemnet", "hemnet_url": listing.url},
        )

    def _booli_to_profile(
        self,
        listing: BooliListing | None,
        brf: BooliBRF | None,
    ) -> BRFProfile:
        """Convert Booli data to BRFProfile."""
        identity = BRFIdentity()
        apartments = BRFApartments()
        prop = BRFProperty()

        if listing:
            identity.name = _sv(listing.brf_name, "booli", 0.85) if listing.brf_name else None
            identity.address = _sv(listing.address, "booli", 0.9) if listing.address else None
            identity.postal_code = _sv(listing.postal_code, "booli", 0.9) if listing.postal_code else None

            if listing.monthly_fee:
                apartments.avg_monthly_fee = _sv(listing.monthly_fee, "booli", 0.8)

            if listing.year_built:
                prop.year_built = _sv(listing.year_built, "booli", 0.8)
            if listing.energy_class:
                prop.energy_class = _sv(listing.energy_class, "booli", 0.8)
            if listing.area_sqm:
                prop.building_area_sqm = _sv(listing.area_sqm, "booli", 0.7)

        if brf:
            identity.name = identity.name or _sv(brf.name, "booli", 0.85) if brf.name else None
            if brf.total_apartments:
                apartments.owner_occupied = _sv(brf.total_apartments, "booli", 0.8)
            if brf.year_built:
                prop.year_built = prop.year_built or _sv(brf.year_built, "booli", 0.8)
            if brf.energy_class:
                prop.energy_class = prop.energy_class or _sv(brf.energy_class, "booli", 0.8)

            # Convert apartment list
            for apt in brf.apartments:
                apartments.units.append(ApartmentListing(
                    source="booli",
                    area_sqm=apt.get("area_sqm"),
                    rooms=apt.get("rooms"),
                ))

        return BRFProfile(
            brf=identity,
            apartments=apartments,
            property=prop,
            meta={"source": "booli"},
        )

    def _allabrf_to_profile(self, acq: Any) -> BRFProfile:
        """Convert AllabrfAcquisition to BRFProfile."""
        identity = BRFIdentity()
        personnel = BRFPersonnel()
        prop = BRFProperty()
        apartments = BRFApartments()

        if acq.candidate:
            identity.name = _sv(acq.candidate.name, "allabrf", 0.95) if acq.candidate.name else None
            identity.organization_number = (
                _sv(acq.candidate.org_number, "allabrf", 1.0)
                if acq.candidate.org_number else None
            )
            identity.county = _sv(acq.candidate.county, "allabrf", 0.9) if acq.candidate.county else None
            identity.website_url = (
                _sv(acq.official_website, "allabrf", 0.8)
                if acq.official_website else None
            )

        # Metadata from profile page
        if acq.metadata:
            meta = acq.metadata
            if "Registreringsår" in meta:
                try:
                    identity.founding_year = _sv(int(meta["Registreringsår"]), "allabrf", 0.9)
                except (ValueError, TypeError):
                    pass
            if "Antal lägenheter" in meta:
                try:
                    apartments.owner_occupied = _sv(int(meta["Antal lägenheter"]), "allabrf", 0.9)
                except (ValueError, TypeError):
                    pass

        return BRFProfile(
            brf=identity,
            apartments=apartments,
            property=prop,
            personnel=personnel,
            meta={"source": "allabrf"},
        )

    async def _search_official_website(
        self, brf_name: str, municipality: str | None = None
    ) -> str | None:
        """Search DuckDuckGo for the BRF's official website."""
        if not self._browser_fetch:
            return None

        query = f"{brf_name} bostadsrättsförening"
        url = f"https://html.duckduckgo.com/html/?q={query.replace(' ', '+')}"

        try:
            html = await self._browser_fetch(url)
        except Exception:
            return None

        if not html:
            return None

        from bs4 import BeautifulSoup
        from urllib.parse import unquote

        soup = BeautifulSoup(html, "lxml")

        blocked = {
            "allabrf.se", "brfdata.se", "anbudskollen.se", "bosak.se",
            "hedvig.com", "hemnet.se", "booli.se", "google.com",
            "facebook.com", "instagram.com", "linkedin.com", "twitter.com",
            "youtube.com", "wikipedia.org", "bankid.com",
            "allabolag.se", "bolagsfakta.se", "reelai.io",
            "hittamaklare.se", "yasii.se", "www.google.com",
            "notar.se", "lansfast.se", "historiskahem.se",
            "hittabrf.se", "svenskfast.se", "pkabyggmklare.se",
            "fastighetsbyran.se", "eurocard.se",
            "hittakop.se", "maklarstatistik.se", "qasa.se",
            "samtrygg.se", "sturepfastigheter.se",
            "bovision.se", "boneo.se", "duckduckgo.com",
            "sbc.se", "hemsida.sbc.se",
            "lageskollen.se", "wallinco.se", "tjanstetorget.se",
            "maklare.se", "budgivarna.se", "mklng.se",
            "fastighetsmaklarstatistik.se", "exbo.se",
        }

        for a in soup.find_all("a", class_="result__a", href=True):
            href = a.get("href", "")
            if "uddg=" in href:
                actual_url = unquote(href.split("uddg=")[1].split("&")[0])
            elif href.startswith("http"):
                actual_url = href
            else:
                continue

            try:
                domain = actual_url.split("/")[2].lower()
            except (IndexError, ValueError):
                continue

            # Skip DuckDuckGo ads and tracking URLs
            if "duckduckgo.com/y.js" in actual_url or "bing.com/aclick" in actual_url:
                continue

            if any(b in domain for b in blocked):
                continue

            logger.info(
                "official_website_discovered",
                url=actual_url,
                domain=domain,
                brf_name=brf_name,
            )
            return actual_url

        logger.debug("official_website_not_found", brf_name=brf_name)
        return None

    async def _fetch_official_website(self, url: str) -> OfficialBRFData | None:
        """Fetch and scrape the official BRF website."""
        if not self._browser_fetch:
            logger.warning("no_browser_fetch_for_official_website", url=url)
            return None
        html = await self._browser_fetch(url)
        if not html:
            return None
        return scrape_official_website(html, url)

    def _official_website_to_profile(
        self, data: OfficialBRFData, url: str
    ) -> BRFProfile:
        """Convert OfficialBRFData to BRFProfile."""
        identity = BRFIdentity(
            website_url=_sv(url, "official_website", 1.0),
        )
        personnel = BRFPersonnel()

        # Board members
        for member in data.board_members:
            role = member.get("role", "").lower()
            name = member.get("name", "")
            if not name:
                continue
            if "ordförande" in role and "vice" not in role:
                personnel.chairman = _sv(name, "official_website", 0.8)
            elif "vice" in role:
                personnel.vice_chairman = _sv(name, "official_website", 0.8)
            elif "kassör" in role:
                personnel.treasurer = _sv(name, "official_website", 0.8)
            elif "sekreterare" in role:
                personnel.secretary = _sv(name, "official_website", 0.8)

        return BRFProfile(
            brf=identity,
            personnel=personnel,
            meta={"source": "official_website", "official_url": url},
        )

    async def _extract_annual_reports(
        self, profile: BRFProfile, allabrf_acq: Any
    ) -> None:
        """Download and extract financial data from annual report PDFs."""
        from pathlib import Path
        import tempfile
        import httpx

        annual_report_docs = [
            doc for doc in allabrf_acq.documents
            if hasattr(doc, 'doc_type') and doc.doc_type.value == "annual_report" and doc.is_downloadable
        ]

        if not annual_report_docs:
            return

        logger.info(
            "extraction_starting",
            num_reports=len(annual_report_docs),
        )

        # Find the most recent annual report
        dated_docs = [d for d in annual_report_docs if d.year]
        if dated_docs:
            dated_docs.sort(key=lambda d: d.year or 0, reverse=True)
            target_doc = dated_docs[0]
        else:
            target_doc = annual_report_docs[0]

        # Download the PDF
        try:
            async with httpx.AsyncClient(follow_redirects=True, timeout=30) as client:
                resp = await client.get(target_doc.url)
                if resp.status_code != 200:
                    logger.warning("pdf_download_failed", status=resp.status_code)
                    return

                content = resp.content
                if not content.startswith(b"%PDF"):
                    logger.warning("pdf_not_valid", url=target_doc.url)
                    return

                # Write to temp file
                suffix = f"_{target_doc.year}" if target_doc.year else ""
                with tempfile.NamedTemporaryFile(
                    suffix=f"{suffix}.pdf", delete=False
                ) as tmp:
                    tmp.write(content)
                    tmp_path = tmp.name

        except Exception as e:
            logger.warning("pdf_download_error", error=str(e))
            return

        # Extract data
        result = extract_annual_report(tmp_path)

        # Populate profile financials. Only VERIFIED fields (see
        # extractor/validation.py) are written into BRFFinancials -
        # BRFProfile is the one object the analysis engine consumes, so this
        # is the choke point that keeps an unverified value from ever
        # reaching calculate_metrics(). The raw extraction (with its full
        # .verification audit trail, including discarded fields and why)
        # stays on `result` for logging/debugging, but is never assigned here.
        if result.is_text_based and result.has_financial_data:
            f = profile.financials
            f.fiscal_year = result.fiscal_year
            f.source = result.pdf_path
            f.extraction_confidence = result.average_confidence
            f.verification_status = (
                "ok" if result.has_verified_financial_data else "insufficient_verified_data"
            )

            # Map VERIFIED extracted data to BRFFinancials
            f.income_statement = {
                k: {"value": v.value, "unit": v.unit, "source": {
                    "page": v.evidence.page,
                    "field": v.evidence.field,
                    "method": v.evidence.method,
                    "confidence": v.evidence.confidence,
                }}
                for k, v in result.verified_income_statement.items()
            }
            f.balance_sheet = {
                k: {"value": v.value, "unit": v.unit, "source": {
                    "page": v.evidence.page,
                    "field": v.evidence.field,
                    "method": v.evidence.method,
                    "confidence": v.evidence.confidence,
                }}
                for k, v in result.verified_balance_sheet.items()
            }
            f.apartment_metrics = {
                k: {"value": v.value, "unit": v.unit, "source": {
                    "page": v.evidence.page,
                    "field": v.evidence.field,
                    "method": v.evidence.method,
                    "confidence": v.evidence.confidence,
                }}
                for k, v in result.verified_apartment_metrics.items()
            }
            f.property_info = {
                k: {"value": v.value, "unit": v.unit, "source": {
                    "page": v.evidence.page,
                    "field": v.evidence.field,
                    "method": v.evidence.method,
                    "confidence": v.evidence.confidence,
                }}
                for k, v in result.verified_property_info.items()
            }
            f.loans = [
                LoanInfo(
                    lender=loan["lender"].value if "lender" in loan else "Unknown",
                    remaining_amount=SourcedValue(
                        value=loan["remaining_amount"].value,
                        source="annual_report",
                        confidence=loan["remaining_amount"].evidence.confidence,
                    ) if "remaining_amount" in loan else None,
                    interest_rate_percent=SourcedValue(
                        value=loan["interest_rate_percent"].value,
                        source="annual_report",
                        confidence=loan["interest_rate_percent"].evidence.confidence,
                    ) if "interest_rate_percent" in loan else None,
                )
                for loan in result.verified_loans
            ]

            # Update profile apartment data from extraction - only from
            # verified values, and carrying the field's real confidence
            # (previously hardcoded to 0.85/0.80 regardless of how the value
            # was actually extracted, which could mask a low-confidence guess).
            apt = profile.apartments
            verified_apt = result.verified_apartment_metrics
            if "number_of_apartments" in verified_apt:
                ev = verified_apt["number_of_apartments"]
                if isinstance(ev.value, (int, float)) and ev.value > 0:
                    apt.owner_occupied = _sv(int(ev.value), "annual_report", ev.evidence.confidence)
            if "avg_monthly_fee" in verified_apt:
                ev = verified_apt["avg_monthly_fee"]
                if isinstance(ev.value, (int, float)) and ev.value > 0:
                    apt.avg_monthly_fee = _sv(float(ev.value), "annual_report", ev.evidence.confidence)

            # Update property data from extraction - verified only.
            prop = profile.property
            verified_prop = result.verified_property_info
            if "year_built" in verified_prop:
                ev = verified_prop["year_built"]
                if isinstance(ev.value, (int, float)):
                    prop.year_built = _sv(int(ev.value), "annual_report", ev.evidence.confidence)
            if "building_area_sqm" in verified_prop:
                ev = verified_prop["building_area_sqm"]
                if isinstance(ev.value, (int, float)):
                    prop.building_area_sqm = _sv(float(ev.value), "annual_report", ev.evidence.confidence)

            discarded = [v for v in result.verification.values() if not v.verified]
            logger.info(
                "extraction_completed",
                fiscal_year=result.fiscal_year,
                values=result.total_values_extracted,
                confidence=round(result.average_confidence, 2),
                income=len(f.income_statement),
                balance=len(f.balance_sheet),
                verification_status=f.verification_status,
                discarded_fields=len(discarded),
            )
        else:
            logger.info(
                "extraction_no_data",
                is_text_based=result.is_text_based,
                reason="scanned image" if not result.is_text_based else "no financial data found",
            )

        # Cleanup temp file
        try:
            Path(tmp_path).unlink()
        except Exception:
            pass
