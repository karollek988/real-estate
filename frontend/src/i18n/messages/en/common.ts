import type { Messages } from "../types";

/** English texts used all over the site. The keys are the same as in ../sv/common.ts: translate the values only. */
const common: Messages["common"] = {
  languageSwitcher: {
    label: "Language",
    current: "Language: {language}",
    switchTo: "Show this page in {language}",
  },

  breadcrumbs: {
    label: "Breadcrumbs",
    home: "Home",
  },

  cta: {
    title: "Ready to see what you are actually buying?",
    text: "Upload a screenshot of the listing and we will put together the report. Most of it is ready within a few minutes.",
    createAnalysis: "Create analysis",
    showMap: "Show map",
  },
};

export default common;
