import type { GetServerSideProps } from "next";
import Head from "next/head";
import { AdminLogin } from "@/components/admin/AdminLogin";
import { AdminShell } from "@/components/admin/AdminShell";
import { isAdminHost } from "@/lib/admin/host";
import { isAdminSessionValid, isSecureRequest } from "@/lib/admin/session";
import type { AdminStatsResult } from "@/lib/admin/stats";
import { loadMeasuredAcquisition } from "@/lib/admin/acquisitionData";
import { loadAdminStats } from "@/lib/admin/statsData";
import type { MeasuredResult } from "@/lib/markov/measured";

interface AdminPortalProps {
  authenticated: boolean;
  /** only ever set for a signed-in admin: the numbers are not in the page for anyone else */
  stats: AdminStatsResult | null;
  /** where new visitors come from, as measured; the Markov simulator starts from it */
  measured: MeasuredResult | null;
}

/**
 * The admin portal. proxy.ts rewrites "/" on admin.kopanalys.se to this page and
 * answers 404 for it on every other host; the host is re-checked here as well.
 * Signed out: the login form. Signed in: the statistics (and the Markov simulator's
 * tab), read when the page is built.
 */
export const getServerSideProps: GetServerSideProps<AdminPortalProps> = async ({ req, res }) => {
  if (!isAdminHost(req.headers.host)) return { notFound: true };

  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");

  const forwardedProto = req.headers["x-forwarded-proto"];
  const secure = isSecureRequest(
    Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto,
    "encrypted" in req.socket && req.socket.encrypted ? "https:" : "http:"
  );
  const authenticated = isAdminSessionValid(req.headers.cookie, secure);
  const [stats, measured] = authenticated ? await Promise.all([loadAdminStats(), loadMeasuredAcquisition()]) : [null, null];
  return { props: { authenticated, stats, measured } };
};

export default function AdminPortal({ authenticated, stats, measured }: AdminPortalProps) {
  return (
    <>
      <Head>
        <title>{authenticated ? "Köpanalys Admin" : "Logga in | Köpanalys Admin"}</title>
        <meta name="robots" content="noindex, nofollow, noarchive" />
        {/* the browser's own bar takes the page colour: $ka-cream (a stylesheet variable cannot be read here) */}
        <meta name="theme-color" content="#f8f5f1" />
        <link rel="icon" href="/icon.png" />
      </Head>
      {authenticated && stats && measured ? <AdminShell stats={stats} measured={measured} /> : <AdminLogin />}
    </>
  );
}
