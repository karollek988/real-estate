"""HTTP client interfaces for the BRF Scraper."""

from __future__ import annotations

from abc import abstractmethod
from dataclasses import dataclass, field
from typing import Any

from brf_scraper.base import BaseInterface


@dataclass
class HTTPResponse:
    """HTTP response wrapper."""

    status_code: int
    content: bytes
    headers: dict[str, str] = field(default_factory=dict)
    url: str = ""
    elapsed: float = 0.0
    encoding: str | None = None

    @property
    def text(self) -> str:
        """Get response content as text."""
        encoding = self.encoding or "utf-8"
        return self.content.decode(encoding)

    @property
    def json(self) -> Any:
        """Parse response content as JSON."""
        import json

        return json.loads(self.content)

    @property
    def is_success(self) -> bool:
        """Check if request was successful (2xx)."""
        return 200 <= self.status_code < 300

    @property
    def content_type(self) -> str:
        """Get content type from headers."""
        return self.headers.get("content-type", "")


@dataclass
class HTTPRequest:
    """HTTP request wrapper."""

    method: str
    url: str
    headers: dict[str, str] = field(default_factory=dict)
    params: dict[str, str] | None = None
    content: bytes | None = None
    json_data: Any = None
    timeout: float | None = None
    follow_redirects: bool = True


class HTTPClient(BaseInterface):
    """HTTP client interface."""

    @abstractmethod
    async def request(self, request: HTTPRequest) -> HTTPResponse:
        """Send an HTTP request.

        Args:
            request: HTTP request to send.

        Returns:
            HTTP response.
        """

    async def get(
        self,
        url: str,
        headers: dict[str, str] | None = None,
        params: dict[str, str] | None = None,
        timeout: float | None = None,
        follow_redirects: bool = True,
    ) -> HTTPResponse:
        """Send a GET request.

        Args:
            url: Request URL.
            headers: Optional headers.
            params: Optional query parameters.
            timeout: Optional timeout in seconds.
            follow_redirects: Whether to follow redirects.

        Returns:
            HTTP response.
        """
        request = HTTPRequest(
            method="GET",
            url=url,
            headers=headers or {},
            params=params,
            timeout=timeout,
            follow_redirects=follow_redirects,
        )
        return await self.request(request)

    async def post(
        self,
        url: str,
        headers: dict[str, str] | None = None,
        content: bytes | None = None,
        json_data: Any = None,
        timeout: float | None = None,
    ) -> HTTPResponse:
        """Send a POST request.

        Args:
            url: Request URL.
            headers: Optional headers.
            content: Optional body content.
            json_data: Optional JSON body.
            timeout: Optional timeout in seconds.

        Returns:
            HTTP response.
        """
        request = HTTPRequest(
            method="POST",
            url=url,
            headers=headers or {},
            content=content,
            json_data=json_data,
            timeout=timeout,
        )
        return await self.request(request)

    async def head(
        self,
        url: str,
        headers: dict[str, str] | None = None,
        timeout: float | None = None,
        follow_redirects: bool = True,
    ) -> HTTPResponse:
        """Send a HEAD request.

        Args:
            url: Request URL.
            headers: Optional headers.
            timeout: Optional timeout in seconds.
            follow_redirects: Whether to follow redirects.

        Returns:
            HTTP response.
        """
        request = HTTPRequest(
            method="HEAD",
            url=url,
            headers=headers or {},
            timeout=timeout,
            follow_redirects=follow_redirects,
        )
        return await self.request(request)

    @abstractmethod
    async def download(
        self,
        url: str,
        destination: str | Any,
        chunk_size: int = 8192,
        timeout: float | None = None,
        progress_callback: Any | None = None,
    ) -> bool:
        """Download a file.

        Args:
            url: Download URL.
            destination: File path or file-like object.
            chunk_size: Download chunk size.
            timeout: Optional timeout in seconds.
            progress_callback: Optional progress callback.

        Returns:
            True if download was successful.
        """
