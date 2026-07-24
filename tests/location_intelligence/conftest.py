"""Shared dummy providers and fixtures for the Wave 1 test suite."""

from __future__ import annotations

import time
from datetime import timedelta

import pytest

from location_intelligence.config import EngineConfig
from location_intelligence.context import AddressContext, InputMode
from location_intelligence.models import (
    Finding,
    ProviderResult,
    ProviderStatus,
    Source,
    TrustTier,
)
from location_intelligence.providers.base import Provider, Stage

FIXED_FETCHED_AT = "2026-07-20T10:00:00+00:00"


def make_finding(domain: str = "test", key: str = "value_count", value: object = 42) -> Finding:
    return Finding(
        domain=domain,
        key=key,
        value=value,
        source=Source(name="Test Source", url="https://example.org", license="CC0"),
        trust_tier=TrustTier.REGISTRY_AUTHORITY,
        fetched_at=FIXED_FETCHED_AT,
    )


class OkProvider(Provider):
    id = "ok_provider"
    trust_tier = TrustTier.REGISTRY_AUTHORITY

    def collect(self, context: AddressContext) -> ProviderResult:
        return ProviderResult(
            provider_id=self.id,
            status=ProviderStatus.OK,
            findings=[
                make_finding(key="first_count", value=1),
                make_finding(key="second_count", value=2),
            ],
        )


class NoDataProvider(Provider):
    id = "no_data_provider"

    def collect(self, context: AddressContext) -> ProviderResult:
        return ProviderResult(provider_id=self.id, status=ProviderStatus.NO_DATA)


class PartialProvider(Provider):
    id = "partial_provider"

    def collect(self, context: AddressContext) -> ProviderResult:
        return ProviderResult(
            provider_id=self.id,
            status=ProviderStatus.PARTIAL,
            findings=[make_finding(key="partial_count", value=7)],
            detail="second upstream call failed; counts present, distances missing",
        )


class CrashingProvider(Provider):
    id = "crashing_provider"

    def collect(self, context: AddressContext) -> ProviderResult:
        raise RuntimeError("simulated upstream explosion")


class SlowProvider(Provider):
    id = "slow_provider"
    deadline_s = 0.2

    def collect(self, context: AddressContext) -> ProviderResult:
        time.sleep(2.0)
        return ProviderResult(provider_id=self.id, status=ProviderStatus.OK)


class PreStageProvider(Provider):
    id = "pre_stage_provider"
    stage = Stage.PRE

    def collect(self, context: AddressContext) -> ProviderResult:
        return ProviderResult(
            provider_id=self.id,
            status=ProviderStatus.OK,
            context_patch={"municipality": "Stockholm", "municipality_code": "0180"},
        )


class ContextReadingProvider(Provider):
    """Records the context it saw — proves pre-stage enrichment reached it."""

    id = "context_reading_provider"

    def __init__(self) -> None:
        self.seen_municipality: str | None = "NOT_CALLED"

    def collect(self, context: AddressContext) -> ProviderResult:
        self.seen_municipality = context.municipality
        return ProviderResult(
            provider_id=self.id,
            status=ProviderStatus.OK,
            findings=[make_finding(key="observed", value=context.municipality)],
        )


class CountingProvider(Provider):
    """Counts collect() calls and can be switched to fail — for cache tests."""

    id = "counting_provider"
    cache_ttl = timedelta(hours=1)

    def __init__(self) -> None:
        self.calls = 0
        self.fail = False

    def collect(self, context: AddressContext) -> ProviderResult:
        self.calls += 1
        if self.fail:
            return ProviderResult(
                provider_id=self.id,
                status=ProviderStatus.ERROR,
                detail="simulated upstream outage",
            )
        return ProviderResult(
            provider_id=self.id,
            status=ProviderStatus.OK,
            findings=[make_finding(key="call_number", value=self.calls)],
        )


@pytest.fixture
def context() -> AddressContext:
    return AddressContext(raw_input="Dalagatan 30, Stockholm", input_mode=InputMode.ADDRESS)


@pytest.fixture
def config() -> EngineConfig:
    return EngineConfig()
