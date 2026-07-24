import type { ExtractedProperty } from "../types";

/** Fields collected by the manual-entry form. All except address are optional. */
export interface ManualListingFields {
  address: string;
  livingArea?: number | null;
  rooms?: number | null;
  monthlyFee?: number | null;
  floor?: number | null;
  buildingYear?: number | null;
  condition?: string | null;
  balcony?: string | null;
  elevator?: string | null;
  parking?: string | null;
  askingPrice?: number | null;
  operatingCosts?: number | null;
  energyClass?: string | null;
  description?: string | null;
  broker?: string | null;
  agency?: string | null;
  propertyType?: string | null;
}

/**
 * Turn manual form input into an ExtractedProperty. If the address contains a
 * comma-separated city part ("Storgatan 12, Stockholm"), the last part is
 * treated as the municipality so deduplication lines up with URL-derived
 * properties as closely as possible.
 */
export function extractFromManualFields(fields: ManualListingFields): ExtractedProperty {
  const parts = fields.address.split(",").map((p) => p.trim()).filter(Boolean);
  const address = parts[0] ?? fields.address.trim();
  const municipality = parts.length > 1 ? parts[parts.length - 1] : null;

  return {
    address,
    municipality,
    postalCode: null,
    propertyType: fields.propertyType ?? null,
    apartmentNumber: null,
    floor: fields.floor ?? null,
    rooms: fields.rooms ?? null,
    hemnetUrl: null,
    attributes: {
      entry: "manual",
      ...(fields.rooms != null ? { rooms: fields.rooms } : {}),
      ...(fields.livingArea != null ? { living_area_m2: fields.livingArea } : {}),
      ...(fields.monthlyFee != null ? { monthly_fee_sek: fields.monthlyFee } : {}),
      ...(fields.buildingYear != null ? { building_year: fields.buildingYear } : {}),
      ...(fields.condition ? { condition: fields.condition } : {}),
      ...(fields.balcony ? { balcony: fields.balcony === "Ja" } : {}),
      ...(fields.elevator ? { elevator: fields.elevator === "Ja" } : {}),
      ...(fields.parking ? { parking: fields.parking === "Ja" } : {}),
      ...(fields.askingPrice != null ? { asking_price_sek: fields.askingPrice } : {}),
      ...(fields.operatingCosts != null ? { operating_costs_sek: fields.operatingCosts } : {}),
      ...(fields.energyClass ? { energy_class: fields.energyClass } : {}),
      ...(fields.description ? { description: fields.description } : {}),
      ...(fields.broker ? { broker: fields.broker } : {}),
      ...(fields.agency ? { agency: fields.agency } : {}),
    },
  };
}
