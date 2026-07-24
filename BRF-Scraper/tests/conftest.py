"""Test fixtures and configuration."""

from __future__ import annotations

from collections.abc import AsyncGenerator
from pathlib import Path

import pytest
import pytest_asyncio

from brf_scraper.config import AppSettings
from brf_scraper.container import Container, create_container
from brf_scraper.interfaces.cache import InMemoryCache
from brf_scraper.models import BRF, AnnualReport, FinancialData, ReportStatus

# Test paths
TESTS_DIR = Path(__file__).parent
FIXTURES_DIR = TESTS_DIR / "fixtures"


@pytest.fixture(scope="session")
def event_loop():
    """Create event loop for async tests."""
    import asyncio

    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
def settings() -> AppSettings:
    """Create test settings."""
    return AppSettings(
        env="testing",
        debug=True,
        logging={"level": "DEBUG", "format": "console"},
    )


@pytest_asyncio.fixture
async def container(settings: AppSettings) -> AsyncGenerator[Container]:
    """Create and initialize test container."""
    container = create_container(settings)
    await container.initialize()
    yield container
    await container.close()


@pytest_asyncio.fixture
async def cache() -> AsyncGenerator[InMemoryCache]:
    """Create and initialize test cache."""
    cache_instance = InMemoryCache()
    await cache_instance.initialize()
    yield cache_instance
    await cache_instance.close()


@pytest.fixture
def sample_brf() -> BRF:
    """Create a sample BRF for testing."""
    return BRF(
        name="Test BRF",
        organization_number="1234567890",
        website_url="https://example.com",
        city="Stockholm",
        municipality="Stockholm",
        county="Stockholms län",
    )


@pytest.fixture
def sample_annual_report(sample_brf: BRF) -> AnnualReport:
    """Create a sample annual report for testing."""
    return AnnualReport(
        brf_id=sample_brf.id,
        year=2023,
        title="Årsredovisning 2023",
        pdf_url="https://example.com/arsredovisning-2023.pdf",
        status=ReportStatus.DOWNLOADED,
    )


@pytest.fixture
def sample_financial_data(sample_annual_report: AnnualReport) -> FinancialData:
    """Create sample financial data for testing."""
    return FinancialData(
        report_id=sample_annual_report.id,
        year=2023,
        revenue=1_500_000.0,
        operating_costs=1_200_000.0,
        operating_profit=300_000.0,
        total_assets=25_000_000.0,
        total_equity=15_000_000.0,
        total_liabilities=10_000_000.0,
        monthly_fee_avg=3500.0,
    )


@pytest.fixture
def sample_html_content() -> str:
    """Create sample HTML content for testing."""
    return """
    <!DOCTYPE html>
    <html>
    <head>
        <title>Test BRF - Årsredovisning</title>
    </head>
    <body>
        <h1>Test BRF</h1>
        <div class="documents">
            <a href="/docs/arsredovisning-2023.pdf">Årsredovisning 2023</a>
            <a href="/docs/arsredovisning-2022.pdf">Årsredovisning 2022</a>
            <a href="/docs/stadgar.pdf">Stadgar</a>
        </div>
    </body>
    </html>
    """


@pytest.fixture
def sample_pdf_path() -> Path:
    """Get path to sample PDF fixture."""
    return FIXTURES_DIR / "sample_annual_report.pdf"
