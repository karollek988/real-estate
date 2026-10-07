"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CloseIcon } from "@/components/icons";
import { CONTENT_CATEGORIES, CONTENT_TYPE_LABELS, findCategory, isCategorySlug, type ContentCategorySlug, type ContentItem } from "@/lib/content/model";
import { CONTENT_BASE_PATHS, LIBRARY_ANCHOR } from "@/lib/content/paths";
import { GuideCard } from "./GuideCard";

/**
 * The hub's full list: category chips, the search from the hero, and the cards
 * (one column on phones, two on tablets, three from 1024 px). Filtering
 * happens here, from the address (?kategori=...&q=...), so the page itself
 * stays static and a filtered view can be linked to.
 *
 * Before the address is read (the first paint, or without JavaScript) the
 * full list is shown.
 */
interface LibraryProps {
  items: ContentItem[];
  type: ContentItem["type"];
  title: string;
  /** Hidden while nothing is filtered: the featured card already shows it above. */
  hideWhenUnfiltered?: string;
  showCategories?: boolean;
  /** Shown when there is nothing published at all. */
  empty: React.ReactNode;
}

export function GuideLibrary(props: LibraryProps) {
  return (
    <Suspense fallback={<LibraryView {...props} category={null} query="" />}>
      <LibraryFromAddress {...props} />
    </Suspense>
  );
}

function LibraryFromAddress(props: LibraryProps) {
  const params = useSearchParams();
  const kategori = params?.get("kategori") ?? null;
  return <LibraryView {...props} category={isCategorySlug(kategori) ? kategori : null} query={(params?.get("q") ?? "").trim()} />;
}

/** Lowercase, without accents, å/ä → a and ö → o: "Räntekänslighet" matches "rantekanslighet". */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[åä]/g, "a")
    .replace(/ö/g, "o")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "");
}

function matches(item: ContentItem, query: string): boolean {
  const haystack = normalize(`${item.title} ${item.excerpt} ${findCategory(item.category)?.label ?? ""}`);
  return normalize(query)
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}

/** "1 träff", "4 träffar" while filtering; "6 guider", "1 insikt" otherwise. */
function countLabel(n: number, type: ContentItem["type"] | null): string {
  if (!type) return n === 1 ? "1 träff" : `${n} träffar`;
  const { one, many } = CONTENT_TYPE_LABELS[type];
  return `${n} ${(n === 1 ? one : many).toLowerCase()}`;
}

function filterHref(basePath: string, category: ContentCategorySlug | null, query: string): string {
  const params = new URLSearchParams();
  if (category) params.set("kategori", category);
  if (query) params.set("q", query);
  const qs = params.toString();
  return `${basePath}${qs ? `?${qs}` : ""}#${LIBRARY_ANCHOR}`;
}

function LibraryView({
  items,
  type,
  title,
  hideWhenUnfiltered,
  showCategories = true,
  empty,
  category,
  query,
}: LibraryProps & { category: ContentCategorySlug | null; query: string }) {
  const basePath = CONTENT_BASE_PATHS[type];
  const filtering = Boolean(category || query);
  const searched = query ? items.filter((item) => matches(item, query)) : items;
  const shown = searched.filter((item) => {
    if (category) return item.category === category;
    return filtering || item.id !== hideWhenUnfiltered;
  });
  const countIn = (slug: ContentCategorySlug) => searched.filter((item) => item.category === slug).length;
  const activeCategory = findCategory(category);

  return (
    <section id={LIBRARY_ANCHOR} aria-labelledby="library-title" className="scroll-mt-24">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <h2 id="library-title" className="font-display text-[30px] font-bold leading-tight tracking-[-0.015em] text-ka-ink sm:text-[38px]">
          {activeCategory ? activeCategory.label : title}
        </h2>
        {items.length > 0 && (
          <p aria-live="polite" className="text-[14.5px] text-ka-muted">
            {countLabel(filtering ? shown.length : items.length, filtering ? null : type)}
          </p>
        )}
      </div>

      {items.length > 0 && showCategories && (
        <nav aria-label="Filtrera efter ämne" className="-mx-5 mt-6 overflow-x-auto px-5 pb-1 sm:mx-0 sm:overflow-visible sm:px-0">
          <ul className="flex w-max gap-2 sm:w-auto sm:flex-wrap">
            <li>
              <Chip href={filterHref(basePath, null, query)} active={!category}>
                Alla
              </Chip>
            </li>
            {CONTENT_CATEGORIES.map((c) => (
              <li key={c.slug}>
                <Chip href={filterHref(basePath, c.slug, query)} active={category === c.slug}>
                  {c.label}
                  <span className={`ml-1.5 tabular-nums ${category === c.slug ? "text-white/75" : "text-ka-muted"}`}>{countIn(c.slug)}</span>
                </Chip>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {query && (
        <p className="mt-5 flex flex-wrap items-center gap-3 text-[15px] text-ka-text">
          <span>
            Sökresultat för <strong className="font-semibold text-ka-ink">”{query}”</strong>
          </span>
          <Link
            href={filterHref(basePath, category, "")}
            scroll={false}
            className="inline-flex items-center gap-1.5 rounded-full border border-ka-line-strong bg-white px-3 py-1 text-[13.5px] font-semibold text-ka-green-800 transition hover:border-ka-green-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ka-green-700"
          >
            <CloseIcon className="h-3.5 w-3.5" strokeWidth={2.4} />
            Rensa sökningen
          </Link>
        </p>
      )}

      <div className="mt-8">
        {items.length === 0 ? (
          empty
        ) : shown.length === 0 ? (
          <div className="flex flex-col items-start gap-4 rounded-[24px] border border-dashed border-ka-line-strong bg-white/70 p-7 sm:p-9">
            <p className="text-[18px] font-semibold text-ka-ink">Inget matchar {query ? `”${query}”` : "det här ämnet"} ännu.</p>
            <p className="max-w-[560px] text-[15.5px] leading-relaxed text-ka-muted">
              Prova ett annat ord eller ett annat ämne. Vi fyller på med fler guider löpande.
            </p>
            <Link
              href={filterHref(basePath, null, "")}
              scroll={false}
              className="inline-flex h-11 items-center rounded-[12px] bg-ka-green-900 px-5 text-[15px] font-semibold text-white transition hover:bg-ka-green-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ka-green-700 focus-visible:ring-offset-2"
            >
              Visa allt
            </Link>
          </div>
        ) : (
          <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 lg:gap-7">
            {shown.map((item) => (
              <li key={item.id}>
                <GuideCard item={item} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      scroll={false}
      replace
      aria-current={active ? "true" : undefined}
      className={`inline-flex h-11 items-center whitespace-nowrap rounded-full border px-4 text-[14.5px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ka-green-700 focus-visible:ring-offset-2 focus-visible:ring-offset-ka-sand ${
        active ? "border-ka-green-900 bg-ka-green-900 text-white" : "border-ka-line-strong bg-white text-ka-ink hover:border-ka-green-700 hover:text-ka-green-800"
      }`}
    >
      {children}
    </Link>
  );
}
