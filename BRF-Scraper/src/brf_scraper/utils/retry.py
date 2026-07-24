"""Retry utilities with exponential backoff."""

from __future__ import annotations

import asyncio
import functools
import random
from collections.abc import Callable
from typing import Any, TypeVar

from brf_scraper.exceptions import BRFScraperError
from brf_scraper.utils.logging import get_logger

logger = get_logger(__name__)

F = TypeVar("F", bound=Callable[..., Any])


def retry(
    max_retries: int = 3,
    delay: float = 1.0,
    backoff_factor: float = 2.0,
    exceptions: tuple[type[Exception], ...] = (BRFScraperError,),
) -> Callable[[F], F]:
    """Decorator for retrying failed function calls.

    Args:
        max_retries: Maximum number of retry attempts.
        delay: Initial delay between retries in seconds.
        backoff_factor: Multiplier for delay on each retry.
        exceptions: Tuple of exceptions to catch and retry.

    Returns:
        Decorated function with retry logic.
    """

    def decorator(func: F) -> F:
        @functools.wraps(func)
        async def async_wrapper(*args: Any, **kwargs: Any) -> Any:
            last_exception: Exception | None = None
            current_delay = delay

            for attempt in range(max_retries + 1):
                try:
                    return await func(*args, **kwargs)
                except exceptions as e:
                    last_exception = e
                    if attempt < max_retries:
                        jitter = random.uniform(0, 0.5)
                        sleep_time = current_delay + jitter
                        logger.warning(
                            "retry attempt",
                            function=func.__name__,
                            attempt=attempt + 1,
                            max_retries=max_retries,
                            sleep_time=sleep_time,
                            error=str(e),
                        )
                        await asyncio.sleep(sleep_time)
                        current_delay *= backoff_factor
                    else:
                        logger.error(
                            "retry exhausted",
                            function=func.__name__,
                            attempts=attempt + 1,
                            error=str(e),
                        )

            if last_exception:
                raise last_exception
            return None  # This should never be reached

        @functools.wraps(func)
        def sync_wrapper(*args: Any, **kwargs: Any) -> Any:
            last_exception: Exception | None = None
            current_delay = delay

            for attempt in range(max_retries + 1):
                try:
                    return func(*args, **kwargs)
                except exceptions as e:
                    last_exception = e
                    if attempt < max_retries:
                        jitter = random.uniform(0, 0.5)
                        sleep_time = current_delay + jitter
                        logger.warning(
                            "retry attempt",
                            function=func.__name__,
                            attempt=attempt + 1,
                            max_retries=max_retries,
                            sleep_time=sleep_time,
                            error=str(e),
                        )
                        import time

                        time.sleep(sleep_time)
                        current_delay *= backoff_factor
                    else:
                        logger.error(
                            "retry exhausted",
                            function=func.__name__,
                            attempts=attempt + 1,
                            error=str(e),
                        )

            if last_exception:
                raise last_exception
            return None  # This should never be reached

        if asyncio.iscoroutinefunction(func):
            return async_wrapper  # type: ignore
        return sync_wrapper  # type: ignore

    return decorator
