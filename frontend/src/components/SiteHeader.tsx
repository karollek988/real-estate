"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AuthModal } from "@/components/AuthModal";
import { BrandLogo } from "@/components/BrandLogo";
import { OnboardingModal } from "@/components/OnboardingModal";
import { DesktopNav } from "@/components/header/DesktopNav";
import { HeaderSearch } from "@/components/header/HeaderSearch";
import { MobileNav } from "@/components/header/MobileNav";
import { UserMenu } from "@/components/header/UserMenu";
import { HEADER_THEME, type SiteHeaderVariant } from "@/components/header/theme";
import { ChevronRightIcon, FilePlusIcon, MenuIcon } from "@/components/icons";
import { LANDING_CONTAINER } from "@/components/landing/container";
import { ROUTES } from "@/components/site/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import { FOCUS_URL_INPUT_EVENT, OPEN_ONBOARDING_MODAL_EVENT } from "@/lib/onboardingModalEvents";

export type { SiteHeaderVariant };

/** Which popover is open; only one at a time. A menu is open under its id ("bostadsanalys", "kunskap"). */
type OpenPopover = string | "search" | "user" | null;

/**
 * The site header, after docs/design/landing-2026-10/New-Header-Design.png:
 * logo, the main navigation with the Bostadsanalys and Kunskap menus, search
 * (on the map), "Skapa analys" and the profile button. From xl down the
 * navigation moves into a full-screen menu (MobileNav).
 */
export function SiteHeader({ variant = "dark" }: { variant?: SiteHeaderVariant }) {
  const theme = HEADER_THEME[variant];
  const router = useRouter();
  // Typed nullable since src/pages/ (the admin portal) exists; never null in the App Router.
  const pathname = usePathname() ?? "/";
  const { user, signOut } = useAuth();
  const [openPopover, setOpenPopover] = useState<OpenPopover>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  // A new page closes whatever was open (state adjusted during render, not in an effect).
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setOpenPopover(null);
    setDrawerOpen(false);
  }

  const displayName =
    (user?.user_metadata?.full_name as string | undefined) || user?.email?.split("@")[0] || "";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // "Hur går det till?" next to the analysis form opens the step-by-step dialog.
  useEffect(() => {
    const onOpenOnboarding = () => setOnboardingOpen(true);
    window.addEventListener(OPEN_ONBOARDING_MODAL_EVENT, onOpenOnboarding);
    return () => window.removeEventListener(OPEN_ONBOARDING_MODAL_EVENT, onOpenOnboarding);
  }, []);

  async function handleSignOut() {
    await signOut();
    router.push(ROUTES.home);
  }

  const popoverSetter = (id: string) => (open: boolean) => setOpenPopover(open ? id : null);

  return (
    <>
      <a
        href="#main"
        className="sr-only z-[80] rounded-lg bg-ka-green-900 px-4 py-3 text-sm font-semibold text-white focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Hoppa till innehållet
      </a>
      <header
        className={`sticky top-0 z-50 border-b backdrop-blur-xl transition-shadow duration-300 ${theme.bar} ${
          scrolled ? theme.barScrolled : ""
        }`}
      >
        {variant === "light" && (
          // Faint topographic contours behind the right half, as in the design reference.
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-[48%] hidden w-[640px] overflow-hidden bg-[url('/images/header-contours.svg')] bg-[length:640px_80px] bg-no-repeat opacity-50 lg:block"
          />
        )}
        <div className={`relative flex h-16 items-center gap-3 lg:h-[76px] xl:gap-4 2xl:h-[84px] ${LANDING_CONTAINER}`}>
          <Link
            href={ROUTES.home}
            aria-label="Köpanalys – till startsidan"
            className={`-ml-1 flex shrink-0 items-center rounded-xl p-1 transition-opacity hover:opacity-85 ${theme.logo} ${theme.focusRing}`}
          >
            <BrandLogo
              className="text-[19px] sm:text-[21px] 2xl:text-[23px]"
              markClassName="h-10 w-10 lg:h-11 lg:w-11 2xl:h-[52px] 2xl:w-[52px]"
              markSizes="52px"
            />
          </Link>

          <DesktopNav
            pathname={pathname}
            theme={theme}
            openMenu={openPopover !== "search" && openPopover !== "user" ? openPopover : null}
            onOpenMenuChange={(id) => setOpenPopover(id)}
            className="ml-2 hidden h-full xl:flex"
          />

          <div className="ml-auto flex items-center gap-1.5 sm:gap-2.5 2xl:gap-3">
            <HeaderSearch theme={theme} open={openPopover === "search"} onOpenChange={popoverSetter("search")} />
            <span aria-hidden className={`hidden h-8 w-px xl:block ${theme.divider}`} />
            <Link
              href={ROUTES.skapaAnalys}
              onClick={(e) => {
                // On the landing page the analysis form is a few sections down: go there instead of leaving.
                if (pathname !== ROUTES.home || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                e.preventDefault();
                window.dispatchEvent(new Event(FOCUS_URL_INPUT_EVENT));
              }}
              className={`group hidden h-11 items-center gap-2.5 whitespace-nowrap rounded-[11px] px-4 text-[15px] font-semibold transition-all duration-200 hover:-translate-y-px sm:inline-flex 2xl:h-12 2xl:px-5 2xl:text-[16px] ${theme.cta} ${theme.focusRing}`}
            >
              <FilePlusIcon className="h-5 w-5 2xl:h-[22px] 2xl:w-[22px]" />
              Skapa analys
              <ChevronRightIcon
                className="-mr-1 h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
                strokeWidth={2.4}
              />
            </Link>
            <div className="hidden xl:block">
              <UserMenu
                theme={theme}
                displayName={displayName}
                signedIn={Boolean(user)}
                open={openPopover === "user"}
                onOpenChange={popoverSetter("user")}
                onSignIn={() => setAuthOpen(true)}
                onSignOut={handleSignOut}
              />
            </div>
            <button
              ref={menuButtonRef}
              type="button"
              onClick={() => {
                setOpenPopover(null);
                setDrawerOpen(true);
              }}
              aria-label="Öppna meny"
              aria-haspopup="dialog"
              aria-expanded={drawerOpen}
              className={`-mr-1.5 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full transition xl:hidden ${theme.iconButton} ${theme.focusRing}`}
            >
              <MenuIcon className="h-7 w-7" />
            </button>
          </div>
        </div>
      </header>

      {drawerOpen && (
        <MobileNav
          theme={theme}
          pathname={pathname}
          signedIn={Boolean(user)}
          displayName={displayName}
          returnFocusRef={menuButtonRef}
          onClose={() => setDrawerOpen(false)}
          onSignIn={() => setAuthOpen(true)}
          onSignOut={handleSignOut}
        />
      )}
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
      <OnboardingModal open={onboardingOpen} onClose={() => setOnboardingOpen(false)} />
    </>
  );
}
