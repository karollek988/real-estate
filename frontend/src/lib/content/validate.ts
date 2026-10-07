import { isLocalImagePath } from "./images";
import { CONTENT_TYPES, isCategorySlug, type ContentInput, type ContentType } from "./model";

/**
 * Checks what the content editor sends before anything is saved (the API
 * routes under /api/admin/content). The database has the same limits as CHECK
 * constraints; these give the editor readable Swedish messages instead.
 *
 * Publishing asks for more than saving a draft: a draft may be half-written,
 * a published item needs a summary, a category and alt text for its picture.
 */

export const LIMITS = {
  title: 160,
  slug: 120,
  excerpt: 320,
  body: 100_000,
  authorName: 80,
  coverImageAlt: 200,
  seoTitle: 70,
  seoDescription: 170,
  canonicalUrl: 300,
} as const;

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type ValidationResult = { ok: true; value: ContentInput; warnings: string[] } | { ok: false; errors: string[] };

function text(raw: Record<string, unknown>, key: string): string {
  const value = raw[key];
  return typeof value === "string" ? value.trim() : "";
}

function optionalText(raw: Record<string, unknown>, key: string): string | null {
  return text(raw, key) || null;
}

export function validateContentInput(input: unknown, { publishing }: { publishing: boolean }): ValidationResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, errors: ["Innehållet saknas."] };
  }
  const raw = input as Record<string, unknown>;
  const errors: string[] = [];
  const warnings: string[] = [];

  const type = raw.type;
  if (!CONTENT_TYPES.includes(type as ContentType)) errors.push("Välj typ: guide, insikt eller nyhet.");

  const title = text(raw, "title");
  if (title.length < 3) errors.push("Titeln behöver minst tre tecken.");
  if (title.length > LIMITS.title) errors.push(`Titeln får vara högst ${LIMITS.title} tecken.`);

  const slug = text(raw, "slug");
  if (!SLUG.test(slug)) errors.push("Adressen (slug) får bara innehålla a–z, 0–9 och bindestreck, t.ex. vad-kostar-en-bostad.");
  if (slug.length > LIMITS.slug) errors.push(`Adressen får vara högst ${LIMITS.slug} tecken.`);

  const excerpt = text(raw, "excerpt");
  if (excerpt.length > LIMITS.excerpt) errors.push(`Sammanfattningen får vara högst ${LIMITS.excerpt} tecken.`);
  if (publishing && excerpt.length < 20) errors.push("Skriv en sammanfattning (minst 20 tecken) innan du publicerar – den visas på korten och i Google.");

  const body = typeof raw.body === "string" ? raw.body.replace(/\r\n?/g, "\n") : "";
  if (body.length > LIMITS.body) errors.push("Texten är för lång.");
  if (publishing && body.trim().length < 200) errors.push("Texten är för kort för att publiceras (minst 200 tecken).");

  const categoryValue = raw.category === "" || raw.category === undefined ? null : raw.category;
  if (categoryValue !== null && !isCategorySlug(categoryValue)) errors.push("Okänd kategori.");
  const category = isCategorySlug(categoryValue) ? categoryValue : null;
  if (publishing && type === "guide" && !category) errors.push("Välj en kategori innan du publicerar guiden.");

  const coverImage = optionalText(raw, "coverImage");
  if (coverImage && !isLocalImagePath(coverImage)) errors.push("Bilden måste ligga på sajten (en sökväg som börjar med /images/).");
  const coverImageAlt = text(raw, "coverImageAlt");
  if (coverImageAlt.length > LIMITS.coverImageAlt) errors.push(`Alt-texten får vara högst ${LIMITS.coverImageAlt} tecken.`);
  if (publishing && coverImage && coverImageAlt.length < 5) errors.push("Beskriv bilden (alt-text) innan du publicerar – den läses upp för den som inte ser bilden.");

  const authorName = text(raw, "authorName") || "Köpanalys";
  if (authorName.length > LIMITS.authorName) errors.push(`Författarnamnet får vara högst ${LIMITS.authorName} tecken.`);

  let readingMinutes: number | null = null;
  if (raw.readingMinutes !== null && raw.readingMinutes !== undefined && raw.readingMinutes !== "") {
    const n = Number(raw.readingMinutes);
    if (!Number.isInteger(n) || n < 1 || n > 120) errors.push("Lästiden ska vara ett heltal mellan 1 och 120 minuter, eller tom.");
    else readingMinutes = n;
  }

  const seoTitle = optionalText(raw, "seoTitle");
  if (seoTitle && seoTitle.length > LIMITS.seoTitle) errors.push(`SEO-titeln får vara högst ${LIMITS.seoTitle} tecken.`);
  const seoDescription = optionalText(raw, "seoDescription");
  if (seoDescription && seoDescription.length > LIMITS.seoDescription) errors.push(`Metabeskrivningen får vara högst ${LIMITS.seoDescription} tecken.`);
  if (publishing && !seoDescription && excerpt.length > 160) warnings.push("Sammanfattningen är längre än 160 tecken; Google kan korta den. Skriv gärna en egen metabeskrivning.");

  const canonicalUrl = optionalText(raw, "canonicalUrl");
  if (canonicalUrl) {
    let valid = false;
    try {
      valid = new URL(canonicalUrl).protocol === "https:";
    } catch {
      valid = false;
    }
    if (!valid || canonicalUrl.length > LIMITS.canonicalUrl) errors.push("Kanonisk adress ska vara en fullständig https-adress, eller tom.");
  }

  const socialImage = optionalText(raw, "socialImage");
  if (socialImage && !isLocalImagePath(socialImage)) errors.push("Delningsbilden måste ligga på sajten (en sökväg som börjar med /images/).");

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    warnings,
    value: {
      type: type as ContentType,
      slug,
      title,
      excerpt,
      body,
      category,
      coverImage,
      coverImageAlt,
      authorName,
      readingMinutes,
      featured: raw.featured === true,
      seoTitle,
      seoDescription,
      canonicalUrl,
      socialImage,
    },
  };
}
