"""Köpanalys API — FastAPI server for BRF analysis.

Endpoints:
  POST /api/resolve   — Hemnet URL → unified BRF profile (Hemnet + Booli + Allabrf)
  POST /api/analyze   — Financial data + BRF metadata → Köpanalys report
  GET  /              — Frontend UI
"""

from __future__ import annotations

import asyncio
import hmac
import json
import os
import sys
from pathlib import Path
from typing import Any

import logging

from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse
from pydantic import BaseModel

logger = logging.getLogger("kopanalys.api")

# Ensure analysis_engine is importable
_engine_dir = Path(__file__).resolve().parent.parent / "analysis_engine"
if str(_engine_dir) not in sys.path:
    sys.path.insert(0, str(_engine_dir))

from calculator import calculate_metrics, ANALYSIS_ENGINE_VERSION
from reasoning import run_reasoning
from report import generate_report
from serialize import metrics_to_dict, reasoning_to_dict

# Add BRF-Scraper src to path for provider imports
_scraper_src = Path(__file__).resolve().parent.parent / "BRF-Scraper" / "src"
if str(_scraper_src) not in sys.path:
    sys.path.insert(0, str(_scraper_src))

from brf_scraper.profile.engine import ProfileEngine
from brf_scraper.profile.models import BRFProfile
from brf_scraper.profile.bridge import profile_to_analysis_input
from brf_scraper.profile.coverage import generate_coverage_report

# Add the real-estate project's src/ for location_intelligence + market_intelligence
# (standalone, stdlib-only packages, built and tested but never previously called
# from any live request path — see docs/44_production_release_checklist.md, B6)
_real_estate_src = Path(__file__).resolve().parent.parent / "src"
if str(_real_estate_src) not in sys.path:
    sys.path.insert(0, str(_real_estate_src))

from location_intelligence.builder import PackageBuilder as LIPackageBuilder
from location_intelligence.cache import ProviderCache as LIProviderCache
from location_intelligence.config import EngineConfig as LIEngineConfig
from location_intelligence.context import context_from_raw_input
from location_intelligence.providers import default_registry as li_default_registry
from location_intelligence.runner import EngineRunner as LIEngineRunner

from market_intelligence.builder import PackageBuilder as MIPackageBuilder
from market_intelligence.cache import ProviderCache as MIProviderCache
from market_intelligence.config import EngineConfig as MIEngineConfig
from market_intelligence.context import MarketContext
from market_intelligence.providers import default_registry as mi_default_registry
from market_intelligence.runner import EngineRunner as MIEngineRunner


# ── Browser fetch (Camoufox) ─────────────────────────────────────────
#
# Root cause of the 2026-08-14 outage: this service runs as a single
# uvicorn worker (see the Dockerfile CMD — no --workers flag), so every
# concurrent request shares one process's memory. Each AsyncCamoufox
# launch spins up a real Firefox instance (150-400MB+ RSS); nothing
# bounded how many could run at once, so a handful of overlapping
# requests (this endpoint, /api/resolve, /api/brf-annual-report, and —
# at the time of this outage — the since-removed broker-documents
# Hemnet-blocked fallback all call this) could add up to
# more memory than the container has, triggering the OOM killer — visible
# in `railway logs` as a bare "Killed" with no Python traceback at all,
# since the kernel terminates the process before it can log anything.
# This semaphore caps how many Camoufox/Firefox instances run
# simultaneously in this process; excess callers simply wait their turn
# instead of piling on more browser processes. Tune via
# MAX_CONCURRENT_BROWSER_FETCHES if this proves too conservative once
# real memory headroom on the current Railway plan is confirmed.
_BROWSER_FETCH_SEMAPHORE = asyncio.Semaphore(
    int(os.environ.get("MAX_CONCURRENT_BROWSER_FETCHES", "1"))
)

# Cloudflare's "Managed Challenge" interstitial (confirmed live 2026-09:
# Camoufox gets past Hemnet's edge block that rejects plain fetch() with a
# 403, but lands on this page, whose own JS needs a few seconds to run its
# check and redirect to the real page — the previous fixed ~5s networkidle
# wait consistently captured the challenge itself, not the real content, on
# 3/3 live attempts). This exact title is Cloudflare's own, stable across
# every site using this challenge type, not something specific to Hemnet's
# page design — so this check doesn't get more fragile as Hemnet's own
# markup changes, unlike keying off Hemnet-specific selectors would.
_CLOUDFLARE_CHALLENGE_TITLE = "Just a moment..."
_CHALLENGE_POLL_INTERVAL_S = 0.5
_CHALLENGE_MAX_WAIT_S = 15.0


class BrowserChallengeError(Exception):
    """Raised when a Cloudflare (or similar) challenge never clears within
    the wait budget — the caller must never treat this as success and parse
    the interstitial as if it were the real page."""


async def _wait_for_challenge_to_clear(page) -> None:
    """Poll the page's own title — the concrete signal that Cloudflare's
    challenge JS has finished and redirected — rather than a blind sleep.
    Raises BrowserChallengeError if it never clears within the budget, so a
    still-challenged page is never silently returned as real content.
    """
    elapsed = 0.0
    while elapsed < _CHALLENGE_MAX_WAIT_S:
        if await page.title() != _CLOUDFLARE_CHALLENGE_TITLE:
            return
        await asyncio.sleep(_CHALLENGE_POLL_INTERVAL_S)
        elapsed += _CHALLENGE_POLL_INTERVAL_S

    if await page.title() == _CLOUDFLARE_CHALLENGE_TITLE:
        raise BrowserChallengeError(
            f"Cloudflare challenge did not resolve within {_CHALLENGE_MAX_WAIT_S}s"
        )


async def _browser_fetch(url: str) -> str:
    """Fetch a URL using Camoufox (real Firefox browser) to bypass bot detection."""
    from camoufox.async_api import AsyncCamoufox

    async with _BROWSER_FETCH_SEMAPHORE:
        logger.info("browser_fetch_start: %s", url)

        async with AsyncCamoufox(headless=True) as browser:
            page = await browser.new_page()
            try:
                await page.goto(url, wait_until="load", timeout=30000)
                try:
                    await page.wait_for_load_state("networkidle", timeout=5000)
                except Exception:
                    pass

                if await page.title() == _CLOUDFLARE_CHALLENGE_TITLE:
                    logger.info("browser_fetch_challenge_detected: %s", url)
                    await _wait_for_challenge_to_clear(page)
                    logger.info("browser_fetch_challenge_resolved: %s", url)
                    # The real page's own network activity may still be
                    # settling right after the challenge redirects — one
                    # more short, bounded wait, same pattern as above.
                    try:
                        await page.wait_for_load_state("networkidle", timeout=5000)
                    except Exception:
                        pass

                html = await page.content()
                logger.info("browser_fetch_done: %s (%d chars)", url, len(html))
                return html
            finally:
                await page.close()


app = FastAPI(title="Köpanalys API", version="0.2.0")


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catch-all: every unhandled exception returns JSON, never plain text."""
    logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"success": False, "error": str(exc), "details": type(exc).__name__},
    )


# ── Server-to-server authentication ────────────────────────────────
#
# This service has no user accounts, sessions, or per-request authorization
# of its own — every protection a real user interacts with (login, rate
# limiting, essential-field validation, quota) exists only in the Next.js
# layer. Until now, that meant anyone who discovered this service's URL
# could call any endpoint below directly — unlimited, free, bypassing
# Next.js (and its cost controls) entirely. Every route except the ones in
# _PUBLIC_PATHS now requires a header matching PYTHON_ENGINE_API_SECRET, a
# secret shared only between the Vercel and Railway deployments (never sent
# to, or readable from, the browser — see frontend/src/lib/pythonEngine.ts,
# the one place on the Next.js side that attaches it).
#
# Implemented as middleware (not a per-route `Depends(...)`) so a future
# endpoint is protected by default the moment it's added, instead of only
# when someone remembers to annotate it — same "secure by default" reasoning
# as the profiles/RPC fixes in supabase/migrations.
INTERNAL_SECRET_ENV_VAR = "PYTHON_ENGINE_API_SECRET"
INTERNAL_SECRET_HEADER = "x-internal-secret"

# "/" serves only this service's own static demo page (no data, no cost) and
# doubles as Railway's health-check target — authenticating it risks a
# correctly-configured deployment being marked unhealthy by the platform.
_PUBLIC_PATHS = {"/"}


@app.middleware("http")
async def require_internal_secret(request: Request, call_next):
    if request.url.path in _PUBLIC_PATHS:
        return await call_next(request)

    expected = os.environ.get(INTERNAL_SECRET_ENV_VAR)
    if not expected:
        logger.error("%s is not configured — rejecting all internal requests", INTERNAL_SECRET_ENV_VAR)
        return JSONResponse(status_code=500, content={"success": False, "error": "Server not configured."})

    provided = request.headers.get(INTERNAL_SECRET_HEADER)
    if not provided or not hmac.compare_digest(provided, expected):
        return JSONResponse(
            status_code=401,
            content={"success": False, "error": "Missing or invalid internal authentication."},
        )

    return await call_next(request)


# ── Models ──────────────────────────────────────────────────────────

class ResolveRequest(BaseModel):
    hemnet_url: str


class BrowserFetchRequest(BaseModel):
    url: str


class LocationIntelligenceRequest(BaseModel):
    address: str | None = None
    latitude: float | None = None
    longitude: float | None = None


class MarketIntelligenceRequest(BaseModel):
    country: str | None = None
    region: str | None = None
    county: str | None = None
    municipality: str | None = None
    postal_code: str | None = None
    as_of: str | None = None


class AnalyzeRequest(BaseModel):
    brf_name: str | None = None
    organization_number: str | None = None
    municipality: str | None = None
    number_of_apartments: int | None = None
    fiscal_year: int = 2024
    # Profile from /api/resolve (optional — enriches analysis)
    brf_profile: dict[str, Any] | None = None
    # Income statement
    revenue: float | None = None
    operating_costs: float | None = None
    operating_profit: float | None = None
    financial_income: float | None = None
    financial_costs: float | None = None
    profit_before_tax: float | None = None
    profit_after_tax: float | None = None
    # Balance sheet
    total_assets: float | None = None
    current_assets: float | None = None
    fixed_assets: float | None = None
    total_equity: float | None = None
    total_liabilities: float | None = None
    long_term_debt: float | None = None
    short_term_debt: float | None = None
    cash_and_bank: float | None = None
    # Apartment metrics
    avg_monthly_fee: float | None = None
    # Property info
    year_built: int | None = None
    building_area_sqm: float | None = None
    # Loans
    loans: list[dict[str, Any]] | None = None


class BrfFinancialsRequest(BaseModel):
    # One fiscal year's verified annual-report JSON, in the shape
    # calculate_metrics() consumes directly (see
    # analysis_engine/sample_annual_report.json's annual_reports[0]).
    annual_report: dict[str, Any]


class BrfAnnualReportRequest(BaseModel):
    hemnet_url: str


class BrfAnnualReportUploadRequest(BaseModel):
    pdf_base64: str
    filename: str | None = None
    # "pdf" (default, backward compatible) | "docx" | "image"
    file_kind: str = "pdf"


class OcrExtractRequest(BaseModel):
    images_base64: list[str]


# ── Routes ──────────────────────────────────────────────────────────

@app.post("/api/browser-fetch")
async def browser_fetch(req: BrowserFetchRequest):
    """Fetch one URL with Camoufox (real Firefox) to bypass bot detection.

    Thin bridge around the existing `_browser_fetch()` used internally by
    `/api/resolve` and `/api/brf-annual-report` (via ProfileEngine) —
    reuses that same Camoufox mechanism rather than adding a second browser
    stack, so any TypeScript fetch path that gets bot-blocked (e.g.
    lib/analysis/listing/hemnetPage.ts's direct fetch against Hemnet's
    Cloudflare protection) can escalate to a real browser without this
    engine needing its own HTML-extraction logic — the caller parses the
    returned HTML itself.
    """
    try:
        html = await _browser_fetch(req.url)
    except Exception as e:
        logger.exception("Browser fetch failed")
        return JSONResponse(status_code=502, content={
            "success": False,
            "error": f"Browser fetch failed: {e}",
            "details": type(e).__name__,
        })
    return {"success": True, "html": html}


@app.post("/api/resolve")
async def resolve_hemnet(req: ResolveRequest):
    """Resolve a Hemnet URL into a unified BRF profile.

    Queries Hemnet, Booli, and Allabrf. Merges all data into a single
    profile with source attribution on every field.
    """
    engine = ProfileEngine(browser_fetch=_browser_fetch)

    try:
        profile = await engine.build(hemnet_url=req.hemnet_url)
    except Exception as e:
        logger.exception("Profile build failed")
        return JSONResponse(status_code=422, content={
            "success": False,
            "error": f"Profilbygge misslyckades: {e}",
            "details": type(e).__name__,
        })

    # Convert to JSON-serializable dict
    coverage = generate_coverage_report(profile, hemnet_url=req.hemnet_url)
    return {
        "success": True,
        "profile": json.loads(profile.model_dump_json()),
        "meta": profile.meta,
        "coverage": json.loads(coverage.model_dump_json()),
    }


@app.post("/api/analyze")
async def analyze(req: AnalyzeRequest):
    """Run the Köpanalys analysis on provided financial data."""
    # If a profile is provided, use the bridge to merge profile + manual data
    if req.brf_profile:
        try:
            profile = BRFProfile.model_validate(req.brf_profile)
        except Exception as e:
            return JSONResponse(status_code=422, content={
                "success": False,
                "error": f"Ogiltig profildata: {e}",
            })

        # Build manual data dict from request fields
        manual_data: dict[str, Any] = {}
        if req.revenue is not None or req.operating_costs is not None:
            manual_data["income_statement"] = {}
            for field_name in ["revenue", "operating_costs", "operating_profit",
                               "financial_income", "financial_costs",
                               "profit_before_tax", "profit_after_tax"]:
                val = getattr(req, field_name, None)
                if val is not None:
                    manual_data["income_statement"][field_name] = {
                        "value": val, "unit": "SEK",
                        "source": {"page": 0, "field": field_name, "method": "user_input", "confidence": 1.0},
                    }
        if req.total_assets is not None or req.total_equity is not None:
            manual_data["balance_sheet"] = {}
            for field_name in ["total_assets", "current_assets", "fixed_assets",
                               "total_equity", "total_liabilities",
                               "long_term_debt", "short_term_debt", "cash_and_bank"]:
                val = getattr(req, field_name, None)
                if val is not None:
                    manual_data["balance_sheet"][field_name] = {
                        "value": val, "unit": "SEK",
                        "source": {"page": 0, "field": field_name, "method": "user_input", "confidence": 1.0},
                    }
        if req.loans:
            manual_data["loans"] = req.loans
        if req.year_built:
            manual_data.setdefault("property_info", {})["year_built"] = {
                "value": req.year_built, "unit": "year",
                "source": {"page": 0, "field": "year_built", "method": "user_input", "confidence": 0.9},
            }
        if req.building_area_sqm:
            manual_data.setdefault("property_info", {})["building_area_sqm"] = {
                "value": req.building_area_sqm, "unit": "m²",
                "source": {"page": 0, "field": "building_area_sqm", "method": "user_input", "confidence": 0.9},
            }
        manual_data["fiscal_year"] = req.fiscal_year
        if req.number_of_apartments:
            manual_data.setdefault("apartment_metrics", {})["number_of_apartments"] = req.number_of_apartments
        if req.avg_monthly_fee is not None:
            manual_data.setdefault("apartment_metrics", {})["avg_monthly_fee"] = req.avg_monthly_fee

        extracted = profile_to_analysis_input(profile, manual_data)
    else:
        # Legacy mode: build from flat request fields
        brf_data = {
            "name": req.brf_name or "Okänd BRF",
            "organization_number": req.organization_number or "",
            "municipality": req.municipality or "",
            "number_of_apartments": req.number_of_apartments or 0,
        }

        report_data: dict[str, Any] = {
            "fiscal_year": req.fiscal_year,
            "income_statement": {},
            "balance_sheet": {},
            "apartment_metrics": {},
            "loans": [],
            "property_info": {},
        }

        for field_name in ["revenue", "operating_costs", "operating_profit",
                           "financial_income", "financial_costs",
                           "profit_before_tax", "profit_after_tax"]:
            val = getattr(req, field_name, None)
            if val is not None:
                report_data["income_statement"][field_name] = {
                    "value": val, "unit": "SEK",
                    "source": {"page": 0, "field": field_name, "method": "user_input", "confidence": 1.0},
                }

        for field_name in ["total_assets", "current_assets", "fixed_assets",
                           "total_equity", "total_liabilities",
                           "long_term_debt", "short_term_debt", "cash_and_bank"]:
            val = getattr(req, field_name, None)
            if val is not None:
                report_data["balance_sheet"][field_name] = {
                    "value": val, "unit": "SEK",
                    "source": {"page": 0, "field": field_name, "method": "user_input", "confidence": 1.0},
                }

        if req.number_of_apartments:
            report_data["apartment_metrics"]["number_of_apartments"] = {
                "value": req.number_of_apartments, "unit": "count",
                "source": {"page": 0, "field": "number_of_apartments", "method": "user_input", "confidence": 1.0},
            }
        if req.avg_monthly_fee is not None:
            report_data["apartment_metrics"]["avg_monthly_fee"] = {
                "value": req.avg_monthly_fee, "unit": "SEK/month",
                "source": {"page": 0, "field": "avg_monthly_fee", "method": "user_input", "confidence": 1.0},
            }

        if req.loans:
            report_data["loans"] = req.loans

        if req.year_built:
            report_data["property_info"]["year_built"] = {
                "value": req.year_built, "unit": "year",
                "source": {"page": 0, "field": "year_built", "method": "user_input", "confidence": 0.9},
            }
        if req.building_area_sqm:
            report_data["property_info"]["building_area_sqm"] = {
                "value": req.building_area_sqm, "unit": "m²",
                "source": {"page": 0, "field": "building_area_sqm", "method": "user_input", "confidence": 0.9},
            }

        extracted = {"brf": brf_data, "annual_reports": [report_data]}

    # Add required fields for report generator
    report_data_final = extracted["annual_reports"][0]
    report_data_final["pdf"] = {"path": "användarinmatning", "hash": "", "size_bytes": 0}
    report_data_final["extraction_confidence"] = 1.0

    # Run the pipeline
    try:
        metrics = calculate_metrics(report_data_final)
        reasoning = run_reasoning(metrics)
        report_text = generate_report(extracted, metrics, reasoning)
        return {"report": report_text}
    except Exception as e:
        logger.exception("Analysis failed")
        return JSONResponse(status_code=422, content={
            "success": False,
            "error": f"Analysen misslyckades: {e}",
            "details": type(e).__name__,
        })


@app.post("/api/brf-annual-report")
async def brf_annual_report(req: BrfAnnualReportRequest):
    """Hemnet URL -> BRF discovery -> annual report download -> PDF extraction,
    returning one fiscal year's verified annual-report JSON in the exact
    shape calculate_metrics() consumes (see BrfFinancialsRequest.annual_report).

    This is the acquisition half of the bridge the TypeScript
    brf_acquisition provider calls. It does no discovery, downloading, or
    PDF parsing of its own — it reuses ProfileEngine (same Hemnet + Booli +
    Allabrf + official-website resolution, PDF download, and extraction as
    /api/resolve) and BRFProfile.to_analysis_input(), the existing bridge
    method that converts a profile's extracted financials into the
    calculator's input shape.
    """
    engine = ProfileEngine(browser_fetch=_browser_fetch)

    try:
        profile = await engine.build(hemnet_url=req.hemnet_url)
    except Exception as e:
        logger.exception("BRF annual report acquisition failed")
        return JSONResponse(status_code=422, content={
            "success": False,
            "error": f"Kunde inte bygga BRF-profil: {e}",
            "details": type(e).__name__,
        })

    f = profile.financials
    if not (f.income_statement or f.balance_sheet):
        return JSONResponse(status_code=422, content={
            "success": False,
            "error": "Ingen årsredovisning kunde hittas eller tolkas för den här föreningen.",
        })

    return {
        "success": True,
        "annual_report": profile.to_analysis_input(),
        "brf": profile.to_brf_dict(),
    }


_BRF_UPLOAD_SUFFIXES = {"pdf": ".pdf", "docx": ".docx", "image": ".img"}


@app.post("/api/brf-annual-report/upload")
async def brf_annual_report_upload(req: BrfAnnualReportUploadRequest):
    """User-uploaded BRF annual report (PDF, Word doc, or a photo of a page)
    -> extraction, returning one fiscal year's verified annual-report JSON
    in the exact shape calculate_metrics() consumes (same output contract
    as /api/brf-annual-report above).

    This is the manual counterpart to /api/brf-annual-report: instead of
    discovering and downloading a report via ProfileEngine, the caller
    already has the file bytes (uploaded from the profile page). It reuses
    extract_annual_report() — the exact same field-extraction and
    validation pipeline ProfileEngine.build() calls internally — so a
    manually uploaded report is held to the identical verification bar
    (only HIGH-confidence, cross-validated fields ever reach the Decision
    Engine; see BRF-Scraper's extractor/validation.py) regardless of
    file_kind. No organization-number resolution happens here — the
    document text alone doesn't carry it — so the caller (the Next.js
    upload route) falls back to grouping reports by property when none is
    known.
    """
    import base64
    import tempfile

    from brf_scraper.extractor.engine import extract_annual_report

    if req.file_kind not in _BRF_UPLOAD_SUFFIXES:
        return JSONResponse(status_code=400, content={
            "success": False,
            "error": f"Unknown file_kind: {req.file_kind}",
        })

    try:
        file_bytes = base64.b64decode(req.pdf_base64)
    except Exception as e:
        return JSONResponse(status_code=400, content={
            "success": False,
            "error": f"pdf_base64 could not be decoded: {e}",
        })

    tmp_path = None
    try:
        suffix = _BRF_UPLOAD_SUFFIXES[req.file_kind]
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as f:
            f.write(file_bytes)
            tmp_path = f.name

        result = extract_annual_report(tmp_path, file_kind=req.file_kind)
    except Exception as e:
        logger.exception("BRF annual report upload extraction failed")
        return JSONResponse(status_code=422, content={
            "success": False,
            "error": f"Kunde inte tolka filen: {e}",
        })
    finally:
        if tmp_path:
            Path(tmp_path).unlink(missing_ok=True)

    if not result.is_text_based:
        message = (
            "PDF-filen verkar vara en inskannad bild och kunde inte textextraheras."
            if req.file_kind == "pdf"
            else "Kunde inte läsa någon text ur den här filen."
        )
        return JSONResponse(status_code=422, content={
            "success": False,
            "error": message,
        })

    # to_profile_financials() already returns the single-fiscal-year shape
    # calculate_metrics() consumes directly (fiscal_year at the top level —
    # see BRFProfile.to_analysis_input(), which brf_annual_report() above
    # returns for the crawl-based path; this is its manual-upload
    # equivalent, same output contract).
    financials = result.to_profile_financials()
    return {
        "success": True,
        "annual_report": financials,
        "fiscal_year": result.fiscal_year,
        "verification_status": financials["verification_status"],
    }


_MAX_OCR_IMAGES = 6


@app.post("/api/ocr/extract-text")
async def ocr_extract_text(req: OcrExtractRequest):
    """Pure OCR: image bytes in, raw text out — no domain-specific parsing.

    Backs the Next.js listing-screenshot upload flow; the frontend parses
    the returned text into property fields itself (see
    lib/analysis/listing/screenshotExtract.ts), mirroring the existing
    "OCR extracts text, application code interprets it" split already used
    for BRF documents. Shares the same Tesseract path
    (extractor/ocr.py:ocr_image) as scanned-PDF-page and BRF-photo
    extraction. Images are decoded in memory only — nothing here is ever
    written to disk or any storage.
    """
    import base64
    import io

    from PIL import Image

    from brf_scraper.extractor.ocr import ocr_image

    if len(req.images_base64) == 0:
        return JSONResponse(status_code=400, content={"success": False, "error": "No images provided."})
    if len(req.images_base64) > _MAX_OCR_IMAGES:
        return JSONResponse(status_code=400, content={
            "success": False,
            "error": f"Too many images (max {_MAX_OCR_IMAGES}).",
        })

    texts: list[str] = []
    for i, b64 in enumerate(req.images_base64):
        try:
            image_bytes = base64.b64decode(b64)
            with Image.open(io.BytesIO(image_bytes)) as image:
                texts.append(ocr_image(image))
        except Exception as e:
            logger.warning("ocr_extract_text image failed: index=%s error=%s", i, e)
            texts.append("")

    return {"success": True, "texts": texts}


@app.post("/api/brf-financials")
def brf_financials(req: BrfFinancialsRequest):
    """Run the calculator/reasoning library on one BRF annual report and
    return the result as structured JSON.

    Structured-JSON counterpart to /api/analyze (which renders the Swedish
    customer-facing report text via report.py). This endpoint calls the same
    two library functions — calculate_metrics(), run_reasoning() — and
    returns their output as data instead of prose, for the TypeScript
    Decision Engine's Housing Association analyzer to score as one factor
    among several. Neither endpoint computes anything the other doesn't;
    report.py is not called here, so there is still exactly one place BRF
    financial reasoning happens and exactly one place it's rendered as a
    customer-facing report.
    """
    try:
        metrics = calculate_metrics(req.annual_report)
        reasoning = run_reasoning(metrics)

        # Graceful degradation for the TS Decision Engine: it must be able
        # to tell "no annual report" (not_connected, decided client-side in
        # brfFinancials.ts before this endpoint is ever called) apart from
        # "we had a report but nothing in it was trustworthy enough to
        # score" (insufficient_verified_data). Never fabricate a verdict
        # from zero signals. `verification_status` is set upstream by
        # BRFProfile.to_analysis_input() / extract_annual_report(); its
        # absence (raw/manual callers) falls back to checking whether any
        # signal actually got computed.
        upstream_status = req.annual_report.get("verification_status")
        if upstream_status == "insufficient_verified_data" or not reasoning.signals:
            status = "insufficient_verified_data"
        else:
            status = "ok"

        return {
            "success": True,
            "status": status,
            "engine_version": ANALYSIS_ENGINE_VERSION,
            "metrics": metrics_to_dict(metrics),
            "reasoning": reasoning_to_dict(reasoning),
        }
    except Exception as e:
        logger.exception("BRF financial analysis failed")
        return JSONResponse(status_code=422, content={
            "success": False,
            "error": f"Analysen misslyckades: {e}",
            "details": type(e).__name__,
        })


@app.post("/api/location-intelligence")
def location_intelligence(req: LocationIntelligenceRequest):
    """Collect a Location Intelligence Package for one property.

    Mirrors location_intelligence/__main__.py's CLI exactly (same
    context/config/runner/builder call chain) — this is the first live
    caller of that package outside its own CLI and tests.
    """
    if req.latitude is not None and req.longitude is not None:
        raw_input = f"{req.latitude},{req.longitude}"
    elif req.address:
        raw_input = req.address
    else:
        return JSONResponse(status_code=422, content={
            "success": False,
            "error": "Provide either an address or latitude+longitude.",
        })

    try:
        config = LIEngineConfig.from_env()
        context = context_from_raw_input(raw_input)
        cache = LIProviderCache(config.cache_dir)
        runner = LIEngineRunner(li_default_registry(), config, cache=cache)
        enriched_context, runs = runner.run(context)
        package = LIPackageBuilder().build(enriched_context, runs)
        return {"success": True, "package": package.to_dict()}
    except Exception as e:
        logger.exception("Location intelligence collection failed")
        return JSONResponse(status_code=500, content={
            "success": False,
            "error": str(e),
            "details": type(e).__name__,
        })


@app.post("/api/market-intelligence")
def market_intelligence(req: MarketIntelligenceRequest):
    """Collect a Market Intelligence Package for a geographic scope.

    Mirrors market_intelligence/__main__.py's CLI exactly.
    """
    if not any([req.country, req.region, req.county, req.municipality, req.postal_code]):
        return JSONResponse(status_code=422, content={
            "success": False,
            "error": "Provide at least one of country/region/county/municipality/postal_code.",
        })

    try:
        config = MIEngineConfig.from_env()
        context = MarketContext(
            country=req.country,
            region=req.region,
            county=req.county,
            municipality=req.municipality,
            postal_code=req.postal_code,
            as_of=req.as_of,
        )
        cache = MIProviderCache(config.cache_dir)
        runner = MIEngineRunner(mi_default_registry(), config, cache=cache)
        runs = runner.run(context)
        package = MIPackageBuilder().build(context, runs)
        return {"success": True, "package": package.to_dict()}
    except Exception as e:
        logger.exception("Market intelligence collection failed")
        return JSONResponse(status_code=500, content={
            "success": False,
            "error": str(e),
            "details": type(e).__name__,
        })


@app.get("/", response_class=HTMLResponse)
async def index():
    """Serve the frontend."""
    html_path = Path(__file__).parent / "static" / "index.html"
    return HTMLResponse(html_path.read_text(encoding="utf-8"))
