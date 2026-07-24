"""Shared HTTP client.

Stdlib-only (urllib) behind a small injectable transport so tests never
touch the network. Design rules:

- Always send a User-Agent.
- Bounded, polite retry with backoff on 5xx/transport errors only; 4xx
  is the caller's problem and is never retried.
- Optional per-host minimum request interval for rate-limited APIs.
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

from market_intelligence.config import EngineConfig

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
        return HttpResponse(
            status=exc.code,
            body=body,
            headers=dict((exc.headers or {}).items()),
        )


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
                    "GET %s attempt %d/%d failed: %s",
                    full_url,
                    attempt + 1,
                    attempts,
                    exc,
                )
                self._backoff(attempt, attempts)
                continue

            if response.status < 400:
                return response.body
            if response.status < 500:
                raise HttpError(
                    f"GET {full_url} returned {response.status}",
                    status=response.status,
                    url=full_url,
                )
            last_error = f"server error {response.status}"
            logger.warning(
                "GET %s attempt %d/%d got %d",
                full_url,
                attempt + 1,
                attempts,
                response.status,
            )
            self._backoff(attempt, attempts)

        raise HttpError(
            f"GET {full_url} failed after {attempts} attempts ({last_error})",
            url=full_url,
        )

    def get_text(
        self,
        url: str,
        params: Mapping[str, str] | None = None,
        headers: Mapping[str, str] | None = None,
        timeout_s: float | None = None,
    ) -> str:
        return self.get_bytes(url, params, headers, timeout_s).decode("utf-8", errors="replace")

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

    def post_json(
        self,
        url: str,
        body: dict,
        headers: Mapping[str, str] | None = None,
        timeout_s: float | None = None,
    ) -> object:
        """Send a POST request with JSON body and return parsed JSON response."""
        timeout = timeout_s if timeout_s is not None else self._config.http_timeout_s
        request_headers = {
            "User-Agent": self._config.user_agent,
            "Content-Type": "application/json",
            **(headers or {}),
        }
        host = urllib.parse.urlsplit(url).hostname or ""
        body_bytes = json.dumps(body).encode("utf-8")

        attempts = self._config.http_max_retries + 1
        last_error: str = "no attempt made"
        for attempt in range(attempts):
            self._respect_rate_limit(host)
            request = urllib.request.Request(
                url, data=body_bytes, headers=request_headers, method="POST"
            )  # noqa: S310
            try:
                response = self._transport(request, timeout)
            except (urllib.error.URLError, TimeoutError, OSError) as exc:
                last_error = f"transport error: {exc}"
                logger.warning(
                    "POST %s attempt %d/%d failed: %s",
                    url,
                    attempt + 1,
                    attempts,
                    exc,
                )
                self._backoff(attempt, attempts)
                continue

            if response.status < 400:
                text = response.body.decode("utf-8", errors="replace")
                try:
                    return json.loads(text)
                except json.JSONDecodeError as exc:
                    raise HttpError(f"POST {url} returned non-JSON body: {exc}", url=url) from exc
            if response.status < 500:
                raise HttpError(
                    f"POST {url} returned {response.status}",
                    status=response.status,
                    url=url,
                )
            last_error = f"server error {response.status}"
            logger.warning(
                "POST %s attempt %d/%d got %d",
                url,
                attempt + 1,
                attempts,
                response.status,
            )
            self._backoff(attempt, attempts)

        raise HttpError(
            f"POST {url} failed after {attempts} attempts ({last_error})",
            url=url,
        )

    def _respect_rate_limit(self, host: str) -> None:
        min_interval = self._rate_limits.get(host)
        if not min_interval:
            return
        with self._rate_limit_lock:
            last = self._last_request_at.get(host)
            now = self._monotonic()
            next_allowed = last + min_interval if last is not None else now
            wait = next_allowed - now
            self._last_request_at[host] = max(now, next_allowed)
        if wait > 0:
            logger.debug("rate limit: sleeping %.2fs before %s", wait, host)
            self._sleep(wait)

    def _backoff(self, attempt: int, attempts: int) -> None:
        if attempt < attempts - 1:
            self._sleep(self._config.http_backoff_base_s * (2**attempt))
