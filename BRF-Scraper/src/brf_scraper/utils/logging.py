"""Structured logging configuration using structlog."""

from __future__ import annotations

import logging
import sys
from pathlib import Path
from typing import Any

import structlog

# Module-level logger
logger = structlog.get_logger()


def setup_logging(
    level: str = "INFO",
    format_type: str = "json",
    log_file: Path | None = None,
    **kwargs: Any,
) -> None:
    """Configure structured logging for the application.

    Args:
        level: Log level (DEBUG, INFO, WARNING, ERROR, CRITICAL).
        format_type: Output format ("json" or "console").
        log_file: Optional file path for log output.
        **kwargs: Additional configuration options.
    """
    # Configure standard library logging
    logging.basicConfig(
        format="%(message)s",
        level=getattr(logging, level.upper(), logging.INFO),
        handlers=[logging.StreamHandler(sys.stdout)],
    )

    # Shared processors
    shared_processors: list[structlog.types.Processor] = [
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.StackInfoRenderer(),
        structlog.dev.set_exc_info,
        structlog.processors.TimeStamper(fmt="iso"),
    ]

    # Configure renderer based on format type
    if format_type == "json":
        renderer: structlog.types.Processor = structlog.processors.JSONRenderer()
    else:
        renderer = structlog.dev.ConsoleRenderer(colors=True)

    # Configure structlog
    structlog.configure(
        processors=[
            *shared_processors,
            structlog.processors.format_exc_info,
            renderer,
        ],
        wrapper_class=structlog.make_filtering_bound_logger(
            getattr(logging, level.upper(), logging.INFO)
        ),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )

    # Add file handler if specified
    if log_file:
        _setup_file_handler(log_file, level)


def _setup_file_handler(log_file: Path, level: str) -> None:
    """Set up file handler for logging."""
    log_file.parent.mkdir(parents=True, exist_ok=True)

    file_handler = logging.FileHandler(log_file, encoding="utf-8")
    file_handler.setLevel(getattr(logging, level.upper(), logging.INFO))

    formatter = logging.Formatter("%(message)s")
    file_handler.setFormatter(formatter)

    logging.getLogger().addHandler(file_handler)


def get_logger(name: str | None = None) -> structlog.stdlib.BoundLogger:
    """Get a bound logger instance.

    Args:
        name: Optional logger name/module.

    Returns:
        Bound logger instance.
    """
    if name:
        return structlog.get_logger(name)  # type: ignore[no-any-return]
    return structlog.get_logger()  # type: ignore[no-any-return]


class LoggerMixin:
    """Mixin class that adds logging capabilities."""

    @property
    def logger(self) -> structlog.stdlib.BoundLogger:
        """Get logger for this class."""
        return get_logger(self.__class__.__name__)
