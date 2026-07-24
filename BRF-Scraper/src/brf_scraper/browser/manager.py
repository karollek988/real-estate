"""Browser manager for automatic provider selection."""

from __future__ import annotations

from typing import Any

from brf_scraper.browser.base import BrowserProvider
from brf_scraper.browser.fetch_engine import FetchEngine
from brf_scraper.browser.http_provider import HttpProvider
from brf_scraper.browser.metrics import MetricsCollector, get_metrics_collector
from brf_scraper.browser.models import BrowserConfig, FetchResult, ProviderType
from brf_scraper.utils.logging import get_logger

logger = get_logger(__name__)


class BrowserManager:
    """Browser manager responsible for automatically selecting the best provider.

    Provider priority:
    1. HttpProvider (fastest, most reliable)
    2. PlaywrightProvider (JavaScript rendering)
    3. CamoufoxProvider (anti-detection)

    The manager exposes a simple fetch() method without exposing
    provider-specific logic.
    """

    def __init__(
        self,
        config: BrowserConfig | None = None,
        metrics_collector: MetricsCollector | None = None,
    ) -> None:
        """Initialize the browser manager.

        Args:
            config: Default browser configuration.
            metrics_collector: Optional metrics collector.
        """
        self._config = config or BrowserConfig()
        self._metrics = metrics_collector or get_metrics_collector()
        self._providers: list[BrowserProvider] = []
        self._engine: FetchEngine | None = None
        self._initialized = False

    @property
    def config(self) -> BrowserConfig:
        """Get the default configuration."""
        return self._config

    @property
    def providers(self) -> list[BrowserProvider]:
        """Get available providers."""
        return [p for p in self._providers if p.is_available]

    @property
    def metrics(self) -> MetricsCollector:
        """Get the metrics collector."""
        return self._metrics

    def _discover_providers(self) -> list[BrowserProvider]:
        """Discover and instantiate available providers.

        Returns:
            List of available providers in priority order.
        """
        providers: list[BrowserProvider] = []

        # 1. HttpProvider (always available)
        http_provider = HttpProvider()
        if http_provider.is_available:
            providers.append(http_provider)
            logger.debug("provider_discovered", provider="http")

        # 2. PlaywrightProvider
        try:
            from brf_scraper.browser.playwright_provider import PlaywrightProvider

            playwright_provider = PlaywrightProvider()
            if playwright_provider.is_available:
                providers.append(playwright_provider)
                logger.debug("provider_discovered", provider="playwright")
        except ImportError:
            logger.debug("playwright_not_available")

        # 3. CamoufoxProvider (optional)
        try:
            from brf_scraper.browser.camoufox_provider import CamoufoxProvider

            camoufox_provider = CamoufoxProvider()
            if camoufox_provider.is_available:
                providers.append(camoufox_provider)
                logger.debug("provider_discovered", provider="camoufox")
        except ImportError:
            logger.debug("camoufox_not_available")

        return providers

    async def initialize(self) -> None:
        """Initialize the browser manager and discover providers."""
        if self._initialized:
            return

        logger.info("browser_manager_initializing")

        # Discover available providers
        self._providers = self._discover_providers()

        if not self._providers:
            logger.warning("no_providers_available")
        else:
            logger.info(
                "providers_discovered",
                count=len(self._providers),
                providers=[p.name for p in self._providers],
            )

        # Create fetch engine
        self._engine = FetchEngine(
            providers=self._providers,
            config=self._config,
            metrics_collector=self._metrics,
        )

        # Initialize engine
        await self._engine.initialize()

        self._initialized = True
        logger.info("browser_manager_initialized")

    async def close(self) -> None:
        """Close the browser manager and all providers."""
        if self._engine:
            await self._engine.close()
            self._engine = None

        for provider in self._providers:
            try:
                await provider.close()
            except Exception as e:
                logger.error(
                    "provider_close_error",
                    provider=provider.name,
                    error=str(e),
                )

        self._initialized = False
        logger.info("browser_manager_closed")

    async def fetch(
        self,
        url: str,
        config: BrowserConfig | None = None,
        provider: BrowserProvider | None = None,
        **kwargs: Any,
    ) -> FetchResult:
        """Fetch a URL using the best available provider.

        This is the main method for fetching URLs. It automatically
        selects the best provider and handles retries and error recovery.

        Args:
            url: URL to fetch.
            config: Optional configuration overrides.
            provider: Optional specific provider to use.
            **kwargs: Additional options.

        Returns:
            FetchResult with the response data.
        """
        if not self._initialized:
            await self.initialize()

        if not self._engine:
            raise RuntimeError("FetchEngine not initialized")

        logger.info("fetch_request", url=url)

        result = await self._engine.fetch(url, config, provider, **kwargs)

        logger.info(
            "fetch_complete",
            url=url,
            provider=result.provider_used,
            status=result.status_code,
            success=result.is_success,
            response_time=result.response_time,
        )

        return result

    async def fetch_many(
        self,
        urls: list[str],
        config: BrowserConfig | None = None,
        max_concurrent: int = 5,
        **kwargs: Any,
    ) -> list[FetchResult]:
        """Fetch multiple URLs concurrently.

        Args:
            urls: List of URLs to fetch.
            config: Optional configuration overrides.
            max_concurrent: Maximum concurrent fetches.

        Returns:
            List of FetchResult instances.
        """
        if not self._initialized:
            await self.initialize()

        if not self._engine:
            raise RuntimeError("FetchEngine not initialized")

        return await self._engine.fetch_many(urls, config, max_concurrent, **kwargs)

    def get_provider(self, provider_type: ProviderType) -> BrowserProvider | None:
        """Get a specific provider by type.

        Args:
            provider_type: Type of provider.

        Returns:
            Provider instance or None.
        """
        for provider in self._providers:
            if provider.provider_type == provider_type:
                return provider
        return None

    def get_stats(self) -> dict[str, Any]:
        """Get statistics for all providers.

        Returns:
            Statistics dictionary.
        """
        return self._metrics.get_all_stats()

    async def health_check(self) -> dict[str, bool]:
        """Check health of all providers.

        Returns:
            Dictionary of provider health status.
        """
        health: dict[str, bool] = {}
        for provider in self._providers:
            try:
                health[provider.name] = await provider.health_check()
            except Exception:
                health[provider.name] = False
        return health

    async def __aenter__(self) -> BrowserManager:
        """Async context manager entry."""
        await self.initialize()
        return self

    async def __aexit__(
        self,
        exc_type: type[Exception] | None,
        exc_val: Exception | None,
        exc_tb: Any,
    ) -> None:
        """Async context manager exit."""
        await self.close()


# Factory function
def create_browser_manager(
    config: BrowserConfig | None = None,
    **kwargs: Any,
) -> BrowserManager:
    """Create a BrowserManager with default configuration.

    Args:
        config: Optional configuration.
        **kwargs: Additional options.

    Returns:
        Configured BrowserManager instance.
    """
    return BrowserManager(config=config, **kwargs)
