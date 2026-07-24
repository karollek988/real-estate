"""Unit tests for browser models."""

from __future__ import annotations

from brf_scraper.browser.models import (
    BrowserConfig,
    FetchResult,
    ProviderType,
    RobotsTxtInfo,
    RobotsTxtRule,
)


class TestProviderType:
    """Tests for ProviderType enum."""

    def test_provider_types(self) -> None:
        """Test all provider types exist."""
        assert ProviderType.HTTP == "http"
        assert ProviderType.PLAYWRIGHT == "playwright"
        assert ProviderType.CAMOUFOX == "camoufox"

    def test_provider_type_count(self) -> None:
        """Test correct number of provider types."""
        assert len(ProviderType) == 3


class TestFetchResult:
    """Tests for FetchResult model."""

    def test_create_fetch_result(self) -> None:
        """Test creating a FetchResult."""
        result = FetchResult(
            original_url="https://example.com",
            final_url="https://example.com",
            provider_used=ProviderType.HTTP,
            status_code=200,
            html="<html></html>",
            title="Test",
        )
        assert result.original_url == "https://example.com"
        assert result.status_code == 200
        assert result.is_success is True

    def test_fetch_result_defaults(self) -> None:
        """Test FetchResult default values."""
        result = FetchResult(
            original_url="https://example.com",
            final_url="https://example.com",
            provider_used=ProviderType.HTTP,
            status_code=200,
        )
        assert result.id is not None
        assert result.html == ""
        assert result.error is None
        assert result.cookies == {}
        assert result.response_headers == {}

    def test_is_success(self) -> None:
        """Test is_success property."""
        # Success cases
        for status in [200, 201, 204, 301, 302]:
            result = FetchResult(
                original_url="https://example.com",
                final_url="https://example.com",
                provider_used=ProviderType.HTTP,
                status_code=status,
            )
            assert result.is_success is True, f"Status {status} should be success"

    def test_is_success_with_error(self) -> None:
        """Test is_success with error."""
        result = FetchResult(
            original_url="https://example.com",
            final_url="https://example.com",
            provider_used=ProviderType.HTTP,
            status_code=200,
            error="Some error",
        )
        assert result.is_success is False

    def test_is_redirect(self) -> None:
        """Test is_redirect property."""
        for status in [301, 302, 303, 307, 308]:
            result = FetchResult(
                original_url="https://example.com",
                final_url="https://example.com",
                provider_used=ProviderType.HTTP,
                status_code=status,
            )
            assert result.is_redirect is True, f"Status {status} should be redirect"

    def test_is_client_error(self) -> None:
        """Test is_client_error property."""
        for status in [400, 401, 403, 404, 429]:
            result = FetchResult(
                original_url="https://example.com",
                final_url="https://example.com",
                provider_used=ProviderType.HTTP,
                status_code=status,
            )
            assert result.is_client_error is True, f"Status {status} should be client error"

    def test_is_server_error(self) -> None:
        """Test is_server_error property."""
        for status in [500, 502, 503, 504]:
            result = FetchResult(
                original_url="https://example.com",
                final_url="https://example.com",
                provider_used=ProviderType.HTTP,
                status_code=status,
            )
            assert result.is_server_error is True, f"Status {status} should be server error"

    def test_to_dict(self) -> None:
        """Test to_dict method."""
        result = FetchResult(
            original_url="https://example.com",
            final_url="https://example.com",
            provider_used=ProviderType.HTTP,
            status_code=200,
        )
        d = result.to_dict()
        assert "original_url" in d
        assert "status_code" in d
        assert "provider_used" in d


class TestBrowserConfig:
    """Tests for BrowserConfig model."""

    def test_default_config(self) -> None:
        """Test default configuration values."""
        config = BrowserConfig()
        assert config.timeout == 30.0
        assert config.max_retries == 3
        assert config.follow_redirects is True
        assert config.verify_ssl is True
        assert config.headless is True

    def test_custom_config(self) -> None:
        """Test custom configuration."""
        config = BrowserConfig(
            timeout=60.0,
            max_retries=5,
            proxy="http://proxy:8080",
            user_agent="Custom Agent",
        )
        assert config.timeout == 60.0
        assert config.max_retries == 5
        assert config.proxy == "http://proxy:8080"
        assert config.user_agent == "Custom Agent"

    def test_config_with_cookies(self) -> None:
        """Test configuration with cookies."""
        config = BrowserConfig(
            cookies={"session": "abc123", "theme": "dark"},
        )
        assert config.cookies == {"session": "abc123", "theme": "dark"}


class TestRobotsTxt:
    """Tests for RobotsTxtInfo and RobotsTxtRule."""

    def test_robots_txt_rule(self) -> None:
        """Test RobotsTxtRule."""
        rule = RobotsTxtRule(path="/admin/", allow=False)
        assert rule.path == "/admin/"
        assert rule.allow is False

    def test_robots_txt_info(self) -> None:
        """Test RobotsTxtInfo."""
        info = RobotsTxtInfo(
            url="https://example.com/robots.txt",
            user_agent="*",
            rules=[
                RobotsTxtRule(path="/admin/", allow=False),
                RobotsTxtRule(path="/public/", allow=True),
            ],
        )
        assert info.url == "https://example.com/robots.txt"

    def test_is_allowed(self) -> None:
        """Test is_allowed method."""
        info = RobotsTxtInfo(
            url="https://example.com/robots.txt",
            user_agent="*",
            rules=[
                RobotsTxtRule(path="/admin/", allow=False),
                RobotsTxtRule(path="/public/", allow=True),
            ],
        )
        assert info.is_allowed("https://example.com/public/page") is True
        assert info.is_allowed("https://example.com/admin/settings") is False
        assert info.is_allowed("https://example.com/other") is True  # Default allow
