import { verifyAdminLogin } from "@/lib/admin/credentials";
import { isAdminHost } from "@/lib/admin/host";
import { checkLoginThrottle, clearLoginFailures, recordLoginFailure } from "@/lib/admin/loginThrottle";
import { InvalidPasswordHashError, VerifierBusyError } from "@/lib/admin/password";
import { adminJson, isSameOriginRequest, readSmallJsonBody } from "@/lib/admin/requestGuards";
import { buildSessionCookie, createSessionToken, getSessionKey, isSecureRequest } from "@/lib/admin/session";
import { clientIp } from "@/lib/rateLimit";

const MAX_FIELD_LENGTH = 256;

const BODY_ERROR_STATUS = { unsupported_media_type: 415, too_large: 413, invalid_json: 400 } as const;

export async function POST(request: Request): Promise<Response> {
  if (!isAdminHost(request.headers.get("host"))) return new Response("Not found", { status: 404 });
  if (!isSameOriginRequest(request)) return adminJson({ error: "forbidden" }, 403);

  // Throttle before doing any work, so a locked-out client costs nothing.
  const client = clientIp(request);
  const throttle = checkLoginThrottle(client);
  if (throttle.locked) {
    return adminJson({ error: "too_many_attempts", retryAfterSeconds: throttle.retryAfterSeconds }, 429, {
      "Retry-After": String(throttle.retryAfterSeconds),
    });
  }

  const body = await readSmallJsonBody(request);
  if (!body.ok) return adminJson({ error: body.reason }, BODY_ERROR_STATUS[body.reason]);
  const { username, password } = (body.value ?? {}) as Record<string, unknown>;
  if (
    typeof username !== "string" ||
    typeof password !== "string" ||
    !password ||
    username.length > MAX_FIELD_LENGTH ||
    password.length > MAX_FIELD_LENGTH
  ) {
    return adminJson({ error: "invalid_request" }, 400);
  }

  if (!getSessionKey()) {
    console.error("[admin-portal] Login is disabled: set ADMIN_SESSION_SECRET (at least 32 characters) in this environment.");
    return adminJson({ error: "not_configured" }, 503);
  }

  let valid: boolean;
  try {
    valid = await verifyAdminLogin(username, password);
  } catch (error) {
    if (error instanceof VerifierBusyError) return adminJson({ error: "busy" }, 503, { "Retry-After": "2" });
    if (error instanceof InvalidPasswordHashError) {
      console.error("[admin-portal] Login is disabled: ADMIN_PASSWORD_HASH is missing or not a valid hash -", error.message);
      return adminJson({ error: "not_configured" }, 503);
    }
    throw error;
  }

  if (!valid) {
    recordLoginFailure(client);
    return adminJson({ error: "invalid_credentials" }, 401);
  }

  const token = createSessionToken();
  if (!token) return adminJson({ error: "not_configured" }, 503);
  clearLoginFailures(client);
  const secure = isSecureRequest(request.headers.get("x-forwarded-proto"), new URL(request.url).protocol);
  return adminJson({ ok: true }, 200, { "Set-Cookie": buildSessionCookie(token, secure) });
}
