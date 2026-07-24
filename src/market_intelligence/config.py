"""Engine configuration (env-driven).

Environment variables:
- ``DISABLED_PROVIDERS`` — comma-separated provider ids to skip (visible
  in the package as status ``disabled``).
- ``MI_CACHE_DIR`` — provider cache directory.
- ``MI_HTTP_TIMEOUT_S``, ``MI_MAX_WORKERS``, ``MI_DEFAULT_DEADLINE_S`` —
  numeric overrides.
"""

from __future__ import annotations

import os
from collections.abc import Mapping
from dataclasses import dataclass, field
from pathlib import Path

DEFAULT_USER_AGENT = "KopanalysMarketIntelligence/0.1 (+https://kopanalys.se)"


@dataclass(frozen=True, slots=True)
class EngineConfig:
    user_agent: str = DEFAULT_USER_AGENT
    http_timeout_s: float = 10.0
    http_max_retries: int = 2
    http_backoff_base_s: float = 0.5
    cache_dir: Path = field(default_factory=lambda: Path(".cache") / "market_intelligence")
    disabled_providers: frozenset[str] = frozenset()
    max_workers: int = 8
    default_deadline_s: float = 20.0

    @classmethod
    def from_env(cls, env: Mapping[str, str] | None = None) -> EngineConfig:
        source = os.environ if env is None else env
        defaults = cls()
        disabled = frozenset(
            part.strip() for part in source.get("DISABLED_PROVIDERS", "").split(",") if part.strip()
        )
        return cls(
            http_timeout_s=_float_env(source, "MI_HTTP_TIMEOUT_S", defaults.http_timeout_s),
            cache_dir=Path(source.get("MI_CACHE_DIR", str(defaults.cache_dir))),
            disabled_providers=disabled,
            max_workers=_int_env(source, "MI_MAX_WORKERS", defaults.max_workers),
            default_deadline_s=_float_env(
                source, "MI_DEFAULT_DEADLINE_S", defaults.default_deadline_s
            ),
        )


def _float_env(env: Mapping[str, str], key: str, default: float) -> float:
    raw = env.get(key)
    if raw is None:
        return default
    try:
        return float(raw)
    except ValueError as exc:
        raise ValueError(f"{key} must be a number, got {raw!r}") from exc


def _int_env(env: Mapping[str, str], key: str, default: int) -> int:
    raw = env.get(key)
    if raw is None:
        return default
    try:
        return int(raw)
    except ValueError as exc:
        raise ValueError(f"{key} must be an integer, got {raw!r}") from exc
