"""Finds the broker's own website link on a Hemnet listing page.

BeautifulSoup port of the PoC's find_hemnet_broker_link() (Scraping-test/
scrape.py), which used live Playwright locators — static-HTML parsing is
sufficient here since the Hemnet page is already fetched as a string
(_browser_fetch()/HemnetProvider), and no interaction is needed to find
this one link.
"""

from __future__ import annotations

import re
from urllib.parse import urljoin

from bs4 import BeautifulSoup

from brf_scraper.utils.logging import get_logger

logger = get_logger(__name__)

# Common Hemnet phrasings for the link to the broker's own listing page.
_CANDIDATE_PHRASES = [
    "Läs mer hos mäklaren",
    "Gå till mäklarens hemsida",
    "Besök mäklarens hemsida",
    "mäklarens hemsida",
]


def find_broker_link_in_html(html: str, base_url: str) -> str | None:
    """Return the broker's own website URL linked from a Hemnet listing
    page, or None if no such link could be found."""
    soup = BeautifulSoup(html, "lxml")

    for phrase in _CANDIDATE_PHRASES:
        pattern = re.compile(re.escape(phrase), re.IGNORECASE)
        match = soup.find(string=pattern)
        if not match:
            continue

        el = match.parent
        anchor = el if el.name == "a" else el.find_parent("a")
        if anchor and anchor.get("href"):
            resolved = urljoin(base_url, anchor["href"])
            logger.info("broker_link_found", phrase=phrase, url=resolved)
            return resolved

    # Fallback: any <a> whose own text mentions "mäklare" together with a
    # "read more" / "go to" / "website" cue, mirroring the PoC's fallback.
    for anchor in soup.find_all("a", href=True):
        text = anchor.get_text(strip=True).lower()
        if "mäklare" in text and any(cue in text for cue in ("läs mer", "hemsida", "gå till")):
            resolved = urljoin(base_url, anchor["href"])
            logger.info("broker_link_found_fallback", url=resolved)
            return resolved

    logger.info("broker_link_not_found", hemnet_url=base_url)
    return None
