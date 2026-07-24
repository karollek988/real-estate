"""Tests for the Job repository."""

from __future__ import annotations

from datetime import timedelta
from uuid import uuid4

import pytest

from brf_scraper.jobs.models import Job, JobError, JobStatus
from brf_scraper.jobs.repository import SqliteJobRepository


class TestSqliteJobRepository:
    """Tests for SqliteJobRepository."""

    @pytest.mark.asyncio
    async def test_get_missing_returns_none(self, tmp_path) -> None:
        """Looking up a job that was never saved returns None."""
        repo = SqliteJobRepository(database_url=f"sqlite+aiosqlite:///{tmp_path / 'jobs.db'}")
        await repo.initialize()
        try:
            result = await repo.get(uuid4())
            assert result is None
        finally:
            await repo.close()

    @pytest.mark.asyncio
    async def test_save_and_get_round_trip(self, tmp_path) -> None:
        """A saved job can be fetched back with all fields intact."""
        repo = SqliteJobRepository(database_url=f"sqlite+aiosqlite:///{tmp_path / 'jobs.db'}")
        await repo.initialize()
        try:
            job = Job(brf_name="BRF Solgläntan", organization_number="7691234567")
            job.result.website_url = "https://brfsolglantan.se"
            job.result.downloaded_documents = ["arsredovisning_2023.pdf"]
            await repo.save(job)

            fetched = await repo.get(job.id)

            assert fetched is not None
            assert fetched.id == job.id
            assert fetched.brf_name == "BRF Solgläntan"
            assert fetched.organization_number == "7691234567"
            assert fetched.result.website_url == "https://brfsolglantan.se"
            assert fetched.result.downloaded_documents == ["arsredovisning_2023.pdf"]
        finally:
            await repo.close()

    @pytest.mark.asyncio
    async def test_save_updates_existing_job(self, tmp_path) -> None:
        """Saving a job with the same id again updates it in place."""
        repo = SqliteJobRepository(database_url=f"sqlite+aiosqlite:///{tmp_path / 'jobs.db'}")
        await repo.initialize()
        try:
            job = Job(brf_name="BRF Ekhagen")
            await repo.save(job)

            job.status = JobStatus.CRAWLING
            job.result.pages_crawled = 5
            await repo.save(job)

            fetched = await repo.get(job.id)

            assert fetched is not None
            assert fetched.status == JobStatus.CRAWLING
            assert fetched.result.pages_crawled == 5
        finally:
            await repo.close()

    @pytest.mark.asyncio
    async def test_persists_error(self, tmp_path) -> None:
        """A job's error is round-tripped correctly."""
        repo = SqliteJobRepository(database_url=f"sqlite+aiosqlite:///{tmp_path / 'jobs.db'}")
        await repo.initialize()
        try:
            job = Job(brf_name="BRF Ekhagen")
            job.status = JobStatus.FAILED
            job.error = JobError(stage="discovery", message="No candidates found")
            await repo.save(job)

            fetched = await repo.get(job.id)

            assert fetched is not None
            assert fetched.error is not None
            assert fetched.error.stage == "discovery"
            assert fetched.error.message == "No candidates found"
        finally:
            await repo.close()

    @pytest.mark.asyncio
    async def test_list_orders_newest_first(self, tmp_path) -> None:
        """list() returns jobs ordered by creation time, newest first."""
        repo = SqliteJobRepository(database_url=f"sqlite+aiosqlite:///{tmp_path / 'jobs.db'}")
        await repo.initialize()
        try:
            first = Job(brf_name="BRF First")
            await repo.save(first)
            second = Job(brf_name="BRF Second")
            second.created_at = first.created_at + timedelta(seconds=1)
            await repo.save(second)

            jobs = await repo.list()

            assert [j.brf_name for j in jobs][:2] == ["BRF Second", "BRF First"]
        finally:
            await repo.close()

    @pytest.mark.asyncio
    async def test_list_filters_by_status(self, tmp_path) -> None:
        """list(status=...) only returns jobs in that status."""
        repo = SqliteJobRepository(database_url=f"sqlite+aiosqlite:///{tmp_path / 'jobs.db'}")
        await repo.initialize()
        try:
            queued = Job(brf_name="BRF Queued")
            await repo.save(queued)
            completed = Job(brf_name="BRF Completed", status=JobStatus.COMPLETED)
            await repo.save(completed)

            jobs = await repo.list(status=JobStatus.COMPLETED)

            assert len(jobs) == 1
            assert jobs[0].brf_name == "BRF Completed"
        finally:
            await repo.close()

    @pytest.mark.asyncio
    async def test_survives_reconnect(self, tmp_path) -> None:
        """A job saved by one repository instance is visible to a fresh one
        pointed at the same database file - i.e. it survives a restart.
        """
        db_url = f"sqlite+aiosqlite:///{tmp_path / 'jobs.db'}"

        first_repo = SqliteJobRepository(database_url=db_url)
        await first_repo.initialize()
        job = Job(brf_name="BRF Persistent")
        await first_repo.save(job)
        await first_repo.close()

        second_repo = SqliteJobRepository(database_url=db_url)
        await second_repo.initialize()
        try:
            fetched = await second_repo.get(job.id)
            assert fetched is not None
            assert fetched.brf_name == "BRF Persistent"
        finally:
            await second_repo.close()
