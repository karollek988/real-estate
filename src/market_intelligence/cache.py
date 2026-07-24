"""Per-provider result cache.

File-backed JSON, keyed (provider id, context cache key). TTLs come from
each provider's declaration and should match the source's real update
cadence. Stale entries are retained: on a failed refetch the runner
serves the stale copy, visibly marked (stale-if-error rule).

Only genuine answers are cached (``ok`` and ``no_data``); ``partial`` and
``error`` results are never cached.
"""

from __future__ import annotations

import hashlib
import json
import logging
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path

from market_intelligence.models import (
    Clock,
    FindingValidationError,
    ProviderResult,
    utcnow,
)

logger = logging.getLogger(__name__)

_CACHE_SCHEMA_VERSION = 1


@dataclass(slots=True)
class CacheEntry:
    result: ProviderResult
    stored_at: datetime

    def age(self, now: datetime) -> timedelta:
        return now - self.stored_at

    def is_fresh(self, now: datetime, ttl: timedelta) -> bool:
        return self.age(now) < ttl


class ProviderCache:
    def __init__(self, cache_dir: Path, clock: Clock = utcnow) -> None:
        self._dir = cache_dir
        self._clock = clock

    def get(self, provider_id: str, key: str) -> CacheEntry | None:
        path = self._path(provider_id, key)
        if not path.exists():
            return None
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
            if payload.get("schema") != _CACHE_SCHEMA_VERSION:
                logger.info("cache %s: schema mismatch, ignoring entry", path)
                return None
            return CacheEntry(
                result=ProviderResult.from_dict(payload["result"]),
                stored_at=datetime.fromisoformat(payload["stored_at"]),
            )
        except (OSError, ValueError, KeyError, FindingValidationError) as exc:
            logger.warning("cache %s: unreadable entry ignored (%s)", path, exc)
            return None

    def put(self, provider_id: str, key: str, result: ProviderResult) -> None:
        path = self._path(provider_id, key)
        path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "schema": _CACHE_SCHEMA_VERSION,
            "stored_at": self._clock().isoformat(),
            "result": result.to_dict(),
        }
        tmp = path.with_suffix(".tmp")
        tmp.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
        tmp.replace(path)

    def _path(self, provider_id: str, key: str) -> Path:
        digest = hashlib.sha256(key.encode("utf-8")).hexdigest()[:16]
        return self._dir / provider_id / f"{digest}.json"
