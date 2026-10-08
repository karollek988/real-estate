import type { AppProps } from "next/app";
import { Inter } from "next/font/google";
import "@/components/admin/atlas/atlas.scss";
import "@/components/admin/admin.scss";
import { displaySerif } from "@/lib/fonts";

const inter = Inter({ subsets: ["latin"], display: "swap" });

/**
 * Root of the Pages Router, which holds only the admin portal
 * (src/pages/admin-portal, served at admin.kopanalys.se).
 *
 * It lives in the Pages Router on purpose: app/layout.tsx wraps every App
 * Router page in Tailwind and the marketing chrome (footer, cookie banner,
 * chat widget, Supabase auth provider) - none of which belongs on the admin
 * host - and Next.js only lets routes escape that layout by moving them into
 * a separate route group. Pages Router routes are outside it, so the public
 * site's route tree stays untouched.
 */
export default function AdminApp({ Component, pageProps }: AppProps) {
  return (
    <div className={`${inter.className} ${displaySerif.variable}`}>
      <Component {...pageProps} />
    </div>
  );
}
