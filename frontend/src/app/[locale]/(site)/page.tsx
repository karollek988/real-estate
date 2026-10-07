import type { Metadata } from "next";
import { LandingHero } from "@/components/landing/LandingHero";
import { AnalyzeSection } from "@/components/landing/AnalyzeSection";
import { HowItWorksSection } from "@/components/sections/HowItWorksSection";
import { AreasSection } from "@/components/sections/AreasSection";
import { PricingSection } from "@/components/sections/PricingSection";
import { ExampleReportSection } from "@/components/sections/ExampleReportSection";
import { KnowledgeSection } from "@/components/sections/KnowledgeSection";
import { FaqSection } from "@/components/sections/FaqSection";
import { ContactSection } from "@/components/sections/ContactSection";
import { ClientMessages } from "@/i18n/ClientMessages";
import { pageLocale, type LocaleParams } from "@/i18n/page";
import { pageAlternates } from "@/i18n/seo";

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const locale = await pageLocale(params);
  // the site's own title and description (the layout's) are the start page's; this adds where it is in each language
  return { alternates: pageAlternates(locale, "/") };
}

/**
 * The landing page - the main conversion page. Understand the product (hero,
 * how it works, what the analysis covers - with the form to start one),
 * explore (areas and the map), understand the price, see the example report,
 * then questions and contact. Blog, news and guides have their own pages.
 */
export default async function Home({ params }: LocaleParams) {
  await pageLocale(params);
  return (
    <>
      <LandingHero />
      <ClientMessages areas={["sections", "packages", "landing", "forms", "faq", "exampleReport", "brf", "report"]}>
        <HowItWorksSection />
        <AnalyzeSection />
        <AreasSection />
        <PricingSection />
        <ExampleReportSection />
        <KnowledgeSection />
        <FaqSection contactHref="#kontakt" />
        <ContactSection />
      </ClientMessages>
    </>
  );
}
