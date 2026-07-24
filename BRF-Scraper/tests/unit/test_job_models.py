"""Tests for the Job domain model."""

from __future__ import annotations

from brf_scraper.jobs.models import Job, JobError, JobResult, JobStatus


class TestJobStatus:
    """Tests for JobStatus."""

    def test_terminal_statuses(self) -> None:
        """Only COMPLETED and FAILED are terminal."""
        assert JobStatus.COMPLETED.is_terminal is True
        assert JobStatus.FAILED.is_terminal is True
        assert JobStatus.QUEUED.is_terminal is False
        assert JobStatus.DISCOVERING.is_terminal is False
        assert JobStatus.CRAWLING.is_terminal is False
        assert JobStatus.DOWNLOADING.is_terminal is False


class TestJob:
    """Tests for the Job model."""

    def test_defaults(self) -> None:
        """A new Job starts QUEUED with an empty result and no error."""
        job = Job(brf_name="BRF Solgläntan")

        assert job.status == JobStatus.QUEUED
        assert job.organization_number is None
        assert job.error is None
        assert isinstance(job.result, JobResult)
        assert job.result.downloaded_documents == []
        assert job.started_at is None
        assert job.completed_at is None

    def test_touch_updates_timestamp(self) -> None:
        """touch() advances updated_at."""
        job = Job(brf_name="BRF Solgläntan")
        original = job.updated_at

        job.touch()

        assert job.updated_at >= original

    def test_job_error_has_stage_and_message(self) -> None:
        """JobError carries the failing stage and a message."""
        error = JobError(stage="discovery", message="No candidates found")

        assert error.stage == "discovery"
        assert error.message == "No candidates found"
        assert error.occurred_at is not None
