"use client";

import { Reveal } from "@/components/Reveal";

/**
 * Shared premium introduction for every major section below the hero:
 * icon tile + green category label + headline + short explanation on the
 * left (slides in from the left), a decorative illustration on the right
 * (slides in from the right). Keeps the hero's existing type scale.
 */
export function SectionIntro({
  icon: Icon,
  label,
  title,
  description,
  action,
}: {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  label: string;
  title: React.ReactNode;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-6">
      <Reveal variant="left">
        <div className="max-w-[620px]">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-green-500/25 bg-green-500/10">
            <Icon className="h-6 w-6 text-green-400" />
          </span>
          <p className="mt-5 text-sm font-semibold text-green-400">{label}</p>
          <h2 className="mt-2 text-[32px] font-bold leading-tight tracking-tight sm:text-[36px]">
            {title}
          </h2>
          <p className="mt-3 max-w-[520px] text-[15px] leading-relaxed text-neutral-400">
            {description}
          </p>
          {action && <div className="mt-6">{action}</div>}
        </div>
      </Reveal>

      <Reveal variant="right" className="hidden lg:block">
        <div className="relative flex h-28 w-28 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03]">
          <div className="absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_center,rgba(74,222,128,0.14),transparent_72%)]" />
          <Icon className="relative h-10 w-10 text-green-400" />
        </div>
      </Reveal>
    </div>
  );
}
