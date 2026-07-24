"""DownloadManager orchestrating the document acquisition pipeline."""

from __future__ import annotations

import asyncio
from datetime import datetime
from typing import Any

from brf_scraper.base import BaseInterface
from brf_scraper.downloader.downloader import Downloader
from brf_scraper.downloader.metadata import MetadataRepository
from brf_scraper.downloader.models import (
    Document,
    DownloadRequest,
    DownloadResult,
    DownloadStatus,
)
from brf_scraper.storage.base import Storage
from brf_scraper.utils.logging import get_logger

logger = get_logger(__name__)


class DownloadManager(BaseInterface):
    """Orchestrates document downloads with deduplication.

    Coordinates the Downloader, Storage, and MetadataRepository
    to perform the full acquisition pipeline:
    1. Check for duplicates via checksum
    2. Download the document
    3. Persist bytes to storage
    4. Record metadata in repository
    """

    def __init__(
        self,
        downloader: Downloader,
        storage: Storage,
        metadata_repo: MetadataRepository,
        max_concurrent: int = 5,
    ) -> None:
        """Initialize download manager.

        Args:
            downloader: HTTP downloader component.
            storage: Document storage backend.
            metadata_repo: Metadata persistence repository.
            max_concurrent: Maximum concurrent downloads.
        """
        self._downloader = downloader
        self._storage = storage
        self._metadata_repo = metadata_repo
        self._max_concurrent = max_concurrent
        self._semaphore: asyncio.Semaphore | None = None
        self._results: list[DownloadResult] = []

    @property
    def results(self) -> list[DownloadResult]:
        """Get all download results."""
        return self._results.copy()

    @property
    def stats(self) -> dict[str, Any]:
        """Get download statistics."""
        total = len(self._results)
        completed = sum(1 for r in self._results if r.status == DownloadStatus.COMPLETED)
        failed = sum(1 for r in self._results if r.status == DownloadStatus.FAILED)
        duplicates = sum(1 for r in self._results if r.status == DownloadStatus.DUPLICATE)
        skipped = sum(1 for r in self._results if r.status == DownloadStatus.SKIPPED)

        return {
            "total": total,
            "completed": completed,
            "failed": failed,
            "duplicates": duplicates,
            "skipped": skipped,
            "success_rate": completed / total if total > 0 else 0.0,
        }

    async def initialize(self) -> None:
        """Initialize all components and concurrency control."""
        self._semaphore = asyncio.Semaphore(self._max_concurrent)
        await self._downloader.initialize()
        await self._storage.initialize()
        await self._metadata_repo.initialize()
        logger.info(
            "download_manager_initialized",
            max_concurrent=self._max_concurrent,
        )

    async def close(self) -> None:
        """Close all components."""
        await self._metadata_repo.close()
        await self._storage.close()
        await self._downloader.close()
        logger.info("download_manager_closed")

    async def download(self, request: DownloadRequest) -> DownloadResult:
        """Download a single document through the full pipeline.

        Steps:
        1. Check for duplicate by source URL (fast-path optimization)
        2. Download document bytes
        3. Atomically claim the checksum (the authoritative dedup check)
        4. Store bytes to storage backend, now that the race is won
        5. Persist final metadata

        Args:
            request: Download request.

        Returns:
            DownloadResult with status and document info.
        """
        assert self._semaphore is not None, "DownloadManager not initialized"

        async with self._semaphore:
            # Step 1: Check for duplicate by source URL
            existing = await self._metadata_repo.get_by_source_url(
                str(request.document_url),
            )
            if existing and existing.is_downloaded:
                logger.info(
                    "download_skipped_existing",
                    url=str(request.document_url),
                    existing_id=str(existing.id),
                )
                result = DownloadResult(
                    request_id=request.id,
                    document=existing,
                    status=DownloadStatus.DUPLICATE,
                    started_at=datetime.now(),
                    completed_at=datetime.now(),
                )
                self._results.append(result)
                return result

            # Step 2: Download the document
            download_result = await self._downloader.download(request)

            if download_result.status != DownloadStatus.COMPLETED:
                self._results.append(download_result)
                return download_result

            document = download_result.document
            assert document is not None

            # Step 3: Atomically claim this checksum. The database's unique
            # constraint on sha256_checksum is the single source of truth
            # here, so two concurrent downloads of identical content can
            # never both win — the loser gets the winner's row back instead
            # of racing past a read-then-write check.
            claimed = await self._metadata_repo.save_new(document)
            if claimed.id != document.id:
                logger.info(
                    "download_duplicate_detected",
                    sha256=document.sha256_checksum[:16],
                    existing_id=str(claimed.id),
                )
                download_result.status = DownloadStatus.DUPLICATE
                download_result.document = claimed
                self._results.append(download_result)
                return download_result

            # Step 4: Store bytes to storage now that we've won the race
            try:
                content = await self._downloader.download_bytes(
                    str(request.document_url),
                )
                stored_path = await self._storage.save(
                    document_id=str(document.id),
                    data=content,
                    filename=document.original_filename,
                )
                document.stored_path = stored_path
            except Exception as e:
                # Release the claimed checksum so a future retry isn't
                # permanently blocked by this failed attempt.
                await self._metadata_repo.delete(document.id)
                download_result.status = DownloadStatus.FAILED
                download_result.error = f"Storage failed: {e}"
                download_result.error_code = "STORAGE_ERROR"
                self._results.append(download_result)
                return download_result

            # Step 5: Persist final metadata
            document.download_status = DownloadStatus.COMPLETED
            await self._metadata_repo.save(document)

            logger.info(
                "download_pipeline_complete",
                document_id=str(document.id),
                sha256=document.sha256_checksum[:16],
                stored_path=stored_path,
            )

            self._results.append(download_result)
            return download_result

    async def download_many(
        self,
        requests: list[DownloadRequest],
    ) -> list[DownloadResult]:
        """Download multiple documents concurrently.

        Args:
            requests: List of download requests.

        Returns:
            List of download results.
        """
        tasks = [self.download(request) for request in requests]
        results = await asyncio.gather(*tasks, return_exceptions=False)
        return list(results)

    async def check_duplicate(self, sha256: str) -> Document | None:
        """Check if a document with the given checksum exists.

        Args:
            sha256: SHA256 hex digest.

        Returns:
            Existing document or None.
        """
        return await self._metadata_repo.get_by_checksum(sha256)
