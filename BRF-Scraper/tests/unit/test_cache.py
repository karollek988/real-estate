"""Unit tests for cache interface."""

from __future__ import annotations

import pytest

from brf_scraper.interfaces.cache import InMemoryCache


@pytest.mark.asyncio
class TestInMemoryCache:
    """Tests for InMemoryCache."""

    async def test_initialize(self, cache: InMemoryCache) -> None:
        """Test cache initialization."""
        assert cache is not None

    async def test_set_and_get(self, cache: InMemoryCache) -> None:
        """Test setting and getting values."""
        await cache.set("key1", "value1")
        result = await cache.get("key1")
        assert result == "value1"

    async def test_get_nonexistent(self, cache: InMemoryCache) -> None:
        """Test getting nonexistent key."""
        result = await cache.get("nonexistent")
        assert result is None

    async def test_delete(self, cache: InMemoryCache) -> None:
        """Test deleting values."""
        await cache.set("key1", "value1")
        deleted = await cache.delete("key1")
        assert deleted is True
        result = await cache.get("key1")
        assert result is None

    async def test_exists(self, cache: InMemoryCache) -> None:
        """Test key existence check."""
        await cache.set("key1", "value1")
        assert await cache.exists("key1") is True
        assert await cache.exists("nonexistent") is False

    async def test_clear(self, cache: InMemoryCache) -> None:
        """Test clearing cache."""
        await cache.set("key1", "value1")
        await cache.set("key2", "value2")
        cleared = await cache.clear()
        assert cleared is True
        assert await cache.exists("key1") is False
        assert await cache.exists("key2") is False

    async def test_set_many(self, cache: InMemoryCache) -> None:
        """Test setting multiple values."""
        items = {"key1": "value1", "key2": "value2", "key3": "value3"}
        result = await cache.set_many(items)
        assert result is True
        assert await cache.get("key1") == "value1"
        assert await cache.get("key2") == "value2"

    async def test_get_many(self, cache: InMemoryCache) -> None:
        """Test getting multiple values."""
        await cache.set("key1", "value1")
        await cache.set("key2", "value2")
        result = await cache.get_many(["key1", "key2", "key3"])
        assert result == {"key1": "value1", "key2": "value2"}

    async def test_max_size_eviction(self) -> None:
        """Test that cache evicts when at max size."""
        cache = InMemoryCache(max_size=3)
        await cache.initialize()

        await cache.set("key1", "value1")
        await cache.set("key2", "value2")
        await cache.set("key3", "value3")
        await cache.set("key4", "value4")  # Should evict key1

        assert await cache.get("key1") is None
        assert await cache.get("key4") == "value4"
