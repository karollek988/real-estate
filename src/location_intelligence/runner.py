"""Engine runner (task F-04).

Pre-stage providers run sequentially and may enrich the AddressContext
(the docs/28 bug-#1 rule: enrichment is threaded in memory between
providers within one run). All other providers run concurrently, each
under its own deadline, each isolated — one provider crashing, hanging,
or being disabled never affects another (doc 37 Task 5).

Caching (task F-06 integration): fresh cache entries short-circuit the
provider call; a failed refetch falls back to the stale entry, visibly
marked ``stale`` (doc 37's stale-if-error rule).
"""

from __future__ import annotations

import logging
import time
from concurrent.futures import Future, ThreadPoolExecutor
from concurrent.futures import TimeoutError as FutureTimeoutError

from location_intelligence.cache import ProviderCache
from location_intelligence.config import EngineConfig
from location_intelligence.context import AddressContext, precision_at_least
from location_intelligence.models import (
    Clock,
    FindingValidationError,
    ProviderResult,
    ProviderRun,
    ProviderStatus,
    utcnow,
)
from location_intelligence.providers.base import Provider, Stage
from location_intelligence.providers.registry import ProviderRegistry

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

    def run(self, context: AddressContext) -> tuple[AddressContext, list[ProviderRun]]:
        """Run all providers; return the enriched context and every run.

        Every registered provider appears in the output exactly once —
        success, failure, timeout, or disabled — so skips are always
        visible in the package (doc 37 Task 6).
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

        # Pre-stage: sequential, context-enriching.
        for provider in self._active(Stage.PRE):
            run = self._invoke(provider, context)
            runs.append(run)
            if run.result.context_patch:
                context = context.patched(**run.result.context_patch)
                logger.debug(
                    "context enriched by %s: %s",
                    provider.id,
                    sorted(run.result.context_patch),
                )

        # Precision gate (task A-05): a provider that declares a minimum
        # geocode precision is skipped — visibly, with the reason — when
        # the enriched context can't meet it.
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

        # Parallel stage: concurrent, isolated, per-provider deadlines.
        if runnable:
            runs.extend(self._run_parallel(runnable, context))

        return context, runs

    @staticmethod
    def _gate_reason(provider: Provider, context: AddressContext) -> str | None:
        if provider.min_precision is None:
            return None
        if context.latitude is None or context.longitude is None:
            return (
                f"skipped: requires coordinates at {provider.min_precision.value} "
                "precision, but the context has no coordinates"
            )
        if not precision_at_least(context.precision, provider.min_precision):
            actual = context.precision.value if context.precision else "unknown"
            return (
                f"skipped: requires {provider.min_precision.value} precision or better, "
                f"context precision is {actual}"
            )
        return None

    def _active(self, stage: Stage) -> list[Provider]:
        return [
            p for p in self._registry.by_stage(stage) if p.id not in self._config.disabled_providers
        ]

    def _run_parallel(
        self, providers: list[Provider], context: AddressContext
    ) -> list[ProviderRun]:
        runs: list[ProviderRun] = []
        started = time.monotonic()
        max_workers = min(self._config.max_workers, len(providers))
        pool = ThreadPoolExecutor(max_workers=max_workers, thread_name_prefix="li-provider")
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
                    logger.warning("provider %s exceeded deadline (%.1fs)", provider.id, deadline)
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
            # wait=False: a timed-out provider thread must not block the run's
            # return (the deadline is the contract; the abandoned thread is
            # left to finish in the background and its result is discarded).
            pool.shutdown(wait=False, cancel_futures=True)
        return runs

    def _deadline_s(self, provider: Provider) -> float:
        return provider.deadline_s if provider.deadline_s else self._config.default_deadline_s

    def _invoke(self, provider: Provider, context: AddressContext) -> ProviderRun:
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
                result=cached.result, duration_ms=duration_ms, from_cache=True, stale=True
            )

        if (
            self._cache is not None
            and provider.cache_ttl is not None
            and result.status in (ProviderStatus.OK, ProviderStatus.NO_DATA)
        ):
            self._cache.put(provider.id, cache_key, result)

        return ProviderRun(result=result, duration_ms=duration_ms)
