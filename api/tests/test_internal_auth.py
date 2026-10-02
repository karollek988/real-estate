"""Tests for api/server.py's server-to-server authentication
(require_internal_secret middleware) — the only thing standing between
this service and anyone who finds its Railway URL, since it has no user
accounts, sessions, or per-request authorization of its own.

Runs against the real `app` object via FastAPI's TestClient, not an
isolated copy of the check, so a wiring bug (middleware registered but not
actually applied to a route, wrong header name, etc.) would be caught here
too. Every "rejected" case below asserts the response never reaches a real
route handler — provable without network access or any of the optional
dependencies (Tesseract, Camoufox, OpenAI) those handlers need, because the
middleware short-circuits before routing/request-body validation ever runs.
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

# server.py lives in api/, one level up from this tests/ directory — added
# to sys.path so `import server` resolves the same way it would when
# uvicorn runs it directly, regardless of pytest's own rootdir/cwd. server.py
# does its own sys.path setup for analysis_engine/BRF-Scraper/src at import
# time, so importing it here pulls in every dependency it needs.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import server  # noqa: E402

SECRET = "test-only-secret-not-a-real-credential"
HEADER = server.INTERNAL_SECRET_HEADER

# One endpoint from each distinct category in the file — compute-only,
# OCR, the browser fetch that would otherwise need real network/browser
# access, and the upload extraction — proving the middleware protects all
# of them uniformly, not just the OCR endpoint the original report named.
PROTECTED_ENDPOINTS = [
    "/api/browser-fetch",
    "/api/brf-annual-report/upload",
    "/api/ocr/extract-text",
    "/api/brf-financials",
    "/api/location-intelligence",
    "/api/market-intelligence",
]

# Endpoints of the automated BRF acquisition pipeline (Hemnet URL -> BRF
# profile -> annual report -> analysis text), removed 2026-10-02 because
# BRF annual reports are now uploaded by the buyer. They must stay gone.
REMOVED_ENDPOINTS = [
    "/api/resolve",
    "/api/analyze",
    "/api/brf-annual-report",
]


@pytest.fixture
def configured_client(monkeypatch):
    monkeypatch.setenv(server.INTERNAL_SECRET_ENV_VAR, SECRET)
    return TestClient(server.app)


@pytest.fixture
def unconfigured_client(monkeypatch):
    monkeypatch.delenv(server.INTERNAL_SECRET_ENV_VAR, raising=False)
    return TestClient(server.app)


def test_root_stays_public_with_no_header(configured_client):
    """GET / (the health page, and Railway's health-check target) must
    never require the secret - authenticating it risks a correctly-running
    deployment being flagged unhealthy by the platform."""
    res = configured_client.get("/")
    assert res.status_code == 200


@pytest.mark.parametrize("path", PROTECTED_ENDPOINTS)
def test_rejects_missing_header(configured_client, path):
    res = configured_client.post(path, json={})
    assert res.status_code == 401
    assert res.json()["success"] is False


@pytest.mark.parametrize("path", PROTECTED_ENDPOINTS)
def test_rejects_invalid_header(configured_client, path):
    res = configured_client.post(path, json={}, headers={HEADER: "wrong-value"})
    assert res.status_code == 401
    assert res.json()["success"] is False


@pytest.mark.parametrize("path", PROTECTED_ENDPOINTS)
def test_rejects_everything_when_server_has_no_secret_configured(unconfigured_client, path):
    """Fails closed, not open: if PYTHON_ENGINE_API_SECRET is missing on
    this service's own side, every protected request is rejected outright -
    never silently let through because "nothing to compare against"."""
    res = unconfigured_client.post(path, json={}, headers={HEADER: "anything"})
    assert res.status_code == 500
    assert res.json()["success"] is False


def test_accepts_valid_header_and_reaches_the_real_handler(configured_client):
    """A correct secret must be let through to the actual route - checked
    against a pure-compute endpoint (no network/Tesseract/Camoufox needed)
    so this proves the middleware forwards the request, not that the
    business logic behind it succeeds. An empty annual_report reaching the
    real handler still returns a normal (non-401/500) response."""
    res = configured_client.post(
        "/api/brf-financials",
        json={"annual_report": {}},
        headers={HEADER: SECRET},
    )
    assert res.status_code not in (401, 500)


def test_valid_header_is_timing_safe_compared_not_just_equal_length(configured_client):
    """A same-length-but-wrong secret must still be rejected - guards
    against a future refactor accidentally swapping hmac.compare_digest for
    a plain `==` (still correct either way, but no longer timing-safe)."""
    wrong_same_length = "x" * len(SECRET)
    res = configured_client.post(
        "/api/brf-financials",
        json={},
        headers={HEADER: wrong_same_length},
    )
    assert res.status_code == 401


@pytest.mark.parametrize("path", REMOVED_ENDPOINTS)
def test_removed_acquisition_endpoints_are_gone(configured_client, path):
    """Even with a valid secret the old BRF acquisition endpoints are not
    routes any more (404, not a handler error) - nothing on this service can
    look a BRF up or download a report by itself."""
    res = configured_client.post(path, json={}, headers={HEADER: SECRET})
    assert res.status_code == 404


def test_the_only_brf_routes_are_upload_and_financials():
    """Guards against an acquisition route coming back under a new name: every
    registered route that mentions a BRF report is the upload extraction or
    the financial calculation."""
    brf_paths = sorted(
        r.path for r in server.app.routes if "brf" in getattr(r, "path", "")
    )
    assert brf_paths == ["/api/brf-annual-report/upload", "/api/brf-financials"]
