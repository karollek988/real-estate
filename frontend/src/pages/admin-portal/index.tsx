import type { GetServerSideProps } from "next";
import Head from "next/head";
import { AdminLogin } from "@/components/admin/AdminLogin";
import { AdminShell } from "@/components/admin/AdminShell";
import { isAdminHost } from "@/lib/admin/host";
import { isAdminSessionValid, isSecureRequest } from "@/lib/admin/session";

interface AdminPortalProps {
  authenticated: boolean;
}

/**
 * The admin portal. proxy.ts rewrites "/" on admin.kopanalys.se to this page and
 * answers 404 for it on every other host; the host is re-checked here as well.
 * Signed out: the login form. Signed in: the embedded map workspace.
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
  return { props: { authenticated: isAdminSessionValid(req.headers.cookie, secure) } };
};

export default function AdminPortal({ authenticated }: AdminPortalProps) {
  return (
    <>
      <Head>
        <title>{authenticated ? "Köpanalys Admin" : "Logga in | Köpanalys Admin"}</title>
        <meta name="robots" content="noindex, nofollow, noarchive" />
        <meta name="theme-color" content="#0a0f0d" />
        <link rel="icon" href="/icon.png" />
      </Head>
      {authenticated ? <AdminShell /> : <AdminLogin />}
    </>
  );
}
