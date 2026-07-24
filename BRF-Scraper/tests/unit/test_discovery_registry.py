"""Tests for the verified website registry."""

from __future__ import annotations

import pytest

from brf_scraper.discovery.registry import (
    SqliteVerifiedWebsiteRegistry,
    VerificationMethod,
    VerifiedWebsite,
)
from brf_scraper.exceptions import StorageError


@pytest.fixture
async def registry(tmp_path):
    """A fresh SQLite-backed registry for each test."""
    db_path = tmp_path / "registry.db"
    repo = SqliteVerifiedWebsiteRegistry(database_url=f"sqlite+aiosqlite:///{db_path}")
    await repo.initialize()
    yield repo
    await repo.close()


class TestSqliteVerifiedWebsiteRegistry:
    """Tests for SqliteVerifiedWebsiteRegistry."""

    @pytest.mark.asyncio
    async def test_get_missing_returns_none(self, registry) -> None:
        """Looking up a BRF that was never verified returns None."""
        result = await registry.get("BRF Nowhere")

        assert result is None

    @pytest.mark.asyncio
    async def test_save_and_get_by_name(self, registry) -> None:
        """A saved record can be retrieved by name when no org number is given."""
        record = VerifiedWebsite(
            brf_name="BRF Solgläntan",
            website_url="https://brfsolglantan.se",
            verification_method=VerificationMethod.AUTOMATIC,
            confidence=0.9,
        )
        await registry.save(record)

        result = await registry.get("brf solgläntan")

        assert result is not None
        assert result.website_url == "https://brfsolglantan.se"
        assert result.verification_method == VerificationMethod.AUTOMATIC

    @pytest.mark.asyncio
    async def test_save_and_get_by_organization_number(self, registry) -> None:
        """Organization number is the preferred lookup key when available."""
        record = VerifiedWebsite(
            brf_name="BRF Solgläntan",
            organization_number="7691234567",
            website_url="https://brfsolglantan.se",
            verification_method=VerificationMethod.USER_CONFIRMED,
            confidence=1.0,
        )
        await registry.save(record)

        result = await registry.get("A Different Name Entirely", organization_number="7691234567")

        assert result is not None
        assert result.website_url == "https://brfsolglantan.se"

    @pytest.mark.asyncio
    async def test_save_upserts_existing_record(self, registry) -> None:
        """Saving a record for the same BRF again overwrites, not duplicates."""
        first = VerifiedWebsite(
            brf_name="BRF Ekhagen",
            organization_number="1112223334",
            website_url="https://old-ekhagen.se",
            verification_method=VerificationMethod.AUTOMATIC,
            confidence=0.8,
        )
        await registry.save(first)

        second = VerifiedWebsite(
            brf_name="BRF Ekhagen",
            organization_number="1112223334",
            website_url="https://new-ekhagen.se",
            verification_method=VerificationMethod.ADMINISTRATOR,
            confidence=1.0,
        )
        await registry.save(second)

        result = await registry.get("BRF Ekhagen", organization_number="1112223334")

        assert result is not None
        assert result.website_url == "https://new-ekhagen.se"
        assert result.verification_method == VerificationMethod.ADMINISTRATOR

    @pytest.mark.asyncio
    async def test_persists_across_get_not_initialized_error(self, tmp_path) -> None:
        """Using the registry before initialize() raises a clear error."""
        db_path = tmp_path / "uninitialized.db"
        repo = SqliteVerifiedWebsiteRegistry(database_url=f"sqlite+aiosqlite:///{db_path}")

        with pytest.raises(StorageError):
            await repo.get("BRF Test")
