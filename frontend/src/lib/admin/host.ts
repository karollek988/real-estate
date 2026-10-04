/**
 * Host routing for the admin portal. The portal is served only on the admin
 * hostnames below; `proxy.ts` rewrites "/" on those hosts to ADMIN_PAGE_PATH
 * and hides ADMIN_PAGE_PATH / the admin API from every other host.
 */

/** Internal route of the portal page (src/pages/admin-portal). Never the public URL. */
export const ADMIN_PAGE_PATH = "/admin-portal";
export const ADMIN_LOGIN_PATH = "/api/admin-portal/login";
export const ADMIN_LOGOUT_PATH = "/api/admin-portal/logout";

// admin.localhost resolves to loopback in Chromium/Firefox, so the portal can be
// developed locally at http://admin.localhost:3001 without touching a hosts file.
const ADMIN_HOSTNAMES = new Set(["admin.kopanalys.se", "admin.localhost"]);

export function isAdminHost(hostHeader: string | null | undefined): boolean {
  if (!hostHeader) return false;
  const hostname = hostHeader
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "")
    .replace(/\.$/, "");
  return ADMIN_HOSTNAMES.has(hostname);
}
