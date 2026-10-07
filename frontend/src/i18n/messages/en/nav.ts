import type { Messages } from "../types";

/** The page header: menus, search, account menu. Same keys as ../sv/nav.ts; translate the values only. */
const nav: Messages["nav"] = {
  skipToContent: "Skip to content",
  homeLabel: "Köpanalys – go to the start page",
  openMenu: "Open menu",
  closeMenu: "Close menu",
  menuTitle: "Menu",
  mainMenu: "Main menu",
  createAnalysis: "Create analysis",

  entries: {
    bostadsanalys: "Home analysis",
    omraden: "Areas",
    priser: "Pricing",
    kunskap: "Knowledge",
    saFungerarDet: "How it works",
    kontakt: "Contact",
  },

  menus: {
    bostadsanalys: {
      karta: { label: "Map", description: "Explore homes on a map" },
      skapaAnalys: { label: "Create analysis", description: "Get a complete home analysis" },
      prisutveckling: { label: "Price trends", description: "See price development and trends" },
    },
    kunskap: {
      blogg: { label: "Blog", description: "Tips, guides and analyses" },
      nyheter: { label: "News", description: "The latest updates" },
      guider: { label: "Guides", description: "Step by step to a safer purchase" },
    },
  },

  search: {
    formLabel: "Search the map",
    button: "Search",
    fieldLabel: "Search an address, area or town",
    placeholder: "E.g. Södermalm or Storgatan 12, Eslöv",
    hint: "We show the place and the homes around it on the map.",
  },

  account: {
    signIn: "Sign in",
    signOut: "Sign out",
    accountOf: "Account: {name}",
    signedInAs: "Signed in as {name}",
    links: {
      analyses: "My analyses",
      inspection: "Viewing guide",
      purchases: "Purchases & balance",
      settings: "Settings",
      privacy: "Privacy",
    },
  },
};

export default nav;
