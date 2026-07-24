"""Shared HTTP client (task F-03).

Stdlib-only (urllib) behind a small injectable transport so tests never
touch the network. Design rules carried in from docs/28:

- Always send a User-Agent (Overpass answers 406 without one — bug #4).
- Bounded, polite retry with backoff on 5xx/transport errors only; 4xx
  is the caller's problem and is never retried.
- Optional per-host minimum request interval — most of our sources are
  free public services and we behave accordingly (docs/28 reliability
  note on Overpass).
"""

from __future__ import annotations

import json
import logging
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from collections.abc import Callable, Mapping
from dataclasses import dataclass, field

from location_intelligence.config import EngineConfig

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class HttpResponse:
    status: int
    body: bytes
    headers: dict[str, str] = field(default_factory=dict)


Transport = Callable[[urllib.request.Request, float], HttpResponse]


class HttpError(Exception):
    def __init__(self, message: str, status: int | None = None, url: str | None = None) -> None:
        super().__init__(message)
        self.status = status
        self.url = url


def _urllib_transport(request: urllib.request.Request, timeout: float) -> HttpResponse:
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:  # noqa: S310
            return HttpResponse(
                status=response.status,
                body=response.read(),
                headers=dict(response.headers.items()),
            )
    except urllib.error.HTTPError as exc:
        body = exc.read() if exc.fp else b""
        return HttpResponse(status=exc.code, body=body, headers=dict((exc.headers or {}).items()))


class HttpClient:
    """GET-oriented client with retry, backoff, and per-host rate limiting.

    ``rate_limits`` maps hostname → minimum seconds between requests to
    that host. ``sleep`` and ``transport`` are injectable for tests.
    """

    def __init__(
        self,
        config: EngineConfig,
        transport: Transport | None = None,
        sleep: Callable[[float], None] = time.sleep,
        rate_limits: Mapping[str, float] | None = None,
        monotonic: Callable[[], float] = time.monotonic,
    ) -> None:
        self._config = config
        self._transport = transport or _urllib_transport
        self._sleep = sleep
        self._rate_limits = dict(rate_limits or {})
        self._monotonic = monotonic
        self._last_request_at: dict[str, float] = {}
        self._rate_limit_lock = threading.Lock()

    def get_bytes(
        self,
        url: str,
        params: Mapping[str, str] | None = None,
        headers: Mapping[str, str] | None = None,
        timeout_s: float | None = None,
    ) -> bytes:
        full_url = url if not params else f"{url}?{urllib.parse.urlencode(dict(params))}"
        timeout = timeout_s if timeout_s is not None else self._config.http_timeout_s
        request_headers = {"User-Agent": self._config.user_agent, **(headers or {})}
        host = urllib.parse.urlsplit(full_url).hostname or ""

        attempts = self._config.http_max_retries + 1
        last_error: str = "no attempt made"
        for attempt in range(attempts):
            self._respect_rate_limit(host)
            request = urllib.request.Request(full_url, headers=request_headers)  # noqa: S310
            try:
                response = self._transport(request, timeout)
            except (urllib.error.URLError, TimeoutError, OSError) as exc:
                last_error = f"transport error: {exc}"
                logger.warning(
                    "GET %s attempt %d/%d failed: %s", full_url, attempt + 1, attempts, exc
                )
                self._backoff(attempt, attempts)
                continue

            if response.status < 400:
                return response.body
            if response.status < 500 and response.status != 429:
                raise HttpError(
                    f"GET {full_url} returned {response.status}",
                    status=response.status,
                    url=full_url,
                )
            last_error = f"server error {response.status}"
            logger.warning(
                "GET %s attempt %d/%d got %d", full_url, attempt + 1, attempts, response.status
            )
            self._backoff(attempt, attempts, retry_after=_retry_after_s(response))

        raise HttpError(
            f"GET {full_url} failed after {attempts} attempts ({last_error})", url=full_url
        )

    def get_text(
        self,
        url: str,
        params: Mapping[str, str] | None = None,
        headers: Mapping[str, str] | None = None,
        timeout_s: float | None = None,
    ) -> str:
        return self.get_bytes(url, params, headers, timeout_s).decode("utf-8", errors="replace")

    def post_bytes(
        self,
        url: str,
        body: bytes,
        headers: Mapping[str, str] | None = None,
        timeout_s: float | None = None,
    ) -> bytes:
        timeout = timeout_s if timeout_s is not None else self._config.http_timeout_s
        request_headers = {"User-Agent": self._config.user_agent, **(headers or {})}
        host = urllib.parse.urlsplit(url).hostname or ""

        attempts = self._config.http_max_retries + 1
        last_error: str = "no attempt made"
        for attempt in range(attempts):
            self._respect_rate_limit(host)
            request = urllib.request.Request(url, data=body, headers=request_headers)  # noqa: S310
            try:
                response = self._transport(request, timeout)
            except (urllib.error.URLError, TimeoutError, OSError) as exc:
                last_error = f"transport error: {exc}"
                logger.warning("POST %s attempt %d/%d failed: %s", url, attempt + 1, attempts, exc)
                self._backoff(attempt, attempts)
                continue

            if response.status < 400:
                return response.body
            if response.status < 500 and response.status != 429:
                raise HttpError(
                    f"POST {url} returned {response.status}", status=response.status, url=url
                )
            last_error = f"server error {response.status}"
            logger.warning(
                "POST %s attempt %d/%d got %d", url, attempt + 1, attempts, response.status
            )
            self._backoff(attempt, attempts, retry_after=_retry_after_s(response))

        raise HttpError(f"POST {url} failed after {attempts} attempts ({last_error})", url=url)

    def post_text(
        self,
        url: str,
        body: bytes,
        headers: Mapping[str, str] | None = None,
        timeout_s: float | None = None,
    ) -> str:
        return self.post_bytes(url, body, headers, timeout_s).decode("utf-8", errors="replace")

    def get_json(
        self,
        url: str,
        params: Mapping[str, str] | None = None,
        headers: Mapping[str, str] | None = None,
        timeout_s: float | None = None,
    ) -> object:
        text = self.get_text(url, params, headers, timeout_s)
        try:
            return json.loads(text)
        except json.JSONDecodeError as exc:
            raise HttpError(f"GET {url} returned non-JSON body: {exc}", url=url) from exc

    def _respect_rate_limit(self, host: str) -> None:
        min_interval = self._rate_limits.get(host)
        if not min_interval:
            return
        # Reserve the next allowed slot under a lock so concurrent callers
        # (multiple providers hitting the same host from different threads)
        # serialize correctly — a check-then-sleep-then-write without a lock
        # lets two threads both see a stale `last` and fire near-simultaneous
        # requests, defeating the rate limit (observed live: concurrent OSM
        # providers got 429'd from the shared Overpass instance).
        with self._rate_limit_lock:
            last = self._last_request_at.get(host)
            now = self._monotonic()
            next_allowed = last + min_interval if last is not None else now
            wait = next_allowed - now
            self._last_request_at[host] = max(now, next_allowed)
        if wait > 0:
            logger.debug("rate limit: sleeping %.2fs before %s", wait, host)
            self._sleep(wait)

    def _backoff(self, attempt: int, attempts: int, retry_after: float | None = None) -> None:
        if attempt < attempts - 1:
            exponential = self._config.http_backoff_base_s * (2**attempt)
            # 429 responses may name their own cooldown (Overpass and others
            # do) — honor it instead of guessing, per the same "be a polite
            # client of a shared public instance" rule already applied to
            # per-host rate limiting.
            wait = exponential if retry_after is None else max(exponential, retry_after)
            self._sleep(wait)


def _retry_after_s(response: HttpResponse) -> float | None:
    if response.status != 429:
        return None
    raw = next((v for k, v in response.headers.items() if k.lower() == "retry-after"), None)
    if raw is None:
        return None
    try:
        return float(raw)
    except ValueError:
        return None
