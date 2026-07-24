"""Official BRF website scraper.

Extracts annual reports, statutes, board info, contacts, and maintenance
information from the BRF's official website.

Keeps it simple: look for common Swedish BRF website patterns.
"""

from __future__ import annotations

import re
from typing import Any

from bs4 import BeautifulSoup

from brf_scraper.utils.logging import get_logger

logger = get_logger(__name__)

# Common Swedish BRF terms for section detection
_ANNUAL_REPORT_TERMS = ["arsredovisning", "årsredovisning", "rsredovisning", "annual report"]
_STATUTE_TERMS = ["stadgar", "bylaws", "statutes"]
_BOARD_TERMS = ["styrelse", "board", "ordforande", "ordförande"]
_CONTACT_TERMS = ["kontakt", "contact", "styrelsen"]
_MAINTENANCE_TERMS = ["underhall", "underhåll", "maintenance", "plan"]


class OfficialBRFData:
    """Data extracted from an official BRF website."""

    def __init__(self, url: str) -> None:
        self.url = url
        self.annual_reports: list[dict[str, Any]] = []
        self.statutes: list[dict[str, Any]] = []
        self.board_members: list[dict[str, str]] = []
        self.contacts: list[dict[str, str]] = []
        self.maintenance_notes: list[str] = []
        self.raw_text: str = ""


def scrape_official_website(html: str, base_url: str) -> OfficialBRFData:
    """Scrape an official BRF website for useful data.

    Args:
        html: The HTML content of the website.
        base_url: The base URL of the website (for resolving relative links).

    Returns:
        OfficialBRFData with extracted information.
    """
    soup = BeautifulSoup(html, "lxml")
    data = OfficialBRFData(base_url)
    data.raw_text = soup.get_text(" ", strip=True)[:5000]

    # Remove script/style tags
    for tag in soup(["script", "style", "noscript"]):
        tag.decompose()

    # Find all links
    links = soup.find_all("a", href=True)

    for link in links:
        href = link.get("href", "")
        text = link.get_text(strip=True).lower()
        full_text = link.get_text(strip=True)

        # Resolve relative URLs
        if href.startswith("/") and base_url:
            href = base_url.rstrip("/") + href

        # Annual reports (PDF links)
        if any(term in text for term in _ANNUAL_REPORT_TERMS) or \
           (href.endswith(".pdf") and any(term in text for term in ["redovisning", "rapport", "rs"])):
            year_match = re.search(r"(20\d{2}|19\d{2})", full_text)
            data.annual_reports.append({
                "title": full_text,
                "url": href,
                "year": int(year_match.group(1)) if year_match else None,
            })

        # Statutes
        if any(term in text for term in _STATUTE_TERMS):
            data.statutes.append({
                "title": full_text,
                "url": href,
            })

        # Email links
        if href.startswith("mailto:"):
            email = href.replace("mailto:", "").split("?")[0]
            data.contacts.append({
                "type": "email",
                "value": email,
                "context": full_text,
            })

        # Phone links
        if href.startswith("tel:"):
            phone = href.replace("tel:", "")
            data.contacts.append({
                "type": "phone",
                "value": phone,
                "context": full_text,
            })

    # Look for board information in text
    page_text = soup.get_text("\n", strip=True)
    lines = page_text.split("\n")

    in_board_section = False
    for i, line in enumerate(lines):
        line_lower = line.strip().lower()

        # Detect board section
        if any(term in line_lower for term in _BOARD_TERMS):
            in_board_section = True
            continue

        if in_board_section:
            # Stop at next section
            if line.strip() and not any(c.isalpha() for c in line):
                in_board_section = False
                continue

            # Look for role + name patterns
            role_match = re.search(
                r"(ordförande|viceordförande|kassör|sekreterare|styrelseledamot|revisor|suppleant)[:\s]*(.+)",
                line.strip(),
                re.IGNORECASE,
            )
            if role_match:
                data.board_members.append({
                    "role": role_match.group(1).strip(),
                    "name": role_match.group(2).strip(),
                })

    # Look for contact section
    in_contact_section = False
    for line in lines:
        line_lower = line.strip().lower()
        if any(term in line_lower for term in _CONTACT_TERMS):
            in_contact_section = True
            continue
        if in_contact_section and line.strip():
            # Look for email patterns
            email_match = re.search(r"[\w.-]+@[\w.-]+\.\w+", line)
            if email_match:
                data.contacts.append({
                    "type": "email",
                    "value": email_match.group(0),
                    "context": line.strip(),
                })

    logger.info(
        "official_website_scraped",
        url=base_url,
        annual_reports=len(data.annual_reports),
        statutes=len(data.statutes),
        board=len(data.board_members),
        contacts=len(data.contacts),
    )

    return data
