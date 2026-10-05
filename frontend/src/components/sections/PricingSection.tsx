import Link from "next/link";
import { Reveal } from "@/components/Reveal";
import { LANDING_CONTAINER } from "@/components/landing/container";
import { ROUTES } from "@/components/site/navigation";
import { ArrowRightIcon, CheckIcon, ChevronRightIcon, FileTextIcon, TagIcon } from "@/components/icons";
import { HOUSING_COST_LIVE, PACKAGES, PRICE_FOOTNOTE, type PackageDefinition } from "@/lib/packages";
import { TRYGGHETSPAKET_PRICE_SEK, formatSek } from "@/lib/pricing";

/**
 * The packages as cards - the same ones /buy sells (lib/packages.ts), so the
 * copy can't drift. Buying happens on /buy; every button leads there.
 */

function PackageCard({ pkg, className = "" }: { pkg: PackageDefinition; className?: string }) {
  const dark = Boolean(pkg.highlighted);
  return (
    <div
      className={`relative flex h-full flex-col rounded-[22px] p-7 sm:p-8 ${
        dark
          ? "bg-ka-green-950 text-white shadow-[0_40px_80px_-40px_rgba(12,42,31,0.9)]"
          : "border border-ka-line bg-white text-ka-ink shadow-[0_18px_40px_-32px_rgba(15,31,24,0.45)]"
      } ${className}`}
    >
      {pkg.badge && (
        <span className="absolute -top-3 left-7 rounded-full bg-ka-mint px-3 py-1 text-xs font-bold text-ka-green-950 sm:left-8">
          {pkg.badge}
        </span>
      )}
      <h3 className="text-[19px] font-bold">{pkg.name}</h3>
      <p className="mt-3 flex flex-wrap items-baseline gap-x-1.5">
        <span className="font-display text-[46px] font-bold leading-none tracking-tight">{formatSek(pkg.price)}</span>
        <span className={`text-base font-semibold ${dark ? "text-white/80" : "text-ka-muted"}`}>kr</span>
        <span className={`ml-1 text-sm ${dark ? "text-white/60" : "text-ka-muted"}`}>· {pkg.priceNote}</span>
      </p>
      <p className={`mt-4 text-[15px] leading-relaxed ${dark ? "text-white/80" : "text-ka-muted"}`}>{pkg.summary}</p>
      <ul className={`mt-5 flex flex-col gap-2.5 border-t pt-5 ${dark ? "border-white/15" : "border-ka-line"}`}>
        {pkg.includes.map((item) => (
          <li key={item} className={`flex items-start gap-2.5 text-[14.5px] ${dark ? "text-white/90" : "text-ka-text"}`}>
            <CheckIcon className={`mt-0.5 h-4 w-4 shrink-0 ${dark ? "text-ka-mint" : "text-ka-green-700"}`} strokeWidth={2.4} />
            {item}
          </li>
        ))}
      </ul>
      {pkg.valueNote && (
        <p className={`mt-5 text-[13.5px] font-semibold ${dark ? "text-ka-mint" : "text-ka-green-700"}`}>{pkg.valueNote}</p>
      )}
      <div className="mt-auto pt-7">
        <Link
          href={ROUTES.kop}
          className={`inline-flex w-full items-center justify-center rounded-[12px] px-5 py-3.5 text-[15px] font-semibold transition-all duration-200 hover:-translate-y-0.5 ${
            dark
              ? "bg-ka-cream text-ka-green-950 hover:bg-white"
              : "border-[1.5px] border-ka-green-900/30 text-ka-green-900 hover:border-ka-green-900 hover:bg-ka-green-900 hover:text-white"
          }`}
        >
          {pkg.ctaLabel}
        </Link>
      </div>
    </div>
  );
}

type Included = boolean | string;

/** What each package contains, row by row (lib/faq.ts "Vad ingår ..." and lib/analysis/redact.ts decide what an area-only report shows). */
const COMPARISON: { label: string; values: Record<PackageDefinition["key"], Included> }[] = [
  { label: "Antal bostäder", values: { omradesanalys: "1 adress", trygghetspaket: "1 bostad", tre_bostader: "3 bostäder" } },
  { label: "Områdes\u00ADanalys: service, skolor, pendling och trygghet", values: { omradesanalys: true, trygghetspaket: true, tre_bostader: true } },
  { label: "BRF-analys, granskad av våra experter inom 24 timmar", values: { omradesanalys: false, trygghetspaket: true, tre_bostader: true } },
  { label: "Fastighets\u00ADinformation", values: { omradesanalys: false, trygghetspaket: true, tre_bostader: true } },
  { label: "Möjliga risker", values: { omradesanalys: false, trygghetspaket: true, tre_bostader: true } },
  { label: "Framtids\u00ADutsikter för området", values: { omradesanalys: false, trygghetspaket: true, tre_bostader: true } },
  { label: "Frågor inför visningen och visnings\u00ADguide", values: { omradesanalys: false, trygghetspaket: true, tre_bostader: true } },
  {
    label: "Boende\u00ADkalkyl",
    values: { omradesanalys: false, trygghetspaket: HOUSING_COST_LIVE || "Lanseras snart", tre_bostader: HOUSING_COST_LIVE || "Lanseras snart" },
  },
  { label: "Rapporten som PDF", values: { omradesanalys: true, trygghetspaket: true, tre_bostader: true } },
];

function IncludedCell({ value }: { value: Included }) {
  if (typeof value === "string") return <span className="text-[13px] font-medium text-ka-muted sm:text-[14px]">{value}</span>;
  return value ? (
    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-ka-green-800 text-white">
      <CheckIcon className="h-3.5 w-3.5" strokeWidth={2.6} />
      <span className="sr-only">Ingår</span>
    </span>
  ) : (
    <span className="text-[18px] leading-none text-ka-muted/60">
      <span aria-hidden>–</span>
      <span className="sr-only">Ingår inte</span>
    </span>
  );
}

// Narrow columns on phones: long compounds (here and in COMPARISON) break where Swedish
// would, at a soft hyphen, not wherever the browser happens to run out of room.
const SOFT_HYPHENATED: Record<string, string> = {
  Områdesanalys: "Områdes\u00ADanalys",
  Trygghetspaketet: "Trygghets\u00ADpaketet",
};

/** The packages compared row by row (/priser). */
export function PackageComparison() {
  return (
    // relative: the table's visually hidden labels are absolutely positioned and must be clipped by this card, not the page
    <div className="relative overflow-x-auto rounded-[22px] border border-ka-line bg-white shadow-[0_18px_40px_-32px_rgba(15,31,24,0.45)]">
      <table className="w-full border-collapse text-left">
        <caption className="sr-only">Vad som ingår i varje paket</caption>
        <thead>
          <tr className="border-b border-ka-line bg-ka-cream/70">
            <th scope="col" className="w-[36%] px-3 py-4 text-[13px] font-semibold text-ka-muted sm:w-[40%] sm:px-6">
              <span className="sr-only">Innehåll</span>
            </th>
            {PACKAGES.map((pkg) => (
              <th
                key={pkg.key}
                scope="col"
                className={`px-1.5 py-4 text-center text-[12.5px] font-bold leading-tight sm:px-4 sm:text-[15px] ${pkg.highlighted ? "text-ka-green-800" : "text-ka-ink"}`}
              >
                {SOFT_HYPHENATED[pkg.name] ?? pkg.name}
                <span className="mt-1 block whitespace-nowrap font-display text-[17px] sm:text-[22px]">{formatSek(pkg.price)} kr</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {COMPARISON.map(({ label, values }) => (
            <tr key={label} className="border-b border-ka-line last:border-b-0">
              <th scope="row" className="px-3 py-3.5 text-[13.5px] font-medium leading-snug text-ka-text sm:px-6 sm:text-[15px]">
                {label}
              </th>
              {PACKAGES.map((pkg) => (
                <td key={pkg.key} className={`px-1.5 py-3.5 text-center sm:px-4 ${pkg.highlighted ? "bg-ka-sage/20" : ""}`}>
                  <IncludedCell value={values[pkg.key]} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** All three packages side by side (/priser). */
export function PackageGrid() {
  return (
    <>
      <div className="grid gap-5 md:grid-cols-3">
        {PACKAGES.map((pkg, i) => (
          <Reveal key={pkg.key} variant="up" delay={i * 90} className="h-full">
            <PackageCard pkg={pkg} />
          </Reveal>
        ))}
      </div>
      <p className="mt-6 text-xs text-ka-muted">{PRICE_FOOTNOTE}</p>
    </>
  );
}

/**
 * The landing page's price section, kept short: the main package as a card,
 * the two others as one-line alternatives, and the way to the full price
 * page and the example report.
 */
export function PricingSection() {
  const main = PACKAGES.find((pkg) => pkg.highlighted) ?? PACKAGES[0];
  const others = PACKAGES.filter((pkg) => pkg !== main);

  return (
    <section id="priser" aria-labelledby="priser-title" className="relative scroll-mt-24 bg-ka-cream">
      <div className={`${LANDING_CONTAINER} grid gap-12 py-20 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center lg:gap-16 lg:py-28`}>
        <Reveal variant="left">
          <p className="inline-flex items-center gap-2 rounded-full bg-ka-sage/70 px-3.5 py-1.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-ka-green-900">
            <TagIcon className="h-4 w-4" />
            Priser
          </p>
          <h2
            id="priser-title"
            className="mt-5 font-display text-[34px] font-bold leading-[1.08] tracking-[-0.015em] text-ka-ink sm:text-[44px]"
          >
            Tryggheten kostar {TRYGGHETSPAKET_PRICE_SEK} kr
          </h2>
          <p className="mt-4 max-w-[480px] text-[16px] leading-relaxed text-ka-muted sm:text-[17px]">
            Du betalar en gång per bostad. Inga abonnemang och ingen bindningstid.
          </p>
          <ul className="mt-6 flex flex-col gap-2.5">
            {["Engångspris inklusive moms", "Hela rapporten – inga låsta delar", "Går en analys inte att slutföra får du tillbaka den"].map((point) => (
              <li key={point} className="flex items-start gap-2.5 text-[15px] text-ka-text">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ka-green-800 text-white">
                  <CheckIcon className="h-3 w-3" strokeWidth={2.6} />
                </span>
                {point}
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-6">
            <Link
              href={ROUTES.priser}
              className="group inline-flex h-[52px] items-center justify-center gap-2.5 rounded-[12px] bg-ka-green-900 px-6 text-[15.5px] font-semibold text-white shadow-[0_14px_30px_-16px_rgba(12,42,31,0.9)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-ka-green-800"
            >
              Se alla priser och vad som ingår
              <ArrowRightIcon className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-1" />
            </Link>
            <a
              href="#exempelrapport"
              className="inline-flex items-center justify-center gap-2 text-[15.5px] font-semibold text-ka-green-800 underline-offset-4 transition hover:text-ka-green-950 hover:underline"
            >
              <FileTextIcon className="h-5 w-5" />
              Se exempelrapport
            </a>
          </div>
        </Reveal>

        <Reveal variant="right">
          <div className="flex flex-col gap-4">
            <PackageCard pkg={main} />
            <ul className="grid gap-3 sm:grid-cols-2">
              {others.map((pkg) => (
                <li key={pkg.key}>
                  <Link
                    href={ROUTES.priser}
                    className="group flex h-full items-center gap-4 rounded-[18px] border border-ka-line bg-white px-5 py-4 shadow-[0_14px_32px_-28px_rgba(15,31,24,0.45)] transition hover:-translate-y-0.5 hover:border-ka-green-700/30"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15.5px] font-bold text-ka-ink">{pkg.name}</span>
                      <span className="mt-0.5 block text-[13.5px] leading-snug text-ka-muted">{pkg.summary}</span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block font-display text-[26px] font-bold leading-none text-ka-ink">{formatSek(pkg.price)}</span>
                      <span className="text-[12px] text-ka-muted">kr</span>
                    </span>
                    <ChevronRightIcon className="h-5 w-5 shrink-0 text-ka-muted transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
