import {
  BarChartIcon,
  BookOpenIcon,
  FilePlusIcon,
  HouseIcon,
  LightbulbIcon,
  MapFoldIcon,
  MapPinIcon,
  NewspaperIcon,
  TagIcon,
  TrendingUpIcon,
} from "@/components/icons";

import type { Href } from "@/i18n/navigation";

export type NavIcon = React.ComponentType<React.SVGProps<SVGSVGElement>>;

/**
 * Every public destination in one place, so the header, the footer and the
 * page CTAs can never point at different URLs. The values are the pages' internal
 * addresses (the folder names under src/app/[locale]); what a visitor sees in the
 * address bar in each language is set in src/i18n/pathnames.ts, and <Link> does the
 * translation. The older app routes (/buy, /privacy, /terms, /dashboard) keep theirs.
 */
export const ROUTES = {
  home: "/",
  karta: "/karta",
  skapaAnalys: "/skapa-analys",
  prisutveckling: "/prisutveckling",
  omraden: "/omraden",
  priser: "/priser",
  bostadsguiden: "/bostadsguider",
  insikter: "/insikter",
  nyheter: "/nyheter",
  saFungerarDet: "/sa-fungerar-det",
  kontakt: "/kontakt",
  faq: { pathname: "/", hash: "faq" },
  exempelrapport: { pathname: "/", hash: "exempelrapport" },
  kop: "/buy",
  konto: "/dashboard",
  integritetspolicy: "/privacy",
  villkor: "/terms",
} as const;

/**
 * An item in one of the header's two menus. The words ("label", "description") are in the message files,
 * under the item's `key` in the "nav" area: t(`${item.key}.label`).
 */
export interface NavMenuLink {
  key:
    | "menus.bostadsanalys.karta"
    | "menus.bostadsanalys.skapaAnalys"
    | "menus.bostadsanalys.prisutveckling"
    | "menus.kunskap.bostadsguiden"
    | "menus.kunskap.insikter"
    | "menus.kunskap.nyheter";
  href: Href;
  icon: NavIcon;
}

/** An entry of the main navigation: a plain link, or a menu (a button that opens a list of links). The words are in the "nav" area: t(`entries.${id}`). */
export type NavEntry =
  | { kind: "link"; id: "omraden" | "priser" | "saFungerarDet" | "kontakt"; href: Href; icon?: NavIcon }
  | { kind: "menu"; id: "bostadsanalys" | "kunskap"; icon: NavIcon; items: NavMenuLink[] };

// The menu item for market prices is called "Prisutveckling", not "Priser" as in
// the header reference: "Priser" is already the top-level link to what an
// analysis costs, and two "Priser" leading to different pages would confuse.
export const BOSTADSANALYS_MENU: NavMenuLink[] = [
  { key: "menus.bostadsanalys.karta", href: ROUTES.karta, icon: MapFoldIcon },
  { key: "menus.bostadsanalys.skapaAnalys", href: ROUTES.skapaAnalys, icon: FilePlusIcon },
  { key: "menus.bostadsanalys.prisutveckling", href: ROUTES.prisutveckling, icon: BarChartIcon },
];

// Kunskap (2026-10): Bostadsguiden replaced "Blogg" and "Guider" - the old
// /blogg and /guider addresses redirect there (next.config.ts).
export const KUNSKAP_MENU: NavMenuLink[] = [
  { key: "menus.kunskap.bostadsguiden", href: ROUTES.bostadsguiden, icon: LightbulbIcon },
  { key: "menus.kunskap.insikter", href: ROUTES.insikter, icon: TrendingUpIcon },
  { key: "menus.kunskap.nyheter", href: ROUTES.nyheter, icon: NewspaperIcon },
];

export const MAIN_NAV: NavEntry[] = [
  { kind: "menu", id: "bostadsanalys", icon: HouseIcon, items: BOSTADSANALYS_MENU },
  { kind: "link", id: "omraden", href: ROUTES.omraden, icon: MapPinIcon },
  { kind: "link", id: "priser", href: ROUTES.priser, icon: TagIcon },
  { kind: "menu", id: "kunskap", icon: BookOpenIcon, items: KUNSKAP_MENU },
  { kind: "link", id: "saFungerarDet", href: ROUTES.saFungerarDet },
  { kind: "link", id: "kontakt", href: ROUTES.kontakt },
];

/** A stable text to use as a React key for an address (which may be an object with a pathname and an anchor). */
export const hrefKey = (href: Href): string => (typeof href === "string" ? href : `${href.pathname}#${"hash" in href ? href.hash ?? "" : ""}`);

/** True on `href` itself and on any page below it (/bostadsguider/[slug] counts as /bostadsguider). */
export function isActivePath(pathname: string, href: Href): boolean {
  // an address with an anchor (/#faq) is the start page, not a page of its own
  if (typeof href !== "string" || href === "/" || href.includes("#")) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function isEntryActive(pathname: string, entry: NavEntry): boolean {
  return entry.kind === "link" ? isActivePath(pathname, entry.href) : entry.items.some((item) => isActivePath(pathname, item.href));
}
