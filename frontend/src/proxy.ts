import { type NextRequest } from "next/server";
import { routeAdminHost } from "@/lib/admin/adminProxy";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  // The admin subdomain never touches the Supabase session logic below.
  const adminResponse = routeAdminHost(request);
  if (adminResponse) return adminResponse;

  return updateSession(request);
}

export const config = {
  // api/analytics/hit is left out: the page-view beacon needs no login session, and refreshing one on
  // every page view would double the site's calls to Supabase Auth. (The route itself refuses the
  // admin host, which this matcher would otherwise have shut out.)
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/analytics/hit|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
