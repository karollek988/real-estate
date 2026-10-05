"use client";

import { Reveal } from "@/components/Reveal";

/**
 * Shared premium introduction for every major section below the hero:
 * category pill + serif headline + short explanation on the left (slides in
 * from the left), a decorative icon tile on the right (slides in from the
 * right). Uses the site's serif (font-display), which the (site) layout loads.
 * `as="h1"` lets a page open with it.
 */
export function SectionIntro({
  icon: Icon,
  label,
  title,
  titleId,
  description,
  action,
  as: Heading = "h2",
}: {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  label: string;
  title: React.ReactNode;
  titleId?: string;
  description: string;
  action?: React.ReactNode;
  as?: "h1" | "h2";
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-6">
      <Reveal variant="left">
        <div className="max-w-[660px]">
          <p className="inline-flex items-center gap-2 rounded-full bg-ka-sage/70 px-3.5 py-1.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-ka-green-900">
            <Icon className="h-4 w-4" />
            {label}
          </p>
          <Heading
            id={titleId}
            className="mt-5 font-display text-[34px] font-bold leading-[1.08] tracking-[-0.015em] text-ka-ink sm:text-[44px]"
          >
            {title}
          </Heading>
          <p className="mt-4 max-w-[560px] text-[16px] leading-relaxed text-ka-muted sm:text-[17px]">{description}</p>
          {action && <div className="mt-6">{action}</div>}
        </div>
      </Reveal>

      <Reveal variant="right" className="hidden lg:block">
        <div aria-hidden className="relative flex h-28 w-28 items-center justify-center rounded-[28px] border border-ka-line bg-white shadow-[0_24px_48px_-32px_rgba(15,31,24,0.5)]">
          <div className="absolute inset-0 rounded-[28px] bg-[radial-gradient(circle_at_center,rgba(42,120,84,0.13),transparent_72%)]" />
          <Icon className="relative h-10 w-10 text-ka-green-700" />
        </div>
      </Reveal>
    </div>
  );
}
