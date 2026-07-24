"use client";

import { Reveal } from "@/components/Reveal";

/**
 * Subtle glowing hairline between major sections. Zero layout height (the
 * line is absolutely positioned) so it never shifts existing spacing; it
 * fades in when scrolled into view and back out as the next section takes
 * over, via the shared Reveal observer.
 */
export function SectionDivider() {
  return (
    <div aria-hidden="true" className="relative h-0">
      <Reveal variant="fade" className="absolute inset-x-6 -top-px">
        <span className="section-divider mx-auto block h-px w-full max-w-[70%]" />
      </Reveal>
    </div>
  );
}
