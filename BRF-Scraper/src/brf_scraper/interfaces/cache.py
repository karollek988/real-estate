"""Cache interface implementations."""

from __future__ import annotations

from typing import Any

from brf_scraper.base import Cache
from brf_scraper.utils.logging import get_logger

__all__ = [
    "Cache",
    "InMemoryCache",
    "RedisCache",
    "create_cache",
]

logger = get_logger(__name__)


class InMemoryCache(Cache):
    """Simple in-memory cache implementation."""

    def __init__(self, max_size: int = 1000, default_ttl: int = 300) -> None:
        """Initialize in-memory cache.

        Args:
            max_size: Maximum number of items in cache.
            default_ttl: Default time-to-live in seconds.
        """
        self._cache: dict[str, tuple[Any, float | None]] = {}
        self._max_size = max_size
        self._default_ttl = default_ttl

    async def initialize(self) -> None:
        """Initialize the cache."""
        logger.info("initialized_in_memory_cache", max_size=self._max_size)

    async def close(self) -> None:
        """Clean up resources."""
        self._cache.clear()

    async def get(self, key: str) -> Any | None:
        """Get value from cache."""
        import time

        if key in self._cache:
            value, expires_at = self._cache[key]
            if expires_at is None or expires_at > time.time():
                return value
            # Expired, remove it
            del self._cache[key]
        return None

    async def set(self, key: str, value: Any, ttl: int | None = None) -> bool:
        """Set value in cache."""
        import time

        # Evict if at capacity
        if len(self._cache) >= self._max_size and key not in self._cache:
            # Simple LRU: remove oldest
            oldest_key = next(iter(self._cache))
            del self._cache[oldest_key]

        effective_ttl = ttl or self._default_ttl
        expires_at = time.time() + effective_ttl if effective_ttl > 0 else None
        self._cache[key] = (value, expires_at)
        return True

    async def delete(self, key: str) -> bool:
        """Delete value from cache."""
        if key in self._cache:
            del self._cache[key]
            return True
        return False

    async def exists(self, key: str) -> bool:
        """Check if key exists in cache."""
        value = await self.get(key)
        return value is not None

    async def clear(self) -> bool:
        """Clear all cached values."""
        self._cache.clear()
        return True

    async def get_many(self, keys: list[str]) -> dict[str, Any]:
        """Get multiple values from cache."""
        result = {}
        for key in keys:
            value = await self.get(key)
            if value is not None:
                result[key] = value
        return result

    async def set_many(self, items: dict[str, Any], ttl: int | None = None) -> bool:
        """Set multiple values in cache."""
        for key, value in items.items():
            await self.set(key, value, ttl)
        return True


class RedisCache(Cache):
    """Redis cache implementation (stub)."""

    def __init__(self, url: str = "redis://localhost:6379/0") -> None:
        """Initialize Redis cache.

        Args:
            url: Redis connection URL.
        """
        self._url = url
        self._client: Any = None

    async def initialize(self) -> None:
        """Initialize Redis connection."""
        try:
            import redis.asyncio as aioredis

            self._client = aioredis.from_url(
                self._url,
                decode_responses=True,
            )
            await self._client.ping()
            logger.info("connected_to_redis", url=self._url)
        except ImportError:
            logger.warning("redis_not_installed_using_in_memory")
            # Fallback to in-memory
            self._client = None
        except Exception:
            logger.warning("redis_connection_failed")
            self._client = None

    async def close(self) -> None:
        """Close Redis connection."""
        if self._client:
            await self._client.close()

    async def get(self, key: str) -> Any | None:
        """Get value from Redis."""
        if not self._client:
            return None
        return await self._client.get(key)

    async def set(self, key: str, value: Any, ttl: int | None = None) -> bool:
        """Set value in Redis."""
        if not self._client:
            return False
        if ttl:
            await self._client.setex(key, ttl, value)
        else:
            await self._client.set(key, value)
        return True

    async def delete(self, key: str) -> bool:
        """Delete value from Redis."""
        if not self._client:
            return False
        result = await self._client.delete(key)
        return result > 0  # type: ignore[no-any-return]

    async def exists(self, key: str) -> bool:
        """Check if key exists in Redis."""
        if not self._client:
            return False
        return await self._client.exists(key) > 0  # type: ignore[no-any-return]

    async def clear(self) -> bool:
        """Clear all cached values."""
        if not self._client:
            return False
        await self._client.flushdb()
        return True

    async def get_many(self, keys: list[str]) -> dict[str, Any]:
        """Get multiple values from Redis."""
        if not self._client or not keys:
            return {}
        values = await self._client.mget(keys)
        return {key: value for key, value in zip(keys, values, strict=False) if value is not None}

    async def set_many(self, items: dict[str, Any], ttl: int | None = None) -> bool:
        """Set multiple values in Redis."""
        if not self._client:
            return False
        pipe = self._client.pipeline()
        for key, value in items.items():
            if ttl:
                pipe.setex(key, ttl, value)
            else:
                pipe.set(key, value)
        await pipe.execute()
        return True


def create_cache(
    use_redis: bool = False,
    redis_url: str = "redis://localhost:6379/0",
    **kwargs: Any,
) -> Cache:
    """Factory function to create cache instance.

    Args:
        use_redis: Whether to use Redis cache.
        redis_url: Redis connection URL.
        **kwargs: Additional arguments for cache.

    Returns:
        Cache instance.
    """
    if use_redis:
        return RedisCache(url=redis_url)
    return InMemoryCache(**kwargs)
