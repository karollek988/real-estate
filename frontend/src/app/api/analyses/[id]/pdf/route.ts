import { NextResponse } from "next/server";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import { getAnalysisWithProperty } from "@/lib/analysis/store";
import { requireUser } from "@/lib/auth/requireUser";

export const runtime = "nodejs";
export const maxDuration = 60;

/** GET /api/analyses/:id/pdf — render the report page to a downloadable PDF. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { response: authError } = await requireUser();
  if (authError) return authError;

  let found: Awaited<ReturnType<typeof getAnalysisWithProperty>>;
  try {
    found = await getAnalysisWithProperty(id);
  } catch (err) {
    console.error(`GET /api/analyses/${id}/pdf failed:`, err);
    return NextResponse.json(
      { error: { code: "internal_error", message: "Could not load the analysis." } },
      { status: 500 }
    );
  }

  if (!found || found.analysis.status !== "complete" || !found.analysis.report) {
    return NextResponse.json(
      { error: { code: "not_found", message: "No completed analysis with that id." } },
      { status: 404 }
    );
  }

  const reportUrl = new URL(`/report?id=${id}`, request.url).toString();
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
    return NextResponse.json(
      { error: { code: "pdf_failed", message: "Could not generate the PDF report." } },
      { status: 500 }
    );
  } finally {
    await browser?.close();
  }
}
