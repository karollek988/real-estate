import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { findPropertyById } from "@/lib/analysis/store";
import { BRF_REPORTS_BUCKET, MAX_BRF_REPORT_BYTES, classifyBrfMimeType } from "@/lib/analysis/brfReports";
import { hasFullEntitlementForProperty } from "@/lib/analysis/ownership";
import { requireUser } from "@/lib/auth/requireUser";
import { isAdminUser } from "@/lib/auth/admin";
import { apiError } from "@/i18n/apiText";

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

/**
 * POST /api/properties/:id/brf-report/upload-url — step 1 of the BRF
 * annual-report upload: issue a short-lived Supabase Storage signed upload
 * URL so the browser can PUT the file bytes directly into Storage, never
 * through this (or any) Vercel Function.
 *
 * This exists because Vercel Functions hard-cap request/response bodies at
 * 4.5MB (platform-enforced, not configurable) — well under the 20MB this
 * feature is meant to support, and routinely smaller than a real multi-page
 * or scanned annual report. Routing the file through the old single-step
 * multipart POST meant any report over ~4.5MB was rejected by the platform
 * with a 413 before our own code (or its 20MB check) ever ran, surfacing to
 * the user as a generic "something went wrong" with no useful detail
 * anywhere in our logs. See lib/brf/uploadClient.ts for the client side
 * of this contract, and ../route.ts for where the uploaded object is picked
 * up, read, and handed to the BRF review.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: propertyId } = await params;

  const { user, response: authError } = await requireUser();
  if (authError) return authError;

  const property = await findPropertyById(propertyId);
  if (!property) {
    return errorResponse(404, "not_found", "No property with that id.");
  }
  // The owner of the full analysis, or a Köpanalys reviewer uploading it for them (lib/auth/admin.ts).
  if (!isAdminUser(user) && !(await hasFullEntitlementForProperty(user.id, propertyId))) {
    return errorResponse(404, "not_found", "No property with that id.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "invalid_request", "Request body must be JSON.");
  }

  const { filename, mimeType, size } =
    (body as { filename?: unknown; mimeType?: unknown; size?: unknown }) ?? {};
  if (typeof filename !== "string" || typeof mimeType !== "string" || typeof size !== "number") {
    return errorResponse(400, "invalid_request", "Provide filename, mimeType, and size.");
  }

  if (size > MAX_BRF_REPORT_BYTES) {
    console.error(
      `POST /api/properties/${propertyId}/brf-report/upload-url rejected: ` +
        `declared size ${size} bytes exceeds ${MAX_BRF_REPORT_BYTES} (filename="${filename}", mimeType="${mimeType}")`
    );
    return await apiError(413, "file_too_large", "brfReport.tooLarge");
  }

  const upload = classifyBrfMimeType(mimeType);
  if (!upload) {
    console.error(
      `POST /api/properties/${propertyId}/brf-report/upload-url rejected: ` +
        `unsupported mimeType="${mimeType}" (filename="${filename}")`
    );
    return await apiError(422, "invalid_file_type", "brfReport.invalidType");
  }

  // Staged under the uploading user, not the final content-hash path (that's
  // only known once step 2 has the actual bytes in hand) — step 2 deletes
  // this object once it's done with it, whether it succeeds or not.
  const stagingPath = `staging/${user.id}/${randomUUID()}.${upload.extension}`;

  const { data, error } = await createAdminClient()
    .storage.from(BRF_REPORTS_BUCKET)
    .createSignedUploadUrl(stagingPath);

  if (error || !data) {
    console.error(
      `POST /api/properties/${propertyId}/brf-report/upload-url failed: ` +
        `createSignedUploadUrl error for path "${stagingPath}":`,
      error
    );
    return await apiError(500, "internal_error", "brfReport.prepareFailed");
  }

  return NextResponse.json({
    bucket: BRF_REPORTS_BUCKET,
    path: data.path,
    token: data.token,
  });
}
