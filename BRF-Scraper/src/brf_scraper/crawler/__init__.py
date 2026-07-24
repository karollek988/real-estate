"""Crawler module for website crawling."""

from __future__ import annotations

from brf_scraper.crawler.engine import CrawlerEngine
from brf_scraper.crawler.link_extractor import LinkExtractor
from brf_scraper.crawler.models import (
    ContentType,
    CrawlConfig,
    CrawlMetrics,
    CrawlRequest,
    CrawlResponse,
    CrawlStatus,
    DocumentReference,
    DocumentStatus,
)
from brf_scraper.crawler.pdf_detector import PdfDetector
from brf_scraper.crawler.queue import CrawlQueue
from brf_scraper.crawler.rate_limiter import RateLimiter
from brf_scraper.crawler.robots import RobotsManager
from brf_scraper.crawler.worker import CrawlerWorker

__all__ = [
    "ContentType",
    "CrawlConfig",
    "CrawlMetrics",
    "CrawlQueue",
    "CrawlRequest",
    "CrawlResponse",
    "CrawlStatus",
    "CrawlerEngine",
    "CrawlerWorker",
    "DocumentReference",
    "DocumentStatus",
    "LinkExtractor",
    "PdfDetector",
    "RateLimiter",
    "RobotsManager",
]
