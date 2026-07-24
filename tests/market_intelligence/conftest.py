"""Shared fixtures for market_intelligence tests.

Provides dummy providers (OkProvider, CrashingProvider, SlowProvider),
deterministic clocks, canned transports, and reusable MarketContext fixtures.
"""

from __future__ import annotations

import time
from datetime import datetime, timedelta
from typing import Any

import pytest

from market_intelligence.config import EngineConfig
from market_intelligence.context import GeographicLevel, MarketContext
from market_intelligence.http_client import HttpResponse, Transport
from market_intelligence.models import (
    Finding,
    ProviderResult,
    ProviderStatus,
    Source,
    TrustTier,
)
from market_intelligence.providers.base import Provider, Stage

# ---------------------------------------------------------------------------
# Deterministic clock
# ---------------------------------------------------------------------------

_FIXED_TIMESTAMP = "2026-01-15T12:00:00+00:00"


def fixed_clock() -> datetime:
    return datetime.fromisoformat(_FIXED_TIMESTAMP)


def fixed_iso() -> str:
    return _FIXED_TIMESTAMP


# ---------------------------------------------------------------------------
# Canned HTTP transport
# ---------------------------------------------------------------------------


def canned_transport(status: int, body: bytes) -> Transport:
    """Return a transport that always responds with the given status and body."""

    def _transport(request: Any, timeout: float) -> HttpResponse:
        return HttpResponse(status=status, body=body)

    return _transport


def json_transport(data: object) -> Transport:
    """Return a transport that responds with 200 and the given JSON object."""
    import json

    return canned_transport(200, json.dumps(data).encode("utf-8"))


def text_transport(text: str) -> Transport:
    """Return a transport that responds with 200 and the given text body."""
    return canned_transport(200, text.encode("utf-8"))


def error_transport(status: int = 500) -> Transport:
    """Return a transport that always responds with the given error status."""
    return canned_transport(status, b"Internal Server Error")


def network_error_transport() -> Transport:
    """Return a transport that always raises a connection error."""
    import urllib.error

    def _transport(request: Any, timeout: float) -> HttpResponse:
        raise urllib.error.URLError("simulated network error")

    return _transport


def never_sleep(_: float) -> None:
    """No-op sleep for tests."""
    return None


def always_monotonic() -> float:
    """Fixed monotonic clock for tests."""
    return 1000.0


# ---------------------------------------------------------------------------
# Dummy providers
# ---------------------------------------------------------------------------


class OkProvider(Provider):
    """A minimal conformant provider for testing."""

    id = "ok_provider"
    stage = Stage.PARALLEL
    trust_tier = TrustTier.DIRECTORY
    cache_ttl = timedelta(minutes=5)
    deadline_s = 5.0

    def __init__(
        self,
        findings: list[Finding] | None = None,
        clock: Any = fixed_clock,
    ) -> None:
        self._findings = findings or []
        self._clock = clock

    def collect(self, context: MarketContext) -> ProviderResult:
        findings = self._findings or [
            Finding(
                domain="test",
                key="test_value",
                value=42,
                source=Source(name="test_source"),
                trust_tier=TrustTier.DIRECTORY,
                fetched_at=self._clock().isoformat(),
            )
        ]
        return ProviderResult(
            provider_id=self.id,
            status=ProviderStatus.OK,
            findings=findings,
        )


class NoDataProvider(Provider):
    """A provider that returns no_data."""

    id = "no_data_provider"
    stage = Stage.PARALLEL
    trust_tier = TrustTier.DIRECTORY

    def collect(self, context: MarketContext) -> ProviderResult:
        return ProviderResult(
            provider_id=self.id,
            status=ProviderStatus.NO_DATA,
            detail="no data available",
        )


class CrashingProvider(Provider):
    """A provider that always raises."""

    id = "crashing_provider"
    stage = Stage.PARALLEL
    trust_tier = TrustTier.DIRECTORY

    def collect(self, context: MarketContext) -> ProviderResult:
        raise RuntimeError("deliberate crash for testing")


class SlowProvider(Provider):
    """A provider that always exceeds its deadline."""

    id = "slow_provider"
    stage = Stage.PARALLEL
    trust_tier = TrustTier.DIRECTORY
    deadline_s = 0.1

    def __init__(self, sleep_time: float = 5.0) -> None:
        self._sleep_time = sleep_time

    def collect(self, context: MarketContext) -> ProviderResult:
        time.sleep(self._sleep_time)
        return ProviderResult(
            provider_id=self.id,
            status=ProviderStatus.OK,
            findings=[
                Finding(
                    domain="test",
                    key="slow_value",
                    value="should not arrive",
                    source=Source(name="test_source"),
                    trust_tier=TrustTier.DIRECTORY,
                    fetched_at=fixed_iso(),
                )
            ],
        )


class PartialProvider(Provider):
    """A provider that returns partial results."""

    id = "partial_provider"
    stage = Stage.PARALLEL
    trust_tier = TrustTier.DIRECTORY

    def collect(self, context: MarketContext) -> ProviderResult:
        return ProviderResult(
            provider_id=self.id,
            status=ProviderStatus.PARTIAL,
            detail="only half the data available",
            findings=[
                Finding(
                    domain="test",
                    key="partial_value",
                    value=1,
                    source=Source(name="test_source"),
                    trust_tier=TrustTier.DIRECTORY,
                    fetched_at=fixed_iso(),
                )
            ],
        )


class GatedProvider(Provider):
    """A provider that requires a specific geographic level."""

    id = "gated_provider"
    stage = Stage.PARALLEL
    trust_tier = TrustTier.DIRECTORY
    required_level = GeographicLevel.MUNICIPALITY

    def collect(self, context: MarketContext) -> ProviderResult:
        return ProviderResult(
            provider_id=self.id,
            status=ProviderStatus.OK,
            findings=[
                Finding(
                    domain="test",
                    key="municipal_value",
                    value="municipal data",
                    source=Source(name="test_source"),
                    trust_tier=TrustTier.DIRECTORY,
                    fetched_at=fixed_iso(),
                    municipality=context.municipality,
                )
            ],
        )


class DisabledProvider(Provider):
    """A provider with a known id for DISABLED_PROVIDERS testing."""

    id = "disabled_provider"
    stage = Stage.PARALLEL
    trust_tier = TrustTier.DIRECTORY

    def collect(self, context: MarketContext) -> ProviderResult:
        return ProviderResult(
            provider_id=self.id,
            status=ProviderStatus.OK,
            findings=[
                Finding(
                    domain="test",
                    key="disabled_value",
                    value="should not appear",
                    source=Source(name="test_source"),
                    trust_tier=TrustTier.DIRECTORY,
                    fetched_at=fixed_iso(),
                )
            ],
        )


# ---------------------------------------------------------------------------
# Context fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def country_context() -> MarketContext:
    return MarketContext(country="SE")


@pytest.fixture
def municipality_context() -> MarketContext:
    return MarketContext(country="SE", municipality="Stockholm")


@pytest.fixture
def full_context() -> MarketContext:
    return MarketContext(
        country="SE",
        region="Stockholm",
        county="Stockholms län",
        municipality="Stockholm",
        postal_code="11120",
    )


@pytest.fixture
def empty_context() -> MarketContext:
    return MarketContext()


@pytest.fixture
def config() -> EngineConfig:
    return EngineConfig()
