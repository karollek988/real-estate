import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { after } from "next/server";
import localFont from "next/font/local";
import { getReportForViewer } from "@/lib/analysis/access";
import { createClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/lib/auth/admin";
import { analysisAgeDays, FRESH_ANALYSIS_MAX_AGE_DAYS } from "@/lib/analysis/pipeline";
import type {
  AnalysisRecord,
  AnalysisReport,
  DataSourceReport,
  PropertyRecord,
  ReportFactor,
} from "@/lib/analysis/types";
import { ensureBrfReview, getBrfReview, type BrfReviewRecord } from "@/lib/brf/reviews";
import { notifyTeamOfBrfReview } from "@/lib/brf/notify";
import { UpdateAnalysisButton } from "@/components/report/UpdateAnalysisButton";
import { BrfReportUpload } from "@/components/report/BrfReportUpload";
import { BrfAnalysis } from "@/components/report/BrfAnalysis";
import { IconFactGrid, type IconFactRow } from "@/components/report/IconFactGrid";
import { RiskCategoryCard } from "@/components/report/RiskCategoryCard";
import { MetricCard } from "@/components/report/MetricCard";
import { Callout } from "@/components/report/Callout";
import { AmenityGrid } from "@/components/report/AmenityGrid";
import { SchoolList } from "@/components/report/SchoolList";
import { ProjectCard } from "@/components/report/ProjectCard";
import { SourceBadges } from "@/components/report/SourceBadges";
import { Watermark } from "@/components/report/Watermark";
import {
  buildAreaAnalysis,
  buildExecutiveSummary,
  buildInvestmentOutlook,
  buildPropertyOverview,
  buildRiskCategories,
  sek,
  sekPerM2,
  sourcesUsed,
  type AreaAnalysisContent,
  type CivicStatsInfo,
  type CommuteInfo,
  type OverviewRow,
} from "@/lib/report/build";
import { brfChapterState, brfIntroParagraphs, type BrfChapterState, type BrfReviewView } from "@/lib/report/brfChapter";
import { buildQuestions } from "@/lib/report/questions";
import { tenureOf } from "@/lib/report/tenure";
import { decSv, ratePctSv } from "@/lib/report/format";
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
  CarIcon,
  BusIcon,
  WalkIcon,
  MedicalCrossIcon,
  CraneIcon,
  LightbulbIcon,
  InfoIcon,
  CheckIcon,
  DatabaseIcon,
  QuestionIcon,
} from "@/components/icons";
import { ROUTES } from "@/components/site/navigation";

const serif = localFont({
  src: [
    {
      path: "./fonts/SourceSerif4-normal.woff2",
      weight: "400 700",
      style: "normal",
    },
    {
      path: "./fonts/SourceSerif4-italic.woff2",
      weight: "400 700",
      style: "italic",
    },
  ],
  variable: "--font-report-serif",
  display: "swap",
});

const serifStyle: React.CSSProperties = { fontFamily: "var(--font-report-serif)" };

/* ─── Presentation-only helpers ─────────────────────────────────────────
   These only read facts build.ts already composed or the analysis collected;
   nothing here derives a rating. */

function factorOf(report: AnalysisReport, id: string): ReportFactor | undefined {
  return report.decisionFactors?.find((f) => f.id === id);
}

function numOf(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function civicRows(civic: CivicStatsInfo): IconFactRow[] {
  const rows: IconFactRow[] = [];
  if (civic.safetyIndex !== null) {
    rows.push({ icon: <BadgeCheckIcon className="h-4 w-4" />, label: "Trygghetsindex (Kolada, kommunnivå)", value: decSv(civic.safetyIndex) });
  }
  if (civic.recentPoliceEvents !== null) {
    rows.push({ icon: <WarningIcon className="h-4 w-4" />, label: "Polisens händelser, senaste 30 dagarna (länsnivå)", value: String(civic.recentPoliceEvents) });
  }
  if (civic.voterTurnoutPct !== null) {
    rows.push({ icon: <PercentIcon className="h-4 w-4" />, label: "Valdeltagande, senaste kommunvalet", value: ratePctSv(civic.voterTurnoutPct) });
  }
  return rows;
}

function commuteRows(commute: CommuteInfo): IconFactRow[] {
  const rows: IconFactRow[] = [];
  const min = (n: number | null) => (n !== null ? `${n} min` : null);
  const carIcon = <CarIcon className="h-4 w-4" />;
  const busIcon = <BusIcon className="h-4 w-4" />;
  const walkIcon = <WalkIcon className="h-4 w-4" />;

  if (commute.centrumName) {
    const car = min(commute.centrumCarMinutes);
    const transit = min(commute.centrumTransitMinutes);
    const walk = min(commute.centrumWalkMinutes);
    if (car) rows.push({ icon: carIcon, label: `Bil till ${commute.centrumName}`, value: car });
    if (transit) rows.push({ icon: busIcon, label: `Kollektivt till ${commute.centrumName}`, value: transit });
    if (walk) rows.push({ icon: walkIcon, label: `Gång till ${commute.centrumName}`, value: walk });
  }
  if (commute.cityName) {
    const car = min(commute.cityCarMinutes);
    const transit = min(commute.cityTransitMinutes);
    if (transit) rows.push({ icon: busIcon, label: `Kollektivt till ${commute.cityName}`, value: transit });
    if (car) rows.push({ icon: carIcon, label: `Bil till ${commute.cityName}`, value: car });
  }
  return rows;
}

// Per-chapter accent colors for ChapterTitle/SubHeading/Callout — chosen
// from colors already used elsewhere in this file so a new chapter color
// never introduces a brand-new hue, just reuses one with a new meaning
// (green = area/growth, blue = association finances, red = risk).
// Boendekalkyl and every other chapter keep the default gold accent.
const AREA_ACCENT = "#4B7A57";
const BRF_ACCENT = "#3B5F7A";
const RISK_ACCENT = "#A2432F";

const AMENITY_ICONS = [
  <ShoppingBagIcon key="grocery" className="h-4 w-4" />,
  <GraduationCapIcon key="school" className="h-4 w-4" />,
  <UtensilsIcon key="restaurant" className="h-4 w-4" />,
  <TreeIcon key="park" className="h-4 w-4" />,
  <BusIcon key="transit" className="h-4 w-4" />,
  <MedicalCrossIcon key="hospital" className="h-4 w-4" />,
];
const AMENITY_SHORT_LABELS = ["Matbutiker", "Skolor", "Restauranger", "Parker", "Kollektivtrafik", "Vårdinrättning"];

const RISK_ICON: Record<string, React.ReactNode> = {
  market: <ChartIcon className="h-4 w-4" />,
  interest_rate: <PercentIcon className="h-4 w-4" />,
  housing_association: <BuildingIcon className="h-4 w-4" />,
  area: <MapPinIcon className="h-4 w-4" />,
  fee: <WalletIcon className="h-4 w-4" />,
  environmental: <WarningIcon className="h-4 w-4" />,
  construction: <BuildingIcon className="h-4 w-4" />,
  future: <CraneIcon className="h-4 w-4" />,
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
    labels: ["Upplåtelseform", "Öppen budgivning", "Annonsdatum", "Objekt-ID", "Planritning"],
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

/** `accent` gives each chapter its own identifying color on the title
 *  underline (and, further down, its SubHeadings/Callouts) so a reader
 *  flipping through the report can tell which chapter they're on at a
 *  glance — defaults to the report's gold brand color, unchanged from
 *  before, for chapters that don't set one. */
function ChapterTitle({
  children,
  sub,
  icon,
  accent = "#B98A2E",
}: {
  children: React.ReactNode;
  sub?: string;
  icon: React.ReactNode;
  accent?: string;
}) {
  return (
    <div className="relative mb-9">
      <div className="flex items-center gap-3.5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#12271D] text-white">
          {icon}
        </span>
        <h2 style={serifStyle} className="text-[27px] font-semibold tracking-tight text-[#12271D] sm:text-[31px]">
          {children}
        </h2>
      </div>
      {sub && <p className="mt-2.5 text-[14.5px] text-[#8C8471]">{sub}</p>}
      <div className="mt-5 h-[3px] w-16 rounded-full" style={{ backgroundColor: accent }} />
    </div>
  );
}

function ChapterSources({ dataSources, ids, extra = [] }: { dataSources: DataSourceReport[]; ids?: string[]; extra?: string[] }) {
  const names = Array.from(new Set([...sourcesUsed(dataSources, ids), ...extra]));
  if (names.length === 0) return null;
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
        <p key={i} className="text-[15.5px] leading-[1.8] text-[#2A2820]">
          {p}
        </p>
      ))}
    </div>
  );
}

function SubHeading({ children, icon, accent = "#B98A2E" }: { children: React.ReactNode; icon?: React.ReactNode; accent?: string }) {
  return (
    <h3
      style={{ ...serifStyle, borderLeftColor: `${accent}66` }}
      className="relative mb-3 mt-9 flex items-center gap-2 border-l-[3px] py-0.5 pl-3 text-[17.5px] font-semibold text-[#12271D] first:mt-0"
    >
      {icon && <span className="flex h-6 w-6 shrink-0 items-center justify-center" style={{ color: accent }}>{icon}</span>}
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

/** The report's cover. `lead` is the optional first paragraph under the facts. */
function ReportCover({
  p,
  generatedDate,
  lead,
  kind,
}: {
  p: AnalysisReport;
  generatedDate: string;
  lead?: string;
  /** Shown above the address when the report is one standalone analysis rather than the whole package. */
  kind?: string;
}) {
  const facts = [
    p.property.propertyType,
    p.property.rooms !== null && p.property.rooms !== undefined && !p.property.propertyType?.includes("rum")
      ? `${p.property.rooms} rum`
      : null,
    p.property.livingAreaM2 ? `${p.property.livingAreaM2} m²` : null,
    p.property.housingAssociation,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
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
        {kind && <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#D8B563]">{kind}</p>}
        <h1 style={serifStyle} className="text-[34px] font-semibold leading-[1.15] tracking-tight sm:text-[46px]">
          {p.property.address}
        </h1>
        {facts && <p className="mt-3 text-[14px] text-[#C9D6CC]">{facts}</p>}

        {p.property.askingPriceSek && (
          <div className="mt-9 flex flex-wrap items-baseline gap-x-8 gap-y-1 border-t border-white/15 pt-7">
            <p className="text-[24px] font-semibold">{sek(p.property.askingPriceSek)}</p>
            {p.property.pricePerM2Sek && <p className="text-[14px] text-[#C9D6CC]">{sekPerM2(p.property.pricePerM2Sek)}</p>}
          </div>
        )}

        {lead && <p className="mt-8 max-w-xl text-[13.5px] leading-relaxed text-[#C9D6CC]">{lead}</p>}
      </div>

      <div className="relative flex items-center justify-between border-t border-white/15 px-8 py-5 text-[10px] uppercase tracking-wide text-[#8AA396] sm:px-16">
        <span>Kunskap före köp</span>
        <span>Köpanalys</span>
      </div>
    </section>
  );
}

/** The Områdesanalys chapter — page 5 of the full report, page 2 of the standalone Områdesanalys. */
function AreaChapter({
  n,
  areaAnalysis,
  dataSources,
  footnote,
}: {
  n: number;
  areaAnalysis: AreaAnalysisContent;
  dataSources: DataSourceReport[];
  footnote?: React.ReactNode;
}) {
  return (
    <Page n={n}>
      <ChapterTitle icon={<MapPinIcon className="h-5 w-5" />} sub="Statistik och service i närområdet, baserat på tillgänglig data." accent={AREA_ACCENT}>
        Områdesanalys
      </ChapterTitle>
      <Prose paragraphs={areaAnalysis.paragraphs.slice(0, 3)} />

      {areaAnalysis.amenities.some((a) => a.value !== "Uppgift saknas") && (
        <>
          <SubHeading icon={<ShoppingBagIcon className="h-4 w-4" />} accent={AREA_ACCENT}>Service inom 1 km</SubHeading>
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

      {areaAnalysis.commute && (
        <>
          <SubHeading icon={<CarIcon className="h-4 w-4" />} accent={AREA_ACCENT}>Pendling</SubHeading>
          <div className="relative">
            <IconFactGrid rows={commuteRows(areaAnalysis.commute)} />
          </div>
        </>
      )}

      {areaAnalysis.civicStats && (
        <>
          <SubHeading icon={<BadgeCheckIcon className="h-4 w-4" />} accent={AREA_ACCENT}>Trygghet & samhälle</SubHeading>
          <div className="relative">
            <IconFactGrid rows={civicRows(areaAnalysis.civicStats)} />
          </div>
          <p className="relative text-[11.5px] text-[#8C8471]">
            Trygghetsindex och valdeltagande avser hela kommunen (Kolada), inte adressen specifikt. Polisens
            händelser är en händelselogg på länsnivå, inte en brottsstatistik — se BRÅ:s officiella statistik
            för en fullständig bild.
          </p>
        </>
      )}

      {areaAnalysis.schools && (
        <>
          <SubHeading icon={<GraduationCapIcon className="h-4 w-4" />} accent={AREA_ACCENT}>Skolor i närområdet</SubHeading>
          {areaAnalysis.paragraphs[4] && (
            <p className="relative text-[11.5px] text-[#8C8471]">{areaAnalysis.paragraphs[4]}</p>
          )}
          <div className="relative space-y-5">
            {areaAnalysis.schools.preschools.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#8C8471]">Förskolor</p>
                <SchoolList rows={areaAnalysis.schools.preschools} />
              </div>
            )}
            {areaAnalysis.schools.primarySchools.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#8C8471]">Grundskolor</p>
                <SchoolList rows={areaAnalysis.schools.primarySchools} />
              </div>
            )}
            {areaAnalysis.schools.highSchools.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#8C8471]">Gymnasieskolor</p>
                <SchoolList rows={areaAnalysis.schools.highSchools} />
              </div>
            )}
          </div>
        </>
      )}

      {areaAnalysis.paragraphs[3] && (
        <Callout icon={<InfoIcon className="h-4 w-4" />} accent={AREA_ACCENT}>{areaAnalysis.paragraphs[3]}</Callout>
      )}
      <ChapterSources dataSources={dataSources} ids={["booli_listing", "scb_area_statistics", "osm_amenities", "skolverket_schools", "nominatim_geocoding", "commute_times", "location_intelligence"]} />
      {footnote}
    </Page>
  );
}

const CHECKLIST_ITEM = "flex items-start gap-2 text-[14px] leading-relaxed text-[#2A2820]";

function QuestionList({ items, color = "#12271D" }: { items: string[]; color?: string }) {
  return (
    <ul className="relative space-y-2">
      {items.map((q) => (
        <li key={q} className={CHECKLIST_ITEM}>
          <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
          <span>{q}</span>
        </li>
      ))}
    </ul>
  );
}

const HOUSING_COST_PREVIEW = [
  "Vad bostaden kostar dig varje månad: avgift eller driftskostnad, ränta och amortering vid olika räntenivåer.",
  "Engångskostnaderna vid köpet — till exempel lagfart och pantbrev när du köper ett hus.",
  "Avgifter som är lätta att missa, som överlåtelse- och pantsättningsavgift och kommande avgiftshöjningar i föreningen.",
];

function FullReportBody({
  p,
  attributes,
  property,
  analysis,
  generatedDate,
  brf,
}: {
  p: AnalysisReport;
  attributes: Record<string, unknown>;
  property: PropertyRecord;
  analysis: AnalysisRecord;
  generatedDate: string;
  brf: BrfChapterState;
}) {
  // Every chapter below is built from the viewer's own report (p). There are
  // no locked chapters: whoever holds the full analysis sees all of it. (An
  // area-only viewer never reaches this component — see ReportPage.)
  const overviewRows = buildPropertyOverview(p, attributes);
  const executiveSummary = buildExecutiveSummary(p, brf);
  const areaAnalysis = buildAreaAnalysis(p, attributes, p.dataSources);
  const riskCategories = buildRiskCategories(p, p.dataSources, brf);
  const investmentOutlook = buildInvestmentOutlook(p);
  const questions = buildQuestions(p, brf);

  const marketFactor = factorOf(p, "market");
  const futureFactor = factorOf(p, "futureDevelopment");
  const rateChangePctPoints = numOf(marketFactor?.supportingData.policyRateChangePctPoints);
  const currentPolicyRatePct = numOf(marketFactor?.supportingData.currentPolicyRatePct);
  const employmentRatePct = numOf(marketFactor?.supportingData.municipalityEmploymentRatePct);
  const plannedProjectsCount = numOf(futureFactor?.supportingData.nearbyPlannedProjectsCount);

  const macroCards: { icon: React.ReactNode; label: string; value: string; sub?: string }[] = [];
  if (rateChangePctPoints !== null) {
    macroCards.push({
      icon: <PercentIcon className="h-3.5 w-3.5" />,
      label: "Styrränta, 12 mån",
      value: `${rateChangePctPoints > 0 ? "+" : ""}${decSv(rateChangePctPoints, 2)} p.e.`,
      sub: currentPolicyRatePct !== null ? `Nu ${ratePctSv(currentPolicyRatePct)}` : undefined,
    });
  }
  if (employmentRatePct !== null) {
    macroCards.push({ icon: <BadgeCheckIcon className="h-3.5 w-3.5" />, label: "Sysselsättningsgrad", value: `${decSv(employmentRatePct)} %` });
  }
  if (plannedProjectsCount !== null) {
    macroCards.push({ icon: <CraneIcon className="h-3.5 w-3.5" />, label: "Planerade projekt", value: String(plannedProjectsCount) });
  }

  // Page numbers follow the chapters actually shown (a house has no BRF chapter).
  let pageNumber = 1;
  const nextPage = () => ++pageNumber;

  return (
    <>
      {/* ══════════════════════════════════════════════════════════
          COVER
         ══════════════════════════════════════════════════════════ */}
      <ReportCover
        p={p}
        generatedDate={generatedDate}
        kind="Trygghetspaket"
        lead={
          brf.kind === "freehold"
            ? "En samlad genomgång av det som påverkar köpet: bostaden, området, riskerna och frågorna att ställa innan du bjuder."
            : "En samlad genomgång av det som påverkar köpet: föreningens ekonomi, området, riskerna och frågorna att ställa innan du bjuder."
        }
      />

      {/* ══════════════════════════════════════════════════════════
          EXECUTIVE SUMMARY
         ══════════════════════════════════════════════════════════ */}
      <Page n={nextPage()}>
        <ChapterTitle icon={<ClipboardIcon className="h-5 w-5" />} sub="Vad rapporten innehåller, vad som granskas och vad som saknas.">
          Sammanfattning
        </ChapterTitle>
        <div className="relative mb-8 max-w-[220px]">
          <MetricCard icon={<DatabaseIcon className="h-3.5 w-3.5" />} label="Anslutna källor" value={`${p.dataCompleteness.connectedSources}/${p.dataCompleteness.totalSources}`} />
        </div>
        <Prose paragraphs={executiveSummary} />
        <ChapterSources dataSources={p.dataSources} />
      </Page>

      {/* ══════════════════════════════════════════════════════════
          PROPERTY OVERVIEW
         ══════════════════════════════════════════════════════════ */}
      <Page n={nextPage()}>
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
          BOENDEKALKYL — placeholder until it is built (the verified cost
          rules it will use are in lib/report/housingCost.ts)
         ══════════════════════════════════════════════════════════ */}
      <Page n={nextPage()}>
        <ChapterTitle icon={<WalletIcon className="h-5 w-5" />} sub="Vad bostaden kostar dig — varje månad och vid köpet.">
          Boendekalkyl
        </ChapterTitle>
        <div className="relative rounded-lg border border-dashed border-[#B98A2E]/45 bg-[#B98A2E]/[0.05] p-6 sm:p-7">
          <span className="inline-flex rounded-full bg-[#B98A2E]/15 px-3 py-1 text-[12px] font-semibold text-[#7A5A16]">Lanseras inom kort</span>
          <p style={serifStyle} className="mt-4 text-[20px] font-semibold leading-snug text-[#12271D]">
            Boendekalkylen håller på att färdigställas
          </p>
          <p className="mt-2 text-[14.5px] leading-relaxed text-[#2A2820]">
            Här kommer du att se vad bostaden kostar dig på riktigt, och inte bara priset i annonsen:
          </p>
          <ul className="mt-3 space-y-2">
            {HOUSING_COST_PREVIEW.map((item) => (
              <li key={item} className={CHECKLIST_ITEM}>
                <CheckIcon className="mt-1 h-3.5 w-3.5 shrink-0 text-[#B98A2E]" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </Page>

      {/* ══════════════════════════════════════════════════════════
          HOUSING ASSOCIATION — reviewed by a person before it is shown
         ══════════════════════════════════════════════════════════ */}
      {brf.kind !== "freehold" && (
        <Page n={nextPage()}>
          <ChapterTitle icon={<BuildingIcon className="h-5 w-5" />} sub="Föreningens ekonomi i klartext — granskad av Köpanalys." accent={BRF_ACCENT}>
            Bostadsrättsförening
          </ChapterTitle>
          <div className="mb-6">
            <Prose paragraphs={brfIntroParagraphs(p)} />
          </div>
          <BrfAnalysis
            state={brf}
            associationName={p.property.housingAssociation}
            upload={
              brf.kind === "not_applicable" ? undefined : (
                <BrfReportUpload
                  propertyId={property.id}
                  label={brf.kind === "published" ? "Har föreningen en nyare årsredovisning?" : "Ladda upp föreningens årsredovisning"}
                  description={
                    brf.kind === "published"
                      ? "Ladda upp den (PDF, Word eller foto) så granskar vi den och uppdaterar analysen inom 24 timmar."
                      : "PDF, Word eller foto av årsredovisningen, högst 20 MB. Du får den av mäklaren eller föreningen."
                  }
                />
              )
            }
          />
          {brf.kind === "published" && <ChapterSources dataSources={[]} extra={["Föreningens årsredovisning, granskad av Köpanalys"]} />}
        </Page>
      )}

      {/* ══════════════════════════════════════════════════════════
          AREA ANALYSIS
         ══════════════════════════════════════════════════════════ */}
      <AreaChapter n={nextPage()} areaAnalysis={areaAnalysis} dataSources={p.dataSources} />

      {/* ══════════════════════════════════════════════════════════
          POSSIBLE RISKS
         ══════════════════════════════════════════════════════════ */}
      <Page n={nextPage()}>
        <ChapterTitle icon={<WarningIcon className="h-5 w-5" />} sub="Faktorer värda att undersöka vidare, baserat på tillgänglig data." accent={RISK_ACCENT}>
          Möjliga risker
        </ChapterTitle>
        <div className="relative">
          {riskCategories.map((risk) => (
            <RiskCategoryCard key={risk.id} risk={risk} icon={RISK_ICON[risk.id] ?? <WarningIcon className="h-4 w-4" />} />
          ))}
        </div>
        <ChapterSources
          dataSources={p.dataSources}
          ids={["hemnet_page_scrape", "interest_rates", "scb_area_statistics", "osm_amenities", "location_intelligence", "infrastructure_projects"]}
          extra={brf.kind === "published" ? ["Föreningens årsredovisning, granskad av Köpanalys"] : []}
        />
      </Page>

      {/* ══════════════════════════════════════════════════════════
          FUTURE OUTLOOK
         ══════════════════════════════════════════════════════════ */}
      <Page n={nextPage()}>
        <ChapterTitle icon={<TrendingUpIcon className="h-5 w-5" />} sub="Ränteläge, sysselsättning och planerade projekt som kan påverka området framöver.">
          Framtidsutsikter
        </ChapterTitle>
        {macroCards.length > 0 && (
          <div className="relative mb-8 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {macroCards.map((c) => (
              <MetricCard key={c.label} icon={c.icon} label={c.label} value={c.value} sub={c.sub} />
            ))}
          </div>
        )}

        <Prose paragraphs={investmentOutlook.paragraphs.slice(0, 3)} />

        {investmentOutlook.futureProjects.length > 0 && (
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
          QUESTIONS BEFORE THE VIEWING
         ══════════════════════════════════════════════════════════ */}
      <Page n={nextPage()} source="Sammanställt av Köpanalys" className="pb-16">
        <ChapterTitle
          icon={<QuestionIcon className="h-5 w-5" />}
          sub={
            questions.association.length > 0
              ? "Det som är bra att fråga mäklaren och föreningen inför visningen och ett eventuellt bud."
              : "Det som är bra att fråga mäklaren inför visningen och ett eventuellt bud."
          }
        >
          Frågor inför visningen
        </ChapterTitle>

        <SubHeading icon={<QuestionIcon className="h-4 w-4" />}>Till mäklaren</SubHeading>
        <QuestionList items={questions.broker} />

        {questions.association.length > 0 && (
          <>
            <SubHeading icon={<BuildingIcon className="h-4 w-4" />} accent={BRF_ACCENT}>Till föreningen</SubHeading>
            <QuestionList items={questions.association} color={BRF_ACCENT} />
            {questions.associationNote && <p className="relative mt-3 text-[12.5px] italic text-[#8C8471]">{questions.associationNote}</p>}
          </>
        )}

        <SubHeading icon={<InfoIcon className="h-4 w-4" />}>Det här ingår inte i rapporten</SubHeading>
        <QuestionList items={questions.notCovered} color="#8C8471" />

        <div className="relative mt-10 border-t border-black/10 pt-5 text-[11px] text-[#8C8471]">
          Analys v{analysis.version} · genererad {generatedDate} · motor {p.engineVersion} · {p.dataCompleteness.connectedSources} av{" "}
          {p.dataCompleteness.totalSources} datakällor anslutna.
        </div>
      </Page>
    </>
  );
}

/** The plain review data the report needs (lib/report/brfChapter.ts). */
function reviewView(review: BrfReviewRecord): BrfReviewView {
  return {
    status: review.status,
    figures: review.published,
    publishedAt: review.publishedAt,
    dueAt: review.status === "pending" ? review.dueAt : null,
    documentReceived: review.brfReportId !== null,
  };
}

/**
 * The BRF chapter's state for a full report. A full report of a home with an
 * association always has a review: one that is missing (a report from before
 * reviews existed, or a purchase whose review couldn't be opened) is opened
 * here, and the team is told. A database hiccup shows "under review" rather
 * than breaking the report.
 */
async function loadBrfState(report: AnalysisReport, propertyId: string): Promise<BrfChapterState> {
  try {
    let review = await getBrfReview(propertyId);
    if (!review && tenureOf(report.property) !== "freehold") {
      const ensured = await ensureBrfReview(propertyId, "report_view");
      review = ensured.review;
      if (ensured.opened) {
        after(() =>
          notifyTeamOfBrfReview(ensured.review, "report_view").catch((err) =>
            console.error(`BRF review notification failed for property ${propertyId}:`, err)
          )
        );
      }
    }
    return brfChapterState(report, review ? reviewView(review) : null);
  } catch (err) {
    console.error(`report: could not load the BRF review for property ${propertyId}:`, err);
    return brfChapterState(report, null);
  }
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

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const found = await getReportForViewer(id, user?.id ?? null, { isReviewer: isAdminUser(user) });
  if (!found) redirect("/");

  const { analysis, property, access } = found;
  const isAreaOnly = access.viewScope === "area";

  // Visningsguiden is part of the Trygghetspaket — it builds on the whole
  // report, so an area-only analysis doesn't lead into it.
  const hasInspectionAccess = Boolean(user) && !isAreaOnly && analysis.status === "complete";

  if (analysis.status !== "complete" || !analysis.report) {
    // "insufficient_data" is the one failure this page explains in detail —
    // it's the common, expected case (a listing whose source data was too
    // thin/unreliable to analyze) and quota is *always* refunded for it
    // (pipeline.ts's InsufficientListingDataError path), so the reassurance
    // here is never a promise the backend doesn't keep. Any other cause
    // (a genuine bug, or the rare case of landing here while still
    // "pending") gets the plainer, no-promises message instead — it must
    // never claim a refund that isn't guaranteed for it.
    const isInsufficientData = analysis.status === "failed" && analysis.failureReason === "insufficient_data";

    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#F7F4EC] px-6 py-16 text-[#1B1F27]">
        <main className="flex w-full max-w-[480px] flex-col items-center rounded-[28px] border border-[#12271D]/10 bg-white/80 p-9 text-center shadow-[0_30px_70px_-30px_rgba(18,39,29,0.3)] backdrop-blur-sm sm:p-11">
          <Image
            src="/kopanalys-bostad-logo.png"
            alt="Köpanalys"
            width={56}
            height={56}
            className="h-12 w-12 rounded-full sm:h-14 sm:w-14"
          />
          <span className="mt-6 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#12271D]/[0.07] text-[#12271D]">
            <InfoIcon className="h-6 w-6" />
          </span>
          <h1 style={serifStyle} className="mt-5 text-[22px] font-semibold leading-snug tracking-tight sm:text-2xl">
            {isInsufficientData ? "Vi kunde tyvärr inte slutföra analysen" : "Analysen kunde inte slutföras"}
          </h1>
          {isInsufficientData ? (
            <div className="mt-4 flex flex-col gap-3.5">
              <p className="text-sm leading-relaxed text-[#5B5648]">
                Vi lyckades inte hämta in tillräckligt med tillförlitlig information om {property.address} för
                att kunna göra en analys du kan lita på. Vi är verkligen ledsna för det.
              </p>
              <p className="text-sm leading-relaxed text-[#5B5648]">
                Din analys har <span className="font-medium text-[#12271D]">inte förbrukats</span> — krediten är
                automatiskt återförd till ditt konto, så du kan använda den för att analysera en annan bostad
                istället.
              </p>
              <p className="text-sm leading-relaxed text-[#5B5648]">
                Vi jobbar löpande med att förbättra Köpanalys och kommer att undersöka varför just den här
                bostaden inte gick att analysera. Målet är att kunna erbjuda en analys för adressen längre fram,
                när vi löst det underliggande problemet.
              </p>
            </div>
          ) : (
            <p className="mt-4 text-sm leading-relaxed text-[#5B5648]">
              Något gick fel vid analysen av {property.address}. Kontakta oss gärna på info@kopanalys.se om
              problemet kvarstår.
            </p>
          )}
          <Link
            href="/"
            className="mt-8 inline-flex w-fit items-center justify-center rounded-full bg-[#12271D] px-8 py-3 text-sm font-semibold text-white transition hover:bg-[#0D1D15]"
          >
            Tillbaka till startsidan
          </Link>
          {isInsufficientData && (
            <Link
              href="/dashboard"
              className="mt-3.5 text-sm font-medium text-[#5B5648] underline-offset-4 transition hover:text-[#12271D] hover:underline"
            >
              Till mitt konto
            </Link>
          )}
        </main>
      </div>
    );
  }

  const p: AnalysisReport = analysis.report;
  const attributes = property.attributes;
  const brf = isAreaOnly ? null : await loadBrfState(p, property.id);
  const ageDays = analysisAgeDays(analysis);
  const isStale = ageDays >= FRESH_ANALYSIS_MAX_AGE_DAYS;
  const generatedDate = new Date(analysis.createdAt).toLocaleDateString("sv-SE", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className={`${serif.variable} min-h-screen bg-[#F7F4EC]`}>
      {/* ── Screen-only top bar (hidden in print) ── */}
      <div className="no-print mx-auto flex w-full max-w-[880px] items-center justify-between px-8 py-5 sm:px-16">
        <Link href={ROUTES.skapaAnalys} className="text-sm font-medium text-[#5B5648] transition hover:text-[#12271D]">
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
        {isAreaOnly ? (
          <>
            <ReportCover p={p} generatedDate={generatedDate} kind="Områdesanalys" />
            <AreaChapter
              n={2}
              areaAnalysis={buildAreaAnalysis(p, attributes, p.dataSources)}
              dataSources={p.dataSources}
              footnote={
                <div className="relative mt-10 border-t border-black/10 pt-5 text-[11px] text-[#8C8471]">
                  Områdesanalys · genererad {generatedDate} · motor {p.engineVersion} · {p.dataCompleteness.connectedSources} av{" "}
                  {p.dataCompleteness.totalSources} områdeskällor anslutna.
                </div>
              }
            />
          </>
        ) : (
          <FullReportBody p={p} attributes={attributes} property={property} analysis={analysis} generatedDate={generatedDate} brf={brf!} />
        )}
      </main>

      <div className="no-print mx-auto mt-6 flex w-full max-w-[880px] flex-wrap items-center justify-between gap-4 rounded-sm border border-[#12271D]/15 bg-[#FBF9F4] px-8 py-6 shadow-[0_0_0_1px_rgba(0,0,0,0.06)] sm:px-16">
        <div>
          <p className="text-sm font-semibold text-[#12271D]">Klar med analysen?</p>
          <p className="mt-1 max-w-md text-xs leading-relaxed text-[#5B5648]">
            Ladda ner hela rapporten som PDF för att spara eller dela den.
          </p>
        </div>
        <a
          href={`/api/analyses/${id}/pdf`}
          className="shrink-0 rounded-sm bg-[#12271D] px-5 py-2.5 text-sm font-semibold text-[#F5F1E4] transition hover:bg-[#1B3A2C]"
        >
          Ladda ner PDF
        </a>
      </div>

      {hasInspectionAccess && (
        <div className="no-print mx-auto mt-6 flex w-full max-w-[880px] flex-wrap items-center justify-between gap-4 rounded-sm border border-[#12271D]/15 bg-[#0E2B1F] px-8 py-6 sm:px-16">
          <div>
            <p className="text-sm font-semibold text-[#F5F1E4]">Nästa steg: Visningsguiden (ingår i Trygghetspaketet)</p>
            <p className="mt-1 max-w-md text-xs leading-relaxed text-[#C9D6CC]">
              Fortsätt till vår visningsguide — den läser automatiskt in den här analysen och guidar dig
              genom förberedelser, genomgång och en slutlig sammanfattning.
            </p>
          </div>
          <Link
            href={`/dashboard/inspection?propertyId=${property.id}`}
            className="shrink-0 rounded-sm bg-[#4ADE80] px-5 py-2.5 text-sm font-semibold text-[#0E2B1F] transition hover:bg-[#6EE7A0]"
          >
            Fortsätt till visningsguiden
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
