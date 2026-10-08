import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LANDING_CONTAINER } from "@/components/landing/container";
import { InfoSection } from "@/components/sections/InfoSection";
import { ProblemSection } from "@/components/sections/ProblemSection";
import { CtaBand } from "@/components/site/CtaBand";
import { PageHero, PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/site/PageHero";
import { ROUTES } from "@/components/site/navigation";
import {
  ArrowRightIcon,
  ClipboardIcon,
  FilePlusIcon,
  FileTextIcon,
  MapFoldIcon,
  SearchIcon,
  ShieldIcon,
  TargetIcon,
  UploadCloudIcon,
  UserIcon,
} from "@/components/icons";
import { ClientMessages } from "@/i18n/ClientMessages";
import { pageLocale, type LocaleParams } from "@/i18n/page";
import { pageMetadata } from "@/i18n/seo";

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const locale = await pageLocale(params);
  const t = await getTranslations({ locale, namespace: "pages.howItWorks.meta" });
  return pageMetadata(locale, ROUTES.saFungerarDet, { title: t("title"), description: t("description") });
}

/** What happens when you create an analysis - the same flow as the "Hur går det till?" dialog, in more detail. The words: pages.howItWorks.flow.<id> */
const FLOW = [
  { icon: UserIcon, id: "account" },
  { icon: UploadCloudIcon, id: "show" },
  { icon: ClipboardIcon, id: "check" },
  { icon: FileTextIcon, id: "report" },
] as const;

/** The buyer's whole way, as the pitch deck puts it: Hitta → Analysera → Inspektera → Besluta. The words: pages.howItWorks.journey.<id> */
const JOURNEY = [
  { icon: MapFoldIcon, id: "find", href: ROUTES.karta, hasNote: true },
  { icon: SearchIcon, id: "analyse", href: ROUTES.skapaAnalys, hasNote: false },
  { icon: ClipboardIcon, id: "inspect", href: ROUTES.bostadsguiden, hasNote: false },
  { icon: TargetIcon, id: "decide", href: ROUTES.exempelrapport, hasNote: false },
] as const;

export default async function SaFungerarDetPage({ params }: LocaleParams) {
  await pageLocale(params);
  const t = await getTranslations("pages.howItWorks");
  const tNav = await getTranslations("nav");
  const tPackages = await getTranslations("packages");

  return (
    <>
      <PageHero
        icon={ShieldIcon}
        eyebrow={t("eyebrow")}
        title={t("title")}
        lead={t("lead")}
        crumbs={[{ label: tNav("entries.saFungerarDet") }]}
        actions={
          <>
            <Link href={ROUTES.skapaAnalys} className={PRIMARY_BUTTON}>
              <FilePlusIcon className="h-5 w-5" />
              {t("createAnalysis")}
            </Link>
            <Link href={ROUTES.exempelrapport} className={SECONDARY_BUTTON}>
              <FileTextIcon className="h-5 w-5 text-ka-green-800" />
              {t("exampleReport")}
            </Link>
          </>
        }
      />

      <ClientMessages areas={["sections"]}>
        <ProblemSection />
      </ClientMessages>

      <section aria-labelledby="steg-title" className="bg-ka-cream">
        <div className={`${LANDING_CONTAINER} grid gap-12 py-14 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16 lg:py-20`}>
          <div>
            <h2 id="steg-title" className="font-display text-[30px] font-bold leading-tight text-ka-ink sm:text-[38px]">
              {t("steps.title")}
            </h2>
            <p className="mt-4 text-[16px] leading-relaxed text-ka-muted sm:text-[17px]">
              {t("steps.lead", { areaPromise: tPackages("areaPromise") })}
            </p>
            <Link href={ROUTES.priser} className="group mt-6 inline-flex items-center gap-2 text-[15px] font-semibold text-ka-green-700 hover:text-ka-green-900">
              {t("steps.price")}
              <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
          <ol className="relative flex flex-col gap-4">
            <span aria-hidden className="absolute bottom-8 left-[27px] top-8 w-px bg-ka-green-700/20" />
            {FLOW.map(({ icon: Icon, id }, i) => (
              <li key={id} className="relative flex gap-5 rounded-[22px] border border-ka-line bg-white p-5 shadow-[0_18px_40px_-34px_rgba(15,31,24,0.45)] sm:p-6">
                <span className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-ka-green-800 text-white">
                  <Icon className="h-6 w-6" />
                  <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-ka-mint text-[12px] font-bold text-ka-green-950">
                    {i + 1}
                  </span>
                </span>
                <div className="pt-1">
                  <h3 className="text-[18px] font-bold text-ka-ink">{t(`flow.${id}.title`)}</h3>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-ka-muted">
                    {id === "report" ? t("flow.report.text", { reviewPromise: tPackages("reviewPromise") }) : t(`flow.${id}.text`)}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <ClientMessages areas={["sections"]}>
        <InfoSection />
      </ClientMessages>

      <section aria-labelledby="hela-vagen-title" className="bg-ka-cream">
        <div className={`${LANDING_CONTAINER} py-14 lg:py-20`}>
          <h2 id="hela-vagen-title" className="font-display text-[30px] font-bold text-ka-ink sm:text-[38px]">
            {t("journey.title")}
          </h2>
          <p className="mt-3 max-w-[620px] text-[16px] leading-relaxed text-ka-muted sm:text-[17px]">{t("journey.lead")}</p>
          <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {JOURNEY.map(({ icon: Icon, id, href, hasNote }, i) => (
              <li key={id}>
                <Link
                  href={href}
                  className="group flex h-full flex-col rounded-[22px] border border-ka-line bg-white p-6 transition hover:-translate-y-0.5 hover:border-ka-green-700/30"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-ka-green-800 text-white">
                      <Icon className="h-[22px] w-[22px]" />
                    </span>
                    <span className="font-display text-[22px] font-bold text-ka-ink/25">{i + 1}</span>
                  </div>
                  <h3 className="mt-5 text-[19px] font-bold text-ka-ink">{t(`journey.${id}.title`)}</h3>
                  <p className="mt-1.5 flex-1 text-[15px] leading-relaxed text-ka-muted">{t(`journey.${id}.text`)}</p>
                  <span className="mt-5 flex items-center gap-2 text-[14.5px] font-semibold text-ka-green-700">
                    {t(`journey.${id}.cta`)}
                    <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    {hasNote && (
                      <span className="ml-auto rounded-full bg-ka-sage/70 px-2 py-0.5 text-[11px] font-semibold text-ka-green-900">{t("journey.find.note")}</span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <CtaBand />
    </>
  );
}
