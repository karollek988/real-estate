"""Browser provider models and data structures."""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import Any
from uuid import UUID, uuid4

from pydantic import BaseModel, Field


class ProviderType(StrEnum):
    """Types of browser providers."""

    HTTP = "http"
    PLAYWRIGHT = "playwright"
    CAMOUFOX = "camoufox"


class FetchResult(BaseModel):
    """Result of a web fetch operation."""

    id: UUID = Field(default_factory=uuid4)
    original_url: str
    final_url: str
    provider_used: ProviderType
    status_code: int
    response_headers: dict[str, str] = Field(default_factory=dict)
    html: str = ""
    title: str = ""
    response_time: float = 0.0
    redirect_count: int = 0
    screenshot_path: str | None = None
    cookies: dict[str, str] = Field(default_factory=dict)
    error: str | None = None
    error_code: str | None = None
    timestamp: datetime = Field(default_factory=datetime.now)
    content_length: int = 0
    encoding: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)

    @property
    def is_success(self) -> bool:
        """Check if fetch was successful."""
        return self.error is None and 200 <= self.status_code < 400

    @property
    def is_redirect(self) -> bool:
        """Check if response was a redirect."""
        return 300 <= self.status_code < 400

    @property
    def is_client_error(self) -> bool:
        """Check if response was a client error."""
        return 400 <= self.status_code < 500

    @property
    def is_server_error(self) -> bool:
        """Check if response was a server error."""
        return 500 <= self.status_code < 600

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for serialization."""
        return self.model_dump(mode="json")


class BrowserConfig(BaseModel):
    """Configuration for browser providers."""

    timeout: float = 30.0
    max_retries: int = 3
    retry_delay: float = 1.0
    retry_backoff: float = 2.0
    follow_redirects: bool = True
    max_redirects: int = 10
    verify_ssl: bool = True
    proxy: str | None = None
    proxy_auth: tuple[str, str] | None = None
    user_agent: str | None = None
    user_agent_rotation: bool = True
    headers: dict[str, str] = Field(default_factory=dict)
    cookies: dict[str, str] = Field(default_factory=dict)
    viewport_width: int = 1920
    viewport_height: int = 1080
    headless: bool = True
    screenshot_on_error: bool = False
    respect_robots_txt: bool = True
    robots_cache_ttl: int = 3600

    # Feature toggles
    enable_javascript: bool = True
    enable_images: bool = False
    enable_css: bool = False
    enable_fonts: bool = False


class RobotsTxtRule(BaseModel):
    """robots.txt rule for a specific path."""

    path: str
    allow: bool
    crawl_delay: float | None = None


class RobotsTxtInfo(BaseModel):
    """Parsed robots.txt information."""

    url: str
    user_agent: str
    rules: list[RobotsTxtRule] = Field(default_factory=list)
    crawl_delay: float | None = None
    sitemaps: list[str] = Field(default_factory=list)
    fetched_at: datetime = Field(default_factory=datetime.now)

    def is_allowed(self, url: str, user_agent: str = "*") -> bool:
        """Check if a URL is allowed for the given user agent.

        Args:
            url: URL to check.
            user_agent: User agent string.

        Returns:
            True if allowed, False otherwise.
        """
        for rule in self.rules:
            if rule.path in url or url.startswith(rule.path):
                return rule.allow
        return True
