"""Persistent storage for Jobs.

Jobs must survive an application restart mid-run, so every stage
transition is written through this repository before the runner moves
on to the next stage.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import DateTime, String, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from brf_scraper.exceptions import StorageError
from brf_scraper.jobs.models import Job, JobError, JobResult, JobStatus
from brf_scraper.utils.logging import get_logger

logger = get_logger(__name__)


class JobRepository(ABC):
    """Abstract persistent store of Jobs."""

    @abstractmethod
    async def initialize(self) -> None:
        """Initialize storage (connect, create tables)."""

    @abstractmethod
    async def close(self) -> None:
        """Release storage resources."""

    @abstractmethod
    async def save(self, job: Job) -> Job:
        """Insert or update a Job.

        Args:
            job: The Job to persist, in its current state.

        Returns:
            The persisted Job.
        """

    @abstractmethod
    async def get(self, job_id: UUID) -> Job | None:
        """Fetch a Job by id.

        Args:
            job_id: The Job's id.

        Returns:
            The Job, or None if it doesn't exist.
        """

    @abstractmethod
    async def list(
        self,
        status: JobStatus | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[Job]:
        """List Jobs, newest first.

        Args:
            status: Optional status filter.
            limit: Maximum number of results.
            offset: Result offset for pagination.

        Returns:
            Matching Jobs, ordered by creation time descending.
        """

    async def __aenter__(self) -> JobRepository:
        await self.initialize()
        return self

    async def __aexit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        await self.close()


class Base(DeclarativeBase):
    """SQLAlchemy declarative base for the job repository."""


class JobRow(Base):
    """SQLAlchemy model for a Job."""

    __tablename__ = "jobs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    brf_name: Mapped[str] = mapped_column(String(255), nullable=False)
    organization_number: Mapped[str | None] = mapped_column(String(10), nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    result_json: Mapped[str] = mapped_column(String, nullable=False)
    error_json: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    def to_job(self) -> Job:
        """Convert to a Job model."""
        return Job(
            id=UUID(self.id),
            brf_name=self.brf_name,
            organization_number=self.organization_number,
            status=JobStatus(self.status),
            result=JobResult.model_validate_json(self.result_json),
            error=JobError.model_validate_json(self.error_json) if self.error_json else None,
            created_at=self.created_at,
            updated_at=self.updated_at,
            started_at=self.started_at,
            completed_at=self.completed_at,
        )

    @classmethod
    def from_job(cls, job: Job) -> JobRow:
        """Build a row from a Job model."""
        return cls(
            id=str(job.id),
            brf_name=job.brf_name,
            organization_number=job.organization_number,
            status=job.status.value,
            result_json=job.result.model_dump_json(),
            error_json=job.error.model_dump_json() if job.error else None,
            created_at=job.created_at,
            updated_at=job.updated_at,
            started_at=job.started_at,
            completed_at=job.completed_at,
        )


class SqliteJobRepository(JobRepository):
    """SQLAlchemy-backed job repository (SQLite or Postgres)."""

    def __init__(self, database_url: str) -> None:
        """Initialize the repository.

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

        logger.info("job_repository_initialized", url=self._database_url)

    async def close(self) -> None:
        """Close database engine."""
        if self._engine:
            await self._engine.dispose()
            self._engine = None
            logger.info("job_repository_closed")

    async def save(self, job: Job) -> Job:
        """Insert or update a Job, keyed by id."""
        if not self._session_factory:
            raise StorageError("Job repository not initialized")

        async with self._session_factory() as session:
            existing = await session.get(JobRow, str(job.id))
            row = JobRow.from_job(job)

            if existing is not None:
                for column in JobRow.__table__.columns.keys():
                    setattr(existing, column, getattr(row, column))
            else:
                session.add(row)

            await session.commit()

        return job

    async def get(self, job_id: UUID) -> Job | None:
        """Fetch a Job by id."""
        if not self._session_factory:
            raise StorageError("Job repository not initialized")

        async with self._session_factory() as session:
            row = await session.get(JobRow, str(job_id))
            return row.to_job() if row is not None else None

    async def list(
        self,
        status: JobStatus | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[Job]:
        """List Jobs, newest first."""
        if not self._session_factory:
            raise StorageError("Job repository not initialized")

        async with self._session_factory() as session:
            stmt = select(JobRow)
            if status is not None:
                stmt = stmt.where(JobRow.status == status.value)
            stmt = stmt.order_by(JobRow.created_at.desc()).offset(offset).limit(limit)

            result = await session.execute(stmt)
            rows = result.scalars().all()
            return [row.to_job() for row in rows]
