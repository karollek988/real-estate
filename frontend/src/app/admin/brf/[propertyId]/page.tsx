import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { findPropertyById, latestCompleteAnalysis, latestPendingAnalysis, listWaitingAnalyses } from "@/lib/analysis/store";
import { tenureOfProperty } from "@/lib/report/tenure";
import { BRF_REPORTS_BUCKET, EXTRACTION_FAILED, getBrfReportById } from "@/lib/analysis/brfReports";
import { getBrfReview } from "@/lib/brf/reviews";
import { hasAnyBrfFigure, parseBrfFigures } from "@/lib/brf/figures";
import { daySv, dueSv } from "@/lib/report/brfChapter";
import { BrfReviewForm } from "@/components/admin/BrfReviewForm";
import { BrfReportUpload } from "@/components/report/BrfReportUpload";

export const dynamic = "force-dynamic";

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export default async function BrfReviewPage({ params }: { params: Promise<{ propertyId: string }> }) {
  const { propertyId } = await params;
  const property = await findPropertyById(propertyId);
  if (!property) notFound();
  const review = await getBrfReview(propertyId);
  if (!review) notFound();

  const document = review.brfReportId ? await getBrfReportById(review.brfReportId) : null;
  let documentUrl: string | null = null;
  if (document) {
    const { data } = await createAdminClient().storage.from(BRF_REPORTS_BUCKET).createSignedUrl(document.storagePath, 60 * 60);
    documentUrl = data?.signedUrl ?? null;
  }
  const extractionFailed = document?.annualReport?.verification_status === EXTRACTION_FAILED;

  const analysis = await latestCompleteAnalysis(propertyId);
  const waiting = await listWaitingAnalyses(propertyId);
  const building = (await latestPendingAnalysis(propertyId)) !== null;
  const freehold = tenureOfProperty(property) === "freehold";
  const p = analysis?.report?.property;
  const a = property.attributes;
  const apartment = {
    livingAreaM2: p?.livingAreaM2 ?? num(a.living_area_m2),
    monthlyFeeSek: p?.monthlyFeeSek ?? num(a.monthly_fee_sek),
    buildingYear: p?.buildingYear ?? num(a.building_year),
  };
  const associationName = p?.housingAssociation ?? (typeof a.housing_association === "string" ? a.housing_association : null);

  // The automatic reading of the current document, validated like any input so the prefill can't carry an implausible value.
  const prefill: Record<string, unknown> = {};
  if (document?.keyFigures) {
    const { figures } = parseBrfFigures(document.keyFigures.values);
    for (const [key, value] of Object.entries(figures)) if (value !== null) prefill[key] = value;
  }
  const initial = hasAnyBrfFigure(review.draft) ? review.draft : parseBrfFigures(prefill).figures;

  const listingUrl = property.hemnetUrl ?? (typeof a.booli_url === "string" ? a.booli_url : null);
  const overdue = review.status === "pending" && new Date(review.dueAt).getTime() < Date.now();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/admin/brf" className="text-xs font-medium text-ka-muted hover:underline">
            ← Alla granskningar
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ka-ink">{property.address}</h1>
          <p className="mt-0.5 text-sm text-ka-muted">
            {associationName ?? "Förening okänd"}
            {apartment.livingAreaM2 ? ` · ${apartment.livingAreaM2} m²` : ""}
            {apartment.monthlyFeeSek ? ` · avgift ${new Intl.NumberFormat("sv-SE").format(apartment.monthlyFeeSek)} kr/mån` : ""}
            {apartment.buildingYear ? ` · byggår ${apartment.buildingYear}` : ""}
          </p>
        </div>
        <div className="rounded-lg border border-ka-line-strong bg-white px-4 py-3 text-sm">
          {review.status === "pending" ? (
            <p className={overdue ? "font-semibold text-ka-coral-700" : "font-semibold text-ka-ink"}>
              {overdue ? "Försenad — utlovad " : "Klar senast "}
              {dueSv(review.dueAt)}
            </p>
          ) : review.status === "published" ? (
            <p className="font-semibold text-ka-green-800">Publicerad {daySv(review.publishedAt)}</p>
          ) : (
            <p className="font-semibold text-ka-muted">Markerad som ej aktuell</p>
          )}
          {review.status === "pending" && review.published && (
            <p className="mt-0.5 text-xs text-ka-muted">Ny årsredovisning — kunden ser den tidigare publicerade analysen tills du publicerar.</p>
          )}
          {building ? (
            <p className="mt-1.5 text-xs font-medium text-ka-amber-700">Rapporten tas fram — du kan publicera när den är klar.</p>
          ) : waiting.length > 0 ? (
            <p className="mt-1.5 text-xs font-medium text-ka-ink">
              Rapporten väntar på dig ({waiting.length > 1 ? `${waiting.length} versioner` : "1 version"}). Läs den, sedan släpper du den
              genom att publicera{freehold ? " (friköpt bostad: välj \"Ingen förening\")" : ""}.
            </p>
          ) : analysis ? (
            <p className="mt-1.5 text-xs text-ka-muted">Rapporten är släppt till kunden.</p>
          ) : null}
          <div className="mt-1.5 flex flex-wrap gap-3 text-xs">
            {analysis && (
              <Link href={`/report?id=${analysis.id}`} className="font-medium text-ka-sky-700 hover:underline" target="_blank">
                Kundens rapport
              </Link>
            )}
            {listingUrl && (
              <a href={listingUrl} className="font-medium text-ka-sky-700 hover:underline" target="_blank" rel="noreferrer">
                Annonsen
              </a>
            )}
          </div>
        </div>
      </div>

      <section className="rounded-lg border border-ka-line-strong bg-white p-4">
        <h2 className="text-sm font-semibold text-ka-ink">Årsredovisning</h2>
        {document ? (
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            {documentUrl ? (
              <a href={documentUrl} target="_blank" rel="noreferrer" className="font-medium text-ka-sky-700 hover:underline">
                Öppna {document.originalFilename ?? "dokumentet"}
              </a>
            ) : (
              <span>{document.originalFilename ?? "Dokument"} (kunde inte skapa länk)</span>
            )}
            <span className="text-ka-muted">
              {document.fiscalYear ? `Räkenskapsår ${document.fiscalYear} · ` : ""}uppladdad {daySv(document.createdAt)}
            </span>
            {extractionFailed && (
              <span className="text-ka-amber-700">Motorn kunde inte läsa filen automatiskt — fyll i uppgifterna från dokumentet.</span>
            )}
          </div>
        ) : (
          <p className="mt-2 text-sm text-ka-amber-700">
            Ingen årsredovisning är uppladdad. Ta fram den senaste (mäklaren, föreningen, annonsen eller Bolagsverket) och ladda upp den här.
          </p>
        )}
        <div className="mt-3">
          <BrfReportUpload
            propertyId={propertyId}
            tone="admin"
            label={document ? "Ladda upp en annan årsredovisning" : "Ladda upp årsredovisningen"}
            description="PDF, Word eller foto, högst 20 MB. Nyckeltalen läses av automatiskt som förslag."
            successMessage="Uppladdad. Sidan laddas om med den automatiska avläsningen."
          />
        </div>
      </section>

      <BrfReviewForm
        // A new document brings a new automatic reading: start the form over from it.
        key={review.brfReportId ?? "no-document"}
        propertyId={propertyId}
        initial={initial}
        prefill={prefill}
        evidence={document?.keyFigures?.evidence ?? {}}
        apartment={apartment}
        associationName={associationName}
        status={review.status}
        reportWaiting={waiting.length}
        reportBuilding={building}
      />
    </div>
  );
}
