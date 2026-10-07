import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { PublicMap } from "@/components/map/PublicMap";
import { ClientMessages } from "@/i18n/ClientMessages";
import { ROUTES } from "@/components/site/navigation";
import { pageLocale, type LocaleParams } from "@/i18n/page";
import { pageMetadata } from "@/i18n/seo";

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const locale = await pageLocale(params);
  const t = await getTranslations({ locale, namespace: "pages.map.meta" });
  return pageMetadata(locale, ROUTES.karta, { title: t("title"), description: t("description") });
}

/**
 * The map filling the screen under the site header; the footer follows below
 * it. That this is a preview with example listings is said in the map's top
 * bar, next to the search (components/admin/atlas/atlas.ts), which only exists
 * once the map has mounted - so the page's h1 is here, in the server-rendered
 * HTML, and the top bar shows the same word as a plain label.
 */
export default async function KartaPage({ params }: LocaleParams) {
  await pageLocale(params);
  const t = await getTranslations("pages.map");
  return (
    <div className="h-[calc(100svh-64px)] min-h-[640px] lg:h-[calc(100svh-76px)] 2xl:h-[calc(100svh-84px)]">
      <h1 className="sr-only">{t("title")}</h1>
      <ClientMessages areas={["map"]}>
        <Suspense fallback={<div className="h-full bg-ka-cream" />}>
          <PublicMap />
        </Suspense>
      </ClientMessages>
    </div>
  );
}
