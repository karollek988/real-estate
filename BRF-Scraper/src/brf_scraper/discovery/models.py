"""Pydantic models for BRF website discovery."""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from pathlib import Path
from typing import Any
from uuid import UUID, uuid4

from pydantic import BaseModel, Field, HttpUrl


class DiscoverySource(StrEnum):
    """Source of BRF website discovery."""

    SEARCH_ENGINE = "search_engine"
    DIRECTORY = "directory"
    SEED_URL = "seed_url"
    MANUAL = "manual"
    UNKNOWN = "unknown"


class DiscoveredBRF(BaseModel):
    """Discovered BRF website."""

    id: UUID = Field(default_factory=uuid4)
    name: str
    website_url: HttpUrl
    source: DiscoverySource
    city: str | None = None
    municipality: str | None = None
    county: str | None = None
    organization_number: str | None = None
    discovered_at: datetime = Field(default_factory=datetime.now)
    confidence_score: float = Field(default=1.0, ge=0.0, le=1.0)
    raw_data: dict[str, Any] = Field(default_factory=dict)
    metadata: dict[str, Any] = Field(default_factory=dict)

    def to_brf_input(self) -> dict[str, Any]:
        """Convert to BRF input for crawler."""
        return {
            "name": self.name,
            "website_url": str(self.website_url),
            "city": self.city,
            "municipality": self.municipality,
            "county": self.county,
            "organization_number": self.organization_number,
            "metadata": {**self.raw_data, **self.metadata},
        }


class DiscoveryResult(BaseModel):
    """Result from a discovery operation."""

    source: DiscoverySource
    brfs: list[DiscoveredBRF] = Field(default_factory=list)
    total_found: int = 0
    errors: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)
    started_at: datetime = Field(default_factory=datetime.now)
    completed_at: datetime | None = None
    response_time: float | None = None

    @property
    def is_success(self) -> bool:
        """Check if discovery was successful."""
        return len(self.errors) == 0 and self.total_found > 0

    def add_brf(self, brf: DiscoveredBRF) -> None:
        """Add a discovered BRF."""
        self.brfs.append(brf)
        self.total_found = len(self.brfs)

    def add_error(self, error: str) -> None:
        """Add an error message."""
        self.errors.append(error)

    def add_warning(self, warning: str) -> None:
        """Add a warning message."""
        self.warnings.append(warning)

    def merge(self, other: DiscoveryResult) -> None:
        """Merge another discovery result into this one."""
        self.brfs.extend(other.brfs)
        self.total_found = len(self.brfs)
        self.errors.extend(other.errors)
        self.warnings.extend(other.warnings)
        self.metadata.update(other.metadata)


class SearchQuery(BaseModel):
    """Search query for search engine discovery."""

    query: str
    max_results: int = Field(default=50, ge=1, le=100)
    language: str = "sv"
    country: str = "se"
    safe_search: bool = True


class DirectoryConfig(BaseModel):
    """Configuration for directory scraper."""

    base_url: HttpUrl
    name: str
    max_pages: int = Field(default=10, ge=1, le=100)
    delay_between_requests: float = Field(default=1.0, ge=0.1, le=10.0)
    respect_robots_txt: bool = True
    custom_headers: dict[str, str] = Field(default_factory=dict)


class SeedUrlList(BaseModel):
    """List of seed URLs for discovery."""

    name: str
    urls: list[HttpUrl]
    source: DiscoverySource = DiscoverySource.SEED_URL
    metadata: dict[str, Any] = Field(default_factory=dict)

    @classmethod
    def from_file(cls, file_path: str, name: str = "seed_urls") -> SeedUrlList:
        """Load seed URLs from a text file (one URL per line)."""
        urls = []
        path = Path(file_path)
        with path.open() as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#"):
                    try:
                        urls.append(HttpUrl(line))
                    except ValueError:
                        continue
        return cls(name=name, urls=urls)
