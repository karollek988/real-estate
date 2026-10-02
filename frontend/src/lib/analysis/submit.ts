/**
 * Client-side call to POST /api/analyses, shared by the manual-entry form
 * (full analysis) and the area-analysis form, so both turn the same API
 * errors into the same Swedish messages.
 */

export type SubmitAnalysisResult =
  | { ok: true; analysisId: string; cached: boolean }
  | { ok: false; code: string; message: string };

const FALLBACK_MESSAGE = "Något gick fel. Försök igen.";

export async function submitAnalysis(body: Record<string, unknown>): Promise<SubmitAnalysisResult> {
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
      return { ok: false, code: "unauthorized", message: "Logga in eller skapa ett konto för att fortsätta." };
    }
    return {
      ok: false,
      code: typeof data?.error?.code === "string" ? data.error.code : "unknown",
      message: typeof data?.error?.message === "string" ? data.error.message : FALLBACK_MESSAGE,
    };
  } catch {
    return { ok: false, code: "network", message: FALLBACK_MESSAGE };
  }
}

/** Fresh cached analyses skip the analyzing animation and open directly. */
export function reportPathFor(result: { analysisId: string; cached: boolean }): string {
  return result.cached ? `/report?id=${result.analysisId}` : `/analyzing?id=${result.analysisId}`;
}
