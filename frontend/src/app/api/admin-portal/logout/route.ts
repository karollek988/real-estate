import { isAdminHost } from "@/lib/admin/host";
import { adminJson, isSameOriginRequest } from "@/lib/admin/requestGuards";
import { buildClearedSessionCookie, isSecureRequest } from "@/lib/admin/session";

export async function POST(request: Request): Promise<Response> {
  if (!isAdminHost(request.headers.get("host"))) return new Response("Not found", { status: 404 });
  if (!isSameOriginRequest(request)) return adminJson({ error: "forbidden" }, 403);

  const secure = isSecureRequest(request.headers.get("x-forwarded-proto"), new URL(request.url).protocol);
  return adminJson({ ok: true }, 200, { "Set-Cookie": buildClearedSessionCookie(secure) });
}
