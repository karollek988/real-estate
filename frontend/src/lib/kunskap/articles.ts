import { formatSek } from "@/lib/pricing";
import {
  LAGFART_FEE_SEK,
  LAGFART_STAMP_DUTY_RATE,
  MAX_LOAN_TO_VALUE,
  PANTBREV_FEE_PER_DEED_SEK,
  PANTBREV_STAMP_DUTY_RATE,
  lagfartSek,
} from "@/lib/report/housingCost";

/**
 * The articles on /blogg and /guider. Written from what the product itself
 * relies on, so an article can never contradict a report:
 *  - BRF key figures and their low/high levels: lib/brf/interpret.ts
 *    (SBAB, HSB, Handelsbanken; Nabo's averages for 2023; BFNAR 2023:1) -
 *    change both together;
 *  - purchase costs and mortgage rules: lib/report/housingCost.ts (imported);
 *  - the questions for the viewing: lib/report/questions.ts and
 *    lib/inspection/types.ts.
 * Blogg holds tips and analyses, Guider the step-by-step guides.
 */

export type ArticleKind = "blogg" | "guide";

export type ArticleBlock =
  | { type: "p"; text: string }
  | { type: "h2"; text: string }
  | { type: "list"; ordered?: boolean; items: string[] }
  | { type: "figures"; items: { label: string; level: string; meaning: string }[] }
  | { type: "example"; title: string; text: string }
  | { type: "callout"; title: string; text: string };

export interface Article {
  slug: string;
  kind: ArticleKind;
  title: string;
  excerpt: string;
  category: string;
  readingMinutes: number;
  /** ISO date. */
  publishedAt: string;
  body: ArticleBlock[];
  sources?: string[];
}

const percent = (rate: number) => String(Math.round(rate * 1000) / 10).replace(".", ",");

const BRF_SOURCES = [
  "Riktvärden: SBAB, HSB och Handelsbanken.",
  "Snittvärden: Nabos analys av 2 250 bostadsrättsföreningars årsredovisningar för 2023.",
  "Definitioner av nyckeltalen: Bokföringsnämnden (BFNAR 2023:1).",
];

export const ARTICLES: Article[] = [
  {
    slug: "kopa-bostadsratt-steg-for-steg",
    kind: "guide",
    title: "Köpa bostadsrätt – steg för steg",
    excerpt: "Från lånelöfte till tillträde: de viktigaste stegen när du köper en bostadsrätt, och vad du bör kontrollera längs vägen.",
    category: "Köpprocessen",
    readingMinutes: 6,
    publishedAt: "2026-10-05",
    body: [
      {
        type: "p",
        text: "Att köpa en bostadsrätt är för de flesta den största affären i livet. Stegen är desamma oavsett om det är din första bostad eller din femte – men det är lätt att skynda förbi just de steg där de dyra misstagen görs. Här är de i ordning.",
      },
      { type: "h2", text: "1. Räkna på vad du har råd med" },
      {
        type: "p",
        text: `Börja med ett lånelöfte från banken. Det visar hur mycket du kan låna och behövs i regel innan du kan vara med i en budgivning. Bolånet får vara högst ${Math.round(MAX_LOAN_TO_VALUE * 100)} procent av bostadens värde, så minst ${Math.round((1 - MAX_LOAN_TO_VALUE) * 100)} procent betalar du själv i kontantinsats.`,
      },
      {
        type: "p",
        text: "Titta inte bara på priset. Det som avgör om bostaden fungerar för dig är månadskostnaden: ränta, amortering, avgiften till föreningen och driftskostnader som el och hemförsäkring. Lånar du mer än 70 procent av bostadens värde amorterar du 2 procent av lånet per år, mellan 50 och 70 procent amorterar du 1 procent.",
      },
      { type: "h2", text: "2. Läs annonsen – och leta efter det som saknas" },
      {
        type: "p",
        text: "Annonsen är säljarens beskrivning av bostaden. Notera avgiften, boarean, våningsplanet och byggåret, och leta efter det som inte står där: planerade renoveringar, beslutade avgiftshöjningar och om föreningen äger marken eller har tomträtt.",
      },
      { type: "h2", text: "3. Granska föreningens ekonomi" },
      {
        type: "p",
        text: "När du köper en bostadsrätt blir du medlem i en förening, och föreningens ekonomi påverkar din avgift i många år framåt. Be mäklaren om den senaste årsredovisningen. Sedan räkenskapsåret 2023 innehåller den samma nyckeltal i alla föreningar, så de går att jämföra – guiden om föreningens ekonomi visar hur du läser dem.",
      },
      { type: "h2", text: "4. Gå på visning med en plan" },
      {
        type: "p",
        text: "På visningen ser du bostaden och kan ställa frågor till mäklaren. Titta särskilt på badrum och kök, fönster och ventilation, och fråga om stambyte, planerat underhåll och avgiftshöjningar. Checklistan inför visningen hjälper dig att inte missa något.",
      },
      { type: "h2", text: "5. Budgivningen" },
      {
        type: "p",
        text: "I Sverige är bud på bostäder inte bindande, varken för dig eller för säljaren – köpet gäller först när överlåtelseavtalet är undertecknat. Bestäm din högsta nivå innan budgivningen börjar och håll dig till den.",
      },
      { type: "h2", text: "6. Avtal och handpenning" },
      {
        type: "p",
        text: "När ni är överens skriver ni ett överlåtelseavtal. I samband med det betalar du oftast en handpenning, vanligtvis tio procent av köpeskillingen. Föreningen ska också godkänna dig som medlem innan du kan flytta in.",
      },
      { type: "h2", text: "7. Tillträdet" },
      {
        type: "p",
        text: "På tillträdesdagen betalar du resten av köpeskillingen, banken betalar ut lånet och du får nycklarna. Bostadsrätten pantsätts som säkerhet för lånet, och föreningen kan ta ut en pantsättningsavgift och en överlåtelseavgift. Vem som betalar överlåtelseavgiften står i föreningens stadgar.",
      },
      {
        type: "callout",
        title: "Köpanalys hjälper dig med steg 2–4",
        text: "Vi samlar föreningens ekonomi i klartext, området och frågorna inför visningen i en rapport.",
      },
    ],
  },
  {
    slug: "granska-foreningens-ekonomi",
    kind: "guide",
    title: "Så granskar du föreningens ekonomi",
    excerpt: "Nyckeltalen som alla bostadsrättsföreningar måste redovisa – vad de betyder och vilka nivåer som brukar räknas som låga och höga.",
    category: "BRF",
    readingMinutes: 7,
    publishedAt: "2026-10-05",
    body: [
      {
        type: "p",
        text: "Föreningens ekonomi är det svåraste att bedöma när du köper en bostadsrätt – och ett av de viktigaste. Föreningens lån och underhåll betalas av medlemmarna genom avgiften, så en förening med svag ekonomi kan betyda höjda avgifter för dig.",
      },
      {
        type: "p",
        text: "Sedan räkenskapsåret 2023 måste alla bostadsrättsföreningar redovisa samma nyckeltal i årsredovisningen. Så läser du dem:",
      },
      {
        type: "figures",
        items: [
          {
            label: "Skuldsättning per kvm",
            meaning: "Föreningens lån fördelade per kvadratmeter. Ju högre skuld, desto mer påverkas avgiften av räntan.",
            level: "Under 5 000 kr/kvm brukar räknas som lågt, över 10 000 kr/kvm som högt och över 15 000 kr/kvm som mycket högt. Snittet var 7 117 kr/kvm år 2023.",
          },
          {
            label: "Sparande per kvm",
            meaning: "Det föreningen får över till underhåll och amortering. Ett lågt sparande kan betyda nya lån eller höjd avgift när underhållet kommer.",
            level: "Över 200 kr/kvm brukar räknas som ett gott sparande och under 120–130 kr/kvm som lågt. Snittet var 123 kr/kvm år 2023.",
          },
          {
            label: "Räntekänslighet",
            meaning: "Hur mycket årsavgifterna kan behöva höjas om räntan på föreningens lån stiger med en procentenhet.",
            level: "Under 5–6 % brukar räknas som lågt och över 10 % som högt. Snittet var omkring 10 % år 2023.",
          },
          {
            label: "Årsavgift per kvm",
            meaning: "Medlemmarnas sammanlagda årsavgifter per kvadratmeter. Nivån beror på vad som ingår, till exempel värme, vatten och bredband.",
            level: "Vanligt är 500–850 kr/kvm och år; över 1 000 kr/kvm brukar räknas som högt. Snittet var 690 kr/kvm år 2023.",
          },
          {
            label: "Energikostnad per kvm",
            meaning: "Föreningens kostnader för värme, el och vatten. De slår igenom på avgiften när energipriserna stiger.",
            level: "Omkring 200 kr/kvm är normalt i ett flerbostadshus; över 250 kr/kvm brukar räknas som högt. Snittet var 203 kr/kvm år 2023.",
          },
          {
            label: "Årsavgifternas andel av intäkterna",
            meaning: "Hur stor del av intäkterna som kommer från medlemmarnas avgifter. Resten, till exempel hyror för lokaler, håller nere avgiften men kan försvinna om en hyresgäst flyttar.",
            level: "I snitt kom 77 % av föreningarnas intäkter från årsavgifter år 2023.",
          },
        ],
      },
      { type: "h2", text: "Läs nyckeltalen tillsammans" },
      {
        type: "p",
        text: "Inget nyckeltal säger allt på egen hand. En hög skuld kan vara rimlig i en nybyggd förening med gott sparande, medan en låg avgift kan betyda att föreningen sparar för lite. Titta också på om föreningen har en underhållsplan, om stambytet är gjort och om avgiftshöjningar redan är beslutade.",
      },
      {
        type: "callout",
        title: "Låt en expert läsa årsredovisningen",
        text: "I Trygghetspaketet går en av våra experter igenom föreningens nyckeltal och förklarar vad de betyder för dig i kronor – klart inom 24 timmar.",
      },
    ],
    sources: BRF_SOURCES,
  },
  {
    slug: "infor-visningen",
    kind: "guide",
    title: "Inför visningen – det här ska du titta efter",
    excerpt: "Dokumenten att be om, vad du ska kontrollera på plats och frågorna att ställa till mäklaren.",
    category: "Visning",
    readingMinutes: 5,
    publishedAt: "2026-10-05",
    body: [
      {
        type: "p",
        text: "En visning är kort, och det är lätt att falla för ljuset och planlösningen. Med en plan får du ut mer av den – och vet vad du ska fråga om innan budgivningen.",
      },
      { type: "h2", text: "Före visningen: be om dokumenten" },
      {
        type: "list",
        items: [
          "Årsredovisningen – be mäklaren om den, eller sök på föreningens namn.",
          "Stadgarna – visar bland annat vem som betalar överlåtelse- och pantsättningsavgiften.",
          "Underhållsplanen – visar vad som ska renoveras och när, och risken för framtida avgiftshöjningar.",
          "Energideklarationen – finns hos Boverket och hör till fastigheten, inte säljaren.",
          "Planritningen – finns oftast redan i annonsen.",
        ],
      },
      { type: "h2", text: "På plats: titta efter" },
      {
        type: "list",
        items: [
          "Badrum och kök: tecken på fukt, missfärgningar och hur gamla installationerna är.",
          "Fönster och ventilation: kondens, drag och om ventilationen fungerar.",
          "Gemensamma utrymmen: trapphus, tvättstuga och förråd säger mycket om hur föreningen sköts.",
          "Ljud och ljus: gå gärna förbi en annan tid på dagen.",
        ],
      },
      { type: "h2", text: "Frågor till mäklaren" },
      {
        type: "list",
        items: [
          "Finns det kända fel eller brister i bostaden som inte framgår av annonsen?",
          "Vad ingår i månadsavgiften – till exempel värme, vatten, el eller bredband?",
          "Vem betalar överlåtelseavgiften och pantsättningsavgiften enligt föreningens stadgar?",
          "Finns det planerade renoveringar, till exempel stambyte, eller beslutade avgiftshöjningar de kommande åren?",
          "Hur ser föreningens lån ut – vilken ränta, och när ska lånen omförhandlas?",
          "Varför säljs bostaden?",
        ],
      },
      { type: "h2", text: "Köper du hus?" },
      {
        type: "p",
        text: "För villor, radhus och fritidshus gäller andra frågor: finns det en överlåtelsebesiktning och vad visade den, hur många pantbrev är redan uttagna och vad är driftskostnaden per år för el, värme, vatten och försäkring? En analys av uppgifterna ersätter aldrig en besiktning av husets skick.",
      },
      {
        type: "callout",
        title: "Visningsguiden i Trygghetspaketet",
        text: "Frågorna anpassas efter din bostad och föreningens ekonomi, och visningsguiden hjälper dig att anteckna det du ser, rum för rum.",
      },
    ],
  },
  {
    slug: "det-har-star-inte-i-annonsen",
    kind: "blogg",
    title: "Det här står inte i annonsen",
    excerpt: "Lagfart, pantbrev, föreningens lån och avgiftshöjningar – kostnaderna som avgör vad bostaden faktiskt kostar dig.",
    category: "Kostnader",
    readingMinutes: 4,
    publishedAt: "2026-10-05",
    body: [
      {
        type: "p",
        text: "Priset i annonsen är bara början. Flera av de kostnader som avgör om köpet håller syns sällan där – och några av dem är stora.",
      },
      { type: "h2", text: "Köper du hus: lagfart och pantbrev" },
      {
        type: "p",
        text: `När du köper ett hus betalar du lagfart till Lantmäteriet: ${percent(LAGFART_STAMP_DUTY_RATE)} procent av köpeskillingen (eller taxeringsvärdet, om det är högre) plus en avgift på ${formatSek(LAGFART_FEE_SEK)} kr. För ett hus för 4 miljoner kronor blir det ${formatSek(lagfartSek(4_000_000))} kr.`,
      },
      {
        type: "p",
        text: `Behöver du ta ut nya pantbrev för bolånet kostar de ${percent(PANTBREV_STAMP_DUTY_RATE)} procent av pantbrevens belopp plus ${formatSek(PANTBREV_FEE_PER_DEED_SEK)} kr per pantbrev. Fråga mäklaren hur många pantbrev som redan finns – de följer med fastigheten.`,
      },
      { type: "h2", text: "Köper du bostadsrätt: avgifter till föreningen" },
      {
        type: "p",
        text: "För en bostadsrätt betalar du ingen lagfart. Föreningen kan i stället ta ut en överlåtelseavgift och en pantsättningsavgift – högst 2,5 respektive 1 procent av prisbasbeloppet. Vem som betalar överlåtelseavgiften står i stadgarna.",
      },
      { type: "h2", text: "Din del av föreningens lån" },
      {
        type: "p",
        text: "Föreningens lån betalas av medlemmarna genom avgiften. Om föreningen har en skuld på 8 000 kr per kvadratmeter och din lägenhet är 60 kvadratmeter står du i praktiken för omkring 480 000 kr av föreningens lån – utöver ditt eget bolån.",
      },
      { type: "h2", text: "Avgiftshöjningar och stambyte" },
      {
        type: "p",
        text: "Ett stambyte är en av de största kostnaderna en förening har, och det betalas med sparade medel, nya lån eller höjda avgifter. Fråga om stambytet är gjort, när det planeras och om några avgiftshöjningar redan är beslutade – det står ofta i årsredovisningen men sällan i annonsen.",
      },
      { type: "h2", text: "Tomträtt" },
      {
        type: "p",
        text: "Äger föreningen inte marken utan har tomträtt betalar den en årlig avgift till kommunen, tomträttsavgäld, som kan höjas när den räknas om. Det påverkar föreningens kostnader och därmed din avgift.",
      },
      {
        type: "callout",
        title: "Allt på ett ställe",
        text: "Köpanalys samlar föreningens lån, beslutade avgiftsförändringar och vad en räntehöjning betyder för dig – i kronor.",
      },
    ],
    sources: ["Lagfart och pantbrev: Lantmäteriet.", "Överlåtelse- och pantsättningsavgift: bostadsrättslagen."],
  },
  {
    slug: "rantekanslighet",
    kind: "blogg",
    title: "Räntekänslighet – så påverkar räntan din avgift",
    excerpt: "Ett av de nya nyckeltalen visar hur mycket avgiften kan behöva höjas om föreningens räntor stiger. Så räknar du.",
    category: "BRF",
    readingMinutes: 4,
    publishedAt: "2026-10-05",
    body: [
      {
        type: "p",
        text: "När räntorna steg 2022 och 2023 höjde många bostadsrättsföreningar avgiften – vissa kraftigt. Hur hårt en förening påverkas beror på hur mycket den har lånat i förhållande till vad medlemmarna betalar. Det är vad räntekänsligheten mäter.",
      },
      { type: "h2", text: "Så räknas den ut" },
      {
        type: "p",
        text: "Räntekänsligheten visar hur många procent årsavgifterna skulle behöva höjas om räntan på föreningens lån steg med en procentenhet. Den räknas ut som föreningens räntebärande skulder delat med årsavgifterna.",
      },
      {
        type: "example",
        title: "Exempel",
        text: "En förening har lån på 30 miljoner kronor och tar in 2 miljoner kronor om året i avgifter. Stiger räntan med en procentenhet ökar räntekostnaden med 300 000 kr per år – 15 procent av avgifterna. Räntekänsligheten är 15 procent. Betalar du 4 000 kr i månaden kan avgiften behöva höjas med omkring 600 kr i månaden om föreningen låter hela räntehöjningen gå vidare till medlemmarna.",
      },
      { type: "h2", text: "Vad är högt och lågt?" },
      {
        type: "p",
        text: "Under 5–6 procent brukar räknas som lågt och över 10 procent som högt. Snittet bland svenska föreningar var omkring 10 procent år 2023.",
      },
      { type: "h2", text: "När slår räntan igenom?" },
      {
        type: "p",
        text: "En räntehöjning påverkar inte föreningen direkt om lånen har bunden ränta. Titta därför också på när föreningens lån ska omförhandlas – lån som förfaller inom ett år får snart den nya räntan. Det står i årsredovisningens not om skulder till kreditinstitut.",
      },
      {
        type: "callout",
        title: "Vi räknar ut det åt dig",
        text: "BRF-analysen i Trygghetspaketet visar vad din avgift blir om räntan stiger en procentenhet – för just din lägenhet.",
      },
    ],
    sources: BRF_SOURCES,
  },
  {
    slug: "varningssignaler-i-arsredovisningen",
    kind: "blogg",
    title: "Sju varningssignaler i årsredovisningen",
    excerpt: "Negativt sparande, hög skuld och lån som snart ska omförhandlas – så hittar du det som kan bli dyrt.",
    category: "BRF",
    readingMinutes: 5,
    publishedAt: "2026-10-05",
    body: [
      {
        type: "p",
        text: "En årsredovisning kan vara tjugo sidor lång, men de viktigaste varningssignalerna går att hitta på några minuter om du vet var du ska leta.",
      },
      {
        type: "list",
        ordered: true,
        items: [
          "Negativt sparande. Går föreningen back varje år efter underhåll och avskrivningar finns det inga pengar till kommande renoveringar. Knappt var femte förening hade negativt sparande år 2023.",
          "Mycket hög skuld. Över 15 000 kr per kvadratmeter brukar räknas som mycket högt. Jämför med sparandet – en nybyggd förening kan ha hög skuld men ett gott sparande.",
          "Hög räntekänslighet. Över 10 procent betyder att en räntehöjning snabbt kan slå igenom på avgiften.",
          "Lån som ska omförhandlas inom ett år. Då får föreningen snart dagens ränta på de lånen.",
          "Stambytet är inte gjort. I ett äldre hus där stammarna inte är bytta väntar en stor kostnad – se om den finns med i underhållsplanen.",
          "Anmärkning i revisionsberättelsen. Revisorn har hittat något som inte stämmer – läs vad det gäller.",
          "Ingen underhållsplan. Utan en plan är det svårt att veta vad som väntar och vad det kommer att kosta.",
        ],
      },
      {
        type: "p",
        text: "En enskild signal behöver inte betyda att föreningen är dålig, men den är värd en fråga till mäklaren eller styrelsen innan du lägger bud.",
      },
      {
        type: "callout",
        title: "Signalerna, sorterade åt dig",
        text: "BRF-analysen i Trygghetspaketet visar vad som ser bra ut och vad som är värt en närmare titt, med varje nyckeltal förklarat.",
      },
    ],
    sources: BRF_SOURCES,
  },
];

export function articlesOfKind(kind: ArticleKind): Article[] {
  return ARTICLES.filter((article) => article.kind === kind);
}

export function findArticle(kind: ArticleKind, slug: string): Article | undefined {
  return ARTICLES.find((article) => article.kind === kind && article.slug === slug);
}

/** Where an article lives: guides under /guider, the rest under /blogg. */
export function articleHref(article: Pick<Article, "kind" | "slug">): string {
  return article.kind === "guide" ? `/guider/${article.slug}` : `/blogg/${article.slug}`;
}

export function formatArticleDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  const months = ["januari", "februari", "mars", "april", "maj", "juni", "juli", "augusti", "september", "oktober", "november", "december"];
  return `${day} ${months[month - 1]} ${year}`;
}
