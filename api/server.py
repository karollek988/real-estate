"""Köpanalys API — FastAPI server for the Python engine.

Endpoints (all require the shared X-Internal-Secret header except GET /):
  POST /api/brf-annual-report/upload — buyer-uploaded BRF annual report (PDF/Word/photo) -> verified figures
  POST /api/brf-financials           — verified figures -> metrics + rule-based findings
  POST /api/ocr/extract-text         — listing screenshots -> raw text (Tesseract)
  POST /api/translate                — texts of the site's own content, Swedish -> another language (offline model)
  POST /api/location-intelligence    — area data for an address
  POST /api/market-intelligence      — market data for a municipality
  POST /api/browser-fetch            — fetch one page through a real browser (Hemnet escalation)
  GET  /                             — health check (Railway)

There is NO endpoint that finds or downloads a BRF annual report: the buyer
uploads it. The old Hemnet-URL -> BRF-profile -> report pipeline
(/api/resolve, /api/brf-annual-report, /api/analyze) was removed on 2026-10-02;
see git tag archive/brf-automation-2026-10-02.
"""

from __future__ import annotations

import asyncio
import hmac
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
from serialize import metrics_to_dict, reasoning_to_dict

# Add BRF-Scraper src to path (the extractor package: PDF/Word/photo -> verified figures, OCR)
_scraper_src = Path(__file__).resolve().parent.parent / "BRF-Scraper" / "src"
if str(_scraper_src) not in sys.path:
    sys.path.insert(0, str(_scraper_src))

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
# requests (at the time of this outage /api/browser-fetch, /api/resolve,
# /api/brf-annual-report and the since-removed broker-documents fallback
# all launched browsers; only /api/browser-fetch remains) could add up to
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

# "/" serves only a static health page (no data, no cost) and is Railway's
# health-check target — authenticating it risks a correctly-configured
# deployment being marked unhealthy by the platform.
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


class BrfFinancialsRequest(BaseModel):
    # One fiscal year's verified annual-report JSON, in the shape
    # calculate_metrics() consumes directly (see
    # analysis_engine/sample_annual_report.json's annual_reports[0]).
    annual_report: dict[str, Any]


class BrfAnnualReportUploadRequest(BaseModel):
    pdf_base64: str
    filename: str | None = None
    # "pdf" (default, backward compatible) | "docx" | "image"
    file_kind: str = "pdf"


class OcrExtractRequest(BaseModel):
    images_base64: list[str]


# Limits of one translation request: an article is a few thousand words, a hub page's cards a few dozen
# short texts. Bigger than this is a mistake or abuse.
_MAX_TRANSLATE_TEXTS = 300
_MAX_TRANSLATE_CHARS = 120_000


class TranslateRequest(BaseModel):
    texts: list[str]
    source: str = "sv"
    target: str


# ── Routes ──────────────────────────────────────────────────────────

@app.post("/api/browser-fetch")
async def browser_fetch(req: BrowserFetchRequest):
    """Fetch one URL with Camoufox (real Firefox) to bypass bot detection.

    Lets a TypeScript fetch path that gets bot-blocked (today only
    lib/analysis/listing/hemnetPage.ts, against Hemnet's Cloudflare
    protection) escalate to a real browser without this engine needing its
    own HTML-extraction logic — the caller parses the returned HTML itself.
    Not used for BRF reports (those are uploaded, not fetched).
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


_BRF_UPLOAD_SUFFIXES = {"pdf": ".pdf", "docx": ".docx", "image": ".img"}


@app.post("/api/brf-annual-report/upload")
async def brf_annual_report_upload(req: BrfAnnualReportUploadRequest):
    """User-uploaded BRF annual report (PDF, Word doc, or a photo of a page)
    -> extraction, returning one fiscal year's verified annual-report JSON
    in the exact shape calculate_metrics() consumes.

    This is the only way BRF figures get into the product: nothing finds or
    downloads a report automatically any more. The caller (the Next.js
    upload route) already has the file bytes. extract_annual_report() holds
    the result to a verification bar — only HIGH-confidence, cross-validated
    fields ever reach the report (see BRF-Scraper's
    extractor/validation.py) regardless of file_kind. No
    organization-number resolution happens here — the document text alone
    doesn't carry it — so the caller falls back to grouping reports by
    property when none is known.
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
    # calculate_metrics() consumes directly (fiscal_year at the top level).
    financials = result.to_profile_financials()
    return {
        "success": True,
        "annual_report": financials,
        "fiscal_year": result.fiscal_year,
        "verification_status": financials["verification_status"],
        # The mandatory key figures as printed in the report — a prefill for
        # the person who reviews the BRF analysis before a customer sees it
        # (extractor/key_figures.py; frontend/src/lib/brf/reviews.ts).
        "key_figures": result.key_figures,
    }


_MAX_OCR_IMAGES = 6


@app.post("/api/translate")
async def translate_texts(req: TranslateRequest):
    """Translates the site's own content (articles, listing texts) with an offline, open-source model.

    Backs frontend/src/lib/translate: the Next.js app asks for a translation the first time a page is read in
    another language and stores the answer in its own database, so each text is translated once. Nothing is kept
    here and nothing leaves this server. 503 when the model for the pair is not installed - the caller then
    shows the Swedish text. Markers like [1]...[/1] around formatting come back in place.
    """
    import translation

    if not req.texts:
        return {"success": True, "translations": [], "engine": translation.ENGINE_VERSION}
    if len(req.texts) > _MAX_TRANSLATE_TEXTS or sum(len(t) for t in req.texts) > _MAX_TRANSLATE_CHARS:
        return JSONResponse(status_code=413, content={"success": False, "error": "Too much text in one request."})
    if (req.source, req.target) not in translation.MODEL_FOLDERS:
        return JSONResponse(status_code=400, content={
            "success": False,
            "error": f"No translation from {req.source} to {req.target}.",
        })

    try:
        # The model is CPU-bound: run it off the event loop so the other endpoints keep answering.
        translations = await asyncio.to_thread(translation.translate, req.texts, req.source, req.target)
    except translation.ModelUnavailable as e:
        logger.warning("Translation unavailable: %s", e)
        return JSONResponse(status_code=503, content={"success": False, "error": str(e)})
    except Exception as e:
        logger.exception("Translation failed")
        return JSONResponse(status_code=500, content={"success": False, "error": f"Translation failed: {type(e).__name__}"})
    return {"success": True, "translations": translations, "engine": translation.ENGINE_VERSION}


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

    Calls calculate_metrics() and run_reasoning() and returns their output
    as data, for the TypeScript report builder's BRF chapter (the metrics and
    the rule-based strengths/weaknesses). Those two functions remain the only
    place BRF financial reasoning happens; the Swedish report text is written
    by frontend/src/lib/report/build.ts.
    """
    try:
        metrics = calculate_metrics(req.annual_report)
        reasoning = run_reasoning(metrics)

        # Graceful degradation for the TS report builder: it must be able
        # to tell "no annual report" (not_connected, decided client-side in
        # brfFinancials.ts before this endpoint is ever called) apart from
        # "we had a report but nothing in it was trustworthy enough to
        # use" (insufficient_verified_data). Never fabricate a conclusion
        # from zero signals. `verification_status` is set upstream by
        # extract_annual_report(); its absence (raw/manual callers) falls
        # back to checking whether any signal actually got computed.
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
    """Health check (Railway's health-check target). No data, no cost."""
    return HTMLResponse(
        "<!doctype html><html lang=\"sv\"><head><meta charset=\"utf-8\">"
        "<title>Köpanalys engine</title></head>"
        "<body><p>Köpanalys engine — OK</p></body></html>"
    )
