import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth/requireUser";
import { apiError } from "@/i18n/apiText";

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

/** True if `password` is this user's current password, checked without touching the caller's session cookies. */
async function verifyCurrentPassword(email: string, password: string): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Missing Supabase public env vars");
  const client = createSupabaseClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  return !error;
}

/**
 * PATCH /api/profile — updates the signed-in user's name and/or email.
 * Requires the current password so a hijacked session can't silently take
 * over the account's contact details.
 */
export async function PATCH(request: Request) {
  const { user, response: authError } = await requireUser();
  if (authError) return authError;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return errorResponse(400, "invalid_request", "Invalid request body.");
  }

  const { name, email, currentPassword } = body as {
    name?: unknown;
    email?: unknown;
    currentPassword?: unknown;
  };

  if (typeof currentPassword !== "string" || currentPassword.length === 0) {
    return await apiError(400, "invalid_request", "profile.currentPasswordRequired");
  }
  if (name !== undefined && typeof name !== "string") {
    return await apiError(400, "invalid_request", "profile.invalidName");
  }
  if (email !== undefined && typeof email !== "string") {
    return await apiError(400, "invalid_request", "profile.invalidEmail");
  }

  const trimmedName = typeof name === "string" ? name.trim() : undefined;
  const trimmedEmail = typeof email === "string" ? email.trim().toLowerCase() : undefined;

  if (trimmedEmail !== undefined) {
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!EMAIL_RE.test(trimmedEmail)) {
      return await apiError(422, "invalid_email", "profile.enterValidEmail");
    }
  }
  if (trimmedName !== undefined && trimmedName.length === 0) {
    return await apiError(422, "invalid_name", "profile.nameEmpty");
  }

  if (!user.email) {
    return await apiError(500, "internal_error", "profile.noEmailOnAccount");
  }

  const passwordOk = await verifyCurrentPassword(user.email, currentPassword);
  if (!passwordOk) {
    return await apiError(401, "wrong_password", "profile.wrongPassword");
  }

  const update: { email?: string; user_metadata?: Record<string, unknown> } = {};
  if (trimmedEmail !== undefined && trimmedEmail !== user.email.toLowerCase()) {
    update.email = trimmedEmail;
  }
  if (trimmedName !== undefined) {
    update.user_metadata = { ...user.user_metadata, full_name: trimmedName };
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ success: true, unchanged: true });
  }

  try {
    const { data, error } = await createAdminClient().auth.admin.updateUserById(user.id, {
      ...update,
      ...(update.email ? { email_confirm: true } : {}),
    });
    if (error) throw new Error(error.message);
    return NextResponse.json({
      success: true,
      user: { email: data.user.email, name: data.user.user_metadata?.full_name ?? null },
    });
  } catch (err) {
    console.error("PATCH /api/profile failed:", err);
    return await apiError(500, "internal_error", "profile.failed");
  }
}

/**
 * DELETE /api/profile — permanently deletes the signed-in user's account.
 *
 * `profiles`, `analysis_requests` and `saved_properties` all have
 * `on delete cascade` from `auth.users`, so deleting the auth user is
 * sufficient to remove every user-owned row. Shared, cross-user data
 * (`properties`, `analyses`, `brf_annual_reports`) has no foreign key to
 * `auth.users` at all, so it is structurally impossible for this to reach
 * it — those tables are shared/cached across users by design.
 */
export async function DELETE() {
  const { user, response: authError } = await requireUser();
  if (authError) return authError;

  try {
    const { error } = await createAdminClient().auth.admin.deleteUser(user.id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/profile failed:", err);
    return await apiError(500, "internal_error", "profile.deleteFailed");
  }
}
