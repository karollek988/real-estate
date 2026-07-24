"""Browser provider base interface."""

from __future__ import annotations

from abc import abstractmethod
from typing import Any

from brf_scraper.base import BaseInterface
from brf_scraper.browser.models import BrowserConfig, FetchResult, ProviderType


class BrowserProvider(BaseInterface):
    """Abstract base class for browser providers.

    All browser providers must implement this interface to ensure
    consistent behavior across different fetching implementations.
    """

    @property
    @abstractmethod
    def provider_type(self) -> ProviderType:
        """Get the provider type identifier."""

    @property
    @abstractmethod
    def name(self) -> str:
        """Get the provider name."""

    @property
    @abstractmethod
    def is_available(self) -> bool:
        """Check if the provider is available and properly configured."""

    @abstractmethod
    async def fetch(
        self,
        url: str,
        config: BrowserConfig | None = None,
        **kwargs: Any,
    ) -> FetchResult:
        """Fetch a URL and return the result.

        Args:
            url: The URL to fetch.
            config: Optional configuration overrides.
            **kwargs: Additional provider-specific options.

        Returns:
            FetchResult with the response data.

        Raises:
            ProviderError: If the fetch fails.
        """

    async def initialize(self) -> None:
        """Initialize the provider.

        Default implementation does nothing.
        Override for provider-specific initialization.
        """

    async def close(self) -> None:
        """Close the provider and release resources.

        Default implementation does nothing.
        Override for provider-specific cleanup.
        """

    async def health_check(self) -> bool:
        """Check if the provider is healthy.

        Returns:
            True if healthy, False otherwise.
        """
        return self.is_available

    def __repr__(self) -> str:
        """Get string representation."""
        return f"{self.__class__.__name__}(type={self.provider_type})"
