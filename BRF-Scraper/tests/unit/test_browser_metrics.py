"""Unit tests for browser metrics."""

from __future__ import annotations

import pytest

from brf_scraper.browser.metrics import FetchMetrics, MetricsCollector, ProviderStats
from brf_scraper.browser.models import ProviderType


class TestFetchMetrics:
    """Tests for FetchMetrics."""

    def test_create_metrics(self) -> None:
        """Test creating FetchMetrics."""
        metrics = FetchMetrics(url="https://example.com", provider=ProviderType.HTTP)
        assert metrics.url == "https://example.com"
        assert metrics.provider == ProviderType.HTTP
        assert metrics.success is False

    def test_metrics_defaults(self) -> None:
        """Test FetchMetrics default values."""
        metrics = FetchMetrics(url="https://example.com", provider=ProviderType.HTTP)
        assert metrics.id is not None
        assert metrics.status_code == 0
        assert metrics.content_length == 0
        assert metrics.retry_count == 0
        assert metrics.error is None

    def test_finish_success(self) -> None:
        """Test finish method with success."""
        metrics = FetchMetrics(url="https://example.com", provider=ProviderType.HTTP)
        metrics.finish(status_code=200, content_length=1000)
        assert metrics.success is True
        assert metrics.status_code == 200
        assert metrics.content_length == 1000
        assert metrics.end_time is not None

    def test_finish_error(self) -> None:
        """Test finish method with error."""
        metrics = FetchMetrics(url="https://example.com", provider=ProviderType.HTTP)
        metrics.finish(
            status_code=500,
            error="Server Error",
            error_code="SERVER_ERROR",
        )
        assert metrics.success is False
        assert metrics.error == "Server Error"
        assert metrics.error_code == "SERVER_ERROR"

    def test_finish_client_error(self) -> None:
        """Test finish method with client error."""
        metrics = FetchMetrics(url="https://example.com", provider=ProviderType.HTTP)
        metrics.finish(status_code=404, error="Not Found")
        assert metrics.success is False

    def test_response_time(self) -> None:
        """Test response time calculation."""
        metrics = FetchMetrics(url="https://example.com", provider=ProviderType.HTTP)
        metrics.finish(status_code=200)
        assert metrics.response_time >= 0

    def test_to_dict(self) -> None:
        """Test to_dict method."""
        metrics = FetchMetrics(url="https://example.com", provider=ProviderType.HTTP)
        metrics.finish(status_code=200)
        d = metrics.to_dict()
        assert "url" in d
        assert "provider" in d
        assert "response_time" in d
        assert "success" in d


class TestProviderStats:
    """Tests for ProviderStats."""

    def test_create_stats(self) -> None:
        """Test creating ProviderStats."""
        stats = ProviderStats(provider=ProviderType.HTTP)
        assert stats.provider == ProviderType.HTTP
        assert stats.total_requests == 0

    def test_success_rate(self) -> None:
        """Test success rate calculation."""
        stats = ProviderStats(provider=ProviderType.HTTP)
        stats.total_requests = 10
        stats.successful_requests = 8
        assert stats.success_rate == 80.0

    def test_success_rate_zero(self) -> None:
        """Test success rate with zero requests."""
        stats = ProviderStats(provider=ProviderType.HTTP)
        assert stats.success_rate == 0.0

    def test_average_response_time(self) -> None:
        """Test average response time calculation."""
        stats = ProviderStats(provider=ProviderType.HTTP)
        stats.successful_requests = 2
        stats.total_response_time = 2.0
        assert stats.average_response_time == 1.0

    def test_average_response_time_zero(self) -> None:
        """Test average response time with zero successful requests."""
        stats = ProviderStats(provider=ProviderType.HTTP)
        assert stats.average_response_time == 0.0

    def test_record_fetch(self) -> None:
        """Test recording a fetch."""
        stats = ProviderStats(provider=ProviderType.HTTP)
        metrics = FetchMetrics(url="https://example.com", provider=ProviderType.HTTP)
        metrics.finish(status_code=200, content_length=1000)

        stats.record_fetch(metrics)

        assert stats.total_requests == 1
        assert stats.successful_requests == 1
        assert stats.total_content_length == 1000

    def test_record_failed_fetch(self) -> None:
        """Test recording a failed fetch."""
        stats = ProviderStats(provider=ProviderType.HTTP)
        metrics = FetchMetrics(url="https://example.com", provider=ProviderType.HTTP)
        metrics.finish(
            status_code=500,
            error="Server Error",
            error_code="SERVER_ERROR",
        )

        stats.record_fetch(metrics)

        assert stats.total_requests == 1
        assert stats.failed_requests == 1
        assert stats.error_counts["SERVER_ERROR"] == 1

    def test_to_dict(self) -> None:
        """Test to_dict method."""
        stats = ProviderStats(provider=ProviderType.HTTP)
        d = stats.to_dict()
        assert "provider" in d
        assert "total_requests" in d
        assert "success_rate" in d


class TestMetricsCollector:
    """Tests for MetricsCollector."""

    @pytest.fixture
    def collector(self) -> MetricsCollector:
        """Create MetricsCollector instance."""
        return MetricsCollector()

    def test_create_collector(self, collector: MetricsCollector) -> None:
        """Test creating MetricsCollector."""
        assert collector is not None

    def test_create_metrics(self, collector: MetricsCollector) -> None:
        """Test creating metrics."""
        metrics = collector.create_metrics("https://example.com", ProviderType.HTTP)
        assert metrics.url == "https://example.com"
        assert metrics.provider == ProviderType.HTTP

    def test_record_fetch(self, collector: MetricsCollector) -> None:
        """Test recording a fetch."""
        metrics = collector.create_metrics("https://example.com", ProviderType.HTTP)
        metrics.finish(status_code=200, content_length=1000)
        collector.record_fetch(metrics)

        stats = collector.get_provider_stats(ProviderType.HTTP)
        assert stats.total_requests == 1
        assert stats.successful_requests == 1

    def test_get_all_stats(self, collector: MetricsCollector) -> None:
        """Test getting all stats."""
        stats = collector.get_all_stats()
        assert "http" in stats
        assert "playwright" in stats
        assert "camoufox" in stats

    def test_get_total_stats(self, collector: MetricsCollector) -> None:
        """Test getting total stats."""
        # Record some fetches
        for i in range(5):
            metrics = collector.create_metrics(f"https://example.com/{i}", ProviderType.HTTP)
            metrics.finish(status_code=200)
            collector.record_fetch(metrics)

        total = collector.get_total_stats()
        assert total["total_requests"] == 5
        assert total["successful_requests"] == 5
        assert total["success_rate"] == 100.0

    def test_get_recent_fetches(self, collector: MetricsCollector) -> None:
        """Test getting recent fetches."""
        # Record some fetches
        for i in range(3):
            metrics = collector.create_metrics(f"https://example.com/{i}", ProviderType.HTTP)
            metrics.finish(status_code=200)
            collector.record_fetch(metrics)

        recent = collector.get_recent_fetches(limit=2)
        assert len(recent) == 2

    def test_reset(self, collector: MetricsCollector) -> None:
        """Test resetting metrics."""
        # Record some fetches
        metrics = collector.create_metrics("https://example.com", ProviderType.HTTP)
        metrics.finish(status_code=200)
        collector.record_fetch(metrics)

        # Reset
        collector.reset()

        total = collector.get_total_stats()
        assert total["total_requests"] == 0
