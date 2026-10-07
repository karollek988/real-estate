import Image from "next/image";
import Link from "next/link";
import { ArrowRightIcon, ChevronDownIcon, ClockIcon } from "@/components/icons";
import { LANDING_CONTAINER } from "@/components/landing/container";
import { Breadcrumbs, type Crumb } from "@/components/site/Breadcrumbs";
import { ROUTES } from "@/components/site/navigation";
import { handwriting } from "@/lib/fonts";
import { parseMarkdown, tableOfContents } from "@/lib/content/markdown";
import { CONTENT_TYPE_LABELS, findCategory, formatContentDate, type ContentItem } from "@/lib/content/model";
import { CONTENT_BASE_PATHS, categoryHref, contentHref, siteUrl } from "@/lib/content/paths";
import { CategoryPill, DemoBadge } from "./CategoryPill";
import { ContentBody } from "./ContentBody";
import { GuideCard } from "./GuideCard";
import { GuideCta } from "./GuideCta";

/**
 * A published guide, insight or news item - and the editor's preview of one.
 * One column of comfortable reading width, a table of contents beside it on
 * wide screens (in a fold-out above the text on phones), then related items
 * and the way into the product. Structured data (Article + BreadcrumbList)
 * describes the page to search engines and AI search.
 */
export function ContentArticle({ item, related, preview = false }: { item: ContentItem; related: ContentItem[]; preview?: boolean }) {
  const blocks = parseMarkdown(item.body);
  const toc = tableOfContents(blocks);
  const labels = CONTENT_TYPE_LABELS[item.type];
  const category = findCategory(item.category);
  const published = item.publishedAt;
  const updatedLater = published && Date.parse(item.updatedAt) - Date.parse(published) > 86_400_000;

  const crumbs: Crumb[] = [
    { label: labels.hub, href: CONTENT_BASE_PATHS[item.type] },
    ...(category ? [{ label: category.label, href: categoryHref(item.type, category.slug) }] : []),
    { label: item.title },
  ];

  return (
    <div className={handwriting.variable}>
      {!preview && !item.isDemo && <ArticleJsonLd item={item} crumbs={crumbs} />}
      {(preview || item.isDemo) && (
        <div className="border-b border-ka-amber-700/25 bg-ka-amber-100 px-5 py-2.5 text-center text-[14px] font-medium text-ka-amber-700">
          {preview
            ? `Förhandsgranskning · ${item.status === "published" ? "Publicerad" : "Utkast – syns inte på sajten"}`
            : "Exempelinnehåll – visas bara under utveckling och i förhandsversioner, aldrig i produktion."}
        </div>
      )}

      <article aria-labelledby="article-title">
        <header className="relative overflow-hidden bg-ka-cream">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 top-0 hidden h-[140px] w-[1000px] bg-[url('/images/header-contours.svg')] bg-[length:1000px_125px] bg-no-repeat opacity-40 lg:block"
          />
          <div className={`${LANDING_CONTAINER} relative pb-10 pt-7 sm:pt-9 lg:pb-12`}>
            {/* Same left edge as the picture and the text below; the header itself stays narrower. */}
            <div className="mx-auto max-w-[1180px] [&>*]:max-w-[880px]">
              <Breadcrumbs crumbs={crumbs} />
              <div className="mt-8 flex flex-wrap items-center gap-2.5 sm:mt-10">
                <CategoryPill category={item.category} />
                <span className="text-[12px] font-bold uppercase tracking-[0.14em] text-ka-green-700">{labels.one}</span>
                {item.isDemo && <DemoBadge />}
              </div>
              <h1
                id="article-title"
                className="mt-5 font-display text-[36px] font-bold leading-[1.06] tracking-[-0.022em] text-ka-ink sm:text-[48px] lg:text-[56px]"
              >
                {item.title}
              </h1>
              {item.excerpt && <p className="mt-5 max-w-[760px] text-[18px] leading-[1.6] text-ka-muted sm:text-[20px]">{item.excerpt}</p>}
              <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-ka-line-strong pt-5 text-[14.5px] text-ka-muted">
                <span className="flex items-center gap-2.5">
                  <Image src="/images/kopanalys-logo-mark.png" alt="" width={32} height={32} className="rounded-full" />
                  <span>
                    Av <span className="font-semibold text-ka-ink">{item.authorName}</span>
                  </span>
                </span>
                {published && (
                  <span>
                    Publicerad <time dateTime={published}>{formatContentDate(published)}</time>
                  </span>
                )}
                {updatedLater && (
                  <span>
                    Uppdaterad <time dateTime={item.updatedAt}>{formatContentDate(item.updatedAt)}</time>
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5">
                  <ClockIcon className="h-4 w-4" />
                  {item.readingMinutes} min läsning
                </span>
              </div>
            </div>
          </div>
        </header>

        {item.coverImage && (
          <div className={`${LANDING_CONTAINER} bg-ka-cream`}>
            <div className="relative mx-auto aspect-[16/10] max-w-[1180px] overflow-hidden rounded-[24px] bg-ka-sand shadow-ka-card sm:aspect-[2/1] sm:rounded-[30px]">
              <Image src={item.coverImage} alt={item.coverImageAlt} fill priority sizes="(min-width: 1280px) 1180px, 100vw" className="object-cover" />
            </div>
          </div>
        )}

        <div className="bg-ka-cream">
          <div className={`${LANDING_CONTAINER} py-12 lg:py-16`}>
            <div className="mx-auto grid max-w-[1180px] gap-10 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-16">
              <div className="mx-auto w-full max-w-[720px] lg:mx-0">
                {toc.length >= 2 && (
                  <details className="group mb-8 rounded-[18px] border border-ka-line-strong bg-white p-5 shadow-ka-card lg:hidden">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[15px] font-bold text-ka-ink [&::-webkit-details-marker]:hidden">
                      <span>
                        Innehåll <span className="font-normal text-ka-muted">({toc.length} avsnitt)</span>
                      </span>
                      <ChevronDownIcon className="h-5 w-5 text-ka-green-700 transition-transform group-open:rotate-180" strokeWidth={2.2} />
                    </summary>
                    <TocList toc={toc} />
                  </details>
                )}
                {blocks.length > 0 ? (
                  <ContentBody blocks={blocks} />
                ) : (
                  <p className="rounded-[18px] border border-dashed border-ka-line-strong p-6 text-ka-muted">Texten är tom ännu.</p>
                )}
              </div>

              <aside className="hidden lg:block">
                <div className="sticky top-28 flex flex-col gap-5">
                  {toc.length >= 2 && (
                    <nav aria-label="Innehåll" className="rounded-[20px] border border-ka-line-strong bg-white p-6 shadow-ka-card">
                      <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-ka-green-700">Innehåll</p>
                      <TocList toc={toc} />
                    </nav>
                  )}
                  <div className="rounded-[20px] bg-ka-green-950 p-6 text-white">
                    <p className="font-display text-[21px] font-bold leading-snug">Hur står sig bostaden du tittar på?</p>
                    <p className="mt-2 text-[14.5px] leading-relaxed text-white/75">Föreningens ekonomi, området och kostnaderna – för just den bostaden.</p>
                    <Link
                      href={ROUTES.skapaAnalys}
                      className="group mt-5 inline-flex h-11 items-center gap-2 rounded-[11px] bg-ka-cream px-4 text-[14.5px] font-semibold text-ka-green-950 transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ka-mint focus-visible:ring-offset-2 focus-visible:ring-offset-ka-green-950"
                    >
                      Skapa analys
                      <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </Link>
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </div>
      </article>

      {related.length > 0 && (
        <section aria-labelledby="related-title" className="border-y border-ka-line bg-ka-sand">
          <div className={`${LANDING_CONTAINER} py-14 lg:py-20`}>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h2 id="related-title" className="font-display text-[28px] font-bold text-ka-ink sm:text-[36px]">
                Läs vidare
              </h2>
              <Link
                href={CONTENT_BASE_PATHS[item.type]}
                className="group inline-flex items-center gap-2 text-[15px] font-semibold text-ka-green-700 hover:text-ka-green-900"
              >
                Till {labels.hub}
                <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
            <ul className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3 lg:gap-7">
              {related.map((other) => (
                <li key={other.id}>
                  <GuideCard item={other} />
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <GuideCta />
    </div>
  );
}

function TocList({ toc }: { toc: { id: string; text: string }[] }) {
  return (
    <ol className="mt-3 flex flex-col gap-1">
      {toc.map((entry, i) => (
        <li key={entry.id}>
          <a
            href={`#${entry.id}`}
            className="flex gap-3 rounded-lg py-1.5 text-[14.5px] leading-snug text-ka-text transition hover:text-ka-green-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ka-green-700"
          >
            <span className="w-5 shrink-0 tabular-nums text-ka-muted">{i + 1}.</span>
            {entry.text}
          </a>
        </li>
      ))}
    </ol>
  );
}

/** Article + BreadcrumbList for search engines and AI search (only for real, published items). */
function ArticleJsonLd({ item, crumbs }: { item: ContentItem; crumbs: Crumb[] }) {
  const site = siteUrl();
  const url = item.canonicalUrl ?? `${site}${contentHref(item)}`;
  const image = item.socialImage ?? item.coverImage;
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": item.type === "news" ? "NewsArticle" : "Article",
        headline: item.title,
        description: item.seoDescription ?? item.excerpt,
        ...(image ? { image: [`${site}${image}`] } : {}),
        datePublished: item.publishedAt,
        dateModified: item.updatedAt,
        inLanguage: "sv-SE",
        ...(findCategory(item.category) ? { articleSection: findCategory(item.category)?.label } : {}),
        author:
          item.authorName === "Köpanalys"
            ? { "@type": "Organization", name: "Köpanalys", url: site }
            : { "@type": "Person", name: item.authorName },
        publisher: {
          "@type": "Organization",
          name: "Köpanalys",
          url: site,
          logo: { "@type": "ImageObject", url: `${site}/images/kopanalys-logo-mark.png` },
        },
        mainEntityOfPage: { "@type": "WebPage", "@id": url },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [{ label: "Start", href: ROUTES.home }, ...crumbs].map((crumb, i, all) => ({
          "@type": "ListItem",
          position: i + 1,
          name: crumb.label,
          ...(i < all.length - 1 && crumb.href ? { item: `${site}${crumb.href.split("#")[0]}` } : {}),
        })),
      },
    ],
  };
  // "<" escaped so text in the content can never close the script element.
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}
