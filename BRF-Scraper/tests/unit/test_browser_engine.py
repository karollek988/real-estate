"""Unit tests for fetch engine and browser manager."""

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from brf_scraper.browser.fetch_engine import FetchEngine
from brf_scraper.browser.http_provider import HttpProvider
from brf_scraper.browser.manager import BrowserManager, create_browser_manager
from brf_scraper.browser.models import BrowserConfig, FetchResult, ProviderType


class TestFetchEngine:
    """Tests for FetchEngine."""

    @pytest.fixture
    def engine(self) -> FetchEngine:
        """Create FetchEngine instance."""
        return FetchEngine()

    def test_create_engine(self, engine: FetchEngine) -> None:
        """Test creating FetchEngine."""
        assert engine is not None
        assert engine.providers == []

    def test_add_provider(self, engine: FetchEngine) -> None:
        """Test adding a provider."""
        provider = HttpProvider()
        engine.add_provider(provider)
        assert len(engine.providers) == 1
        assert engine.providers[0] == provider

    def test_remove_provider(self, engine: FetchEngine) -> None:
        """Test removing a provider."""
        provider = HttpProvider()
        engine.add_provider(provider)
        result = engine.remove_provider(ProviderType.HTTP)
        assert result is True
        assert len(engine.providers) == 0

    def test_remove_provider_not_found(self, engine: FetchEngine) -> None:
        """Test removing a provider that doesn't exist."""
        result = engine.remove_provider(ProviderType.HTTP)
        assert result is False

    def test_get_provider(self, engine: FetchEngine) -> None:
        """Test getting a provider by type."""
        provider = HttpProvider()
        engine.add_provider(provider)
        result = engine.get_provider(ProviderType.HTTP)
        assert result == provider

    def test_get_provider_not_found(self, engine: FetchEngine) -> None:
        """Test getting a provider that doesn't exist."""
        result = engine.get_provider(ProviderType.HTTP)
        assert result is None

    def test_calculate_delay(self, engine: FetchEngine) -> None:
        """Test retry delay calculation."""
        config = BrowserConfig(retry_delay=1.0, retry_backoff=2.0)
        delay = engine._calculate_delay(0, config)
        assert delay >= 1.0  # Base delay
        assert delay <= 1.1  # Base + max jitter

        delay_1 = engine._calculate_delay(1, config)
        assert delay_1 >= 2.0  # 1.0 * 2^1

    @pytest.mark.asyncio
    async def test_fetch_no_providers(self, engine: FetchEngine) -> None:
        """Test fetch with no providers."""
        result = await engine.fetch("https://example.com")
        assert result.is_success is False
        assert result.error_code == "NO_PROVIDERS"

    @pytest.mark.asyncio
    async def test_fetch_with_provider(self, engine: FetchEngine) -> None:
        """Test fetch with a specific provider."""
        provider = MagicMock(spec=HttpProvider)
        provider.is_available = True
        provider.provider_type = ProviderType.HTTP

        mock_result = FetchResult(
            original_url="https://example.com",
            final_url="https://example.com",
            provider_used=ProviderType.HTTP,
            status_code=200,
            html="<html></html>",
        )
        provider.fetch = AsyncMock(return_value=mock_result)

        engine.add_provider(provider)
        result = await engine.fetch("https://example.com", provider=provider)

        assert result.status_code == 200
        provider.fetch.assert_called_once()

    @pytest.mark.asyncio
    async def test_fetch_retry_on_error(self, engine: FetchEngine) -> None:
        """Test fetch retries on error."""
        provider = MagicMock(spec=HttpProvider)
        provider.is_available = True
        provider.provider_type = ProviderType.HTTP

        # First two calls fail, third succeeds
        error_result = FetchResult(
            original_url="https://example.com",
            final_url="https://example.com",
            provider_used=ProviderType.HTTP,
            status_code=500,
            error="Server Error",
        )
        success_result = FetchResult(
            original_url="https://example.com",
            final_url="https://example.com",
            provider_used=ProviderType.HTTP,
            status_code=200,
        )

        provider.fetch = AsyncMock(side_effect=[error_result, error_result, success_result])

        config = BrowserConfig(max_retries=3, retry_delay=0.01)
        engine.add_provider(provider)

        result = await engine.fetch("https://example.com", config=config)

        assert result.status_code == 200
        assert provider.fetch.call_count == 3

    @pytest.mark.asyncio
    async def test_fetch_no_retry_on_client_error(self, engine: FetchEngine) -> None:
        """Test fetch doesn't retry on client error (except 429)."""
        provider = MagicMock(spec=HttpProvider)
        provider.is_available = True
        provider.provider_type = ProviderType.HTTP

        error_result = FetchResult(
            original_url="https://example.com",
            final_url="https://example.com",
            provider_used=ProviderType.HTTP,
            status_code=404,
            error="Not Found",
        )

        provider.fetch = AsyncMock(return_value=error_result)

        config = BrowserConfig(max_retries=3, retry_delay=0.01)
        engine.add_provider(provider)

        result = await engine.fetch("https://example.com", config=config)

        assert result.status_code == 404
        assert provider.fetch.call_count == 1  # No retry

    @pytest.mark.asyncio
    async def test_fetch_retry_on_429(self, engine: FetchEngine) -> None:
        """Test fetch retries on 429 (rate limit)."""
        provider = MagicMock(spec=HttpProvider)
        provider.is_available = True
        provider.provider_type = ProviderType.HTTP

        error_result = FetchResult(
            original_url="https://example.com",
            final_url="https://example.com",
            provider_used=ProviderType.HTTP,
            status_code=429,
            error="Rate Limited",
        )
        success_result = FetchResult(
            original_url="https://example.com",
            final_url="https://example.com",
            provider_used=ProviderType.HTTP,
            status_code=200,
        )

        provider.fetch = AsyncMock(side_effect=[error_result, success_result])

        config = BrowserConfig(max_retries=3, retry_delay=0.01)
        engine.add_provider(provider)

        result = await engine.fetch("https://example.com", config=config)

        assert result.status_code == 200
        assert provider.fetch.call_count == 2

    @pytest.mark.asyncio
    async def test_fetch_exhausts_retries(self, engine: FetchEngine) -> None:
        """Test fetch exhausts all retries."""
        provider = MagicMock(spec=HttpProvider)
        provider.is_available = True
        provider.provider_type = ProviderType.HTTP

        error_result = FetchResult(
            original_url="https://example.com",
            final_url="https://example.com",
            provider_used=ProviderType.HTTP,
            status_code=500,
            error="Server Error",
        )

        provider.fetch = AsyncMock(return_value=error_result)

        config = BrowserConfig(max_retries=2, retry_delay=0.01)
        engine.add_provider(provider)

        result = await engine.fetch("https://example.com", config=config)

        assert result.is_success is False
        assert result.error_code == "RETRIES_EXHAUSTED"
        assert provider.fetch.call_count == 3  # Initial + 2 retries

    @pytest.mark.asyncio
    async def test_fetch_many(self, engine: FetchEngine) -> None:
        """Test fetching multiple URLs."""
        provider = MagicMock(spec=HttpProvider)
        provider.is_available = True
        provider.provider_type = ProviderType.HTTP

        async def mock_fetch(
            url: str, config: BrowserConfig | None = None, **kwargs: Any
        ) -> FetchResult:
            return FetchResult(
                original_url=url,
                final_url=url,
                provider_used=ProviderType.HTTP,
                status_code=200,
            )

        provider.fetch = mock_fetch
        engine.add_provider(provider)

        urls = [
            "https://example.com/1",
            "https://example.com/2",
            "https://example.com/3",
        ]

        results = await engine.fetch_many(urls, max_concurrent=2)

        assert len(results) == 3
        assert all(r.status_code == 200 for r in results)


class TestBrowserManager:
    """Tests for BrowserManager."""

    @pytest.fixture
    def manager(self) -> BrowserManager:
        """Create BrowserManager instance."""
        return BrowserManager()

    def test_create_manager(self, manager: BrowserManager) -> None:
        """Test creating BrowserManager."""
        assert manager is not None
        assert manager.providers == []

    def test_create_manager_with_config(self) -> None:
        """Test creating BrowserManager with custom config."""
        config = BrowserConfig(timeout=60.0)
        manager = BrowserManager(config=config)
        assert manager.config.timeout == 60.0

    def test_create_browser_manager_factory(self) -> None:
        """Test create_browser_manager factory function."""
        manager = create_browser_manager()
        assert manager is not None

    @pytest.mark.asyncio
    async def test_initialize(self, manager: BrowserManager) -> None:
        """Test manager initialization."""
        await manager.initialize()
        assert manager._initialized is True

    @pytest.mark.asyncio
    async def test_close(self, manager: BrowserManager) -> None:
        """Test manager close."""
        await manager.initialize()
        await manager.close()
        assert manager._initialized is False

    @pytest.mark.asyncio
    async def test_fetch(self, manager: BrowserManager) -> None:
        """Test fetch through manager."""
        # Mock the engine
        mock_result = FetchResult(
            original_url="https://example.com",
            final_url="https://example.com",
            provider_used=ProviderType.HTTP,
            status_code=200,
        )

        with patch.object(manager, "_engine") as mock_engine:
            mock_engine.fetch = AsyncMock(return_value=mock_result)
            manager._initialized = True

            result = await manager.fetch("https://example.com")

            assert result.status_code == 200
            mock_engine.fetch.assert_called_once()

    @pytest.mark.asyncio
    async def test_health_check(self, manager: BrowserManager) -> None:
        """Test health check."""
        provider = MagicMock(spec=HttpProvider)
        provider.name = "test"
        provider.health_check = AsyncMock(return_value=True)
        manager._providers = [provider]

        health = await manager.health_check()
        assert health == {"test": True}

    def test_get_provider(self, manager: BrowserManager) -> None:
        """Test getting a provider."""
        provider = HttpProvider()
        manager._providers = [provider]

        result = manager.get_provider(ProviderType.HTTP)
        assert result == provider

    def test_get_provider_not_found(self, manager: BrowserManager) -> None:
        """Test getting a provider that doesn't exist."""
        result = manager.get_provider(ProviderType.HTTP)
        assert result is None

    def test_get_stats(self, manager: BrowserManager) -> None:
        """Test getting statistics."""
        stats = manager.get_stats()
        assert isinstance(stats, dict)

    @pytest.mark.asyncio
    async def test_context_manager(self) -> None:
        """Test async context manager."""
        async with BrowserManager() as manager:
            assert manager._initialized is True
        assert manager._initialized is False
