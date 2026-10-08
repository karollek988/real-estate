import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { BrandLogo } from "@/components/BrandLogo";
import { CookieSettingsLinkInline } from "@/components/CookieSettingsLinkInline";
import { FacebookIcon, GlobeIcon, InstagramIcon, MailIcon } from "@/components/icons";
import { LanguageLinks } from "@/components/LanguageSwitcher";
import { LANDING_CONTAINER } from "@/components/landing/container";
import { ROUTES } from "@/components/site/navigation";
import { LOCALES, type AppLocale } from "@/i18n/locales";

/** The footer's link columns. Each text is named by its key in the "footer" messages. */
const COLUMNS = [
  {
    id: "company",
    title: "columns.company.title",
    links: [
      { key: "columns.company.saFungerarDet", href: ROUTES.saFungerarDet },
      { key: "columns.company.exempelrapport", href: ROUTES.exempelrapport },
      { key: "columns.company.kontakt", href: ROUTES.kontakt },
    ],
  },
  {
    id: "analysis",
    title: "columns.analysis.title",
    links: [
      { key: "columns.analysis.karta", href: ROUTES.karta },
      { key: "columns.analysis.skapaAnalys", href: ROUTES.skapaAnalys },
      { key: "columns.analysis.omraden", href: ROUTES.omraden },
      { key: "columns.analysis.prisutveckling", href: ROUTES.prisutveckling },
      { key: "columns.analysis.priser", href: ROUTES.priser },
    ],
  },
  {
    id: "knowledge",
    title: "columns.knowledge.title",
    links: [
      { key: "columns.knowledge.bostadsguiden", href: ROUTES.bostadsguiden },
      { key: "columns.knowledge.insikter", href: ROUTES.insikter },
      { key: "columns.knowledge.nyheter", href: ROUTES.nyheter },
    ],
  },
  {
    id: "support",
    title: "columns.support.title",
    links: [
      { key: "columns.support.faq", href: ROUTES.faq },
      { key: "columns.support.konto", href: ROUTES.konto },
      { key: "columns.support.kop", href: ROUTES.kop },
    ],
  },
] as const;

const LEGAL_LINKS = [
  { key: "legal.privacy", href: ROUTES.integritetspolicy },
  { key: "legal.terms", href: ROUTES.villkor },
] as const;

const ORG_NUMBER = "9811048793";

/** Global footer (every page). Deep green, so it closes both the cream public pages and the dark app pages. */
export async function SiteFooter() {
  const t = await getTranslations("footer");
  const tLanguage = await getTranslations("common.languageSwitcher");
  const locale = (await getLocale()) as AppLocale;
  const year = new Date().getFullYear();

  return (
    <footer className="bg-ka-green-950 text-white">
      <div className={LANDING_CONTAINER}>
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 py-16 sm:grid-cols-4 lg:grid-cols-[1.5fr_repeat(4,minmax(0,1fr))] lg:gap-12 lg:py-20">
          <div className="col-span-2 sm:col-span-4 lg:col-span-1">
            <Link
              href={ROUTES.home}
              aria-label={t("homeLabel")}
              className="inline-flex rounded-lg transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ka-mint"
            >
              <BrandLogo className="text-[22px]" markClassName="h-11 w-11" markSizes="44px" />
            </Link>
            <p className="mt-5 max-w-[300px] text-[14px] leading-relaxed text-white/65">
              {t("tagline")}
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
                href={`https://www.facebook.com/profile.php?id=61592039229644&locale=${LOCALES[locale].ogLocale}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t("facebookLabel")}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-white/70 transition hover:border-ka-mint/50 hover:text-ka-mint"
              >
                <FacebookIcon className="h-4 w-4" />
              </a>
              <a
                href="https://www.instagram.com/kopanalys/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t("instagramLabel")}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-white/70 transition hover:border-ka-mint/50 hover:text-ka-mint"
              >
                <InstagramIcon className="h-4 w-4" />
              </a>
            </div>
          </div>

          {COLUMNS.map(({ id, title, links }) => (
            <nav key={id} aria-label={t(title)}>
              <h2 className="mb-4 text-[12px] font-semibold uppercase tracking-[0.12em] text-ka-mint/85">{t(title)}</h2>
              <ul className="flex flex-col gap-3">
                {links.map((link) => (
                  <li key={link.key}>
                    <Link href={link.href} className="text-[14.5px] text-white/75 transition hover:text-white">
                      {t(link.key)}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="flex flex-col gap-4 border-t border-white/10 py-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[12.5px] text-white/55">{t("copyright", { year, orgNumber: ORG_NUMBER })}</p>
          <div className="flex flex-col gap-x-8 gap-y-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2 text-[12.5px] text-white/55">
              <GlobeIcon className="h-4 w-4 text-ka-mint" aria-hidden />
              <span className="sr-only">{tLanguage("label")}</span>
              <LanguageLinks
                itemClassName="text-white/55 underline-offset-2 transition hover:text-white hover:underline"
                currentClassName="font-semibold text-white/85"
              />
            </div>
            <ul className="flex flex-wrap items-center gap-x-5 gap-y-2">
              {LEGAL_LINKS.map(({ key, href }) => (
                <li key={key}>
                  <Link href={href} className="text-[12.5px] text-white/55 underline-offset-2 transition hover:text-white hover:underline">
                    {t(key)}
                  </Link>
                </li>
              ))}
              <li>
                <CookieSettingsLinkInline />
              </li>
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
}
