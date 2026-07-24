"""URL utilities for the BRF Scraper."""

from __future__ import annotations

from urllib.parse import urljoin, urlparse, urlunparse


def normalize_url(url: str) -> str:
    """Normalize a URL by removing fragments and normalizing path.

    Args:
        url: The URL to normalize.

    Returns:
        Normalized URL string.
    """
    parsed = urlparse(url)
    # Remove fragment, normalize path
    path = parsed.path.rstrip("/") or "/"
    return urlunparse(
        (
            parsed.scheme,
            parsed.netloc,
            path,
            parsed.params,
            parsed.query,
            "",  # Remove fragment
        )
    )


def is_same_domain(url1: str, url2: str) -> bool:
    """Check if two URLs are from the same domain.

    Args:
        url1: First URL.
        url2: Second URL.

    Returns:
        True if both URLs are from the same domain.
    """
    parsed1 = urlparse(url1)
    parsed2 = urlparse(url2)
    return parsed1.netloc == parsed2.netloc


def resolve_url(base_url: str, relative_url: str) -> str:
    """Resolve a relative URL against a base URL.

    Args:
        base_url: The base URL.
        relative_url: The relative URL to resolve.

    Returns:
        Resolved absolute URL.
    """
    return urljoin(base_url, relative_url)


def extract_domain(url: str) -> str:
    """Extract the domain from a URL.

    Args:
        url: The URL.

    Returns:
        Domain name (e.g., "example.com").
    """
    parsed = urlparse(url)
    domain = parsed.netloc
    # Remove port if present
    if ":" in domain:
        domain = domain.split(":")[0]
    return domain


def is_pdf_url(url: str) -> bool:
    """Check if a URL likely points to a PDF file.

    Args:
        url: The URL to check.

    Returns:
        True if the URL appears to be a PDF.
    """
    parsed = urlparse(url)
    path_lower = parsed.path.lower()
    return path_lower.endswith(".pdf")


def make_absolute_url(base_url: str, href: str) -> str:
    """Convert href to absolute URL, handling edge cases.

    Args:
        base_url: The base URL.
        href: The href attribute value.

    Returns:
        Absolute URL string.
    """
    # Skip javascript: and mailto: links
    if href.startswith(("javascript:", "mailto:", "tel:", "#")):
        return ""

    # Already absolute
    if href.startswith(("http://", "https://")):
        return href

    # Protocol-relative
    if href.startswith("//"):
        parsed_base = urlparse(base_url)
        return f"{parsed_base.scheme}:{href}"

    # Relative path
    return resolve_url(base_url, href)
