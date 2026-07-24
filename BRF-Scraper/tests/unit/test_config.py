"""Unit tests for configuration."""

from __future__ import annotations

from brf_scraper.config import AppSettings, ServerSettings


class TestAppSettings:
    """Tests for AppSettings."""

    def test_default_settings(self) -> None:
        """Test default settings creation."""
        # _env_file=None keeps a developer's local .env from leaking into
        # the defaults under test.
        settings = AppSettings(_env_file=None)
        assert settings.name == "brf-scraper"
        assert settings.env == "development"
        assert settings.debug is False

    def test_development_mode(self) -> None:
        """Test development mode detection."""
        settings = AppSettings(env="development")
        assert settings.is_development is True
        assert settings.is_production is False
        assert settings.is_testing is False

    def test_production_mode(self) -> None:
        """Test production mode detection."""
        settings = AppSettings(env="production")
        assert settings.is_production is True
        assert settings.is_development is False

    def test_testing_mode(self) -> None:
        """Test testing mode detection."""
        settings = AppSettings(env="testing")
        assert settings.is_testing is True

    def test_settings_dump(self) -> None:
        """Test settings dictionary dump."""
        settings = AppSettings()
        dumped = settings.model_dump_settings()
        assert "name" in dumped
        assert "env" in dumped
        assert "server" in dumped


class TestServerSettings:
    """Tests for ServerSettings."""

    def test_default_server_settings(self) -> None:
        """Test default server settings."""
        settings = ServerSettings()
        assert settings.host == "0.0.0.0"
        assert settings.port == 8000
