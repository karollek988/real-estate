import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ArrowRightIcon, CheckIcon, FilePlusIcon } from "@/components/icons";
import { LANDING_CONTAINER } from "@/components/landing/container";
import { ROUTES } from "@/components/site/navigation";
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/site/PageHero";
import { HandNote } from "./HandNote";

const INCLUDED = ["association", "area", "costs"] as const;

/**
 * Where reading turns into the product: the guides explain what matters, an
 * analysis shows how one particular home holds up. Closes Bostadsguiden and
 * every guide. Names what an analysis covers, never how it is worked out.
 * The words: kunskap.guides.cta
 */
export function GuideCta({ headingLevel = 2 }: { headingLevel?: 2 | 3 }) {
  const t = useTranslations("kunskap.guides.cta");
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <section aria-labelledby="guide-cta-title" className="bg-ka-cream py-14 lg:py-20">
      <div className={LANDING_CONTAINER}>
        <div className="grid overflow-hidden rounded-[32px] border border-ka-line-strong bg-ka-paper shadow-ka-card lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
          <div className="relative min-h-[260px] overflow-hidden bg-ka-sand sm:min-h-[320px]">
            <Image
              src="/images/bostadsguiden/gamla-stan-gata.jpg"
              alt={t("imageAlt")}
              fill
              sizes="(min-width: 1024px) 45vw, 100vw"
              className="object-cover object-[50%_40%]"
            />
            <div className="absolute bottom-5 left-5 right-5 max-w-[300px] rounded-[18px] border border-ka-line-strong bg-white/95 p-5 shadow-ka-card sm:bottom-7 sm:left-7">
              <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-ka-green-700">{t("included.title")}</p>
              <ul className="mt-3 flex flex-col gap-2.5">
                {INCLUDED.map((id) => (
                  <li key={id} className="flex items-center gap-2.5 text-[15px] font-semibold text-ka-ink">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ka-green-900 text-white">
                      <CheckIcon className="h-3.5 w-3.5" strokeWidth={2.6} />
                    </span>
                    {t(`included.${id}`)}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="relative flex flex-col justify-center p-7 sm:p-10 lg:p-14">
            <p className="text-[12.5px] font-bold uppercase tracking-[0.16em] text-ka-green-700">{t("eyebrow")}</p>
            <Heading
              id="guide-cta-title"
              className="mt-4 font-display text-[30px] font-bold leading-[1.08] tracking-[-0.02em] text-ka-ink sm:text-[40px] xl:text-[46px]"
            >
              {t("title")}
            </Heading>
            <p className="mt-5 max-w-[560px] text-[16.5px] leading-[1.65] text-ka-muted sm:text-[17.5px]">{t("text")}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <Link href={ROUTES.skapaAnalys} className={PRIMARY_BUTTON}>
                <FilePlusIcon className="h-5 w-5" />
                {t("create")}
                <ArrowRightIcon className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-1" />
              </Link>
              <Link href={ROUTES.exempelrapport} className={SECONDARY_BUTTON}>
                {t("example")}
              </Link>
            </div>
            <HandNote arrow="left" className="mt-5 hidden max-w-[340px] sm:flex">
              {t("handNote")}
            </HandNote>
          </div>
        </div>
      </div>
    </section>
  );
}
