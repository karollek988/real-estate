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
          <h1 className="text-xl font-semibold text-[#12271D]">Innehåll</h1>
          <p className="mt-1 text-sm text-neutral-600">Guider (Bostadsguiden), insikter och egna nyheter. Utkast syns bara här.</p>
        </div>
        <Link href="/admin/content/new" className="rounded-lg bg-[#12271D] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1f4d3a]">
          Nytt innehåll
        </Link>
      </div>

      {problem ? (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-4 text-sm text-amber-900">{problem}</p>
      ) : items.length === 0 ? (
        <p className="rounded-lg border border-black/10 bg-white px-4 py-6 text-sm text-neutral-500">Inget innehåll ännu. Börja med &quot;Nytt innehåll&quot;.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-black/10 bg-white px-4">
          <table className="w-full min-w-[720px] text-left">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-neutral-500">
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
                <tr key={item.id} className="border-t border-black/[0.06] align-top">
                  <td className="py-3 pr-4">
                    <Link href={`/admin/content/${item.id}`} className="font-medium text-[#12271D] hover:underline">
                      {item.title}
                    </Link>
                    <p className="text-xs text-neutral-500">{contentHref(item)}</p>
                  </td>
                  <td className="py-3 pr-4 text-sm text-neutral-700">{CONTENT_TYPE_LABELS[item.type].one}</td>
                  <td className="py-3 pr-4 text-sm text-neutral-700">{findCategory(item.category)?.label ?? "—"}</td>
                  <td className="py-3 pr-4">
                    {item.status === "published" ? (
                      <span className="inline-flex rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800">Publicerad</span>
                    ) : (
                      <span className="inline-flex rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-semibold text-neutral-600">Utkast</span>
                    )}
                    {item.featured && <span className="ml-1.5 inline-flex rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-semibold text-sky-800">Utvald</span>}
                  </td>
                  <td className="py-3 pr-4 text-sm text-neutral-700">{formatContentDate(item.updatedAt)}</td>
                  <td className="py-3 text-right text-sm">
                    <Link href={`/admin/content/${item.id}/preview`} className="font-medium text-[#12271D] hover:underline">
                      Förhandsgranska
                    </Link>
                    {item.status === "published" && (
                      <Link href={contentHref(item)} className="ml-3 font-medium text-[#12271D] hover:underline">
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
