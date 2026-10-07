/**
 * Client-side call to POST /api/analyses, shared by the manual-entry form
 * (full analysis) and the area-analysis form, so both turn the same API
 * errors into the same messages. The messages the server writes arrive in the page's language; the two
 * that the browser has to write itself (no answer, not signed in) are handed in as `texts`.
 */
import type { Href } from "@/i18n/navigation";


export type SubmitAnalysisResult =
  | { ok: true; analysisId: string; cached: boolean }
  | { ok: false; code: string; message: string };

export async function submitAnalysis(
  body: Record<string, unknown>,
  texts: { fallback: string; unauthorized: string },
): Promise<SubmitAnalysisResult> {
  try {
    const res = await fetch("/api/analyses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);

    if (res.ok && typeof data?.analysisId === "string") {
      return { ok: true, analysisId: data.analysisId, cached: Boolean(data.cached) };
    }
    if (res.status === 401) {
      return { ok: false, code: "unauthorized", message: texts.unauthorized };
    }
    return {
      ok: false,
      code: typeof data?.error?.code === "string" ? data.error.code : "unknown",
      message: typeof data?.error?.message === "string" ? data.error.message : texts.fallback,
    };
  } catch {
    return { ok: false, code: "network", message: texts.fallback };
  }
}

/** Fresh cached analyses skip the analyzing animation and open directly. */
export function reportPathFor(result: { analysisId: string; cached: boolean }): Href {
  return { pathname: result.cached ? "/report" : "/analyzing", query: { id: result.analysisId } };
}
