/**
 * The public pages: what each page says around its sections - the browser tab's title and description (the
 * text a search engine shows), the opening ("hero") and the smaller headings. One block per page, named after
 * what the page is about. The page's sections (the FAQ, the price cards, the contact form ...) have their
 * texts in their own files.
 *
 * `meta.title` is shown in the browser tab with the site's name after it ("Priser | Köpanalys"); keep it
 * short. `meta.description` is the summary a search engine shows under the title: about 150 characters.
 * {areaPrice}, {packagePrice} and {price} are prices in kronor filled in by the code: keep them.
 */
const pages = {
  howItWorks: {
    meta: {
      title: "Så fungerar det",
      description:
        "Från annons till beslutsunderlag: ladda upp en skärmdump av annonsen, kontrollera uppgifterna och få föreningens ekonomi, området och kostnaderna i klartext.",
    },
    eyebrow: "Så fungerar det",
    title: "Från annons till beslutsunderlag",
    lead: "Vi står på köparens sida. Vi säljer inte bostaden och inte priset – vi samlar det som avgör köpet och förklarar det i klartext.",
    createAnalysis: "Skapa analys",
    exampleReport: "Se exempelrapport",
    steps: {
      title: "Steg för steg",
      /** {areaPromise} is a sentence from packages.ts: "Områdesanalysen är automatisk och klar på några minuter." */
      lead: "Att skapa en analys tar vanligtvis mindre än en minut. {areaPromise}",
      price: "Vad kostar det?",
    },
    /** What happens when an analysis is created, step by step. */
    flow: {
      account: {
        title: "Skapa ett konto",
        text: "Registrera dig på några sekunder. Dina analyser sparas på ditt konto så att du kan gå tillbaka till dem.",
      },
      show: {
        title: "Visa oss bostaden",
        text: "Ladda upp en eller flera skärmdumpar av annonsen – från vilken bostadssajt som helst – eller fyll i uppgifterna själv. För en områdesanalys räcker en adress.",
      },
      check: {
        title: "Kontrollera uppgifterna",
        text: "Vi läser av de viktigaste uppgifterna åt dig. Du granskar och rättar dem innan analysen startar.",
      },
      report: {
        title: "Få din rapport",
        /** {reviewPromise} is a sentence from packages.ts: "BRF-analysen granskas av våra experter ..." */
        text: "Området, riskerna och frågorna inför visningen är klara på några minuter. {reviewPromise} Du får ett mejl när den är klar.",
      },
    },
    /** The buyer's whole way: Hitta - Analysera - Inspektera - Besluta (find, analyse, inspect, decide). */
    journey: {
      title: "Med dig hela vägen",
      lead: "Från bostaden du hittar till beslutet du fattar.",
      find: { title: "Hitta", text: "Utforska bostäder, köpare och byten på kartan.", cta: "Till kartan", note: "Förhandsversion" },
      analyse: { title: "Analysera", text: "Föreningens ekonomi, området och kostnaderna – i klartext.", cta: "Skapa analys" },
      inspect: { title: "Inspektera", text: "Frågorna att ställa och vad du ska titta efter på visningen.", cta: "Läs guiden" },
      decide: { title: "Besluta", text: "Ett samlat underlag med allt som påverkar köpet.", cta: "Se exempelrapporten" },
    },
  },

  pricing: {
    meta: {
      title: "Priser",
      description:
        "Områdesanalys {areaPrice, number} kr, Trygghetspaketet {packagePrice, number} kr per bostad. Engångspriser inklusive moms – inga abonnemang och ingen bindningstid.",
    },
    eyebrow: "Priser",
    title: "Du betalar en gång per bostad",
    lead: "Välj vad du vill veta: området runt en adress, eller hela bilden av bostaden du vill köpa – föreningens ekonomi, området och kostnaderna.",
    promises: {
      oneOff: "Engångspris inklusive moms",
      noSubscription: "Inga abonnemang",
      noBinding: "Ingen bindningstid",
      full: "Hela rapporten – inga låsta delar",
    },
    /** A heading only screen readers hear, above the three package cards. */
    packagesHeading: "Paket",
    compare: {
      title: "Jämför vad som ingår",
      lead: "Den som köper en hel analys får alltid hela rapporten. Områdesanalysen är en egen, kortare rapport om området runt en adress.",
    },
    faq: {
      title: "Frågor om köpet",
      description: "Betalning, vad som ingår och vad som händer om en analys inte går att slutföra.",
    },
  },

  areas: {
    meta: {
      title: "Områden – områdesanalys",
      description:
        "Service, skolor, pendling och trygghet runt en adress – och hur området utvecklas. Områdesanalys {price, number} kr, klar på några minuter.",
    },
    eyebrow: "Områden",
    title: "Lär känna området innan du bestämmer dig",
    /** {areaPromise}: "Områdesanalysen är automatisk och klar på några minuter." */
    lead: "Områdesanalysen visar vad som finns runt en adress och hur området utvecklas. {areaPromise}",
    start: "Starta en områdesanalys",
    explore: "Utforska kartan",
    compare: "Jämför med Trygghetspaketet",
    topicsTitle: "Det här visar områdesanalysen",
    ready: {
      title: "Klar på några minuter",
      text: "Helt automatisk, med källan till varje uppgift angiven. Föreningens ekonomi ingår i Trygghetspaketet.",
    },
    startTitle: "Starta en områdesanalys",
    howTo: {
      address: "Skriv in gatuadress och ort, till exempel Storgatan 12, Stockholm.",
      cost: "Analysen dras från dina Områdesanalyser – {price, number} kr styck.",
      ready: "Rapporten om området är klar på några minuter.",
    },
    /** Screen reader name of the two big links at the bottom. */
    exploreLabel: "Utforska vidare",
    map: { badge: "Förhandsversion", title: "Utforska kartan", text: "Bostäder, köpare och byten på kartan" },
    trends: { title: "Prisutveckling och trender", text: "Styrränta, bostadspriser och inflation i siffror" },
    faq: {
      title: "Frågor om områdesanalysen",
      description: "Det här undrar de flesta om områdesanalysen.",
    },
  },

  createAnalysis: {
    meta: {
      title: "Skapa analys",
      description:
        "Ladda upp en skärmdump av bostadsannonsen, fyll i uppgifterna själv eller ange en adress för en områdesanalys – så tar vi fram underlaget.",
    },
    how: { title: "Så går det till", more: "Läs mer om hur det fungerar" },
    cost: {
      title: "Vad kostar det?",
      text: "Analysen dras från ditt saldo. Har du inget kvar köper du ett paket – en gång per bostad.",
    },
  },

  contact: {
    meta: {
      title: "Kontakt",
      /** {email} is the contact address. */
      description: "Har du en fråga om Köpanalys eller din analys? Skicka ett meddelande eller mejla {email}.",
    },
    title: "Kontakta oss",
  },

  map: {
    meta: {
      title: "Karta – bostäder, köpare och byten",
      description:
        "Utforska bostäder till salu, köpare som söker och bostadsbyten på kartan. En förhandsversion av Köpanalys karta.",
    },
    /** The page's heading, which only screen readers and search engines see. */
    title: "Karta",
  },

  priceTrends: {
    meta: {
      title: "Prisutveckling och trender på bostadsmarknaden",
      description:
        "Styrränta, bostadspriser, kvadratmeterpriser och inflation – hämtade direkt från Riksbanken, SCB och Svensk Mäklarstatistik.",
    },
    eyebrow: "Prisutveckling",
    title: "Prisutveckling och trender",
    lead: "Styrräntan, bostadspriserna, kvadratmeterpriserna och inflationen – siffrorna som styr bostadsmarknaden, hämtade direkt från Riksbanken, SCB och Svensk Mäklarstatistik.",
    meaning: {
      title: "Vad betyder siffrorna för dig?",
      lead: "Marknadens siffror förklarar läget, men det är bostaden och föreningen som avgör vad just ditt köp kostar.",
      policyRate: {
        title: "Styrräntan",
        text: "Riksbankens styrränta påverkar bankernas räntor – både på ditt bolån och på föreningens lån. Därför är föreningens räntekänslighet värd att känna till.",
        link: "Läs om räntekänslighet",
      },
      prices: {
        title: "Bostadspriserna",
        text: "Prisindex visar hur priserna har utvecklats i stort. Det säger inget om en enskild bostad, men ger en bild av marknaden du köper i.",
      },
      squareMetre: {
        title: "Kvadratmeterpriset",
        text: "Ett genomsnittligt kvadratmeterpris är en riktpunkt. Vad en enskild bostad kostar beror på läge, skick och förening.",
      },
      inflation: {
        title: "Inflationen",
        text: "Inflationen påverkar räntan och föreningens kostnader för till exempel energi och underhåll – och därmed avgiften.",
      },
    },
    analyseArea: "Analysera ett område",
    latestNews: "Senaste nyheterna om marknaden",
  },

  news: {
    meta: {
      title: "Nyheter om bostadsmarknaden",
      description:
        "Senaste nytt om räntor, bostadspriser och beslut som påverkar din nästa bostad – från Riksbanken, SVT och Dagens industri.",
    },
    eyebrow: "Nyheter",
    title: "Nyheter om bostadsmarknaden",
    lead: "Räntor, priser och beslut som påverkar din nästa bostad – de senaste uppdateringarna, samlade på ett ställe.",
    /** Screen reader name of the two links under the news. */
    moreLabel: "Mer att läsa",
    next: {
      prices: { title: "Prisutveckling", text: "Styrränta, bostadspriser och inflation i siffror." },
      guides: { title: "Guider", text: "Steg för steg till ett tryggare köp." },
    },
  },

  blog: {
    meta: {
      title: "Blogg – tips, guider och analyser",
      description:
        "Det som är bra att veta när du ska köpa bostad: föreningens ekonomi, kostnaderna som inte står i annonsen och hur räntan påverkar avgiften.",
    },
    eyebrow: "Blogg",
    title: "Tips, guider och analyser",
    lead: "Det som är bra att veta när du ska köpa bostad – föreningens ekonomi, kostnaderna som inte står i annonsen och hur räntan påverkar din avgift.",
    /** A heading only screen readers hear, above the articles. */
    articlesHeading: "Artiklar",
    guides: { title: "Guider", text: "Steg för steg till ett tryggare köp.", all: "Alla guider" },
    news: {
      title: "Nyheter om bostadsmarknaden",
      text: "Räntor, priser och beslut som påverkar din nästa bostad.",
      cta: "Till nyheterna",
    },
  },

  guides: {
    meta: {
      title: "Guider – steg för steg till ett tryggare köp",
      description:
        "Guider för dig som ska köpa bostad: köpprocessen steg för steg, föreningens ekonomi och vad du ska titta efter på visningen.",
    },
    eyebrow: "Guider",
    title: "Steg för steg till ett tryggare köp",
    lead: "Från lånelöfte till tillträde: guider som hjälper dig att förstå föreningen, området och kostnaderna innan du lägger bud.",
    /** A heading only screen readers hear, above the guides. */
    allGuidesHeading: "Alla guider",
    fromBlog: {
      title: "Från bloggen",
      text: "Tips och analyser om föreningar, räntor och kostnader.",
      cta: "Till bloggen",
    },
  },
};

export default pages;
