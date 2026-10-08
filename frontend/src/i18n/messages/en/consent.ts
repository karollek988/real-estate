import type { Messages } from "../types";

/** The cookie banner and its settings dialog. Same keys as ../sv/consent.ts; translate the values only. */
const consent: Messages["consent"] = {
  text: "We use the cookies the website needs in order to work. Would you also like to accept one cookie for analytics and marketing? It remembers where you first found us (for example a search engine), so that we can see which channels work. Read more in our <link>privacy policy</link>.",
  necessaryOnly: "Necessary only",
  customize: "Customise",
  acceptAll: "Accept all",
  settings: "Cookie settings",

  dialog: {
    title: "Customise your cookie choices",
    intro:
      "Here you choose which cookies we may use. The necessary ones are needed for the website to work and cannot be switched off. You can change your mind at any time with \"Cookie settings\" at the bottom of the page. Read more in our <link>privacy policy</link>.",
    alwaysOn: "Always on",
    on: "On",
    off: "Off",
    back: "Back",
    save: "Save my choices",
    close: "Close",

    necessary: {
      title: "Necessary",
      lead: "Needed for the website to work. Cannot be switched off.",
    },
    optional: {
      title: "Optional",
      lead: "Only set if you switch them on.",
    },

    items: {
      session: {
        title: "Login",
        description:
          "Keeps you logged in while you use Köpanalys. Only set when you log in and removed when you log out.",
      },
      language: {
        title: "Language",
        description:
          "Remembers the language you chose. Only set when you choose a language yourself with the language picker, contains only the language code (for example \"en\") and is kept for one year. Not used for analytics or marketing.",
      },
      choice: {
        title: "Your cookie choice",
        description:
          "Remembers what you choose here, so that we do not ask again at every visit. Kept only in your browser.",
      },
      marketing: {
        title: "Analytics and marketing",
        description:
          "Remembers where you first found us, for example a search engine, so that we can see which channels work. Contains no ID, no address and no pages, and is kept for 90 days. Switched off until you switch it on.",
      },
    },
  },
};

export default consent;
