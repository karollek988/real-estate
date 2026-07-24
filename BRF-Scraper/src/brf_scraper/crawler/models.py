"""Pydantic models for the crawl engine."""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import Any
from uuid import UUID, uuid4

from pydantic import BaseModel, Field, HttpUrl


class ContentType(StrEnum):
    """Content type of discovered documents."""

    PDF = "pdf"
    HTML = "html"
    UNKNOWN = "unknown"


class DocumentStatus(StrEnum):
    """Status of document discovery."""

    DISCOVERED = "discovered"
    DOWNLOADING = "downloading"
    DOWNLOADED = "downloaded"
    FAILED = "failed"


class CrawlStatus(StrEnum):
    """Status of crawl operations."""

    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    TIMEOUT = "timeout"
    BLOCKED = "blocked"


class DocumentReference(BaseModel):
    """Reference to a discovered document."""

    id: UUID = Field(default_factory=uuid4)
    source_url: HttpUrl
    document_url: HttpUrl
    title: str | None = None
    filename: str | None = None
    mime_type: str | None = None
    size: int | None = None
    year: int | None = None
    discovered_at: datetime = Field(default_factory=datetime.now)
    content_type: ContentType = ContentType.UNKNOWN
    etag: str | None = None
    last_modified: str | None = None
    checksum: str | None = None
    confidence: float = Field(default=1.0, ge=0.0, le=1.0)
    status: DocumentStatus = DocumentStatus.DISCOVERED
    metadata: dict[str, Any] = Field(default_factory=dict)

    def is_pdf(self) -> bool:
        """Check if document is a PDF."""
        return self.content_type == ContentType.PDF

    def has_size(self) -> bool:
        """Check if size is known."""
        return self.size is not None and self.size > 0


class CrawlRequest(BaseModel):
    """Request to crawl a URL."""

    id: UUID = Field(default_factory=uuid4)
    url: HttpUrl
    depth: int = Field(default=0, ge=0)
    parent_url: HttpUrl | None = None
    priority: int = Field(default=0, ge=0, le=10)
    created_at: datetime = Field(default_factory=datetime.now)
    metadata: dict[str, Any] = Field(default_factory=dict)


class CrawlResponse(BaseModel):
    """Response from crawling a URL."""

    request_id: UUID
    url: HttpUrl
    final_url: HttpUrl | None = None
    status_code: int | None = None
    content_type: str | None = None
    html: str | None = None
    title: str | None = None
    links: list[str] = Field(default_factory=list)
    documents: list[DocumentReference] = Field(default_factory=list)
    error: str | None = None
    response_time: float | None = None
    redirect_count: int = 0
    crawled_at: datetime = Field(default_factory=datetime.now)

    @property
    def is_success(self) -> bool:
        """Check if crawl was successful."""
        return self.error is None and self.status_code is not None and 200 <= self.status_code < 400


class CrawlConfig(BaseModel):
    """Configuration for crawling."""

    max_depth: int = Field(default=3, ge=0, le=10)
    max_pages: int = Field(default=100, ge=1, le=10000)
    max_concurrent: int = Field(default=5, ge=1, le=50)
    timeout: float = Field(default=30.0, ge=1.0, le=300.0)
    delay_between_requests: float = Field(default=1.0, ge=0.0, le=60.0)
    retry_count: int = Field(default=3, ge=0, le=10)
    retry_delay: float = Field(default=2.0, ge=0.1, le=60.0)
    respect_robots_txt: bool = True
    follow_redirects: bool = True
    max_redirects: int = Field(default=10, ge=0, le=50)
    allowed_domains: list[str] = Field(default_factory=list)
    blocked_domains: list[str] = Field(default_factory=list)
    user_agent: str = (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    )
    headers: dict[str, str] = Field(default_factory=dict)


class CrawlMetrics(BaseModel):
    """Metrics collected during crawling."""

    pages_crawled: int = 0
    pages_failed: int = 0
    pdfs_found: int = 0
    internal_links: int = 0
    external_links: int = 0
    skipped_pages: int = 0
    blocked_pages: int = 0
    response_times: list[float] = Field(default_factory=list)
    retry_count: int = 0
    started_at: datetime | None = None
    completed_at: datetime | None = None

    @property
    def total_requests(self) -> int:
        """Get total request count."""
        return self.pages_crawled + self.pages_failed

    @property
    def average_response_time(self) -> float:
        """Get average response time."""
        if not self.response_times:
            return 0.0
        return sum(self.response_times) / len(self.response_times)

    @property
    def success_rate(self) -> float:
        """Get success rate."""
        total = self.total_requests
        if total == 0:
            return 0.0
        return self.pages_crawled / total

    def record_response_time(self, time: float) -> None:
        """Record a response time."""
        self.response_times.append(time)

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary."""
        return {
            "pages_crawled": self.pages_crawled,
            "pages_failed": self.pages_failed,
            "pdfs_found": self.pdfs_found,
            "internal_links": self.internal_links,
            "external_links": self.external_links,
            "skipped_pages": self.skipped_pages,
            "blocked_pages": self.blocked_pages,
            "average_response_time": self.average_response_time,
            "retry_count": self.retry_count,
            "success_rate": self.success_rate,
        }
