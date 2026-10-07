import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { isLocale, type AppLocale } from "@/i18n/locales";
import { chosenLocale } from "@/i18n/chosenLocale";
import { localizeUrl } from "@/i18n/redirect";
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
      // the language the person signed up in (stored with the account), else the one they picked in the picker
      const { data } = await supabase.auth.getUser();
      const stored = data.user?.user_metadata?.locale;
      const locale: AppLocale = isLocale(stored) ? stored : await chosenLocale();
      return NextResponse.redirect(localizeUrl(resolveNext(next, origin), locale));
    }
  }

  return NextResponse.redirect(localizeUrl(new URL("/?auth=error", origin), await chosenLocale()));
}
