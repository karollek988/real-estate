/**
 * DEV ONLY: promotes one local account to unlimited Premium/Admin so the full
 * product (including the Premium report) can be tested without paying.
 *
 * Never active outside `next dev` (NODE_ENV !== "development" always
 * returns false), and only for the configured email — everyone else sees
 * the normal free-tier product untouched.
 */
const DEV_ADMIN_EMAIL = process.env.NEXT_PUBLIC_DEV_ADMIN_EMAIL ?? "karollek98@gmail.com";

export function isDevAdmin(email: string | null | undefined): boolean {
  if (process.env.NODE_ENV !== "development") return false;
  if (!email) return false;
  return email.toLowerCase() === DEV_ADMIN_EMAIL.toLowerCase();
}
