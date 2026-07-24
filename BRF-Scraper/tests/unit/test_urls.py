"""Unit tests for URL utilities."""

from __future__ import annotations

from brf_scraper.utils.urls import (
    extract_domain,
    is_pdf_url,
    is_same_domain,
    make_absolute_url,
    normalize_url,
    resolve_url,
)


class TestNormalizeUrl:
    """Tests for normalize_url."""

    def test_remove_fragment(self) -> None:
        """Test removing URL fragment."""
        url = "https://example.com/page#section"
        result = normalize_url(url)
        assert result == "https://example.com/page"

    def test_normalize_path(self) -> None:
        """Test normalizing URL path."""
        url = "https://example.com/page/"
        result = normalize_url(url)
        assert result == "https://example.com/page"

    def test_root_path(self) -> None:
        """Test root path."""
        url = "https://example.com/"
        result = normalize_url(url)
        assert result == "https://example.com/"


class TestIsSameDomain:
    """Tests for is_same_domain."""

    def test_same_domain(self) -> None:
        """Test same domain detection."""
        assert is_same_domain("https://example.com/a", "https://example.com/b") is True

    def test_different_domain(self) -> None:
        """Test different domain detection."""
        assert is_same_domain("https://example.com", "https://other.com") is False


class TestResolveUrl:
    """Tests for resolve_url."""

    def test_relative_path(self) -> None:
        """Test resolving relative path."""
        base = "https://example.com/page/"
        relative = "../other"
        result = resolve_url(base, relative)
        assert result == "https://example.com/other"

    def test_absolute_path(self) -> None:
        """Test resolving absolute path."""
        base = "https://example.com/page/"
        relative = "/other"
        result = resolve_url(base, relative)
        assert result == "https://example.com/other"


class TestExtractDomain:
    """Tests for extract_domain."""

    def test_simple_domain(self) -> None:
        """Test extracting simple domain."""
        assert extract_domain("https://example.com/path") == "example.com"

    def test_domain_with_port(self) -> None:
        """Test extracting domain with port."""
        assert extract_domain("https://example.com:8080/path") == "example.com"


class TestIsPdfUrl:
    """Tests for is_pdf_url."""

    def test_pdf_url(self) -> None:
        """Test PDF URL detection."""
        assert is_pdf_url("https://example.com/report.pdf") is True

    def test_non_pdf_url(self) -> None:
        """Test non-PDF URL detection."""
        assert is_pdf_url("https://example.com/page.html") is False

    def test_pdf_in_path(self) -> None:
        """Test PDF in middle of path."""
        assert is_pdf_url("https://example.com/docs/report.pdf?v=1") is True


class TestMakeAbsoluteUrl:
    """Tests for make_absolute_url."""

    def test_already_absolute(self) -> None:
        """Test absolute URL passthrough."""
        result = make_absolute_url("https://base.com", "https://other.com")
        assert result == "https://other.com"

    def test_relative_path(self) -> None:
        """Test relative path resolution."""
        result = make_absolute_url("https://example.com/page/", "../other")
        assert result == "https://example.com/other"

    def test_javascript_url(self) -> None:
        """Test javascript: URL filtering."""
        result = make_absolute_url("https://example.com", "javascript:void(0)")
        assert result == ""

    def test_mailto_url(self) -> None:
        """Test mailto: URL filtering."""
        result = make_absolute_url("https://example.com", "mailto:test@example.com")
        assert result == ""

    def test_protocol_relative(self) -> None:
        """Test protocol-relative URL."""
        result = make_absolute_url("https://example.com", "//cdn.example.com/file")
        assert result == "https://cdn.example.com/file"
