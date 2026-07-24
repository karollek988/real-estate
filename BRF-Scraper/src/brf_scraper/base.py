"""Base interfaces for the BRF Scraper."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from enum import StrEnum
from typing import Any, TypeVar
from uuid import UUID, uuid4

T = TypeVar("T")
R = TypeVar("R")


class TaskStatus(StrEnum):
    """Status of a processing task."""

    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    RETRYING = "retrying"


class TaskPriority(StrEnum):
    """Priority levels for tasks."""

    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class TaskResult[R]:
    """Result of a task execution."""

    task_id: UUID = field(default_factory=uuid4)
    status: TaskStatus = TaskStatus.PENDING
    result: R | None = None
    error: Exception | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    metadata: dict[str, Any] = field(default_factory=dict)

    @property
    def duration(self) -> float | None:
        """Calculate task duration in seconds."""
        if self.started_at and self.completed_at:
            return (self.completed_at - self.started_at).total_seconds()
        return None

    @property
    def is_success(self) -> bool:
        """Check if task completed successfully."""
        return self.status == TaskStatus.COMPLETED

    @property
    def is_failure(self) -> bool:
        """Check if task failed."""
        return self.status == TaskStatus.FAILED


@dataclass
class RequestContext:
    """Context for a processing request."""

    request_id: UUID = field(default_factory=uuid4)
    created_at: datetime = field(default_factory=datetime.now)
    metadata: dict[str, Any] = field(default_factory=dict)
    timeout: float | None = None
    retries: int = 0
    priority: TaskPriority = TaskPriority.NORMAL


class BaseInterface(ABC):
    """Base interface for all components."""

    @abstractmethod
    async def initialize(self) -> None:
        """Initialize the component."""

    @abstractmethod
    async def close(self) -> None:
        """Clean up resources."""

    async def __aenter__(self) -> BaseInterface:
        """Async context manager entry."""
        await self.initialize()
        return self

    async def __aexit__(
        self,
        exc_type: type[Exception] | None,
        exc_val: Exception | None,
        exc_tb: Any,
    ) -> None:
        """Async context manager exit."""
        await self.close()


class Processor[T, R](BaseInterface):
    """Generic processor interface."""

    @abstractmethod
    async def process(self, input_data: T, context: RequestContext | None = None) -> R:
        """Process input data and return result.

        Args:
            input_data: Input data to process.
            context: Optional request context.

        Returns:
            Processed result.
        """

    async def validate_input(self, input_data: T) -> bool:
        """Validate input data before processing.

        Args:
            input_data: Input data to validate.

        Returns:
            True if input is valid.
        """
        return True


class Cache(BaseInterface):
    """Cache interface."""

    @abstractmethod
    async def get(self, key: str) -> Any | None:
        """Get value from cache.

        Args:
            key: Cache key.

        Returns:
            Cached value or None.
        """

    @abstractmethod
    async def set(self, key: str, value: Any, ttl: int | None = None) -> bool:
        """Set value in cache.

        Args:
            key: Cache key.
            value: Value to cache.
            ttl: Time-to-live in seconds.

        Returns:
            True if successful.
        """

    @abstractmethod
    async def delete(self, key: str) -> bool:
        """Delete value from cache.

        Args:
            key: Cache key.

        Returns:
            True if deleted.
        """

    @abstractmethod
    async def exists(self, key: str) -> bool:
        """Check if key exists in cache.

        Args:
            key: Cache key.

        Returns:
            True if key exists.
        """

    @abstractmethod
    async def clear(self) -> bool:
        """Clear all cached values.

        Returns:
            True if successful.
        """

    @abstractmethod
    async def get_many(self, keys: list[str]) -> dict[str, Any]:
        """Get multiple values from cache.

        Args:
            keys: List of cache keys.

        Returns:
            Dictionary of key-value pairs.
        """

    @abstractmethod
    async def set_many(self, items: dict[str, Any], ttl: int | None = None) -> bool:
        """Set multiple values in cache.

        Args:
            items: Dictionary of key-value pairs.
            ttl: Time-to-live in seconds.

        Returns:
            True if successful.
        """
