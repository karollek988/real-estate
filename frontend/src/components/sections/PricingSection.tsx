import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Reveal } from "@/components/Reveal";
import { LANDING_CONTAINER } from "@/components/landing/container";
import { ROUTES } from "@/components/site/navigation";
import { ArrowRightIcon, CheckIcon, ChevronRightIcon, FileTextIcon, TagIcon } from "@/components/icons";
import { HOUSING_COST_LIVE, PACKAGES, packageTexts, type PackageDefinition } from "@/lib/packages";
import { TRYGGHETSPAKET_PRICE_SEK } from "@/lib/pricing";

/**
 * The packages as cards - the same ones /buy sells (lib/packages.ts), so the
 * copy can't drift. Buying happens on /buy; every button leads there.
 */

function PackageCard({ pkg, className = "" }: { pkg: PackageDefinition; className?: string }) {
  const t = useTranslations("packages");
  const texts = packageTexts(t, pkg);
  const dark = Boolean(pkg.highlighted);
  return (
    <div
      className={`relative flex h-full flex-col rounded-[22px] p-7 sm:p-8 ${
        dark
          ? "bg-ka-green-950 text-white shadow-[0_40px_80px_-40px_rgba(12,42,31,0.9)]"
          : "border border-ka-line bg-white text-ka-ink shadow-[0_18px_40px_-32px_rgba(15,31,24,0.45)]"
      } ${className}`}
    >
      {texts.badge && (
        <span className="absolute -top-3 left-7 rounded-full bg-ka-mint px-3 py-1 text-xs font-bold text-ka-green-950 sm:left-8">
          {texts.badge}
        </span>
      )}
      <h3 className="text-[19px] font-bold">{texts.name}</h3>
      <p className="mt-3 flex flex-wrap items-baseline gap-x-1.5">
        {t.rich("priceTag", {
          price: pkg.price,
          n: (chunks) => <span className="font-display text-[46px] font-bold leading-none tracking-tight">{chunks}</span>,
          u: (chunks) => <span className={`text-base font-semibold ${dark ? "text-white/80" : "text-ka-muted"}`}>{chunks}</span>,
        })}
        <span className={`ml-1 text-sm ${dark ? "text-white/60" : "text-ka-muted"}`}>· {texts.priceNote}</span>
      </p>
      <p className={`mt-4 text-[15px] leading-relaxed ${dark ? "text-white/80" : "text-ka-muted"}`}>{texts.summary}</p>
      <ul className={`mt-5 flex flex-col gap-2.5 border-t pt-5 ${dark ? "border-white/15" : "border-ka-line"}`}>
        {texts.includes.map((item) => (
          <li key={item} className={`flex items-start gap-2.5 text-[14.5px] ${dark ? "text-white/90" : "text-ka-text"}`}>
            <CheckIcon className={`mt-0.5 h-4 w-4 shrink-0 ${dark ? "text-ka-mint" : "text-ka-green-700"}`} strokeWidth={2.4} />
            {item}
          </li>
        ))}
      </ul>
      {texts.valueNote && (
        <p className={`mt-5 text-[13.5px] font-semibold ${dark ? "text-ka-mint" : "text-ka-green-700"}`}>{texts.valueNote}</p>
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
          {texts.ctaLabel}
        </Link>
      </div>
    </div>
  );
}

/** A cell of the comparison: a tick, a dash, the packages' number of homes ("homes"), or the note that it is not ready ("soon"). */
type Included = boolean | "homes" | "soon";

/** What each package contains, row by row (the "Vad ingår ..." question of the FAQ and lib/analysis/redact.ts decide what an area-only report shows). Each row's words: pricing.comparison.rows.<id> */
const COMPARISON: { id: "homes" | "area" | "brf" | "property" | "risks" | "outlook" | "viewing" | "housingCost" | "pdf"; values: Record<PackageDefinition["key"], Included> }[] = [
  { id: "homes", values: { omradesanalys: "homes", trygghetspaket: "homes", tre_bostader: "homes" } },
  { id: "area", values: { omradesanalys: true, trygghetspaket: true, tre_bostader: true } },
  { id: "brf", values: { omradesanalys: false, trygghetspaket: true, tre_bostader: true } },
  { id: "property", values: { omradesanalys: false, trygghetspaket: true, tre_bostader: true } },
  { id: "risks", values: { omradesanalys: false, trygghetspaket: true, tre_bostader: true } },
  { id: "outlook", values: { omradesanalys: false, trygghetspaket: true, tre_bostader: true } },
  { id: "viewing", values: { omradesanalys: false, trygghetspaket: true, tre_bostader: true } },
  {
    id: "housingCost",
    values: { omradesanalys: false, trygghetspaket: HOUSING_COST_LIVE || "soon", tre_bostader: HOUSING_COST_LIVE || "soon" },
  },
  { id: "pdf", values: { omradesanalys: true, trygghetspaket: true, tre_bostader: true } },
];

function IncludedCell({ value, pkgKey }: { value: Included; pkgKey: PackageDefinition["key"] }) {
  const t = useTranslations("pricing.comparison");
  if (value === "homes" || value === "soon") {
    return (
      <span className="text-[13px] font-medium text-ka-muted sm:text-[14px]">
        {value === "homes" ? t(`homesValues.${pkgKey}`) : t("soon")}
      </span>
    );
  }
  return value ? (
    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-ka-green-800 text-white">
      <CheckIcon className="h-3.5 w-3.5" strokeWidth={2.6} />
      <span className="sr-only">{t("included")}</span>
    </span>
  ) : (
    <span className="text-[18px] leading-none text-ka-muted/60">
      <span aria-hidden>–</span>
      <span className="sr-only">{t("notIncluded")}</span>
    </span>
  );
}

/** The packages compared row by row (/priser). Narrow phone columns break long words at the soft hyphens the messages contain. */
export function PackageComparison() {
  const t = useTranslations("pricing.comparison");
  const tPackages = useTranslations("packages");
  return (
    // relative: the table's visually hidden labels are absolutely positioned and must be clipped by this card, not the page
    <div className="relative overflow-x-auto rounded-[22px] border border-ka-line bg-white shadow-[0_18px_40px_-32px_rgba(15,31,24,0.45)]">
      <table className="w-full border-collapse text-left">
        <caption className="sr-only">{t("caption")}</caption>
        <thead>
          <tr className="border-b border-ka-line bg-ka-cream/70">
            <th scope="col" className="w-[36%] px-3 py-4 text-[13px] font-semibold text-ka-muted sm:w-[40%] sm:px-6">
              <span className="sr-only">{t("contents")}</span>
            </th>
            {PACKAGES.map((pkg) => (
              <th
                key={pkg.key}
                scope="col"
                className={`px-1.5 py-4 text-center text-[12.5px] font-bold leading-tight sm:px-4 sm:text-[15px] ${pkg.highlighted ? "text-ka-green-800" : "text-ka-ink"}`}
              >
                {tPackages(`items.${pkg.key}.tableName`)}
                <span className="mt-1 block whitespace-nowrap font-display text-[17px] sm:text-[22px]">{tPackages("priceInline", { price: pkg.price })}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {COMPARISON.map(({ id, values }) => (
            <tr key={id} className="border-b border-ka-line last:border-b-0">
              <th scope="row" className="px-3 py-3.5 text-[13.5px] font-medium leading-snug text-ka-text sm:px-6 sm:text-[15px]">
                {t(`rows.${id}`)}
              </th>
              {PACKAGES.map((pkg) => (
                <td key={pkg.key} className={`px-1.5 py-3.5 text-center sm:px-4 ${pkg.highlighted ? "bg-ka-sage/20" : ""}`}>
                  <IncludedCell value={values[pkg.key]} pkgKey={pkg.key} />
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
  const t = useTranslations("packages");
  return (
    <>
      <div className="grid gap-5 md:grid-cols-3">
        {PACKAGES.map((pkg, i) => (
          <Reveal key={pkg.key} variant="up" delay={i * 90} className="h-full">
            <PackageCard pkg={pkg} />
          </Reveal>
        ))}
      </div>
      <p className="mt-6 text-xs text-ka-muted">{t("priceFootnote")}</p>
    </>
  );
}

/** The points under the price heading, as ids of lines in the messages (pricing.section.points.<id>). */
const PRICE_POINTS = ["oneOff", "full", "refund"] as const;

/**
 * The landing page's price section, kept short: the main package as a card,
 * the two others as one-line alternatives, and the way to the full price
 * page and the example report.
 */
export function PricingSection() {
  const t = useTranslations("pricing.section");
  const tPackages = useTranslations("packages");
  const main = PACKAGES.find((pkg) => pkg.highlighted) ?? PACKAGES[0];
  const others = PACKAGES.filter((pkg) => pkg !== main);

  return (
    <section id="priser" aria-labelledby="priser-title" className="relative scroll-mt-24 bg-ka-cream">
      <div className={`${LANDING_CONTAINER} grid gap-12 py-20 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center lg:gap-16 lg:py-28`}>
        <Reveal variant="left">
          <p className="inline-flex items-center gap-2 rounded-full bg-ka-sage/70 px-3.5 py-1.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-ka-green-900">
            <TagIcon className="h-4 w-4" />
            {t("eyebrow")}
          </p>
          <h2
            id="priser-title"
            className="mt-5 font-display text-[34px] font-bold leading-[1.08] tracking-[-0.015em] text-ka-ink sm:text-[44px]"
          >
            {t("title", { price: TRYGGHETSPAKET_PRICE_SEK })}
          </h2>
          <p className="mt-4 max-w-[480px] text-[16px] leading-relaxed text-ka-muted sm:text-[17px]">{t("lead")}</p>
          <ul className="mt-6 flex flex-col gap-2.5">
            {PRICE_POINTS.map((point) => (
              <li key={point} className="flex items-start gap-2.5 text-[15px] text-ka-text">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ka-green-800 text-white">
                  <CheckIcon className="h-3 w-3" strokeWidth={2.6} />
                </span>
                {t(`points.${point}`)}
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-6">
            <Link
              href={ROUTES.priser}
              className="group inline-flex h-[52px] items-center justify-center gap-2.5 rounded-[12px] bg-ka-green-900 px-6 text-[15.5px] font-semibold text-white shadow-[0_14px_30px_-16px_rgba(12,42,31,0.9)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-ka-green-800"
            >
              {t("allPrices")}
              <ArrowRightIcon className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-1" />
            </Link>
            <a
              href="#exempelrapport"
              className="inline-flex items-center justify-center gap-2 text-[15.5px] font-semibold text-ka-green-800 underline-offset-4 transition hover:text-ka-green-950 hover:underline"
            >
              <FileTextIcon className="h-5 w-5" />
              {t("exampleReport")}
            </a>
          </div>
        </Reveal>

        <Reveal variant="right">
          <div className="flex flex-col gap-4">
            <PackageCard pkg={main} />
            <ul className="grid gap-3 sm:grid-cols-2">
              {others.map((pkg) => {
                const texts = packageTexts(tPackages, pkg);
                return (
                  <li key={pkg.key}>
                    <Link
                      href={ROUTES.priser}
                      className="group flex h-full items-center gap-4 rounded-[18px] border border-ka-line bg-white px-5 py-4 shadow-[0_14px_32px_-28px_rgba(15,31,24,0.45)] transition hover:-translate-y-0.5 hover:border-ka-green-700/30"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15.5px] font-bold text-ka-ink">{texts.name}</span>
                        <span className="mt-0.5 block text-[13.5px] leading-snug text-ka-muted">{texts.summary}</span>
                      </span>
                      <span className="shrink-0 text-right">
                        {tPackages.rich("priceTagStacked", {
                          price: pkg.price,
                          n: (chunks) => <span className="block font-display text-[26px] font-bold leading-none text-ka-ink">{chunks}</span>,
                          u: (chunks) => <span className="text-[12px] text-ka-muted">{chunks}</span>,
                        })}
                      </span>
                      <ChevronRightIcon className="h-5 w-5 shrink-0 text-ka-muted transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
