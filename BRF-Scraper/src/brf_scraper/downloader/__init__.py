"""Downloader module for PDF downloading."""

from __future__ import annotations

from brf_scraper.downloader.downloader import Downloader
from brf_scraper.downloader.manager import DownloadManager
from brf_scraper.downloader.metadata import MetadataRepository
from brf_scraper.downloader.models import (
    Document,
    DownloadMetadata,
    DownloadRequest,
    DownloadResult,
    DownloadStatus,
)
from brf_scraper.downloader.sqlite_metadata import SqliteMetadataRepository

__all__ = [
    "Document",
    "DownloadManager",
    "DownloadMetadata",
    "DownloadRequest",
    "DownloadResult",
    "DownloadStatus",
    "Downloader",
    "MetadataRepository",
    "SqliteMetadataRepository",
]
