import { createHash } from "node:crypto";
import type { DataProvider, ProviderResult } from "./types";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  BROKER_DOCUMENTS_BUCKET,
  findExistingBrokerDocument,
  insertBrokerDocument,
  type BrokerDocumentType,
} from "@/lib/analysis/brokerDocuments";
import { findReusableBrfReport, insertBrfReport } from "@/lib/analysis/brfReports";

/**
 * Bridges the broker-site document discovery engine
 * (BRF-Scraper/src/brf_scraper/broker_discovery/) into the live analysis
 * pipeline, via POST /api/broker-documents on the same FastAPI service
 * brfAcquisition.ts calls. Distinct discovery path from brfAcquisitionProvider
 * (which only looks at allabrf.se): this one follows the Hemnet listing's
 * "Läs mer hos mäklaren" link and scans the broker's own site for annual
 * reports, bylaws, energy declarations, and inspection protocols.
 *
 * Runs immediately after brfAcquisitionProvider so it can check whether that
 * provider already found an annual report (attributes.brf_annual_report) —
 * if so, this provider skips re-processing that one document type but still
 * processes every other type brfAcquisitionProvider's Allabrf-based path
 * never looks for. Runs before brfFinancialsProvider so any annual report
 * this provider does set is picked up in the same pipeline run, identical
 * to brfAcquisitionProvider's existing contract.
 *
 * Deliberately performs real Storage/DB side effects inside collect() —
 * unlike every other provider, which only returns in-memory data for
 * pipeline.ts to merge — because the whole point of this provider is to
 * persist discovered documents for later display, and doing so once per
 * analysis run (via the same after()-backed background execution every
 * provider already runs inside) is simpler than a second follow-up job.
 * Revisit this if the pipeline is ever parallelized — idempotency here
 * relies on strictly sequential execution plus the (property_id,
 * content_hash) unique constraint on broker_documents.
 */

interface BrokerDocumentResponseEntry {
  doc_type: BrokerDocumentType;
  filename: string;
  source_url: string;
  content_hash: string;
  size_bytes: number;
  mime_type: string;
  content_base64: string | null;
  annual_report: Record<string, unknown> | null;
  inspection_findings: {
    findings: unknown[];
    summary: string;
    overall_condition: string;
    extraction_confidence: number;
    [key: string]: unknown;
  } | null;
}

interface BrokerDocumentsResponse {
  success: boolean;
  broker_url?: string;
  provider_used?: string | null;
  documents?: BrokerDocumentResponseEntry[];
  errors?: string[];
  error?: string;
}

const CONDITION_RANK: Record<string, number> = { unknown: 0, good: 1, fair: 2, poor: 3 };

/** Shape of attributes.inspection_findings, set by this provider below — mirrors extractor/inspection_extractor.py's InspectionExtractionResult. Consumed by engine/analyzers/risk.ts. */
export interface InspectionFindingDto {
  category: string;
  description: string;
  severity: "minor" | "moderate" | "significant" | "critical";
  recommendation: string | null;
  source_excerpt: string | null;
}

export interface InspectionFindingsAttribute {
  findings: InspectionFindingDto[];
  summary: string;
  overall_condition: "good" | "fair" | "poor" | "unknown";
  extraction_confidence: number;
}

function extFromMime(mime: string): string {
  if (mime === "application/pdf") return "pdf";
  return "bin";
}

export const brokerDocumentsProvider: DataProvider = {
  id: "broker_documents",
  name: "Broker-site document discovery",
  kind: "real",
  // Broker-site crawl + N document downloads + annual-report extraction +
  // (for inspection protocols) an OpenAI call is genuinely slower than a
  // typical API-based provider. See pipeline.ts's per-provider timeoutMs
  // override — 100s fits inside the 300s total pipeline budget alongside
  // brfAcquisitionProvider's 120s without exhausting it, since most other
  // providers resolve in low single-digit seconds.
  timeoutMs: 100_000,

  async collect({ property, extracted }): Promise<ProviderResult> {
    const base = { id: this.id, name: this.name, kind: this.kind } as const;

    const hemnetUrl = property.hemnetUrl ?? extracted.hemnetUrl;
    if (!hemnetUrl) {
      return {
        source: { ...base, status: "no_data", fields: [], detail: "No Hemnet URL for this property." },
        data: {},
      };
    }

    const apiBase = process.env.PYTHON_ENGINE_API_URL;
    if (!apiBase) {
      return {
        source: { ...base, status: "not_connected", fields: [], detail: "Python engine API not configured (set PYTHON_ENGINE_API_URL)." },
        data: {},
      };
    }

    let res: Response;
    try {
      res = await fetch(`${apiBase.replace(/\/$/, "")}/api/broker-documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hemnet_url: hemnetUrl }),
        signal: AbortSignal.timeout(100_000),
        cache: "no-store",
      });
    } catch (err) {
      return {
        source: {
          ...base,
          status: "error",
          fields: [],
          detail: `Broker document discovery request failed: ${err instanceof Error ? err.message : String(err)}`,
        },
        data: {},
      };
    }

    let body: BrokerDocumentsResponse;
    try {
      body = (await res.json()) as BrokerDocumentsResponse;
    } catch {
      return {
        source: { ...base, status: "error", fields: [], detail: `Broker document discovery response was not valid JSON (HTTP ${res.status})` },
        data: {},
      };
    }

    if (!res.ok || !body.success) {
      // A 422 with no broker link / no documents found is an expected
      // outcome (broker page structure not matched, nothing published),
      // not a system error.
      const status = res.ok || res.status === 422 ? "no_data" : "error";
      return {
        source: { ...base, status, fields: [], detail: body.error ?? `Broker document discovery responded ${res.status}` },
        data: {},
      };
    }

    const entries = body.documents ?? [];
    if (entries.length === 0) {
      return {
        source: { ...base, status: "no_data", fields: [], detail: "No documents found on the broker's site." },
        data: {},
      };
    }

    const alreadyHasAnnualReport = property.attributes.brf_annual_report != null;
    const knownOrgNumber =
      typeof property.attributes.brf === "object" &&
      property.attributes.brf !== null &&
      typeof (property.attributes.brf as Record<string, unknown>).organization_number === "string"
        ? ((property.attributes.brf as Record<string, unknown>).organization_number as string)
        : null;

    const admin = createAdminClient();
    const storedDocuments: Array<{ id: string; docType: BrokerDocumentType; filename: string; sourceUrl: string }> = [];
    const inspectionResults: NonNullable<BrokerDocumentResponseEntry["inspection_findings"]>[] = [];
    let annualReportData: Record<string, unknown> | null = null;

    const data: Record<string, unknown> = {};

    for (const entry of entries) {
      if (!entry.content_base64) continue; // oversized file, source_url-only — nothing to persist here
      const bytes = Buffer.from(entry.content_base64, "base64");
      const verifiedHash = createHash("sha256").update(bytes).digest("hex");
      if (verifiedHash !== entry.content_hash) continue; // integrity mismatch — skip rather than trust an unverified blob

      const existing = await findExistingBrokerDocument(property.id, entry.content_hash);
      let brfAnnualReportId: string | null = existing?.brfAnnualReportId ?? null;

      if (entry.doc_type === "annual_report" && !alreadyHasAnnualReport && entry.annual_report) {
        const report = await findReusableBrfReport({
          contentHash: entry.content_hash,
          organizationNumber: knownOrgNumber,
          propertyId: property.id,
        });
        const brfReport =
          report ??
          (await (async () => {
            const storagePath = `${knownOrgNumber ?? `property-${property.id}`}/${entry.content_hash}.pdf`;
            const { error: uploadError } = await admin.storage
              .from("brf-annual-reports")
              .upload(storagePath, bytes, { contentType: "application/pdf", upsert: true });
            if (uploadError) throw new Error(`brf-annual-reports upload failed: ${uploadError.message}`);
            return insertBrfReport({
              organizationNumber: knownOrgNumber,
              fallbackPropertyId: knownOrgNumber ? null : property.id,
              contentHash: entry.content_hash,
              storagePath,
              originalFilename: entry.filename || null,
              fiscalYear: typeof entry.annual_report?.fiscal_year === "number" ? (entry.annual_report.fiscal_year as number) : null,
              annualReport: entry.annual_report as Record<string, unknown>,
              uploadedBy: null,
            });
          })());
        brfAnnualReportId = brfReport.id;
        annualReportData = brfReport.annualReport;
      }

      if (entry.doc_type === "inspection_report" && entry.inspection_findings && entry.inspection_findings.extraction_confidence > 0) {
        inspectionResults.push(entry.inspection_findings);
      }

      if (existing) {
        storedDocuments.push({ id: existing.id, docType: existing.docType, filename: existing.originalFilename ?? entry.filename, sourceUrl: existing.sourceUrl });
        continue;
      }

      const storagePath = `${property.id}/${entry.content_hash}.${extFromMime(entry.mime_type)}`;
      const { error: uploadError } = await admin.storage
        .from(BROKER_DOCUMENTS_BUCKET)
        .upload(storagePath, bytes, { contentType: entry.mime_type, upsert: true });
      if (uploadError) throw new Error(`broker-documents upload failed: ${uploadError.message}`);

      const record = await insertBrokerDocument({
        propertyId: property.id,
        docType: entry.doc_type,
        storagePath,
        originalFilename: entry.filename || null,
        contentType: entry.mime_type,
        contentHash: entry.content_hash,
        sourceUrl: entry.source_url,
        brokerUrl: body.broker_url ?? null,
        aiFindings: entry.doc_type === "inspection_report" ? (entry.inspection_findings as Record<string, unknown> | null) : null,
        aiModel: entry.doc_type === "inspection_report" ? ((entry.inspection_findings?.model as string) ?? null) : null,
        brfAnnualReportId,
      });
      storedDocuments.push({ id: record.id, docType: record.docType, filename: record.originalFilename ?? entry.filename, sourceUrl: record.sourceUrl });
    }

    if (annualReportData) data.brf_annual_report = annualReportData;

    if (inspectionResults.length > 0) {
      // Merge across multiple inspection documents (rare, but possible):
      // combine every finding, keep the worst overall_condition, and the
      // first non-empty summary — never silently drop a document's findings.
      const worst = inspectionResults.reduce((acc, r) =>
        (CONDITION_RANK[r.overall_condition] ?? 0) > (CONDITION_RANK[acc.overall_condition] ?? 0) ? r : acc
      );
      data.inspection_findings = {
        findings: inspectionResults.flatMap((r) => r.findings),
        summary: inspectionResults.map((r) => r.summary).filter(Boolean).join(" "),
        overall_condition: worst.overall_condition,
        extraction_confidence: Math.max(...inspectionResults.map((r) => r.extraction_confidence)),
      };
    }

    if (storedDocuments.length > 0) data.broker_documents = storedDocuments;

    if (Object.keys(data).length === 0) {
      return {
        source: { ...base, status: "no_data", fields: [], detail: "Documents were found but none could be verified/stored." },
        data: {},
      };
    }

    return {
      source: { ...base, status: "ok", fields: Object.keys(data) },
      data,
    };
  },
};
