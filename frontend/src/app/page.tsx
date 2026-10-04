import { SiteHeader } from "@/components/SiteHeader";
import { LandingHero } from "@/components/landing/LandingHero";
import { AnalyzeSection } from "@/components/landing/AnalyzeSection";
import { NewsSection } from "@/components/sections/NewsSection";
import { ProblemSection } from "@/components/sections/ProblemSection";
import { HowItWorksSection } from "@/components/sections/HowItWorksSection";
import { PricingSection } from "@/components/sections/PricingSection";
import { ExampleReportSection } from "@/components/sections/ExampleReportSection";
import { InsightsSection } from "@/components/sections/InsightsSection";
import { InfoSection } from "@/components/sections/InfoSection";
import { FaqSection } from "@/components/sections/FaqSection";
import { ContactSection } from "@/components/sections/ContactSection";
import { displaySerif } from "@/lib/fonts";

export default function Home() {
  return (
    <div className={`${displaySerif.variable} min-h-screen bg-ka-cream text-ka-text`}>
      <SiteHeader variant="light" />

      <main>
        <LandingHero />
        <AnalyzeSection />

        {/* The pitch deck's story: the problem, the solution, an example, the prices */}
        <ProblemSection />
        <HowItWorksSection />
        <ExampleReportSection />
        <PricingSection />
        <InfoSection />

        {/* "Blogg & Nyheter" in the header lands here: live market data, then the news */}
        <div id="nyheter" className="scroll-mt-20 bg-ka-cream">
          <InsightsSection />
          <NewsSection />
        </div>

        <FaqSection />
        <ContactSection />
      </main>
    </div>
  );
}
