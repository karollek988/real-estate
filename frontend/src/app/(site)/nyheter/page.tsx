import type { Metadata } from "next";
import Link from "next/link";
import { LANDING_CONTAINER } from "@/components/landing/container";
import { GuideCard } from "@/components/kunskap/GuideCard";
import { NewsSection } from "@/components/sections/NewsSection";
import { CtaBand } from "@/components/site/CtaBand";
import { PageHero } from "@/components/site/PageHero";
import { ROUTES } from "@/components/site/navigation";
import { ArrowRightIcon, BarChartIcon, LightbulbIcon, NewspaperIcon } from "@/components/icons";
import { listPublishedContent } from "@/lib/content/repository";

// Our own news items (from /admin/content) appear within five minutes, at once when the editor publishes.
export const revalidate = 300;

export const metadata: Metadata = {
  title: "Nyheter om bostadsmarknaden",
  description: "Senaste nytt om räntor, bostadspriser och beslut som påverkar din nästa bostad – från Riksbanken, SVT och Dagens industri.",
  alternates: { canonical: ROUTES.nyheter },
};

const NEXT_STEPS = [
  { icon: BarChartIcon, title: "Prisutveckling", text: "Styrränta, bostadspriser och inflation i siffror.", href: ROUTES.prisutveckling },
  { icon: LightbulbIcon, title: "Bostadsguiden", text: "Förstå bostadsköpet – ekonomi, kostnader, områden och risker.", href: ROUTES.bostadsguiden },
];

export default async function NyheterPage() {
  const ownNews = await listPublishedContent("news");

  return (
    <>
      <PageHero
        icon={NewspaperIcon}
        eyebrow="Nyheter"
        title="Nyheter om bostadsmarknaden"
        lead="Räntor, priser och beslut som påverkar din nästa bostad – de senaste uppdateringarna, samlade på ett ställe."
        crumbs={[{ label: "Kunskap" }, { label: "Nyheter" }]}
      />
      {ownNews.length > 0 && (
        <section aria-labelledby="own-news-title" className="bg-ka-cream">
          <div className={`${LANDING_CONTAINER} pt-14 lg:pt-20`}>
            <h2 id="own-news-title" className="font-display text-[30px] font-bold text-ka-ink sm:text-[36px]">
              Från Köpanalys
            </h2>
            <ul className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3 lg:gap-7">
              {ownNews.slice(0, 6).map((item) => (
                <li key={item.id}>
                  <GuideCard item={item} />
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
      <NewsSection />
      <section aria-label="Mer att läsa" className="bg-ka-cream">
        <div className={`${LANDING_CONTAINER} grid gap-4 md:grid-cols-2`}>
          {NEXT_STEPS.map(({ icon: Icon, title, text, href }) => (
            <Link
              key={href}
              href={href}
              className="group flex items-center gap-4 rounded-[22px] border border-ka-line bg-white p-6 transition hover:-translate-y-0.5 hover:border-ka-green-700/30"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-ka-green-800 text-white">
                <Icon className="h-6 w-6" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[17px] font-bold text-ka-ink">{title}</span>
                <span className="mt-0.5 block text-[14.5px] text-ka-muted">{text}</span>
              </span>
              <ArrowRightIcon className="h-5 w-5 text-ka-green-700 transition-transform group-hover:translate-x-1" />
            </Link>
          ))}
        </div>
      </section>
      <CtaBand />
    </>
  );
}
