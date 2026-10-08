/** The cookie banner, the dialog behind "Anpassa val", and the small "Cookie-inställningar" link that opens the banner again. */
const consent = {
  /**
   * The banner's text. <link>...</link> becomes the link to the privacy policy: keep it around the words that
   * should be the link. Say only what is true: the banner asks for ONE optional cookie (where the visitor first
   * came from); the others are needed for the site to work.
   */
  text: "Vi använder nödvändiga cookies för att webbplatsen ska fungera. Vill du även godkänna en cookie för analys och marknadsföring? Den kommer ihåg var du först hittade oss (till exempel en sökmotor), så att vi kan se vilka kanaler som fungerar. Läs mer i vår <link>integritetspolicyn</link>.",
  /** The three buttons of the banner: only the necessary cookies / open the dialog / the optional ones too. */
  necessaryOnly: "Endast nödvändiga",
  customize: "Anpassa val",
  acceptAll: "Godkänn alla",
  /** The link at the bottom of every page (and in the footer) that opens the banner again. */
  settings: "Cookie-inställningar",

  /** The dialog behind "Anpassa val": one switch for each cookie, the necessary ones locked on. */
  dialog: {
    title: "Anpassa dina cookie-val",
    /** <link>...</link> becomes the link to the privacy policy. */
    intro:
      "Här väljer du vilka cookies vi får använda. De nödvändiga behövs för att webbplatsen ska fungera och kan inte stängas av. Du kan ändra dig när som helst via \"Cookie-inställningar\" längst ned på sidan. Läs mer i vår <link>integritetspolicy</link>.",
    /** The state shown next to a switch. "alwaysOn" is for the necessary cookies, which cannot be switched off. */
    alwaysOn: "Alltid på",
    on: "På",
    off: "Av",
    /** Leave without choosing (the banner is still waiting for an answer) / save the choice made with the switches. */
    back: "Tillbaka",
    save: "Spara mina val",
    close: "Stäng",

    necessary: {
      title: "Nödvändiga",
      lead: "Behövs för att webbplatsen ska fungera. Kan inte stängas av.",
    },
    optional: {
      title: "Valfria",
      lead: "Sätts bara om du slår på dem.",
    },

    /**
     * What each cookie is for. Say only what is true (see the privacy policy, messages/<language>/legal.ts): when it
     * is set, what it contains, how long it is kept. The technical name under each one is not translated.
     */
    items: {
      session: {
        title: "Inloggning",
        description:
          "Håller dig inloggad medan du använder Köpanalys. Sätts först när du loggar in och tas bort när du loggar ut.",
      },
      language: {
        title: "Språkval",
        description:
          "Kommer ihåg vilket språk du valt. Sätts först när du själv väljer språk i språkväljaren, innehåller bara språkkoden (till exempel \"en\") och sparas i ett år. Används inte för analys eller marknadsföring.",
      },
      choice: {
        title: "Ditt cookieval",
        description:
          "Kommer ihåg vad du väljer här, så att vi inte frågar igen vid varje besök. Sparas bara i din webbläsare.",
      },
      marketing: {
        title: "Analys och marknadsföring",
        description:
          "Kommer ihåg var du först hittade oss, till exempel en sökmotor, så att vi kan se vilka kanaler som fungerar. Innehåller inget id, ingen adress och inga sidor, och sparas i 90 dagar. Är avstängd tills du slår på den.",
      },
    },
  },
};

export default consent;
