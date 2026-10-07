// Standalone verification for the Kunskap content system (lib/content): the
// Markdown subset (no HTML or unsafe links can get through), slugs, reading
// time, which pictures an item may use, the upload pipeline (type sniffing,
// EXIF removal, scaling, bombs), the editor's validation, row mapping and the
// demo-content switch that must never turn on in production. No test framework in this project (see the
// other *.verify.mjs). Run with:
//   npx tsx src/lib/content/content.verify.mjs
import { inlineText, isSafeHref, parseInline, parseMarkdown, tableOfContents } from "./markdown.ts";
import { formatContentDate, readingMinutesFor, slugify } from "./model.ts";
// The uploaded-picture prefix is read from this variable; a made-up project for the checks.
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abcdefgh.supabase.co";
import sharp from "sharp";
import { absoluteImageUrl, isAllowedImage, isLocalImagePath, isUploadedImageUrl } from "./images.ts";
import { ImageUploadError, prepareImage, sniffImageType, storedImageName } from "./imageUpload.ts";
import { validateContentInput } from "./validate.ts";
import { rowToItem, inputToColumns } from "./rows.ts";
import { contentDemoEnabled, demoContent } from "./demo.ts";

let failures = 0;
function check(name, condition, detail) {
  console.log(`${condition ? "PASS" : "FAIL"} - ${name}`);
  if (!condition) {
    failures++;
    if (detail !== undefined) console.log("  detail:", JSON.stringify(detail));
  }
}

// --- Markdown -------------------------------------------------------------

const doc = parseMarkdown(`Inledning på
två rader.

## Föreningens ekonomi
Text med **fet** och *kursiv* och [en länk](/bostadsguider/annan).

### Detaljer
- ett
- två
  fortsätter
* tre

1. först
2) sedan

> **Bra att veta:** rad ett
> rad två

---
# Ensam etta
## Föreningens ekonomi
`);

check("paragraph lines join into one paragraph", doc[0].type === "p" && inlineText(doc[0].inline) === "Inledning på två rader.", doc[0]);
check("## becomes h2 with an id", doc[1].type === "h2" && doc[1].id === "foreningens-ekonomi", doc[1]);
const inline = doc[2].type === "p" ? doc[2].inline : [];
check(
  "bold, italic and link are parsed",
  inline.some((n) => n.type === "strong") && inline.some((n) => n.type === "em") && inline.some((n) => n.type === "link" && n.href === "/bostadsguider/annan"),
  inline,
);
check("### becomes h3", doc[3].type === "h3" && doc[3].text === "Detaljer", doc[3]);
check("- and * items form one bulleted list, indented line continues an item", doc[4].type === "list" && !doc[4].ordered && doc[4].items.length === 3 && inlineText(doc[4].items[1]) === "två fortsätter", doc[4]);
check("1. and 2) form a numbered list", doc[5].type === "list" && doc[5].ordered && doc[5].items.length === 2, doc[5]);
check("> lines join into one note", doc[6].type === "note" && inlineText(doc[6].inline) === "Bra att veta: rad ett rad två", doc[6]);
check("--- is dropped and a single # becomes h2 (the page has its own h1)", doc[7].type === "h2" && doc[7].text === "Ensam etta", doc[7]);
check("repeated heading gets a unique id", doc[8].type === "h2" && doc[8].id === "foreningens-ekonomi-2", doc[8]);
check("table of contents lists the h2s", tableOfContents(doc).length === 3, tableOfContents(doc));

const html = parseMarkdown(`<script>alert(1)</script> <img src=x onerror=alert(1)>`);
check(
  "HTML stays plain text (rendered as text, never markup)",
  html.length === 1 && html[0].type === "p" && html[0].inline.length === 1 && html[0].inline[0].type === "text",
  html,
);

for (const href of ["javascript:alert(1)", "JaVaScRiPt:alert(1)", "data:text/html,x", "//evil.example", "vbscript:x", "/ok onclick=x"]) {
  const nodes = parseInline(`[klicka](${href})`);
  check(`unsafe link "${href}" becomes plain text`, nodes.every((n) => n.type === "text"), nodes);
}
for (const href of ["/bostadsguider/x", "#avsnitt", "https://www.riksbank.se/", "mailto:kontakt@kopanalys.se"]) {
  check(`safe link "${href}" is kept`, isSafeHref(href) && parseInline(`[a](${href})`)[0].type === "link");
}
check("unclosed emphasis stays text", inlineText(parseInline("2 * 3 = 6 och **halv")) === "2 * 3 = 6 och **halv");
check("empty body gives no blocks", parseMarkdown("").length === 0 && parseMarkdown("\n\n  \n").length === 0);
check("Windows line endings work", parseMarkdown("a\r\n\r\n## B\r\nc").length === 3);

// --- Slugs, reading time, dates ------------------------------------------

check("slugify handles å/ä/ö and symbols", slugify("BRF & ekonomi – så funkar det!") === "brf-ekonomi-sa-funkar-det", slugify("BRF & ekonomi – så funkar det!"));
check("slugify: Köpa bostad → kopa-bostad", slugify("Köpa bostad") === "kopa-bostad");
check("slugify trims hyphens and caps length at 120", slugify(`--${"a".repeat(200)}--`).length === 120);
check("reading time: 200 words ≈ 1 min, 1000 words ≈ 5 min", readingMinutesFor("ord ".repeat(200)) === 1 && readingMinutesFor("ord ".repeat(1000)) === 5);
check("reading time is at least one minute", readingMinutesFor("") === 1);
check("dates are Swedish and in Swedish time", formatContentDate("2026-10-06T23:30:00Z") === "7 oktober 2026", formatContentDate("2026-10-06T23:30:00Z"));

// --- Images ---------------------------------------------------------------

check("local image paths are accepted", isLocalImagePath("/images/bostadsguiden/tunnelbana.jpg") && isLocalImagePath("/hero-background.png"));
for (const bad of ["https://evil.example/x.jpg", "//evil.example/x.jpg", "/images/../../etc/passwd.png", "/images/x.svg", "images/x.jpg", "/images/x.jpg?x=1"]) {
  check(`image path "${bad}" is refused`, !isLocalImagePath(bad));
}

const BUCKET = "https://abcdefgh.supabase.co/storage/v1/object/public/content-images/";
check("an upload in our own bucket is allowed", isAllowedImage(`${BUCKET}2026-10-07-strandvagen-3f9a1c2b.webp`));
for (const bad of [
  "https://otherproject.supabase.co/storage/v1/object/public/content-images/x.webp",
  `${BUCKET}folder/x.webp`,
  `${BUCKET}../x.webp`,
  `${BUCKET}x.svg`,
  "https://abcdefgh.supabase.co/storage/v1/object/public/inspection-files/x.webp",
]) {
  check(`upload address "${bad.replace(BUCKET, "<bucket>/")}" is refused`, !isUploadedImageUrl(bad) && !isAllowedImage(bad));
}
check("absolute image URLs: uploads stay, site files get the site", absoluteImageUrl(`${BUCKET}a.webp`, "https://kopanalys.se") === `${BUCKET}a.webp` && absoluteImageUrl("/images/a.jpg", "https://kopanalys.se") === "https://kopanalys.se/images/a.jpg");

// --- Upload pipeline -------------------------------------------------------

const jpeg = await sharp({ create: { width: 3200, height: 2000, channels: 3, background: "#2a7854" } })
  .jpeg()
  .withExif({ IFD0: { Artist: "Hemlig fotograf" }, GPS: { GPSLatitudeRef: "N", GPSLatitude: "59/1 19/1 0/1" } })
  .toBuffer();
check("test JPEG really carries EXIF", Boolean((await sharp(jpeg).metadata()).exif));
check("sniff: JPEG", sniffImageType(jpeg) === "jpeg");
check("sniff: PNG", sniffImageType(await sharp({ create: { width: 2, height: 2, channels: 3, background: "#fff" } }).png().toBuffer()) === "png");
check("sniff: WebP", sniffImageType(await sharp({ create: { width: 2, height: 2, channels: 3, background: "#fff" } }).webp().toBuffer()) === "webp");
check("sniff: SVG/HTML/PDF are not pictures", ["<svg xmlns='http://www.w3.org/2000/svg'/>", "<html><script>alert(1)</script>", "%PDF-1.7"].every((t) => sniffImageType(new TextEncoder().encode(t)) === null));

const prepared = await prepareImage(jpeg);
const meta = await sharp(prepared.data).metadata();
check("upload becomes WebP", meta.format === "webp", meta.format);
check("upload is scaled to at most 2400 px wide", prepared.width === 2400 && meta.width === 2400, prepared.width);
check("EXIF (camera, GPS) is removed", !meta.exif && !meta.icc && !meta.xmp, { exif: Boolean(meta.exif) });
const small = await prepareImage(await sharp({ create: { width: 800, height: 600, channels: 3, background: "#fff" } }).png().toBuffer());
check("small pictures are not enlarged", small.width === 800);

async function rejects(bytes, code) {
  try {
    await prepareImage(bytes);
    return false;
  } catch (err) {
    return err instanceof ImageUploadError && err.code === code;
  }
}
check("a text file renamed .jpg is refused", await rejects(new TextEncoder().encode("hello, not a picture"), "unsupported_type"));
check("a broken JPEG is refused", await rejects(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5]), "unreadable"));
check("more than 12 MB is refused", await rejects(new Uint8Array(12 * 1024 * 1024 + 1).fill(0xff), "too_large"));
const bomb = await sharp({ create: { width: 10000, height: 10000, channels: 3, background: "#000" } }).png({ compressionLevel: 9 }).toBuffer();
check("a decompression bomb (100 megapixels in a small file) is refused", bomb.length < 12 * 1024 * 1024 && (await rejects(bomb, "unreadable")), bomb.length);

const stored = storedImageName("Strandvägen i solsken.JPG", new Date("2026-10-07T10:00:00Z"));
check("stored name: date, slug of the original name, random part, .webp", /^2026-10-07-strandvagen-i-solsken-[0-9a-f]{8}\.webp$/.test(stored) && isUploadedImageUrl(`${BUCKET}${stored}`), stored);
check("stored names never collide", storedImageName("a.jpg") !== storedImageName("a.jpg"));
check("a name of only symbols becomes 'bild'", /^\d{4}-\d{2}-\d{2}-bild-[0-9a-f]{8}\.webp$/.test(storedImageName("???.png")));

// --- Validation ---------------------------------------------------------

const good = {
  type: "guide",
  slug: "vad-kostar-en-bostad",
  title: "Vad kostar en bostad?",
  excerpt: "Kostnaderna som kommer utöver priset, steg för steg.",
  body: "Text ".repeat(60),
  category: "kostnader",
  coverImage: "/images/bostadsguiden/tunnelbana.jpg",
  coverImageAlt: "Rulltrappor i en tunnelbanestation",
  authorName: "",
  readingMinutes: "",
  featured: true,
  seoTitle: "",
  seoDescription: "",
  canonicalUrl: "",
  socialImage: "",
};
check("an uploaded cover picture validates", validateContentInput({ ...good, coverImage: `${BUCKET}2026-10-07-x-3f9a1c2b.webp` }, { publishing: true }).ok);
const ok = validateContentInput(good, { publishing: true });
check("a complete guide validates for publishing", ok.ok, ok);
check("empty optional fields become null, author defaults to Köpanalys", ok.ok && ok.value.seoTitle === null && ok.value.readingMinutes === null && ok.value.authorName === "Köpanalys", ok);

const draft = validateContentInput({ ...good, excerpt: "", body: "", category: "", coverImageAlt: "" }, { publishing: false });
check("a half-written draft can be saved", draft.ok, draft);
const publishHalf = validateContentInput({ ...good, excerpt: "", body: "", category: "", coverImageAlt: "" }, { publishing: true });
check("…but not published (summary, text, category, alt text)", !publishHalf.ok && publishHalf.errors.length === 4, publishHalf);

const bad = [
  [{ type: "blogg" }, "unknown type"],
  [{ slug: "Med Mellanslag" }, "slug with spaces"],
  [{ slug: "a--b" }, "slug with double hyphen"],
  [{ title: "x" }, "too short title"],
  [{ category: "okand" }, "unknown category"],
  [{ coverImage: "https://evil.example/x.jpg" }, "remote cover image"],
  [{ coverImage: "https://otherproject.supabase.co/storage/v1/object/public/content-images/x.webp" }, "another project's bucket"],
  [{ socialImage: "javascript:x" }, "bad social image"],
  [{ canonicalUrl: "http://kopanalys.se/x" }, "non-https canonical"],
  [{ canonicalUrl: "javascript:alert(1)" }, "script canonical"],
  [{ readingMinutes: 0 }, "zero reading time"],
  [{ readingMinutes: 2.5 }, "fractional reading time"],
  [{ seoTitle: "x".repeat(71) }, "too long SEO title"],
  [{ seoDescription: "x".repeat(171) }, "too long meta description"],
];
for (const [patch, name] of bad) {
  const result = validateContentInput({ ...good, ...patch }, { publishing: false });
  check(`refused: ${name}`, !result.ok, result);
}
check("non-object input is refused", !validateContentInput(null, { publishing: false }).ok && !validateContentInput([], { publishing: false }).ok);
check("featured must be literally true", validateContentInput({ ...good, featured: "true" }, { publishing: true }).value?.featured === false);

// --- Rows ------------------------------------------------------------------

const item = rowToItem({
  id: "1",
  type: "guide",
  slug: "s",
  title: "T",
  excerpt: "E",
  category: "inte-en-kategori",
  cover_image: null,
  cover_image_alt: "",
  author_name: "Köpanalys",
  reading_minutes: null,
  status: "published",
  featured: false,
  published_at: "2026-10-07T08:00:00Z",
  updated_at: "2026-10-07T08:00:00Z",
  seo_title: null,
  seo_description: null,
  canonical_url: null,
  social_image: null,
});
check("an unknown category from the database becomes null", item.category === null, item);
check("a row without body or reading time gets body '' and 1 min", item.body === "" && item.readingMinutes === 1, item);
check("input → columns uses snake_case", ok.ok && inputToColumns(ok.value).cover_image_alt === good.coverImageAlt);

// --- Demo content switch ----------------------------------------------------

const ENV_KEYS = ["NODE_ENV", "VERCEL_ENV", "CONTENT_DEMO"];
const saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
function withEnv(env, fn) {
  for (const k of ENV_KEYS) delete process.env[k];
  Object.assign(process.env, env);
  try {
    return fn();
  } finally {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
}
check("demo on in next dev", withEnv({ NODE_ENV: "development" }, contentDemoEnabled));
check("demo on for Vercel Preview", withEnv({ NODE_ENV: "production", VERCEL_ENV: "preview" }, contentDemoEnabled));
check("demo off in a plain production build", !withEnv({ NODE_ENV: "production" }, contentDemoEnabled));
check("demo NEVER on Vercel Production, even with CONTENT_DEMO=1", !withEnv({ NODE_ENV: "production", VERCEL_ENV: "production", CONTENT_DEMO: "1" }, contentDemoEnabled));
check("CONTENT_DEMO=0 turns it off in dev", !withEnv({ NODE_ENV: "development", CONTENT_DEMO: "0" }, contentDemoEnabled));
check("no demo items when off", withEnv({ NODE_ENV: "production" }, () => demoContent("guide").length === 0));
const demoGuides = withEnv({ NODE_ENV: "development" }, () => demoContent("guide"));
check("every demo item is marked isDemo and has an alt text", demoGuides.length > 0 && demoGuides.every((d) => d.isDemo && d.coverImageAlt.length > 5), demoGuides.length);
check("demo slugs all start with exempel-", demoGuides.every((d) => d.slug.startsWith("exempel-")));

console.log(failures === 0 ? "\nAll content checks passed." : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
