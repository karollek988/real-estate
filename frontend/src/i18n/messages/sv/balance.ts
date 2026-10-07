/** The box that shows how many analyses an account can still start and how many it has. Used in the store and on the dashboard. */
const balance = {
  title: "Ditt saldo",
  signedOut: "Logga in för att se ditt saldo.",
  /** Shown for the developer account, which has no limit. */
  unlimited: "Obegränsat · Dev account",
  remaining: "Kvar att använda",
  full: { label: "Trygghetspaket", hint: "BRF, område och dolda kostnader för en bostad" },
  areaCredits: "Områdesanalyser",
  yours: "Dina analyser",
  brf: "BRF-analyser",
  area: "Områdesanalyser",
  hiddenCosts: "Dolda kostnader",
  buyMore: "Köp fler analyser",
};

export default balance;
