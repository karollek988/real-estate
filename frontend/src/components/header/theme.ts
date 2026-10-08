/**
 * The header's colours: cream, deep green, as on every page of the site. (There used to be a "dark" variant for the
 * pages that had not been redesigned yet; none is left. The variant is kept as a name so a page may still say
 * variant="light".)
 */
export type SiteHeaderVariant = "light";

export const HEADER_THEME = {
  light: {
    bar: "border-ka-line/80 bg-ka-cream/95 text-ka-ink",
    barScrolled: "shadow-[0_12px_32px_-22px_rgba(15,31,24,0.45)]",
    logo: "text-ka-ink",
    nav: "text-ka-text hover:bg-ka-sand hover:text-ka-ink",
    navOpen: "bg-ka-sand text-ka-ink",
    navActive: "bg-ka-sand/70 font-semibold text-ka-green-900",
    navIcon: "text-ka-green-900",
    panel: "border-ka-line bg-white shadow-[0_28px_60px_-28px_rgba(15,31,24,0.42),0_4px_14px_-8px_rgba(15,31,24,0.12)]",
    panelItem: "hover:bg-ka-cream focus-visible:bg-ka-cream",
    panelItemActive: "bg-ka-cream",
    panelIcon: "text-ka-green-900",
    panelTitle: "text-ka-ink",
    panelText: "text-ka-muted",
    panelDivider: "border-ka-line/80",
    iconButton: "text-ka-ink hover:bg-ka-ink/[0.06]",
    divider: "bg-ka-line",
    cta: "bg-ka-green-900 text-white hover:bg-ka-green-800 shadow-[0_10px_24px_-14px_rgba(12,42,31,0.9)]",
    avatar: "border-ka-line bg-ka-stone text-ka-ink hover:border-ka-green-700/40 hover:bg-ka-sand",
    input: "border-ka-line bg-white text-ka-ink placeholder:text-ka-muted/70 focus:border-ka-green-700",
    drawer: "bg-ka-cream text-ka-ink",
    drawerRow: "border-ka-line text-ka-ink",
    drawerSecondary: "border-ka-line bg-white text-ka-ink hover:bg-ka-sand",
    drawerActive: "font-semibold text-ka-green-700",
    danger: "text-ka-red-600 hover:bg-ka-red-600/[0.07]",
    focusRing: "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ka-green-700 focus-visible:ring-offset-2 focus-visible:ring-offset-ka-cream",
  },
} as const;

export type HeaderTheme = (typeof HEADER_THEME)[SiteHeaderVariant];

/**
 * Popover panels (menus, search, account). Opening switches visibility at once
 * - a visibility transition would keep the panel hidden for a frame, and focus
 * can't move into a hidden panel - while closing fades out before hiding.
 */
export const POPOVER_OPEN = "visible translate-y-0 opacity-100 transition-[opacity,transform] duration-150 ease-out";
export const POPOVER_CLOSED =
  "pointer-events-none invisible -translate-y-1 opacity-0 transition-[opacity,transform,visibility] duration-150 ease-out";
