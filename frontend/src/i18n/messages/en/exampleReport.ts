import type { Messages } from "../types";

/** The example report. Same keys as ../sv/exampleReport.ts; translate the values only. */
const exampleReport: Messages["exampleReport"] = {
  chrome: "Köpanalys · Housing association",
  badge: "Example · made-up figures",
  open: "Read the whole example chapter",
  eyebrow: "Example report",
  title: "See what you get before you buy",
  lead: "The housing association's finances in plain language: every key figure is explained, compared with what is usually counted as low and high, and converted into what it means for you in kronor.",
  contents: "The report contains",
  soon: "(launching soon)",
  chapters: {
    summary: "Summary",
    property: "Property information",
    housingCost: "Housing cost calculation",
    brf: "Housing association",
    area: "Area analysis",
    risks: "Possible risks",
    outlook: "Outlook",
    questions: "Questions for the viewing",
  },
  createAnalysis: "Create analysis",
  prices: "See the prices",
  dialogLabel: "Example of the housing association chapter in a report",
  close: "Close the example",

  example: {
    associationName: "Brf Exempelgården",
    belongs: "The home belongs to {name}.",
    feeChangeEffective: "1 January 2027",
    expertComment:
      "The association has a normal level of debt and savings that cover ongoing maintenance. According to the board, the pipe replacement in 2028 will be financed with savings and the decided fee increase.",
  },
};

export default exampleReport;
