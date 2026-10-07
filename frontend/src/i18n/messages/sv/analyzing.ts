/**
 * The page shown while an analysis is being made: a heading, a progress bar and the list of what is being
 * done. NOTE for the Swedish text: the list of stages was written in English from the start and is still
 * shown in English on the Swedish site; it is kept as it was.
 */
const analyzing = {
  title: "Analyserar fastigheten",
  text: "Detta tar vanligen mellan 30 sekunder och 2 minuter beroende på mängden offentlig data som behöver hämtas.",
  /** The small line at the bottom. */
  building: "Bygger Köpanalys beslutsunderlag",
  /** What is being done, in order. */
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
