/** Icon + count mini-cards in a row — the "large icon row" treatment for
 *  amenity counts, instead of a plain label/value table. */
export function AmenityGrid({
  items,
}: {
  items: { icon: React.ReactNode; label: string; value: string }[];
}) {
  return (
    <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-6">
      {items.map((item, i) => (
        <div key={i} className="flex flex-col items-center rounded-md border border-black/[0.08] bg-white/60 px-2 py-3.5 text-center">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#12271D]/[0.06] text-[#12271D]">
            {item.icon}
          </span>
          <p className="mt-2 text-[16px] font-semibold leading-none text-[#12271D]">{item.value}</p>
          <p className="mt-1.5 text-[10px] leading-tight text-[#8C8471]">{item.label}</p>
        </div>
      ))}
    </div>
  );
}
