"""Discovery module for BRF website discovery."""

from __future__ import annotations

from brf_scraper.discovery.base import BaseDiscoveryProvider
from brf_scraper.discovery.confidence import (
    ConfidenceBand,
    ScoredCandidate,
    Signal,
    score_candidates,
)
from brf_scraper.discovery.directory_scraper import DirectoryScraperDiscovery
from brf_scraper.discovery.engine import DiscoveryEngine
from brf_scraper.discovery.models import (
    DirectoryConfig,
    DiscoveredBRF,
    DiscoveryResult,
    DiscoverySource,
    SearchQuery,
    SeedUrlList,
)
from brf_scraper.discovery.pipeline import DiscoveryDecision, DiscoveryPipeline
from brf_scraper.discovery.registry import (
    SqliteVerifiedWebsiteRegistry,
    VerificationMethod,
    VerifiedWebsite,
    VerifiedWebsiteRegistry,
)
from brf_scraper.discovery.search_engine import SearchEngine, SearchEngineDiscovery
from brf_scraper.discovery.seed_urls import SeedUrlDiscovery

__all__ = [
    "BaseDiscoveryProvider",
    "ConfidenceBand",
    "DirectoryConfig",
    "DirectoryScraperDiscovery",
    "DiscoveredBRF",
    "DiscoveryDecision",
    "DiscoveryEngine",
    "DiscoveryPipeline",
    "DiscoveryResult",
    "DiscoverySource",
    "ScoredCandidate",
    "SearchEngine",
    "SearchEngineDiscovery",
    "SearchQuery",
    "SeedUrlDiscovery",
    "SeedUrlList",
    "Signal",
    "SqliteVerifiedWebsiteRegistry",
    "VerificationMethod",
    "VerifiedWebsite",
    "VerifiedWebsiteRegistry",
    "score_candidates",
]
