"""Metrics collection for browser operations."""

from __future__ import annotations

import time
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Any
from uuid import UUID, uuid4

from brf_scraper.browser.models import ProviderType
from brf_scraper.utils.logging import get_logger

logger = get_logger(__name__)


@dataclass
class FetchMetrics:
    """Metrics for a single fetch operation."""

    id: UUID = field(default_factory=uuid4)
    url: str = ""
    provider: ProviderType = ProviderType.HTTP
    start_time: float = field(default_factory=time.monotonic)
    end_time: float | None = None
    status_code: int = 0
    content_length: int = 0
    redirect_count: int = 0
    retry_count: int = 0
    error: str | None = None
    error_code: str | None = None
    success: bool = False

    @property
    def response_time(self) -> float:
        """Calculate response time in seconds."""
        if self.end_time:
            return self.end_time - self.start_time
        return 0.0

    def finish(
        self,
        status_code: int = 200,
        content_length: int = 0,
        redirect_count: int = 0,
        error: str | None = None,
        error_code: str | None = None,
    ) -> None:
        """Mark the fetch as complete."""
        self.end_time = time.monotonic()
        self.status_code = status_code
        self.content_length = content_length
        self.redirect_count = redirect_count
        self.error = error
        self.error_code = error_code
        self.success = error is None and 200 <= status_code < 400

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": str(self.id),
            "url": self.url,
            "provider": self.provider,
            "response_time": self.response_time,
            "status_code": self.status_code,
            "content_length": self.content_length,
            "redirect_count": self.redirect_count,
            "retry_count": self.retry_count,
            "error": self.error,
            "error_code": self.error_code,
            "success": self.success,
        }


@dataclass
class ProviderStats:
    """Aggregated statistics for a provider."""

    provider: ProviderType
    total_requests: int = 0
    successful_requests: int = 0
    failed_requests: int = 0
    total_response_time: float = 0.0
    total_content_length: int = 0
    total_redirects: int = 0
    total_retries: int = 0
    error_counts: dict[str, int] = field(default_factory=lambda: defaultdict(int))

    @property
    def success_rate(self) -> float:
        """Calculate success rate as percentage."""
        if self.total_requests == 0:
            return 0.0
        return (self.successful_requests / self.total_requests) * 100

    @property
    def average_response_time(self) -> float:
        """Calculate average response time."""
        if self.successful_requests == 0:
            return 0.0
        return self.total_response_time / self.successful_requests

    @property
    def average_content_length(self) -> float:
        """Calculate average content length."""
        if self.successful_requests == 0:
            return 0.0
        return self.total_content_length / self.successful_requests

    def record_fetch(self, metrics: FetchMetrics) -> None:
        """Record a fetch operation."""
        self.total_requests += 1

        if metrics.success:
            self.successful_requests += 1
            self.total_response_time += metrics.response_time
            self.total_content_length += metrics.content_length
        else:
            self.failed_requests += 1
            if metrics.error_code:
                self.error_counts[metrics.error_code] += 1

        self.total_redirects += metrics.redirect_count
        self.total_retries += metrics.retry_count

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary."""
        return {
            "provider": self.provider,
            "total_requests": self.total_requests,
            "successful_requests": self.successful_requests,
            "failed_requests": self.failed_requests,
            "success_rate": self.success_rate,
            "average_response_time": self.average_response_time,
            "average_content_length": self.average_content_length,
            "total_redirects": self.total_redirects,
            "total_retries": self.total_retries,
            "error_counts": dict(self.error_counts),
        }


class MetricsCollector:
    """Collect and aggregate metrics for browser operations."""

    def __init__(self) -> None:
        """Initialize metrics collector."""
        self._provider_stats: dict[ProviderType, ProviderStats] = {}
        self._fetch_history: list[FetchMetrics] = []
        self._start_time = time.monotonic()
        self._max_history = 10000

        # Initialize stats for each provider
        for provider_type in ProviderType:
            self._provider_stats[provider_type] = ProviderStats(provider=provider_type)

    def create_metrics(self, url: str, provider: ProviderType) -> FetchMetrics:
        """Create new metrics for a fetch operation.

        Args:
            url: URL being fetched.
            provider: Provider being used.

        Returns:
            New FetchMetrics instance.
        """
        return FetchMetrics(url=url, provider=provider)

    def record_fetch(self, metrics: FetchMetrics) -> None:
        """Record a completed fetch operation.

        Args:
            metrics: Completed fetch metrics.
        """
        # Update provider stats
        if metrics.provider in self._provider_stats:
            self._provider_stats[metrics.provider].record_fetch(metrics)

        # Add to history (with max size limit)
        self._fetch_history.append(metrics)
        if len(self._fetch_history) > self._max_history:
            self._fetch_history = self._fetch_history[-self._max_history :]

        # Log the metrics
        logger.info(
            "fetch_metrics_recorded",
            url=metrics.url,
            provider=metrics.provider,
            response_time=metrics.response_time,
            status_code=metrics.status_code,
            success=metrics.success,
        )

    def get_provider_stats(self, provider: ProviderType) -> ProviderStats:
        """Get statistics for a specific provider.

        Args:
            provider: Provider type.

        Returns:
            ProviderStats for the provider.
        """
        return self._provider_stats.get(
            provider,
            ProviderStats(provider=provider),
        )

    def get_all_stats(self) -> dict[str, dict[str, Any]]:
        """Get statistics for all providers.

        Returns:
            Dictionary of provider statistics.
        """
        return {provider.value: stats.to_dict() for provider, stats in self._provider_stats.items()}

    def get_total_stats(self) -> dict[str, Any]:
        """Get aggregate statistics across all providers.

        Returns:
            Total statistics dictionary.
        """
        total_requests = 0
        total_successful = 0
        total_failed = 0
        total_response_time = 0.0
        total_content_length = 0
        total_redirects = 0
        total_retries = 0
        all_errors: dict[str, int] = defaultdict(int)

        for stats in self._provider_stats.values():
            total_requests += stats.total_requests
            total_successful += stats.successful_requests
            total_failed += stats.failed_requests
            total_response_time += stats.total_response_time
            total_content_length += stats.total_content_length
            total_redirects += stats.total_redirects
            total_retries += stats.total_retries
            for error_code, count in stats.error_counts.items():
                all_errors[error_code] += count

        uptime = time.monotonic() - self._start_time

        return {
            "uptime_seconds": uptime,
            "total_requests": total_requests,
            "successful_requests": total_successful,
            "failed_requests": total_failed,
            "success_rate": (total_successful / total_requests * 100)
            if total_requests > 0
            else 0.0,
            "average_response_time": (total_response_time / total_successful)
            if total_successful > 0
            else 0.0,
            "total_content_length": total_content_length,
            "total_redirects": total_redirects,
            "total_retries": total_retries,
            "error_counts": dict(all_errors),
            "providers": self.get_all_stats(),
        }

    def get_recent_fetches(self, limit: int = 100) -> list[dict[str, Any]]:
        """Get recent fetch operations.

        Args:
            limit: Maximum number of fetches to return.

        Returns:
            List of recent fetch metrics.
        """
        recent = self._fetch_history[-limit:]
        return [m.to_dict() for m in reversed(recent)]

    def reset(self) -> None:
        """Reset all metrics."""
        self._provider_stats.clear()
        self._fetch_history.clear()
        self._start_time = time.monotonic()

        for provider_type in ProviderType:
            self._provider_stats[provider_type] = ProviderStats(provider=provider_type)

        logger.info("metrics_reset")


# Global metrics collector instance
_metrics_collector: MetricsCollector | None = None


def get_metrics_collector() -> MetricsCollector:
    """Get the global metrics collector instance.

    Returns:
        MetricsCollector instance.
    """
    global _metrics_collector
    if _metrics_collector is None:
        _metrics_collector = MetricsCollector()
    return _metrics_collector
