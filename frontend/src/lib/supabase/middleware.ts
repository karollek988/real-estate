import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getPathname } from "@/i18n/navigation";
import { splitLocale } from "@/i18n/path";

const PROTECTED_PREFIXES = ["/dashboard", "/report", "/admin"];

type CookieToSet = { name: string; value: string; options?: Parameters<NextResponse["cookies"]["set"]>[2] };

/**
 * Refreshes the Supabase session (new tokens, when the old ones are about to expire) and keeps signed-out
 * visitors out of the signed-in pages.
 *
 * `respond` makes the response for an ordinary request - the language routing of proxy.ts. It is called
 * AFTER the session has been refreshed, with the request that now carries the refreshed cookies, so a page
 * rendered for this very request sees the new tokens (and not the old ones, which Supabase has already
 * retired). The refreshed cookies are then put on whatever response it returns.
 */
export async function updateSession(request: NextRequest, respond: (request: NextRequest) => NextResponse = (req) => NextResponse.next({ request: req })) {
  const refreshedCookies: CookieToSet[] = [];

  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          request.cookies.set(name, value);
          refreshedCookies.push({ name, value, options });
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // "/en/dashboard" is the dashboard like "/dashboard" is: look at the page, not the language in front of it
  const { locale, rest } = splitLocale(request.nextUrl.pathname);
  const isProtectedRoute = PROTECTED_PREFIXES.some((prefix) => rest.startsWith(prefix));

  let response: NextResponse;
  if (isProtectedRoute && !user) {
    // to the start page of the visitor's own language
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = getPathname({ locale, href: "/" });
    redirectUrl.search = "";
    redirectUrl.searchParams.set("auth", "required");
    response = NextResponse.redirect(redirectUrl);
  } else {
    response = respond(request);
  }

  for (const { name, value, options } of refreshedCookies) response.cookies.set(name, value, options);
  return response;
}
