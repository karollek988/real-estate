"""Broker-site document discovery engine.

Opens the broker's own listing page (found via broker_link.py) and scans it
for document links — annual reports, bylaws, energy declarations,
inspection protocols. Unlike browser/camoufox_provider.py's fetch(), which
is a one-shot string-in/string-out HTML fetch, this needs a live Page to
click document tabs and "visa fler" buttons before scanning, so it opens
its own browser session rather than going through BrowserManager.

Camoufox-first, escalating fallback (see PROJECT plan for the full
reasoning): headless Camoufox is already proven in production against
Hemnet's own Cloudflare protection (api/server.py::_browser_fetch), but has
not been validated against arbitrary broker domains, which is exactly what
this fallback chain — and its `provider_used` logging — is designed to
surface empirically over real traffic.
"""

from __future__ import annotations

import os
import re
from urllib.parse import urljoin

from brf_scraper.broker_discovery.heuristics import (
    DOC_EXTENSIONS,
    SHOW_MORE_TEXTS,
    TAB_TEXTS,
    classify_document,
    guess_filename_from_url,
    looks_like_document,
)
from brf_scraper.broker_discovery.models import BrokerDiscoveryResult, DiscoveredDocument
from brf_scraper.utils.logging import get_logger

logger = get_logger(__name__)

_NAV_TIMEOUT_MS = 30_000

# Signals that we hit a bot-detection challenge page rather than the real
# broker site — checked on both navigation failure and a "successful" load
# that's actually a challenge page in disguise.
_BOT_CHALLENGE_MARKERS = (
    "checking your browser",
    "cf-browser-verification",
    "attention required",
    "just a moment",
    "access denied",
    "verifying you are human",
)

# Never attempt a headed (non-headless) browser session outside local
# development — Railway's container has no display server (Xvfb), so
# headless=False would hard-fail there, not gracefully degrade.
_ON_RAILWAY = bool(os.environ.get("RAILWAY_ENVIRONMENT"))


def _looks_like_challenge(html: str) -> bool:
    lowered = html.lower()
    return len(html.strip()) < 200 or any(marker in lowered for marker in _BOT_CHALLENGE_MARKERS)


async def _click_tabs(page) -> None:
    for text in TAB_TEXTS:
        try:
            locator = page.get_by_text(text, exact=True)
            if await locator.count() > 0:
                await locator.first.click(timeout=2000)
                await page.wait_for_timeout(1500)
                logger.info("broker_discovery_clicked_tab", text=text)
        except Exception:
            pass


async def _click_show_more_buttons(page) -> None:
    for text in SHOW_MORE_TEXTS:
        try:
            locator = page.get_by_text(re.compile(text, re.IGNORECASE))
            count = await locator.count()
            for i in range(min(count, 5)):
                try:
                    await locator.nth(i).click(timeout=2000)
                    await page.wait_for_timeout(1000)
                    logger.info("broker_discovery_clicked_show_more", text=text, index=i)
                except Exception:
                    pass
        except Exception:
            pass


async def _collect_document_links(page, base_url: str) -> list[DiscoveredDocument]:
    found: dict[str, DiscoveredDocument] = {}

    anchors = await page.query_selector_all("a")
    for a in anchors:
        try:
            href = await a.get_attribute("href")
            text = await a.inner_text()
        except Exception:
            continue
        if not href:
            continue
        full_url = urljoin(base_url, href)
        if looks_like_document(full_url, text) and full_url not in found:
            link_text = text.strip() or guess_filename_from_url(full_url)
            found[full_url] = DiscoveredDocument(
                url=full_url,
                link_text=link_text,
                doc_type=classify_document(full_url, link_text),
                guessed_filename=guess_filename_from_url(full_url),
            )

    # Also scan the raw HTML for document-shaped URLs embedded in JS/data
    # (e.g. XHR-populated document lists) that never became a plain <a>.
    try:
        html = await page.content()
        for url in re.findall(r'https?://[^\s"\'<>]+', html):
            if url.lower().endswith(DOC_EXTENSIONS) and url not in found:
                found[url] = DiscoveredDocument(
                    url=url,
                    link_text=guess_filename_from_url(url),
                    doc_type=classify_document(url, ""),
                    guessed_filename=guess_filename_from_url(url),
                )
    except Exception:
        pass

    return list(found.values())


async def _run_discovery_session(broker_url: str, *, headless: bool) -> tuple[list[DiscoveredDocument] | None, str | None]:
    """Run one full discovery attempt with a given headless setting.

    Returns (documents, error) — documents is None (not just empty) if the
    session itself failed to reach a usable page, so the caller can tell
    "reached the page, found nothing" apart from "never got a real page".
    """
    from camoufox.async_api import AsyncCamoufox

    async with AsyncCamoufox(headless=headless) as browser:
        page = await browser.new_page()
        try:
            await page.goto(broker_url, wait_until="load", timeout=_NAV_TIMEOUT_MS)
            try:
                await page.wait_for_load_state("networkidle", timeout=5000)
            except Exception:
                pass

            html = await page.content()
            if _looks_like_challenge(html):
                return None, "bot_challenge_detected"

            await _click_tabs(page)
            await _click_show_more_buttons(page)
            documents = await _collect_document_links(page, page.url)
            return documents, None
        except Exception as e:
            return None, str(e)
        finally:
            await page.close()


async def _run_playwright_headed_session(broker_url: str) -> tuple[list[DiscoveredDocument] | None, str | None]:
    """Last-resort fallback matching the PoC exactly: vanilla Playwright
    Chromium, headless=False. Local development only — see _ON_RAILWAY."""
    from playwright.async_api import async_playwright

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        try:
            context = await browser.new_context(locale="sv-SE", viewport={"width": 1280, "height": 900})
            page = await context.new_page()
            try:
                await page.goto(broker_url, wait_until="domcontentloaded", timeout=_NAV_TIMEOUT_MS)
                await page.wait_for_timeout(2000)
                await _click_tabs(page)
                await _click_show_more_buttons(page)
                documents = await _collect_document_links(page, page.url)
                return documents, None
            except Exception as e:
                return None, str(e)
            finally:
                await page.close()
        finally:
            await browser.close()


class BrokerDiscoveryEngine:
    """Discovers documents on a broker's own listing page."""

    async def discover_documents(self, hemnet_url: str, broker_url: str) -> BrokerDiscoveryResult:
        result = BrokerDiscoveryResult(hemnet_url=hemnet_url, broker_url=broker_url)

        # 1. Headless Camoufox — proven against Hemnet's own Cloudflare in
        #    production; try it first everywhere, Railway included.
        documents, error = await _run_discovery_session(broker_url, headless=True)
        if documents is not None:
            result.documents = documents
            result.provider_used = "camoufox"
            logger.info("broker_discovery_done", broker_url=broker_url, provider="camoufox", count=len(documents))
            return result
        result.errors.append(f"camoufox (headless): {error}")

        # 2. Headed Camoufox — cheap to try before reaching for a second
        #    browser stack; closer to the PoC's proven "headed beats
        #    detection" finding without adding vanilla Playwright yet.
        documents, error = await _run_discovery_session(broker_url, headless=False)
        if documents is not None:
            result.documents = documents
            result.provider_used = "camoufox_headed"
            logger.info("broker_discovery_done", broker_url=broker_url, provider="camoufox_headed", count=len(documents))
            return result
        result.errors.append(f"camoufox (headed): {error}")

        # 3. Vanilla Playwright, headless=False — the PoC's exact approach.
        #    Local development only: Railway's container has no display
        #    server, so this would hard-fail there rather than degrade.
        if _ON_RAILWAY:
            result.errors.append("playwright (headed): skipped — no display server on Railway")
            logger.warning("broker_discovery_failed", broker_url=broker_url, reason="all_providers_exhausted_on_railway")
            return result

        documents, error = await _run_playwright_headed_session(broker_url)
        if documents is not None:
            result.documents = documents
            result.provider_used = "playwright_headed"
            logger.info("broker_discovery_done", broker_url=broker_url, provider="playwright_headed", count=len(documents))
            return result
        result.errors.append(f"playwright (headed): {error}")

        logger.warning("broker_discovery_failed", broker_url=broker_url, errors=result.errors)
        return result
