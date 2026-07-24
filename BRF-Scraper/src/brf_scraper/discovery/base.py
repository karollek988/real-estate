"""Base interface for BRF discovery providers."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

from brf_scraper.discovery.models import DiscoveryResult


class BaseDiscoveryProvider(ABC):
    """Abstract base class for discovery providers."""

    @property
    @abstractmethod
    def name(self) -> str:
        """Provider name."""

    @property
    @abstractmethod
    def is_available(self) -> bool:
        """Check if provider is available and configured."""

    @abstractmethod
    async def discover(self, **kwargs: Any) -> DiscoveryResult:
        """Discover BRF websites.

        Args:
            **kwargs: Provider-specific arguments

        Returns:
            DiscoveryResult with discovered BRFs
        """

    @abstractmethod
    async def initialize(self) -> None:
        """Initialize the provider (connect, load configs, etc.)."""

    @abstractmethod
    async def close(self) -> None:
        """Close the provider and release resources."""

    async def __aenter__(self) -> BaseDiscoveryProvider:
        """Async context manager entry."""
        await self.initialize()
        return self

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc_val: BaseException | None,
        exc_tb: Any,
    ) -> None:
        """Async context manager exit."""
        await self.close()
