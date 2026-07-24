"""Local filesystem storage implementation."""

from __future__ import annotations

from pathlib import Path

from brf_scraper.exceptions import StorageError
from brf_scraper.storage.base import Storage
from brf_scraper.utils.logging import get_logger

logger = get_logger(__name__)


class LocalStorage(Storage):
    """Local filesystem storage provider.

    Stores documents on the local filesystem using a directory
    structure organized by document ID.
    """

    def __init__(self, base_dir: str | Path) -> None:
        """Initialize local storage.

        Args:
            base_dir: Root directory for document storage.
        """
        self._base_dir = Path(base_dir)

    @property
    def base_dir(self) -> Path:
        """Get the base directory."""
        return self._base_dir

    async def initialize(self) -> None:
        """Initialize storage, creating base directory if needed."""
        self._base_dir.mkdir(parents=True, exist_ok=True)
        logger.info("local_storage_initialized", base_dir=str(self._base_dir))

    async def close(self) -> None:
        """Close storage (no-op for local filesystem)."""

    async def save(self, document_id: str, data: bytes, filename: str) -> str:
        """Save document data to local filesystem.

        Args:
            document_id: Unique document identifier.
            data: Raw file bytes.
            filename: Original filename with extension.

        Returns:
            Relative storage path.

        Raises:
            StorageError: If the save operation fails.
        """
        try:
            doc_dir = self._base_dir / document_id
            doc_dir.mkdir(parents=True, exist_ok=True)

            file_path = doc_dir / filename
            file_path.write_bytes(data)

            relative_path = str(file_path.relative_to(self._base_dir))
            logger.info(
                "document_saved",
                document_id=document_id,
                path=relative_path,
                size=len(data),
            )
            return relative_path

        except OSError as e:
            raise StorageError(
                f"Failed to save document {document_id}: {e}",
                details={"document_id": document_id, "error": str(e)},
            ) from e

    async def load(self, path: str) -> bytes:
        """Load document data from local filesystem.

        Args:
            path: Relative storage path.

        Returns:
            Raw file bytes.

        Raises:
            StorageError: If the load operation fails.
        """
        file_path = self._base_dir / path

        if not file_path.exists():
            raise StorageError(
                f"File not found: {path}",
                details={"path": path},
            )

        try:
            return file_path.read_bytes()
        except OSError as e:
            raise StorageError(
                f"Failed to load document: {path}: {e}",
                details={"path": path, "error": str(e)},
            ) from e

    async def exists(self, path: str) -> bool:
        """Check if a file exists in local storage.

        Args:
            path: Relative storage path.

        Returns:
            True if file exists.
        """
        return (self._base_dir / path).exists()

    async def delete(self, path: str) -> bool:
        """Delete a file from local storage.

        Args:
            path: Relative storage path.

        Returns:
            True if file was deleted.

        Raises:
            StorageError: If the delete operation fails.
        """
        file_path = self._base_dir / path

        if not file_path.exists():
            return False

        try:
            if file_path.is_dir():
                import shutil

                shutil.rmtree(file_path)
            else:
                file_path.unlink()

            logger.info("document_deleted", path=path)
            return True

        except OSError as e:
            raise StorageError(
                f"Failed to delete document: {path}: {e}",
                details={"path": path, "error": str(e)},
            ) from e

    async def get_size(self, path: str) -> int:
        """Get file size in bytes.

        Args:
            path: Relative storage path.

        Returns:
            File size in bytes.

        Raises:
            StorageError: If the operation fails.
        """
        file_path = self._base_dir / path

        if not file_path.exists():
            raise StorageError(
                f"File not found: {path}",
                details={"path": path},
            )

        return file_path.stat().st_size

    async def list_files(self, prefix: str = "") -> list[str]:
        """List files in local storage.

        Args:
            prefix: Optional path prefix to filter by.

        Returns:
            List of relative storage paths.
        """
        search_dir = self._base_dir / prefix if prefix else self._base_dir

        if not search_dir.exists():
            return []

        files: list[str] = []
        for file_path in search_dir.rglob("*"):
            if file_path.is_file():
                files.append(str(file_path.relative_to(self._base_dir)))

        return sorted(files)

    async def get_path(self, document_id: str) -> Path:
        """Get the storage path for a document.

        Args:
            document_id: Unique document identifier.

        Returns:
            Full path to the document directory.
        """
        return self._base_dir / document_id
