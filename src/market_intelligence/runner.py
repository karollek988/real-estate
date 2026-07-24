"""Engine runner.

All market data providers run concurrently, each under its own deadline,
each isolated — one provider crashing, hanging, or being disabled never
affects another. Geographic level gating skips providers that require
more specific context than available.
"""

from __future__ import annotations

import logging
import time
from concurrent.futures import Future, ThreadPoolExecutor
from concurrent.futures import TimeoutError as FutureTimeoutError

from market_intelligence.cache import ProviderCache
from market_intelligence.config import EngineConfig
from market_intelligence.context import MarketContext, level_at_least
from market_intelligence.models import (
    Clock,
    FindingValidationError,
    ProviderResult,
    ProviderRun,
    ProviderStatus,
    utcnow,
)
from market_intelligence.providers.base import Provider, Stage
from market_intelligence.providers.registry import ProviderRegistry

logger = logging.getLogger(__name__)


class EngineRunner:
    def __init__(
        self,
        registry: ProviderRegistry,
        config: EngineConfig,
        cache: ProviderCache | None = None,
        clock: Clock = utcnow,
    ) -> None:
        self._registry = registry
        self._config = config
        self._cache = cache
        self._clock = clock

    def run(self, context: MarketContext) -> list[ProviderRun]:
        """Run all providers; return every run.

        Every registered provider appears in the output exactly once —
        success, failure, timeout, or disabled — so skips are always
        visible in the package.
        """
        runs: list[ProviderRun] = []

        for provider in self._registry.all():
            if provider.id in self._config.disabled_providers:
                logger.info("provider %s disabled via DISABLED_PROVIDERS", provider.id)
                runs.append(
                    ProviderRun(
                        result=ProviderResult(
                            provider_id=provider.id,
                            status=ProviderStatus.DISABLED,
                            detail="disabled via DISABLED_PROVIDERS",
                        ),
                        duration_ms=0,
                    )
                )

        # Level gate: skip providers that require more specific context.
        runnable: list[Provider] = []
        for provider in self._active(Stage.PARALLEL):
            skip_reason = self._gate_reason(provider, context)
            if skip_reason is None:
                runnable.append(provider)
            else:
                logger.info("provider %s gated: %s", provider.id, skip_reason)
                runs.append(
                    ProviderRun(
                        result=ProviderResult(
                            provider_id=provider.id,
                            status=ProviderStatus.NO_DATA,
                            detail=skip_reason,
                        ),
                        duration_ms=0,
                    )
                )

        if runnable:
            runs.extend(self._run_parallel(runnable, context))

        return runs

    @staticmethod
    def _gate_reason(provider: Provider, context: MarketContext) -> str | None:
        if provider.required_level is None:
            return None
        if context.geographic_level is None:
            return (
                f"skipped: requires {provider.required_level.value} level data, "
                "but the context has no geographic scope"
            )
        if not level_at_least(context.geographic_level, provider.required_level):
            actual = context.geographic_level.value
            return (
                f"skipped: requires {provider.required_level.value} level or more "
                f"specific, context level is {actual}"
            )
        return None

    def _active(self, stage: Stage) -> list[Provider]:
        return [
            p for p in self._registry.by_stage(stage) if p.id not in self._config.disabled_providers
        ]

    def _run_parallel(self, providers: list[Provider], context: MarketContext) -> list[ProviderRun]:
        runs: list[ProviderRun] = []
        started = time.monotonic()
        max_workers = min(self._config.max_workers, len(providers))
        pool = ThreadPoolExecutor(max_workers=max_workers, thread_name_prefix="mi-provider")
        try:
            futures: list[tuple[Provider, Future[ProviderRun]]] = [
                (provider, pool.submit(self._invoke, provider, context)) for provider in providers
            ]
            for provider, future in futures:
                deadline = self._deadline_s(provider)
                remaining = max(0.0, deadline - (time.monotonic() - started))
                try:
                    runs.append(future.result(timeout=remaining))
                except FutureTimeoutError:
                    future.cancel()
                    logger.warning(
                        "provider %s exceeded deadline (%.1fs)",
                        provider.id,
                        deadline,
                    )
                    runs.append(
                        ProviderRun(
                            result=ProviderResult(
                                provider_id=provider.id,
                                status=ProviderStatus.TIMEOUT,
                                detail=f"exceeded deadline of {deadline:.1f}s",
                            ),
                            duration_ms=int(deadline * 1000),
                        )
                    )
        finally:
            pool.shutdown(wait=False, cancel_futures=True)
        return runs

    def _deadline_s(self, provider: Provider) -> float:
        return provider.deadline_s if provider.deadline_s else self._config.default_deadline_s

    def _invoke(self, provider: Provider, context: MarketContext) -> ProviderRun:
        """One isolated provider call, with cache handling."""
        cache_key = context.cache_key()
        cached = None
        if self._cache is not None and provider.cache_ttl is not None:
            cached = self._cache.get(provider.id, cache_key)
            if cached is not None and cached.is_fresh(self._clock(), provider.cache_ttl):
                logger.debug("provider %s served fresh from cache", provider.id)
                return ProviderRun(result=cached.result, duration_ms=0, from_cache=True)

        start = time.monotonic()
        try:
            result = provider.collect(context)
            if result.provider_id != provider.id:
                raise FindingValidationError(
                    f"provider {provider.id!r} returned a result claiming to be "
                    f"{result.provider_id!r}"
                )
        except Exception as exc:
            logger.exception("provider %s raised", provider.id)
            result = ProviderResult(
                provider_id=provider.id,
                status=ProviderStatus.ERROR,
                detail=f"{type(exc).__name__}: {exc}",
            )
        duration_ms = int((time.monotonic() - start) * 1000)

        if result.status is ProviderStatus.ERROR and cached is not None:
            logger.warning(
                "provider %s failed; serving stale cache entry from %s",
                provider.id,
                cached.stored_at.isoformat(),
            )
            return ProviderRun(
                result=cached.result,
                duration_ms=duration_ms,
                from_cache=True,
                stale=True,
            )

        if (
            self._cache is not None
            and provider.cache_ttl is not None
            and result.status in (ProviderStatus.OK, ProviderStatus.NO_DATA)
        ):
            self._cache.put(provider.id, cache_key, result)

        return ProviderRun(result=result, duration_ms=duration_ms)
