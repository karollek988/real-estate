/** Cross-component signal to open the "how it works" onboarding modal (mounted by SiteHeader; triggered by "Hur går det till?" on the analysis card). */
export const OPEN_ONBOARDING_MODAL_EVENT = "open-onboarding-modal";

/**
 * Asks the page to bring the analysis card (AnalyzeCard) into view: fired when
 * the onboarding modal's CTA closes, by the header's "Skapa analys" on the
 * landing page and by the hero. May carry `detail: { method: "screenshot" | "manual" | "area" }` to
 * open a specific tab (screenshot when absent).
 */
export const FOCUS_URL_INPUT_EVENT = "focus-url-input";
