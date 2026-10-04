/** Cross-component signal to open the "how it works" onboarding modal (triggered from the SiteHeader nav and the footer). */
export const OPEN_ONBOARDING_MODAL_EVENT = "open-onboarding-modal";

/**
 * Asks the landing page to bring the analysis card into view: fired when the
 * onboarding modal's CTA closes, by the header's search icon and by the hero
 * cards. May carry `detail: { method: "screenshot" | "manual" | "area" }` to
 * open a specific tab (screenshot when absent).
 */
export const FOCUS_URL_INPUT_EVENT = "focus-url-input";
