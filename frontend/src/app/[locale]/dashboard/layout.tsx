import { SiteHeader } from "@/components/SiteHeader";
import { DashboardNav } from "@/components/dashboard/DashboardNav";
import { ClientMessages } from "@/i18n/ClientMessages";
import { pageLocale, type LocaleParams } from "@/i18n/page";

/** The signed-in pages are client components: their texts are sent to the browser here (the menu, the overview, the balance box ...). */
export default async function DashboardLayout({ children, params }: { children: React.ReactNode } & LocaleParams) {
  await pageLocale(params);
  return (
    <ClientMessages areas={["dashboard", "balance", "inspection", "forms", "report"]}>
      <div className="relative min-h-screen bg-ka-cream text-ka-ink">
        <SiteHeader />
        <DashboardNav />
        <main className="relative px-4 py-8 sm:px-6 lg:px-10">{children}</main>
      </div>
    </ClientMessages>
  );
}
