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
  // The manual-entry form's options are forms of tenure ("Äganderätt", "Arrende").
  if (type.includes("äganderätt") || type.includes("arrende")) return "freehold";
  if (type.includes("ägarlägenhet")) return "freehold";
  if (type.includes("lägenhet")) return "cooperative";
  if (/\b(villa|fritidshus|tomt|gård)\b/.test(type)) return "freehold";

  // Radhus / parhus / kedjehus can be either — a monthly fee means an association.
  if (p.monthlyFeeSek !== null && p.monthlyFeeSek > 0) return "cooperative";
  return "unknown";
}

/** The same decision from a stored property row (before any report exists — e.g. at purchase time). */
export function tenureOfProperty(property: { propertyType: string | null; attributes: Record<string, unknown> }): Tenure {
  const a = property.attributes ?? {};
  const text = (v: unknown) => (typeof v === "string" && v.trim() !== "" ? v : null);
  return tenureOf({
    propertyType: text(a.property_type_hemnet) ?? text(a.property_type_booli) ?? property.propertyType,
    ownershipType: text(a.ownership_type),
    monthlyFeeSek: typeof a.monthly_fee_sek === "number" ? a.monthly_fee_sek : null,
  });
}
