"""End-to-end acquisition: a Hemnet listing URL to downloaded annual reports.

    Hemnet URL -> address/municipality/BRF name -> BRF (allabrf.se)
        -> official website -> annual reports -> downloaded PDFs

Each arrow is owned by an existing, focused component - this module
only wires them together and reports where the chain broke, if it did.
No PDF parsing or OCR happens here or anywhere in this chain.
"""

from __future__ import annotations

from datetime import datetime
from pathlib import Path

from pydantic import BaseModel, Field

from brf_scraper.discovery.allabrf_provider import AllabrfAcquisition, AllabrfProvider
from brf_scraper.discovery.hemnet_provider import HemnetListing, HemnetProvider
from brf_scraper.utils.logging import get_logger

logger = get_logger(__name__)


async def _camoufox_fetch(url: str) -> str:
    """Fetch a page with Camoufox, for use as HemnetProvider's browser fallback.

    Hemnet sits behind a Cloudflare JS challenge that plain HTTP can't
    pass; a real (anti-detection) browser is required to get through.
    """
    from brf_scraper.browser.camoufox_provider import CamoufoxProvider
    from brf_scraper.browser.models import BrowserConfig

    provider = CamoufoxProvider()
    result = await provider.fetch(url, config=BrowserConfig(timeout=45.0))
    if not result.is_success:
        raise RuntimeError(f"camoufox_fetch_failed: status={result.status_code} error={result.error}")
    return result.html


def _default_hemnet_provider() -> HemnetProvider:
    return HemnetProvider(browser_fetch=_camoufox_fetch)


class AcquisitionReport(BaseModel):
    """Stage-by-stage outcome of one Hemnet-to-PDFs run.

    Every stage that ran gets recorded here, successful or not, so a
    failure downstream (e.g. allabrf resolution) doesn't erase what the
    earlier stage (Hemnet extraction) already accomplished.
    """

    hemnet_url: str
    listing: HemnetListing | None = None
    acquisition: AllabrfAcquisition | None = None
    stage_reached: str = "started"
    success: bool = False
    errors: list[str] = Field(default_factory=list)
    started_at: datetime = Field(default_factory=datetime.now)
    completed_at: datetime | None = None

    def summary_lines(self) -> list[str]:
        """Human-readable per-stage pass/fail lines for a run report."""
        lines = [f"Hemnet URL: {self.hemnet_url}"]

        if self.listing is None:
            lines.append("  [FAIL] Hemnet extraction: no listing fetched")
            return lines
        lines.append(
            "  [OK] Hemnet extraction: "
            f"address={self.listing.address!r} municipality={self.listing.municipality!r} "
            f"brf_name={self.listing.brf_name!r}"
        )

        if self.acquisition is None:
            lines.append("  [FAIL] allabrf acquisition: not attempted")
            return lines

        acq = self.acquisition
        lines.append(
            f"  [{'OK' if acq.resolved else 'FAIL'}] BRF resolution: "
            f"{'matched ' + acq.candidate.name if acq.candidate else 'no match'} "
            f"({acq.candidates_considered} candidates considered)"
        )
        lines.append(
            f"  [{'OK' if acq.official_website else 'FAIL'}] Official website: "
            f"{acq.official_website or 'not found'}"
        )
        lines.append(f"  [{'OK' if acq.annual_reports else 'FAIL'}] Annual reports found: {len(acq.annual_reports)}")
        lines.append(
            f"  [{'OK' if acq.downloaded_ok else 'FAIL'}] PDFs downloaded: "
            f"{len(acq.downloaded_ok)}/{len(acq.annual_reports)}"
        )
        if acq.errors:
            lines.append(f"  errors: {'; '.join(acq.errors)}")

        return lines


async def acquire_from_hemnet_url(
    hemnet_url: str,
    download_dir: Path,
    hemnet_provider: HemnetProvider | None = None,
    allabrf_provider: AllabrfProvider | None = None,
    min_match_score: float = 0.4,
) -> AcquisitionReport:
    """Run the full Hemnet-listing-to-downloaded-PDFs pipeline.

    Args:
        hemnet_url: A hemnet.se listing URL.
        download_dir: Where downloaded annual report PDFs are written.
        hemnet_provider: Reused provider instance, or a fresh one per call.
        allabrf_provider: Reused provider instance, or a fresh one per call.
        min_match_score: Passed through to AllabrfProvider.acquire.

    Returns:
        AcquisitionReport describing exactly where the pipeline got to.
    """
    report = AcquisitionReport(hemnet_url=hemnet_url)
    owns_hemnet = hemnet_provider is None
    owns_allabrf = allabrf_provider is None
    hemnet = hemnet_provider or _default_hemnet_provider()
    allabrf = allabrf_provider or AllabrfProvider()

    try:
        if owns_hemnet:
            await hemnet.initialize()
        try:
            report.listing = await hemnet.fetch_listing(hemnet_url)
        except Exception as e:  # noqa: BLE001 - reported, not raised
            report.errors.append(f"hemnet_fetch_failed: {e!s}")
            report.completed_at = datetime.now()
            return report
        finally:
            if owns_hemnet:
                await hemnet.close()

        report.stage_reached = "hemnet_extracted"
        listing = report.listing
        if not listing.resolved:
            report.errors.append("hemnet_no_identifying_data: no address or BRF name extracted")
            report.completed_at = datetime.now()
            return report

        if owns_allabrf:
            await allabrf.initialize()
        try:
            report.acquisition = await allabrf.acquire(
                brf_name=listing.search_name,
                download_dir=download_dir,
                city=listing.municipality,
                min_match_score=min_match_score,
            )
        except Exception as e:  # noqa: BLE001
            report.errors.append(f"allabrf_acquire_failed: {e!s}")
            report.completed_at = datetime.now()
            return report
        finally:
            if owns_allabrf:
                await allabrf.close()

        report.stage_reached = "allabrf_completed"
        acq = report.acquisition
        report.success = acq.resolved and bool(acq.downloaded_ok)
        report.errors.extend(acq.errors)
        report.completed_at = datetime.now()
        return report
    finally:
        logger.info(
            "hemnet_acquisition_finished",
            url=hemnet_url,
            stage_reached=report.stage_reached,
            success=report.success,
        )
