import type { OverviewRow } from "@/lib/report/build";

/** Document table: label / value rows with a hairline divider and a faint
 *  alternating row tint — makes it easier to track a row across the
 *  label/value gap at a glance without adding heavier card chrome. */
export function KeyValueTable({ rows }: { rows: OverviewRow[] }) {
  return (
    <table className="w-full border-collapse text-[14.5px]">
      <tbody>
        {(rows ?? []).map((row, i) => (
          <tr key={row.label} className={`border-b border-black/10 last:border-0 ${i % 2 === 1 ? "bg-black/[0.02]" : ""}`}>
            <td className="w-[38%] py-2.5 pr-4 align-top text-[#5B5648]">{row.label}</td>
            <td
              className={`py-2.5 align-top font-medium ${
                row.value === "Uppgift saknas" ? "italic text-[#8C8471]" : "text-[#12271D]"
              }`}
            >
              {row.value}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
