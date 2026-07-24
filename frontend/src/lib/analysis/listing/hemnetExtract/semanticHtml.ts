/**
 * Tertiary extraction source: semantic HTML — meta tags, the `<h1>` title,
 * and label/value structure identified by tag shape and Swedish label text,
 * never by CSS module class names (Hemnet's are build-generated and carry
 * no stable meaning, e.g. `NestHeading_nestHeading__Ziv27`).
 *
 * On current Hemnet listing pages the fact panel and description are
 * rendered client-side from Apollo state and simply aren't present in the
 * server HTML (verified on real listings, 2026-07: zero `<dt>`/`<table>`
 * elements outside skeleton loaders). The dt/dd and table matching here is
 * kept as a structural fallback — it costs nothing when it finds nothing,
 * and covers older cached pages or template variants that do render a
 * static fact panel.
 */
import { emptyHemnetPageData, type HemnetPageData } from "./types.ts";
import { parseSekNumber, stripHtml } from "./utils.ts";

const MIN_FULL_DESCRIPTION_LENGTH = 60;

export function extractSemanticHtml(html: string): HemnetPageData {
  const data = emptyHemnetPageData();

  extractMetaTags(html, data);
  extractLabelValuePairs(html, data);
  extractDescriptionSection(html, data);

  return data;
}

function extractMetaTags(html: string, data: HemnetPageData): void {
  const metaPattern =
    /<meta\s+(?:[^>]*?(?:property|name)="([^"]*)"[^>]*?content="([^"]*)"[^>]*?|[^>]*?content="([^"]*)"[^>]*?(?:property|name)="([^"]*)"[^>]*?)\s*\/?>/gi;
  const meta: Record<string, string> = {};
  let match: RegExpExecArray | null;
  while ((match = metaPattern.exec(html)) !== null) {
    const key = (match[1] || match[4])?.toLowerCase();
    const value = match[2] || match[3];
    if (key && value) meta[key] = value;
  }

  if (meta["og:image"]) data.image_urls.push(meta["og:image"]);
  if (meta["og:description"] && meta["og:description"].length >= MIN_FULL_DESCRIPTION_LENGTH) {
    data.description = meta["og:description"];
  }
}

/**
 * Label/value pairs identified purely by tag structure (`<dt>/<dd>` or
 * `<th>/<td>`), matched against Swedish label text — not class names.
 */
function extractLabelValuePairs(html: string, data: HemnetPageData): void {
  const pairPatterns = [
    /<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/gi,
    /<tr[^>]*>\s*<th[^>]*>([\s\S]*?)<\/th>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/gi,
  ];

  for (const pattern of pairPatterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(html)) !== null) {
      const label = stripHtml(match[1]).trim().toLowerCase().replace(/[:\s]+$/, "");
      const value = stripHtml(match[2]).trim();
      if (value && value !== "-" && value !== "Ej angivet") applyLabel(label, value, data);
    }
  }
}

function applyLabel(label: string, value: string, data: HemnetPageData): void {
  if (data.asking_price_sek === null && /^(pris|slutpris|utgångspris)(?!\s*per\b)/.test(label)) {
    data.asking_price_sek = parseSekNumber(value);
  }
  if (data.price_per_m2_sek === null && /^(pris\s*per\s*(kvadratmeter|kvm|m2|m²)|kvadratmeterpris)/.test(label)) {
    data.price_per_m2_sek = parseSekNumber(value);
  }
  if (data.living_area_m2 === null && /^(boarea|bostadsarea|area|yta)/.test(label)) {
    const parsed = parseFloat(value.replace(/[^\d.,]/g, "").replace(",", "."));
    if (Number.isFinite(parsed) && parsed > 0 && parsed < 10000) data.living_area_m2 = parsed;
  }
  if (data.monthly_fee_sek === null && /^(månadsavgift|avgift)/.test(label)) {
    data.monthly_fee_sek = parseSekNumber(value);
  }
  if (data.rooms === null && /^(rum|antal\s*rum)/.test(label)) {
    const parsed = parseFloat(value.replace(/[^\d.,]/g, "").replace(",", "."));
    if (Number.isFinite(parsed) && parsed > 0 && parsed < 20) data.rooms = Math.round(parsed * 10) / 10;
  }
  if (data.property_type === null && /^(boendeform|bostadstyp|hustyp)/.test(label)) {
    data.property_type = value;
  }
  if (data.ownership_type === null && /^(upplåtelseform|ägarform)/.test(label)) {
    data.ownership_type = value;
  }
  if (data.energy_class === null && /^energiklass/.test(label)) {
    const classChar = value.toUpperCase().charAt(0);
    if ("ABCDEFG".includes(classChar)) data.energy_class = classChar;
  }
  if (data.housing_association === null && /^(bostadsrättsförening|förening|brf)/.test(label) && value.length > 2) {
    data.housing_association = value;
  }
}

/**
 * The full "Om bostaden"/"Beskrivning" free-text section, found by the
 * heading's own visible text rather than a class name — Hemnet must keep
 * this text human-readable regardless of how the build names its CSS.
 */
function extractDescriptionSection(html: string, data: HemnetPageData): void {
  if (data.description && data.description.length >= MIN_FULL_DESCRIPTION_LENGTH) return;

  const headingPattern =
    /<h[1-4][^>]*>\s*(?:<[^>]+>\s*)*(Om\s+(?:bostaden|lägenheten|huset|hemmet|objektet)|Beskrivning)(?:\s*<[^>]+>\s*)*<\/h[1-4]>([\s\S]*?)(?=<h[1-4][\s>]|$)/i;
  const match = headingPattern.exec(html);
  if (!match) return;

  const text = stripHtml(match[2]).replace(/\s+/g, " ").trim();
  if (text.length >= MIN_FULL_DESCRIPTION_LENGTH) {
    data.description = text;
  }
}
