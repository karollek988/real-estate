"""Tests for market_intelligence.http_client — retry, backoff, rate limiting."""

from __future__ import annotations

import pytest

from market_intelligence.config import EngineConfig
from market_intelligence.http_client import HttpClient, HttpError
from tests.market_intelligence.conftest import (
    always_monotonic,
    canned_transport,
    error_transport,
    json_transport,
    network_error_transport,
    never_sleep,
)


class TestHttpClient:
    def test_get_json_success(self) -> None:
        config = EngineConfig()
        client = HttpClient(
            config,
            transport=json_transport({"rate": 3.5}),
            sleep=never_sleep,
            monotonic=always_monotonic,
        )
        result = client.get_json("https://example.com/api")
        assert result == {"rate": 3.5}

    def test_get_text_success(self) -> None:
        config = EngineConfig()
        client = HttpClient(
            config,
            transport=canned_transport(200, b"hello"),
            sleep=never_sleep,
            monotonic=always_monotonic,
        )
        result = client.get_text("https://example.com")
        assert result == "hello"

    def test_get_bytes_success(self) -> None:
        config = EngineConfig()
        client = HttpClient(
            config,
            transport=canned_transport(200, b"\x00\x01"),
            sleep=never_sleep,
            monotonic=always_monotonic,
        )
        result = client.get_bytes("https://example.com")
        assert result == b"\x00\x01"

    def test_4xx_not_retried(self) -> None:
        config = EngineConfig(http_max_retries=3)
        client = HttpClient(
            config,
            transport=error_transport(404),
            sleep=never_sleep,
            monotonic=always_monotonic,
        )
        with pytest.raises(HttpError, match="404"):
            client.get_text("https://example.com")

    def test_5xx_retried_then_fails(self) -> None:
        config = EngineConfig(http_max_retries=2)
        client = HttpClient(
            config,
            transport=error_transport(503),
            sleep=never_sleep,
            monotonic=always_monotonic,
        )
        with pytest.raises(HttpError, match="failed after 3 attempts"):
            client.get_text("https://example.com")

    def test_network_error_retried(self) -> None:
        config = EngineConfig(http_max_retries=2)
        client = HttpClient(
            config,
            transport=network_error_transport(),
            sleep=never_sleep,
            monotonic=always_monotonic,
        )
        with pytest.raises(HttpError, match="failed after 3 attempts"):
            client.get_bytes("https://example.com")

    def test_get_json_non_json_response(self) -> None:
        config = EngineConfig()
        client = HttpClient(
            config,
            transport=canned_transport(200, b"not json"),
            sleep=never_sleep,
            monotonic=always_monotonic,
        )
        with pytest.raises(HttpError, match="non-JSON"):
            client.get_json("https://example.com")

    def test_rate_limiting(self) -> None:
        sleep_calls: list[float] = []
        call_count = [0]

        def track_sleep(t: float) -> None:
            sleep_calls.append(t)

        def track_monotonic() -> float:
            call_count[0] += 1
            return 1000.0 + (call_count[0] - 1) * 0.1

        config = EngineConfig()
        client = HttpClient(
            config,
            transport=json_transport({"ok": True}),
            sleep=track_sleep,
            rate_limits={"example.com": 1.0},
            monotonic=track_monotonic,
        )
        client.get_json("https://example.com/api")
        client.get_json("https://example.com/api")
        assert len(sleep_calls) == 1
        assert sleep_calls[0] > 0

    def test_query_params(self) -> None:
        config = EngineConfig()
        captured_url = []

        def capture_transport(request: object, timeout: float) -> object:
            captured_url.append(getattr(request, "full_url", ""))
            return canned_transport(200, b'{"ok": true}')(request, timeout)

        client = HttpClient(
            config,
            transport=json_transport({"ok": True}),
            sleep=never_sleep,
            monotonic=always_monotonic,
        )
        result = client.get_json("https://example.com/api", params={"key": "value", "num": "42"})
        assert isinstance(result, dict)
