import Link from "next/link";
import { LANDING_CONTAINER } from "@/components/landing/container";
import { CtaBand } from "@/components/site/CtaBand";
import { PageHero } from "@/components/site/PageHero";
import { ROUTES } from "@/components/site/navigation";
import { ArrowRightIcon, CheckIcon, ClockIcon, InfoIcon, LightbulbIcon, NotepadIcon } from "@/components/icons";
import { ArticleCard } from "@/components/kunskap/ArticleCard";
import { ARTICLES, formatArticleDate, type Article, type ArticleBlock } from "@/lib/kunskap/articles";

function Block({ block }: { block: ArticleBlock }) {
  switch (block.type) {
    case "p":
      return <p className="text-[17px] leading-[1.75] text-ka-text">{block.text}</p>;
    case "h2":
      return <h2 className="pt-4 font-display text-[26px] font-bold leading-tight tracking-[-0.01em] text-ka-ink sm:text-[30px]">{block.text}</h2>;
    case "list": {
      const List = block.ordered ? "ol" : "ul";
      return (
        <List className="flex flex-col gap-3">
          {block.items.map((item, i) => (
            <li key={item} className="flex gap-3 text-[16.5px] leading-[1.65] text-ka-text">
              {block.ordered ? (
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ka-green-800 text-[13px] font-bold text-white">
                  {i + 1}
                </span>
              ) : (
                <span className="mt-1.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ka-sage text-ka-green-900">
                  <CheckIcon className="h-3 w-3" strokeWidth={2.6} />
                </span>
              )}
              <span>{item}</span>
            </li>
          ))}
        </List>
      );
    }
    case "figures":
      return (
        <dl className="divide-y divide-ka-line overflow-hidden rounded-[20px] border border-ka-line bg-white">
          {block.items.map(({ label, level, meaning }) => (
            <div key={label} className="grid gap-2 p-5 sm:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] sm:gap-6 sm:p-6">
              <dt>
                <span className="block text-[16px] font-bold text-ka-ink">{label}</span>
                <span className="mt-1 block text-[14.5px] leading-relaxed text-ka-muted">{meaning}</span>
              </dt>
              <dd className="rounded-xl bg-ka-cream px-4 py-3 text-[14.5px] leading-relaxed text-ka-text">{level}</dd>
            </div>
          ))}
        </dl>
      );
    case "example":
      return (
        <aside className="rounded-[20px] border border-ka-green-700/20 bg-ka-sage/40 p-6">
          <p className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.08em] text-ka-green-900">
            <LightbulbIcon className="h-4 w-4" />
            {block.title}
          </p>
          <p className="mt-3 text-[16px] leading-[1.7] text-ka-text">{block.text}</p>
        </aside>
      );
    case "callout":
      return (
        <aside className="rounded-[22px] bg-ka-green-950 p-7 text-white">
          <p className="font-display text-[22px] font-bold">{block.title}</p>
          <p className="mt-2 text-[15.5px] leading-relaxed text-white/75">{block.text}</p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
            <Link
              href={ROUTES.skapaAnalys}
              className="group inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-ka-cream px-5 text-[15px] font-semibold text-ka-green-950 transition hover:bg-white"
            >
              Skapa analys
              <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link href={ROUTES.exempelrapport} className="text-[15px] font-semibold text-ka-mint underline-offset-4 hover:text-white hover:underline">
              Se exempelrapporten
            </Link>
          </div>
        </aside>
      );
  }
}

/** An article (/blogg/[slug], /guider/[slug]): header, body, sources, more to read. */
export function ArticlePage({ article }: { article: Article }) {
  const isGuide = article.kind === "guide";
  const related = ARTICLES.filter((other) => other.slug !== article.slug)
    .sort((a, b) => Number(b.category === article.category) - Number(a.category === article.category))
    .slice(0, 3);

  return (
    <>
      <PageHero
        icon={isGuide ? LightbulbIcon : NotepadIcon}
        eyebrow={`${isGuide ? "Guide" : "Blogg"} · ${article.category}`}
        title={article.title}
        lead={
          <>
            <p>{article.excerpt}</p>
            <p className="mt-4 flex items-center gap-1.5 text-[14px] text-ka-muted">
              <ClockIcon className="h-4 w-4" />
              {article.readingMinutes} min läsning · Publicerad {formatArticleDate(article.publishedAt)}
            </p>
          </>
        }
        crumbs={[{ label: isGuide ? "Guider" : "Blogg", href: isGuide ? ROUTES.guider : ROUTES.blogg }, { label: article.title }]}
      />

      <article className="bg-ka-cream">
        <div className={`${LANDING_CONTAINER} py-14 lg:py-20`}>
          <div className="mx-auto flex max-w-[760px] flex-col gap-6">
            {article.body.map((block, i) => (
              <Block key={i} block={block} />
            ))}

            {article.sources && (
              <footer className="mt-4 rounded-[18px] border border-ka-line bg-white/70 p-5">
                <p className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.08em] text-ka-muted">
                  <InfoIcon className="h-4 w-4" />
                  Källor
                </p>
                <ul className="mt-2 flex flex-col gap-1 text-[14px] leading-relaxed text-ka-muted">
                  {article.sources.map((source) => (
                    <li key={source}>{source}</li>
                  ))}
                </ul>
              </footer>
            )}
          </div>
        </div>
      </article>

      <section aria-labelledby="related-title" className="border-t border-ka-line bg-ka-sand">
        <div className={`${LANDING_CONTAINER} py-14 lg:py-20`}>
          <h2 id="related-title" className="font-display text-[28px] font-bold text-ka-ink sm:text-[34px]">
            Läs vidare
          </h2>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {related.map((other) => (
              <ArticleCard key={other.slug} article={other} />
            ))}
          </div>
        </div>
      </section>

      <CtaBand />
    </>
  );
}
