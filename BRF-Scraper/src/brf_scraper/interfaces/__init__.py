"""Interface modules for BRF Scraper."""

from __future__ import annotations

from brf_scraper.interfaces.browser import BrowserAutomation, BrowserPage
from brf_scraper.interfaces.cache import Cache, RedisCache
from brf_scraper.interfaces.http import HTTPClient, HTTPRequest, HTTPResponse

__all__ = [
    "BrowserAutomation",
    "BrowserPage",
    "Cache",
    "HTTPClient",
    "HTTPRequest",
    "HTTPResponse",
    "RedisCache",
]
