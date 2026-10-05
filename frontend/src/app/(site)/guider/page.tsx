import type { Metadata } from "next";
import Link from "next/link";
import { ArticleCard } from "@/components/kunskap/ArticleCard";
import { LANDING_CONTAINER } from "@/components/landing/container";
import { CtaBand } from "@/components/site/CtaBand";
import { PageHero } from "@/components/site/PageHero";
import { ROUTES } from "@/components/site/navigation";
import { ArrowRightIcon, LightbulbIcon } from "@/components/icons";
import { articlesOfKind } from "@/lib/kunskap/articles";

export const metadata: Metadata = {
  title: "Guider – steg för steg till ett tryggare köp",
  description: "Guider för dig som ska köpa bostad: köpprocessen steg för steg, föreningens ekonomi och vad du ska titta efter på visningen.",
  alternates: { canonical: ROUTES.guider },
};

export default function GuiderPage() {
  const guides = articlesOfKind("guide");
  const posts = articlesOfKind("blogg");

  return (
    <>
      <PageHero
        icon={LightbulbIcon}
        eyebrow="Guider"
        title="Steg för steg till ett tryggare köp"
        lead="Från lånelöfte till tillträde: guider som hjälper dig att förstå föreningen, området och kostnaderna innan du lägger bud."
        crumbs={[{ label: "Kunskap" }, { label: "Guider" }]}
      />

      <section aria-labelledby="guides-list-title" className="bg-ka-cream">
        <div className={`${LANDING_CONTAINER} py-14 lg:py-20`}>
          <h2 id="guides-list-title" className="sr-only">
            Alla guider
          </h2>
          <ol className="grid gap-5 md:grid-cols-3">
            {guides.map((guide, i) => (
              <li key={guide.slug}>
                <ArticleCard article={guide} step={i + 1} />
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="more-title" className="border-y border-ka-line bg-ka-sand">
        <div className={`${LANDING_CONTAINER} py-14 lg:py-20`}>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 id="more-title" className="font-display text-[30px] font-bold text-ka-ink sm:text-[36px]">
                Från bloggen
              </h2>
              <p className="mt-2 text-[16px] text-ka-muted">Tips och analyser om föreningar, räntor och kostnader.</p>
            </div>
            <Link href={ROUTES.blogg} className="group inline-flex items-center gap-2 text-[15px] font-semibold text-ka-green-700 hover:text-ka-green-900">
              Till bloggen
              <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {posts.map((post) => (
              <ArticleCard key={post.slug} article={post} />
            ))}
          </div>
        </div>
      </section>

      <CtaBand />
    </>
  );
}
