import { CraneIcon } from "@/components/icons";

/** One nearby planned/active development project. Deliberately not a dated
 *  timeline: the underlying data (Location Intelligence Engine bridge) only
 *  ever surfaces a project name, not a year or category, so a card is the
 *  most specific presentation the real data supports. */
export function ProjectCard({ name }: { name: string }) {
  return (
    <div className="flex items-start gap-3 rounded-md border border-black/[0.08] bg-white/60 px-4 py-3.5">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#12271D]/[0.06] text-[#12271D]">
        <CraneIcon className="h-4 w-4" />
      </span>
      <p className="text-[13.5px] leading-snug text-[#2A2820]">{name}</p>
    </div>
  );
}
