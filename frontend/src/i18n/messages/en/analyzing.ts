import type { Messages } from "../types";

/** The page shown while an analysis is being made. Same keys as ../sv/analyzing.ts; translate the values only. */
const analyzing: Messages["analyzing"] = {
  title: "Analysing the property",
  text: "This usually takes between 30 seconds and 2 minutes, depending on how much public data needs to be fetched.",
  building: "Building the Köpanalys decision basis",
  stages: {
    locate: "Locating property in public records",
    verify: "Verifying address and coordinates",
    market: "Collecting market data",
    neighbourhood: "Gathering neighbourhood information",
    association: "Analysing housing association finances",
    statements: "Reading financial statements",
    risks: "Evaluating risk factors",
    future: "Assessing future development potential",
    report: "Building your decision report",
  },
};

export default analyzing;
