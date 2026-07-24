"""Discovery engine orchestrator for BRF website discovery."""

from __future__ import annotations

import asyncio
from typing import Any

from brf_scraper.discovery.base import BaseDiscoveryProvider
from brf_scraper.discovery.models import DiscoveredBRF, DiscoveryResult, DiscoverySource
from brf_scraper.exceptions import BrowserError


class DiscoveryEngine:
    """Orchestrates multiple discovery providers.

    Manages provider registration, execution order, and result merging.
    Supports sequential and parallel discovery strategies.
    """

    def __init__(
        self,
        providers: list[BaseDiscoveryProvider] | None = None,
        strategy: str = "sequential",
        deduplicate: bool = True,
    ) -> None:
        """Initialize discovery engine.

        Args:
            providers: List of discovery providers
            strategy: Execution strategy ('sequential' or 'parallel')
            deduplicate: Whether to deduplicate results by URL
        """
        self._providers: list[BaseDiscoveryProvider] = providers or []
        self._strategy = strategy
        self._deduplicate = deduplicate

    @property
    def providers(self) -> list[BaseDiscoveryProvider]:
        """Get registered providers."""
        return self._providers.copy()

    @property
    def strategy(self) -> str:
        """Get execution strategy."""
        return self._strategy

    def add_provider(self, provider: BaseDiscoveryProvider) -> None:
        """Add a discovery provider.

        Args:
            provider: Provider to add
        """
        if provider not in self._providers:
            self._providers.append(provider)

    def remove_provider(self, provider: BaseDiscoveryProvider) -> bool:
        """Remove a discovery provider.

        Args:
            provider: Provider to remove

        Returns:
            True if provider was removed
        """
        try:
            self._providers.remove(provider)
            return True
        except ValueError:
            return False

    def get_provider(self, name: str) -> BaseDiscoveryProvider | None:
        """Get provider by name.

        Args:
            name: Provider name

        Returns:
            Provider or None
        """
        for provider in self._providers:
            if provider.name == name:
                return provider
        return None

    async def initialize(self) -> None:
        """Initialize all providers."""
        for provider in self._providers:
            await provider.initialize()

    async def close(self) -> None:
        """Close all providers."""
        for provider in self._providers:
            await provider.close()

    async def discover(
        self,
        providers: list[str] | None = None,
        **kwargs: Any,
    ) -> DiscoveryResult:
        """Discover BRF websites using registered providers.

        Args:
            providers: Specific providers to use (uses all if None)
            **kwargs: Additional arguments passed to providers

        Returns:
            Combined DiscoveryResult
        """
        if not self._providers:
            raise BrowserError(
                message="No discovery providers registered",
            )

        # Filter providers if specified
        active_providers = self._filter_providers(providers)

        # Execute discovery
        if self._strategy == "parallel":
            results = await self._discover_parallel(active_providers, **kwargs)
        else:
            results = await self._discover_sequential(active_providers, **kwargs)

        # Merge results
        combined = self._merge_results(results)

        # Deduplicate if enabled
        if self._deduplicate:
            combined = self._deduplicate_results(combined)

        return combined

    def _filter_providers(self, provider_names: list[str] | None) -> list[BaseDiscoveryProvider]:
        """Filter providers by name.

        Args:
            provider_names: Provider names to include

        Returns:
            Filtered list of providers
        """
        if not provider_names:
            return self._providers.copy()

        return [p for p in self._providers if p.name in provider_names and p.is_available]

    async def _discover_sequential(
        self,
        providers: list[BaseDiscoveryProvider],
        **kwargs: Any,
    ) -> list[DiscoveryResult]:
        """Execute discovery sequentially.

        Args:
            providers: Providers to use
            **kwargs: Additional arguments

        Returns:
            List of results
        """
        results = []
        for provider in providers:
            try:
                result = await provider.discover(**kwargs)
                results.append(result)
            except Exception as e:
                error_result = DiscoveryResult(source=DiscoverySource.UNKNOWN)
                error_result.add_error(f"Provider {provider.name} failed: {e!s}")
                results.append(error_result)

        return results

    async def _discover_parallel(
        self,
        providers: list[BaseDiscoveryProvider],
        **kwargs: Any,
    ) -> list[DiscoveryResult]:
        """Execute discovery in parallel.

        Args:
            providers: Providers to use
            **kwargs: Additional arguments

        Returns:
            List of results
        """

        async def _run_provider(
            provider: BaseDiscoveryProvider,
        ) -> DiscoveryResult:
            try:
                return await provider.discover(**kwargs)
            except Exception as e:
                error_result = DiscoveryResult(source=DiscoverySource.UNKNOWN)
                error_result.add_error(f"Provider {provider.name} failed: {e!s}")
                return error_result

        tasks = [_run_provider(p) for p in providers]
        return await asyncio.gather(*tasks)

    def _merge_results(self, results: list[DiscoveryResult]) -> DiscoveryResult:
        """Merge multiple discovery results.

        Args:
            results: Results to merge

        Returns:
            Merged result
        """
        merged = DiscoveryResult(source=DiscoverySource.UNKNOWN)

        for result in results:
            merged.merge(result)

        return merged

    def _deduplicate_results(self, result: DiscoveryResult) -> DiscoveryResult:
        """Deduplicate results by URL.

        Candidates that multiple providers agree on are collapsed into a
        single entry, but the agreement itself is preserved in
        `metadata["source_agreement_count"]` — independent providers
        converging on the same URL is a confidence signal that would
        otherwise be lost by deduplication.

        Args:
            result: Result to deduplicate

        Returns:
            Deduplicated result
        """
        seen: dict[str, DiscoveredBRF] = {}
        order: list[str] = []

        for brf in result.brfs:
            url_str = str(brf.website_url)
            if url_str not in seen:
                brf.metadata["source_agreement_count"] = 1
                seen[url_str] = brf
                order.append(url_str)
            else:
                kept = seen[url_str]
                kept.metadata["source_agreement_count"] = (
                    kept.metadata.get("source_agreement_count", 1) + 1
                )

        result.brfs = [seen[url] for url in order]
        result.total_found = len(result.brfs)

        return result

    async def discover_all(self, **kwargs: Any) -> DiscoveryResult:
        """Discover from all providers with full initialization.

        This is a convenience method that initializes, discovers,
        and closes all providers.

        Args:
            **kwargs: Additional arguments

        Returns:
            Combined DiscoveryResult
        """
        await self.initialize()
        try:
            return await self.discover(**kwargs)
        finally:
            await self.close()

    def get_stats(self) -> dict[str, Any]:
        """Get engine statistics.

        Returns:
            Dictionary with statistics
        """
        return {
            "total_providers": len(self._providers),
            "available_providers": sum(1 for p in self._providers if p.is_available),
            "strategy": self._strategy,
            "deduplicate": self._deduplicate,
            "provider_names": [p.name for p in self._providers],
        }

    async def __aenter__(self) -> DiscoveryEngine:
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
