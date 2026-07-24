"""Utility modules for BRF Scraper."""

from __future__ import annotations

from brf_scraper.utils.logging import LoggerMixin, get_logger, setup_logging
from brf_scraper.utils.retry import retry
from brf_scraper.utils.urls import (
    extract_domain,
    is_pdf_url,
    is_same_domain,
    make_absolute_url,
    normalize_url,
    resolve_url,
)

__all__ = [
    "LoggerMixin",
    "extract_domain",
    "get_logger",
    "is_pdf_url",
    "is_same_domain",
    "make_absolute_url",
    "normalize_url",
    "resolve_url",
    "retry",
    "setup_logging",
]
