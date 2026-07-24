function formatSekM2(value: number): string {
  return `${new Intl.NumberFormat("sv-SE").format(Math.round(value))} kr/m²`;
}

/** Two horizontal bars comparing this property's price/m² against the area median. */
export function PriceComparisonBar({
  thisPricePerM2,
  areaMedianPerM2,
}: {
  thisPricePerM2: number;
  areaMedianPerM2: number;
}) {
  const max = Math.max(thisPricePerM2, areaMedianPerM2) * 1.08;
  const thisPct = (thisPricePerM2 / max) * 100;
  const areaPct = (areaMedianPerM2 / max) * 100;

  return (
    <div className="mt-2 space-y-4">
      <div>
        <div className="mb-1 flex items-baseline justify-between text-[12px]">
          <span className="text-[#5B5648]">Denna bostad</span>
          <span className="font-semibold text-[#12271D]">{formatSekM2(thisPricePerM2)}</span>
        </div>
        <div className="h-2 w-full rounded-sm bg-black/[0.06]">
          <div className="h-2 rounded-sm bg-[#12271D]" style={{ width: `${thisPct}%` }} />
        </div>
      </div>
      <div>
        <div className="mb-1 flex items-baseline justify-between text-[12px]">
          <span className="text-[#5B5648]">Områdets median</span>
          <span className="font-semibold text-[#12271D]">{formatSekM2(areaMedianPerM2)}</span>
        </div>
        <div className="h-2 w-full rounded-sm bg-black/[0.06]">
          <div className="h-2 rounded-sm bg-[#B98A2E]" style={{ width: `${areaPct}%` }} />
        </div>
      </div>
    </div>
  );
}
