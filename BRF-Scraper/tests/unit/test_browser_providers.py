"""Unit tests for browser providers."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from brf_scraper.browser.base import BrowserProvider
from brf_scraper.browser.http_provider import HttpProvider, _get_random_user_agent
from brf_scraper.browser.models import BrowserConfig, ProviderType


class TestBrowserProviderInterface:
    """Tests for BrowserProvider interface."""

    def test_provider_interface_methods(self) -> None:
        """Test that BrowserProvider defines required methods."""
        # Check that the abstract methods are defined
        assert hasattr(BrowserProvider, "provider_type")
        assert hasattr(BrowserProvider, "name")
        assert hasattr(BrowserProvider, "is_available")
        assert hasattr(BrowserProvider, "fetch")
        assert hasattr(BrowserProvider, "initialize")
        assert hasattr(BrowserProvider, "close")


class TestHttpProvider:
    """Tests for HttpProvider."""

    @pytest.fixture
    def provider(self) -> HttpProvider:
        """Create HttpProvider instance."""
        return HttpProvider()

    def test_provider_type(self, provider: HttpProvider) -> None:
        """Test provider type."""
        assert provider.provider_type == ProviderType.HTTP

    def test_provider_name(self, provider: HttpProvider) -> None:
        """Test provider name."""
        assert provider.name == "httpx"

    def test_is_available(self, provider: HttpProvider) -> None:
        """Test is_available property."""
        assert provider.is_available is True

    def test_repr(self, provider: HttpProvider) -> None:
        """Test string representation."""
        assert "HttpProvider" in repr(provider)
        assert "http" in repr(provider)

    def test_get_random_user_agent(self) -> None:
        """Test random user agent selection."""
        agent = _get_random_user_agent()
        assert agent is not None
        assert len(agent) > 0
        assert "Mozilla" in agent

    def test_build_headers(self, provider: HttpProvider) -> None:
        """Test header building."""
        config = BrowserConfig()
        headers = provider._build_headers(config)
        assert "Accept" in headers
        assert "User-Agent" in headers
        assert "Accept-Encoding" in headers

    def test_build_headers_custom_user_agent(self, provider: HttpProvider) -> None:
        """Test header building with custom user agent."""
        config = BrowserConfig(user_agent="Custom Agent/1.0")
        headers = provider._build_headers(config)
        assert headers["User-Agent"] == "Custom Agent/1.0"

    def test_build_headers_custom_headers(self, provider: HttpProvider) -> None:
        """Test header building with custom headers."""
        config = BrowserConfig(headers={"X-Custom": "value"})
        headers = provider._build_headers(config)
        assert headers["X-Custom"] == "value"

    def test_parse_html_title(self, provider: HttpProvider) -> None:
        """Test HTML title parsing."""
        html = "<html><head><title>Test Title</title></head></html>"
        title = provider._parse_html_title(html)
        assert title == "Test Title"

    def test_parse_html_title_no_title(self, provider: HttpProvider) -> None:
        """Test HTML title parsing with no title."""
        html = "<html><head></head></html>"
        title = provider._parse_html_title(html)
        assert title == ""

    def test_parse_html_title_case_insensitive(self, provider: HttpProvider) -> None:
        """Test HTML title parsing is case insensitive."""
        html = "<html><head><TITLE>Test Title</TITLE></head></html>"
        title = provider._parse_html_title(html)
        assert title == "Test Title"

    @pytest.mark.asyncio
    async def test_initialize(self, provider: HttpProvider) -> None:
        """Test provider initialization."""
        await provider.initialize()
        assert provider._initialized is True

    @pytest.mark.asyncio
    async def test_close(self, provider: HttpProvider) -> None:
        """Test provider close."""
        await provider.initialize()
        await provider.close()
        assert provider._initialized is False

    @pytest.mark.asyncio
    async def test_health_check(self, provider: HttpProvider) -> None:
        """Test health check."""
        result = await provider.health_check()
        assert result is True

    @pytest.mark.asyncio
    async def test_fetch_success(self, provider: HttpProvider) -> None:
        """Test successful fetch."""
        # Mock httpx response
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.url = "https://example.com"
        mock_response.text = "<html><head><title>Test</title></head><body></body></html>"
        mock_response.headers = {"content-type": "text/html"}
        mock_response.cookies = {}
        mock_response.history = []
        mock_response.encoding = "utf-8"

        mock_client = AsyncMock()
        mock_client.get.return_value = mock_response
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch.object(provider, "_build_client", return_value=mock_client):
            result = await provider.fetch("https://example.com")

        assert result.status_code == 200
        assert result.is_success is True
        assert result.title == "Test"


class TestPlaywrightProvider:
    """Tests for PlaywrightProvider."""

    def test_import(self) -> None:
        """Test PlaywrightProvider can be imported."""
        from brf_scraper.browser.playwright_provider import PlaywrightProvider

        provider = PlaywrightProvider()
        assert provider.provider_type == ProviderType.PLAYWRIGHT
        assert provider.name == "playwright"

    def test_is_available(self) -> None:
        """Test is_available property."""
        from brf_scraper.browser.playwright_provider import PlaywrightProvider

        provider = PlaywrightProvider()
        # This will be True if playwright is installed
        # We're just testing the property works
        assert isinstance(provider.is_available, bool)


class TestCamoufoxProvider:
    """Tests for CamoufoxProvider."""

    def test_import(self) -> None:
        """Test CamoufoxProvider can be imported."""
        try:
            from brf_scraper.browser.camoufox_provider import CamoufoxProvider

            provider = CamoufoxProvider()
            assert provider.provider_type == ProviderType.CAMOUFOX
            assert provider.name == "camoufox"
        except ImportError:
            pytest.skip("Camoufox not installed")

    def test_is_available(self) -> None:
        """Test is_available property."""
        try:
            from brf_scraper.browser.camoufox_provider import CamoufoxProvider

            provider = CamoufoxProvider()
            assert isinstance(provider.is_available, bool)
        except ImportError:
            pytest.skip("Camoufox not installed")
