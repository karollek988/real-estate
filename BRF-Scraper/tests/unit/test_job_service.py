"""Tests for JobService."""

from __future__ import annotations

from uuid import uuid4

import pytest

from brf_scraper.exceptions import BRFScraperError
from brf_scraper.jobs.models import Job, JobStatus
from brf_scraper.jobs.repository import SqliteJobRepository
from brf_scraper.jobs.runner import JobContext, JobRunner, JobStage
from brf_scraper.jobs.service import JobService


class FakeStage(JobStage):
    """A stage that always succeeds, for service-level tests."""

    def __init__(self, status: JobStatus) -> None:
        self.status = status

    async def run(self, job: Job, context: JobContext) -> None:
        job.result.pages_crawled += 1


@pytest.fixture
async def service(tmp_path):
    """A JobService backed by a temp SQLite DB and fake (always-succeed) stages."""
    repo = SqliteJobRepository(database_url=f"sqlite+aiosqlite:///{tmp_path / 'jobs.db'}")
    await repo.initialize()
    runner = JobRunner(repository=repo, stages=[FakeStage(JobStatus.DISCOVERING)])
    svc = JobService(repository=repo, runner=runner)
    yield svc
    await repo.close()


class TestJobServiceCreate:
    """Tests for JobService.create()."""

    @pytest.mark.asyncio
    async def test_create_runs_immediately_by_default(self, service) -> None:
        """create() runs the job to completion by default."""
        job = await service.create(brf_name="BRF Solgläntan")

        assert job.status == JobStatus.COMPLETED
        assert job.result.pages_crawled == 1

    @pytest.mark.asyncio
    async def test_create_persists_before_running(self, service) -> None:
        """The job exists in the repository as QUEUED even before it finishes."""
        # run_immediately=False proves the QUEUED job was persisted independent
        # of execution - if it weren't, get() would find nothing.
        job = await service.create(brf_name="BRF Solgläntan", run_immediately=False)

        assert job.status == JobStatus.QUEUED
        fetched = await service.get(job.id)
        assert fetched is not None
        assert fetched.status == JobStatus.QUEUED

    @pytest.mark.asyncio
    async def test_run_immediately_false_does_not_execute_stages(self, service) -> None:
        """run_immediately=False leaves the job QUEUED without running stages."""
        job = await service.create(brf_name="BRF Solgläntan", run_immediately=False)

        assert job.result.pages_crawled == 0

    @pytest.mark.asyncio
    async def test_create_stores_organization_number(self, service) -> None:
        """create() persists the organization number onto the job."""
        job = await service.create(
            brf_name="BRF Solgläntan", organization_number="7691234567", run_immediately=False
        )

        assert job.organization_number == "7691234567"


class TestJobServiceRun:
    """Tests for JobService.run() - the future-worker entry point."""

    @pytest.mark.asyncio
    async def test_run_executes_a_queued_job(self, service) -> None:
        """run() picks up a previously queued job and completes it."""
        job = await service.create(brf_name="BRF Ekhagen", run_immediately=False)
        assert job.status == JobStatus.QUEUED

        result = await service.run(job.id)

        assert result.status == JobStatus.COMPLETED
        fetched = await service.get(job.id)
        assert fetched is not None
        assert fetched.status == JobStatus.COMPLETED

    @pytest.mark.asyncio
    async def test_run_missing_job_raises(self, service) -> None:
        """run() on an id that doesn't exist raises a clear error."""
        with pytest.raises(BRFScraperError):
            await service.run(uuid4())


class TestJobServiceQueries:
    """Tests for JobService.get() and .list()."""

    @pytest.mark.asyncio
    async def test_get_missing_returns_none(self, service) -> None:
        """get() on an unknown id returns None."""
        assert await service.get(uuid4()) is None

    @pytest.mark.asyncio
    async def test_list_returns_created_jobs(self, service) -> None:
        """list() returns jobs created via the service."""
        await service.create(brf_name="BRF One")
        await service.create(brf_name="BRF Two")

        jobs = await service.list()

        assert {j.brf_name for j in jobs} == {"BRF One", "BRF Two"}

    @pytest.mark.asyncio
    async def test_list_filters_by_status(self, service) -> None:
        """list(status=...) filters correctly."""
        await service.create(brf_name="BRF Completed")
        await service.create(brf_name="BRF Queued", run_immediately=False)

        completed = await service.list(status=JobStatus.COMPLETED)
        queued = await service.list(status=JobStatus.QUEUED)

        assert [j.brf_name for j in completed] == ["BRF Completed"]
        assert [j.brf_name for j in queued] == ["BRF Queued"]


class TestJobServiceBuild:
    """Tests for the JobService.build() convenience factory."""

    @pytest.mark.asyncio
    async def test_build_creates_working_service(self, tmp_path, monkeypatch) -> None:
        """build() wires a usable SQLite-backed service."""
        from brf_scraper.config import AppSettings

        settings = AppSettings()
        settings.database.url = f"sqlite+aiosqlite:///{tmp_path / 'built.db'}"

        svc = JobService.build(settings=settings)
        await svc.initialize()
        try:
            job = await svc.create(brf_name="BRF Solgläntan", run_immediately=False)
            fetched = await svc.get(job.id)
            assert fetched is not None
        finally:
            await svc.close()
