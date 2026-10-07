import type { Messages } from "../types";

/** The "How it works" window next to the analysis form. Same keys as ../sv/onboarding.ts; translate the values only. */
const onboarding: Messages["onboarding"] = {
  title: "How it works",
  close: "Close",
  lead: "Four steps from screenshot to finished decision basis.",
  steps: {
    account: {
      title: "Create a free account",
      description: "Sign up in a few seconds to get access to your analyses.",
    },
    upload: {
      title: "Upload screenshots of the listing",
      description:
        "Many property sites now block automated fetching of their pages, so instead of a link you show us the listing directly — one or more screenshots work everywhere. You can also enter the details manually.",
    },
    check: {
      title: "Check the details",
      description: "We read the key details for you — you review them and correct anything before you continue.",
    },
    report: {
      title: "Get a complete overview",
      description:
        "The area, the risks and the questions for the viewing are ready in a few minutes. The housing association's finances are reviewed by our experts and added to the report within 24 hours.",
    },
  },
  duration: "Usually takes less than 60 seconds",
  cta: "I want to try it",
};

export default onboarding;
