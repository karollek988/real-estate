"""Metadata repository for document tracking."""

from __future__ import annotations

from abc import abstractmethod
from uuid import UUID

from brf_scraper.base import BaseInterface
from brf_scraper.downloader.models import Document, DownloadStatus


class MetadataRepository(BaseInterface):
    """Abstract metadata repository interface.

    Stores and retrieves document metadata for tracking
    downloads, detecting duplicates, and maintaining state.
    """

    @abstractmethod
    async def save(self, document: Document) -> None:
        """Save or update document metadata.

        Args:
            document: Document to save.
        """

    @abstractmethod
    async def save_new(self, document: Document) -> Document:
        """Insert a document, atomically enforcing checksum uniqueness.

        Implementations must use a database-level unique constraint on
        the checksum (not a read-then-write check) so that concurrent
        callers inserting the same checksum cannot both succeed.

        Args:
            document: Document to insert.

        Returns:
            The inserted document if this call won the race, or the
            pre-existing document with the same checksum otherwise.
        """

    @abstractmethod
    async def get(self, document_id: UUID) -> Document | None:
        """Get document metadata by ID.

        Args:
            document_id: Document UUID.

        Returns:
            Document metadata or None.
        """

    @abstractmethod
    async def get_by_checksum(self, sha256: str) -> Document | None:
        """Find a document by its SHA256 checksum.

        Args:
            sha256: SHA256 hex digest.

        Returns:
            Document with matching checksum or None.
        """

    @abstractmethod
    async def get_by_source_url(self, url: str) -> Document | None:
        """Find a document by source URL.

        Args:
            url: Source URL.

        Returns:
            Document with matching source URL or None.
        """

    @abstractmethod
    async def update_status(
        self,
        document_id: UUID,
        status: DownloadStatus,
    ) -> None:
        """Update document download status.

        Args:
            document_id: Document UUID.
            status: New download status.
        """

    @abstractmethod
    async def list_documents(
        self,
        status: DownloadStatus | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[Document]:
        """List stored documents.

        Args:
            status: Optional status filter.
            limit: Maximum number of results.
            offset: Result offset for pagination.

        Returns:
            List of documents.
        """

    @abstractmethod
    async def count(self, status: DownloadStatus | None = None) -> int:
        """Count documents.

        Args:
            status: Optional status filter.

        Returns:
            Document count.
        """

    @abstractmethod
    async def delete(self, document_id: UUID) -> bool:
        """Delete document metadata.

        Args:
            document_id: Document UUID.

        Returns:
            True if document was deleted.
        """

    @abstractmethod
    async def exists(self, document_id: UUID) -> bool:
        """Check if document exists.

        Args:
            document_id: Document UUID.

        Returns:
            True if document exists.
        """

    async def is_duplicate(self, sha256: str) -> bool:
        """Check if a document with the given checksum exists.

        Args:
            sha256: SHA256 hex digest.

        Returns:
            True if a document with this checksum exists.
        """
        existing = await self.get_by_checksum(sha256)
        return existing is not None
