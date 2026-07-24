"""Tests for market_intelligence.config — EngineConfig."""

from __future__ import annotations

from market_intelligence.config import EngineConfig


class TestEngineConfig:
    def test_defaults(self) -> None:
        config = EngineConfig()
        assert config.http_timeout_s == 10.0
        assert config.http_max_retries == 2
        assert config.max_workers == 8
        assert config.disabled_providers == frozenset()

    def test_from_env_defaults(self) -> None:
        config = EngineConfig.from_env({})
        assert config.http_timeout_s == 10.0

    def test_from_env_overrides(self) -> None:
        env = {
            "MI_HTTP_TIMEOUT_S": "30",
            "MI_MAX_WORKERS": "16",
            "MI_DEFAULT_DEADLINE_S": "45",
            "DISABLED_PROVIDERS": "provider_a, provider_b",
        }
        config = EngineConfig.from_env(env)
        assert config.http_timeout_s == 30.0
        assert config.max_workers == 16
        assert config.default_deadline_s == 45.0
        assert config.disabled_providers == frozenset({"provider_a", "provider_b"})

    def test_from_env_empty_disabled(self) -> None:
        config = EngineConfig.from_env({"DISABLED_PROVIDERS": ""})
        assert config.disabled_providers == frozenset()

    def test_from_env_invalid_float(self) -> None:
        import pytest

        with pytest.raises(ValueError, match="must be a number"):
            EngineConfig.from_env({"MI_HTTP_TIMEOUT_S": "abc"})

    def test_from_env_invalid_int(self) -> None:
        import pytest

        with pytest.raises(ValueError, match="must be an integer"):
            EngineConfig.from_env({"MI_MAX_WORKERS": "abc"})

    def test_frozen(self) -> None:
        config = EngineConfig()
        # dataclass is frozen, so assignment fails
        import pytest

        with pytest.raises(AttributeError):
            config.http_timeout_s = 999  # type: ignore[misc]
