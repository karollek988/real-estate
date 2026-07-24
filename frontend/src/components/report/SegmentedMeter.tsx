/** Three-band meter (e.g. Lågt / Medel / Högt) with the active band filled
 *  gold and a marker under it — turns a single categorical read into the
 *  same "where does this fall" shape as the rest of the report's gauges. */
export function SegmentedMeter({
  bands,
  activeIndex,
}: {
  bands: string[];
  activeIndex: number;
}) {
  return (
    <div>
      <div className="flex h-2.5 w-full gap-1">
        {bands.map((band, i) => (
          <div
            key={band}
            className={`flex-1 rounded-sm ${i === activeIndex ? "bg-[#B98A2E]" : "bg-black/[0.07]"}`}
          />
        ))}
      </div>
      <div className="mt-2 flex w-full text-[10px] uppercase tracking-wide text-[#8C8471]">
        {bands.map((band, i) => (
          <span key={band} className={`flex-1 ${i === activeIndex ? "font-semibold text-[#12271D]" : ""} ${i === 1 ? "text-center" : i === bands.length - 1 ? "text-right" : "text-left"}`}>
            {band}
          </span>
        ))}
      </div>
    </div>
  );
}
