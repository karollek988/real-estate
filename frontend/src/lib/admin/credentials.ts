/**
 * The single admin account for the admin portal (admin.kopanalys.se).
 *
 * The password is intentionally NOT stored anywhere - only its scrypt hash, and
 * only in the server-only env var ADMIN_PASSWORD_HASH (generate it with
 * `npm run admin:hash`). The repository is public, so there is no built-in
 * fallback: without the variable, admin login is disabled (fails closed).
 */
import { createHash, timingSafeEqual } from "node:crypto";
import { InvalidPasswordHashError, verifyPassword } from "./password";

export const ADMIN_USERNAME = "admin";

/** null = ADMIN_PASSWORD_HASH is not set; callers must fail closed. */
export function getAdminPasswordHash(): string | null {
  return process.env.ADMIN_PASSWORD_HASH?.trim() || null;
}

function constantTimeEquals(a: string, b: string): boolean {
  // Hash first so the comparison is fixed-length and leaks nothing about length.
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(a), digest(b));
}

/**
 * The password is always verified - even for a wrong username - so a failed
 * login takes the same time either way and reveals nothing about which field
 * was wrong. Throws InvalidPasswordHashError (also when ADMIN_PASSWORD_HASH is
 * unset) / VerifierBusyError (see password.ts).
 */
export async function verifyAdminLogin(username: string, password: string): Promise<boolean> {
  const hash = getAdminPasswordHash();
  if (!hash) throw new InvalidPasswordHashError("ADMIN_PASSWORD_HASH is not set");
  const passwordOk = await verifyPassword(password, hash);
  const usernameOk = constantTimeEquals(username, ADMIN_USERNAME);
  return passwordOk && usernameOk;
}
