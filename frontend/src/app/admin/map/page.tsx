import { createAdminClient } from "@/lib/supabase/admin";
import { MapListingActions } from "@/components/admin/MapListingActions";
import { listAll } from "@/lib/map/store";
import type { MapListingRow } from "@/lib/map/listings";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<MapListingRow["kind"], string> = { sale: "Till salu", buyer: "Köpare söker", exchange: "Byte" };
const dateSv = (iso: string) => new Date(iso).toLocaleDateString("sv-SE", { day: "numeric", month: "short", year: "numeric" });

/** The e-mail of each person who posted, for the team (who to contact about a pin). */
async function ownerEmails(rows: MapListingRow[]): Promise<Map<string, string>> {
  const emails = new Map<string, string>();
  const client = createAdminClient();
  for (const id of new Set(rows.map((row) => row.owner_id).filter((id): id is string => id !== null))) {
    const { data } = await client.auth.admin.getUserById(id);
    if (data?.user?.email) emails.set(id, data.user.email);
  }
  return emails;
}

/**
 * The public map's pins (/karta), for the team: hide a pin that should not be public, show it again. A hidden pin
 * disappears for everyone except its owner, who sees it marked as hidden. The built-in examples are here too.
 */
export default async function AdminMapPage() {
  const rows = await listAll();
  const emails = await ownerEmails(rows);
  const posted = rows.filter((row) => row.owner_id !== null);
  const examples = rows.filter((row) => row.owner_id === null);

  const Table = ({ items, withOwner, empty }: { items: MapListingRow[]; withOwner: boolean; empty: string }) =>
    items.length === 0 ? (
      <p className="rounded-lg border border-ka-line-strong bg-white px-4 py-6 text-sm text-ka-muted">{empty}</p>
    ) : (
      <div className="overflow-x-auto rounded-lg border border-ka-line-strong bg-white px-4">
        <table className="w-full min-w-[720px] text-left">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-ka-muted">
              <th className="py-2.5 pr-4 font-medium">Annons</th>
              <th className="py-2.5 pr-4 font-medium">Typ</th>
              <th className="py-2.5 pr-4 font-medium">{withOwner ? "Upplagd av" : "Exempel"}</th>
              <th className="py-2.5 pr-4 font-medium">Status</th>
              <th className="py-2.5 font-medium" />
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row.id} className="border-t border-ka-line align-top">
                <td className="py-3 pr-4">
                  <p className="font-medium text-ka-ink">{row.title || row.example_key}</p>
                  {row.note && <p className="text-xs text-ka-muted">{row.note}</p>}
                  {row.details && <p className="mt-1 max-w-md text-xs text-ka-text">{row.details}</p>}
                  {row.link && (
                    <a href={row.link} target="_blank" rel="noreferrer noopener" className="text-xs text-ka-sky-700 hover:underline">
                      {row.link.slice(0, 60)}
                    </a>
                  )}
                </td>
                <td className="py-3 pr-4 text-sm text-ka-text">{KIND_LABEL[row.kind]}</td>
                <td className="py-3 pr-4 text-sm text-ka-text">
                  {withOwner ? (
                    <>
                      <p>{(row.owner_id && emails.get(row.owner_id)) ?? "okänd"}</p>
                      <p className="text-xs text-ka-muted">{dateSv(row.created_at)}</p>
                    </>
                  ) : (
                    row.example_key
                  )}
                </td>
                <td className="py-3 pr-4 text-sm">
                  {row.status === "hidden" ? (
                    <>
                      <span className="inline-flex rounded-full bg-ka-coral-100 px-2.5 py-0.5 text-xs font-semibold text-ka-coral-700">Dold</span>
                      {row.hidden_reason && <p className="mt-1 max-w-xs text-xs text-ka-muted">{row.hidden_reason}</p>}
                    </>
                  ) : (
                    <span className="inline-flex rounded-full bg-ka-sage px-2.5 py-0.5 text-xs font-semibold text-ka-green-800">Publicerad</span>
                  )}
                </td>
                <td className="py-3">
                  <MapListingActions id={row.id} hidden={row.status === "hidden"} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ka-ink">Kartans annonser</h1>
        <p className="mt-1 max-w-2xl text-sm text-ka-muted">
          Annonser, köparönskemål och byten som inloggade användare lägger upp på <code>/karta</code>. De syns för alla direkt;
          här döljer du en som inte ska vara offentlig. En dold annons försvinner för alla utom den som la upp den, som ser den
          markerad som dold. Inget raderas.
        </p>
      </div>
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ka-muted">Upplagda av användare ({posted.length})</h2>
        <Table items={posted} withOwner empty="Ingen har lagt upp något än." />
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ka-muted">Inbyggda exempel ({examples.length})</h2>
        <Table items={examples} withOwner={false} empty="Inga exempel." />
      </section>
    </div>
  );
}
