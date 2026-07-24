"""SQLite-backed metadata repository."""

from __future__ import annotations

import json
from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import DateTime, Integer, String, Text, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from brf_scraper.downloader.metadata import MetadataRepository
from brf_scraper.downloader.models import Document, DownloadMetadata, DownloadStatus
from brf_scraper.exceptions import StorageError
from brf_scraper.utils.logging import get_logger

logger = get_logger(__name__)


class Base(DeclarativeBase):
    """SQLAlchemy declarative base."""


class DocumentRow(Base):
    """SQLAlchemy model for document metadata."""

    __tablename__ = "documents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    source_url: Mapped[str] = mapped_column(String(2048), nullable=False)
    original_filename: Mapped[str] = mapped_column(String(512), nullable=False)
    stored_path: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    sha256_checksum: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    file_size: Mapped[int] = mapped_column(Integer, nullable=False)
    mime_type: Mapped[str] = mapped_column(String(255), nullable=False)
    download_status: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    content_type: Mapped[str | None] = mapped_column(String(255), nullable=True)
    content_length: Mapped[int | None] = mapped_column(Integer, nullable=True)
    etag: Mapped[str | None] = mapped_column(String(512), nullable=True)
    last_modified: Mapped[str | None] = mapped_column(String(255), nullable=True)
    http_headers_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    download_source: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    response_time: Mapped[float | None] = mapped_column(Integer, nullable=True)
    discovered_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    downloaded_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    extra_metadata_json: Mapped[str | None] = mapped_column(Text, nullable=True)

    def to_document(self) -> Document:
        """Convert to Document model."""
        http_headers: dict[str, str] = {}
        if self.http_headers_json:
            try:
                http_headers = json.loads(self.http_headers_json)
            except json.JSONDecodeError:
                pass

        extra_metadata: dict[str, Any] = {}
        if self.extra_metadata_json:
            try:
                extra_metadata = json.loads(self.extra_metadata_json)
            except json.JSONDecodeError:
                pass

        download_metadata = DownloadMetadata(
            content_type=self.content_type,
            content_length=self.content_length,
            etag=self.etag,
            last_modified=self.last_modified,
            http_headers=http_headers,
            download_source=self.download_source,
            response_time=self.response_time,
        )

        return Document(
            id=UUID(self.id),
            source_url=self.source_url,
            original_filename=self.original_filename,
            stored_path=self.stored_path,
            sha256_checksum=self.sha256_checksum,
            file_size=self.file_size,
            mime_type=self.mime_type,
            download_status=DownloadStatus(self.download_status),
            download_metadata=download_metadata,
            discovered_at=self.discovered_at,
            downloaded_at=self.downloaded_at,
            created_at=self.created_at,
            updated_at=self.updated_at,
            metadata=extra_metadata,
        )


class SqliteMetadataRepository(MetadataRepository):
    """SQLite-backed metadata repository using SQLAlchemy async."""

    def __init__(self, database_url: str) -> None:
        """Initialize SQLite metadata repository.

        Args:
            database_url: Async SQLAlchemy database URL.
        """
        self._database_url = database_url
        self._engine: Any = None
        self._session_factory: Any = None

    async def initialize(self) -> None:
        """Initialize database engine and create tables."""
        from sqlalchemy.ext.asyncio import async_sessionmaker

        self._engine = create_async_engine(self._database_url, echo=False)
        self._session_factory = async_sessionmaker(
            self._engine,
            class_=AsyncSession,
            expire_on_commit=False,
        )

        async with self._engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        logger.info("metadata_repository_initialized", url=self._database_url)

    async def close(self) -> None:
        """Close database engine."""
        if self._engine:
            await self._engine.dispose()
            self._engine = None
            logger.info("metadata_repository_closed")

    def _row_to_document(self, row: DocumentRow) -> Document:
        """Convert a database row to a Document model."""
        return row.to_document()

    def _document_to_row(self, document: Document) -> dict[str, Any]:
        """Convert a Document model to a row dictionary."""
        http_headers_json = None
        if document.download_metadata.http_headers:
            http_headers_json = json.dumps(document.download_metadata.http_headers)

        extra_metadata_json = None
        if document.metadata:
            extra_metadata_json = json.dumps(document.metadata)

        return {
            "id": str(document.id),
            "source_url": str(document.source_url),
            "original_filename": document.original_filename,
            "stored_path": document.stored_path,
            "sha256_checksum": document.sha256_checksum,
            "file_size": document.file_size,
            "mime_type": document.mime_type,
            "download_status": document.download_status.value,
            "content_type": document.download_metadata.content_type,
            "content_length": document.download_metadata.content_length,
            "etag": document.download_metadata.etag,
            "last_modified": document.download_metadata.last_modified,
            "http_headers_json": http_headers_json,
            "download_source": document.download_metadata.download_source,
            "response_time": document.download_metadata.response_time,
            "discovered_at": document.discovered_at,
            "downloaded_at": document.downloaded_at,
            "created_at": document.created_at,
            "updated_at": document.updated_at,
            "extra_metadata_json": extra_metadata_json,
        }

    async def save(self, document: Document) -> None:
        """Save or update document metadata.

        If a document with the same ID exists, it is updated.
        Otherwise a new row is inserted.

        Args:
            document: Document to save.
        """
        if not self._session_factory:
            raise StorageError("Metadata repository not initialized")

        async with self._session_factory() as session:
            existing = await session.get(DocumentRow, str(document.id))
            row_data = self._document_to_row(document)
            row_data["updated_at"] = datetime.now()

            if existing:
                for key, value in row_data.items():
                    setattr(existing, key, value)
            else:
                session.add(DocumentRow(**row_data))

            await session.commit()

    async def save_new(self, document: Document) -> Document:
        """Insert a document, atomically enforcing checksum uniqueness.

        The `sha256_checksum` column has a database-level unique constraint,
        so this insert is the single source of truth for duplicate detection.
        Concurrent callers racing to insert the same checksum will have
        exactly one succeed; the rest observe an IntegrityError here and
        get back the winner's row instead. This works identically on
        SQLite and PostgreSQL, since SQLAlchemy raises IntegrityError for
        a unique-constraint violation on both backends.

        Args:
            document: Document to insert.

        Returns:
            The inserted document if this call won the race, or the
            pre-existing document with the same checksum otherwise.
        """
        if not self._session_factory:
            raise StorageError("Metadata repository not initialized")

        row_data = self._document_to_row(document)

        async with self._session_factory() as session:
            session.add(DocumentRow(**row_data))
            try:
                await session.commit()
            except IntegrityError:
                await session.rollback()
                existing = await self.get_by_checksum(document.sha256_checksum)
                if existing is not None:
                    return existing
                raise

        return document

    async def get(self, document_id: UUID) -> Document | None:
        """Get document metadata by ID.

        Args:
            document_id: Document UUID.

        Returns:
            Document metadata or None.
        """
        if not self._session_factory:
            raise StorageError("Metadata repository not initialized")

        async with self._session_factory() as session:
            row = await session.get(DocumentRow, str(document_id))
            if row is None:
                return None
            return self._row_to_document(row)

    async def get_by_checksum(self, sha256: str) -> Document | None:
        """Find a document by its SHA256 checksum.

        Args:
            sha256: SHA256 hex digest.

        Returns:
            Document with matching checksum or None.
        """
        if not self._session_factory:
            raise StorageError("Metadata repository not initialized")

        async with self._session_factory() as session:
            stmt = select(DocumentRow).where(DocumentRow.sha256_checksum == sha256)
            result = await session.execute(stmt)
            row = result.scalar_one_or_none()
            if row is None:
                return None
            return self._row_to_document(row)

    async def get_by_source_url(self, url: str) -> Document | None:
        """Find a document by source URL.

        Args:
            url: Source URL.

        Returns:
            Document with matching source URL or None.
        """
        if not self._session_factory:
            raise StorageError("Metadata repository not initialized")

        async with self._session_factory() as session:
            stmt = select(DocumentRow).where(DocumentRow.source_url == url)
            result = await session.execute(stmt)
            row = result.scalar_one_or_none()
            if row is None:
                return None
            return self._row_to_document(row)

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
        if not self._session_factory:
            raise StorageError("Metadata repository not initialized")

        async with self._session_factory() as session:
            row = await session.get(DocumentRow, str(document_id))
            if row is None:
                raise StorageError(
                    f"Document not found: {document_id}",
                    details={"document_id": str(document_id)},
                )

            row.download_status = status.value
            row.updated_at = datetime.now()
            if status == DownloadStatus.COMPLETED:
                row.downloaded_at = datetime.now()

            await session.commit()

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
        if not self._session_factory:
            raise StorageError("Metadata repository not initialized")

        async with self._session_factory() as session:
            stmt = select(DocumentRow)
            if status:
                stmt = stmt.where(DocumentRow.download_status == status.value)
            stmt = stmt.order_by(DocumentRow.created_at.desc())
            stmt = stmt.offset(offset).limit(limit)

            result = await session.execute(stmt)
            rows = result.scalars().all()
            return [self._row_to_document(row) for row in rows]

    async def count(self, status: DownloadStatus | None = None) -> int:
        """Count documents.

        Args:
            status: Optional status filter.

        Returns:
            Document count.
        """
        if not self._session_factory:
            raise StorageError("Metadata repository not initialized")

        async with self._session_factory() as session:
            stmt = select(func.count()).select_from(DocumentRow)
            if status:
                stmt = stmt.where(DocumentRow.download_status == status.value)
            result = await session.execute(stmt)
            count: int = result.scalar_one()
            return count

    async def delete(self, document_id: UUID) -> bool:
        """Delete document metadata.

        Args:
            document_id: Document UUID.

        Returns:
            True if document was deleted.
        """
        if not self._session_factory:
            raise StorageError("Metadata repository not initialized")

        async with self._session_factory() as session:
            row = await session.get(DocumentRow, str(document_id))
            if row is None:
                return False

            await session.delete(row)
            await session.commit()
            return True

    async def exists(self, document_id: UUID) -> bool:
        """Check if document exists.

        Args:
            document_id: Document UUID.

        Returns:
            True if document exists.
        """
        if not self._session_factory:
            raise StorageError("Metadata repository not initialized")

        async with self._session_factory() as session:
            row = await session.get(DocumentRow, str(document_id))
            return row is not None
