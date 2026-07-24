"""Provider conformance checks (task F-07) — the admission gate.

Doc 37 Task 9: "may this provider join the fleet?" is answered by
mechanical checks, not by reading its internals. Runtime behaviors
(deadline compliance, crash isolation) are enforced and tested at the
runner level; these checks cover everything verifiable on the provider
itself plus one real `collect()` round-trip.

Usage: ``check_provider(provider, context)`` returns a list of violation
messages — empty means conformant. The test suite runs it over every
registered provider; CI keeps it that way.
"""

from __future__ import annotations

import re
from datetime import timedelta

from location_intelligence.context import AddressContext, GeocodePrecision
from location_intelligence.models import ProviderResult, ProviderStatus, TrustTier
from location_intelligence.providers.base import Provider, Stage

_ID_PATTERN = re.compile(r"^[a-z][a-z0-9_]*$")


def check_provider(provider: Provider, context: AddressContext) -> list[str]:
    violations = _check_declaration(provider)
    if violations:
        # Declaration problems make the collect() check unreliable; report early.
        return violations
    violations.extend(_check_collect(provider, context))
    return violations


def _check_declaration(provider: Provider) -> list[str]:
    violations: list[str] = []
    name = type(provider).__name__

    if not provider.id or not _ID_PATTERN.match(provider.id):
        violations.append(
            f"{name}: id {provider.id!r} must be lowercase snake_case (used in env vars, "
            "cache paths, and package output)"
        )
    if not isinstance(provider.stage, Stage):
        violations.append(f"{name}: stage must be a Stage, got {provider.stage!r}")
    if not isinstance(provider.trust_tier, TrustTier):
        violations.append(f"{name}: trust_tier must be a TrustTier, got {provider.trust_tier!r}")
    if provider.cache_ttl is not None and (
        not isinstance(provider.cache_ttl, timedelta) or provider.cache_ttl <= timedelta(0)
    ):
        violations.append(f"{name}: cache_ttl must be None or a positive timedelta")
    if provider.deadline_s is not None and provider.deadline_s <= 0:
        violations.append(f"{name}: deadline_s must be None or positive")
    if provider.min_precision is not None and not isinstance(
        provider.min_precision, GeocodePrecision
    ):
        violations.append(
            f"{name}: min_precision must be None or a GeocodePrecision, "
            f"got {provider.min_precision!r}"
        )
    return violations


def _check_collect(provider: Provider, context: AddressContext) -> list[str]:
    violations: list[str] = []
    name = type(provider).__name__

    try:
        result = provider.collect(context)
    except Exception as exc:  # noqa: BLE001 — the whole point is to observe it
        return [
            f"{name}: collect() raised {type(exc).__name__}: {exc} — providers should "
            "degrade to an error-status result with a detail (docs/28 pattern); the "
            "runner's isolation is a safety net, not the contract"
        ]

    if not isinstance(result, ProviderResult):
        return [f"{name}: collect() must return a ProviderResult, got {type(result).__name__}"]

    if result.provider_id != provider.id:
        violations.append(
            f"{name}: result.provider_id {result.provider_id!r} != provider.id {provider.id!r}"
        )
    if result.status is ProviderStatus.OK and not result.findings and not result.context_patch:
        violations.append(
            f"{name}: status ok with no findings and no context patch — use no_data "
            "when nothing was found (honest absence, docs/28)"
        )
    if result.context_patch and provider.stage is not Stage.PRE:
        violations.append(
            f"{name}: only PRE-stage providers may patch the context (docs/28 bug #1 rule)"
        )
    return violations
