"""Browser provider interface and implementations for web fetching."""

from __future__ import annotations

from brf_scraper.browser.base import BrowserProvider
from brf_scraper.browser.http_provider import HttpProvider
from brf_scraper.browser.manager import BrowserManager
from brf_scraper.browser.metrics import FetchMetrics, MetricsCollector
from brf_scraper.browser.models import FetchResult, ProviderType
from brf_scraper.browser.playwright_provider import PlaywrightProvider

__all__ = [
    "BrowserManager",
    "BrowserProvider",
    "FetchMetrics",
    "FetchResult",
    "HttpProvider",
    "MetricsCollector",
    "PlaywrightProvider",
    "ProviderType",
]


def get_camoufox_provider() -> type[BrowserProvider] | None:
    """Try to import CamoufoxProvider.

    Returns:
        CamoufoxProvider class if available, None otherwise.
    """
    try:
        from brf_scraper.browser.camoufox_provider import CamoufoxProvider

        return CamoufoxProvider
    except ImportError:
        return None
