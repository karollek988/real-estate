import Link from "next/link";
import { Inter } from "next/font/google";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import "../globals.scss";
import { createClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/lib/auth/admin";

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
 * (/admin/content): Köpanalys admins only (lib/auth/admin.ts). Everyone else
 * gets a plain 404. It is a tool for the team and stays in Swedish, outside the language folder
 * ([locale]), so it is its own root layout with its own <html>.
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
        <div className="min-h-screen bg-[#F5F4F0] text-[#1B1F27]">
          <header className="border-b border-black/10 bg-white">
            <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
              <div className="flex items-center gap-3">
                <Link href="/admin/brf" className="text-sm font-semibold text-[#12271D]">
                  Köpanalys · Admin
                </Link>
                <nav aria-label="Admin" className="flex items-center gap-1.5">
                  <Link href="/admin/brf" className="rounded-full bg-[#12271D]/[0.06] px-2.5 py-0.5 text-xs font-medium text-[#12271D] hover:bg-[#12271D]/[0.12]">
                    BRF-analyser
                  </Link>
                  <Link href="/admin/content" className="rounded-full bg-[#12271D]/[0.06] px-2.5 py-0.5 text-xs font-medium text-[#12271D] hover:bg-[#12271D]/[0.12]">
                    Innehåll
                  </Link>
                </nav>
              </div>
              <div className="flex items-center gap-4 text-xs text-neutral-500">
                <span>{user.email}</span>
                <Link href="/dashboard" className="font-medium text-[#12271D] hover:underline">
                  Till kontot
                </Link>
              </div>
            </div>
          </header>
          <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">{children}</main>
        </div>
      </body>
    </html>
  );
}
