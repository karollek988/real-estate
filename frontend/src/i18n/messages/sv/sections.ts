/**
 * The sections that make up the start page and are reused on other pages: "Så fungerar det" in three steps,
 * "Områden", the pointer to the knowledge pages, the contact form, the problem section and "Bra att veta".
 * (The price section and the comparison table are in pricing.ts, the FAQ in faq.ts.)
 *
 * <mail>...</mail> in a text becomes a link to the contact address: keep it.
 */
const sections = {
  howItWorks: {
    eyebrow: "Så fungerar det",
    title: "Från annons till beslutsunderlag i tre steg",
    description:
      "Vi står på köparens sida. Vi säljer inte bostaden och inte priset – vi ger dig det som är relevant för köpet, samlat på ett ställe.",
    steps: {
      find: {
        title: "Hitta en bostad",
        text: "Välj bostaden du är intresserad av och ta en skärmdump av annonsen – var den än ligger – eller fyll i uppgifterna själv.",
      },
      analyse: {
        title: "Vi analyserar bostaden",
        text: "Vi läser av annonsen och samlar data om föreningen, området och kostnaderna från flera oberoende källor.",
      },
      report: {
        title: "Få ett tydligt beslutsunderlag",
        text: "Du får allt som är relevant för köpet i en rapport, i klartext och med källorna angivna.",
      },
    },
    /** The green box under the steps: the bold sentence, then a sentence from packages.ts. */
    note: "Det mesta är klart på några minuter.",
    more: "Läs mer om hur det fungerar",
  },

  areas: {
    eyebrow: "Områden",
    title: "Lär känna området innan du lägger bud",
    /** A sentence from packages.ts ("Områdesanalysen är automatisk och klar på några minuter.") follows it. */
    lead: "Ange en adress så visar vi vad som finns runt den och hur området utvecklas.",
    cta: "Områdesanalys, {price, number} kr",
    explore: "Utforska kartan",
    panelTitle: "Det här visar områdesanalysen",
    /** What an area analysis covers, also shown on the area page. */
    topics: {
      services: { title: "Service inom 1 km", text: "Matbutiker, restauranger, parker och vård nära bostaden." },
      schools: { title: "Skolor i närområdet", text: "Skolorna runt adressen, från Skolverkets register." },
      commuting: { title: "Pendling", text: "Restid till centrum med bil och kollektivtrafik." },
      safety: { title: "Trygghet och samhälle", text: "Statistik om trygghet och samhällsdata för kommunen." },
      development: { title: "Hur området utvecklas", text: "Hur befolkning och priser i området utvecklas." },
    },
  },

  /** A small pointer to the blog, news and guides (their names come from nav.ts). */
  knowledge: {
    eyebrow: "Kunskap",
    title: "Bli tryggare inför ditt köp",
    text: "Guider, insikter och nyheter om bostadsmarknaden.",
  },

  contact: {
    eyebrow: "Kontakt",
    title: "Har du en fråga?",
    /** {email} is the contact address, shown as a link by <mail>. */
    text: "Har du en fråga, ett förslag eller något annat på hjärtat? Skicka ett meddelande så återkommer vi, eller mejla oss direkt på <mail>{email}</mail>.",
    success: {
      title: "Meddelande skickat!",
      text: "Tack för ditt meddelande. Vi återkommer så snart vi kan.",
      again: "Skicka ett till meddelande",
    },
    fields: {
      name: "Namn",
      namePlaceholder: "Ditt namn",
      email: "E-post",
      emailPlaceholder: "namn@exempel.se",
      message: "Meddelande",
      messagePlaceholder: "Ditt meddelande...",
    },
    submit: "Skicka meddelande",
    sending: "Skickar...",
    /** Shown when the form cannot be sent. <mail>...</mail> is a link to the contact address. */
    unavailable: "Kontakt via formulär är inte tillgänglig just nu — mejla oss direkt på <mail>{email}</mail> istället.",
  },

  problem: {
    eyebrow: "Det som inte står i annonsen",
    title: "Jag hittade bostaden. Men är det ett bra köp?",
    description: "Annonsen visar det säljaren vill att du ska se. Det som avgör om köpet håller hittar du sällan där.",
    questions: {
      debt: "Har föreningen för mycket lån per kvadratmeter?",
      pipes: "Väntar ett stambyte eller en avgiftshöjning?",
      communication: "Hur tillgänglig är kommunikationen?",
      costs: "Vad kostar köpet utöver priset?",
    },
    /** The dark box: {amount} is the title registration fee (lagfart) of the example house. */
    lagfart: {
      amount: "{amount, number} kr",
      /** {millions} is the example house's price in millions of kronor. */
      text: "i lagfart för ett hus som kostar {millions, plural, one {# miljon} other {# miljoner}}. Det står inte i annonsen.",
      /** {rate} is the stamp duty as a percentage (1.5) and {fee} the registration fee in kronor. Lantmäteriet is the land registry. */
      footnote: "Lagfart: {rate, number} % av köpeskillingen plus {fee, number} kr i avgift (Lantmäteriet).",
    },
  },

  info: {
    eyebrow: "Bra att veta",
    title: "Fatta beslut på fakta – inte magkänsla",
    description: "Tre saker som är svåra att bedöma på egen hand, men som vi belyser med fakta och jämförelser.",
    cards: {
      costs: {
        title: "Vad kostar köpet utöver priset?",
        description:
          "Lagfart, pantbrev, föreningens avgifter och kommande avgiftshöjningar syns sällan i annonsen – men de avgör vad bostaden faktiskt kostar dig.",
        points: {
          debt: "Din del av föreningens lån, räknat i kronor",
          rate: "Hur avgiften påverkas om räntan stiger",
        },
      },
      brf: {
        title: "Därför spelar BRF:en roll",
        description:
          "Föreningens ekonomi påverkar din månadskostnad mer än de flesta tror. Hög belåning per kvadratmeter kan betyda kraftiga avgiftshöjningar framöver.",
        points: {
          debt: "Skuldsättning, sparande och räntekänslighet",
          plans: "Stambyte, tomträtt och planerade avgiftshöjningar",
        },
      },
      infrastructure: {
        title: "Infrastruktur påverkar området",
        description:
          "Nya tunnelbanelinjer, pendeltågsstationer och stadsutvecklingsprojekt kan förändra ett område långt innan de står klara.",
        points: {
          projects: "Planerade projekt nära bostaden",
          travel: "Restider till centrum med bil och kollektivtrafik",
        },
      },
    },
  },
};

export default sections;
