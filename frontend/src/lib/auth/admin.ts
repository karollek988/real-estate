import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Who may use the review console (/admin) — the Köpanalys reviewers who
 * publish BRF analyses. Configured with KOPANALYS_ADMIN_EMAILS (comma
 * separated); without it, only the founder's account. Server-only.
 *
 * A confirmed email address is required, so an unconfirmed signup that
 * happens to use a reviewer's address never gets in.
 */
const DEFAULT_ADMIN_EMAILS = "karollek98@gmail.com";

export function adminEmails(): string[] {
  return (process.env.KOPANALYS_ADMIN_EMAILS ?? DEFAULT_ADMIN_EMAILS)
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminUser(user: Pick<User, "email" | "email_confirmed_at"> | null | undefined): boolean {
  if (!user?.email || !user.email_confirmed_at) return false;
  return adminEmails().includes(user.email.toLowerCase());
}

type RequireAdminResult = { user: User; response: null } | { user: null; response: NextResponse };

/** For API routes: 401 without a session, 404 for anyone who isn't a reviewer (the console's existence isn't advertised). */
export async function requireAdmin(): Promise<RequireAdminResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      user: null,
      response: NextResponse.json({ error: { code: "unauthorized", message: "Sign in to continue." } }, { status: 401 }),
    };
  }
  if (!isAdminUser(user)) {
    return { user: null, response: NextResponse.json({ error: { code: "not_found", message: "Not found." } }, { status: 404 }) };
  }
  return { user, response: null };
}
