"""Integration tests for the smoke test pipeline."""

from __future__ import annotations

import hashlib
import uuid
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock

import pytest

from brf_scraper.crawler.models import (
    ContentType,
    CrawlMetrics,
    DocumentReference,
    DocumentStatus,
)
from brf_scraper.discovery.models import (
    DiscoveredBRF,
    DiscoveryResult,
    DiscoverySource,
)
from brf_scraper.downloader.models import (
    Document,
    DownloadResult,
    DownloadStatus,
)
from brf_scraper.smoke_test import (
    SmokeTest,
    SmokeTestReport,
    format_report,
    is_likely_annual_report,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_discovered_brf(
    name: str = "BRF Test",
    url: str = "https://www.brf-test.se",
) -> DiscoveredBRF:
    return DiscoveredBRF(
        name=name,
        website_url=url,
        source=DiscoverySource.SEARCH_ENGINE,
    )


def _make_pdf_doc(
    url: str = "https://www.brf-test.se/arsredovisning-2023.pdf",
    source_url: str = "https://www.brf-test.se",
    filename: str | None = None,
    title: str | None = None,
    year: int | None = 2023,
) -> DocumentReference:
    from pathlib import Path

    if filename is None:
        filename = Path(url).name
    if title is None:
        title = Path(url).stem

    return DocumentReference(
        source_url=source_url,
        document_url=url,
        title=title,
        filename=filename,
        year=year,
        content_type=ContentType.PDF,
        status=DocumentStatus.DISCOVERED,
    )


def _make_download_result(
    filename: str = "arsredovisning-2023.pdf",
    status: DownloadStatus = DownloadStatus.COMPLETED,
    content: bytes = b"pdf-content",
) -> DownloadResult:
    checksum = hashlib.sha256(content).hexdigest()
    doc = Document(
        source_url=f"https://www.brf-test.se/{filename}",
        original_filename=filename,
        sha256_checksum=checksum,
        file_size=len(content),
        mime_type="application/pdf",
        download_status=status,
    )
    return DownloadResult(
        request_id=uuid.uuid4(),
        document=doc,
        status=status,
        started_at=datetime.now(),
        completed_at=datetime.now(),
    )


def _build_mock_discovery_engine(
    brfs: list[DiscoveredBRF] | None = None,
    *,
    empty: bool = False,
) -> AsyncMock:
    """Build a mock DiscoveryEngine.

    Args:
        brfs: List of BRFs to return. Defaults to a single test BRF.
        empty: If True, return an empty result regardless of brfs.
    """
    engine = AsyncMock()
    engine.initialize = AsyncMock()
    engine.close = AsyncMock()

    result = DiscoveryResult(source=DiscoverySource.SEARCH_ENGINE)
    if not empty:
        for brf in (brfs if brfs is not None else [_make_discovered_brf()]):
            result.add_brf(brf)

    engine.discover = AsyncMock(return_value=result)
    return engine


def _build_mock_crawler_engine(
    pdfs: list[DocumentReference] | None = None,
    pages_crawled: int = 10,
    internal_links: int = 30,
    external_links: int = 5,
) -> AsyncMock:
    """Build a mock CrawlerEngine."""
    engine = AsyncMock()
    engine.initialize = AsyncMock()
    engine.close = AsyncMock()

    metrics = CrawlMetrics(
        pages_crawled=pages_crawled,
        internal_links=internal_links,
        external_links=external_links,
        pdfs_found=len(pdfs or []),
    )
    engine.crawl = AsyncMock(return_value=metrics)
    engine.get_pdf_documents = MagicMock(return_value=pdfs or [])
    return engine


def _build_mock_download_manager(
    results: list[DownloadResult] | None = None,
) -> AsyncMock:
    """Build a mock DownloadManager."""
    mgr = AsyncMock()
    mgr.initialize = AsyncMock()
    mgr.close = AsyncMock()

    final_results = results or [_make_download_result()]
    mgr.download_many = AsyncMock(return_value=final_results)
    mgr.results = final_results
    return mgr


# ---------------------------------------------------------------------------
# Tests: is_likely_annual_report
# ---------------------------------------------------------------------------


class TestIsLikelyAnnualReport:
    """Tests for the annual report detection heuristic."""

    def test_arsredovisning_in_filename(self) -> None:
        doc = _make_pdf_doc(filename="arsredovisning-2023.pdf")
        assert is_likely_annual_report(doc) is True

    def test_araringredovisning_in_filename(self) -> None:
        doc = _make_pdf_doc(filename="årsredovisning-2024.pdf")
        assert is_likely_annual_report(doc) is True

    def test_annual_report_in_url(self) -> None:
        doc = _make_pdf_doc(
            url="https://www.brf.se/docs/annual-report-2023.pdf",
            filename="annual-report-2023.pdf",
        )
        assert is_likely_annual_report(doc) is True

    def test_year_in_filename(self) -> None:
        doc = _make_pdf_doc(filename="rapport-2023.pdf")
        assert is_likely_annual_report(doc) is True

    def test_stadgar_not_annual_report(self) -> None:
        doc = _make_pdf_doc(
            url="https://www.brf-test.se/stadgar.pdf",
            filename="stadgar.pdf",
            year=None,
        )
        assert is_likely_annual_report(doc) is False

    def test_referens_not_annual_report(self) -> None:
        doc = _make_pdf_doc(
            url="https://www.brf-test.se/referens.pdf",
            filename="referens.pdf",
            year=None,
        )
        assert is_likely_annual_report(doc) is False

    def test_title_contains_keyword(self) -> None:
        doc = _make_pdf_doc(
            filename="dokument.pdf",
            title="Årsredovisning 2023",
        )
        assert is_likely_annual_report(doc) is True

    def test_annual_dash_report(self) -> None:
        doc = _make_pdf_doc(
            url="https://www.brf.se/annual-report.pdf",
            filename="annual-report.pdf",
        )
        assert is_likely_annual_report(doc) is True

    def test_annual_underscore_report(self) -> None:
        doc = _make_pdf_doc(
            url="https://www.brf.se/annual_report.pdf",
            filename="annual_report.pdf",
        )
        assert is_likely_annual_report(doc) is True


# ---------------------------------------------------------------------------
# Tests: format_report
# ---------------------------------------------------------------------------


class TestFormatReport:
    """Tests for the report formatter."""

    def test_pass_report(self) -> None:
        report = SmokeTestReport(
            brf_name="BRF Solgläntan",
            website_url="https://www.brf-solgläntan.se",
            discovery_provider="search_engine_duckduckgo",
            pages_crawled=15,
            internal_links=42,
            external_links=8,
            pdfs_found=5,
            annual_reports_detected=3,
            downloaded=3,
            duplicates=0,
            errors=0,
            downloaded_files=["arsredovisning-2024.pdf", "arsredovisning-2023.pdf"],
            execution_time=12.3,
            passed=True,
        )
        output = format_report(report)

        assert "BRF Solgläntan" in output
        assert "https://www.brf-solgläntan.se" in output
        assert "search_engine_duckduckgo" in output
        assert "Pages crawled: 15" in output
        assert "Internal links: 42" in output
        assert "External links: 8" in output
        assert "PDFs found: 5" in output
        assert "Annual reports detected: 3" in output
        assert "Downloaded: 3" in output
        assert "Duplicates: 0" in output
        assert "Errors: 0" in output
        assert "- arsredovisning-2024.pdf" in output
        assert "- arsredovisning-2023.pdf" in output
        assert "Execution time: 12.3s" in output
        assert "PASS" in output
        assert "FAIL" not in output

    def test_fail_report(self) -> None:
        report = SmokeTestReport(
            brf_name="BRF Missing",
            passed=False,
            failed_stage="discovery",
            failed_error="Could not find website",
        )
        output = format_report(report)

        assert "FAIL" in output
        assert "Failed at stage: discovery" in output
        assert "Could not find website" in output

    def test_no_downloaded_files(self) -> None:
        report = SmokeTestReport(
            brf_name="BRF Empty",
            passed=True,
        )
        output = format_report(report)
        assert "Downloaded files: None" in output

    def test_report_contains_separator(self) -> None:
        report = SmokeTestReport(brf_name="X", passed=True)
        output = format_report(report)
        assert "=" * 40 in output


# ---------------------------------------------------------------------------
# Tests: SmokeTestReport dataclass
# ---------------------------------------------------------------------------


class TestSmokeTestReport:
    """Tests for the report dataclass."""

    def test_defaults(self) -> None:
        report = SmokeTestReport(brf_name="Test")
        assert report.brf_name == "Test"
        assert report.website_url is None
        assert report.pages_crawled == 0
        assert report.pdfs_found == 0
        assert report.downloaded == 0
        assert report.passed is False
        assert report.downloaded_files == []


# ---------------------------------------------------------------------------
# Tests: SmokeTest pipeline — full success
# ---------------------------------------------------------------------------


@pytest.mark.integration
class TestSmokeTestPipeline:
    """Integration tests for the SmokeTest orchestrator."""

    async def test_full_pipeline_pass(self, tmp_path: object) -> None:
        """Complete pipeline: discover → crawl → PDFs → annual reports → download."""
        import pathlib

        pdfs = [
            _make_pdf_doc(
                url="https://www.brf-test.se/arsredovisning-2023.pdf",
                filename="arsredovisning-2023.pdf",
                year=2023,
            ),
            _make_pdf_doc(
                url="https://www.brf-test.se/arsredovisning-2022.pdf",
                filename="arsredovisning-2022.pdf",
                year=2022,
            ),
        ]

        discovery = _build_mock_discovery_engine([_make_discovered_brf()])
        crawler = _build_mock_crawler_engine(pdfs=pdfs, pages_crawled=10)
        download_mgr = _build_mock_download_manager([
            _make_download_result("arsredovisning-2023.pdf"),
            _make_download_result("arsredovisning-2022.pdf"),
        ])

        test = SmokeTest(
            brf_name="BRF Test",
            tmp_dir=pathlib.Path(str(tmp_path)),
            discovery_engine=discovery,
            crawler_engine=crawler,
            download_manager=download_mgr,
        )

        report = await test.run()

        assert report.passed is True
        assert report.brf_name == "BRF Test"
        assert report.website_url == "https://www.brf-test.se/"
        assert report.pages_crawled == 10
        assert report.pdfs_found == 2
        assert report.annual_reports_detected == 2
        assert report.downloaded == 2
        assert report.errors == 0
        assert len(report.downloaded_files) == 2

        discovery.initialize.assert_awaited_once()
        crawler.initialize.assert_awaited_once()
        crawler.crawl.assert_awaited_once()
        download_mgr.initialize.assert_awaited_once()
        download_mgr.download_many.assert_awaited_once()

    async def test_no_pdfs_found(self, tmp_path: object) -> None:
        """Pipeline completes when crawl finds no PDFs."""
        import pathlib

        discovery = _build_mock_discovery_engine([_make_discovered_brf()])
        crawler = _build_mock_crawler_engine(pdfs=[], pages_crawled=5)
        download_mgr = _build_mock_download_manager([])

        test = SmokeTest(
            brf_name="BRF No PDFs",
            tmp_dir=pathlib.Path(str(tmp_path)),
            discovery_engine=discovery,
            crawler_engine=crawler,
            download_manager=download_mgr,
        )

        report = await test.run()

        assert report.passed is True
        assert report.pdfs_found == 0
        assert report.annual_reports_detected == 0
        assert report.downloaded == 0
        download_mgr.download_many.assert_not_awaited()

    async def test_no_annual_reports_uses_all_pdfs(self, tmp_path: None) -> None:
        """When no annual reports detected, download all PDFs as fallback."""
        import pathlib

        # PDFs that don't match annual report heuristics
        pdfs = [
            _make_pdf_doc(
                url="https://www.brf-test.se/stadgar.pdf",
                filename="stadgar.pdf",
                title="Stadgar",
                year=None,
            ),
        ]

        discovery = _build_mock_discovery_engine([_make_discovered_brf()])
        crawler = _build_mock_crawler_engine(pdfs=pdfs, pages_crawled=3)
        download_mgr = _build_mock_download_manager([
            _make_download_result("stadgar.pdf"),
        ])

        test = SmokeTest(
            brf_name="BRF Test",
            tmp_dir=pathlib.Path(str(tmp_path)),
            discovery_engine=discovery,
            crawler_engine=crawler,
            download_manager=download_mgr,
        )

        report = await test.run()

        assert report.passed is True
        assert report.pdfs_found == 1
        assert report.annual_reports_detected == 0
        assert report.downloaded == 1

    async def test_discovery_failure(self, tmp_path: object) -> None:
        """Pipeline fails when discovery finds no matching BRF."""
        import pathlib

        discovery = _build_mock_discovery_engine(empty=True)

        test = SmokeTest(
            brf_name="BRF Nonexistent",
            tmp_dir=pathlib.Path(str(tmp_path)),
            discovery_engine=discovery,
        )

        report = await test.run()

        assert report.passed is False
        assert report.failed_stage == "discovery"
        assert "Could not find website" in (report.failed_error or "")

    async def test_download_partial_failure(self, tmp_path: object) -> None:
        """Some downloads fail while others succeed."""
        import pathlib

        pdfs = [
            _make_pdf_doc(
                url=f"https://www.brf-test.se/doc{i}.pdf",
                filename=f"arsredovisning-202{i}.pdf",
                year=2020 + i,
            )
            for i in range(3)
        ]

        results = [
            _make_download_result("arsredovisning-2023.pdf"),
            _make_download_result(
                "arsredovisning-2022.pdf", status=DownloadStatus.FAILED
            ),
            _make_download_result("arsredovisning-2021.pdf"),
        ]

        discovery = _build_mock_discovery_engine([_make_discovered_brf()])
        crawler = _build_mock_crawler_engine(pdfs=pdfs, pages_crawled=8)
        download_mgr = _build_mock_download_manager(results)

        test = SmokeTest(
            brf_name="BRF Test",
            tmp_dir=pathlib.Path(str(tmp_path)),
            discovery_engine=discovery,
            crawler_engine=crawler,
            download_manager=download_mgr,
        )

        report = await test.run()

        assert report.passed is True
        assert report.downloaded == 2
        assert report.errors == 1

    async def test_duplicate_detection(self, tmp_path: object) -> None:
        """Duplicate documents are counted correctly."""
        import pathlib

        pdfs = [
            _make_pdf_doc(
                url="https://www.brf-test.se/arsredovisning-2023.pdf",
                filename="arsredovisning-2023.pdf",
            ),
        ]

        results = [
            _make_download_result("arsredovisning-2023.pdf"),
            _make_download_result(
                "arsredovisning-2023.pdf", status=DownloadStatus.DUPLICATE
            ),
        ]

        discovery = _build_mock_discovery_engine([_make_discovered_brf()])
        crawler = _build_mock_crawler_engine(pdfs=pdfs, pages_crawled=5)
        download_mgr = _build_mock_download_manager(results)

        test = SmokeTest(
            brf_name="BRF Test",
            tmp_dir=pathlib.Path(str(tmp_path)),
            discovery_engine=discovery,
            crawler_engine=crawler,
            download_manager=download_mgr,
        )

        report = await test.run()

        assert report.passed is True
        assert report.downloaded == 1
        assert report.duplicates == 1

    async def test_report_format_integration(self, tmp_path: object) -> None:
        """Verify format_report produces expected output from a real run."""
        import pathlib

        pdfs = [
            _make_pdf_doc(
                url="https://www.brf-test.se/arsredovisning-2023.pdf",
                filename="arsredovisning-2023.pdf",
            ),
        ]

        discovery = _build_mock_discovery_engine([_make_discovered_brf()])
        crawler = _build_mock_crawler_engine(pdfs=pdfs, pages_crawled=7)
        download_mgr = _build_mock_download_manager([
            _make_download_result("arsredovisning-2023.pdf"),
        ])

        test = SmokeTest(
            brf_name="BRF Test",
            tmp_dir=pathlib.Path(str(tmp_path)),
            discovery_engine=discovery,
            crawler_engine=crawler,
            download_manager=download_mgr,
        )

        report = await test.run()
        output = format_report(report)

        assert "BRF Test" in output
        assert "https://www.brf-test.se/" in output
        assert "Pages crawled: 7" in output
        assert "PDFs found: 1" in output
        assert "PASS" in output

    async def test_checksums_verified(self, tmp_path: object) -> None:
        """All completed downloads have valid SHA256 checksums."""
        import pathlib

        content = b"test pdf bytes"
        checksum = hashlib.sha256(content).hexdigest()

        result = _make_download_result("arsredovisning-2023.pdf", content=content)

        pdfs = [
            _make_pdf_doc(
                url="https://www.brf-test.se/arsredovisning-2023.pdf",
                filename="arsredovisning-2023.pdf",
            ),
        ]

        discovery = _build_mock_discovery_engine([_make_discovered_brf()])
        crawler = _build_mock_crawler_engine(pdfs=pdfs, pages_crawled=3)
        download_mgr = _build_mock_download_manager([result])

        test = SmokeTest(
            brf_name="BRF Test",
            tmp_dir=pathlib.Path(str(tmp_path)),
            discovery_engine=discovery,
            crawler_engine=crawler,
            download_manager=download_mgr,
        )

        report = await test.run()

        assert report.passed is True
        assert result.document is not None
        assert len(result.document.sha256_checksum) == 64
        assert result.document.sha256_checksum == checksum

    async def test_brf_name_matching(self, tmp_path: object) -> None:
        """Discovery results are matched by BRF name."""
        import pathlib

        brfs = [
            _make_discovered_brf(name="BRF Solgläntan", url="https://www.solgläntan.se"),
            _make_discovered_brf(name="BRF Björkhagen", url="https://www.björkhagen.se"),
        ]

        discovery = _build_mock_discovery_engine(brfs)

        test = SmokeTest(
            brf_name="BRF Solgläntan",
            tmp_dir=pathlib.Path(str(tmp_path)),
            discovery_engine=discovery,
        )

        # Only run discovery stage
        await test._stage_discover()

        # HttpUrl normalizes internationalized domain names to punycode
        assert "solgl" in test.report.website_url
