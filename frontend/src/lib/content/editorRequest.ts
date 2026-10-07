import { NextResponse } from "next/server";
import { isSameOriginRequest } from "@/lib/admin/requestGuards";
import { ContentStoreError } from "./adminStore";

/** Request handling shared by the content editor's API routes (/api/admin/content). */

const MAX_BODY_BYTES = 400_000;

export function errorResponse(status: number, code: string, message: string, details?: string[]) {
  return NextResponse.json({ error: { code, message, ...(details ? { details } : {}) } }, { status });
}

/** The editor's request: { action, input }. Only from a page on this site, at most 400 kB of JSON. */
export async function readEditorRequest(request: Request): Promise<{ action: unknown; input: unknown } | NextResponse> {
  if (!isSameOriginRequest(request)) return errorResponse(403, "forbidden", "Begäran måste komma från sajten själv.");
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return errorResponse(415, "unsupported_media_type", "Skicka JSON.");
  }
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return errorResponse(413, "too_large", "Texten är för lång.");
  try {
    const body = JSON.parse(text) as { action?: unknown; input?: unknown };
    return { action: body.action, input: body.input };
  } catch {
    return errorResponse(400, "invalid_request", "Request body must be JSON.");
  }
}

export function storeErrorResponse(err: unknown) {
  if (err instanceof ContentStoreError) {
    const status = err.code === "not_found" ? 404 : err.code === "slug_taken" ? 409 : err.code === "missing_table" ? 503 : 500;
    return errorResponse(status, err.code, err.message);
  }
  console.error("Content editor request failed:", err);
  return errorResponse(500, "server_error", "Något gick fel. Försök igen.");
}
