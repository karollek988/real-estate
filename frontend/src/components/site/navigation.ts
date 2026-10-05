import {
  BarChartIcon,
  BookOpenIcon,
  FilePlusIcon,
  HouseIcon,
  LightbulbIcon,
  MapFoldIcon,
  MapPinIcon,
  NewspaperIcon,
  NotepadIcon,
  TagIcon,
} from "@/components/icons";

export type NavIcon = React.ComponentType<React.SVGProps<SVGSVGElement>>;

/**
 * Every public destination in one place, so the header, the footer and the
 * page CTAs can never point at different URLs. The new marketing pages use
 * Swedish paths (kopanalys.se/priser); the older app routes (/buy, /privacy,
 * /terms, /dashboard) keep theirs.
 */
export const ROUTES = {
  home: "/",
  karta: "/karta",
  skapaAnalys: "/skapa-analys",
  prisutveckling: "/prisutveckling",
  omraden: "/omraden",
  priser: "/priser",
  blogg: "/blogg",
  nyheter: "/nyheter",
  guider: "/guider",
  saFungerarDet: "/sa-fungerar-det",
  kontakt: "/kontakt",
  faq: "/#faq",
  exempelrapport: "/#exempelrapport",
  kop: "/buy",
  integritetspolicy: "/privacy",
  villkor: "/terms",
} as const;

export interface NavMenuLink {
  label: string;
  description: string;
  href: string;
  icon: NavIcon;
}

export type NavEntry =
  | { kind: "link"; label: string; href: string; icon?: NavIcon }
  | { kind: "menu"; id: string; label: string; icon: NavIcon; items: NavMenuLink[] };

// The menu item for market prices is called "Prisutveckling", not "Priser" as in
// the header reference: "Priser" is already the top-level link to what an
// analysis costs, and two "Priser" leading to different pages would confuse.
export const BOSTADSANALYS_MENU: NavMenuLink[] = [
  { label: "Karta", description: "Utforska bostäder på karta", href: ROUTES.karta, icon: MapFoldIcon },
  { label: "Skapa analys", description: "Få en komplett bostadsanalys", href: ROUTES.skapaAnalys, icon: FilePlusIcon },
  { label: "Prisutveckling", description: "Se prisutveckling och trender", href: ROUTES.prisutveckling, icon: BarChartIcon },
];

export const KUNSKAP_MENU: NavMenuLink[] = [
  { label: "Blogg", description: "Tips, guider och analyser", href: ROUTES.blogg, icon: NotepadIcon },
  { label: "Nyheter", description: "Senaste uppdateringarna", href: ROUTES.nyheter, icon: NewspaperIcon },
  { label: "Guider", description: "Steg för steg till ett tryggare köp", href: ROUTES.guider, icon: LightbulbIcon },
];

export const MAIN_NAV: NavEntry[] = [
  { kind: "menu", id: "bostadsanalys", label: "Bostadsanalys", icon: HouseIcon, items: BOSTADSANALYS_MENU },
  { kind: "link", label: "Områden", href: ROUTES.omraden, icon: MapPinIcon },
  { kind: "link", label: "Priser", href: ROUTES.priser, icon: TagIcon },
  { kind: "menu", id: "kunskap", label: "Kunskap", icon: BookOpenIcon, items: KUNSKAP_MENU },
  { kind: "link", label: "Så fungerar det", href: ROUTES.saFungerarDet },
  { kind: "link", label: "Kontakt", href: ROUTES.kontakt },
];

/** True on `href` itself and on any page below it (/blogg/[slug] counts as /blogg). */
export function isActivePath(pathname: string, href: string): boolean {
  if (href === "/" || href.includes("#")) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function isEntryActive(pathname: string, entry: NavEntry): boolean {
  return entry.kind === "link"
    ? isActivePath(pathname, entry.href)
    : entry.items.some((item) => isActivePath(pathname, item.href));
}
