import type { Metadata } from "next";
import Link from "next/link";
import { ArticleCard } from "@/components/kunskap/ArticleCard";
import { LANDING_CONTAINER } from "@/components/landing/container";
import { CtaBand } from "@/components/site/CtaBand";
import { PageHero } from "@/components/site/PageHero";
import { ROUTES } from "@/components/site/navigation";
import { ArrowRightIcon, NewspaperIcon, NotepadIcon } from "@/components/icons";
import { articlesOfKind } from "@/lib/kunskap/articles";

export const metadata: Metadata = {
  title: "Blogg – tips, guider och analyser",
  description: "Det som är bra att veta när du ska köpa bostad: föreningens ekonomi, kostnaderna som inte står i annonsen och hur räntan påverkar avgiften.",
  alternates: { canonical: ROUTES.blogg },
};

export default function BloggPage() {
  const [featured, ...posts] = articlesOfKind("blogg");
  const guides = articlesOfKind("guide");

  return (
    <>
      <PageHero
        icon={NotepadIcon}
        eyebrow="Blogg"
        title="Tips, guider och analyser"
        lead="Det som är bra att veta när du ska köpa bostad – föreningens ekonomi, kostnaderna som inte står i annonsen och hur räntan påverkar din avgift."
        crumbs={[{ label: "Kunskap" }, { label: "Blogg" }]}
      />

      <section aria-labelledby="posts-title" className="bg-ka-cream">
        <div className={`${LANDING_CONTAINER} py-14 lg:py-20`}>
          <h2 id="posts-title" className="sr-only">
            Artiklar
          </h2>
          <div className="grid gap-5 lg:grid-cols-3">
            {featured && (
              <div className="lg:col-span-2 lg:row-span-2">
                <ArticleCard article={featured} featured />
              </div>
            )}
            {posts.map((post) => (
              <ArticleCard key={post.slug} article={post} />
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="guides-title" className="border-y border-ka-line bg-ka-sand">
        <div className={`${LANDING_CONTAINER} py-14 lg:py-20`}>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 id="guides-title" className="font-display text-[30px] font-bold text-ka-ink sm:text-[36px]">
                Guider
              </h2>
              <p className="mt-2 text-[16px] text-ka-muted">Steg för steg till ett tryggare köp.</p>
            </div>
            <Link href={ROUTES.guider} className="group inline-flex items-center gap-2 text-[15px] font-semibold text-ka-green-700 hover:text-ka-green-900">
              Alla guider
              <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {guides.map((guide) => (
              <ArticleCard key={guide.slug} article={guide} />
            ))}
          </div>
        </div>
      </section>

      <section className="bg-ka-cream">
        <div className={`${LANDING_CONTAINER} pt-14 lg:pt-20`}>
          <Link
            href={ROUTES.nyheter}
            className="group flex flex-col gap-4 rounded-[22px] border border-ka-line bg-white p-6 transition hover:border-ka-green-700/30 sm:flex-row sm:items-center sm:justify-between sm:p-8"
          >
            <span className="flex items-center gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-ka-green-800 text-white">
                <NewspaperIcon className="h-6 w-6" />
              </span>
              <span>
                <span className="block text-[18px] font-bold text-ka-ink">Nyheter om bostadsmarknaden</span>
                <span className="mt-0.5 block text-[15px] text-ka-muted">Räntor, priser och beslut som påverkar din nästa bostad.</span>
              </span>
            </span>
            <span className="inline-flex items-center gap-2 text-[15px] font-semibold text-ka-green-700">
              Till nyheterna
              <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </span>
          </Link>
        </div>
      </section>

      <CtaBand />
    </>
  );
}
