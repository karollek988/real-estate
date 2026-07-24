/**
 * Secondary extraction source: `<script type="application/ld+json">` blocks.
 *
 * Standardized schema.org markup, so it's trustworthy wherever it's present —
 * but on current Hemnet listing pages it's thin (verified on real listings,
 * 2026-07): the listing block is a `Product`, not a `RealEstateListing`, and
 * only carries name/description/offers.price/image/mpn/brand — no living
 * area, fee, or amenities. `RealEstateListing`/`yearBuilt`/`floorSize`
 * handling is kept for listing templates that do use the richer schema (or a
 * future Hemnet change), but the Apollo state extractor is the one that
 * actually contributes most fields today.
 */
import { emptyHemnetPageData, type HemnetPageData } from "./types.ts";
import { parseSekNumber } from "./utils.ts";

export function extractJsonLd(html: string): HemnetPageData {
  const data = emptyHemnetPageData();

  const pattern = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      if (Array.isArray(parsed)) {
        for (const node of parsed as Record<string, unknown>[]) processNode(node, data);
      } else {
        processNode(parsed, data);
      }
    } catch {
      // malformed JSON-LD block — skip it, other sources/blocks may still contribute
    }
  }

  return data;
}

function processNode(node: Record<string, unknown>, data: HemnetPageData): void {
  if (!node || typeof node !== "object") return;

  const type = node["@type"];
  if (type === "Product" || type === "RealEstateListing") {
    const offers = node.offers as Record<string, unknown> | undefined;
    if (offers && data.asking_price_sek === null) {
      const price = offers.price ?? offers.lowPrice ?? offers.highPrice;
      if (typeof price === "number") data.asking_price_sek = price;
      else if (typeof price === "string") data.asking_price_sek = parseSekNumber(price);
    }

    if (data.image_urls.length === 0) {
      const images = node.image;
      if (typeof images === "string") data.image_urls.push(images);
      else if (Array.isArray(images)) {
        for (const img of images) if (typeof img === "string") data.image_urls.push(img);
      }
    }

    if (data.building_year === null) {
      const yearBuilt = node.yearBuilt;
      if (typeof yearBuilt === "number" && yearBuilt > 1700 && yearBuilt < 2100) {
        data.building_year = yearBuilt;
      } else if (typeof yearBuilt === "string") {
        const parsed = parseInt(yearBuilt, 10);
        if (Number.isFinite(parsed) && parsed > 1700 && parsed < 2100) data.building_year = parsed;
      }
    }

    if (data.living_area_m2 === null) {
      const floorSize = node.floorSize as Record<string, unknown> | string | number | undefined;
      if (typeof floorSize === "number") data.living_area_m2 = floorSize;
      else if (typeof floorSize === "string") {
        const parsed = parseFloat(floorSize.replace(",", "."));
        if (Number.isFinite(parsed) && parsed > 0) data.living_area_m2 = parsed;
      } else if (floorSize && typeof floorSize === "object" && typeof floorSize.value === "number") {
        data.living_area_m2 = floorSize.value;
      }
    }

    if (typeof node.description === "string" && node.description.trim()) {
      data.description = node.description.trim();
    }

    if (data.object_id === null && (typeof node.mpn === "string" || typeof node.mpn === "number")) {
      data.object_id = String(node.mpn);
    }

    if (data.agency === null) {
      const brand = node.brand as Record<string, unknown> | undefined;
      if (brand && typeof brand.name === "string") data.agency = brand.name;
    }
  }

  if (Array.isArray(node["@graph"])) {
    for (const child of node["@graph"] as Record<string, unknown>[]) processNode(child, data);
  }
}
