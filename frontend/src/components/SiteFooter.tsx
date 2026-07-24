"use client";

import Image from "next/image";
import Link from "next/link";
import { CookieSettingsLinkInline } from "@/components/CookieSettingsLinkInline";
import { FacebookIcon, InstagramIcon } from "@/components/icons";
import { OPEN_ONBOARDING_MODAL_EVENT } from "@/lib/onboardingModalEvents";

const PRODUKT_LINKS = [
  { label: "Startsida", href: "/" },
  { label: "Exempelrapport", href: "/#marknadsinsikter" },
  { label: "Priser", href: "/#analyze" },
  { label: "FAQ", href: "/#faq" },
];

const FORETAG_LINKS = [
  { label: "Villkor", href: "/terms" },
  { label: "Integritetspolicy", href: "/privacy" },
  { label: "Kontakt", href: "/contact" },
];

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-white/5 bg-[#0A0F0D]">
      <div className="mx-auto w-full max-w-[1400px] px-5 lg:px-6">
        <div className="grid grid-cols-1 gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4 lg:gap-12">
          {/* Brand column */}
          <div className="sm:col-span-2 lg:col-span-1">
            <Link href="/" className="flex items-center gap-3">
              <Image
                src="/kopanalys-bostad-logo.png"
                alt="Köpanalys"
                width={72}
                height={72}
                className="h-9 w-9 rounded-full"
              />
              <span className="text-lg font-semibold tracking-tight text-white">Köpanalys</span>
            </Link>
            <p className="mt-4 max-w-[260px] text-[14px] leading-relaxed text-neutral-400">
              Datadriven bostadsanalys — få en komplett bild av vilken bostad som helst innan du köper.
            </p>
          </div>

          {/* Produkt column */}
          <div>
            <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wider text-neutral-500">
              Produkt
            </h3>
            <ul className="flex flex-col gap-3">
              <li>
                <button
                  type="button"
                  onClick={() => window.dispatchEvent(new Event(OPEN_ONBOARDING_MODAL_EVENT))}
                  className="cursor-pointer text-[14px] text-neutral-300 transition hover:text-green-400"
                >
                  Så fungerar det
                </button>
              </li>
              {PRODUKT_LINKS.map(({ label, href }) => (
                <li key={label}>
                  <Link
                    href={href}
                    className="text-[14px] text-neutral-300 transition hover:text-green-400"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Företag column */}
          <div>
            <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wider text-neutral-500">
              Företag
            </h3>
            <ul className="flex flex-col gap-3">
              {FORETAG_LINKS.map(({ label, href }) => (
                <li key={label}>
                  <Link
                    href={href}
                    className="text-[14px] text-neutral-300 transition hover:text-green-400"
                  >
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
        <div className="flex flex-col items-center justify-between gap-3 border-t border-white/5 py-6 sm:flex-row">
          <p className="text-[12px] text-neutral-500">
            &copy; {year} Köpanalys. Org.nr 9811048793
          </p>
          <div className="flex items-center gap-3">
            <a
              href="https://www.facebook.com/profile.php?id=61592039229644&locale=sv_SE"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Köpanalys på Facebook"
              className="text-neutral-500 transition hover:text-green-400"
            >
              <FacebookIcon className="h-4 w-4" />
            </a>
            <a
              href="https://www.instagram.com/kopanalys/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Köpanalys på Instagram"
              className="text-neutral-500 transition hover:text-green-400"
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
