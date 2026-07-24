export interface IconFactRow {
  icon?: React.ReactNode;
  label: string;
  value: string;
}

/** Two-column icon + label + value list — the property-facts treatment from
 *  the blueprint, built from the exact same rows KeyValueTable would render
 *  (this only changes presentation, not which facts appear). */
export function IconFactGrid({ rows }: { rows: IconFactRow[] }) {
  return (
    <div className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
      {rows.map((row) => (
        <div key={row.label} className="flex items-center gap-3 border-b border-black/[0.08] py-2.5">
          {row.icon && (
            <span className="flex h-6 w-6 shrink-0 items-center justify-center text-[#B98A2E]">{row.icon}</span>
          )}
          <span className="w-[42%] shrink-0 text-[12.5px] text-[#8C8471]">{row.label}</span>
          <span
            className={`flex-1 text-[13px] font-medium ${row.value === "Uppgift saknas" ? "italic text-[#8C8471]" : "text-[#12271D]"}`}
          >
            {row.value}
          </span>
        </div>
      ))}
    </div>
  );
}
