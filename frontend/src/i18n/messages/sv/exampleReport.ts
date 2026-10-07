/**
 * The example report on the start page and the price page: a made-up housing association shown exactly as a
 * customer would see it, so a visitor can see what they get. The association's key figures are invented, and
 * its text (the expert's comment, the date of the fee increase) is written here.
 */
const exampleReport = {
  /** The dark bar at the top of the example: the report's name and the part shown (the housing association chapter). */
  chrome: "Köpanalys · Bostadsrättsförening",
  /** The tag that says the example is made up. */
  badge: "Exempel · påhittade siffror",
  /** The button over the faded example. */
  open: "Läs hela exempelkapitlet",
  eyebrow: "Exempelrapport",
  title: "Se vad du får innan du köper",
  /** A sentence from packages.ts ("BRF-analysen granskas av våra experter ...") follows it. */
  lead: "Föreningens ekonomi i klartext: varje nyckeltal förklaras, jämförs med vad som brukar räknas som lågt och högt och räknas om till vad det betyder för dig i kronor.",
  contents: "Rapporten innehåller",
  /** The note after a chapter that is not ready yet. */
  soon: "(lanseras snart)",
  /** The chapters of a full report. */
  chapters: {
    summary: "Sammanfattning",
    property: "Fastighetsinformation",
    housingCost: "Boendekalkyl",
    brf: "Bostadsrättsförening",
    area: "Områdesanalys",
    risks: "Möjliga risker",
    outlook: "Framtidsutsikter",
    questions: "Frågor inför visningen",
  },
  createAnalysis: "Skapa analys",
  prices: "Se priserna",
  /** The window that shows the whole example chapter. */
  dialogLabel: "Exempel på BRF-kapitlet i en rapport",
  close: "Stäng exemplet",

  /** The made-up association. */
  example: {
    /** Brf = bostadsrättsförening (housing association). */
    associationName: "Brf Exempelgården",
    /** {name} is the association's name. */
    belongs: "Bostaden tillhör {name}.",
    /** When the example association's fee increase takes effect. */
    feeChangeEffective: "1 januari 2027",
    /** The comment a Köpanalys expert has written about the example association. */
    expertComment:
      "Föreningen har en normal skuldsättning och ett sparande som täcker löpande underhåll. Stambytet 2028 ska enligt styrelsen finansieras med sparade medel och den beslutade avgiftshöjningen.",
  },
};

export default exampleReport;
