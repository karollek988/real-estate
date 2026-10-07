import { Link } from "@/i18n/navigation";
import Image from "next/image";
import { redirect } from "@/i18n/navigation";
import { after } from "next/server";
import localFont from "next/font/local";
import { getTranslations } from "next-intl/server";
import { useTranslations } from "next-intl";
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
  sourcesUsed,
  type AreaAnalysisContent,
  type CivicStatsInfo,
  type CommuteInfo,
  type OverviewRow,
} from "@/lib/report/build";
import { brfChapterState, brfIntroParagraphs, type BrfChapterState, type BrfReviewView } from "@/lib/report/brfChapter";
import { buildQuestions } from "@/lib/report/questions";
import { tenureOf } from "@/lib/report/tenure";
import { createFormat } from "@/lib/report/format";
import { serverTextKit } from "@/i18n/serverTextKit";
import { useTextKit } from "@/i18n/useTextKit";
import { pageLocale, type LocaleParams } from "@/i18n/page";
import { LOCALES, type AppLocale } from "@/i18n/locales";
import type { TextKit } from "@/i18n/textKit";
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

function civicRows(civic: CivicStatsInfo, kit: TextKit): IconFactRow[] {
  const fx = createFormat(kit);
  const rows: IconFactRow[] = [];
  if (civic.safetyIndex !== null) {
    rows.push({ icon: <BadgeCheckIcon className="h-4 w-4" />, label: kit.t("report.area.civic.safetyIndex"), value: fx.dec(civic.safetyIndex) });
  }
  if (civic.recentPoliceEvents !== null) {
    rows.push({ icon: <WarningIcon className="h-4 w-4" />, label: kit.t("report.area.civic.policeEvents"), value: String(civic.recentPoliceEvents) });
  }
  if (civic.voterTurnoutPct !== null) {
    rows.push({ icon: <PercentIcon className="h-4 w-4" />, label: kit.t("report.area.civic.voterTurnout"), value: fx.ratePct(civic.voterTurnoutPct) });
  }
  return rows;
}

function commuteRows(commute: CommuteInfo, kit: TextKit): IconFactRow[] {
  const t = kit.t;
  const rows: IconFactRow[] = [];
  const min = (n: number | null) => (n !== null ? (t("report.format.minutes", { value: n }) as string) : null);
  const carIcon = <CarIcon className="h-4 w-4" />;
  const busIcon = <BusIcon className="h-4 w-4" />;
  const walkIcon = <WalkIcon className="h-4 w-4" />;

  if (commute.centrumName) {
    const car = min(commute.centrumCarMinutes);
    const transit = min(commute.centrumTransitMinutes);
    const walk = min(commute.centrumWalkMinutes);
    if (car) rows.push({ icon: carIcon, label: t("report.area.commute.carTo", { place: commute.centrumName }), value: car });
    if (transit) rows.push({ icon: busIcon, label: t("report.area.commute.transitTo", { place: commute.centrumName }), value: transit });
    if (walk) rows.push({ icon: walkIcon, label: t("report.area.commute.walkTo", { place: commute.centrumName }), value: walk });
  }
  if (commute.cityName) {
    const car = min(commute.cityCarMinutes);
    const transit = min(commute.cityTransitMinutes);
    if (transit) rows.push({ icon: busIcon, label: t("report.area.commute.transitTo", { place: commute.cityName }), value: transit });
    if (car) rows.push({ icon: carIcon, label: t("report.area.commute.carTo", { place: commute.cityName }), value: car });
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

const AMENITY_ICONS: Record<string, React.ReactNode> = {
  grocery: <ShoppingBagIcon key="grocery" className="h-4 w-4" />,
  school: <GraduationCapIcon key="school" className="h-4 w-4" />,
  restaurant: <UtensilsIcon key="restaurant" className="h-4 w-4" />,
  park: <TreeIcon key="park" className="h-4 w-4" />,
  transit: <BusIcon key="transit" className="h-4 w-4" />,
  hospital: <MedicalCrossIcon key="hospital" className="h-4 w-4" />,
};

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

/** The property facts, grouped. A group's name: report.overview.groups.<id>; a row's: its id in build.ts's buildPropertyOverview. */
const FACT_GROUPS: { id: "address" | "price" | "condition" | "amenities" | "sale"; icon: React.ReactNode; rows: string[] }[] = [
  {
    id: "address",
    icon: <HouseIcon className="h-5 w-5" />,
    rows: ["address", "municipality", "postalCode", "propertyType", "housingAssociation", "apartmentNumber", "floor", "rooms", "livingArea", "additionalArea", "lotArea"],
  },
  {
    id: "price",
    icon: <WalletIcon className="h-5 w-5" />,
    rows: ["askingPrice", "pricePerM2", "monthlyFee", "operatingCosts", "previousSale"],
  },
  {
    id: "condition",
    icon: <BuildingIcon className="h-5 w-5" />,
    rows: ["buildingYear", "renovationYear", "energyClass", "condition", "newConstruction", "mortgageDeed"],
  },
  {
    id: "amenities",
    icon: <BadgeCheckIcon className="h-5 w-5" />,
    rows: ["balcony", "patio", "elevator", "parking", "garage", "storage", "solarPanels", "fireplace", "features"],
  },
  {
    id: "sale",
    icon: <ClipboardIcon className="h-5 w-5" />,
    rows: ["ownershipType", "biddingOpen", "listingDate", "objectId", "floorplan"],
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
  const kit = useTextKit();
  const names = Array.from(new Set([...sourcesUsed(dataSources, ids, kit), ...extra]));
  if (names.length === 0) return null;
  return (
    <div className="relative mt-10 border-t border-black/10 pt-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#8C8471]">{kit.t("report.sources.heading")}</p>
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
  const kit = useTextKit();
  const fx = createFormat(kit);
  const t = kit.t;
  const facts = [
    p.property.propertyType,
    p.property.rooms !== null && p.property.rooms !== undefined && !p.property.propertyType?.includes("rum")
      ? t("report.format.rooms", { count: p.property.rooms })
      : null,
    p.property.livingAreaM2 ? t("report.format.areaM2", { value: p.property.livingAreaM2 }) : null,
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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.property.imageUrls[0]} alt={p.property.address ?? t("report.cover.imageAlt")} className="h-full w-full object-cover" />
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
            <p className="text-[24px] font-semibold">{fx.sek(p.property.askingPriceSek)}</p>
            {p.property.pricePerM2Sek && <p className="text-[14px] text-[#C9D6CC]">{fx.sekPerM2(p.property.pricePerM2Sek)}</p>}
          </div>
        )}

        {lead && <p className="mt-8 max-w-xl text-[13.5px] leading-relaxed text-[#C9D6CC]">{lead}</p>}
      </div>

      <div className="relative flex items-center justify-between border-t border-white/15 px-8 py-5 text-[10px] uppercase tracking-wide text-[#8AA396] sm:px-16">
        <span>{t("report.cover.footer")}</span>
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
  const kit = useTextKit();
  const t = kit.t;
  const na = createFormat(kit).na;
  return (
    <Page n={n}>
      <ChapterTitle icon={<MapPinIcon className="h-5 w-5" />} sub={t("report.chapters.area.sub")} accent={AREA_ACCENT}>
        {t("report.chapters.area.title")}
      </ChapterTitle>
      <Prose paragraphs={areaAnalysis.paragraphs.slice(0, 3)} />

      {areaAnalysis.amenities.some((a) => a.value !== na) && (
        <>
          <SubHeading icon={<ShoppingBagIcon className="h-4 w-4" />} accent={AREA_ACCENT}>{t("report.area.serviceHeading")}</SubHeading>
          <div className="relative">
            <AmenityGrid
              items={areaAnalysis.amenities.map((a) => ({
                icon: AMENITY_ICONS[a.id],
                label: a.short,
                value: a.value,
              }))}
            />
          </div>
        </>
      )}

      {areaAnalysis.commute && (
        <>
          <SubHeading icon={<CarIcon className="h-4 w-4" />} accent={AREA_ACCENT}>{t("report.area.commuteHeading")}</SubHeading>
          <div className="relative">
            <IconFactGrid rows={commuteRows(areaAnalysis.commute, kit)} />
          </div>
        </>
      )}

      {areaAnalysis.civicStats && (
        <>
          <SubHeading icon={<BadgeCheckIcon className="h-4 w-4" />} accent={AREA_ACCENT}>{t("report.area.civicHeading")}</SubHeading>
          <div className="relative">
            <IconFactGrid rows={civicRows(areaAnalysis.civicStats, kit)} />
          </div>
          <p className="relative text-[11.5px] text-[#8C8471]">{t("report.area.civic.note")}</p>
        </>
      )}

      {areaAnalysis.schools && (
        <>
          <SubHeading icon={<GraduationCapIcon className="h-4 w-4" />} accent={AREA_ACCENT}>{t("report.area.schoolsHeading")}</SubHeading>
          {areaAnalysis.paragraphs[4] && (
            <p className="relative text-[11.5px] text-[#8C8471]">{areaAnalysis.paragraphs[4]}</p>
          )}
          <div className="relative space-y-5">
            {areaAnalysis.schools.preschools.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#8C8471]">{t("report.area.preschools")}</p>
                <SchoolList rows={areaAnalysis.schools.preschools} />
              </div>
            )}
            {areaAnalysis.schools.primarySchools.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#8C8471]">{t("report.area.primarySchools")}</p>
                <SchoolList rows={areaAnalysis.schools.primarySchools} />
              </div>
            )}
            {areaAnalysis.schools.highSchools.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#8C8471]">{t("report.area.highSchools")}</p>
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

/** What the cost chapter will show once it launches. Their words: report.housingCostPreview.<id> */
const HOUSING_COST_PREVIEW = ["monthly", "oneOff", "easyToMiss"] as const;

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
  const kit = useTextKit();
  const t = kit.t;
  const fx = createFormat(kit);
  const tPage = useTranslations("report.page");

  // Every chapter below is built from the viewer's own report (p). There are
  // no locked chapters: whoever holds the full analysis sees all of it. (An
  // area-only viewer never reaches this component — see ReportPage.)
  const overviewRows = buildPropertyOverview(p, attributes, kit);
  const executiveSummary = buildExecutiveSummary(p, brf, kit);
  const areaAnalysis = buildAreaAnalysis(p, attributes, p.dataSources, kit);
  const riskCategories = buildRiskCategories(p, p.dataSources, brf, kit);
  const investmentOutlook = buildInvestmentOutlook(p, kit);
  const questions = buildQuestions(p, brf, kit);

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
      label: t("report.outlook.macro.policyRate"),
      value: t("report.outlook.macro.policyRateValue", { value: `${rateChangePctPoints > 0 ? "+" : ""}${fx.dec(rateChangePctPoints, 2)}` }),
      sub: currentPolicyRatePct !== null ? t("report.outlook.macro.policyRateNow", { rate: fx.ratePct(currentPolicyRatePct) }) : undefined,
    });
  }
  if (employmentRatePct !== null) {
    macroCards.push({
      icon: <BadgeCheckIcon className="h-3.5 w-3.5" />,
      label: t("report.outlook.macro.employment"),
      value: t("report.format.percent", { value: fx.dec(employmentRatePct) }),
    });
  }
  if (plannedProjectsCount !== null) {
    macroCards.push({ icon: <CraneIcon className="h-3.5 w-3.5" />, label: t("report.outlook.macro.projects"), value: String(plannedProjectsCount) });
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
        kind={t("report.cover.kindFull")}
        lead={brf.kind === "freehold" ? t("report.cover.leadFreehold") : t("report.cover.leadAssociation")}
      />

      {/* ══════════════════════════════════════════════════════════
          EXECUTIVE SUMMARY
         ══════════════════════════════════════════════════════════ */}
      <Page n={nextPage()}>
        <ChapterTitle icon={<ClipboardIcon className="h-5 w-5" />} sub={t("report.chapters.summary.sub")}>
          {t("report.chapters.summary.title")}
        </ChapterTitle>
        <div className="relative mb-8 max-w-[220px]">
          <MetricCard icon={<DatabaseIcon className="h-3.5 w-3.5" />} label={t("report.summary.connectedSources")} value={`${p.dataCompleteness.connectedSources}/${p.dataCompleteness.totalSources}`} />
        </div>
        <Prose paragraphs={executiveSummary} />
        <ChapterSources dataSources={p.dataSources} />
      </Page>

      {/* ══════════════════════════════════════════════════════════
          PROPERTY OVERVIEW
         ══════════════════════════════════════════════════════════ */}
      <Page n={nextPage()}>
        <ChapterTitle icon={<BuildingIcon className="h-5 w-5" />} sub={t("report.chapters.property.sub")}>
          {t("report.chapters.property.title")}
        </ChapterTitle>

        {FACT_GROUPS.map((group) => {
          const rows = group.rows
            .map((id) => overviewRows.find((r: OverviewRow) => r.id === id))
            .filter((r): r is OverviewRow => !!r);
          return <FactGroup key={group.id} title={t(`report.overview.groups.${group.id}`)} icon={group.icon} rows={rows} />;
        })}

        {((p.property.imageUrls ?? []).length > 0 || (p.property.floorplanUrls ?? []).length > 0) && (
          <div className="relative mt-8 flex items-center gap-3 rounded-md border border-black/[0.08] bg-black/[0.02] px-4 py-3.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#12271D]/[0.06] text-[#12271D]">
              <HouseIcon className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[13.5px] font-semibold text-[#12271D]">{t("report.overview.imagesTitle")}</p>
              <p className="text-[12px] text-[#8C8471]">{t("report.overview.imagesText")}</p>
            </div>
          </div>
        )}

        {p.property.description && (
          <>
            <SubHeading icon={<ClipboardIcon className="h-4 w-4" />}>{t("report.overview.description")}</SubHeading>
            {/* the listing's own text: it is in the language the listing was written in */}
            <p lang="sv" className="relative text-[14px] leading-relaxed text-[#3A362C]">{p.property.description}</p>
          </>
        )}

        {(p.property.imageUrls ?? []).length > 1 && (
          <>
            <SubHeading icon={<HouseIcon className="h-4 w-4" />}>{t("report.overview.images")}</SubHeading>
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
            <SubHeading icon={<BuildingIcon className="h-4 w-4" />}>{t("report.overview.floorplan")}</SubHeading>
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
        <ChapterTitle icon={<WalletIcon className="h-5 w-5" />} sub={t("report.chapters.housingCost.sub")}>
          {t("report.chapters.housingCost.title")}
        </ChapterTitle>
        <div className="relative rounded-lg border border-dashed border-[#B98A2E]/45 bg-[#B98A2E]/[0.05] p-6 sm:p-7">
          <span className="inline-flex rounded-full bg-[#B98A2E]/15 px-3 py-1 text-[12px] font-semibold text-[#7A5A16]">{t("report.housingCostPreview.badge")}</span>
          <p style={serifStyle} className="mt-4 text-[20px] font-semibold leading-snug text-[#12271D]">
            {t("report.housingCostPreview.title")}
          </p>
          <p className="mt-2 text-[14.5px] leading-relaxed text-[#2A2820]">{t("report.housingCostPreview.lead")}</p>
          <ul className="mt-3 space-y-2">
            {HOUSING_COST_PREVIEW.map((item) => (
              <li key={item} className={CHECKLIST_ITEM}>
                <CheckIcon className="mt-1 h-3.5 w-3.5 shrink-0 text-[#B98A2E]" />
                <span>{t(`report.housingCostPreview.${item}`)}</span>
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
          <ChapterTitle icon={<BuildingIcon className="h-5 w-5" />} sub={t("report.chapters.association.sub")} accent={BRF_ACCENT}>
            {t("report.chapters.association.title")}
          </ChapterTitle>
          <div className="mb-6">
            <Prose paragraphs={brfIntroParagraphs(p, kit)} />
          </div>
          <BrfAnalysis
            state={brf}
            associationName={p.property.housingAssociation}
            upload={
              brf.kind === "not_applicable" ? undefined : (
                <BrfReportUpload
                  propertyId={property.id}
                  label={brf.kind === "published" ? tPage("association.uploadNewer") : tPage("association.upload")}
                  description={brf.kind === "published" ? tPage("association.uploadNewerText") : tPage("association.uploadText")}
                />
              )
            }
          />
          {brf.kind === "published" && <ChapterSources dataSources={[]} extra={[t("report.sources.reviewedAnnualReport")]} />}
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
        <ChapterTitle icon={<WarningIcon className="h-5 w-5" />} sub={t("report.chapters.risks.sub")} accent={RISK_ACCENT}>
          {t("report.chapters.risks.title")}
        </ChapterTitle>
        <div className="relative">
          {riskCategories.map((risk) => (
            <RiskCategoryCard key={risk.id} risk={risk} icon={RISK_ICON[risk.id] ?? <WarningIcon className="h-4 w-4" />} />
          ))}
        </div>
        <ChapterSources
          dataSources={p.dataSources}
          ids={["hemnet_page_scrape", "interest_rates", "scb_area_statistics", "osm_amenities", "location_intelligence", "infrastructure_projects"]}
          extra={brf.kind === "published" ? [t("report.sources.reviewedAnnualReport")] : []}
        />
      </Page>

      {/* ══════════════════════════════════════════════════════════
          FUTURE OUTLOOK
         ══════════════════════════════════════════════════════════ */}
      <Page n={nextPage()}>
        <ChapterTitle icon={<TrendingUpIcon className="h-5 w-5" />} sub={t("report.chapters.outlook.sub")}>
          {t("report.chapters.outlook.title")}
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
            <SubHeading icon={<CraneIcon className="h-4 w-4" />}>{t("report.outlook.projectsHeading")}</SubHeading>
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
      <Page n={nextPage()} source={t("report.chapters.questions.source")} className="pb-16">
        <ChapterTitle
          icon={<QuestionIcon className="h-5 w-5" />}
          sub={questions.association.length > 0 ? t("report.chapters.questions.subAssociation") : t("report.chapters.questions.subBroker")}
        >
          {t("report.chapters.questions.title")}
        </ChapterTitle>

        <SubHeading icon={<QuestionIcon className="h-4 w-4" />}>{t("report.questions.broker")}</SubHeading>
        <QuestionList items={questions.broker} />

        {questions.association.length > 0 && (
          <>
            <SubHeading icon={<BuildingIcon className="h-4 w-4" />} accent={BRF_ACCENT}>{t("report.questions.association")}</SubHeading>
            <QuestionList items={questions.association} color={BRF_ACCENT} />
            {questions.associationNote && <p className="relative mt-3 text-[12.5px] italic text-[#8C8471]">{questions.associationNote}</p>}
          </>
        )}

        <SubHeading icon={<InfoIcon className="h-4 w-4" />}>{t("report.questions.notCovered")}</SubHeading>
        <QuestionList items={questions.notCovered} color="#8C8471" />

        <div className="relative mt-10 border-t border-black/10 pt-5 text-[11px] text-[#8C8471]">
          {tPage("footerFull", {
            version: analysis.version,
            date: generatedDate,
            engine: p.engineVersion,
            connected: p.dataCompleteness.connectedSources,
            total: p.dataCompleteness.totalSources,
          })}
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
async function loadBrfState(report: AnalysisReport, propertyId: string, kit: TextKit): Promise<BrfChapterState> {
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
    return brfChapterState(report, review ? reviewView(review) : null, kit);
  } catch (err) {
    console.error(`report: could not load the BRF review for property ${propertyId}:`, err);
    return brfChapterState(report, null, kit);
  }
}

/* ══════════════════════════════════════════════════════════════════════ */
/*                          MAIN REPORT PAGE                              */
/* ══════════════════════════════════════════════════════════════════════ */

export default async function ReportPage({
  params,
  searchParams,
}: LocaleParams & {
  searchParams: Promise<{ id?: string }>;
}) {
  const locale: AppLocale = await pageLocale(params);
  const { id } = await searchParams;
  if (!id) redirect({ href: "/", locale });

  const kit = await serverTextKit(locale);
  const fx = createFormat(kit);
  const tPage = await getTranslations("report.page");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const found = await getReportForViewer(id!, user?.id ?? null, { isReviewer: isAdminUser(user) });
  if (!found) redirect({ href: "/", locale });

  const { analysis, property, access } = found!;
  const isAreaOnly = access.viewScope === "area";

  // Visningsguiden is part of the Trygghetspaketet — it builds on the whole
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
            {isInsufficientData ? tPage("failed.titleInsufficient") : tPage("failed.title")}
          </h1>
          {isInsufficientData ? (
            <div className="mt-4 flex flex-col gap-3.5">
              <p className="text-sm leading-relaxed text-[#5B5648]">{tPage("failed.insufficient1", { address: property.address })}</p>
              <p className="text-sm leading-relaxed text-[#5B5648]">
                {tPage.rich("failed.insufficient2", { b: (chunks) => <span className="font-medium text-[#12271D]">{chunks}</span> })}
              </p>
              <p className="text-sm leading-relaxed text-[#5B5648]">{tPage("failed.insufficient3")}</p>
            </div>
          ) : (
            <p className="mt-4 text-sm leading-relaxed text-[#5B5648]">
              {tPage("failed.other", { address: property.address, email: "kontakt@kopanalys.se" })}
            </p>
          )}
          <Link
            href="/"
            className="mt-8 inline-flex w-fit items-center justify-center rounded-full bg-[#12271D] px-8 py-3 text-sm font-semibold text-white transition hover:bg-[#0D1D15]"
          >
            {tPage("failed.home")}
          </Link>
          {isInsufficientData && (
            <Link
              href="/dashboard"
              className="mt-3.5 text-sm font-medium text-[#5B5648] underline-offset-4 transition hover:text-[#12271D] hover:underline"
            >
              {tPage("failed.account")}
            </Link>
          )}
        </main>
      </div>
    );
  }

  const p: AnalysisReport = analysis.report;
  const attributes = property.attributes;
  const brf = isAreaOnly ? null : await loadBrfState(p, property.id, kit);
  const ageDays = analysisAgeDays(analysis);
  const isStale = ageDays >= FRESH_ANALYSIS_MAX_AGE_DAYS;
  const generatedDate = new Date(analysis.createdAt).toLocaleDateString(LOCALES[locale].formatLocale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  // The PDF is this same page printed: it is asked for in the page's language
  const pdfHref = `/api/analyses/${id}/pdf?locale=${locale}`;

  return (
    <div lang={LOCALES[locale].htmlLang} className={`${serif.variable} min-h-screen bg-[#F7F4EC]`}>
      {/* ── Screen-only top bar (hidden in print) ── */}
      <div className="no-print mx-auto flex w-full max-w-[880px] items-center justify-between px-8 py-5 sm:px-16">
        <Link href={ROUTES.skapaAnalys} className="text-sm font-medium text-[#5B5648] transition hover:text-[#12271D]">
          {tPage("newAnalysis")}
        </Link>
        <a
          href={pdfHref}
          className="rounded-sm border border-[#12271D]/20 px-4 py-1.5 text-xs font-semibold text-[#12271D] transition hover:bg-[#12271D]/5"
        >
          {tPage("downloadPdf")}
        </a>
      </div>

      {isStale && (
        <div className="no-print mx-auto mb-2 flex w-full max-w-[880px] flex-wrap items-center justify-between gap-4 border border-[#B98A2E]/30 bg-[#B98A2E]/[0.06] px-8 py-4 text-sm sm:px-16">
          <div>
            <p className="font-semibold text-[#8A6220]">{tPage("stale.title", { days: ageDays })}</p>
            <p className="mt-0.5 text-xs text-[#5B5648]">{tPage("stale.text", { date: generatedDate })}</p>
          </div>
          <UpdateAnalysisButton propertyId={property.id} />
        </div>
      )}

      <main className="mx-auto w-full max-w-[880px] border-t-[3px] border-[#B98A2E] bg-[#FBF9F4] shadow-[0_0_0_1px_rgba(0,0,0,0.06)]">
        {isAreaOnly ? (
          <>
            <ReportCover p={p} generatedDate={generatedDate} kind={kit.t("report.cover.kindArea")} />
            <AreaChapter
              n={2}
              areaAnalysis={buildAreaAnalysis(p, attributes, p.dataSources, kit)}
              dataSources={p.dataSources}
              footnote={
                <div className="relative mt-10 border-t border-black/10 pt-5 text-[11px] text-[#8C8471]">
                  {tPage("footerArea", {
                    date: generatedDate,
                    engine: p.engineVersion,
                    connected: p.dataCompleteness.connectedSources,
                    total: p.dataCompleteness.totalSources,
                  })}
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
          <p className="text-sm font-semibold text-[#12271D]">{tPage("done.title")}</p>
          <p className="mt-1 max-w-md text-xs leading-relaxed text-[#5B5648]">{tPage("done.text")}</p>
        </div>
        <a
          href={pdfHref}
          className="shrink-0 rounded-sm bg-[#12271D] px-5 py-2.5 text-sm font-semibold text-[#F5F1E4] transition hover:bg-[#1B3A2C]"
        >
          {tPage("downloadPdf")}
        </a>
      </div>

      {hasInspectionAccess && (
        <div className="no-print mx-auto mt-6 flex w-full max-w-[880px] flex-wrap items-center justify-between gap-4 rounded-sm border border-[#12271D]/15 bg-[#0E2B1F] px-8 py-6 sm:px-16">
          <div>
            <p className="text-sm font-semibold text-[#F5F1E4]">{tPage("inspection.title")}</p>
            <p className="mt-1 max-w-md text-xs leading-relaxed text-[#C9D6CC]">{tPage("inspection.text")}</p>
          </div>
          <Link
            href={{ pathname: "/dashboard/inspection", query: { propertyId: property.id } }}
            className="shrink-0 rounded-sm bg-[#4ADE80] px-5 py-2.5 text-sm font-semibold text-[#0E2B1F] transition hover:bg-[#6EE7A0]"
          >
            {tPage("inspection.action")}
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
