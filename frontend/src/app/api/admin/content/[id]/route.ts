import { NextResponse } from "next/server";
import { isSameOriginRequest } from "@/lib/admin/requestGuards";
import { requireAdmin } from "@/lib/auth/admin";
import { deleteDraft, getContentById, updateContent } from "@/lib/content/adminStore";
import { errorResponse, readEditorRequest, storeErrorResponse } from "@/lib/content/editorRequest";
import { validateContentInput } from "@/lib/content/validate";

const STATUS_FOR_ACTION = { save: undefined, publish: "published", unpublish: "draft" } as const;

/**
 * PATCH /api/admin/content/:id - saves the editor's changes (Köpanalys admins
 * only, lib/auth/admin.ts). Body: { action, input }:
 *  - save:      keep the status (a published item is updated on the site)
 *  - publish:   put it on the site (a draft gets today's publication date)
 *  - unpublish: take it off the site again; it stays as a draft
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, response } = await requireAdmin();
  if (response) return response;

  const body = await readEditorRequest(request);
  if (body instanceof NextResponse) return body;
  if (body.action !== "save" && body.action !== "publish" && body.action !== "unpublish") {
    return errorResponse(400, "invalid_request", 'action must be "save", "publish" or "unpublish".');
  }

  try {
    const existing = await getContentById(id);
    if (!existing) return errorResponse(404, "not_found", "Innehållet finns inte.");

    // Saving a published item changes the live page, so it must meet the publishing rules too.
    const status = STATUS_FOR_ACTION[body.action];
    const live = body.action === "publish" || (body.action === "save" && existing.status === "published");
    const result = validateContentInput(body.input, { publishing: live });
    if (!result.ok) return errorResponse(422, "invalid_content", "Rätta uppgifterna nedan.", result.errors);

    const item = await updateContent(existing, result.value, status, user.id);
    return NextResponse.json({ item, warnings: result.warnings });
  } catch (err) {
    return storeErrorResponse(err);
  }
}

/** DELETE /api/admin/content/:id - removes a draft for good (admins only). A published item must be unpublished first. */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { response } = await requireAdmin();
  if (response) return response;
  if (!isSameOriginRequest(request)) return errorResponse(403, "forbidden", "Begäran måste komma från sajten själv.");

  try {
    const existing = await getContentById(id);
    if (!existing) return errorResponse(404, "not_found", "Innehållet finns inte.");
    await deleteDraft(existing);
    return NextResponse.json({ deleted: true });
  } catch (err) {
    return storeErrorResponse(err);
  }
}
