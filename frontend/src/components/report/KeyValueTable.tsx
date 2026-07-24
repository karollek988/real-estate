import type { OverviewRow } from "@/lib/report/build";

/** Plain document table: label / value rows with a hairline divider — no cards, no shading. */
export function KeyValueTable({ rows }: { rows: OverviewRow[] }) {
  return (
    <table className="w-full border-collapse text-[13.5px]">
      <tbody>
        {(rows ?? []).map((row) => (
          <tr key={row.label} className="border-b border-black/10 last:border-0">
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
