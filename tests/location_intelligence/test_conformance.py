"""F-07 Definition of Done: suite passes for well-behaved providers, catches
violations, and is the documented admission gate for every future provider."""

from __future__ import annotations

import urllib.error

from location_intelligence.config import EngineConfig
from location_intelligence.conformance import check_provider
from location_intelligence.context import AddressContext
from location_intelligence.http_client import HttpClient
from location_intelligence.models import ProviderResult, ProviderStatus
from location_intelligence.providers import default_registry
from location_intelligence.providers.base import Provider
from tests.location_intelligence.conftest import (
    ContextReadingProvider,
    NoDataProvider,
    OkProvider,
    PartialProvider,
    PreStageProvider,
)

WELL_BEHAVED: list[Provider] = [
    OkProvider(),
    NoDataProvider(),
    PartialProvider(),
    PreStageProvider(),
    ContextReadingProvider(),
]


class TestConformance:
    def test_well_behaved_providers_pass(self, context: AddressContext) -> None:
        for provider in WELL_BEHAVED:
            assert check_provider(provider, context) == [], provider.id

    def test_default_registry_providers_pass_even_with_network_down(
        self, context: AddressContext
    ) -> None:
        # The admission gate for production providers, run against a
        # transport where every request fails: providers must degrade to
        # honest statuses (error/no_data), never raise, never fabricate.
        def dead_transport(request: object, timeout: float) -> object:
            raise urllib.error.URLError("network unreachable (conformance drill)")

        client = HttpClient(EngineConfig(), transport=dead_transport, sleep=lambda _: None)  # type: ignore[arg-type]
        for provider in default_registry(client=client).all():
            assert check_provider(provider, context) == [], provider.id

    def test_bad_id_is_caught(self, context: AddressContext) -> None:
        class BadId(OkProvider):
            id = "Bad-Id!"

        violations = check_provider(BadId(), context)
        assert any("snake_case" in v for v in violations)

    def test_raising_collect_is_a_violation(self, context: AddressContext) -> None:
        class Raises(Provider):
            id = "raises_provider"

            def collect(self, ctx: AddressContext) -> ProviderResult:
                raise ValueError("boom")

        violations = check_provider(Raises(), context)
        assert any("degrade to an error-status result" in v for v in violations)

    def test_ok_with_no_findings_is_a_violation(self, context: AddressContext) -> None:
        class EmptyOk(Provider):
            id = "empty_ok_provider"

            def collect(self, ctx: AddressContext) -> ProviderResult:
                return ProviderResult(provider_id=self.id, status=ProviderStatus.OK)

        violations = check_provider(EmptyOk(), context)
        assert any("honest absence" in v for v in violations)

    def test_parallel_provider_patching_context_is_a_violation(
        self, context: AddressContext
    ) -> None:
        class SneakyPatcher(Provider):
            id = "sneaky_patcher"

            def collect(self, ctx: AddressContext) -> ProviderResult:
                return ProviderResult(
                    provider_id=self.id,
                    status=ProviderStatus.OK,
                    context_patch={"municipality": "Nope"},
                )

        violations = check_provider(SneakyPatcher(), context)
        assert any("PRE-stage" in v for v in violations)

    def test_result_id_mismatch_is_a_violation(self, context: AddressContext) -> None:
        class Impostor(Provider):
            id = "impostor_provider"

            def collect(self, ctx: AddressContext) -> ProviderResult:
                return ProviderResult(provider_id="someone_else", status=ProviderStatus.NO_DATA)

        violations = check_provider(Impostor(), context)
        assert any("provider.id" in v for v in violations)
