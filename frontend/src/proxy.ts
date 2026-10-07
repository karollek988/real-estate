import { NextResponse, type NextRequest } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { routeAdminHost } from "@/lib/admin/adminProxy";
import { updateSession } from "@/lib/supabase/middleware";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale } from "@/i18n/locales";
import { isLanguageNeutral, splitLocale } from "@/i18n/path";
import { localizeUrl } from "@/i18n/redirect";
import { routing } from "@/i18n/routing";

const intl = createIntlMiddleware(routing);

/**
 * A visitor who has picked a language in the switcher gets it back on their next visit: an address in the
 * default language (kopanalys.se/priser) is answered with a redirect to their language (/en/pricing).
 * Nobody else is redirected: the browser's own language is never looked at. Returns null when no redirect applies.
 */
function rememberedLanguage(request: NextRequest): NextResponse | null {
  if (request.method !== "GET" && request.method !== "HEAD") return null;
  const remembered = request.cookies.get(LOCALE_COOKIE)?.value;
  if (!isLocale(remembered) || remembered === DEFAULT_LOCALE) return null;
  const { prefixed } = splitLocale(request.nextUrl.pathname);
  if (prefixed) return null;
  const url = localizeUrl(new URL(request.nextUrl.href), remembered);
  // not a page of the site (a file, an unknown address): nothing to translate
  if (url.pathname === request.nextUrl.pathname) return null;
  return NextResponse.redirect(url);
}

export async function proxy(request: NextRequest) {
  // The admin subdomain never touches the Supabase session logic below.
  const adminResponse = routeAdminHost(request);
  if (adminResponse) return adminResponse;

  return updateSession(request, (refreshed) => {
    if (isLanguageNeutral(refreshed.nextUrl.pathname)) return NextResponse.next({ request: refreshed });
    return rememberedLanguage(refreshed) ?? intl(refreshed);
  });
}

export const config = {
  // api/analytics/hit and api/analytics/arrival are left out: the beacons need no login session, and
  // refreshing one on every page view would double the site's calls to Supabase Auth. (The routes
  // themselves refuse the admin host, which this matcher would otherwise have shut out.)
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/analytics/(?:hit|arrival)|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
