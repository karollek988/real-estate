import type { Messages } from "../types";

/** The balance box. Same keys as ../sv/balance.ts; translate the values only. */
const balance: Messages["balance"] = {
  title: "Your balance",
  signedOut: "Sign in to see your balance.",
  unlimited: "Unlimited · Dev account",
  remaining: "Left to use",
  full: { label: "Peace of Mind Packages", hint: "Housing association, area and hidden costs for one home" },
  areaCredits: "Area analyses",
  yours: "Your analyses",
  brf: "Housing association analyses",
  area: "Area analyses",
  hiddenCosts: "Hidden costs",
  buyMore: "Buy more analyses",
};

export default balance;
