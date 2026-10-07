/** The cookie banner and the small "Cookie-inställningar" link that opens it again. */
const consent = {
  /**
   * The banner's text. <link>...</link> becomes the link to the privacy policy: keep it around the words that
   * should be the link. Say only what is true: the banner asks for ONE optional cookie (where the visitor first
   * came from); the others are needed for the site to work.
   */
  text: "Vi använder nödvändiga cookies för att webbplatsen ska fungera. Vill du även godkänna en cookie för analys och marknadsföring? Den kommer ihåg var du först hittade oss (till exempel en sökmotor), så att vi kan se vilka kanaler som fungerar. Läs mer i vår <link>integritetspolicyn</link>.",
  decline: "Neka alla",
  accept: "Acceptera alla",
  /** The link at the bottom of every page (and in the footer) that opens the banner again. */
  settings: "Cookie-inställningar",
};

export default consent;
