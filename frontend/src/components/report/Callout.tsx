/** Tinted callout box with an icon — for a single standout takeaway
 *  (e.g. "how nearby projects could affect you") rather than another
 *  paragraph blending into the page. */
export function Callout({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mt-6 flex gap-3 rounded-md border border-[#B98A2E]/25 bg-[#B98A2E]/[0.06] px-4 py-3.5">
      <span className="mt-0.5 shrink-0 text-[#B98A2E]">{icon}</span>
      <p className="text-[13px] leading-relaxed text-[#3A362C]">{children}</p>
    </div>
  );
}
