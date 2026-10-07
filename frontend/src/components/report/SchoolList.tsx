import { useTranslations } from "next-intl";
import type { SchoolRow } from "@/lib/report/build";

/** Plain list treatment for nearby schools — name, address, distance, and
 *  (when available) the raw official result figures with their year and
 *  source. Deliberately no score/meter: the MVP shows the real numbers
 *  side by side so the reader can compare them directly, not a derived
 *  rating. */
export function SchoolList({ rows }: { rows: SchoolRow[] }) {
  const t = useTranslations("report.area.school");
  const bold = (chunks: React.ReactNode) => <span className="font-medium">{chunks}</span>;
  return (
    <ul className="relative space-y-0">
      {rows.map((row, i) => (
        <li
          key={`${row.name}-${i}`}
          className="flex items-start justify-between gap-3 border-b border-black/[0.08] py-2.5 last:border-b-0"
        >
          <div>
            <p className="text-[13.5px] font-medium text-[#12271D]">{row.name}</p>
            {row.address && <p className="text-[11.5px] text-[#8C8471]">{row.address}</p>}
            {row.result && (
              <p className="mt-1 text-[12px] leading-relaxed text-[#2A2820]">
                {row.result.godkantAllaAmnenPct !== null && (
                  <>
                    {t.rich("passedAll", { value: row.result.godkantAllaAmnenPct, b: bold })}
                    {row.result.gymnasiebehorighetPct !== null ? " · " : " "}
                  </>
                )}
                {row.result.gymnasiebehorighetPct !== null && (
                  <>
                    {t.rich("eligible", { value: row.result.gymnasiebehorighetPct, b: bold })}{" "}
                  </>
                )}
                <span className="text-[#8C8471]">{t("source", { year: row.result.statisticsYear })}</span>
              </p>
            )}
          </div>
          <span className="shrink-0 whitespace-nowrap pt-0.5 text-[12.5px] text-[#8C8471]">{row.distanceLabel}</span>
        </li>
      ))}
    </ul>
  );
}
