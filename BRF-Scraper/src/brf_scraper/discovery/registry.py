"""Verified BRF website registry - the highest-confidence discovery source.

Once a website has been confirmed correct (automatically at high
confidence, or by a human), it is stored here. Future lookups check this
registry before running Discovery again, so a given BRF only needs to be
resolved once.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import datetime
from enum import StrEnum
from typing import Any
from uuid import UUID, uuid4

from pydantic import BaseModel, Field
from sqlalchemy import DateTime, Float, String, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from brf_scraper.exceptions import StorageError
from brf_scraper.utils.logging import get_logger

logger = get_logger(__name__)


class VerificationMethod(StrEnum):
    """How a verified website's correctness was established."""

    AUTOMATIC = "automatic"
    USER_CONFIRMED = "user_confirmed"
    ADMINISTRATOR = "administrator"


def normalize_brf_name(name: str) -> str:
    """Normalize a BRF name for use as a registry lookup key."""
    return " ".join(name.lower().strip().split())


class VerifiedWebsite(BaseModel):
    """A BRF website whose correctness has been established."""

    id: UUID = Field(default_factory=uuid4)
    brf_name: str
    organization_number: str | None = None
    website_url: str
    verification_method: VerificationMethod
    confidence: float = Field(ge=0.0, le=1.0)
    verified_at: datetime = Field(default_factory=datetime.now)


class VerifiedWebsiteRegistry(ABC):
    """Abstract persistent store of verified official BRF websites."""

    @abstractmethod
    async def initialize(self) -> None:
        """Initialize storage (connect, create tables)."""

    @abstractmethod
    async def close(self) -> None:
        """Release storage resources."""

    @abstractmethod
    async def get(
        self, brf_name: str, organization_number: str | None = None
    ) -> VerifiedWebsite | None:
        """Look up a verified website for a BRF.

        Organization number is checked first when present, since it is
        unambiguous; name is the fallback key.

        Args:
            brf_name: BRF name to look up.
            organization_number: Organization number, preferred key when present.

        Returns:
            The verified website, or None if this BRF has never been verified.
        """

    @abstractmethod
    async def save(self, verified: VerifiedWebsite) -> VerifiedWebsite:
        """Store (or overwrite) a verified website.

        Args:
            verified: The verification record to persist.

        Returns:
            The stored record.
        """

    async def __aenter__(self) -> VerifiedWebsiteRegistry:
        await self.initialize()
        return self

    async def __aexit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        await self.close()


class Base(DeclarativeBase):
    """SQLAlchemy declarative base for the verified-website registry."""


class VerifiedWebsiteRow(Base):
    """SQLAlchemy model for a verified BRF website."""

    __tablename__ = "verified_websites"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    brf_name_key: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    brf_name: Mapped[str] = mapped_column(String(255), nullable=False)
    organization_number: Mapped[str | None] = mapped_column(
        String(10), nullable=True, unique=True, index=True
    )
    website_url: Mapped[str] = mapped_column(String(2048), nullable=False)
    verification_method: Mapped[str] = mapped_column(String(32), nullable=False)
    confidence: Mapped[float] = mapped_column(Float, nullable=False)
    verified_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)

    def to_model(self) -> VerifiedWebsite:
        """Convert to a VerifiedWebsite model."""
        return VerifiedWebsite(
            id=UUID(self.id),
            brf_name=self.brf_name,
            organization_number=self.organization_number,
            website_url=self.website_url,
            verification_method=VerificationMethod(self.verification_method),
            confidence=self.confidence,
            verified_at=self.verified_at,
        )


class SqliteVerifiedWebsiteRegistry(VerifiedWebsiteRegistry):
    """SQLAlchemy-backed verified website registry (SQLite or Postgres)."""

    def __init__(self, database_url: str) -> None:
        """Initialize the registry.

        Args:
            database_url: Async SQLAlchemy database URL.
        """
        self._database_url = database_url
        self._engine: Any = None
        self._session_factory: Any = None

    async def initialize(self) -> None:
        """Initialize database engine and create tables."""
        self._engine = create_async_engine(self._database_url, echo=False)
        self._session_factory = async_sessionmaker(
            self._engine,
            class_=AsyncSession,
            expire_on_commit=False,
        )
        async with self._engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        logger.info("verified_website_registry_initialized", url=self._database_url)

    async def close(self) -> None:
        """Close database engine."""
        if self._engine:
            await self._engine.dispose()
            self._engine = None
            logger.info("verified_website_registry_closed")

    async def get(
        self, brf_name: str, organization_number: str | None = None
    ) -> VerifiedWebsite | None:
        """Look up a verified website for a BRF, org number first."""
        if not self._session_factory:
            raise StorageError("Verified website registry not initialized")

        async with self._session_factory() as session:
            if organization_number:
                stmt = select(VerifiedWebsiteRow).where(
                    VerifiedWebsiteRow.organization_number == organization_number
                )
                by_org = (await session.execute(stmt)).scalar_one_or_none()
                if by_org is not None:
                    return by_org.to_model()  # type: ignore[no-any-return]

            stmt = select(VerifiedWebsiteRow).where(
                VerifiedWebsiteRow.brf_name_key == normalize_brf_name(brf_name)
            )
            row = (await session.execute(stmt)).scalar_one_or_none()
            return row.to_model() if row is not None else None

    async def save(self, verified: VerifiedWebsite) -> VerifiedWebsite:
        """Store (or overwrite) a verified website, keyed by org number then name."""
        if not self._session_factory:
            raise StorageError("Verified website registry not initialized")

        name_key = normalize_brf_name(verified.brf_name)

        async with self._session_factory() as session:
            existing: VerifiedWebsiteRow | None = None
            if verified.organization_number:
                stmt = select(VerifiedWebsiteRow).where(
                    VerifiedWebsiteRow.organization_number == verified.organization_number
                )
                existing = (await session.execute(stmt)).scalar_one_or_none()
            if existing is None:
                stmt = select(VerifiedWebsiteRow).where(
                    VerifiedWebsiteRow.brf_name_key == name_key
                )
                existing = (await session.execute(stmt)).scalar_one_or_none()

            if existing is not None:
                existing.brf_name = verified.brf_name
                existing.brf_name_key = name_key
                existing.organization_number = verified.organization_number
                existing.website_url = verified.website_url
                existing.verification_method = verified.verification_method.value
                existing.confidence = verified.confidence
                existing.verified_at = verified.verified_at
            else:
                session.add(
                    VerifiedWebsiteRow(
                        id=str(verified.id),
                        brf_name_key=name_key,
                        brf_name=verified.brf_name,
                        organization_number=verified.organization_number,
                        website_url=verified.website_url,
                        verification_method=verified.verification_method.value,
                        confidence=verified.confidence,
                        verified_at=verified.verified_at,
                    )
                )

            await session.commit()

        return verified
