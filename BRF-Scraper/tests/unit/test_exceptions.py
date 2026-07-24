"""Unit tests for exceptions."""

from __future__ import annotations

from brf_scraper.exceptions import (
    BRFScraperError,
    CrawlerError,
    DatabaseError,
    DownloaderError,
    ExtractorError,
    HTTPError,
    PluginError,
    PluginNotFoundError,
    StorageError,
)


class TestExceptions:
    """Tests for exception hierarchy."""

    def test_base_exception(self) -> None:
        """Test base exception."""
        exc = BRFScraperError("Test error")
        assert str(exc) == "Test error"
        assert exc.message == "Test error"
        assert exc.details == {}

    def test_exception_with_details(self) -> None:
        """Test exception with details."""
        details = {"key": "value"}
        exc = BRFScraperError("Test error", details=details)
        assert exc.details == details
        assert "key" in str(exc)

    def test_http_error(self) -> None:
        """Test HTTP error."""
        exc = HTTPError("Not found", status_code=404, url="https://example.com")
        assert exc.status_code == 404
        assert exc.url == "https://example.com"
        assert "404" in str(exc)

    def test_http_error_without_optional(self) -> None:
        """Test HTTP error without optional fields."""
        exc = HTTPError("Error")
        assert exc.status_code is None
        assert exc.url is None

    def test_plugin_not_found_error(self) -> None:
        """Test plugin not found error."""
        exc = PluginNotFoundError("test-plugin")
        assert exc.plugin_name == "test-plugin"
        assert "test-plugin" in str(exc)

    def test_exception_inheritance(self) -> None:
        """Test exception inheritance hierarchy."""
        assert issubclass(CrawlerError, BRFScraperError)
        assert issubclass(DownloaderError, BRFScraperError)
        assert issubclass(ExtractorError, BRFScraperError)
        assert issubclass(StorageError, BRFScraperError)
        assert issubclass(DatabaseError, StorageError)
        assert issubclass(PluginError, BRFScraperError)
        assert issubclass(PluginNotFoundError, PluginError)
