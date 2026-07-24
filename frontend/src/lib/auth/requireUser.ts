import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

type RequireUserResult =
  | { user: User; response: null }
  | { user: null; response: NextResponse };

/**
 * Session check for API routes that use the service-role Supabase client
 * (which bypasses RLS) to reach properties/analyses. Those tables have no
 * RLS policies of their own — this is the only gate standing between an
 * anonymous request and every customer's data, so every route touching them
 * must call this first.
 */
export async function requireUser(): Promise<RequireUserResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      user: null,
      response: NextResponse.json(
        { error: { code: "unauthorized", message: "Sign in to continue." } },
        { status: 401 }
      ),
    };
  }

  return { user, response: null };
}
