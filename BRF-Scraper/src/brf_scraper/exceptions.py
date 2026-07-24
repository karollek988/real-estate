"""Custom exception hierarchy for BRF Scraper."""

from __future__ import annotations


class BRFScraperError(Exception):
    """Base exception for all BRF Scraper errors."""

    def __init__(self, message: str = "", details: dict[str, object] | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.details = details or {}

    def __str__(self) -> str:
        if self.details:
            return f"{self.message} - {self.details}"
        return self.message


class ConfigurationError(BRFScraperError):
    """Configuration related errors."""


class BRFConnectionError(BRFScraperError):
    """Connection related errors."""


class RequestTimeoutError(BRFScraperError):
    """Request timeout errors."""


class RateLimitError(BRFScraperError):
    """Rate limit exceeded errors."""


class HTTPError(BRFScraperError):
    """HTTP request errors."""

    def __init__(
        self,
        message: str = "",
        status_code: int | None = None,
        url: str | None = None,
        details: dict[str, object] | None = None,
    ) -> None:
        super().__init__(message, details)
        self.status_code = status_code
        self.url = url

    def __str__(self) -> str:
        parts = [self.message]
        if self.status_code:
            parts.append(f"status={self.status_code}")
        if self.url:
            parts.append(f"url={self.url}")
        return " - ".join(parts)


class CrawlerError(BRFScraperError):
    """Crawler related errors."""


class DiscoveryError(CrawlerError):
    """Discovery phase errors."""


class ParseError(CrawlerError):
    """HTML/XML parsing errors."""


class DownloaderError(BRFScraperError):
    """Downloader related errors."""


class FileTooLargeError(DownloaderError):
    """File exceeds maximum size limit."""

    def __init__(
        self, file_size: int, max_size: int, details: dict[str, object] | None = None
    ) -> None:
        super().__init__(
            f"File size {file_size} exceeds maximum {max_size}",
            details,
        )
        self.file_size = file_size
        self.max_size = max_size


class ChecksumError(DownloaderError):
    """File checksum mismatch errors."""


class ExtractorError(BRFScraperError):
    """Extractor related errors."""


class PDFParseError(ExtractorError):
    """PDF parsing errors."""


class OCRError(ExtractorError):
    """OCR processing errors."""


class ValidationError(ExtractorError):
    """Data validation errors."""


class StorageError(BRFScraperError):
    """Storage related errors."""


class DatabaseError(StorageError):
    """Database operation errors."""


class CacheError(StorageError):
    """Cache operation errors."""


class ExportError(BRFScraperError):
    """Export related errors."""


class PipelineError(BRFScraperError):
    """Pipeline orchestration errors."""


class TaskError(PipelineError):
    """Task execution errors."""


class PluginError(BRFScraperError):
    """Plugin related errors."""


class PluginNotFoundError(PluginError):
    """Plugin not found errors."""

    def __init__(self, plugin_name: str, details: dict[str, object] | None = None) -> None:
        super().__init__(f"Plugin '{plugin_name}' not found", details)
        self.plugin_name = plugin_name


class PluginLoadError(PluginError):
    """Plugin loading errors."""


class BrowserError(BRFScraperError):
    """Browser automation errors."""


class BrowserNotFoundError(BrowserError):
    """Browser not found errors."""


class BrowserTimeoutError(BrowserError):
    """Browser operation timeout errors."""
