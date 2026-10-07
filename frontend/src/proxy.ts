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
  // api/analytics/hit and api/analytics/arrival are left out: the beacons need no login session, and
  // refreshing one on every page view would double the site's calls to Supabase Auth. (The routes
  // themselves refuse the admin host, which this matcher would otherwise have shut out.)
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/analytics/(?:hit|arrival)|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
