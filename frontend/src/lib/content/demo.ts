import type { ContentCategorySlug, ContentItem, ContentType } from "./model";

/**
 * TEMPORARY DEVELOPMENT CONTENT - placeholder cards so the Bostadsguiden
 * layout can be built and reviewed before any real guide exists. Not articles:
 * the titles show the kind of subject a guide will have, and every body is the
 * same placeholder text.
 *
 * Shown only where contentDemoEnabled() says so - `next dev`, Vercel Preview
 * deployments, or CONTENT_DEMO=1 - and never on a Vercel Production
 * deployment, whatever the variables say. Every demo item carries
 * isDemo: true: the cards get an "Exempel" badge and the pages are noindex.
 *
 * When real content is published (from /admin/content) this file can be
 * deleted together with the two calls to demoContent() in repository.ts.
 */
export function contentDemoEnabled(): boolean {
  if (process.env.VERCEL_ENV === "production" || process.env.CONTENT_DEMO === "0") return false;
  return process.env.NODE_ENV === "development" || process.env.VERCEL_ENV === "preview" || process.env.CONTENT_DEMO === "1";
}

const PLACEHOLDER_BODY = `Det här är **exempeltext** som bara visas under utveckling. Den riktiga guiden skrivs av Köpanalys och publiceras från innehållsverktyget – texten nedan finns bara för att visa hur rubriker, listor och rutor ser ut.

## Ett avsnitt med en tydlig rubrik

Brödtexten ska gå att läsa i lugn och ro: korta stycken, ett resonemang i taget och konkreta exempel. Ett stycke kan innehålla en [länk till en annan guide](/bostadsguider) och ord som är *betonade*.

- En punktlista samlar det viktigaste.
- Varje punkt är en egen tanke.
- Tre till fem punkter brukar räcka.

## Steg för steg

1. Första steget beskrivs här.
2. Sedan nästa.
3. Och till sist det tredje.

> **Bra att veta:** en ruta som den här lyfter fram något läsaren inte får missa.

### En underrubrik

Avsnitt kan delas upp med underrubriker när de blir långa. Mer exempeltext följer här för att visa radlängd och avstånd mellan stycken på en riktig sida.`;

interface DemoSeed {
  type: ContentType;
  slug: string;
  title: string;
  excerpt: string;
  category: ContentCategorySlug;
  coverImage: string;
  coverImageAlt: string;
  readingMinutes: number;
  publishedAt: string;
  featured?: boolean;
}

const SEEDS: DemoSeed[] = [
  {
    type: "guide",
    slug: "exempel-vad-kostar-det-att-kopa-bostad",
    title: "Vad kostar det egentligen att köpa en bostad?",
    excerpt: "Från kontantinsats och lagfart till pantbrev, månadsavgift och löpande utgifter – kostnaderna som kommer utöver priset.",
    category: "kopa-bostad",
    coverImage: "/images/bostadsguiden/gamla-stan-gata.jpg",
    coverImageAlt: "Kullerstensgata i Gamla stan i kvällssol med cyklar längs husväggen",
    readingMinutes: 8,
    publishedAt: "2026-10-06T08:00:00Z",
    featured: true,
  },
  {
    type: "guide",
    slug: "exempel-skuldsattning-i-en-brf",
    title: "Vad är skuldsättning i en BRF – och varför spelar den roll?",
    excerpt: "En enkel förklaring av vad föreningens lån innebär och hur de kan påverka din avgift över tid.",
    category: "brf-ekonomi",
    coverImage: "/images/brf-matter.png",
    coverImageAlt: "Flerbostadshus i kvällsljus med ett stigande diagram bredvid",
    readingMinutes: 6,
    publishedAt: "2026-10-05T08:00:00Z",
  },
  {
    type: "guide",
    slug: "exempel-valja-omrade",
    title: "Vad ska man tänka på när man väljer område?",
    excerpt: "Skolor, kommunikationer, service och framtida utveckling – frågorna som är värda att ställa innan du bestämmer dig.",
    category: "omraden",
    coverImage: "/images/bostadsguiden/tunnelbana.jpg",
    coverImageAlt: "Rulltrappor i en tunnelbanestation i Stockholm med blåmålat bergtak",
    readingMinutes: 7,
    publishedAt: "2026-10-04T08:00:00Z",
  },
  {
    type: "guide",
    slug: "exempel-varningssignaler-fore-budgivningen",
    title: "Varningssignaler att se upp med före budgivningen",
    excerpt: "Tecken i annonsen, på visningen och i föreningens papper som är värda en extra fråga innan du lägger bud.",
    category: "risker",
    coverImage: "/images/infrastructure.png",
    coverImageAlt: "Pendeltåg på väg ut ur en tunnel bredvid flerbostadshus på kvällen",
    readingMinutes: 5,
    publishedAt: "2026-10-03T08:00:00Z",
  },
  {
    type: "guide",
    slug: "exempel-lagfart-och-pantbrev",
    title: "Lagfart och pantbrev – vad betalar du och när?",
    excerpt: "Skillnaden mellan lagfart och pantbrev, när de blir aktuella och hur du räknar med dem i budgeten.",
    category: "kostnader",
    coverImage: "/hero-background.png",
    coverImageAlt: "Villaområde från ovan med prisuppgifter över husen",
    readingMinutes: 4,
    publishedAt: "2026-10-02T08:00:00Z",
  },
  {
    type: "guide",
    slug: "exempel-las-arsredovisningen",
    title: "Så läser du föreningens årsredovisning",
    excerpt: "Var siffrorna står, vilka delar som är värda mest tid och vad du kan fråga styrelsen om.",
    category: "brf-ekonomi",
    coverImage: "/images/bostadsguiden/stockholm-strandvagen.jpg",
    coverImageAlt: "Stenhus och båtar längs Strandvägen i Stockholm en solig dag",
    readingMinutes: 9,
    publishedAt: "2026-10-01T08:00:00Z",
  },
  {
    type: "guide",
    slug: "exempel-fran-lanelofte-till-tilltrade",
    title: "Från lånelöfte till tillträde",
    excerpt: "Köpet steg för steg: vad som händer när, vem som gör vad och vilka papper du behöver.",
    category: "kopa-bostad",
    coverImage: "/images/bostadsguiden/bussar.jpg",
    coverImageAlt: "Röda bussar uppställda sida vid sida i Stockholm, sedda ovanifrån",
    readingMinutes: 6,
    publishedAt: "2026-09-30T08:00:00Z",
  },
  {
    type: "insight",
    slug: "exempel-avgifterna-over-tid",
    title: "Så har föreningsavgifterna förändrats",
    excerpt: "En datadriven genomgång av hur avgifterna har rört sig – och vad som ligger bakom.",
    category: "brf-ekonomi",
    coverImage: "/understand-market.png",
    coverImageAlt: "Villa i skymning med en grafisk kurva över bostadsmarknaden",
    readingMinutes: 5,
    publishedAt: "2026-10-05T08:00:00Z",
    featured: true,
  },
  {
    type: "insight",
    slug: "exempel-rantan-och-bostadspriserna",
    title: "Räntan och bostadspriserna det senaste året",
    excerpt: "Vad siffrorna från Riksbanken och SCB säger om läget på bostadsmarknaden just nu.",
    category: "kostnader",
    coverImage: "/images/brf-matter.png",
    coverImageAlt: "Flerbostadshus i kvällsljus med ett stigande diagram bredvid",
    readingMinutes: 4,
    publishedAt: "2026-10-01T08:00:00Z",
  },
];

const DEMO_ITEMS: ContentItem[] = SEEDS.map((seed) => ({
  ...seed,
  id: `demo-${seed.slug}`,
  body: PLACEHOLDER_BODY,
  authorName: "Köpanalys",
  status: "published",
  featured: seed.featured ?? false,
  updatedAt: seed.publishedAt,
  seoTitle: null,
  seoDescription: null,
  canonicalUrl: null,
  socialImage: null,
  isDemo: true,
}));

/** The demo items of one type, newest first - or none when demo content is off. */
export function demoContent(type: ContentType): ContentItem[] {
  if (!contentDemoEnabled()) return [];
  return DEMO_ITEMS.filter((item) => item.type === type);
}
