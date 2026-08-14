/** Tinted callout box with an icon — for a single standout takeaway
 *  (e.g. "how nearby projects could affect you") rather than another
 *  paragraph blending into the page. `accent` lets each chapter tint this
 *  in its own color (see ChapterTitle/SubHeading in report/page.tsx);
 *  defaults to the report's gold brand color, unchanged from before. Hex
 *  alpha suffixes (`40`/`0F`) reproduce the original border/25 + bg/[0.06]
 *  Tailwind opacities for an arbitrary runtime color, since Tailwind's
 *  arbitrary-value classes can't take a dynamic prop value. */
export function Callout({
  icon,
  children,
  accent = "#B98A2E",
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  accent?: string;
}) {
  return (
    <div
      className="mt-6 flex gap-3 rounded-md border px-4 py-3.5"
      style={{ borderColor: `${accent}40`, backgroundColor: `${accent}0F` }}
    >
      <span className="mt-0.5 shrink-0" style={{ color: accent }}>{icon}</span>
      <p className="text-[13.5px] leading-relaxed text-[#3A362C]">{children}</p>
    </div>
  );
}
