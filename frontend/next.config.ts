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

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
