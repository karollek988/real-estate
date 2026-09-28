/**
 * Stateless signed session cookie for the admin portal.
 *
 * Token: v1.<expiry unix seconds>.<nonce>.<HMAC-SHA256 signature>
 *
 * The signature also covers a fingerprint of the current password hash, so
 * changing the admin password invalidates every existing session at once.
 * The signing key must come from a secret that is NOT in the repository:
 * ADMIN_SESSION_SECRET, or - if that is unset - a key derived (HKDF, domain
 * separated) from SUPABASE_SERVICE_ROLE_KEY. Without either, sessions cannot
 * be issued or accepted in production (fails closed).
 */
import { createHash, createHmac, hkdfSync, randomBytes, timingSafeEqual } from "node:crypto";
import { getAdminPasswordHash } from "./credentials";

export const SESSION_TTL_SECONDS = 8 * 60 * 60;
const TOKEN_VERSION = "v1";
const MIN_SECRET_LENGTH = 32;

type DevSecretHolder = typeof globalThis & { __kopanalysAdminDevSecret?: string };

export function sessionCookieName(secure: boolean): string {
  // The __Host- prefix makes browsers reject any copy set by a sibling
  // subdomain or the parent domain (cookie tossing) - it needs Secure, so
  // plain-http local development uses the unprefixed name.
  return secure ? "__Host-kp_admin" : "kp_admin";
}

export function isSecureRequest(forwardedProto: string | null | undefined, urlProtocol: string | undefined): boolean {
  const forwarded = forwardedProto?.split(",")[0]?.trim().toLowerCase();
  if (forwarded) return forwarded === "https";
  return urlProtocol === "https:";
}

function deriveKey(secret: string): Buffer {
  return Buffer.from(hkdfSync("sha256", secret, "kopanalys-admin-portal", "session-hmac-v1", 32));
}

/** null = no usable secret configured; callers must fail closed. */
export function getSessionKey(): Buffer | null {
  const explicit = process.env.ADMIN_SESSION_SECRET?.trim();
  if (explicit) return explicit.length >= MIN_SECRET_LENGTH ? deriveKey(explicit) : null;

  const shared = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (shared) return deriveKey(shared);

  if (process.env.NODE_ENV !== "production") {
    // Development only: an ephemeral per-process key (kept on globalThis so it
    // survives hot reloads) - restarting the dev server just signs you out.
    const holder = globalThis as DevSecretHolder;
    holder.__kopanalysAdminDevSecret ??= randomBytes(32).toString("hex");
    return deriveKey(holder.__kopanalysAdminDevSecret);
  }
  return null;
}

function passwordFingerprint(): string {
  return createHash("sha256").update(getAdminPasswordHash()).digest("hex").slice(0, 16);
}

function sign(key: Buffer, payload: string): Buffer {
  return createHmac("sha256", key).update(`${payload}.${passwordFingerprint()}`).digest();
}

export function createSessionToken(nowMs: number = Date.now()): string | null {
  const key = getSessionKey();
  if (!key) return null;
  const expires = Math.floor(nowMs / 1000) + SESSION_TTL_SECONDS;
  const payload = `${TOKEN_VERSION}.${expires}.${randomBytes(16).toString("base64url")}`;
  return `${payload}.${sign(key, payload).toString("base64url")}`;
}

export function verifySessionToken(token: string | null | undefined, nowMs: number = Date.now()): boolean {
  if (!token || token.length > 256) return false;
  const parts = token.split(".");
  if (parts.length !== 4 || parts[0] !== TOKEN_VERSION) return false;
  const [, expiresRaw, nonce, signature] = parts;
  if (!/^\d{1,12}$/.test(expiresRaw) || !/^[A-Za-z0-9_-]{16,32}$/.test(nonce) || !/^[A-Za-z0-9_-]{43}$/.test(signature)) {
    return false;
  }
  const nowSeconds = Math.floor(nowMs / 1000);
  const expires = Number(expiresRaw);
  // Reject expired tokens, and tokens claiming a lifetime longer than we ever issue.
  if (expires <= nowSeconds || expires > nowSeconds + SESSION_TTL_SECONDS + 60) return false;

  const key = getSessionKey();
  if (!key) return false;
  const expected = sign(key, `${TOKEN_VERSION}.${expiresRaw}.${nonce}`);
  const provided = Buffer.from(signature, "base64url");
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

export function readCookie(cookieHeader: string | null | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator !== -1 && part.slice(0, separator).trim() === name) return part.slice(separator + 1).trim();
  }
  return null;
}

export function isAdminSessionValid(cookieHeader: string | null | undefined, secure: boolean): boolean {
  return verifySessionToken(readCookie(cookieHeader, sessionCookieName(secure)));
}

function cookieAttributes(secure: boolean, maxAgeSeconds: number): string {
  return ["Path=/", "HttpOnly", "SameSite=Strict", `Max-Age=${maxAgeSeconds}`, ...(secure ? ["Secure"] : [])].join("; ");
}

export function buildSessionCookie(token: string, secure: boolean): string {
  return `${sessionCookieName(secure)}=${token}; ${cookieAttributes(secure, SESSION_TTL_SECONDS)}`;
}

export function buildClearedSessionCookie(secure: boolean): string {
  return `${sessionCookieName(secure)}=; ${cookieAttributes(secure, 0)}`;
}
