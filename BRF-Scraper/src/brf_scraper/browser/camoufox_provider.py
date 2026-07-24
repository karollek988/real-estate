"""Camoufox browser provider implementation."""

from __future__ import annotations

import time
from typing import Any

from brf_scraper.browser.base import BrowserProvider
from brf_scraper.browser.models import BrowserConfig, FetchResult, ProviderType
from brf_scraper.utils.logging import get_logger

logger = get_logger(__name__)


class CamoufoxProvider(BrowserProvider):
    """Camoufox browser provider for anti-detection browsing.

    Camoufox is a patched Firefox browser designed to avoid detection.
    It's best for:
    - Sites with advanced bot detection
    - Cloudflare-protected sites
    - Sites that detect Playwright/Selenium

    Requirements:
        - camoufox package installed
        - Firefox installed
    """

    def __init__(self) -> None:
        """Initialize Camoufox provider."""
        self._browser: Any = None
        self._context: Any = None
        self._initialized = False

    @property
    def provider_type(self) -> ProviderType:
        """Get the provider type."""
        return ProviderType.CAMOUFOX

    @property
    def name(self) -> str:
        """Get the provider name."""
        return "camoufox"

    @property
    def is_available(self) -> bool:
        """Check if Camoufox is available."""
        import importlib.util

        return importlib.util.find_spec("camoufox") is not None

    async def initialize(self) -> None:
        """Initialize Camoufox browser."""
        if self._initialized:
            return

        try:
            import camoufox.async_api  # noqa: F401

            logger.info("camoufox_provider_initializing")

            self._initialized = True
            logger.info("camoufox_provider_initialized")

        except ImportError:
            logger.error("camoufox_not_installed")
            raise

    async def close(self) -> None:
        """Close Camoufox browser."""
        try:
            if self._context:
                await self._context.close()
                self._context = None

            if self._browser:
                await self._browser.stop()
                self._browser = None

            self._initialized = False
            logger.info("camoufox_provider_closed")

        except Exception as e:
            logger.error("camoufox_close_error", error=str(e))

    def _build_launch_options(self, config: BrowserConfig) -> dict[str, Any]:
        """Build Camoufox launch options."""
        options: dict[str, Any] = {
            "headless": config.headless,
        }

        if config.proxy:
            options["proxy"] = {"server": config.proxy}
            if config.proxy_auth:
                options["proxy"]["username"] = config.proxy_auth[0]
                options["proxy"]["password"] = config.proxy_auth[1]

        return options

    async def fetch(
        self,
        url: str,
        config: BrowserConfig | None = None,
        **kwargs: Any,
    ) -> FetchResult:
        """Fetch a URL using Camoufox.

        Args:
            url: URL to fetch.
            config: Optional configuration.
            **kwargs: Additional options.

        Returns:
            FetchResult with response data.
        """
        config = config or BrowserConfig()
        start_time = time.monotonic()

        logger.info("camoufox_fetch_start", url=url)

        if not self._initialized:
            await self.initialize()

        page = None

        try:
            from camoufox.async_api import AsyncCamoufox

            launch_options = self._build_launch_options(config)

            async with AsyncCamoufox(**launch_options) as browser:
                context = await browser.new_context(
                    viewport={
                        "width": config.viewport_width,
                        "height": config.viewport_height,
                    },
                )

                # Add cookies if provided
                if config.cookies:
                    cookie_list = [
                        {"name": k, "value": v, "url": "http://localhost"}
                        for k, v in config.cookies.items()
                    ]
                    await context.add_cookies(cookie_list)

                page = await context.new_page()

                # Navigate to URL
                response = await page.goto(
                    url,
                    wait_until="load",
                    timeout=config.timeout * 1000,
                )

                # Wait for network to be idle
                try:
                    await page.wait_for_load_state("networkidle", timeout=5000)
                except Exception:
                    pass

                elapsed = time.monotonic() - start_time

                # Get page content
                html = await page.content()
                title = await page.title()

                # Get response info
                status_code = response.status if response else 200
                response_headers = dict(response.headers) if response else {}

                # Get cookies
                cookies_list = await context.cookies()
                cookies = {c["name"]: c["value"] for c in cookies_list}

                # Take screenshot if configured
                screenshot_path = None
                if config.screenshot_on_error:
                    screenshot_path = await self._take_screenshot(page, url)

                final_url = page.url

                result = FetchResult(
                    original_url=url,
                    final_url=final_url,
                    provider_used=self.provider_type,
                    status_code=status_code,
                    response_headers=response_headers,
                    html=html,
                    title=title,
                    response_time=elapsed,
                    redirect_count=0,
                    screenshot_path=screenshot_path,
                    cookies=cookies,
                    content_length=len(html.encode("utf-8")),
                )

                logger.info(
                    "camoufox_fetch_complete",
                    url=url,
                    status=status_code,
                    elapsed=elapsed,
                )

                return result

        except ImportError:
            elapsed = time.monotonic() - start_time
            logger.error("camoufox_not_installed")
            return FetchResult(
                original_url=url,
                final_url=url,
                provider_used=self.provider_type,
                status_code=0,
                error="Camoufox not installed",
                error_code="NOT_INSTALLED",
                response_time=elapsed,
            )

        except Exception as e:
            elapsed = time.monotonic() - start_time
            logger.error("camoufox_fetch_error", url=url, error=str(e))

            # Try to take screenshot on error
            screenshot_path = None
            if page and config.screenshot_on_error:
                screenshot_path = await self._take_screenshot(page, url)

            return FetchResult(
                original_url=url,
                final_url=url,
                provider_used=self.provider_type,
                status_code=0,
                error=str(e),
                error_code="PROVIDER_ERROR",
                response_time=elapsed,
                screenshot_path=screenshot_path,
            )

        finally:
            if page:
                try:
                    await page.close()
                except Exception:
                    pass

    async def _take_screenshot(self, page: Any, url: str) -> str | None:
        """Take a screenshot of the page."""
        try:
            import hashlib

            url_hash = hashlib.md5(url.encode()).hexdigest()[:12]
            screenshot_path = f"data/screenshots/{url_hash}.png"

            from pathlib import Path

            Path(screenshot_path).parent.mkdir(parents=True, exist_ok=True)

            await page.screenshot(path=screenshot_path, full_page=False)
            logger.info("screenshot_taken", path=screenshot_path)
            return screenshot_path

        except Exception as e:
            logger.warning("screenshot_failed", error=str(e))
            return None
