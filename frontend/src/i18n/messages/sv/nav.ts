/**
 * The page header: the main menu, the two drop-down menus, the search, the account menu and the sign-in
 * buttons. Used on every page (also in the full-screen menu on phones).
 */
const nav = {
  /** A link only keyboard and screen reader users see: jumps past the menu to the page's main content. */
  skipToContent: "Hoppa till innehållet",
  /** Screen reader name of the logo link. Keep the brand name. */
  homeLabel: "Köpanalys – till startsidan",
  /** Button that opens the full-screen menu on phones and small screens. */
  openMenu: "Öppna meny",
  closeMenu: "Stäng meny",
  /** The full-screen menu's (hidden) title. */
  menuTitle: "Meny",
  /** Screen reader name of the navigation. */
  mainMenu: "Huvudmeny",
  /** The big green button in the header. */
  createAnalysis: "Skapa analys",

  /** The top level of the menu: plain links, and the names of the two drop-down menus. */
  entries: {
    bostadsanalys: "Bostadsanalys",
    omraden: "Områden",
    priser: "Priser",
    kunskap: "Kunskap",
    saFungerarDet: "Så fungerar det",
    kontakt: "Kontakt",
  },

  /** What is in the two drop-down menus: a name and a one-line description each. */
  menus: {
    bostadsanalys: {
      karta: { label: "Karta", description: "Utforska bostäder på karta" },
      skapaAnalys: { label: "Skapa analys", description: "Få en komplett bostadsanalys" },
      prisutveckling: { label: "Prisutveckling", description: "Se prisutveckling och trender" },
    },
    kunskap: {
      bostadsguiden: { label: "Bostadsguiden", description: "Förstå bostadsköpet" },
      insikter: { label: "Insikter", description: "Data från bostadsmarknaden" },
      nyheter: { label: "Nyheter", description: "Det senaste just nu" },
    },
  },

  /** The search box that sends a visitor to the map. */
  search: {
    /** Screen reader name of the search form. */
    formLabel: "Sök på kartan",
    /** The search button (icon only): its name and tooltip. */
    button: "Sök",
    fieldLabel: "Sök adress, område eller ort",
    /** Example text inside the empty field: a Swedish district and a Swedish street address. Replace with places that mean something to your readers. */
    placeholder: "T.ex. Södermalm eller Storgatan 12, Eslöv",
    hint: "Vi visar platsen och bostäderna runt den på kartan.",
  },

  /** The profile button and its menu. */
  account: {
    signIn: "Logga in",
    signOut: "Logga ut",
    /** Screen reader name of the profile button when signed in. {name} is the person's name. */
    accountOf: "Konto: {name}",
    /** First line of the account menu. {name} is shown in bold by the code. */
    signedInAs: "Inloggad som {name}",
    links: {
      analyses: "Mina analyser",
      inspection: "Visningsguide",
      purchases: "Köp & saldo",
      settings: "Inställningar",
      privacy: "Sekretess",
    },
  },
};

export default nav;
