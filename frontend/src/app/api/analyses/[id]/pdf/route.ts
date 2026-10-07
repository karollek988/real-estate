import { NextResponse } from "next/server";
import { getPathname } from "@/i18n/navigation";
import { localeOfRequest } from "@/i18n/requestLocale";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import { getReportForViewer } from "@/lib/analysis/access";
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

/**
 * GET /api/analyses/:id/pdf — render the report page to a downloadable PDF.
 * This route only checks the caller is signed in and the analysis exists;
 * entitlement (what content actually renders) is resolved by /report itself
 * — Puppeteer visits that page with this request's own session cookie
 * forwarded, so it always sees exactly what this caller would see in a
 * browser, redacted the same way.
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

  if (!found || found.analysis.status !== "complete" || !found.analysis.report) {
    return await apiError(404, "not_found", "analyses.notFoundCompleted");
  }

  // The PDF is the report page printed, so it is asked for in the language the report was opened in.
  const locale = localeOfRequest(request, new URL(request.url).searchParams.get("locale"));
  const reportUrl = new URL(getPathname({ locale, href: { pathname: "/report", query: { id } } }), request.url).toString();
  // /report is behind the same auth gate as this route (PROTECTED_PREFIXES
  // in lib/supabase/middleware.ts) — Puppeteer's headless browser has no
  // session of its own, so forward this request's cookies or it gets
  // redirected to the sign-in page instead of rendering the report.
  const cookieHeader = request.headers.get("cookie");

  let browser;
  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1024, height: 1400 });
    if (cookieHeader) {
      await page.setExtraHTTPHeaders({ cookie: cookieHeader });
    }
    await page.goto(reportUrl, { waitUntil: "networkidle0" });
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
    });

    const filename = `kopanalys-${found.property.address.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.pdf`;

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error(`GET /api/analyses/${id}/pdf failed:`, err);
    return await apiError(500, "pdf_failed", "analyses.pdfFailed");
  } finally {
    await browser?.close();
  }
}
