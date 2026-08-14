import type { ComparableSaleRow } from "@/lib/report/build";
import { sek, sekPerM2, dateSv } from "@/lib/report/build";

const NA = "Uppgift saknas";

/** Comparable-sold-homes table: address / sold date / price / living area /
 *  price per m² — mirrors KeyValueTable's hairline-divider + zebra-stripe
 *  look so it reads as the same document rather than a different component. */
export function ComparableSalesTable({ rows }: { rows: ComparableSaleRow[] }) {
  return (
    <div className="relative w-full overflow-x-auto">
      <table className="w-full min-w-[520px] border-collapse text-[13.5px]">
        <thead>
          <tr className="border-b border-black/10 text-left text-[11.5px] uppercase tracking-wide text-[#8C8471]">
            <th className="py-2 pr-3 font-medium">Adress</th>
            <th className="py-2 pr-3 font-medium">Såld</th>
            <th className="py-2 pr-3 text-right font-medium">Pris</th>
            <th className="py-2 pr-3 text-right font-medium">Boarea</th>
            <th className="py-2 text-right font-medium">Pris/m²</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c, i) => (
            <tr key={i} className={`border-b border-black/10 last:border-0 ${i % 2 === 1 ? "bg-black/[0.02]" : ""}`}>
              <td className="py-2.5 pr-3 align-top text-[#12271D]">{c.address ?? NA}</td>
              <td className="py-2.5 pr-3 align-top text-[#5B5648]">{dateSv(c.soldDate)}</td>
              <td className="py-2.5 pr-3 align-top text-right font-medium text-[#12271D]">{sek(c.soldPriceSek)}</td>
              <td className="py-2.5 pr-3 align-top text-right text-[#5B5648]">{c.livingAreaM2 !== null ? `${c.livingAreaM2} m²` : NA}</td>
              <td className="py-2.5 align-top text-right font-medium text-[#12271D]">{sekPerM2(c.pricePerM2Sek)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
