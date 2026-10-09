import { NextResponse } from "next/server";
import { getPathname } from "@/i18n/navigation";
import { localeOfRequest } from "@/i18n/requestLocale";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import { getReportForViewer } from "@/lib/analysis/access";
import { cookiesForOrigin, shortUrl } from "@/lib/analysis/pdfRender";
import { requireUser } from "@/lib/auth/requireUser";
import { isAdminUser } from "@/lib/auth/admin";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";
import { apiError } from "@/i18n/apiText";

export const runtime = "nodejs";
export const maxDuration = 60;

// Every call launches a full headless Chromium — by far the most
// memory/CPU-expensive request in the app. No caching exists yet for the
// rendered PDF (a real follow-up — see the production-readiness report), so
// this rate limit is the cheap stopgap against a script spamming downloads.
const RATE_LIMIT_PER_MINUTE = 5;

// The whole request must end inside maxDuration. Each step gets what is left of this budget, so a slow step
// ends in a logged error here instead of a platform timeout with nothing in the logs.
const BUDGET_MS = 55_000;
const NAVIGATION_MAX_MS = 25_000;
// The report shows the listing's photos straight from the listing site's own servers. A slow or blocking host must
// not fail the download: after this long the page is printed with whatever has loaded.
const SETTLE_MAX_MS = 10_000;

/**
 * GET /api/analyses/:id/pdf — render the report page to a downloadable PDF.
 * This route only checks the caller is signed in and the analysis exists;
 * entitlement (what content actually renders) is resolved by /report itself
 * — Puppeteer visits that page with this request's own session cookie
 * forwarded, so it always sees exactly what this caller would see in a
 * browser, redacted the same way. A full report that no reviewer has
 * released yet is not printed at all (409).
 *
 * Local testing: Chromium from @sparticuz/chromium only runs on Linux. Set PDF_CHROME_PATH to a Chrome or
 * Edge on your machine to run this route locally; leave it unset everywhere else.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { user, response: authError } = await requireUser();
  if (authError) return authError;

  if (!checkRateLimit(`pdf:${clientIp(request)}`, RATE_LIMIT_PER_MINUTE, 60_000)) {
    return await apiError(429, "rate_limited", "analyses.pdfRateLimited");
  }

  let found: Awaited<ReturnType<typeof getReportForViewer>>;
  try {
    found = await getReportForViewer(id, user.id, { isReviewer: isAdminUser(user) });
  } catch (err) {
    console.error(`GET /api/analyses/${id}/pdf failed:`, err);
    return await apiError(500, "internal_error", "analyses.loadFailed");
  }

  if (found?.access.held) {
    return await apiError(409, "awaiting_review", "analyses.pdfAwaitingReview");
  }
  if (!found || found.analysis.status !== "complete" || !found.analysis.report) {
    return await apiError(404, "not_found", "analyses.notFoundCompleted");
  }

  // The PDF is the report page printed, so it is asked for in the language the report was opened in.
  const locale = localeOfRequest(request, new URL(request.url).searchParams.get("locale"));
  const origin = new URL(request.url).origin;
  const reportUrl = new URL(getPathname({ locale, href: { pathname: "/report", query: { id } } }), origin).toString();
  // /report is behind the same auth gate as this route (PROTECTED_PREFIXES
  // in lib/supabase/middleware.ts) — Puppeteer's headless browser has no
  // session of its own, so it gets this request's cookies or it is
  // redirected to the sign-in page instead of rendering the report. They are
  // set as cookies of this site only: as an extra header they would go to every
  // host the page contacts, and the report loads the listing's photos from the
  // listing site's servers.
  const cookies = cookiesForOrigin(request.headers.get("cookie"), origin);

  const startedAt = Date.now();
  const remaining = () => BUDGET_MS - (Date.now() - startedAt);
  const timings: Record<string, number> = {};
  const problems: string[] = [];
  let stage = "launch";
  let browser;
  try {
    const localChrome = process.env.PDF_CHROME_PATH;
    browser = await puppeteer.launch({
      args: localChrome ? ["--no-sandbox"] : chromium.args,
      executablePath: localChrome ?? (await chromium.executablePath()),
      headless: true,
    });
    timings.launch = Date.now() - startedAt;

    stage = "navigate";
    const page = await browser.newPage();
    await page.setViewport({ width: 1024, height: 1400 });
    if (cookies.length > 0) await page.setCookie(...cookies);
    // What went wrong on the way, for the log if this fails.
    page.on("requestfailed", (r) => problems.push(`failed ${r.failure()?.errorText ?? ""} ${shortUrl(r.url())}`));
    page.on("response", (r) => { if (r.status() >= 400) problems.push(`http ${r.status()} ${shortUrl(r.url())}`); });
    page.on("pageerror", (e) => problems.push(`pageerror ${(e instanceof Error && e.message) || "(no message)"}`));

    const response = await page.goto(reportUrl, {
      waitUntil: "domcontentloaded",
      timeout: Math.min(NAVIGATION_MAX_MS, Math.max(remaining(), 1_000)),
    });
    // An error page or the sign-in page must never come out as a "report" PDF.
    if (!response || response.status() >= 400) {
      throw new Error(`the report page answered ${response ? response.status() : "nothing"}`);
    }
    if (!new URL(page.url()).pathname.includes("/report")) {
      throw new Error(`the report page redirected to ${new URL(page.url()).pathname}`);
    }
    timings.navigate = Date.now() - startedAt;

    stage = "settle";
    // Wait for the network to go quiet, but only for so long.
    const settled = await page
      .waitForNetworkIdle({ idleTime: 800, timeout: Math.min(SETTLE_MAX_MS, Math.max(remaining() - 8_000, 1_000)) })
      .then(() => true, () => false);
    timings.settle = Date.now() - startedAt;
    if (!settled) problems.push("the network did not go quiet in time; printed with what had loaded");

    stage = "print";
    // The report page's entrance animations (score ring draw, section
    // fade-ins) run for over a second after network idle — force them to
    // their end state so the PDF never captures a mid-animation frame.
    await page.addStyleTag({
      content:
        "*, *::before, *::after { animation-duration: 0s !important; animation-delay: 0s !important; transition-duration: 0s !important; transition-delay: 0s !important; }",
    });
    const pdf = await page.pdf({
      format: "a4",
      printBackground: true,
      margin: { top: "16mm", bottom: "16mm", left: "12mm", right: "12mm" },
      timeout: Math.max(remaining(), 5_000),
    });
    timings.print = Date.now() - startedAt;

    // Slow or imperfect prints are worth a line even though they succeeded: that is how a slow photo host shows up.
    if (problems.length > 0 || Date.now() - startedAt > 20_000) {
      console.warn(`GET /api/analyses/${id}/pdf ok but slow or imperfect`, { timings, problems: problems.slice(0, 8) });
    }

    const filename = `kopanalys-${found.property.address.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.pdf`;

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error(`GET /api/analyses/${id}/pdf failed at "${stage}" after ${Date.now() - startedAt} ms:`, err, {
      timings,
      problems: problems.slice(0, 8),
    });
    return await apiError(500, "pdf_failed", "analyses.pdfFailed");
  } finally {
    await browser?.close();
  }
}
