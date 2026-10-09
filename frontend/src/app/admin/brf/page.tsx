import Link from "next/link";
import { listBrfReviews, type BrfReviewListItem } from "@/lib/brf/reviews";
import { dueSv, daySv } from "@/lib/report/brfChapter";

export const dynamic = "force-dynamic";

function StatusChip({ item, now }: { item: BrfReviewListItem; now: number }) {
  if (item.status === "pending" && item.customerCount === 0) {
    return <span className="inline-flex rounded-full bg-ka-sand px-2.5 py-0.5 text-xs font-semibold text-ka-muted">Ingen aktiv kund</span>;
  }
  if (item.status === "pending") {
    const overdue = new Date(item.dueAt).getTime() < now;
    const hoursLeft = Math.round((new Date(item.dueAt).getTime() - now) / 3_600_000);
    return (
      <span
        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
          overdue ? "bg-ka-coral-100 text-ka-coral-700" : hoursLeft <= 6 ? "bg-ka-amber-100 text-ka-amber-700" : "bg-ka-sky-100 text-ka-sky-700"
        }`}
      >
        {overdue ? "Försenad" : `${hoursLeft} h kvar`}
        {item.published ? " · uppdatering" : ""}
      </span>
    );
  }
  if (item.status === "not_applicable") {
    return <span className="inline-flex rounded-full bg-ka-sand px-2.5 py-0.5 text-xs font-semibold text-ka-muted">Ej aktuell</span>;
  }
  return <span className="inline-flex rounded-full bg-ka-sage px-2.5 py-0.5 text-xs font-semibold text-ka-green-800">Publicerad</span>;
}

export default async function BrfReviewQueuePage() {
  const items = await listBrfReviews();
  const now = Date.now();
  // A review whose only purchase was refunded (the analysis failed) has nobody waiting for it.
  const open = items.filter((i) => i.status === "pending" && i.customerCount > 0);
  const done = items.filter((i) => i.status !== "pending" || i.customerCount === 0);

  const Row = ({ item }: { item: BrfReviewListItem }) => (
    <tr className="border-t border-ka-line align-top">
      <td className="py-3 pr-4">
        <Link href={`/admin/brf/${item.propertyId}`} className="font-medium text-ka-ink hover:underline">
          {item.address}
        </Link>
        <p className="text-xs text-ka-muted">{item.housingAssociation ?? "Förening okänd"}</p>
      </td>
      <td className="py-3 pr-4">
        <StatusChip item={item} now={now} />
      </td>
      <td className="py-3 pr-4 text-sm text-ka-text">
        {item.status === "pending" ? dueSv(item.dueAt) : daySv(item.publishedAt) ?? "—"}
      </td>
      <td className="py-3 pr-4 text-sm text-ka-text">{item.brfReportId ? "Uppladdad" : <span className="text-ka-amber-700">Saknas</span>}</td>
      <td className="py-3 text-sm text-ka-text">{item.customerCount}</td>
    </tr>
  );

  const Table = ({ rows, empty, dateLabel }: { rows: BrfReviewListItem[]; empty: string; dateLabel: string }) =>
    rows.length === 0 ? (
      <p className="rounded-lg border border-ka-line-strong bg-white px-4 py-6 text-sm text-ka-muted">{empty}</p>
    ) : (
      <div className="overflow-x-auto rounded-lg border border-ka-line-strong bg-white px-4">
        <table className="w-full min-w-[640px] text-left">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-ka-muted">
              <th className="py-2.5 pr-4 font-medium">Bostad</th>
              <th className="py-2.5 pr-4 font-medium">Status</th>
              <th className="py-2.5 pr-4 font-medium">{dateLabel}</th>
              <th className="py-2.5 pr-4 font-medium">Årsredovisning</th>
              <th className="py-2.5 font-medium">Kunder</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => (
              <Row key={item.propertyId} item={item} />
            ))}
          </tbody>
        </table>
      </div>
    );

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ka-ink">BRF-granskningar</h1>
        <p className="mt-1 max-w-2xl text-sm text-ka-muted">
          Varje Trygghetspaket granskas av en person innan kunden ser rapporten — också en villa, som då saknar BRF-analys.
          Kunden har utlovats rapporten inom 24 timmar. Läs rapporten, ta fram årsredovisningen (från mäklaren, föreningen
          eller annonsen) om kunden inte har laddat upp den, kontrollera nyckeltalen och publicera. Då släpps hela rapporten.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ka-muted">Att granska ({open.length})</h2>
        <Table rows={open} empty="Inga granskningar väntar just nu." dateLabel="Klar senast" />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ka-muted">Klara ({done.length})</h2>
        <Table rows={done} empty="Inget publicerat än." dateLabel="Publicerad" />
      </section>
    </div>
  );
}
