import type { Messages } from "../types";

/** The start page's opening and the place where an analysis is started. Same keys as ../sv/landing.ts; translate the values only. */
const landing: Messages["landing"] = {
  hero: {
    badge: {
      independent: "Independent",
      factBased: "Fact-based",
      safer: "For a safer home purchase",
    },
    title: "Your independent partner <br></br>for <accent>home analysis</accent>",
    lead: "We gather and analyse data from several sources to give you a clear picture of homes, areas and housing associations – so that you can make safer decisions.",
    showMap: "Show map",
    exampleReport: "See example report",
    laptopAlt: "The Köpanalys map with homes for sale in Stockholm, shown on a laptop",
    steps: {
      find: { title: "Find", subtitle: "the home" },
      analyse: { title: "Analyse", subtitle: "the home" },
      decide: { title: "Decide", subtitle: "with confidence" },
    },
  },

  analyze: {
    eyebrow: "Home analysis",
    title: "Buying a home? We show you what you are <accent>actually buying</accent>.",
    lead: "An independent review of the home you want to buy; the housing association's finances, the area and all the costs.",
    pills: {
      housingCost: "Housing cost calculation",
      area: "Area analysis",
      brf: "Housing association analysis",
      risks: "Possible risks",
    },
    soon: "soon",
    valueProps: {
      independent: { title: "Independent review", description: "We are on the buyer's side – not the seller's or the estate agent's." },
      association: { title: "The association in plain language", description: "Reviewed by our experts, ready within 24 hours." },
      area: { title: "The area, straight away", description: "Services, schools and commuting – automatically and in a few minutes." },
      questions: { title: "Questions for the viewing", description: "What is not in the listing, gathered in one place." },
    },
    trust: {
      title: "Trusted by property investors across Sweden",
    },
    card: {
      title: "Analyse a home",
      howItWorks: "How does it work?",
      duration: "Usually takes less than 60 seconds",
      methodsLabel: "How do you want to enter the home?",
      methods: {
        screenshot: { label: "Upload screenshot", short: "Screenshot" },
        manual: { label: "Manual entry", short: "Manual" },
        area: { label: "Area analysis", short: "Area" },
      },
      soonBadge: "Soon",
      manualNotice:
        "Manual entry is under development and we are continuously improving it. For now you can analyse a home by uploading screenshots of the listing instead.",
    },
  },
};

export default landing;
