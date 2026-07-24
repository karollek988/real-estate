"""Abstract storage interface for document persistence."""

from __future__ import annotations

from abc import abstractmethod
from pathlib import Path

from brf_scraper.base import BaseInterface


class Storage(BaseInterface):
    """Abstract storage interface.

    Defines the contract for persisting document bytes and
    retrieving them by path. Implementations provide local
    filesystem, S3, or other backends.
    """

    @abstractmethod
    async def save(self, document_id: str, data: bytes, filename: str) -> str:
        """Save document data to storage.

        Args:
            document_id: Unique document identifier.
            data: Raw file bytes.
            filename: Original filename with extension.

        Returns:
            Storage path where the file was saved.

        Raises:
            StorageError: If the save operation fails.
        """

    @abstractmethod
    async def load(self, path: str) -> bytes:
        """Load document data from storage.

        Args:
            path: Storage path of the file.

        Returns:
            Raw file bytes.

        Raises:
            StorageError: If the load operation fails.
        """

    @abstractmethod
    async def exists(self, path: str) -> bool:
        """Check if a file exists in storage.

        Args:
            path: Storage path to check.

        Returns:
            True if file exists.
        """

    @abstractmethod
    async def delete(self, path: str) -> bool:
        """Delete a file from storage.

        Args:
            path: Storage path to delete.

        Returns:
            True if file was deleted.

        Raises:
            StorageError: If the delete operation fails.
        """

    @abstractmethod
    async def get_size(self, path: str) -> int:
        """Get file size in bytes.

        Args:
            path: Storage path.

        Returns:
            File size in bytes.

        Raises:
            StorageError: If the operation fails.
        """

    @abstractmethod
    async def list_files(self, prefix: str = "") -> list[str]:
        """List files in storage.

        Args:
            prefix: Optional path prefix to filter by.

        Returns:
            List of storage paths.
        """

    @abstractmethod
    async def get_path(self, document_id: str) -> Path:
        """Get the storage path for a document.

        Args:
            document_id: Unique document identifier.

        Returns:
            Full path to the document.
        """
