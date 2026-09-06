"""Köpanalys API — FastAPI server for BRF analysis.

Endpoints:
  POST /api/resolve   — Hemnet URL → unified BRF profile (Hemnet + Booli + Allabrf)
  POST /api/analyze   — Financial data + BRF metadata → Köpanalys report
  GET  /              — Frontend UI
"""

from __future__ import annotations

import asyncio
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
# requests (this endpoint, /api/resolve, /api/brf-annual-report, and the
# broker-documents Hemnet-blocked fallback all call this) could add up to
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


class BrokerDocumentsRequest(BaseModel):
    hemnet_url: str


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


@app.post("/api/brf-annual-report/upload")
async def brf_annual_report_upload(req: BrfAnnualReportUploadRequest):
    """User-uploaded BRF annual report PDF -> PDF extraction, returning one
    fiscal year's verified annual-report JSON in the exact shape
    calculate_metrics() consumes (same output contract as
    /api/brf-annual-report above).

    This is the manual counterpart to /api/brf-annual-report: instead of
    discovering and downloading a report via ProfileEngine, the caller
    already has the PDF bytes (uploaded from the profile page). It reuses
    extract_annual_report() — the exact same PDF-reading, field-extraction
    and validation pipeline ProfileEngine.build() calls internally — so a
    manually uploaded report is held to the identical verification bar
    (only HIGH-confidence, cross-validated fields ever reach the Decision
    Engine; see BRF-Scraper's extractor/validation.py) as one found by the
    automated crawler. No organization-number resolution happens here — the
    PDF text alone doesn't carry it — so the caller (the Next.js upload
    route) falls back to grouping reports by property when none is known.
    """
    import base64
    import tempfile

    from brf_scraper.extractor.engine import extract_annual_report

    try:
        pdf_bytes = base64.b64decode(req.pdf_base64)
    except Exception as e:
        return JSONResponse(status_code=400, content={
            "success": False,
            "error": f"pdf_base64 could not be decoded: {e}",
        })

    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
            f.write(pdf_bytes)
            tmp_path = f.name

        result = extract_annual_report(tmp_path)
    except Exception as e:
        logger.exception("BRF annual report upload extraction failed")
        return JSONResponse(status_code=422, content={
            "success": False,
            "error": f"Kunde inte tolka PDF-filen: {e}",
        })
    finally:
        if tmp_path:
            Path(tmp_path).unlink(missing_ok=True)

    if not result.is_text_based:
        return JSONResponse(status_code=422, content={
            "success": False,
            "error": "PDF-filen verkar vara en inskannad bild och kunde inte textextraheras.",
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


_MAX_BROKER_DOCUMENTS = 8
_MAX_BASE64_BYTES = 15 * 1024 * 1024  # 15MB — larger files link out instead of embedding


async def _fetch_hemnet_html_for_broker_link(url: str) -> str:
    """Same httpx-first/browser-fallback pattern as HemnetProvider._fetch_html,
    duplicated locally to keep this endpoint self-contained rather than
    routing a whole ProfileEngine build just to get one page's HTML."""
    import httpx

    try:
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            response = await client.get(url, headers={"User-Agent": "Mozilla/5.0"})
            if response.status_code in (403, 429, 503):
                logger.warning("Hemnet HTTP blocked (status %s), escalating to browser: %s", response.status_code, url)
                return await _browser_fetch(url)
            response.raise_for_status()
            return response.text
    except httpx.HTTPError:
        logger.warning("Hemnet HTTP error, escalating to browser: %s", url)
        return await _browser_fetch(url)


@app.post("/api/broker-documents")
async def broker_documents(req: BrokerDocumentsRequest):
    """Hemnet URL -> broker's own website -> discover and download documents
    published there (annual reports, bylaws, energy declarations, inspection
    protocols), distinct from /api/brf-annual-report's allabrf.se-based
    discovery. Annual reports are run through the same extract_annual_report()
    pipeline as every other acquisition path; inspection protocols are run
    through extract_inspection_findings() (OPENAI_API_KEY required — degrades
    to inspection_findings.extraction_confidence == 0.0 with an explanatory
    summary if unset or the OpenAI call fails, never raises).
    """
    import base64
    import hashlib
    import tempfile

    from brf_scraper.broker_discovery.broker_link import find_broker_link_in_html
    from brf_scraper.broker_discovery.engine import BrokerDiscoveryEngine
    from brf_scraper.broker_discovery.models import BrokerDocumentType
    from brf_scraper.downloader.downloader import Downloader
    from brf_scraper.extractor.engine import extract_annual_report
    from brf_scraper.extractor.inspection_extractor import extract_inspection_findings

    try:
        html = await _fetch_hemnet_html_for_broker_link(req.hemnet_url)
    except Exception as e:
        logger.exception("Broker documents: could not fetch Hemnet listing")
        return JSONResponse(status_code=422, content={
            "success": False,
            "error": f"Kunde inte hämta Hemnet-annonsen: {e}",
        })

    broker_url = find_broker_link_in_html(html, req.hemnet_url)
    if not broker_url:
        return JSONResponse(status_code=422, content={
            "success": False,
            "error": "Kunde inte hitta mäklarlänk på Hemnet-annonsen.",
        })

    discovery = await BrokerDiscoveryEngine().discover_documents(req.hemnet_url, broker_url)

    documents: list[dict[str, Any]] = []
    errors: list[str] = list(discovery.errors)

    downloader = Downloader()
    await downloader.initialize()
    try:
        for doc in discovery.documents[:_MAX_BROKER_DOCUMENTS]:
            try:
                content = await downloader.download_bytes(doc.url)
            except Exception as e:
                errors.append(f"{doc.url}: download failed: {e}")
                continue

            content_hash = hashlib.sha256(content).hexdigest()
            entry: dict[str, Any] = {
                "doc_type": doc.doc_type.value,
                "filename": doc.guessed_filename,
                "source_url": doc.url,
                "content_hash": content_hash,
                "size_bytes": len(content),
                "mime_type": "application/pdf" if doc.guessed_filename.lower().endswith(".pdf") else "application/octet-stream",
                "annual_report": None,
                "inspection_findings": None,
            }

            if len(content) <= _MAX_BASE64_BYTES:
                entry["content_base64"] = base64.b64encode(content).decode("ascii")
            else:
                entry["content_base64"] = None
                errors.append(f"{doc.url}: {len(content)} bytes exceeds base64 inline limit, source_url only")

            if doc.doc_type == BrokerDocumentType.ANNUAL_REPORT:
                tmp_path = None
                try:
                    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
                        f.write(content)
                        tmp_path = f.name
                    extraction = extract_annual_report(tmp_path)
                    if extraction.is_text_based:
                        entry["annual_report"] = extraction.to_profile_financials()
                except Exception as e:
                    errors.append(f"{doc.url}: annual report extraction failed: {e}")
                finally:
                    if tmp_path:
                        Path(tmp_path).unlink(missing_ok=True)

            if doc.doc_type == BrokerDocumentType.INSPECTION_REPORT:
                tmp_path = None
                try:
                    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
                        f.write(content)
                        tmp_path = f.name
                    findings = extract_inspection_findings(tmp_path)
                    entry["inspection_findings"] = findings.model_dump(mode="json")
                    if findings.extraction_confidence <= 0.0:
                        errors.append(f"{doc.url}: inspection interpretation returned no result — {findings.summary}")
                except Exception as e:
                    errors.append(f"{doc.url}: inspection interpretation failed: {e}")
                finally:
                    if tmp_path:
                        Path(tmp_path).unlink(missing_ok=True)

            documents.append(entry)
    finally:
        await downloader.close()

    return {
        "success": True,
        "broker_url": broker_url,
        "provider_used": discovery.provider_used,
        "documents": documents,
        "errors": errors,
    }


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
