/**
 * How the home is owned decides which parts of the report apply: a bostadsrätt
 * has a housing association (the BRF chapter) and a monthly fee but no lagfart;
 * a freehold house (äganderätt: villa, fritidshus, ...) has no association but
 * pays lagfart and, for a new loan, stamp duty on pantbrev.
 */
export type Tenure = "cooperative" | "freehold" | "unknown";

export function tenureOf(p: {
  propertyType: string | null;
  ownershipType: string | null;
  monthlyFeeSek: number | null;
}): Tenure {
  // The stated form of tenure is the most direct evidence.
  const ownership = (p.ownershipType ?? "").toLowerCase();
  if (ownership.includes("bostadsrätt")) return "cooperative";
  if (ownership.includes("äganderätt")) return "freehold";

  const type = (p.propertyType ?? "").toLowerCase();
  if (type.includes("bostadsrätt")) return "cooperative";
  if (type.includes("ägarlägenhet")) return "freehold";
  if (type.includes("lägenhet")) return "cooperative";
  if (/\b(villa|fritidshus|tomt|gård)\b/.test(type)) return "freehold";

  // Radhus / parhus / kedjehus can be either — a monthly fee means an association.
  if (p.monthlyFeeSek !== null && p.monthlyFeeSek > 0) return "cooperative";
  return "unknown";
}
