"""Camoufox verification script.

This script tests if Camoufox is properly installed and configured.
It will:
1. Try to import Camoufox
2. Launch a browser
3. Open https://example.com
4. Save the HTML content
5. Take a screenshot
6. Close the browser

If Camoufox is unavailable, it will explain why and fall back to Playwright.
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path
from datetime import datetime


async def test_camoufox() -> bool:
    """Test Camoufox installation and functionality.

    Returns:
        True if Camoufox is working, False otherwise.
    """
    print("=" * 60)
    print("Camoufox Verification Script")
    print("=" * 60)
    print()

    # Step 1: Try to import Camoufox
    print("[1/5] Checking Camoufox installation...")
    try:
        from camoufox.async_api import AsyncCamoufox

        print("  ✓ Camoufox package found")
    except ImportError as e:
        print(f"  ✗ Camoufox not installed: {e}")
        print()
        print("To install Camoufox:")
        print("  pip install camoufox")
        print()
        print("Note: Camoufox requires Firefox to be installed on your system.")
        print("Download Firefox from: https://www.mozilla.org/firefox/")
        return False

    # Step 2: Check Firefox installation
    print("[2/5] Checking Firefox installation...")
    try:
        import subprocess

        # Try to find Firefox
        firefox_paths = [
            "/usr/bin/firefox",
            "/usr/bin/firefox-esr",
            "/usr/local/bin/firefox",
            "C:\\Program Files\\Mozilla Firefox\\firefox.exe",
            "C:\\Program Files (x86)\\Mozilla Firefox\\firefox.exe",
            "/Applications/Firefox.app/Contents/MacOS/firefox",
        ]

        firefox_found = False
        for path in firefox_paths:
            if Path(path).exists():
                print(f"  ✓ Firefox found at: {path}")
                firefox_found = True
                break

        if not firefox_found:
            print("  ⚠ Firefox not found in standard locations")
            print("    Camoufox may still work if Firefox is in your PATH")
    except Exception as e:
        print(f"  ⚠ Could not check Firefox: {e}")

    # Step 3: Launch browser and fetch page
    print("[3/5] Launching browser and fetching page...")
    try:
        async with AsyncCamoufox(headless=True) as browser:
            print("  ✓ Browser launched successfully")

            context = await browser.new_context()
            page = await context.new_page()

            # Navigate to example.com
            print("  → Navigating to https://example.com...")
            response = await page.goto(
                "https://example.com",
                wait_until="load",
                timeout=30000,
            )

            if response:
                print(f"  ✓ Page loaded (status: {response.status})")
            else:
                print("  ⚠ No response object returned")

            # Get page content
            title = await page.title()
            print(f"  ✓ Page title: {title}")

            # Step 4: Save HTML content
            print("[4/5] Saving HTML content...")
            html = await page.content()
            html_path = Path("data/exports/camoufox_test.html")
            html_path.parent.mkdir(parents=True, exist_ok=True)
            html_path.write_text(html, encoding="utf-8")
            print(f"  ✓ HTML saved to: {html_path}")

            # Step 5: Take screenshot
            print("[5/5] Taking screenshot...")
            screenshot_path = Path("data/exports/camoufox_screenshot.png")
            screenshot_path.parent.mkdir(parents=True, exist_ok=True)
            await page.screenshot(path=str(screenshot_path), full_page=True)
            print(f"  ✓ Screenshot saved to: {screenshot_path}")

            # Clean up
            await page.close()
            await context.close()

    except Exception as e:
        print(f"  ✗ Error: {e}")
        print()
        print("Troubleshooting:")
        print("  1. Ensure Firefox is installed")
        print("  2. Try running: camoufox fetch")
        print("  3. Check Camoufox documentation: https://camoufox.com")
        return False

    print()
    print("=" * 60)
    print("✓ Camoufox verification complete!")
    print("=" * 60)
    print()
    print("Files created:")
    print(f"  - {html_path}")
    print(f"  - {screenshot_path}")
    print()

    return True


async def test_playwright_fallback() -> bool:
    """Test Playwright as fallback when Camoufox is unavailable.

    Returns:
        True if Playwright is working, False otherwise.
    """
    print()
    print("=" * 60)
    print("Playwright Fallback Test")
    print("=" * 60)
    print()

    print("[1/3] Checking Playwright installation...")
    try:
        from playwright.async_api import async_playwright

        print("  ✓ Playwright package found")
    except ImportError as e:
        print(f"  ✗ Playwright not installed: {e}")
        print()
        print("To install Playwright:")
        print("  pip install playwright")
        print("  playwright install chromium")
        return False

    print("[2/3] Launching browser...")
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            print("  ✓ Browser launched successfully")

            context = await browser.new_context()
            page = await context.new_page()

            print("  → Navigating to https://example.com...")
            response = await page.goto(
                "https://example.com",
                wait_until="load",
                timeout=30000,
            )

            if response:
                print(f"  ✓ Page loaded (status: {response.status})")

            title = await page.title()
            print(f"  ✓ Page title: {title}")

            # Save HTML
            print("[3/3] Saving HTML content...")
            html = await page.content()
            html_path = Path("data/exports/playwright_test.html")
            html_path.parent.mkdir(parents=True, exist_ok=True)
            html_path.write_text(html, encoding="utf-8")
            print(f"  ✓ HTML saved to: {html_path}")

            # Take screenshot
            screenshot_path = Path("data/exports/playwright_screenshot.png")
            await page.screenshot(path=str(screenshot_path), full_page=True)
            print(f"  ✓ Screenshot saved to: {screenshot_path}")

            await page.close()
            await context.close()
            await browser.close()

    except Exception as e:
        print(f"  ✗ Error: {e}")
        return False

    print()
    print("=" * 60)
    print("✓ Playwright verification complete!")
    print("=" * 60)

    return True


async def main() -> None:
    """Run the verification script."""
    # Try Camoufox first
    camoufox_ok = await test_camoufox()

    if not camoufox_ok:
        print()
        print("Camoufox is not available. Falling back to Playwright...")
        playwright_ok = await test_playwright_fallback()

        if not playwright_ok:
            print()
            print("Neither Camoufox nor Playwright is available.")
            print("Only HTTP fetching will be available.")
            sys.exit(1)

    print()
    print("Browser engine is ready!")
    sys.exit(0)


if __name__ == "__main__":
    asyncio.run(main())
