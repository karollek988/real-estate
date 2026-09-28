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
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
