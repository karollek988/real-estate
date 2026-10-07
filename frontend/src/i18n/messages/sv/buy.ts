/**
 * The store ("Köp analyser"): the heading, the package cards' buttons, what the Trygghetspaket contains, the
 * steps, and the box with the account's balance. (The packages' own names and descriptions are in packages.ts.)
 *
 * {price}, {areaPrice} and {packagePrice} are prices in kronor filled in by the code;   is a space that
 * keeps "499 kr" on one line. Keep both.
 */
const buy = {
  /** Shown at the top when the visitor comes back from the payment page. */
  checkout: {
    success: "Ditt köp lyckades! Ditt saldo är uppdaterat och redo att användas.",
    cancel: "Betalningen avbröts. Inget drogs från ditt kort — försök gärna igen.",
  },

  hero: {
    /** <accent> is the underlined word. */
    title: "Kartan är gratis. <accent>Tryggheten</accent> kostar {price, number} kr.",
    text: "Ett bostadsköp är ofta det största du gör. Trygghetspaketet visar det som annonsen inte gör: hur föreningens ekonomi ser ut, hur området ser ut och vad bostaden kostar att äga. Vill du bara se området runt en bostad räcker en Områdesanalys för {areaPrice, number} kr.",
    pills: {
      oneOff: "Engångsköp – inget abonnemang",
      vat: "Alla priser inkl. moms",
      secure: "Säker betalning via Stripe",
    },
  },

  /** The two boxes that say what is free and what is paid. */
  free: { label: "Gratis · kommer snart", text: "Karta med annonser och kommunikation" },
  paid: { label: "Betalt", text: "Områdesanalys eller Trygghetspaket för dig som ska köpa" },

  choose: {
    title: "Välj paket",
    text: "Alla priser är engångsbetalningar inklusive moms.",
  },

  /** A package card's own texts (its name, price, list and button are in packages.ts). */
  card: {
    /** {note} is what the price covers: "en bostad". */
    priceNote: "{note} · engångsköp",
    creating: "Skapar betalning...",
    error: "Kunde inte skapa betalning.",
    genericError: "Något gick fel. Försök igen.",
  },
  discount: {
    ask: "Har du en rabattkod?",
    label: "Rabattkod",
    /** An example code: keep its shape. */
    placeholder: "KOP-XXXXX-XXXXX",
  },

  /** "Det här får du i Trygghetspaketet": three analyses, each introduced by the question it answers. */
  contents: {
    title: "Det här får du i Trygghetspaketet",
    text: "Tre analyser av en bostad, som svarar på de tre frågorna som är svårast att se i en annons.",
    brf: {
      name: "BRF-analys",
      question: "Är föreningen ekonomiskt stabil?",
      points: {
        debt: "Skuldsättning, sparande och räntekänslighet i klartext",
        meaning: "Vad föreningens ekonomi betyder för dig i kronor",
        plans: "Stambyte, tomträtt och planerade avgiftshöjningar",
        review: "Granskad av våra experter — klar inom 24 timmar",
      },
    },
    area: {
      name: "Områdesanalys",
      question: "Hur ser området ut?",
      points: {
        services: "Service, skolor och pendling nära bostaden",
        safety: "Trygghet och samhällsdata för området",
        development: "Hur priser och befolkning utvecklas",
        automatic: "Automatisk — klar direkt",
      },
    },
    hidden: {
      name: "Dolda kostnader",
      question: "Vad kostar det att äga bostaden?",
      points: {
        loans: "Din del av föreningens lån och hur avgiften påverkas av räntan",
        calc: "Boendekalkyl: månadskostnad och avgifter vid köpet",
        calcSoon: "Boendekalkyl med månadskostnad och avgifter vid köpet — lanseras inom kort",
      },
    },
    compare: {
      label: "Till jämförelse",
      price: "En husbesiktning kostar runt {price, number} kr.",
      text: "Trygghetspaketet kostar {packagePrice, number} kr och ersätter inte en besiktning. Du får svar på frågorna om föreningen, området och kostnaderna innan du lägger bud.",
      /** "Anticimex" is a company name. */
      source: "Besiktningspris: Anticimex, villa, 2026.",
    },
  },

  steps: {
    title: "Så går det till",
    pay: { title: "Betala en gång", text: "Du betalar med kort. Ingen bindningstid och inget abonnemang." },
    enter: {
      title: "Ange bostaden",
      text: "Ladda upp en skärmdump av annonsen för ett Trygghetspaket, eller skriv in en adress för en Områdesanalys.",
    },
    receive: {
      title: "Få din analys",
      /** {areaPromise} and {reviewPromise} are sentences from packages.ts. */
      text: "{areaPromise} {reviewPromise} Rapporten kan laddas ner som PDF.",
    },
  },

  /** The small print at the bottom. {priceFootnote} is a sentence from packages.ts. */
  footnote:
    "Priserna gäller engångsköp och anges i svenska kronor inklusive moms. {priceFootnote} Analysen är ett beslutsunderlag och ersätter inte en besiktning eller en egen genomgång av föreningens handlingar.",

  payment: {
    title: "Säker & krypterad betalning",
    /** Screen reader name of the row of card logos (Visa, Mastercard, Klarna: brand names stay). */
    label: "Betalningsmetoder",
  },
};

export default buy;
