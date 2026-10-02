import type { AnalysisReport } from "@/lib/analysis/types";
import type { BrfFigures } from "../brf/figures";
import { interpretBrf, type BrfReading } from "../brf/interpret";
import { tenureOf } from "./tenure";
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

export function brfChapterState(report: AnalysisReport, review: BrfReviewView | null, now: Date = new Date()): BrfChapterState {
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

const DATE_SV = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Stockholm", weekday: "long", day: "numeric", month: "long" });
const TIME_SV = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Stockholm", hour: "2-digit", minute: "2-digit" });
const DAY_SV = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Stockholm", day: "numeric", month: "long", year: "numeric" });

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
export function brfIntroParagraphs(report: AnalysisReport): string[] {
  const paragraphs: string[] = [];
  const name = report.property.housingAssociation;
  paragraphs.push(
    name ? `Bostaden tillhör ${name}.` : "Föreningens namn framgår inte av annonsen; det kontrolleras i granskningen av årsredovisningen."
  );
  const conflict = report.property.housingAssociationConflict;
  if (conflict) {
    paragraphs.push(
      `Observera: datakällorna är oense om föreningens namn. Vi har använt "${conflict.keptValue}", ` +
        `medan en annan källa (${conflict.rejectedSource}) angav "${conflict.rejectedValue}" — kontrollera namnet mot föreningens stadgar.`
    );
  }
  return paragraphs;
}

/** One sentence for the executive summary and the risk chapter. */
export function brfStatusSentence(state: BrfChapterState): string | null {
  switch (state.kind) {
    case "freehold":
      return null;
    case "not_applicable":
      return "Bostaden ingår inte i någon bostadsrättsförening, så det finns ingen föreningsekonomi att granska.";
    case "awaiting": {
      const due = dueSv(state.dueAt);
      if (state.overdue) {
        return "BRF-analysen granskas av Köpanalys experter. Granskningen tar lite längre tid än utlovat — analysen publiceras i kapitlet Bostadsrättsförening så snart den är klar.";
      }
      return (
        "BRF-analysen granskas av Köpanalys experter innan den visas" +
        (due ? ` och publiceras i kapitlet Bostadsrättsförening senast ${due}.` : ", och publiceras i kapitlet Bostadsrättsförening inom 24 timmar.")
      );
    }
    case "published": {
      const { strengths, concerns } = state.reading;
      const day = daySv(state.publishedAt);
      const counts =
        concerns.length === 0
          ? strengths.length > 0
            ? "Inget av nyckeltalen ligger utanför de nivåer som brukar räknas som normala."
            : "Årsredovisningen innehåller få av de nyckeltal som går att jämföra."
          : `${concerns.length} ${concerns.length === 1 ? "punkt är värd" : "punkter är värda"} en närmare titt, bland annat ${concerns
              .slice(0, 2)
              .map((c) => c.charAt(0).toLowerCase() + c.slice(1))
              .join(" och ")}.`;
      return `BRF-analysen är granskad av Köpanalys${day ? ` (${day})` : ""}. ${counts}`;
    }
  }
}
