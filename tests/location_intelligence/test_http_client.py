"""F-03 Definition of Done: timeout, retry-then-fail, User-Agent presence."""

from __future__ import annotations

import threading
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor

import pytest

from location_intelligence.config import EngineConfig
from location_intelligence.http_client import HttpClient, HttpError, HttpResponse


class FakeTransport:
    """Scripted transport: pops one outcome per call.

    An outcome is an HttpResponse or an exception instance to raise.
    """

    def __init__(self, outcomes: list[HttpResponse | Exception]) -> None:
        self.outcomes = outcomes
        self.requests: list[urllib.request.Request] = []

    def __call__(self, request: urllib.request.Request, timeout: float) -> HttpResponse:
        self.requests.append(request)
        outcome = self.outcomes.pop(0)
        if isinstance(outcome, Exception):
            raise outcome
        return outcome


def make_client(transport: FakeTransport, **rate_limits: float) -> tuple[HttpClient, list[float]]:
    sleeps: list[float] = []
    client = HttpClient(
        EngineConfig(http_max_retries=2, http_backoff_base_s=0.5),
        transport=transport,
        sleep=sleeps.append,
        rate_limits=rate_limits or None,
    )
    return client, sleeps


class TestHttpClient:
    def test_success_parses_json_and_sends_user_agent(self) -> None:
        transport = FakeTransport([HttpResponse(200, b'{"answer": 42}')])
        client, _ = make_client(transport)

        assert client.get_json("https://api.example.org/data") == {"answer": 42}
        # Overpass 406 regression guard (docs/28 bug #4): UA on every request.
        assert transport.requests[0].get_header("User-agent") == EngineConfig().user_agent

    def test_server_errors_retry_with_backoff_then_succeed(self) -> None:
        transport = FakeTransport(
            [HttpResponse(500, b""), HttpResponse(503, b""), HttpResponse(200, b"ok")]
        )
        client, sleeps = make_client(transport)

        assert client.get_text("https://api.example.org/x") == "ok"
        assert len(transport.requests) == 3
        assert sleeps == [0.5, 1.0]  # exponential backoff

    def test_429_is_retried_with_backoff_then_succeeds(self) -> None:
        # Regression: validation run against 27 real addresses (this
        # session) showed the shared public Overpass instance 429ing under
        # sustained load — 429 was being treated identically to a genuine
        # 4xx client error (never retried), turning a transient rate-limit
        # into a hard failure. 429 must be retried like a 5xx.
        transport = FakeTransport([HttpResponse(429, b""), HttpResponse(200, b"ok")])
        client, sleeps = make_client(transport)

        assert client.get_text("https://api.example.org/x") == "ok"
        assert len(transport.requests) == 2
        assert sleeps == [0.5]

    def test_429_honors_retry_after_header(self) -> None:
        transport = FakeTransport(
            [HttpResponse(429, b"", headers={"Retry-After": "3"}), HttpResponse(200, b"ok")]
        )
        client, sleeps = make_client(transport)

        assert client.get_text("https://api.example.org/x") == "ok"
        assert sleeps == [3.0]  # server-specified cooldown beats the 0.5s exponential default

    def test_429_retry_after_lowercase_header_is_recognized(self) -> None:
        transport = FakeTransport(
            [HttpResponse(429, b"", headers={"retry-after": "2"}), HttpResponse(200, b"ok")]
        )
        client, sleeps = make_client(transport)

        client.get_text("https://api.example.org/x")
        assert sleeps == [2.0]

    def test_429_exhausting_retries_raises_honest_error(self) -> None:
        transport = FakeTransport([HttpResponse(429, b"")] * 3)
        client, _ = make_client(transport)

        with pytest.raises(HttpError) as excinfo:
            client.get_bytes("https://api.example.org/x")
        assert excinfo.value.status is None  # raised via the generic "failed after N" path
        assert "failed after 3 attempts" in str(excinfo.value)

    def test_post_429_is_retried(self) -> None:
        transport = FakeTransport([HttpResponse(429, b""), HttpResponse(200, b"ok")])
        client, sleeps = make_client(transport)

        assert client.post_text("https://api.example.org/q", body=b"x") == "ok"
        assert sleeps == [0.5]

    def test_client_error_is_not_retried(self) -> None:
        transport = FakeTransport([HttpResponse(404, b"gone")])
        client, sleeps = make_client(transport)

        with pytest.raises(HttpError) as excinfo:
            client.get_bytes("https://api.example.org/missing")
        assert excinfo.value.status == 404
        assert len(transport.requests) == 1
        assert sleeps == []

    def test_transport_errors_retry_then_fail(self) -> None:
        transport = FakeTransport(
            [
                urllib.error.URLError("connection refused"),
                TimeoutError("timed out"),
                urllib.error.URLError("still down"),
            ]
        )
        client, _ = make_client(transport)

        with pytest.raises(HttpError, match="failed after 3 attempts"):
            client.get_bytes("https://api.example.org/x")
        assert len(transport.requests) == 3

    def test_rate_limit_sleeps_between_same_host_calls(self) -> None:
        transport = FakeTransport([HttpResponse(200, b"a"), HttpResponse(200, b"b")])
        client, sleeps = make_client(transport, **{"api.example.org": 1.0})

        client.get_bytes("https://api.example.org/first")
        client.get_bytes("https://api.example.org/second")
        assert len(sleeps) == 1
        assert 0.0 < sleeps[0] <= 1.0

    def test_params_are_encoded_into_url(self) -> None:
        transport = FakeTransport([HttpResponse(200, b"ok")])
        client, _ = make_client(transport)

        client.get_bytes("https://api.example.org/q", params={"kommun": "Stockholm stad"})
        assert transport.requests[0].full_url == "https://api.example.org/q?kommun=Stockholm+stad"

    def test_post_sends_body_and_user_agent(self) -> None:
        transport = FakeTransport([HttpResponse(200, b'{"ok": true}')])
        client, _ = make_client(transport)

        result = client.post_text(
            "https://api.example.org/query", body=b"data=1", headers={"X-Test": "1"}
        )
        assert result == '{"ok": true}'
        request = transport.requests[0]
        assert request.data == b"data=1"
        assert request.get_header("User-agent") == EngineConfig().user_agent
        assert request.get_header("X-test") == "1"

    def test_post_retries_on_server_error(self) -> None:
        transport = FakeTransport([HttpResponse(502, b""), HttpResponse(200, b"ok")])
        client, sleeps = make_client(transport)

        assert client.post_text("https://api.example.org/q", body=b"x") == "ok"
        assert sleeps == [0.5]

    def test_post_client_error_is_not_retried(self) -> None:
        transport = FakeTransport([HttpResponse(400, b"bad")])
        client, sleeps = make_client(transport)

        with pytest.raises(HttpError) as excinfo:
            client.post_bytes("https://api.example.org/q", body=b"x")
        assert excinfo.value.status == 400
        assert sleeps == []

    def test_rate_limit_serializes_concurrent_requests_to_same_host(self) -> None:
        # Regression: two providers hitting the same rate-limited host from
        # different threads (e.g. osm_poi + osm_construction both calling
        # Overpass) must not race past the check-then-sleep-then-write gap —
        # observed live as a 429 from the shared public Overpass instance
        # before the rate limiter's reservation was made atomic.
        n = 6
        sleep_lock = threading.Lock()
        sleeps: list[float] = []

        def recording_sleep(seconds: float) -> None:
            with sleep_lock:
                sleeps.append(seconds)

        transport = FakeTransport([HttpResponse(200, b"ok") for _ in range(n)])
        client = HttpClient(
            EngineConfig(),
            transport=transport,
            sleep=recording_sleep,
            rate_limits={"api.example.org": 1.0},
            monotonic=lambda: 0.0,  # frozen clock isolates the locking logic
        )

        with ThreadPoolExecutor(max_workers=n) as pool:
            list(pool.map(lambda _: client.get_bytes("https://api.example.org/x"), range(n)))

        # With a frozen clock, each of the n reservations must land on a
        # distinct 1.0s-spaced slot: one caller gets the free (wait=0, no
        # sleep call) slot and the rest wait {1, 2, ..., n-1} — never two
        # callers computing the same wait, which is what an unguarded
        # check-then-write race would produce.
        assert sorted(sleeps) == [float(i) for i in range(1, n)]
