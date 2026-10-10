import Link from "next/link";
import { Inter } from "next/font/google";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import "../globals.scss";
import { createClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/lib/auth/admin";
import brfSv from "@/i18n/messages/sv/brf";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Admin · Köpanalys",
  robots: { index: false, follow: false },
};

/**
 * The admin console - BRF reviews (/admin/brf) and the Kunskap content editor
 * (/admin/content), the map's pins (/admin/map): Köpanalys admins only (lib/auth/admin.ts). Everyone else
 * gets a plain 404. It is a tool for the team and stays in Swedish, outside the language folder
 * ([locale]), so it is its own root layout with its own <html>.
 *
 * It also has no language provider of its own, so it supplies one: a shared client component that calls
 * next-intl's useTranslations (the upload box on the review page does) throws an Error with no message in
 * production when no provider is above it, and the whole page goes blank. Add the message areas such a
 * component needs to `messages` below.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/?auth=required");
  if (!isAdminUser(user)) notFound();

  return (
    <html lang="sv">
      <body className={`${inter.variable} antialiased`} suppressHydrationWarning>
        <div className="min-h-screen bg-ka-cream text-ka-text">
          <header className="border-b border-ka-line-strong bg-white">
            <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
              <div className="flex items-center gap-3">
                <Link href="/admin/brf" className="text-sm font-semibold text-ka-ink">
                  Köpanalys · Admin
                </Link>
                <nav aria-label="Admin" className="flex items-center gap-1.5">
                  <Link href="/admin/brf" className="rounded-full bg-ka-ink/[0.06] px-2.5 py-0.5 text-xs font-medium text-ka-ink hover:bg-ka-ink/[0.12]">
                    BRF-analyser
                  </Link>
                  <Link href="/admin/content" className="rounded-full bg-ka-ink/[0.06] px-2.5 py-0.5 text-xs font-medium text-ka-ink hover:bg-ka-ink/[0.12]">
                    Innehåll
                  </Link>
                  <Link href="/admin/map" className="rounded-full bg-ka-ink/[0.06] px-2.5 py-0.5 text-xs font-medium text-ka-ink hover:bg-ka-ink/[0.12]">
                    Karta
                  </Link>
                </nav>
              </div>
              <div className="flex items-center gap-4 text-xs text-ka-muted">
                <span>{user.email}</span>
                <Link href="/dashboard" className="font-medium text-ka-ink hover:underline">
                  Till kontot
                </Link>
              </div>
            </div>
          </header>
          <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
            <NextIntlClientProvider locale="sv" messages={{ brf: brfSv }} timeZone="Europe/Stockholm">
              {children}
            </NextIntlClientProvider>
          </main>
        </div>
      </body>
    </html>
  );
}
