import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// `next` may be a relative path ("/dashboard") or a full URL
// (authService.ts's emailRedirectTo sends an absolute URL, since Supabase
// validates emailRedirectTo against its own allow-listed Redirect URLs,
// which requires a full URL). new URL(next, origin) handles both — but an
// absolute `next` pointing off-site must be rejected, since it arrives via
// a public query param on a link users click from email.
function resolveNext(next: string, origin: string): URL {
  try {
    const url = new URL(next, origin);
    return url.origin === origin ? url : new URL("/dashboard", origin);
  } catch {
    return new URL("/dashboard", origin);
  }
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/dashboard";

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(resolveNext(next, origin));
    }
  }

  return NextResponse.redirect(`${origin}/?auth=error`);
}
