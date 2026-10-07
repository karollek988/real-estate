import { NextResponse } from "next/server";
import { chosenLocale } from "@/i18n/chosenLocale";
import { localizeUrl } from "@/i18n/redirect";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(localizeUrl(new URL(next, origin), await chosenLocale()));
    }
  }

  return NextResponse.redirect(localizeUrl(new URL("/?auth=error", origin), await chosenLocale()));
}
