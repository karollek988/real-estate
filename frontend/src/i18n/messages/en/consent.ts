import type { Messages } from "../types";

/** The cookie banner. Same keys as ../sv/consent.ts; translate the values only. */
const consent: Messages["consent"] = {
  text: "We use the cookies the website needs in order to work. Would you also like to accept one cookie for analytics and marketing? It remembers where you first found us (for example a search engine), so that we can see which channels work. Read more in our <link>privacy policy</link>.",
  decline: "Decline all",
  accept: "Accept all",
  settings: "Cookie settings",
};

export default consent;
