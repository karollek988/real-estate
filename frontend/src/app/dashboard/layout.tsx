import { SiteHeader } from "@/components/SiteHeader";
import { DashboardBackground } from "@/components/dashboard/DashboardBackground";
import { DashboardNav } from "@/components/dashboard/DashboardNav";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen bg-[#111927]">
      <DashboardBackground />
      <SiteHeader />
      <DashboardNav />
      <main className="relative px-4 py-8 sm:px-6 lg:px-10">{children}</main>
    </div>
  );
}
