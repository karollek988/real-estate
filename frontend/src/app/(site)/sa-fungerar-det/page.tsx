import type { Metadata } from "next";
import Link from "next/link";
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
import { AREA_ANALYSIS_PROMISE, BRF_REVIEW_PROMISE } from "@/lib/packages";

export const metadata: Metadata = {
  title: "Så fungerar det",
  description:
    "Från annons till beslutsunderlag: ladda upp en skärmdump av annonsen, kontrollera uppgifterna och få föreningens ekonomi, området och kostnaderna i klartext.",
  alternates: { canonical: ROUTES.saFungerarDet },
};

/** What happens when you create an analysis - the same flow as the "Hur går det till?" dialog, in more detail. */
const FLOW = [
  {
    icon: UserIcon,
    title: "Skapa ett konto",
    text: "Registrera dig på några sekunder. Dina analyser sparas på ditt konto så att du kan gå tillbaka till dem.",
  },
  {
    icon: UploadCloudIcon,
    title: "Visa oss bostaden",
    text: "Ladda upp en eller flera skärmdumpar av annonsen – från vilken bostadssajt som helst – eller fyll i uppgifterna själv. För en områdesanalys räcker en adress.",
  },
  {
    icon: ClipboardIcon,
    title: "Kontrollera uppgifterna",
    text: "Vi läser av de viktigaste uppgifterna åt dig. Du granskar och rättar dem innan analysen startar.",
  },
  {
    icon: FileTextIcon,
    title: "Få din rapport",
    text: `Området, riskerna och frågorna inför visningen är klara på några minuter. ${BRF_REVIEW_PROMISE} Du får ett mejl när den är klar.`,
  },
];

/** The buyer's whole way, as the pitch deck puts it: Hitta → Analysera → Inspektera → Besluta. */
const JOURNEY = [
  { icon: MapFoldIcon, title: "Hitta", text: "Utforska bostäder, köpare och byten på kartan.", href: ROUTES.karta, cta: "Till kartan", note: "Förhandsversion" },
  { icon: SearchIcon, title: "Analysera", text: "Föreningens ekonomi, området och kostnaderna – i klartext.", href: ROUTES.skapaAnalys, cta: "Skapa analys" },
  { icon: ClipboardIcon, title: "Inspektera", text: "Frågorna att ställa och vad du ska titta efter på visningen.", href: "/guider/infor-visningen", cta: "Läs guiden" },
  { icon: TargetIcon, title: "Besluta", text: "Ett samlat underlag med allt som påverkar köpet.", href: ROUTES.exempelrapport, cta: "Se exempelrapporten" },
];

export default function SaFungerarDetPage() {
  return (
    <>
      <PageHero
        icon={ShieldIcon}
        eyebrow="Så fungerar det"
        title="Från annons till beslutsunderlag"
        lead="Vi står på köparens sida. Vi säljer inte bostaden och inte priset – vi samlar det som avgör köpet och förklarar det i klartext."
        crumbs={[{ label: "Så fungerar det" }]}
        actions={
          <>
            <Link href={ROUTES.skapaAnalys} className={PRIMARY_BUTTON}>
              <FilePlusIcon className="h-5 w-5" />
              Skapa analys
            </Link>
            <Link href={ROUTES.exempelrapport} className={SECONDARY_BUTTON}>
              <FileTextIcon className="h-5 w-5 text-ka-green-800" />
              Se exempelrapport
            </Link>
          </>
        }
      />

      <ProblemSection />

      <section aria-labelledby="steg-title" className="bg-ka-cream">
        <div className={`${LANDING_CONTAINER} grid gap-12 py-14 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16 lg:py-20`}>
          <div>
            <h2 id="steg-title" className="font-display text-[30px] font-bold leading-tight text-ka-ink sm:text-[38px]">
              Steg för steg
            </h2>
            <p className="mt-4 text-[16px] leading-relaxed text-ka-muted sm:text-[17px]">
              Att skapa en analys tar vanligtvis mindre än en minut. {AREA_ANALYSIS_PROMISE}
            </p>
            <Link href={ROUTES.priser} className="group mt-6 inline-flex items-center gap-2 text-[15px] font-semibold text-ka-green-700 hover:text-ka-green-900">
              Vad kostar det?
              <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
          <ol className="relative flex flex-col gap-4">
            <span aria-hidden className="absolute bottom-8 left-[27px] top-8 w-px bg-ka-green-700/20" />
            {FLOW.map(({ icon: Icon, title, text }, i) => (
              <li key={title} className="relative flex gap-5 rounded-[22px] border border-ka-line bg-white p-5 shadow-[0_18px_40px_-34px_rgba(15,31,24,0.45)] sm:p-6">
                <span className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-ka-green-800 text-white">
                  <Icon className="h-6 w-6" />
                  <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-ka-mint text-[12px] font-bold text-ka-green-950">
                    {i + 1}
                  </span>
                </span>
                <div className="pt-1">
                  <h3 className="text-[18px] font-bold text-ka-ink">{title}</h3>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-ka-muted">{text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <InfoSection />

      <section aria-labelledby="hela-vagen-title" className="bg-ka-cream">
        <div className={`${LANDING_CONTAINER} py-14 lg:py-20`}>
          <h2 id="hela-vagen-title" className="font-display text-[30px] font-bold text-ka-ink sm:text-[38px]">
            Med dig hela vägen
          </h2>
          <p className="mt-3 max-w-[620px] text-[16px] leading-relaxed text-ka-muted sm:text-[17px]">
            Från bostaden du hittar till beslutet du fattar.
          </p>
          <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {JOURNEY.map(({ icon: Icon, title, text, href, cta, note }, i) => (
              <li key={title}>
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
                  <h3 className="mt-5 text-[19px] font-bold text-ka-ink">{title}</h3>
                  <p className="mt-1.5 flex-1 text-[15px] leading-relaxed text-ka-muted">{text}</p>
                  <span className="mt-5 flex items-center gap-2 text-[14.5px] font-semibold text-ka-green-700">
                    {cta}
                    <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    {note && (
                      <span className="ml-auto rounded-full bg-ka-sage/70 px-2 py-0.5 text-[11px] font-semibold text-ka-green-900">{note}</span>
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
