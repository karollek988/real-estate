"""Playwright browser provider implementation."""

from __future__ import annotations

import time
from typing import Any

from brf_scraper.browser.base import BrowserProvider
from brf_scraper.browser.models import BrowserConfig, FetchResult, ProviderType
from brf_scraper.utils.logging import get_logger

logger = get_logger(__name__)


class PlaywrightProvider(BrowserProvider):
    """Playwright browser provider for JavaScript-heavy sites.

    This provider is best for:
    - JavaScript-rendered pages
    - Single-page applications
    - Sites with heavy client-side rendering
    - Sites that detect and block basic HTTP clients
    """

    def __init__(self) -> None:
        """Initialize Playwright provider."""
        self._playwright: Any = None
        self._browser: Any = None
        self._context: Any = None
        self._initialized = False

    @property
    def provider_type(self) -> ProviderType:
        """Get the provider type."""
        return ProviderType.PLAYWRIGHT

    @property
    def name(self) -> str:
        """Get the provider name."""
        return "playwright"

    @property
    def is_available(self) -> bool:
        """Check if Playwright is available."""
        import importlib.util

        return importlib.util.find_spec("playwright") is not None

    async def initialize(self) -> None:
        """Initialize Playwright browser."""
        if self._initialized:
            return

        try:
            from playwright.async_api import async_playwright

            logger.info("playwright_provider_initializing")

            self._playwright = await async_playwright().start()
            self._browser = await self._playwright.chromium.launch(
                headless=True,
                args=[
                    "--disable-blink-features=AutomationControlled",
                    "--disable-dev-shm-usage",
                    "--no-sandbox",
                ],
            )

            self._initialized = True
            logger.info("playwright_provider_initialized")

        except ImportError:
            logger.error("playwright_not_installed")
            raise

    async def close(self) -> None:
        """Close Playwright browser."""
        try:
            if self._context:
                await self._context.close()
                self._context = None

            if self._browser:
                await self._browser.close()
                self._browser = None

            if self._playwright:
                await self._playwright.stop()
                self._playwright = None

            self._initialized = False
            logger.info("playwright_provider_closed")

        except Exception as e:
            logger.error("playwright_close_error", error=str(e))

    def _build_browser_args(self, config: BrowserConfig) -> list[str]:
        """Build browser launch arguments."""
        args = [
            "--disable-blink-features=AutomationControlled",
            "--disable-dev-shm-usage",
            "--no-sandbox",
        ]

        if config.proxy:
            args.append(f"--proxy-server={config.proxy}")

        return args

    async def _create_context(self, config: BrowserConfig) -> Any:
        """Create a new browser context."""
        if not self._browser:
            raise RuntimeError("Browser not initialized")

        context_options: dict[str, Any] = {
            "viewport": {
                "width": config.viewport_width,
                "height": config.viewport_height,
            },
            "user_agent": config.user_agent
            or "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "ignore_https_errors": not config.verify_ssl,
            "java_script_enabled": config.enable_javascript,
        }

        if config.proxy:
            context_options["proxy"] = {"server": config.proxy}
            if config.proxy_auth:
                context_options["proxy"]["username"] = config.proxy_auth[0]
                context_options["proxy"]["password"] = config.proxy_auth[1]

        context = await self._browser.new_context(**context_options)

        # Add cookies if provided
        if config.cookies:
            cookie_list = [
                {"name": k, "value": v, "url": "http://localhost"}
                for k, v in config.cookies.items()
            ]
            await context.add_cookies(cookie_list)

        return context

    async def _take_screenshot(
        self,
        page: Any,
        url: str,
        config: BrowserConfig,
    ) -> str | None:
        """Take a screenshot of the page."""
        if not config.screenshot_on_error:
            return None

        try:
            import hashlib

            url_hash = hashlib.md5(url.encode()).hexdigest()[:12]
            screenshot_path = f"data/screenshots/{url_hash}.png"

            # Ensure directory exists
            from pathlib import Path

            Path(screenshot_path).parent.mkdir(parents=True, exist_ok=True)

            await page.screenshot(path=screenshot_path, full_page=False)
            logger.info("screenshot_taken", path=screenshot_path)
            return screenshot_path

        except Exception as e:
            logger.warning("screenshot_failed", error=str(e))
            return None

    async def fetch(
        self,
        url: str,
        config: BrowserConfig | None = None,
        **kwargs: Any,
    ) -> FetchResult:
        """Fetch a URL using Playwright.

        Args:
            url: URL to fetch.
            config: Optional configuration.
            **kwargs: Additional options.

        Returns:
            FetchResult with response data.
        """
        config = config or BrowserConfig()
        start_time = time.monotonic()

        logger.info("playwright_fetch_start", url=url)

        if not self._initialized:
            await self.initialize()

        if not self._browser:
            return FetchResult(
                original_url=url,
                final_url=url,
                provider_used=self.provider_type,
                status_code=0,
                error="Browser not initialized",
                error_code="NOT_INITIALIZED",
                response_time=0,
            )

        context = None
        page = None

        try:
            context = await self._create_context(config)
            page = await context.new_page()

            # Navigate to URL
            response = await page.goto(
                url,
                wait_until="load",
                timeout=config.timeout * 1000,  # Convert to ms
            )

            # Wait for network to be idle
            try:
                await page.wait_for_load_state("networkidle", timeout=5000)
            except Exception:
                pass  # Network idle timeout is not critical

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
            screenshot_path = await self._take_screenshot(page, url, config)

            # Get final URL (after redirects)
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
                redirect_count=0,  # Playwright doesn't easily expose this
                screenshot_path=screenshot_path,
                cookies=cookies,
                content_length=len(html.encode("utf-8")),
            )

            logger.info(
                "playwright_fetch_complete",
                url=url,
                status=status_code,
                elapsed=elapsed,
            )

            return result

        except Exception as e:
            elapsed = time.monotonic() - start_time
            logger.error("playwright_fetch_error", url=url, error=str(e))

            # Try to take screenshot on error
            screenshot_path = None
            if page and config.screenshot_on_error:
                screenshot_path = await self._take_screenshot(page, url, config)

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
            if context:
                try:
                    await context.close()
                except Exception:
                    pass
