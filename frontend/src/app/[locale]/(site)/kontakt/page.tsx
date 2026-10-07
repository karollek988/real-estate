import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ContactSection } from "@/components/sections/ContactSection";
import { FaqSection } from "@/components/sections/FaqSection";
import { ROUTES } from "@/components/site/navigation";
import { ClientMessages } from "@/i18n/ClientMessages";
import { pageLocale, type LocaleParams } from "@/i18n/page";
import { pageMetadata } from "@/i18n/seo";

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const locale = await pageLocale(params);
  const t = await getTranslations({ locale, namespace: "pages.contact.meta" });
  return pageMetadata(locale, ROUTES.kontakt, { title: t("title"), description: t("description", { email: "kontakt@kopanalys.se" }) });
}

/** The contact form first, then the answers to what most people ask. */
export default async function KontaktPage({ params }: LocaleParams) {
  await pageLocale(params);
  const t = await getTranslations("pages.contact");
  return (
    <ClientMessages areas={["sections", "faq"]}>
      <div className="pt-4">
        <ContactSection titleAs="h1" title={t("title")} />
      </div>
      <FaqSection contactHref="#kontakt" />
    </ClientMessages>
  );
}
