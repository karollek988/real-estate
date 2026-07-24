"""Browser automation interfaces for JavaScript-heavy sites."""

from __future__ import annotations

from abc import abstractmethod
from dataclasses import dataclass, field
from typing import Any

from brf_scraper.base import BaseInterface


@dataclass
class BrowserConfig:
    """Browser configuration."""

    headless: bool = True
    timeout: float = 30.0
    user_agent: str | None = None
    viewport_width: int = 1920
    viewport_height: int = 1080
    args: list[str] = field(default_factory=list)
    proxy: str | None = None


@dataclass
class BrowserPage:
    """Browser page content wrapper."""

    url: str
    content: str
    title: str = ""
    status_code: int = 200
    headers: dict[str, str] = field(default_factory=dict)
    cookies: dict[str, str] = field(default_factory=dict)

    @property
    def html(self) -> str:
        """Get page HTML content."""
        return self.content


@dataclass
class ElementInfo:
    """Information about a DOM element."""

    tag: str
    text: str = ""
    attributes: dict[str, str] = field(default_factory=dict)
    inner_html: str = ""
    outer_html: str = ""

    def get_attribute(self, name: str) -> str | None:
        """Get an attribute value."""
        return self.attributes.get(name)

    @property
    def href(self) -> str | None:
        """Get href attribute if present."""
        return self.attributes.get("href")

    @property
    def src(self) -> str | None:
        """Get src attribute if present."""
        return self.attributes.get("src")


class BrowserAutomation(BaseInterface):
    """Browser automation interface for JavaScript rendering."""

    @abstractmethod
    async def start(self, config: BrowserConfig | None = None) -> None:
        """Start the browser.

        Args:
            config: Optional browser configuration.
        """

    @abstractmethod
    async def stop(self) -> None:
        """Stop the browser."""

    @abstractmethod
    async def new_page(self) -> BrowserPage:
        """Create a new browser page.

        Returns:
            New browser page.
        """

    @abstractmethod
    async def goto(
        self,
        url: str,
        wait_until: str = "load",
        timeout: float | None = None,
    ) -> BrowserPage:
        """Navigate to a URL.

        Args:
            url: URL to navigate to.
            wait_until: Wait condition (load, domcontentloaded, networkidle).
            timeout: Optional timeout override.

        Returns:
            Page content after navigation.
        """

    @abstractmethod
    async def wait_for_selector(
        self,
        selector: str,
        timeout: float | None = None,
    ) -> ElementInfo:
        """Wait for an element to appear.

        Args:
            selector: CSS selector.
            timeout: Optional timeout override.

        Returns:
            Element information.
        """

    @abstractmethod
    async def query_selector(self, selector: str) -> ElementInfo | None:
        """Query a single element.

        Args:
            selector: CSS selector.

        Returns:
            Element information or None.
        """

    @abstractmethod
    async def query_selector_all(self, selector: str) -> list[ElementInfo]:
        """Query all matching elements.

        Args:
            selector: CSS selector.

        Returns:
            List of element information.
        """

    @abstractmethod
    async def evaluate(self, expression: str) -> Any:
        """Evaluate JavaScript expression.

        Args:
            expression: JavaScript expression to evaluate.

        Returns:
            Evaluation result.
        """

    @abstractmethod
    async def screenshot(
        self,
        path: str | None = None,
        full_page: bool = False,
    ) -> bytes:
        """Take a screenshot.

        Args:
            path: Optional save path.
            full_page: Whether to capture full page.

        Returns:
            Screenshot as bytes.
        """

    async def __aenter__(self) -> BrowserAutomation:
        """Async context manager entry."""
        await self.start()
        return self

    async def __aexit__(
        self,
        exc_type: type[Exception] | None,
        exc_val: Exception | None,
        exc_tb: Any,
    ) -> None:
        """Async context manager exit."""
        await self.stop()
