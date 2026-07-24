"""Storage module for data persistence."""

from __future__ import annotations

from brf_scraper.storage.base import Storage
from brf_scraper.storage.local import LocalStorage

__all__ = [
    "LocalStorage",
    "Storage",
]
