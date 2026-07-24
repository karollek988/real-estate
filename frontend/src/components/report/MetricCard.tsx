/** Small stat card — label + value, optionally an icon and a sublabel.
 *  Used wherever the report previously showed "Label: value" as a plain
 *  table row and a card reads more clearly (price facts, BRF metrics,
 *  macro indicators). */
export function MetricCard({
  icon,
  label,
  value,
  sub,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-md border border-black/[0.08] bg-white/60 px-4 py-3.5">
      <div className="flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-wide text-[#8C8471]">
        {icon && <span className="shrink-0 text-[#B98A2E]">{icon}</span>}
        {label}
      </div>
      <p className="mt-1.5 text-[16px] font-semibold leading-tight text-[#12271D]">{value}</p>
      {sub && <p className="mt-0.5 text-[11.5px] text-[#8C8471]">{sub}</p>}
    </div>
  );
}
