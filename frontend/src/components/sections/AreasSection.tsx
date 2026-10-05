import Image from "next/image";
import Link from "next/link";
import { Reveal } from "@/components/Reveal";
import { LANDING_CONTAINER } from "@/components/landing/container";
import { ROUTES } from "@/components/site/navigation";
import { ArrowRightIcon, MapFoldIcon, MapPinIcon } from "@/components/icons";
import { AREA_TOPICS } from "@/components/sections/areaTopics";
import { AREA_ANALYSIS_PROMISE } from "@/lib/packages";
import { OMRADESANALYS_PRICE_SEK } from "@/lib/pricing";

/**
 * The landing page's "Områden": what the area analysis shows, with a preview
 * of the map (the laptop render that used to sit in the hero) leading to /karta.
 */
export function AreasSection() {
  return (
    <section id="omraden" aria-labelledby="omraden-title" className="relative scroll-mt-24 overflow-hidden bg-ka-sand">
      <div className={`${LANDING_CONTAINER} grid items-center gap-12 py-20 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-16 lg:py-28`}>
        <Reveal variant="left">
          <p className="inline-flex items-center gap-2 rounded-full bg-ka-sage/80 px-3.5 py-1.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-ka-green-900">
            <MapPinIcon className="h-4 w-4" />
            Områden
          </p>
          <h2
            id="omraden-title"
            className="mt-5 font-display text-[34px] font-bold leading-[1.08] tracking-[-0.015em] text-ka-ink sm:text-[44px]"
          >
            Lär känna området innan du lägger bud
          </h2>
          <p className="mt-4 max-w-[540px] text-[16px] leading-relaxed text-ka-muted sm:text-[17px]">
            Ange en adress så visar vi vad som finns runt den och hur området utvecklas. {AREA_ANALYSIS_PROMISE}
          </p>

          <ul className="mt-8 grid gap-x-6 gap-y-5 sm:grid-cols-2">
            {AREA_TOPICS.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-3.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-ka-green-800 ring-1 ring-ka-line">
                  <Icon className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-[15.5px] font-bold text-ka-ink">{title}</span>
                  <span className="mt-0.5 block text-[14px] leading-relaxed text-ka-muted">{text}</span>
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Link
              href={ROUTES.omraden}
              className="group inline-flex h-[52px] items-center justify-center gap-2.5 rounded-[12px] bg-ka-green-900 px-6 text-[15.5px] font-semibold text-white shadow-[0_14px_30px_-16px_rgba(12,42,31,0.9)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-ka-green-800"
            >
              Områdesanalys, {OMRADESANALYS_PRICE_SEK} kr
              <ArrowRightIcon className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-1" />
            </Link>
            <Link
              href={ROUTES.karta}
              className="inline-flex h-[52px] items-center justify-center gap-2.5 rounded-[12px] border-[1.5px] border-ka-green-900/30 bg-white px-6 text-[15.5px] font-semibold text-ka-ink transition-all duration-200 hover:-translate-y-0.5 hover:border-ka-green-900"
            >
              <MapFoldIcon className="h-5 w-5 text-ka-green-800" />
              Utforska kartan
            </Link>
          </div>
        </Reveal>

        <Reveal variant="right">
          <Link href={ROUTES.karta} className="group relative block" aria-label="Öppna kartan">
            <div className="hero-float [perspective:1800px]">
              <Image
                src="/images/hero-laptop.png"
                alt="Köpanalys-kartan med bostäder i Stockholm, visad på en laptop"
                width={1515}
                height={930}
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="h-auto w-full origin-bottom transition-transform duration-500 [transform:rotateX(8deg)] drop-shadow-[0_34px_44px_rgba(10,22,16,0.3)] group-hover:[transform:rotateX(4deg)]"
              />
            </div>
            <span className="absolute bottom-[6%] left-1/2 inline-flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full border border-white/70 bg-ka-paper/95 px-4 py-2 text-[13.5px] font-semibold text-ka-ink shadow-[0_14px_30px_-16px_rgba(15,31,24,0.6)] backdrop-blur transition group-hover:bg-white">
              <span className="rounded-full bg-ka-sage px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-ka-green-900">
                Förhandsversion
              </span>
              Se kartan
              <ArrowRightIcon className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </span>
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
