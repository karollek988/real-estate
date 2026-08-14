import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { getBrokerDocumentById, BROKER_DOCUMENTS_BUCKET } from "@/lib/analysis/brokerDocuments";
import { createAdminClient } from "@/lib/supabase/admin";

const SIGNED_URL_TTL_SECONDS = 60;

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

/**
 * GET /api/broker-documents/:id/download — short-lived signed URL for a
 * broker-discovered document (private bucket, same pattern as
 * inspection-files/brf-annual-reports). Gated on the requesting user having
 * unlocked *any* analysis (free or Premium) for this document's property —
 * broker documents are paywalled report content specifically, so the gate
 * mirrors the report page's own unlock state rather than
 * findAnalysisForProperty (which only checks ownership, not unlock status).
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, response: authError } = await requireUser();
  if (authError) return authError;

  const document = await getBrokerDocumentById(id);
  if (!document) return errorResponse(404, "not_found", "No document with that id.");

  const { data: ownership, error: ownershipError } = await createAdminClient()
    .from("analysis_requests")
    .select("id")
    .eq("user_id", user.id)
    .eq("property_id", document.propertyId)
    .eq("unlocked", true)
    .limit(1)
    .maybeSingle();
  if (ownershipError) throw new Error(`broker-documents download ownership check failed: ${ownershipError.message}`);
  if (!ownership) return errorResponse(403, "forbidden", "You don't have access to this property's report.");

  const { data: signed, error: signError } = await createAdminClient()
    .storage.from(BROKER_DOCUMENTS_BUCKET)
    .createSignedUrl(document.storagePath, SIGNED_URL_TTL_SECONDS, {
      download: document.originalFilename ?? true,
    });
  if (signError || !signed) {
    console.error(`GET /api/broker-documents/${id}/download signing failed:`, signError);
    return errorResponse(500, "internal_error", "Could not create a download link. Please try again.");
  }

  return NextResponse.redirect(signed.signedUrl);
}
