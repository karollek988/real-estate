import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/lib/auth/admin";

export const metadata: Metadata = {
  title: "Granskning · Köpanalys",
  robots: { index: false, follow: false },
};

/** The review console: Köpanalys reviewers only (lib/auth/admin.ts). Everyone else gets a plain 404. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/?auth=required");
  if (!isAdminUser(user)) notFound();

  return (
    <div className="min-h-screen bg-[#F5F4F0] text-[#1B1F27]">
      <header className="border-b border-black/10 bg-white">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/admin/brf" className="text-sm font-semibold text-[#12271D]">
              Köpanalys · Granskning
            </Link>
            <span className="rounded-full bg-[#12271D]/[0.06] px-2.5 py-0.5 text-xs font-medium text-[#12271D]">BRF-analyser</span>
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
  );
}
