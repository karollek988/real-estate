import Link from "next/link";
import { redirect } from "next/navigation";
import { Source_Serif_4 } from "next/font/google";
import { getAnalysisWithProperty } from "@/lib/analysis/store";
import { findPremiumAnalysisForProperty, getAnalysisRequestRow } from "@/lib/analysis/ownership";
import { createClient } from "@/lib/supabase/server";
import { analysisAgeDays, FRESH_ANALYSIS_MAX_AGE_DAYS } from "@/lib/analysis/pipeline";
import type { AnalysisReport, DataSourceReport, DecisionFactorResult } from "@/lib/analysis/types";
import { UpdateAnalysisButton } from "@/components/report/UpdateAnalysisButton";
import { UnlockButton } from "@/components/report/UnlockButton";
import { KeyValueTable } from "@/components/report/KeyValueTable";
import { IconFactGrid, type IconFactRow } from "@/components/report/IconFactGrid";
import { RiskCategoryCard } from "@/components/report/RiskCategoryCard";
import { PriceComparisonBar } from "@/components/report/PriceComparisonBar";
import { ScoreRing } from "@/components/report/ScoreRing";
import { ArcGauge } from "@/components/report/ArcGauge";
import { SegmentedMeter } from "@/components/report/SegmentedMeter";
import { MetricCard } from "@/components/report/MetricCard";
import { Callout } from "@/components/report/Callout";
import { AmenityGrid } from "@/components/report/AmenityGrid";
import { ProjectCard } from "@/components/report/ProjectCard";
import { SourceBadges } from "@/components/report/SourceBadges";
import { Watermark } from "@/components/report/Watermark";
import {
  buildAreaAnalysis,
  buildExecutiveSummary,
  buildFinalRecommendation,
  buildHousingAssociation,
  buildInvestmentOutlook,
  buildPriceAnalysis,
  buildPropertyOverview,
  buildRiskCategories,
  sek,
  sekPerM2,
  sourcesUsed,
  type OverviewRow,
} from "@/lib/report/build";
import {
  HouseIcon,
  BuildingIcon,
  WalletIcon,
  MapPinIcon,
  WarningIcon,
  TrendingUpIcon,
  BadgeCheckIcon,
  ClipboardIcon,
  ChartIcon,
  PercentIcon,
  ShoppingBagIcon,
  GraduationCapIcon,
  UtensilsIcon,
  TreeIcon,
  TrainIcon,
  MedicalCrossIcon,
  CraneIcon,
  LightbulbIcon,
  InfoIcon,
  CheckIcon,
  ShieldIcon,
  DatabaseIcon,
  QuestionIcon,
} from "@/components/icons";

const serif = Source_Serif_4({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-report-serif",
  display: "swap",
});

const serifStyle: React.CSSProperties = { fontFamily: "var(--font-report-serif)" };

/* ─── Presentation-only helpers ─────────────────────────────────────────
   Everything below reads numbers the Decision Engine already computed
   (report.decisionFactors / build.ts's own return values) and buckets them
   into a UI band. No score, verdict, or sentence is derived or altered — the
   thresholds mirror ones build.ts already uses for the same factor
   (e.g. negotiation's 50/60 cutoffs) so the visual never disagrees with the
   prose sitting next to it. */

function factorOf(report: AnalysisReport, id: string): DecisionFactorResult | undefined {
  return report.decisionFactors?.find((f) => f.id === id);
}

function numOf(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function priceBandFromDelta(deltaPct: number): { label: string; bandIndex: number } {
  if (deltaPct <= -5) return { label: "Under snittet", bandIndex: 0 };
  if (deltaPct >= 5) return { label: "Över snittet", bandIndex: 2 };
  return { label: "I linje med snittet", bandIndex: 1 };
}

function burdenBand(burdenPct: number): { label: string; bandIndex: number } {
  if (burdenPct < 30) return { label: "Överkomlig", bandIndex: 0 };
  if (burdenPct < 45) return { label: "Måttlig", bandIndex: 1 };
  return { label: "Tung", bandIndex: 2 };
}

const PRICE_RANGE_SV: Record<string, string> = {
  "entry-level": "Instegsbostad",
  "mid-range": "Mellansegment",
  "upper mid-range": "Övre mellansegment",
  premium: "Premium",
};

/** Mirrors the 50/60 cutoffs build.ts already uses for this exact factor
 *  (see negotiationArgumentsSv). Labels describe the size of the observed
 *  negotiating room, not a suggestion to act on it. */
function negotiationBand(score: number): { label: string; bandIndex: number } {
  if (score >= 60) return { label: "Stort utrymme", bandIndex: 2 };
  if (score >= 50) return { label: "Måttligt utrymme", bandIndex: 1 };
  return { label: "Begränsat utrymme", bandIndex: 0 };
}

const AMENITY_ICONS = [
  <ShoppingBagIcon key="grocery" className="h-4 w-4" />,
  <GraduationCapIcon key="school" className="h-4 w-4" />,
  <UtensilsIcon key="restaurant" className="h-4 w-4" />,
  <TreeIcon key="park" className="h-4 w-4" />,
  <TrainIcon key="transit" className="h-4 w-4" />,
  <MedicalCrossIcon key="hospital" className="h-4 w-4" />,
];
const AMENITY_SHORT_LABELS = ["Matbutiker", "Skolor", "Restauranger", "Parker", "Kollektivtrafik", "Vårdinrättning"];

const RISK_ICON: Record<string, React.ReactNode> = {
  market: <ChartIcon className="h-4 w-4" />,
  interest_rate: <PercentIcon className="h-4 w-4" />,
  housing_association: <BuildingIcon className="h-4 w-4" />,
  area: <MapPinIcon className="h-4 w-4" />,
  liquidity: <WalletIcon className="h-4 w-4" />,
  environmental: <WarningIcon className="h-4 w-4" />,
  construction: <BuildingIcon className="h-4 w-4" />,
  future: <CraneIcon className="h-4 w-4" />,
};

const BRF_METRIC_ICON: Record<string, React.ReactNode> = {
  Soliditet: <PercentIcon className="h-3.5 w-3.5" />,
  Rörelsemarginal: <PercentIcon className="h-3.5 w-3.5" />,
  "Skuld per lägenhet": <WalletIcon className="h-3.5 w-3.5" />,
  "Avgiftsnivå (index)": <ChartIcon className="h-3.5 w-3.5" />,
  Likviditet: <WalletIcon className="h-3.5 w-3.5" />,
  Skuldandel: <PercentIcon className="h-3.5 w-3.5" />,
  "Skuld/eget kapital": <ChartIcon className="h-3.5 w-3.5" />,
  "Total låneskuld": <WalletIcon className="h-3.5 w-3.5" />,
  "Vägt genomsnittlig ränta": <PercentIcon className="h-3.5 w-3.5" />,
  "Andel kortfristig skuld": <PercentIcon className="h-3.5 w-3.5" />,
  "Driftskostnad per m²": <WalletIcon className="h-3.5 w-3.5" />,
  "Hyresrätter i föreningen": <BuildingIcon className="h-3.5 w-3.5" />,
  "Kommersiella lokaler": <BuildingIcon className="h-3.5 w-3.5" />,
  Parkeringsplatser: <BuildingIcon className="h-3.5 w-3.5" />,
  Garageplatser: <BuildingIcon className="h-3.5 w-3.5" />,
};

const FACT_GROUPS: { title: string; icon: React.ReactNode; labels: string[] }[] = [
  {
    title: "Adress & bostad",
    icon: <HouseIcon className="h-5 w-5" />,
    labels: ["Adress", "Kommun", "Postnummer", "Boendetyp", "Bostadsrättsförening", "Lägenhetsnummer", "Våning", "Antal rum", "Boarea", "Biarea", "Tomtstorlek"],
  },
  {
    title: "Pris & avgifter",
    icon: <WalletIcon className="h-5 w-5" />,
    labels: ["Utgångspris", "Pris per m²", "Månadsavgift", "Driftskostnader", "Föregående försäljning"],
  },
  {
    title: "Skick & byggnad",
    icon: <BuildingIcon className="h-5 w-5" />,
    labels: ["Byggår", "Senaste renovering", "Energiklass", "Skick", "Nyproduktion", "Pantbrev"],
  },
  {
    title: "Bekvämligheter",
    icon: <BadgeCheckIcon className="h-5 w-5" />,
    labels: ["Balkong", "Uteplats", "Hiss", "Parkering", "Garage", "Förråd", "Solceller", "Öppen spis", "Bekvämligheter"],
  },
  {
    title: "Försäljning & mäklare",
    icon: <ClipboardIcon className="h-5 w-5" />,
    labels: ["Upplåtelseform", "Öppen budgivning", "Mäklare", "Mäklarbyrå", "Annonsdatum", "Objekt-ID", "Planritning"],
  },
];

/* ─── Layout primitives ─────────────────────────────────────────────── */

function CornerAccents({ color }: { color: string }) {
  return (
    <>
      <span
        aria-hidden
        className="pointer-events-none absolute left-6 top-6 h-3 w-3 border-l border-t sm:left-10 sm:top-10"
        style={{ borderColor: color }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute bottom-6 right-6 h-3 w-3 border-b border-r sm:bottom-10 sm:right-10"
        style={{ borderColor: color }}
      />
    </>
  );
}

function Page({
  children,
  source,
  n,
  className = "",
}: {
  children: React.ReactNode;
  source?: string;
  n: number;
  className?: string;
}) {
  return (
    <section className={`report-page relative border-t border-black/[0.08] px-8 py-14 sm:px-16 sm:py-16 ${className}`}>
      <Watermark />
      <CornerAccents color="rgba(185,138,46,0.35)" />
      {children}
      <div className="relative mt-14 flex items-center justify-between border-t border-black/[0.08] pt-3 text-[10px] uppercase tracking-wide text-[#8C8471]">
        <span>{source ?? "Köpanalys"}</span>
        <span>{n}</span>
      </div>
    </section>
  );
}

function ChapterTitle({ children, sub, icon }: { children: React.ReactNode; sub?: string; icon: React.ReactNode }) {
  return (
    <div className="relative mb-9">
      <div className="flex items-center gap-3.5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#12271D] text-white">
          {icon}
        </span>
        <h2 style={serifStyle} className="text-[26px] font-semibold tracking-tight text-[#12271D] sm:text-[30px]">
          {children}
        </h2>
      </div>
      {sub && <p className="mt-2.5 text-[14px] text-[#8C8471]">{sub}</p>}
      <div className="mt-5 h-px w-16 bg-[#B98A2E]" />
    </div>
  );
}

function ChapterSources({ dataSources, ids }: { dataSources: DataSourceReport[]; ids?: string[] }) {
  const names = sourcesUsed(dataSources, ids);
  return (
    <div className="relative mt-10 border-t border-black/10 pt-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#8C8471]">Källor</p>
      <SourceBadges names={names} />
    </div>
  );
}

function Prose({ paragraphs }: { paragraphs: string[] }) {
  return (
    <div className="relative space-y-4">
      {paragraphs.map((p, i) => (
        <p key={i} className="text-[14.5px] leading-[1.75] text-[#2A2820]">
          {p}
        </p>
      ))}
    </div>
  );
}

function SubHeading({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <h3 style={serifStyle} className="relative mb-3 mt-9 flex items-center gap-2 text-[17px] font-semibold text-[#12271D] first:mt-0">
      {icon && <span className="flex h-6 w-6 shrink-0 items-center justify-center text-[#B98A2E]">{icon}</span>}
      {children}
    </h3>
  );
}

function FactGroup({ title, icon, rows }: { title: string; icon: React.ReactNode; rows: IconFactRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="relative mb-8 last:mb-0">
      <div className="mb-3 flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#12271D]/[0.06] text-[#12271D]">{icon}</span>
        <h3 className="text-[14px] font-semibold tracking-tight text-[#12271D]">{title}</h3>
      </div>
      <IconFactGrid rows={rows} />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════ */
/*                          MAIN REPORT PAGE                              */
/* ══════════════════════════════════════════════════════════════════════ */

export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  if (!id) redirect("/");

  const found = await getAnalysisWithProperty(id);
  if (!found) redirect("/");

  const { analysis, property } = found;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const hasPremiumInspectionAccess = user ? Boolean(await findPremiumAnalysisForProperty(user.id, property.id)) : false;
  const requestRow = user ? await getAnalysisRequestRow(user.id, id) : null;
  const analysisType = requestRow?.analysisType ?? null;
  const isFree = analysisType === "free";
  const locked = requestRow !== null && requestRow.analysisType === "premium" && !requestRow.unlocked;

  if (locked) {
    const generatedDate = new Date(analysis.createdAt).toLocaleDateString("sv-SE", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    return (
      <div className="min-h-screen bg-[#F7F4EC]">
        <div className="no-print mx-auto flex w-full max-w-[880px] items-center px-8 py-5 sm:px-16">
          <Link href="/" className="text-sm font-medium text-[#5B5648] transition hover:text-[#12271D]">
            ← Ny analys
          </Link>
        </div>
        <main className="mx-auto w-full max-w-[880px] border-t-[3px] border-[#B98A2E] bg-[#FBF9F4] shadow-[0_0_0_1px_rgba(0,0,0,0.06)]">
          <section className="report-page relative overflow-hidden bg-[#0E2B1F] text-[#F5F1E4]">
            <Watermark dark />
            <CornerAccents color="rgba(216,181,99,0.4)" />
            <div className="relative flex items-center justify-between px-8 pt-8 sm:px-16">
              <div className="flex items-center gap-2.5">
                <span
                  style={serifStyle}
                  className="flex h-8 w-8 items-center justify-center rounded-md border border-[#D8B563]/40 bg-white/5 text-[15px] font-semibold text-[#D8B563]"
                >
                  K
                </span>
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#D8CBA3]">Köpanalys</span>
              </div>
              <span className="text-[11px] text-[#8AA396]">{generatedDate}</span>
            </div>
            {analysis.report?.property.imageUrls?.[0] && (
              <div className="relative mt-8 h-64 w-full sm:h-80">
                <img src={analysis.report.property.imageUrls[0]} alt={property.address} className="h-full w-full object-cover blur-xl" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0E2B1F] via-[#0E2B1F]/10 to-transparent" />
              </div>
            )}
            <div className="relative px-8 pb-10 pt-6 sm:px-16 sm:pb-14">
              <h1 style={serifStyle} className="text-[34px] font-semibold leading-[1.15] tracking-tight sm:text-[46px]">
                {property.address}
              </h1>
              <p className="mt-3 text-[14px] text-[#C9D6CC]">{property.propertyType}</p>
            </div>
          </section>
          <section className="report-page relative px-8 py-14 sm:px-16 sm:py-16">
            <Watermark />
            <CornerAccents color="rgba(185,138,46,0.35)" />
            <div className="flex flex-col items-center gap-6 py-12 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#B98A2E]/10">
                <svg className="h-8 w-8 text-[#B98A2E]" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                </svg>
              </div>
              <h2 style={serifStyle} className="text-[26px] font-semibold tracking-tight text-[#12271D] sm:text-[30px]">
                Premium-analys låst
              </h2>
              <p className="max-w-md text-[14px] leading-relaxed text-[#5B5648]">
                Den fullständiga Premium-analysen är klar, men du behöver betala för att låsa upp den.
                Efter betalning får du tillgång till hela rapporten med områdesanalys, riskbedömning och investeringsutsikt.
              </p>
              <UnlockButton analysisId={id} />
            </div>
          </section>
        </main>
      </div>
    );
  }

  if (analysis.status !== "complete" || !analysis.report) {
    return (
      <div className="min-h-screen bg-[#F7F4EC] px-6 py-16 text-[#1B1F27]">
        <main className="mx-auto flex w-full max-w-2xl flex-col gap-6">
          <h1 style={serifStyle} className="text-2xl font-semibold tracking-tight">
            Analysen kunde inte slutföras
          </h1>
          <p className="text-sm leading-relaxed text-[#5B5648]">
            Något gick fel vid analysen av {property.address}. Börja en ny analys så försöker vi igen.
          </p>
          <Link
            href="/"
            className="mt-2 inline-block w-fit rounded-sm border border-[#12271D]/20 px-5 py-2.5 text-sm font-medium text-[#12271D] transition hover:bg-[#12271D]/5"
          >
            Ny analys
          </Link>
        </main>
      </div>
    );
  }

  const p: AnalysisReport = analysis.report;
  const attributes = property.attributes;
  const ageDays = analysisAgeDays(analysis);
  const isStale = ageDays >= FRESH_ANALYSIS_MAX_AGE_DAYS;
  const generatedDate = new Date(analysis.createdAt).toLocaleDateString("sv-SE", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const executiveSummary = buildExecutiveSummary(p);
  const overviewRows = buildPropertyOverview(p, attributes);
  const priceAnalysis = buildPriceAnalysis(p);
  const areaAnalysis = buildAreaAnalysis(p, attributes, p.dataSources);
  const brf = buildHousingAssociation(p, p.dataSources);
  const riskCategories = buildRiskCategories(p, p.dataSources);
  const investmentOutlook = buildInvestmentOutlook(p);
  const recommendation = buildFinalRecommendation(p);

  // Supplementary numbers read straight from the Decision Engine's public
  // decisionFactors — never through build.ts — purely to drive a gauge/meter
  // alongside prose that already states the same fact in words.
  const priceFactor = factorOf(p, "price");
  const riskFactor = factorOf(p, "risk");
  const marketFactor = factorOf(p, "market");
  const futureFactor = factorOf(p, "futureDevelopment");
  const negotiationFactor = factorOf(p, "negotiation");

  const costBurdenPct = numOf(priceFactor?.supportingData.costBurdenPct);
  const priceRangeRaw = priceFactor?.supportingData.priceRange;
  const priceRange = typeof priceRangeRaw === "string" ? priceRangeRaw : null;
  const policyRatePct = numOf(riskFactor?.supportingData.policyRatePct);
  const rateChangePctPoints = numOf(marketFactor?.supportingData.policyRateChangePctPoints);
  const currentPolicyRatePct = numOf(marketFactor?.supportingData.currentPolicyRatePct);
  const employmentRatePct = numOf(marketFactor?.supportingData.municipalityEmploymentRatePct);
  const plannedProjectsCount = numOf(futureFactor?.supportingData.nearbyPlannedProjectsCount);
  const negotiationScore = negotiationFactor?.score ?? null;

  const priceCards: { icon: React.ReactNode; label: string; value: string; sub?: string }[] = [];
  if (p.property.askingPriceSek !== null) priceCards.push({ icon: <WalletIcon className="h-3.5 w-3.5" />, label: "Utgångspris", value: sek(p.property.askingPriceSek) });
  if (p.property.pricePerM2Sek !== null) priceCards.push({ icon: <ChartIcon className="h-3.5 w-3.5" />, label: "Pris per m²", value: sekPerM2(p.property.pricePerM2Sek) });
  if (priceAnalysis.comparison) {
    const band = priceBandFromDelta(priceAnalysis.comparison.deltaPct);
    priceCards.push({ icon: <TrendingUpIcon className="h-3.5 w-3.5" />, label: "Område", value: band.label, sub: `${priceAnalysis.comparison.deltaPct > 0 ? "+" : ""}${priceAnalysis.comparison.deltaPct}%` });
  } else if (priceRange) {
    priceCards.push({ icon: <TrendingUpIcon className="h-3.5 w-3.5" />, label: "Prisnivå", value: PRICE_RANGE_SV[priceRange] ?? priceRange });
  }
  if (priceAnalysis.comparableSales.length > 0) {
    priceCards.push({ icon: <ClipboardIcon className="h-3.5 w-3.5" />, label: "Jämförbara försäljningar", value: String(priceAnalysis.comparableSales.length) });
  }

  const priceMeter = priceAnalysis.comparison
    ? { bands: ["Under snittet", "I linje", "Över snittet"], activeIndex: priceBandFromDelta(priceAnalysis.comparison.deltaPct).bandIndex, caption: "Positionering mot områdets medianpris per m²" }
    : costBurdenPct !== null
      ? { bands: ["Överkomlig", "Måttlig", "Tung"], activeIndex: burdenBand(costBurdenPct).bandIndex, caption: "Uppskattad månadskostnad i förhållande till medianinkomst" }
      : null;

  const macroCards: { icon: React.ReactNode; label: string; value: string; sub?: string }[] = [];
  if (rateChangePctPoints !== null) {
    macroCards.push({
      icon: <PercentIcon className="h-3.5 w-3.5" />,
      label: "Styrränta, 12 mån",
      value: `${rateChangePctPoints > 0 ? "+" : ""}${rateChangePctPoints.toFixed(2)} pp`,
      sub: currentPolicyRatePct !== null ? `Nu ${currentPolicyRatePct.toFixed(1)}%` : undefined,
    });
  }
  if (employmentRatePct !== null) {
    macroCards.push({ icon: <BadgeCheckIcon className="h-3.5 w-3.5" />, label: "Sysselsättningsgrad", value: `${employmentRatePct.toFixed(1)}%` });
  }
  if (!isFree && plannedProjectsCount !== null) {
    macroCards.push({ icon: <CraneIcon className="h-3.5 w-3.5" />, label: "Planerade projekt", value: String(plannedProjectsCount) });
  }

  return (
    <div className={`${serif.variable} min-h-screen bg-[#F7F4EC]`}>
      {/* ── Screen-only top bar (hidden in print) ── */}
      <div className="no-print mx-auto flex w-full max-w-[880px] items-center justify-between px-8 py-5 sm:px-16">
        <Link href="/" className="text-sm font-medium text-[#5B5648] transition hover:text-[#12271D]">
          ← Ny analys
        </Link>
        <a
          href={`/api/analyses/${id}/pdf`}
          className="rounded-sm border border-[#12271D]/20 px-4 py-1.5 text-xs font-semibold text-[#12271D] transition hover:bg-[#12271D]/5"
        >
          Ladda ner PDF
        </a>
      </div>

      {isStale && (
        <div className="no-print mx-auto mb-2 flex w-full max-w-[880px] flex-wrap items-center justify-between gap-4 border border-[#B98A2E]/30 bg-[#B98A2E]/[0.06] px-8 py-4 text-sm sm:px-16">
          <div>
            <p className="font-semibold text-[#8A6220]">Denna analys är {ageDays} dagar gammal</p>
            <p className="mt-0.5 text-xs text-[#5B5648]">Marknads- och fastighetsdata kan ha ändrats. Senast uppdaterad {generatedDate}.</p>
          </div>
          <UpdateAnalysisButton propertyId={property.id} />
        </div>
      )}

      <main className="mx-auto w-full max-w-[880px] border-t-[3px] border-[#B98A2E] bg-[#FBF9F4] shadow-[0_0_0_1px_rgba(0,0,0,0.06)]">
        {/* ══════════════════════════════════════════════════════════
            1. COVER
           ══════════════════════════════════════════════════════════ */}
        <section className="report-page relative overflow-hidden bg-[#0E2B1F] text-[#F5F1E4]">
          <Watermark dark />
          <CornerAccents color="rgba(216,181,99,0.4)" />

          <div className="relative flex items-center justify-between px-8 pt-8 sm:px-16">
            <div className="flex items-center gap-2.5">
              <span
                style={serifStyle}
                className="flex h-8 w-8 items-center justify-center rounded-md border border-[#D8B563]/40 bg-white/5 text-[15px] font-semibold text-[#D8B563]"
              >
                K
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#D8CBA3]">Köpanalys</span>
            </div>
            <span className="text-[11px] text-[#8AA396]">{generatedDate}</span>
          </div>

          {p.property.imageUrls?.[0] ? (
            <div className="relative mt-8 h-64 w-full sm:h-80">
              <img src={p.property.imageUrls[0]} alt={p.property.address ?? "Bostad"} className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0E2B1F] via-[#0E2B1F]/10 to-transparent" />
            </div>
          ) : (
            <div className="mt-8 h-24 w-full sm:h-32" />
          )}

          <div className="relative px-8 pb-10 pt-6 sm:px-16 sm:pb-14">
            <h1 style={serifStyle} className="text-[34px] font-semibold leading-[1.15] tracking-tight sm:text-[46px]">
              {p.property.address}
            </h1>
            <p className="mt-3 text-[14px] text-[#C9D6CC]">
              {[
                p.property.propertyType,
                p.property.rooms !== null && p.property.rooms !== undefined && !p.property.propertyType?.includes("room")
                  ? `${p.property.rooms} rum`
                  : null,
                p.property.livingAreaM2 ? `${p.property.livingAreaM2} m²` : null,
                p.property.housingAssociation,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-8 border-t border-white/15 pt-7">
              <ScoreRing score={p.decisionScore} />
              <div className="flex min-w-[180px] flex-1 flex-col gap-5">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-[#8AA396]">Sammanvägt betyg</p>
                  <p style={serifStyle} className="mt-1 text-[20px] font-semibold text-[#D8B563]">
                    {p.verdict}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-[#8AA396]">Tillförlitlighet</p>
                  <p className="mt-1 text-[20px] font-semibold">{Math.round(p.overallConfidence * 100)}%</p>
                </div>
              </div>
            </div>

            {p.property.askingPriceSek && (
              <div className="mt-6 flex flex-wrap items-baseline gap-x-8 gap-y-1 border-t border-white/15 pt-6">
                <p className="text-[24px] font-semibold">{sek(p.property.askingPriceSek)}</p>
                {p.property.pricePerM2Sek && <p className="text-[14px] text-[#C9D6CC]">{sekPerM2(p.property.pricePerM2Sek)}</p>}
              </div>
            )}

            <p className="mt-8 max-w-xl text-[13.5px] leading-relaxed text-[#C9D6CC]">{executiveSummary[0]}</p>
          </div>

          <div className="relative flex items-center justify-between border-t border-white/15 px-8 py-5 text-[10px] uppercase tracking-wide text-[#8AA396] sm:px-16">
            <span>Kunskap före köp</span>
            <span>Köpanalys</span>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            2. EXECUTIVE SUMMARY
           ══════════════════════════════════════════════════════════ */}
        <Page n={2}>
          <ChapterTitle icon={<ClipboardIcon className="h-5 w-5" />} sub="En samlad läsning av hela analysen — pris, styrkor och svagheter utifrån tillgänglig data.">
            Sammanfattning
          </ChapterTitle>
          <div className="relative mb-8 grid grid-cols-3 gap-3">
            <MetricCard icon={<BadgeCheckIcon className="h-3.5 w-3.5" />} label="Beslutsbetyg" value={`${p.decisionScore}/100`} />
            <MetricCard icon={<ShieldIcon className="h-3.5 w-3.5" />} label="Tillförlitlighet" value={`${Math.round(p.overallConfidence * 100)}%`} />
            <MetricCard icon={<DatabaseIcon className="h-3.5 w-3.5" />} label="Anslutna källor" value={`${p.dataCompleteness.connectedSources}/${p.dataCompleteness.totalSources}`} />
          </div>
          <Prose paragraphs={executiveSummary} />
          <ChapterSources dataSources={p.dataSources} />
        </Page>

        {/* ══════════════════════════════════════════════════════════
            3. PROPERTY OVERVIEW
           ══════════════════════════════════════════════════════════ */}
        <Page n={3}>
          <ChapterTitle icon={<BuildingIcon className="h-5 w-5" />} sub="Samtliga tillgängliga uppgifter om bostaden. Fält som inte kunnat verifieras anges som Uppgift saknas.">
            Fastighetsinformation
          </ChapterTitle>

          {FACT_GROUPS.map((group) => {
            const rows = group.labels
              .map((label) => overviewRows.find((r: OverviewRow) => r.label === label))
              .filter((r): r is OverviewRow => !!r);
            return <FactGroup key={group.title} title={group.title} icon={group.icon} rows={rows} />;
          })}

          {((p.property.imageUrls ?? []).length > 0 || (p.property.floorplanUrls ?? []).length > 0) && (
            <div className="relative mt-8 flex items-center gap-3 rounded-md border border-black/[0.08] bg-black/[0.02] px-4 py-3.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#12271D]/[0.06] text-[#12271D]">
                <HouseIcon className="h-5 w-5" />
              </span>
              <div>
                <p className="text-[13.5px] font-semibold text-[#12271D]">Se bilder och planritning</p>
                <p className="text-[12px] text-[#8C8471]">Bilder och planritning visas nedan.</p>
              </div>
            </div>
          )}

          {p.property.description && (
            <>
              <SubHeading icon={<ClipboardIcon className="h-4 w-4" />}>Beskrivning</SubHeading>
              <p className="relative text-[14px] leading-relaxed text-[#3A362C]">{p.property.description}</p>
            </>
          )}

          {(p.property.imageUrls ?? []).length > 1 && (
            <>
              <SubHeading icon={<HouseIcon className="h-4 w-4" />}>Bilder</SubHeading>
              <div className="relative grid grid-cols-3 gap-2 sm:grid-cols-4">
                {(p.property.imageUrls ?? []).slice(0, 8).map((url, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={url} alt="" className="aspect-[4/3] w-full rounded-sm object-cover" />
                ))}
              </div>
            </>
          )}

          {(p.property.floorplanUrls ?? []).length > 0 && (
            <>
              <SubHeading icon={<BuildingIcon className="h-4 w-4" />}>Planritning</SubHeading>
              <div className="relative grid grid-cols-2 gap-2 sm:grid-cols-3">
                {(p.property.floorplanUrls ?? []).slice(0, 6).map((url, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={url} alt="" className="aspect-[4/3] w-full rounded-sm border border-black/10 object-contain bg-white" />
                ))}
              </div>
            </>
          )}
          <ChapterSources dataSources={p.dataSources} ids={["hemnet_page_scrape", "booli_listing", "nominatim_geocoding"]} />
        </Page>

        {/* ══════════════════════════════════════════════════════════
            4. PRICE ANALYSIS
           ══════════════════════════════════════════════════════════ */}
        <Page n={4}>
          <ChapterTitle icon={<WalletIcon className="h-5 w-5" />} sub="Prisnivå jämfört med området, baserat på tillgänglig data.">
            Prisanalys
          </ChapterTitle>

          {priceCards.length > 0 && (
            <div className="relative mb-8 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {priceCards.map((c) => (
                <MetricCard key={c.label} icon={c.icon} label={c.label} value={c.value} sub={c.sub} />
              ))}
            </div>
          )}

          <Prose paragraphs={priceAnalysis.paragraphs} />

          {priceMeter && (
            <>
              <SubHeading icon={<ChartIcon className="h-4 w-4" />}>Bedömning</SubHeading>
              <p className="relative -mt-2 mb-3 text-[12px] text-[#8C8471]">{priceMeter.caption}</p>
              <div className="relative">
                <SegmentedMeter bands={priceMeter.bands} activeIndex={priceMeter.activeIndex} />
              </div>
            </>
          )}

          {priceAnalysis.comparison && (
            <>
              <SubHeading icon={<TrendingUpIcon className="h-4 w-4" />}>Jämförelse med området</SubHeading>
              <div className="relative">
                <PriceComparisonBar
                  thisPricePerM2={priceAnalysis.comparison.thisPricePerM2}
                  areaMedianPerM2={priceAnalysis.comparison.areaMedianPerM2}
                />
              </div>
            </>
          )}

          {priceAnalysis.areaSoldPriceTrend.length > 0 && (
            <>
              <SubHeading icon={<ChartIcon className="h-4 w-4" />}>Prisutveckling i området</SubHeading>
              <div className="relative">
                <KeyValueTable
                  rows={priceAnalysis.areaSoldPriceTrend.map((t) => ({
                    label: t.period,
                    value: `${sekPerM2(t.medianPricePerM2Sek)} (${t.count} försäljning${t.count === 1 ? "" : "ar"})`,
                  }))}
                />
              </div>
            </>
          )}

          {priceAnalysis.comparableSales.length > 0 && (
            <>
              <SubHeading icon={<ClipboardIcon className="h-4 w-4" />}>Jämförbara sålda bostäder</SubHeading>
              <ul className="relative space-y-1.5">
                {priceAnalysis.comparableSales.slice(0, 10).map((c, i) => (
                  <li key={i} className="flex items-start gap-2 text-[13.5px] text-[#2A2820]">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[#B98A2E]" />
                    <span>
                      {[
                        c.address ?? "Okänd adress",
                        c.soldDate,
                        c.soldPriceSek !== null ? sek(c.soldPriceSek) : null,
                        c.livingAreaM2 !== null ? `${c.livingAreaM2} m²` : null,
                        c.pricePerM2Sek !== null ? sekPerM2(c.pricePerM2Sek) : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
          <ChapterSources dataSources={p.dataSources} ids={["hemnet_page_scrape", "booli_listing", "scb_area_statistics", "interest_rates"]} />
        </Page>

        {/* ══════════════════════════════════════════════════════════
            5. AREA ANALYSIS
           ══════════════════════════════════════════════════════════ */}
        <Page n={5}>
          <ChapterTitle icon={<MapPinIcon className="h-5 w-5" />} sub="Statistik och service i närområdet, baserat på tillgänglig data.">
            Områdesanalys
          </ChapterTitle>
          <Prose paragraphs={areaAnalysis.paragraphs.slice(0, 3)} />

          {!isFree && areaAnalysis.amenities.some((a) => a.value !== "Uppgift saknas") && (
            <>
              <SubHeading icon={<ShoppingBagIcon className="h-4 w-4" />}>Service inom 1 km</SubHeading>
              <div className="relative">
                <AmenityGrid
                  items={areaAnalysis.amenities.map((a, i) => ({
                    icon: AMENITY_ICONS[i],
                    label: AMENITY_SHORT_LABELS[i] ?? a.label,
                    value: a.value,
                  }))}
                />
              </div>
            </>
          )}

          {areaAnalysis.paragraphs[3] && (
            <Callout icon={<InfoIcon className="h-4 w-4" />}>{areaAnalysis.paragraphs[3]}</Callout>
          )}
          <ChapterSources dataSources={p.dataSources} ids={["booli_listing", "scb_area_statistics", "osm_amenities", "nominatim_geocoding"]} />
        </Page>

        {/* ══════════════════════════════════════════════════════════
            6. HOUSING ASSOCIATION
           ══════════════════════════════════════════════════════════ */}
        <Page n={6}>
          <ChapterTitle icon={<BuildingIcon className="h-5 w-5" />} sub="Föreningens redovisade nyckeltal och ekonomiska ställning.">
            Bostadsrättsförening
          </ChapterTitle>
          <Prose paragraphs={brf.paragraphs} />

          <SubHeading icon={<ChartIcon className="h-4 w-4" />}>Nyckeltal</SubHeading>
          {brf.metrics.length === 1 && brf.metrics[0].label === "Finansiella nyckeltal" ? (
            <p className="relative text-[13.5px] italic text-[#8C8471]">{brf.metrics[0].value}</p>
          ) : (
            <div className="relative grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {brf.metrics.map((m) => (
                <MetricCard key={m.label} icon={BRF_METRIC_ICON[m.label]} label={m.label} value={m.value} />
              ))}
            </div>
          )}

          {(brf.strengths.length > 0 || brf.weaknesses.length > 0) && (
            <div className="relative mt-8 grid grid-cols-1 gap-8 sm:grid-cols-2">
              {brf.strengths.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#4B7A57]">Styrkor</p>
                  <ul className="mt-2 space-y-1.5">
                    {brf.strengths.map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-[13px] leading-relaxed text-[#2A2820]">
                        <CheckIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#4B7A57]" />
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {brf.weaknesses.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#A2432F]">Svagheter</p>
                  <ul className="mt-2 space-y-1.5">
                    {brf.weaknesses.map((w, i) => (
                      <li key={i} className="flex items-start gap-2 text-[13px] leading-relaxed text-[#2A2820]">
                        <WarningIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#A2432F]" />
                        <span>
                          {w.text}
                          {w.severity && w.severity !== "minor" && <span className="ml-1 font-medium text-[#A2432F]">({w.severity})</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          <ChapterSources dataSources={p.dataSources} ids={["brf_financials", "brf_acquisition"]} />
        </Page>

        {/* ══════════════════════════════════════════════════════════
            7. RISK ASSESSMENT
           ══════════════════════════════════════════════════════════ */}
        <Page n={7}>
          <ChapterTitle icon={<WarningIcon className="h-5 w-5" />} sub="Åtta riskkategorier baserade på tillgänglig data.">
            Riskbedömning
          </ChapterTitle>
          <div className="relative">
            {riskCategories.map((risk) => (
              <div key={risk.id}>
                <RiskCategoryCard risk={risk} icon={RISK_ICON[risk.id] ?? <WarningIcon className="h-4 w-4" />} />
                {risk.id === "interest_rate" && policyRatePct !== null && (
                  <div className="-mt-2 mb-4 flex justify-center rounded-md border border-black/[0.08] bg-white/60 py-4">
                    <ArcGauge
                      value={policyRatePct}
                      min={0}
                      max={6}
                      valueLabel={`${policyRatePct.toFixed(1)}%`}
                      caption="Styrränta (Riksbanken)"
                      lowLabel="Låg"
                      highLabel="Hög"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
          <ChapterSources dataSources={p.dataSources} ids={["hemnet_page_scrape", "interest_rates", "scb_area_statistics", "osm_amenities", "brf_financials", "location_intelligence", "infrastructure_projects"]} />
        </Page>

        {/* ══════════════════════════════════════════════════════════
            8. INVESTMENT OUTLOOK
           ══════════════════════════════════════════════════════════ */}
        <Page n={8}>
          <ChapterTitle icon={<TrendingUpIcon className="h-5 w-5" />} sub="Faktorer som kan påverka bostadens värde framöver, baserat på tillgänglig data.">
            Investeringsutsikt
          </ChapterTitle>

          {macroCards.length > 0 && (
            <div className="relative mb-8 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {macroCards.map((c) => (
                <MetricCard key={c.label} icon={c.icon} label={c.label} value={c.value} sub={c.sub} />
              ))}
            </div>
          )}

          <Prose paragraphs={investmentOutlook.paragraphs.slice(0, 3)} />

          {!isFree && investmentOutlook.futureProjects.length > 0 && (
            <>
              <SubHeading icon={<CraneIcon className="h-4 w-4" />}>Planerad utveckling i närområdet</SubHeading>
              <div className="relative grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {investmentOutlook.futureProjects.map((proj, i) => (
                  <ProjectCard key={i} name={proj} />
                ))}
              </div>
            </>
          )}

          {investmentOutlook.paragraphs[3] && (
            <Callout icon={<LightbulbIcon className="h-4 w-4" />}>{investmentOutlook.paragraphs[3]}</Callout>
          )}
          <ChapterSources dataSources={p.dataSources} ids={["interest_rates", "scb_area_statistics", "market_intelligence", "location_intelligence", "infrastructure_projects"]} />
        </Page>

        {/* ══════════════════════════════════════════════════════════
            9. FINAL RECOMMENDATION
           ══════════════════════════════════════════════════════════ */}
        <Page n={9} source="Sammanställt av Köpanalys analysmotor" className="pb-16">
          <ChapterTitle icon={<BadgeCheckIcon className="h-5 w-5" />} sub="En sammanställning av beslutsbetyg, riskbild och de delar av analysen som saknar underlag.">
            Helhetsbild
          </ChapterTitle>

          {recommendation.paragraphs[0] && (
            <p style={serifStyle} className="relative mb-5 text-[18px] font-medium leading-snug text-[#12271D]">
              {recommendation.paragraphs[0]}
            </p>
          )}
          <Prose paragraphs={recommendation.paragraphs.slice(1)} />

          {negotiationScore !== null && (
            <>
              <SubHeading icon={<ChartIcon className="h-4 w-4" />}>Förhandlingsläge</SubHeading>
              <div className="relative">
                <SegmentedMeter bands={["Begränsat utrymme", "Måttligt utrymme", "Stort utrymme"]} activeIndex={negotiationBand(negotiationScore).bandIndex} />
              </div>
            </>
          )}

          <div className="relative mt-8 grid grid-cols-1 gap-8 sm:grid-cols-2">
            {recommendation.strengths.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#4B7A57]">Huvudsakliga styrkor</p>
                <ul className="mt-2 space-y-2">
                  {recommendation.strengths.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-[13px] leading-relaxed text-[#2A2820]">
                      <CheckIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#4B7A57]" />
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {recommendation.weaknesses.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#A2432F]">Huvudsakliga svagheter</p>
                <ul className="mt-2 space-y-2">
                  {recommendation.weaknesses.map((w, i) => (
                    <li key={i} className="flex items-start gap-2 text-[13px] leading-relaxed text-[#2A2820]">
                      <WarningIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#A2432F]" />
                      <span>{w}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <SubHeading icon={<ClipboardIcon className="h-4 w-4" />}>Avgränsningar i analysen</SubHeading>
          <ul className="relative space-y-1.5">
            {recommendation.actions.map((a, i) => (
              <li key={i} className="flex items-start gap-2 text-[13.5px] text-[#2A2820]">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[#12271D]" />
                <span>{a}</span>
              </li>
            ))}
          </ul>

          <SubHeading icon={<QuestionIcon className="h-4 w-4" />}>Uppgifter som saknas för denna bostad</SubHeading>
          <ul className="relative space-y-1.5">
            {recommendation.questionsToAsk.map((q, i) => (
              <li key={i} className="flex items-start gap-2 text-[13.5px] text-[#2A2820]">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[#12271D]" />
                <span>{q}</span>
              </li>
            ))}
          </ul>

          <SubHeading icon={<ChartIcon className="h-4 w-4" />}>Faktorer kopplade till förhandlingsläget</SubHeading>
          <ul className="relative space-y-1.5">
            {recommendation.negotiationArguments.map((n, i) => (
              <li key={i} className="flex items-start gap-2 text-[13.5px] text-[#2A2820]">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[#B98A2E]" />
                <span>{n}</span>
              </li>
            ))}
          </ul>

          <ChapterSources dataSources={p.dataSources} ids={["hemnet_page_scrape", "booli_listing", "scb_area_statistics", "interest_rates"]} />

          <div className="relative mt-10 border-t border-black/10 pt-5 text-[11px] text-[#8C8471]">
            Analys v{analysis.version} · genererad {generatedDate} · motor {p.engineVersion} · {p.dataCompleteness.connectedSources} av{" "}
            {p.dataCompleteness.totalSources} datakällor anslutna.
          </div>
        </Page>
      </main>

      {hasPremiumInspectionAccess && (
        <div className="no-print mx-auto mt-6 flex w-full max-w-[880px] flex-wrap items-center justify-between gap-4 rounded-sm border border-[#12271D]/15 bg-[#0E2B1F] px-8 py-6 sm:px-16">
          <div>
            <p className="text-sm font-semibold text-[#F5F1E4]">Nästa steg: Besiktningshjälp</p>
            <p className="mt-1 max-w-md text-xs leading-relaxed text-[#C9D6CC]">
              Fortsätt till vår besiktningsassistent — den läser automatiskt in den här analysen och guidar dig
              genom förberedelser, genomgång och en slutlig sammanfattning.
            </p>
          </div>
          <Link
            href={`/dashboard/inspection?propertyId=${property.id}`}
            className="shrink-0 rounded-sm bg-[#4ADE80] px-5 py-2.5 text-sm font-semibold text-[#0E2B1F] transition hover:bg-[#6EE7A0]"
          >
            Fortsätt till besiktning
          </Link>
        </div>
      )}

      <style>{`
        @media print {
          .no-print { display: none !important; }
          .report-page { break-after: page; }
          main { box-shadow: none !important; }
        }
      `}</style>
    </div>
  );
}
