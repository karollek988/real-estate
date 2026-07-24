"""Application configuration using Pydantic Settings."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Project root directory
PROJECT_ROOT = Path(__file__).parent.parent.parent
DATA_DIR = PROJECT_ROOT / "data"


class ServerSettings(BaseSettings):
    """Server configuration."""

    model_config = SettingsConfigDict(env_prefix="SERVER_")

    host: str = "0.0.0.0"
    port: int = 8000
    workers: int = 1
    reload: bool = False


class DatabaseSettings(BaseSettings):
    """Database configuration."""

    model_config = SettingsConfigDict(env_prefix="DATABASE_")

    url: str = f"sqlite+aiosqlite:///{DATA_DIR / 'brf_scraper.db'}"
    echo: bool = False
    pool_size: int = 5
    max_overflow: int = 10


class RedisSettings(BaseSettings):
    """Redis configuration."""

    model_config = SettingsConfigDict(env_prefix="REDIS_")

    url: str = "redis://localhost:6379/0"
    password: str | None = None
    max_connections: int = 20
    socket_timeout: float = 5.0
    decode_responses: bool = True


class HTTPSettings(BaseSettings):
    """HTTP client configuration."""

    model_config = SettingsConfigDict(env_prefix="HTTP_")

    timeout: float = 30.0
    max_retries: int = 3
    retry_delay: float = 1.0
    user_agent: str = "BRF-Scraper/0.1.0"
    verify_ssl: bool = True


class RateLimitSettings(BaseSettings):
    """Rate limiting configuration."""

    model_config = SettingsConfigDict(env_prefix="RATE_LIMIT_")

    requests_per_second: float = 2.0
    burst: int = 5


class CrawlerSettings(BaseSettings):
    """Crawler configuration."""

    model_config = SettingsConfigDict(env_prefix="CRAWLER_")

    max_concurrent_requests: int = 10
    respect_robots_txt: bool = True
    default_depth: int = 2
    timeout: float = 30.0


class DownloaderSettings(BaseSettings):
    """Downloader configuration."""

    model_config = SettingsConfigDict(env_prefix="DOWNLOADER_")

    chunk_size: int = 8192
    max_file_size: int = 100 * 1024 * 1024  # 100MB
    enable_resume: bool = True


class StorageSettings(BaseSettings):
    """Storage configuration."""

    model_config = SettingsConfigDict(env_prefix="STORAGE_")

    pdf_dir: Path = DATA_DIR / "pdfs"
    export_dir: Path = DATA_DIR / "exports"

    @field_validator("pdf_dir", "export_dir", mode="before")
    @classmethod
    def resolve_path(cls, v: str | Path) -> Path:
        """Resolve path relative to project root."""
        path = Path(v)
        if not path.is_absolute():
            path = PROJECT_ROOT / path
        return path


class ExtractorSettings(BaseSettings):
    """Extractor configuration."""

    model_config = SettingsConfigDict(env_prefix="EXTRACTOR_")

    ocr_enabled: bool = False
    ocr_engine: str = "paddleocr"
    min_confidence: float = 0.7
    max_pages: int = 100


class ExportSettings(BaseSettings):
    """Export configuration."""

    model_config = SettingsConfigDict(env_prefix="EXPORT_")

    format: str = "json"
    compress: bool = False
    pretty_print: bool = True


class SchedulerSettings(BaseSettings):
    """Scheduler configuration."""

    model_config = SettingsConfigDict(env_prefix="SCHEDULER_")

    enabled: bool = False
    cron: str = "0 2 * * 0"  # Every Sunday at 2 AM


class LoggingSettings(BaseSettings):
    """Logging configuration."""

    model_config = SettingsConfigDict(env_prefix="APP_LOG_")

    level: str = "INFO"
    format: str = "json"  # json or console
    file: Path | None = None
    rotate: bool = True
    max_bytes: int = 10 * 1024 * 1024  # 10MB
    backup_count: int = 5


class AppSettings(BaseSettings):
    """Main application settings."""

    model_config = SettingsConfigDict(
        env_prefix="APP_",
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        # The .env file holds flat keys for every sub-settings group
        # (SERVER_*, DATABASE_*, ...); they are not AppSettings fields,
        # so unknown keys must not fail validation.
        extra="ignore",
    )

    name: str = "brf-scraper"
    env: str = "development"
    debug: bool = False
    version: str = "0.1.0"

    # Sub-settings
    server: ServerSettings = Field(default_factory=ServerSettings)
    database: DatabaseSettings = Field(default_factory=DatabaseSettings)
    redis: RedisSettings = Field(default_factory=RedisSettings)
    http: HTTPSettings = Field(default_factory=HTTPSettings)
    rate_limit: RateLimitSettings = Field(default_factory=RateLimitSettings)
    crawler: CrawlerSettings = Field(default_factory=CrawlerSettings)
    downloader: DownloaderSettings = Field(default_factory=DownloaderSettings)
    storage: StorageSettings = Field(default_factory=StorageSettings)
    extractor: ExtractorSettings = Field(default_factory=ExtractorSettings)
    export: ExportSettings = Field(default_factory=ExportSettings)
    scheduler: SchedulerSettings = Field(default_factory=SchedulerSettings)
    logging: LoggingSettings = Field(default_factory=LoggingSettings)

    @model_validator(mode="after")
    def validate_settings(self) -> AppSettings:
        """Validate settings after initialization."""
        # Ensure directories exist
        self.storage.pdf_dir.mkdir(parents=True, exist_ok=True)
        self.storage.export_dir.mkdir(parents=True, exist_ok=True)
        return self

    @property
    def is_development(self) -> bool:
        """Check if running in development mode."""
        return self.env == "development"

    @property
    def is_production(self) -> bool:
        """Check if running in production mode."""
        return self.env == "production"

    @property
    def is_testing(self) -> bool:
        """Check if running in test mode."""
        return self.env == "testing"

    def model_dump_settings(self) -> dict[str, Any]:
        """Dump all settings as a dictionary."""
        return self.model_dump()
