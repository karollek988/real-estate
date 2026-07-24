"""Provider registration (task F-02).

Disabling never removes a provider from the run record — the runner
reports disabled providers with status ``disabled`` so a skip is always
visible in the package (doc 37 Task 6: invisible skips are forbidden).
"""

from __future__ import annotations

import logging
from collections.abc import Iterable

from location_intelligence.providers.base import Provider, Stage

logger = logging.getLogger(__name__)


class ProviderRegistry:
    def __init__(self) -> None:
        self._providers: dict[str, Provider] = {}

    def register(self, provider: Provider) -> None:
        if not provider.id or not provider.id.strip():
            raise ValueError(f"{type(provider).__name__} has no id; set the `id` class attribute")
        if provider.id in self._providers:
            raise ValueError(f"provider id {provider.id!r} is already registered")
        self._providers[provider.id] = provider
        logger.debug("registered provider %s (stage=%s)", provider.id, provider.stage.value)

    def register_all(self, providers: Iterable[Provider]) -> None:
        for provider in providers:
            self.register(provider)

    def all(self) -> list[Provider]:
        return list(self._providers.values())

    def by_stage(self, stage: Stage) -> list[Provider]:
        return [p for p in self._providers.values() if p.stage is stage]

    def __len__(self) -> int:
        return len(self._providers)

    def __contains__(self, provider_id: str) -> bool:
        return provider_id in self._providers
