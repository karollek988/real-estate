"""Models for the document acquisition pipeline."""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import Any
from uuid import UUID, uuid4

from pydantic import BaseModel, Field, HttpUrl


class DownloadStatus(StrEnum):
    """Status of a document download."""

    PENDING = "pending"
    DOWNLOADING = "downloading"
    COMPLETED = "completed"
    FAILED = "failed"
    DUPLICATE = "duplicate"
    SKIPPED = "skipped"


class DownloadMetadata(BaseModel):
    """HTTP metadata collected during download."""

    content_type: str | None = None
    content_length: int | None = None
    etag: str | None = None
    last_modified: str | None = None
    http_headers: dict[str, str] = Field(default_factory=dict)
    download_source: str | None = None
    response_time: float | None = None

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary."""
        return self.model_dump(exclude_none=True)


class Document(BaseModel):
    """Acquired document with full metadata."""

    id: UUID = Field(default_factory=uuid4)
    source_url: HttpUrl
    original_filename: str
    stored_path: str | None = None
    sha256_checksum: str
    file_size: int
    mime_type: str
    download_status: DownloadStatus = DownloadStatus.PENDING
    download_metadata: DownloadMetadata = Field(default_factory=DownloadMetadata)
    discovered_at: datetime = Field(default_factory=datetime.now)
    downloaded_at: datetime | None = None
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    metadata: dict[str, Any] = Field(default_factory=dict)

    @property
    def is_downloaded(self) -> bool:
        """Check if document was successfully downloaded."""
        return self.download_status == DownloadStatus.COMPLETED

    @property
    def is_duplicate(self) -> bool:
        """Check if document was detected as duplicate."""
        return self.download_status == DownloadStatus.DUPLICATE

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary."""
        return self.model_dump(
            exclude_none=True,
            exclude={"metadata"},
        )


class DownloadRequest(BaseModel):
    """Request to download a document."""

    id: UUID = Field(default_factory=uuid4)
    source_url: HttpUrl
    document_url: HttpUrl
    title: str | None = None
    filename: str | None = None
    priority: int = Field(default=0, ge=0, le=10)
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=datetime.now)

    @property
    def url(self) -> str:
        """Get the download URL as string."""
        return str(self.document_url)


class DownloadResult(BaseModel):
    """Result of a download operation."""

    request_id: UUID
    document: Document | None = None
    status: DownloadStatus = DownloadStatus.PENDING
    error: str | None = None
    error_code: str | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None

    @property
    def is_success(self) -> bool:
        """Check if download was successful."""
        return self.status == DownloadStatus.COMPLETED and self.document is not None

    @property
    def duration(self) -> float | None:
        """Calculate download duration in seconds."""
        if self.started_at and self.completed_at:
            return (self.completed_at - self.started_at).total_seconds()
        return None
