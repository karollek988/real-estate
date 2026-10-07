import { SiteHeader } from "@/components/SiteHeader";
import { displaySerif } from "@/lib/fonts";

/**
 * Every public page of the redesign (the landing page, /karta, /priser, the
 * Kunskap pages ...): the light header on cream and the display serif for
 * headlines. The footer comes from the root layout. Each page renders its
 * content straight into <main>, which the header's skip link targets.
 */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${displaySerif.variable} min-h-screen bg-ka-cream text-ka-text`}>
      <SiteHeader variant="light" />
      {/* overflow-x: clip, not hidden: scroll reveals that slide in from the side can't widen the page, and sticky columns still work */}
      <main id="main" tabIndex={-1} className="overflow-x-clip outline-none">
        {children}
      </main>
    </div>
  );
}
