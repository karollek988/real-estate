import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { createContent } from "@/lib/content/adminStore";
import { errorResponse, readEditorRequest, storeErrorResponse } from "@/lib/content/editorRequest";
import { validateContentInput } from "@/lib/content/validate";

/**
 * POST /api/admin/content - creates a guide, insight or news item (Köpanalys
 * admins only, lib/auth/admin.ts). Body: { action: "save" | "publish", input }.
 */
export async function POST(request: Request) {
  const { user, response } = await requireAdmin();
  if (response) return response;

  const body = await readEditorRequest(request);
  if (body instanceof NextResponse) return body;
  if (body.action !== "save" && body.action !== "publish") {
    return errorResponse(400, "invalid_request", 'action must be "save" or "publish".');
  }

  const publishing = body.action === "publish";
  const result = validateContentInput(body.input, { publishing });
  if (!result.ok) return errorResponse(422, "invalid_content", "Rätta uppgifterna nedan.", result.errors);

  try {
    const item = await createContent(result.value, publishing, user.id);
    return NextResponse.json({ item, warnings: result.warnings }, { status: 201 });
  } catch (err) {
    return storeErrorResponse(err);
  }
}
