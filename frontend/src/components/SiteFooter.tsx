"use client";

import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { CookieSettingsLinkInline } from "@/components/CookieSettingsLinkInline";
import { FacebookIcon, InstagramIcon } from "@/components/icons";
import { OPEN_ONBOARDING_MODAL_EVENT } from "@/lib/onboardingModalEvents";

const PRODUKT_LINKS = [
  { label: "Startsida", href: "/" },
  { label: "Exempelrapport", href: "/#example-report" },
  { label: "Priser", href: "/#priser" },
  { label: "FAQ", href: "/#faq" },
];

const FORETAG_LINKS = [
  { label: "Villkor", href: "/terms" },
  { label: "Integritetspolicy", href: "/privacy" },
  { label: "Kontakt", href: "/#contact" },
];

/** Global footer (every page). Deep green, so it closes both the cream landing page and the dark app pages. */
export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-ka-green-950 text-white">
      <div className="mx-auto w-full max-w-[1680px] px-5 sm:px-8 xl:px-12 2xl:px-[84px]">
        <div className="grid grid-cols-1 gap-10 py-16 sm:grid-cols-2 lg:grid-cols-4 lg:gap-12">
          {/* Brand column */}
          <div className="sm:col-span-2 lg:col-span-1">
            <Link href="/" aria-label="Köpanalys – till startsidan" className="inline-flex transition-opacity hover:opacity-80">
              <BrandLogo className="text-[22px]" markClassName="h-9 w-auto text-ka-mint" />
            </Link>
            <p className="mt-5 max-w-[280px] text-[14px] leading-relaxed text-white/60">
              Köpa bostad? Vi visar vad du faktiskt köper — föreningens ekonomi, området och alla kostnader.
            </p>
          </div>

          {/* Produkt column */}
          <div>
            <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-[0.12em] text-ka-mint/80">Produkt</h3>
            <ul className="flex flex-col gap-3">
              <li>
                <button
                  type="button"
                  onClick={() => window.dispatchEvent(new Event(OPEN_ONBOARDING_MODAL_EVENT))}
                  className="cursor-pointer text-[14.5px] text-white/75 transition hover:text-white"
                >
                  Så fungerar det
                </button>
              </li>
              {PRODUKT_LINKS.map(({ label, href }) => (
                <li key={label}>
                  <Link href={href} className="text-[14.5px] text-white/75 transition hover:text-white">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Företag column */}
          <div>
            <h3 className="mb-4 text-[12px] font-semibold uppercase tracking-[0.12em] text-ka-mint/80">Företag</h3>
            <ul className="flex flex-col gap-3">
              {FORETAG_LINKS.map(({ label, href }) => (
                <li key={label}>
                  <Link href={href} className="text-[14.5px] text-white/75 transition hover:text-white">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Spacer for alignment on large screens */}
          <div className="hidden lg:block" />
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col items-center justify-between gap-3 border-t border-white/10 py-6 sm:flex-row">
          <p className="text-[12.5px] text-white/50">
            &copy; {year} Köpanalys. Org.nr 9811048793
          </p>
          <div className="flex items-center gap-3">
            <a
              href="https://www.facebook.com/profile.php?id=61592039229644&locale=sv_SE"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Köpanalys på Facebook"
              className="text-white/50 transition hover:text-ka-mint"
            >
              <FacebookIcon className="h-4 w-4" />
            </a>
            <a
              href="https://www.instagram.com/kopanalys/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Köpanalys på Instagram"
              className="text-white/50 transition hover:text-ka-mint"
            >
              <InstagramIcon className="h-4 w-4" />
            </a>
          </div>
          <CookieSettingsLinkInline />
        </div>
      </div>
    </footer>
  );
}
