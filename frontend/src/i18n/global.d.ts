import type { AppLocale } from "./locales";
import type messages from "./messages/sv";

// Tells next-intl what a language code and the messages look like, so that t("section.key") is checked by
// TypeScript: a misspelt key is an error where it is written, not a blank in the browser.
declare module "next-intl" {
  interface AppConfig {
    Locale: AppLocale;
    Messages: typeof messages;
  }
}
