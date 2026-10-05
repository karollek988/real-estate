/**
 * "light" is the redesigned header (cream, deep green) used by every public
 * page. "dark" keeps the same header in the dark palette for the pages that
 * have not been redesigned yet (/buy, the dashboard, the legal pages), so the
 * header never clashes with the page under it.
 */
export type SiteHeaderVariant = "light" | "dark";

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
  dark: {
    bar: "border-white/10 bg-[#0A1212]/90 text-white",
    barScrolled: "shadow-[0_10px_30px_-15px_rgba(0,0,0,0.6)]",
    logo: "text-white",
    nav: "text-neutral-300 hover:bg-white/[0.06] hover:text-white",
    navOpen: "bg-white/[0.08] text-white",
    navActive: "bg-white/[0.06] font-semibold text-white",
    navIcon: "text-green-400",
    panel: "border-white/10 bg-[#0F1417] shadow-[0_24px_50px_-20px_rgba(0,0,0,0.7)]",
    panelItem: "hover:bg-white/[0.05] focus-visible:bg-white/[0.05]",
    panelItemActive: "bg-white/[0.05]",
    panelIcon: "text-green-400",
    panelTitle: "text-white",
    panelText: "text-neutral-400",
    panelDivider: "border-white/10",
    iconButton: "text-neutral-200 hover:bg-white/[0.06]",
    divider: "bg-white/15",
    cta: "bg-green-600 text-white hover:bg-green-500",
    avatar: "border-green-500/30 bg-green-400/10 text-green-400 hover:border-green-500/50",
    input: "border-white/15 bg-white/[0.04] text-white placeholder:text-neutral-500 focus:border-green-500",
    drawer: "bg-[#0A1212] text-white",
    drawerRow: "border-white/10 text-white",
    drawerSecondary: "border-white/10 bg-white/5 text-white hover:bg-white/10",
    drawerActive: "font-semibold text-green-400",
    danger: "text-red-400 hover:bg-red-500/10",
    focusRing: "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A1212]",
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
