import type { NextConfig } from "next";

// Baseline security headers (2026-09 production-readiness pass). No
// Content-Security-Policy here on purpose — this app loads Stripe.js,
// OpenAI-backed chat, Google/system fonts and Supabase Storage images, and a
// CSP tight enough to matter but wrong in one directive can silently break
// checkout — that needs its own careful pass with real testing, not a
// same-day addition alongside everything else in this audit.
const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

// Admin portal (admin.kopanalys.se). Unlike the public site it loads no
// Stripe/OpenAI/Supabase, so a strict CSP is safe here - and worth having: the
// embedded map workspace builds markup with innerHTML, and `script-src 'self'`
// means injected markup can never run script. Production only, because the
// dev server needs eval/inline scripts for hot reload. Allowed beyond 'self':
// https images (map tiles and user-entered listing photos), Nominatim
// (search/geocoding), and inline styles (Leaflet positions elements with them).
const ADMIN_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self'",
  "connect-src 'self' https://nominatim.openstreetmap.org",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

// Applied after SECURITY_HEADERS, so on the admin host these override it (Next
// lets the last matching rule win per header key) - geolocation is allowed
// for the map's "use my location" button.
const ADMIN_HEADERS = [
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
  { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ...(process.env.NODE_ENV === "production" ? [{ key: "Content-Security-Policy", value: ADMIN_CSP }] : []),
];

const nextConfig: NextConfig = {
  // Lets the dev server talk to the admin portal opened at http://admin.localhost:3001.
  allowedDevOrigins: ["admin.localhost"],
  async headers() {
    return [
      { source: "/:path*", headers: SECURITY_HEADERS },
      { source: "/:path*", has: [{ type: "host", value: "admin\\.(kopanalys\\.se|localhost)" }], headers: ADMIN_HEADERS },
    ];
  },
};

export default nextConfig;
