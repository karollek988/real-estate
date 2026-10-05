import { LandingHero } from "@/components/landing/LandingHero";
import { AnalyzeSection } from "@/components/landing/AnalyzeSection";
import { HowItWorksSection } from "@/components/sections/HowItWorksSection";
import { AreasSection } from "@/components/sections/AreasSection";
import { PricingSection } from "@/components/sections/PricingSection";
import { ExampleReportSection } from "@/components/sections/ExampleReportSection";
import { KnowledgeSection } from "@/components/sections/KnowledgeSection";
import { FaqSection } from "@/components/sections/FaqSection";
import { ContactSection } from "@/components/sections/ContactSection";

/**
 * The landing page - the main conversion page. Understand the product (hero,
 * how it works, what the analysis covers - with the form to start one),
 * explore (areas and the map), understand the price, see the example report,
 * then questions and contact. Blog, news and guides have their own pages.
 */
export default function Home() {
  return (
    <>
      <LandingHero />
      <HowItWorksSection />
      <AnalyzeSection />
      <AreasSection />
      <PricingSection />
      <ExampleReportSection />
      <KnowledgeSection />
      <FaqSection contactHref="#kontakt" />
      <ContactSection />
    </>
  );
}
