import Link from "next/link";
import { ContentStoreError, listAllContent } from "@/lib/content/adminStore";
import { CONTENT_TYPE_LABELS, findCategory, formatContentDate, type ContentItem } from "@/lib/content/model";
import { contentHref } from "@/lib/content/paths";

export const dynamic = "force-dynamic";

/** /admin/content - every guide, insight and news item, drafts included, newest change first. */
export default async function ContentListPage() {
  let items: ContentItem[] = [];
  let problem: string | null = null;
  try {
    items = await listAllContent();
  } catch (err) {
    problem = err instanceof ContentStoreError ? err.message : "Innehållet kunde inte hämtas.";
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ka-ink">Innehåll</h1>
          <p className="mt-1 text-sm text-ka-muted">Guider (Bostadsguiden), insikter och egna nyheter. Utkast syns bara här.</p>
        </div>
        <Link href="/admin/content/new" className="rounded-lg bg-ka-green-900 px-4 py-2 text-sm font-semibold text-white hover:bg-ka-green-800">
          Nytt innehåll
        </Link>
      </div>

      {problem ? (
        <p className="rounded-lg border border-ka-amber-300 bg-ka-amber-100 px-4 py-4 text-sm text-ka-amber-700">{problem}</p>
      ) : items.length === 0 ? (
        <p className="rounded-lg border border-ka-line-strong bg-white px-4 py-6 text-sm text-ka-muted">Inget innehåll ännu. Börja med &quot;Nytt innehåll&quot;.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-ka-line-strong bg-white px-4">
          <table className="w-full min-w-[720px] text-left">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-ka-muted">
                <th className="py-2.5 pr-4 font-medium">Titel</th>
                <th className="py-2.5 pr-4 font-medium">Typ</th>
                <th className="py-2.5 pr-4 font-medium">Kategori</th>
                <th className="py-2.5 pr-4 font-medium">Status</th>
                <th className="py-2.5 pr-4 font-medium">Ändrad</th>
                <th className="py-2.5 font-medium" />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t border-ka-line align-top">
                  <td className="py-3 pr-4">
                    <Link href={`/admin/content/${item.id}`} className="font-medium text-ka-ink hover:underline">
                      {item.title}
                    </Link>
                    <p className="text-xs text-ka-muted">{contentHref(item)}</p>
                  </td>
                  <td className="py-3 pr-4 text-sm text-ka-text">{CONTENT_TYPE_LABELS[item.type].one}</td>
                  <td className="py-3 pr-4 text-sm text-ka-text">{findCategory(item.category)?.label ?? "—"}</td>
                  <td className="py-3 pr-4">
                    {item.status === "published" ? (
                      <span className="inline-flex rounded-full bg-ka-sage px-2.5 py-0.5 text-xs font-semibold text-ka-green-800">Publicerad</span>
                    ) : (
                      <span className="inline-flex rounded-full bg-ka-sand px-2.5 py-0.5 text-xs font-semibold text-ka-muted">Utkast</span>
                    )}
                    {item.featured && <span className="ml-1.5 inline-flex rounded-full bg-ka-sky-100 px-2.5 py-0.5 text-xs font-semibold text-ka-sky-700">Utvald</span>}
                  </td>
                  <td className="py-3 pr-4 text-sm text-ka-text">{formatContentDate(item.updatedAt)}</td>
                  <td className="py-3 text-right text-sm">
                    <Link href={`/admin/content/${item.id}/preview`} className="font-medium text-ka-ink hover:underline">
                      Förhandsgranska
                    </Link>
                    {item.status === "published" && (
                      <Link href={contentHref(item)} className="ml-3 font-medium text-ka-ink hover:underline">
                        Visa live
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
