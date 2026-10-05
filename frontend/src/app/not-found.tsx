import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { LANDING_CONTAINER } from "@/components/landing/container";
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/site/PageHero";
import { ROUTES } from "@/components/site/navigation";
import { displaySerif } from "@/lib/fonts";

export const metadata: Metadata = {
  title: "Sidan finns inte",
};

/** Every unknown address, and every notFound() (an article that doesn't exist). Renders its own header: it sits outside the (site) layout. */
export default function NotFound() {
  return (
    <div className={`${displaySerif.variable} min-h-screen bg-ka-cream text-ka-text`}>
      <SiteHeader variant="light" />
      <main id="main" className={`${LANDING_CONTAINER} py-20 sm:py-28`}>
        <p className="text-[13px] font-semibold uppercase tracking-[0.1em] text-ka-green-700">Fel 404</p>
        <h1 className="mt-4 font-display text-[40px] font-bold leading-[1.05] tracking-[-0.02em] text-ka-ink sm:text-[56px]">
          Sidan finns inte
        </h1>
        <p className="mt-5 max-w-[520px] text-[17px] leading-relaxed text-ka-muted">
          Länken kan vara felskriven, eller så har sidan flyttats. Här är några vägar vidare.
        </p>
        <div className="mt-9 flex flex-col gap-3 sm:flex-row">
          <Link href={ROUTES.home} className={PRIMARY_BUTTON}>
            Till startsidan
          </Link>
          <Link href={ROUTES.skapaAnalys} className={SECONDARY_BUTTON}>
            Skapa analys
          </Link>
          <Link href={ROUTES.kontakt} className={SECONDARY_BUTTON}>
            Kontakta oss
          </Link>
        </div>
      </main>
    </div>
  );
}
