import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_LOGIN_PATH, ADMIN_LOGOUT_PATH, ADMIN_PAGE_PATH, isAdminHost } from "./host";

const notFound = () => new NextResponse("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });

/**
 * Host-based routing for admin.kopanalys.se, run first by proxy.ts.
 *
 * - Admin host: "/" is rewritten to the portal page; only the portal's own
 *   login/logout API and Next.js internals stay reachable - every other site
 *   page and API route answers 404 there, so the admin host exposes no more
 *   than the portal.
 * - Any other host: the portal page and its API do not exist (404).
 *
 * Returns null when the request is an ordinary site request that proxy.ts
 * should keep handling.
 */
export function routeAdminHost(request: NextRequest): NextResponse | null {
  const { pathname } = request.nextUrl;

  if (isAdminHost(request.headers.get("host"))) {
    if (pathname === "/") {
      const url = request.nextUrl.clone();
      url.pathname = ADMIN_PAGE_PATH;
      url.search = "";
      return NextResponse.rewrite(url);
    }
    if (pathname.startsWith("/_next/") || pathname.startsWith("/__nextjs") || pathname === ADMIN_LOGIN_PATH || pathname === ADMIN_LOGOUT_PATH) {
      return NextResponse.next();
    }
    return notFound();
  }

  // Also catches /_next/data/<build>/admin-portal.json and /api/admin-portal/*.
  if (pathname.includes("admin-portal")) return notFound();
  return null;
}
