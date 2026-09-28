/**
 * The single admin account for the admin portal (admin.kopanalys.se).
 *
 * The password is intentionally NOT stored anywhere - only its scrypt hash.
 * ADMIN_PASSWORD_HASH (server-only env var) overrides the built-in hash so the
 * password can be rotated without a code change; generate a new value with
 * `npm run admin:hash`.
 */
import { createHash, timingSafeEqual } from "node:crypto";
import { verifyPassword } from "./password";

export const ADMIN_USERNAME = "admin";

const BUILT_IN_PASSWORD_HASH =
  "scrypt:65536:8:2:jw38s4W7Tho3b_pzwzcZ5A:bNEi7C6_qkmw5uI_5rpDvCAU2718K-x3dqrsky1bGOnOKQ--1uNvzkvF-9CNnd05WgG_JO7DSRWHKkHGrbXdZw";

export function getAdminPasswordHash(): string {
  return process.env.ADMIN_PASSWORD_HASH?.trim() || BUILT_IN_PASSWORD_HASH;
}

function constantTimeEquals(a: string, b: string): boolean {
  // Hash first so the comparison is fixed-length and leaks nothing about length.
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(a), digest(b));
}

/**
 * The password is always verified - even for a wrong username - so a failed
 * login takes the same time either way and reveals nothing about which field
 * was wrong. Throws InvalidPasswordHashError / VerifierBusyError (see password.ts).
 */
export async function verifyAdminLogin(username: string, password: string): Promise<boolean> {
  const passwordOk = await verifyPassword(password, getAdminPasswordHash());
  const usernameOk = constantTimeEquals(username, ADMIN_USERNAME);
  return passwordOk && usernameOk;
}
