import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { CookieSettingsLinkInline } from "@/components/CookieSettingsLinkInline";
import { FacebookIcon, InstagramIcon, MailIcon } from "@/components/icons";
import { LANDING_CONTAINER } from "@/components/landing/container";
import { ROUTES } from "@/components/site/navigation";

const COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Köpanalys",
    links: [
      { label: "Så fungerar det", href: ROUTES.saFungerarDet },
      { label: "Exempelrapport", href: ROUTES.exempelrapport },
      { label: "Kontakt", href: ROUTES.kontakt },
    ],
  },
  {
    title: "Bostadsanalys",
    links: [
      { label: "Karta", href: ROUTES.karta },
      { label: "Skapa analys", href: ROUTES.skapaAnalys },
      { label: "Områden", href: ROUTES.omraden },
      { label: "Prisutveckling", href: ROUTES.prisutveckling },
      { label: "Priser", href: ROUTES.priser },
    ],
  },
  {
    title: "Kunskap",
    links: [
      { label: "Blogg", href: ROUTES.blogg },
      { label: "Nyheter", href: ROUTES.nyheter },
      { label: "Guider", href: ROUTES.guider },
    ],
  },
  {
    title: "Support",
    links: [
      { label: "Vanliga frågor", href: ROUTES.faq },
      { label: "Mitt konto", href: "/dashboard" },
      { label: "Köp analyser", href: ROUTES.kop },
    ],
  },
];

const LEGAL_LINKS = [
  { label: "Integritetspolicy", href: ROUTES.integritetspolicy },
  { label: "Användarvillkor", href: ROUTES.villkor },
];

/** Global footer (every page). Deep green, so it closes both the cream public pages and the dark app pages. */
export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-ka-green-950 text-white">
      <div className={LANDING_CONTAINER}>
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 py-16 sm:grid-cols-4 lg:grid-cols-[1.5fr_repeat(4,minmax(0,1fr))] lg:gap-12 lg:py-20">
          <div className="col-span-2 sm:col-span-4 lg:col-span-1">
            <Link
              href={ROUTES.home}
              aria-label="Köpanalys – till startsidan"
              className="inline-flex rounded-lg transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ka-mint"
            >
              <BrandLogo className="text-[22px]" markClassName="h-11 w-11" markSizes="44px" />
            </Link>
            <p className="mt-5 max-w-[300px] text-[14px] leading-relaxed text-white/65">
              Köpa bostad? Vi visar vad du faktiskt köper – föreningens ekonomi, området och alla kostnader.
            </p>
            <a
              href="mailto:kontakt@kopanalys.se"
              className="mt-5 inline-flex items-center gap-2 text-[14px] font-medium text-white/80 transition hover:text-white"
            >
              <MailIcon className="h-4 w-4 text-ka-mint" />
              kontakt@kopanalys.se
            </a>
            <div className="mt-5 flex items-center gap-2">
              <a
                href="https://www.facebook.com/profile.php?id=61592039229644&locale=sv_SE"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Köpanalys på Facebook"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-white/70 transition hover:border-ka-mint/50 hover:text-ka-mint"
              >
                <FacebookIcon className="h-4 w-4" />
              </a>
              <a
                href="https://www.instagram.com/kopanalys/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Köpanalys på Instagram"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-white/70 transition hover:border-ka-mint/50 hover:text-ka-mint"
              >
                <InstagramIcon className="h-4 w-4" />
              </a>
            </div>
          </div>

          {COLUMNS.map(({ title, links }) => (
            <nav key={title} aria-label={title}>
              <h2 className="mb-4 text-[12px] font-semibold uppercase tracking-[0.12em] text-ka-mint/85">{title}</h2>
              <ul className="flex flex-col gap-3">
                {links.map(({ label, href }) => (
                  <li key={label}>
                    <Link href={href} className="text-[14.5px] text-white/75 transition hover:text-white">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="flex flex-col gap-4 border-t border-white/10 py-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[12.5px] text-white/55">&copy; {year} Köpanalys. Org.nr 9811048793</p>
          <ul className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {LEGAL_LINKS.map(({ label, href }) => (
              <li key={label}>
                <Link href={href} className="text-[12.5px] text-white/55 underline-offset-2 transition hover:text-white hover:underline">
                  {label}
                </Link>
              </li>
            ))}
            <li>
              <CookieSettingsLinkInline />
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
