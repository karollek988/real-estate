/**
 * The housing association ("bostadsrättsförening", BRF) chapter of the report: what the reviewer's figures
 * mean, in plain language. A Köpanalys reviewer records the key figures from the association's annual report
 * (årsredovisning); this file holds every sentence written about them - the verdict on each figure ("Hög
 * skuldsättning"), what the figure is, what is usually considered low or high, what it means in kronor for
 * the buyer, the questions to ask, and the notes around it.
 *
 * Numbers, kronor and percentages in these texts are written by the code in the reader's language and are
 * handed in as {value}, {amount}, {year} and so on. The benchmark texts (what is "low" or "high") contain
 * figures written in the text itself: write them the way your readers write numbers.
 * What the reviewer wrote by hand (the comment, planned renovations, the date a fee change takes effect) is
 * shown as the reviewer wrote it.
 */
const brf = {
  /** How amounts are written in these texts.   is a space that keeps the number and the unit on one line. */
  format: {
    kr: "{value} kr",
    krPerSqm: "{value} kr/kvm",
    percent: "{value} %",
    /** {sign} is "+" or "−" (or nothing). */
    signedKr: "{sign}{value} kr",
  },

  /** The chapter itself, as the page shows it. */
  analysis: {
    notApplicable: "Bostaden ingår inte i någon bostadsrättsförening, så det finns ingen föreningsekonomi att granska.",
    awaiting: {
      title: "BRF-analysen granskas av våra experter",
      overdue: "Granskningen tar lite längre tid än utlovat — analysen publiceras här så snart den är klar.",
      dueBy: "Klar senast {due}",
      within24: "Klar inom 24 timmar från beställningen",
      /** {association} is "Brf Exempelgårdens" (the name with an s) or "föreningens" when the name is not known. */
      body: "Föreningens ekonomi är den del av ett bostadsköp som är svårast att bedöma på egen hand, så den här delen läser vi inte bara av automatiskt. En av Köpanalys experter går igenom {association} årsredovisning, kontrollerar varje nyckeltal och förklarar vad siffrorna betyder för dig — innan analysen visas här. Övriga delar av rapporten är klara och kan läsas redan nu.",
      /** The association's name with the ending that makes it possessive ("Brf Exempelgården" -> "Brf Exempelgårdens"). */
      associationNamed: "{name}s",
      associationUnnamed: "föreningens",
      received: "Vi har tagit emot föreningens årsredovisning och granskar den nu.",
      notReceived: "Har du föreningens senaste årsredovisning? Ladda upp den nedan så går granskningen snabbare — annars tar vi fram den själva.",
      includedTitle: "Det här får du i BRF-analysen",
      included: {
        figures:
          "Föreningens skuldsättning, sparande och räntekänslighet — förklarade i klartext och jämförda med vad som brukar räknas som lågt och högt.",
        forYou: "Vad föreningens ekonomi betyder för dig i kronor: din del av föreningens lån och hur avgiften påverkas om räntan stiger.",
        plans: "Stambyte, planerat underhåll, tomträtt och beslutade avgiftshöjningar.",
        questions: "Frågor att ställa till föreningen och mäklaren.",
      },
    },
    reviewed: "Granskad av Köpanalys",
    /** {day} is the date it was published. */
    reviewedOn: "Granskad av Köpanalys · {day}",
    basis: "Underlag: årsredovisningen för {year}",
    updating: "En nyare årsredovisning granskas just nu.",
    updatingSoon: "Analysen uppdateras så snart granskningen är klar.",
    updatingDue: "Analysen uppdateras senast {due}.",
    strengths: "Det här ser bra ut",
    concerns: "Värt en närmare titt",
    forYou: "Vad det betyder för dig",
    keyFigures: "Nyckeltal",
    loans: "Föreningens lån",
    association: "Föreningen och underhållet",
    /** {list} is the figures the annual report does not state. */
    missing: "Årsredovisningen anger inte {list}.",
    expertComment: "Kommentar från granskaren",
    /** {sources} is the sentence "sources" below. */
    note: "Nyckeltalen är hämtade ur föreningens årsredovisning och kontrollerade av en granskare på Köpanalys. Bedömningarna jämför varje nyckeltal med vad som brukar räknas som lågt och högt; de är inget betyg på föreningen. {sources}",
    /** The upload box. */
    upload: {
      button: "Ladda upp årsredovisning",
      uploading: "Laddar upp…",
      reading: "Vi läser in dokumentet — det kan ta upp till en minut för en inskannad rapport.",
      success: "Tack! Årsredovisningen är mottagen och granskas av Köpanalys.",
    },
  },

  /** The sentence for the summary and the risks chapter. {day} is the date, {due} the time it is due. */
  status: {
    notApplicable: "Bostaden ingår inte i någon bostadsrättsförening, så det finns ingen föreningsekonomi att granska.",
    overdue:
      "BRF-analysen granskas av Köpanalys experter. Granskningen tar lite längre tid än utlovat — analysen publiceras i kapitlet Bostadsrättsförening så snart den är klar.",
    dueBy: "BRF-analysen granskas av Köpanalys experter innan den visas och publiceras i kapitlet Bostadsrättsförening senast {due}.",
    within24: "BRF-analysen granskas av Köpanalys experter innan den visas, och publiceras i kapitlet Bostadsrättsförening inom 24 timmar.",
    published: "BRF-analysen är granskad av Köpanalys{day}. {counts}",
    publishedDay: " ({day})",
    countsNone: "Inget av nyckeltalen ligger utanför de nivåer som brukar räknas som normala.",
    countsFew: "Årsredovisningen innehåller få av de nyckeltal som går att jämföra.",
    /** {list} is the first one or two points, written in lower case and joined with "och". */
    countsSome: "{count, plural, one {# punkt är värd} other {# punkter är värda}} en närmare titt, bland annat {list}.",
  },

  /** The chapter's opening lines. */
  intro: {
    named: "Bostaden tillhör {name}.",
    unnamed: "Föreningens namn framgår inte av annonsen; det kontrolleras i granskningen av årsredovisningen.",
    /** {kept} is the name used, {source} the other source and {rejected} the name it gave. */
    conflict:
      "Observera: datakällorna är oense om föreningens namn. Vi har använt \"{kept}\", medan en annan källa ({source}) angav \"{rejected}\" — kontrollera namnet mot föreningens stadgar.",
  },

  /** A time: "fredag 3 oktober kl. 14:30". {date} and {time} are written by the code. */
  dueTime: "{date} kl. {time}",

  /** Where the benchmarks come from; the date they were checked is part of the text. */
  sources:
    "Riktvärden: SBAB, HSB och Handelsbanken. Snittvärden: Nabos analys av 2 250 föreningars årsredovisningar för 2023. Definitioner: Bokföringsnämnden (BFNAR 2023:1). Uppgifterna kontrollerades i oktober 2026.",

  /** The mandatory key figures, as named in "Årsredovisningen anger inte ...". Lower case. */
  keyFigureNames: {
    annualFeePerSqm: "årsavgift per kvm",
    debtPerSqmBr: "skuldsättning per kvm upplåten med bostadsrätt",
    debtPerSqmTotal: "skuldsättning per kvm",
    savingsPerSqm: "sparande per kvm",
    interestSensitivityPct: "räntekänslighet",
    energyCostPerSqm: "energikostnad per kvm",
    feeShareOfRevenuePct: "årsavgifternas andel av rörelseintäkterna",
  },

  /** What each figure is called, how it is judged, what it means and what is usual. */
  signals: {
    debt: {
      label: "Skuldsättning per kvm",
      labelTotal: "Skuldsättning per kvm (total yta)",
      low: "Låg skuldsättning",
      normal: "Normal skuldsättning",
      high: "Hög skuldsättning",
      veryHigh: "Mycket hög skuldsättning",
      meaning:
        "Föreningens lån fördelade per kvadratmeter. Lånen betalas i praktiken av medlemmarna genom avgiften, så ju högre skuld, desto mer påverkas avgiften av räntan.",
      meaningNewBuilding:
        "I nyare föreningar är en högre skuld vanlig eftersom fastigheten nyss har finansierats — läs den tillsammans med sparandet och avgiften.",
      benchmark: "Under 5 000 kr/kvm brukar räknas som lågt, över 10 000 kr/kvm som högt och över 15 000 kr/kvm som mycket högt. Snittet var 7 117 kr/kvm år 2023.",
    },
    savings: {
      label: "Sparande per kvm",
      negative: "Negativt sparande",
      low: "Lågt sparande",
      moderate: "Måttligt sparande",
      good: "Gott sparande",
      meaning:
        "Hur mycket pengar föreningen får över per kvadratmeter och år till underhåll och amortering — årets resultat justerat för avskrivningar och planerat underhåll. Ett lågt sparande kan betyda att framtida underhåll behöver betalas med nya lån eller höjd avgift.",
      benchmark:
        "Över 200 kr/kvm brukar räknas som ett gott sparande och under 120–130 kr/kvm som lågt. Snittet var 123 kr/kvm år 2023, och knappt var femte förening hade negativt sparande.",
    },
    interestSensitivity: {
      label: "Räntekänslighet",
      low: "Låg räntekänslighet",
      normal: "Normal räntekänslighet",
      high: "Hög räntekänslighet",
      veryHigh: "Mycket hög räntekänslighet",
      /** {value} is a percentage. */
      meaning: "Om räntan på föreningens lån stiger med en procentenhet kan årsavgifterna behöva höjas med omkring {value}.",
      benchmark: "Under 5–6 % brukar räknas som lågt och över 10 % som högt. Snittet var omkring 10 % år 2023.",
    },
    fee: {
      label: "Årsavgift per kvm",
      low: "Låg avgiftsnivå",
      normal: "Normal avgiftsnivå",
      high: "Hög avgiftsnivå",
      veryHigh: "Mycket hög avgiftsnivå",
      meaning:
        "Medlemmarnas sammanlagda årsavgifter per kvadratmeter bostadsrättsyta. Nivån beror på vad som ingår i avgiften, till exempel värme, vatten, el och bredband.",
      meaningLow: "En låg avgift är bra för plånboken men kan också betyda att föreningen sparar för lite — jämför med sparandet.",
      benchmark: "Vanligt är 500–850 kr/kvm och år; över 1 000 kr/kvm brukar räknas som högt. Snittet var 690 kr/kvm år 2023.",
    },
    energy: {
      label: "Energikostnad per kvm",
      low: "Låg energikostnad",
      normal: "Normal energikostnad",
      high: "Hög energikostnad",
      veryHigh: "Mycket hög energikostnad",
      meaning: "Föreningens kostnader för värme, el och vatten per kvadratmeter. Höga energikostnader slår igenom på avgiften när energipriserna stiger.",
      benchmark: "Omkring 200 kr/kvm är normalt i ett flerbostadshus; över 250 kr/kvm brukar räknas som högt. Snittet var 203 kr/kvm år 2023.",
    },
    feeShare: {
      label: "Avgifternas andel av intäkterna",
      mostly: "Finansieras främst av avgifterna",
      other: "Har även andra intäkter",
      dependent: "Stort beroende av andra intäkter",
      meaning:
        "Hur stor del av föreningens intäkter som kommer från medlemmarnas årsavgifter. Resten kommer från till exempel hyror för lokaler, hyreslägenheter och parkering — sådana intäkter håller nere avgiften men kan minska om en hyresgäst flyttar.",
      benchmark: "I snitt kom 77 % av föreningarnas intäkter från årsavgifter år 2023.",
    },
    equity: {
      label: "Soliditet",
      low: "Låg soliditet",
      moderate: "Måttlig soliditet",
      high: "Hög soliditet",
      meaning:
        "Hur stor del av föreningens tillgångar som finansieras med eget kapital. Soliditeten säger mindre om en bostadsrättsförening än om ett företag, eftersom den påverkas av hur fastigheten köptes och skrivs av — läs den tillsammans med skuldsättning och sparande.",
    },
    totalDebt: {
      label: "Föreningens lån",
      verdict: "Räntebärande skulder",
      meaning: "Föreningens samlade lån hos banker och andra kreditinstitut vid bokslutet.",
    },
    averageRate: {
      label: "Genomsnittlig ränta",
      verdict: "Snittränta på lånen",
      meaning:
        "Den genomsnittliga räntan på föreningens lån vid bokslutet. När lån med lägre ränta omförhandlas till en högre ränta ökar föreningens kostnader.",
    },
    renegotiation: {
      label: "Lån som omförhandlas inom ett år",
      soon: "Stor del omförhandlas snart",
      share: "Andel med kort bindning",
      summary: "{value} av lånen omförhandlas inom ett år",
      meaning:
        "Den del av lånen vars ränta sätts om eller som förfaller inom tolv månader. Ju större andel, desto snabbare slår en ändrad ränta igenom på föreningens kostnader och avgiften.",
    },
    genuine: {
      label: "Äkta förening",
      yes: "Ja",
      yesVerdict: "Privatbostadsföretag",
      yesSummary: "Äkta förening (privatbostadsföretag)",
      yesMeaning: "Föreningen är ett privatbostadsföretag (en äkta förening). Vinsten vid en framtida försäljning beskattas med 22 %.",
      no: "Nej",
      noVerdict: "Oäkta förening",
      noSummary: "Oäkta förening — högre skatt vid försäljning",
      noMeaning:
        "Föreningen är inte ett privatbostadsföretag (en oäkta förening). Vinsten vid en framtida försäljning beskattas då med 25 % i stället för 22 %, och möjligheten till uppskov med skatten är begränsad.",
    },
    land: {
      label: "Marken",
      owned: "Äganderätt",
      ownedVerdict: "Föreningen äger marken",
      ownedSummary: "Föreningen äger marken",
      ownedMeaning: "Föreningen äger marken fastigheten står på och betalar ingen tomträttsavgäld.",
      leasehold: "Tomträtt",
      leaseholdVerdictYear: "Avgälden omförhandlas {year}",
      leaseholdVerdict: "Föreningen hyr marken",
      leaseholdSummaryYear: "Tomträtt — avgälden omförhandlas {year}",
      leaseholdSummary: "Tomträtt — föreningen hyr marken",
      leaseholdMeaning:
        "Föreningen äger inte marken utan betalar tomträttsavgäld till kommunen. Avgälden omförhandlas med jämna mellanrum och kan då höjas kraftigt, vilket slår igenom på avgiften.",
      leaseholdMeaningYear: "Nästa omförhandling sker {year}.",
    },
    maintenancePlan: {
      label: "Underhållsplan",
      yes: "Finns",
      yesVerdict: "Aktuell underhållsplan",
      yesSummary: "Aktuell underhållsplan finns",
      yesMeaning: "Föreningen har en aktuell plan för när de större åtgärderna i fastigheten behöver göras och vad de beräknas kosta.",
      no: "Saknas",
      noVerdict: "Ingen aktuell underhållsplan",
      noSummary: "Ingen aktuell underhållsplan",
      noMeaning: "Föreningen anger att den inte har en aktuell underhållsplan, så det är svårare att veta när större åtgärder kommer och vad de kostar.",
    },
    pipes: {
      label: "Stambyte",
      planned: "Planerat {year}",
      plannedVerdict: "Stambyte planerat",
      plannedSummary: "Stambyte planerat {year}",
      plannedMeaning:
        "Ett stambyte är en av de största åtgärderna i ett flerbostadshus. Det kan innebära höjd avgift eller nya lån, och att badrum och kök inte går att använda under en period.",
      done: "Genomfört {year}",
      doneVerdict: "Stambyte gjort",
      doneSummary: "Stambyte genomfört {year}",
      doneMeaning: "Rören i fastigheten är bytta, vilket är en av de största och dyraste åtgärderna i ett flerbostadshus.",
      unknown: "Framgår inte",
      unknownVerdict: "Inget stambyte angivet",
      unknownSummary: "Inget stambyte angivet i ett hus från {year}",
      unknownMeaning: "Huset är från {year}. Rör brukar behöva bytas efter ungefär 50 år, och årsredovisningen visar inte att stambyte är gjort eller planerat.",
    },
    plannedRenovations: {
      label: "Planerat underhåll",
      value: "Se beskrivning",
      verdict: "Större åtgärder planeras",
      summary: "Större underhållsåtgärder planeras",
    },
    feeChange: {
      appliedLabel: "Genomförd avgiftsförändring",
      appliedUp: "Avgiften har höjts",
      appliedDown: "Avgiften har sänkts",
      /** {direction} is up or down; {value} the percentage; {from} the date it took effect. */
      appliedSummary: "Avgiften {direction, select, up {höjdes} other {sänktes}} med {value} från {from}",
      appliedMeaning:
        "Enligt årsredovisningen {direction, select, up {höjdes} other {sänktes}} avgiften med {value} från {from}. Förändringen ingår troligen redan i avgiften i annonsen.",
      decidedLabel: "Beslutad avgiftsförändring",
      decidedUp: "Avgiften höjs",
      decidedDown: "Avgiften sänks",
      decidedSummary: "Beslutad avgifts{direction, select, up {höjning} other {sänkning}} på {value}",
      decidedSummaryFrom: "Beslutad avgifts{direction, select, up {höjning} other {sänkning}} på {value} från {from}",
      decidedMeaning: "Föreningen har beslutat att {direction, select, up {höja} other {sänka}} avgiften med {value}.",
      decidedMeaningFrom: "Föreningen har beslutat att {direction, select, up {höja} other {sänka}} avgiften med {value} från {from}.",
    },
    audit: {
      label: "Revisionsberättelsen",
      remark: "Anmärkning",
      remarkVerdict: "Revisorn har anmärkt",
      remarkSummary: "Anmärkning i revisionsberättelsen",
      remarkMeaning:
        "Revisorn har lämnat en anmärkning eller avstyrkt något i revisionsberättelsen. Det är ovanligt och betyder att något i förvaltningen eller redovisningen behöver förklaras.",
      clean: "Utan anmärkning",
      cleanVerdict: "Ren revisionsberättelse",
      cleanSummary: "Ren revisionsberättelse",
      cleanMeaning: "Revisorn har granskat räkenskaperna och styrelsens förvaltning utan att lämna någon anmärkning.",
    },
    size: {
      label: "Föreningens storlek",
      apartments: "{count} bostadsrätter",
      rentals: "{count} hyresrätter",
      commercial: "{count} lokaler",
      smallVerdict: "Liten förening",
      verdict: "Föreningens storlek",
      smallSummary: "Liten förening ({count} bostadsrätter)",
      smallMeaning:
        "I en liten förening delas kostnaderna för underhåll och oväntade utgifter på färre hushåll, så en enskild större kostnad märks mer på avgiften.",
      meaning:
        "Antalet lägenheter och lokaler i föreningen. Ju fler hushåll, desto fler delar på kostnaderna för underhåll och oväntade utgifter.",
      smallBenchmark: "Föreningar med färre än tio lägenheter brukar räknas som små.",
    },
  },

  /** What it means for this home in kronor. {amount}, {fee}, {area} are written by the code. */
  impacts: {
    shareOfDebt: {
      label: "Din del av föreningens lån",
      value: "cirka {amount}",
      explanation:
        "Föreningens lån betalas av medlemmarna genom avgiften. Räknat på lägenhetens boarea ({area} kvm) motsvarar din del ungefär {amount} — utöver ditt eget bolån. Den exakta andelen beror på lägenhetens andelstal.",
    },
    rateRise: {
      label: "Om räntan stiger 1 procentenhet",
      value: "{amount}/mån",
      explanation:
        "Med föreningens räntekänslighet på {sensitivity} kan avgiften behöva höjas med omkring {increase} i månaden (från {fee} till cirka {newFee}) om räntan på föreningens lån stiger med en procentenhet.",
    },
    feeChange: {
      label: "Beslutad avgiftsförändring",
      value: "{amount}/mån",
      explanation: "Den beslutade förändringen på {value}{from} ger en avgift på cirka {newFee} i månaden, jämfört med {fee} i annonsen.",
      /** " från 1 januari 2027": the date the reviewer wrote, with a space in front. */
      from: " från {date}",
    },
    ownFeeLevel: {
      label: "Lägenhetens avgift per kvm",
      value: "{amount} och år",
      explanation: "Lägenhetens avgift motsvarar {own} och år, jämfört med föreningens genomsnitt på {average}.",
      higher: "Det är tydligt högre än snittet, vilket kan bero på lägenhetens andelstal eller på att avgiften inkluderar mer, till exempel el eller bredband.",
    },
  },

  /** Questions for the board and the broker, made from the figures. */
  questions: {
    newerReport: "Finns det en nyare årsredovisning än den för {year}?",
    pipes: "När är stambytet planerat, och hur ska det finansieras — med sparade medel, nya lån eller höjd avgift?",
    leasehold: "När omförhandlas tomträttsavgälden nästa gång, och vad räknar föreningen med att den hamnar på?",
    maintenancePlan: "Finns det en aktuell underhållsplan, och vilka större åtgärder planeras de närmaste fem åren?",
    savings: "Hur ska föreningen betala framtida underhåll när sparandet är lågt?",
    loans: "Hur stor del av föreningens lån ska omförhandlas det närmaste året, och vilken ränta räknar styrelsen med?",
    genuine: "Är föreningen ett privatbostadsföretag (en äkta förening)?",
    audit: "Vad gällde revisorns anmärkning, och är frågan åtgärdad?",
    missing: "Årsredovisningen anger inte {list} — kan föreningen ta fram uppgifterna?",
    feeIncrease: "Finns det beslut eller planer på avgiftshöjningar som inte syns i årsredovisningen?",
  },

  /** The month names the reviewer may have written a date with ("1 januari 2027"); used to read such a date. Do not translate this list. */
  sourceMonths: "januari,februari,mars,april,maj,juni,juli,augusti,september,oktober,november,december",
};

export default brf;
