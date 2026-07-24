"""Fetch engine for retrieving web pages with retry and error handling."""

from __future__ import annotations

import asyncio
from typing import Any

from brf_scraper.browser.base import BrowserProvider
from brf_scraper.browser.metrics import FetchMetrics, MetricsCollector, get_metrics_collector
from brf_scraper.browser.models import BrowserConfig, FetchResult, ProviderType
from brf_scraper.utils.logging import get_logger

logger = get_logger(__name__)


class FetchEngine:
    """Fetch engine responsible for retrieving web pages.

    This engine provides:
    - Automatic retry with exponential backoff
    - Metrics collection
    - Provider fallback
    - Response validation
    """

    def __init__(
        self,
        providers: list[BrowserProvider] | None = None,
        config: BrowserConfig | None = None,
        metrics_collector: MetricsCollector | None = None,
    ) -> None:
        """Initialize the fetch engine.

        Args:
            providers: List of browser providers to use.
            config: Default browser configuration.
            metrics_collector: Optional metrics collector.
        """
        self._providers = providers or []
        self._config = config or BrowserConfig()
        self._metrics = metrics_collector or get_metrics_collector()

    @property
    def providers(self) -> list[BrowserProvider]:
        """Get the list of providers."""
        return self._providers

    @property
    def config(self) -> BrowserConfig:
        """Get the default configuration."""
        return self._config

    def add_provider(self, provider: BrowserProvider) -> None:
        """Add a provider to the engine.

        Args:
            provider: Provider to add.
        """
        self._providers.append(provider)
        logger.info("provider_added", provider=provider.name)

    def remove_provider(self, provider_type: ProviderType) -> bool:
        """Remove a provider by type.

        Args:
            provider_type: Type of provider to remove.

        Returns:
            True if removed, False if not found.
        """
        for i, provider in enumerate(self._providers):
            if provider.provider_type == provider_type:
                self._providers.pop(i)
                logger.info("provider_removed", provider=provider.name)
                return True
        return False

    def get_provider(self, provider_type: ProviderType) -> BrowserProvider | None:
        """Get a provider by type.

        Args:
            provider_type: Type of provider.

        Returns:
            Provider instance or None.
        """
        for provider in self._providers:
            if provider.provider_type == provider_type:
                return provider
        return None

    def _calculate_delay(self, attempt: int, config: BrowserConfig) -> float:
        """Calculate retry delay with exponential backoff and jitter."""
        import random

        delay = config.retry_delay * (config.retry_backoff**attempt)
        jitter = random.uniform(0, delay * 0.1)
        return delay + jitter

    async def _fetch_with_provider(
        self,
        url: str,
        provider: BrowserProvider,
        config: BrowserConfig,
        metrics: FetchMetrics,
    ) -> FetchResult:
        """Fetch URL using a specific provider."""
        try:
            result = await provider.fetch(url, config)

            # Update metrics
            metrics.status_code = result.status_code
            metrics.content_length = result.content_length
            metrics.redirect_count = result.redirect_count

            if result.error:
                metrics.error = result.error
                metrics.error_code = result.error_code

            return result

        except Exception as e:
            logger.error(
                "provider_fetch_error",
                provider=provider.name,
                url=url,
                error=str(e),
            )
            metrics.error = str(e)
            metrics.error_code = "PROVIDER_EXCEPTION"

            return FetchResult(
                original_url=url,
                final_url=url,
                provider_used=provider.provider_type,
                status_code=0,
                error=str(e),
                error_code="PROVIDER_EXCEPTION",
            )

    async def fetch(
        self,
        url: str,
        config: BrowserConfig | None = None,
        provider: BrowserProvider | None = None,
        **kwargs: Any,
    ) -> FetchResult:
        """Fetch a URL with retry and error handling.

        Args:
            url: URL to fetch.
            config: Optional configuration overrides.
            provider: Optional specific provider to use.
            **kwargs: Additional options.

        Returns:
            FetchResult with the response data.
        """
        config = config or self._config
        metrics = self._metrics.create_metrics(url, ProviderType.HTTP)

        # Determine providers to try
        providers_to_try = [provider] if provider else self._providers

        if not providers_to_try:
            logger.error("no_providers_available")
            metrics.finish(error="No providers available", error_code="NO_PROVIDERS")
            self._metrics.record_fetch(metrics)
            return FetchResult(
                original_url=url,
                final_url=url,
                provider_used=ProviderType.HTTP,
                status_code=0,
                error="No providers available",
                error_code="NO_PROVIDERS",
            )

        last_error: str | None = None

        for attempt in range(config.max_retries + 1):
            metrics.retry_count = attempt

            for prov in providers_to_try:
                if not prov.is_available:
                    logger.debug("provider_not_available", provider=prov.name)
                    continue

                logger.debug(
                    "fetch_attempt",
                    url=url,
                    provider=prov.name,
                    attempt=attempt + 1,
                )

                result = await self._fetch_with_provider(url, prov, config, metrics)

                # Success - return immediately
                if result.is_success:
                    metrics.finish(
                        status_code=result.status_code,
                        content_length=result.content_length,
                        redirect_count=result.redirect_count,
                    )
                    self._metrics.record_fetch(metrics)
                    return result

                # Record the error
                last_error = result.error or f"HTTP {result.status_code}"

                # Don't retry on client errors (4xx) except 429
                if result.is_client_error and result.status_code != 429:
                    logger.warning(
                        "client_error_no_retry",
                        url=url,
                        status=result.status_code,
                    )
                    metrics.finish(
                        status_code=result.status_code,
                        error=result.error,
                        error_code=result.error_code,
                    )
                    self._metrics.record_fetch(metrics)
                    return result

            # Wait before retry (except on last attempt)
            if attempt < config.max_retries:
                delay = self._calculate_delay(attempt, config)
                logger.info(
                    "retry_waiting",
                    url=url,
                    attempt=attempt + 1,
                    delay=delay,
                )
                await asyncio.sleep(delay)

        # All retries exhausted
        logger.error(
            "fetch_retries_exhausted",
            url=url,
            retries=config.max_retries,
        )
        metrics.finish(
            error=f"All retries exhausted: {last_error}",
            error_code="RETRIES_EXHAUSTED",
        )
        self._metrics.record_fetch(metrics)

        return FetchResult(
            original_url=url,
            final_url=url,
            provider_used=providers_to_try[0].provider_type
            if providers_to_try
            else ProviderType.HTTP,
            status_code=0,
            error=f"All retries exhausted: {last_error}",
            error_code="RETRIES_EXHAUSTED",
            response_time=metrics.response_time,
        )

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
        semaphore = asyncio.Semaphore(max_concurrent)

        async def fetch_with_semaphore(url: str) -> FetchResult:
            async with semaphore:
                return await self.fetch(url, config, **kwargs)

        tasks = [fetch_with_semaphore(url) for url in urls]
        return await asyncio.gather(*tasks, return_exceptions=False)

    async def initialize(self) -> None:
        """Initialize all providers."""
        for provider in self._providers:
            if provider.is_available:
                try:
                    await provider.initialize()
                    logger.info("provider_initialized", provider=provider.name)
                except Exception as e:
                    logger.error(
                        "provider_init_failed",
                        provider=provider.name,
                        error=str(e),
                    )

    async def close(self) -> None:
        """Close all providers."""
        for provider in self._providers:
            try:
                await provider.close()
                logger.info("provider_closed", provider=provider.name)
            except Exception as e:
                logger.error(
                    "provider_close_error",
                    provider=provider.name,
                    error=str(e),
                )

    async def __aenter__(self) -> FetchEngine:
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
