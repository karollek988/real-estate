import type { AnalysisReport } from "@/lib/analysis/types";
import type { BrfFigures } from "../brf/figures";
import { interpretBrf, type BrfReading } from "../brf/interpret";
import { tenureOf } from "./tenure";
import type { TextKit } from "../../i18n/textKit";
// Runtime imports are relative (build.verify.mjs runs this through tsx, which
// does not resolve the "@/" alias); type-only "@/..." imports are erased.

/**
 * What the report's BRF chapter shows. The BRF analysis is the one part of
 * the report a person reviews before the customer sees it (lib/brf/reviews.ts):
 * until a Köpanalys reviewer has published it, the chapter says when it will
 * be ready instead of showing automatically extracted numbers.
 */

/** The part of a stored review the report needs — plain data, so the chapter can be built anywhere. */
export interface BrfReviewView {
  status: "pending" | "published" | "not_applicable";
  /** What the reviewer published (null until the first publication). */
  figures: BrfFigures | null;
  publishedAt: string | null;
  /** The promised time of the review round in progress (null when none is in progress). */
  dueAt: string | null;
  /** An annual report is attached to the round in progress (uploaded by the customer or the reviewer). */
  documentReceived: boolean;
}

export type BrfChapterState =
  /** A freehold house: there is no association, so the chapter is left out. */
  | { kind: "freehold" }
  /** The reviewer found the home has no association. */
  | { kind: "not_applicable" }
  /** Not published yet. */
  | { kind: "awaiting"; dueAt: string | null; overdue: boolean; documentReceived: boolean }
  /** Published; `update` is set while a newer annual report is being reviewed. */
  | {
      kind: "published";
      reading: BrfReading;
      publishedAt: string | null;
      update: { dueAt: string | null; overdue: boolean } | null;
    };

export function brfChapterState(report: AnalysisReport, review: BrfReviewView | null, kit: TextKit, now: Date = new Date()): BrfChapterState {
  if (tenureOf(report.property) === "freehold" && review?.status !== "published") return { kind: "freehold" };
  if (review?.status === "not_applicable") return { kind: "not_applicable" };

  const overdue = (dueAt: string | null) => dueAt !== null && new Date(dueAt).getTime() < now.getTime();

  if (review?.figures) {
    const reading = interpretBrf(
      review.figures,
      {
        livingAreaM2: report.property.livingAreaM2,
        monthlyFeeSek: report.property.monthlyFeeSek,
        buildingYear: report.property.buildingYear,
      },
      kit,
      now
    );
    return {
      kind: "published",
      reading,
      publishedAt: review.publishedAt,
      update: review.status === "pending" ? { dueAt: review.dueAt, overdue: overdue(review.dueAt) } : null,
    };
  }

  return {
    kind: "awaiting",
    dueAt: review?.dueAt ?? null,
    overdue: overdue(review?.dueAt ?? null),
    documentReceived: review?.documentReceived ?? false,
  };
}

/** Swedish time of day: the report promises times in Swedish time whatever the reader's language. */
const TIME_ZONE = "Europe/Stockholm";

/** "fredag 3 oktober kl. 14:30" (Swedish time, in the reader's language) — when the review is promised. */
export function formatDue(iso: string | null, kit: TextKit): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const date = new Intl.DateTimeFormat(kit.formatLocale, { timeZone: TIME_ZONE, weekday: "long", day: "numeric", month: "long" }).format(d);
  const time = new Intl.DateTimeFormat(kit.formatLocale, { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" }).format(d);
  return kit.t("brf.dueTime", { date, time });
}

/** "3 oktober 2026" (Swedish time, in the reader's language) — when the review was published. */
export function formatDay(iso: string | null, kit: TextKit): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? null
    : new Intl.DateTimeFormat(kit.formatLocale, { timeZone: TIME_ZONE, day: "numeric", month: "long", year: "numeric" }).format(d);
}

/** The same two in Swedish, for Swedish-only code (the review console, the team's e-mails). */
const DATE_SV = new Intl.DateTimeFormat("sv-SE", { timeZone: TIME_ZONE, weekday: "long", day: "numeric", month: "long" });
const TIME_SV = new Intl.DateTimeFormat("sv-SE", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" });
const DAY_SV = new Intl.DateTimeFormat("sv-SE", { timeZone: TIME_ZONE, day: "numeric", month: "long", year: "numeric" });

/** "fredag 3 oktober kl. 14:30" (Swedish time) — when the review is promised. */
export function dueSv(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${DATE_SV.format(d)} kl. ${TIME_SV.format(d)}`;
}

/** "3 oktober 2026" (Swedish time) — when the review was published. */
export function daySv(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : DAY_SV.format(d);
}

/** The chapter's opening lines: which association, and a disagreement between sources about its name. */
export function brfIntroParagraphs(report: AnalysisReport, kit: TextKit): string[] {
  const t = kit.t;
  const paragraphs: string[] = [];
  const name = report.property.housingAssociation;
  paragraphs.push(name ? t("brf.intro.named", { name }) : t("brf.intro.unnamed"));
  const conflict = report.property.housingAssociationConflict;
  if (conflict) {
    paragraphs.push(
      t("brf.intro.conflict", { kept: conflict.keptValue, source: conflict.rejectedSource, rejected: conflict.rejectedValue })
    );
  }
  return paragraphs;
}

/** One sentence for the executive summary and the risk chapter. */
export function brfStatusSentence(state: BrfChapterState, kit: TextKit): string | null {
  const t = kit.t;
  switch (state.kind) {
    case "freehold":
      return null;
    case "not_applicable":
      return t("brf.status.notApplicable");
    case "awaiting": {
      const due = formatDue(state.dueAt, kit);
      if (state.overdue) return t("brf.status.overdue");
      return due ? t("brf.status.dueBy", { due }) : t("brf.status.within24");
    }
    case "published": {
      const { strengths, concerns } = state.reading;
      const day = formatDay(state.publishedAt, kit);
      const counts =
        concerns.length === 0
          ? strengths.length > 0
            ? t("brf.status.countsNone")
            : t("brf.status.countsFew")
          : t("brf.status.countsSome", {
              count: concerns.length,
              list: new Intl.ListFormat(kit.formatLocale, { style: "long", type: "conjunction" }).format(
                concerns.slice(0, 2).map((c) => c.charAt(0).toLowerCase() + c.slice(1))
              ),
            });
      return t("brf.status.published", { day: day ? t("brf.status.publishedDay", { day }) : "", counts });
    }
  }
}
