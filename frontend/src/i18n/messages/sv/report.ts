/**
 * The analysis report (the page a customer opens after an analysis, also saved as a PDF): its chapters, the
 * sentences the report writes from the facts it collected, the tables' labels and the questions for the
 * viewing. The housing association chapter's own sentences are in brf.ts.
 *
 * The report never invents a fact: every sentence below either restates a collected value or explains why a
 * value is not available. Keep it that way in every language. Numbers, prices, dates and lists are written by
 * the code in the reader's language and handed in as {price}, {date}, {list} and so on.
 *
 * Plural forms use ICU: {count, plural, one {# punkt} other {# punkter}}.
 */
const report = {
  /** How values are written. {value} is the number, already grouped the way the language groups digits. */
  format: {
    na: "Uppgift saknas",
    sek: "{value} kr",
    sekPerM2: "{value} kr/m²",
    /** A distance: under a kilometre in metres, else in kilometres with one decimal. */
    meters: "{value} m",
    kilometers: "{value} km",
    percent: "{value} %",
    areaM2: "{value} m²",
    minutes: "{value} min",
    yes: "Ja",
    no: "Nej",
    /** An amount per year: "12 000 kr/år". {amount} is written by sek. */
    perYear: "{amount}/år",
    /** Used in the cover's list of facts: "3 rum". {count} is the number of rooms. */
    rooms: "{count} rum",
  },

  /** The "Källor" line at the end of a chapter. */
  sources: {
    heading: "Källor",
    /** Shown when a chapter used no connected source. */
    none: "Inga anslutna källor användes i det här kapitlet ännu.",
    reviewedAnnualReport: "Föreningens årsredovisning, granskad av Köpanalys",
    /** The short names of the sources, by their id. Place and company names are not translated. */
    names: {
      nominatim_geocoding: "OpenStreetMap",
      hemnet_page_scrape: "Hemnet",
      booli_listing: "Booli",
      scb_area_statistics: "SCB",
      osm_amenities: "OpenStreetMap",
      interest_rates: "Riksbanken",
      smhi_climate: "SMHI",
      infrastructure_projects: "Trafikverket",
      location_intelligence: "Polisen/Kolada/Skolverket m.fl.",
      market_intelligence: "Köpanalys marknadsanalys",
      brf_financials: "Föreningens årsredovisning",
      lantmateriet_address: "Lantmäteriet",
      municipality_plans: "Kommunen",
      skolverket_schools: "Skolverket",
      environmental_data: "Miljödata",
    },
    /** Why a source is not connected: a clause that follows a sentence, so it starts with a lower-case letter in Swedish. */
    notConnected: {
      school_ratings: "OpenStreetMap visar bara skolors förekomst, inte Skolverkets betygsresultat.",
      municipality_plans: "kommunala detaljplaner saknar en enhetlig nationell källa att hämta ifrån idag.",
      environmental_data: "flödesrisk, buller och luftkvalitet kräver en separat geodatakälla som inte är kopplad ännu.",
      lantmateriet_address: "kräver en nyckelbaserad koppling mot Lantmäteriet som inte är på plats ännu.",
    },
    /** {name} is the source's short name. */
    notConnectedGeneric: "Källan ({name}) är inte ansluten i dagsläget.",
  },

  /** The cover page. */
  cover: {
    /** The tag above the address on a full report and on an area-only report. */
    kindFull: "Trygghetspaket",
    kindArea: "Områdesanalys",
    leadFreehold: "En samlad genomgång av det som påverkar köpet: bostaden, området, riskerna och frågorna att ställa innan du bjuder.",
    leadAssociation: "En samlad genomgång av det som påverkar köpet: föreningens ekonomi, området, riskerna och frågorna att ställa innan du bjuder.",
    footer: "Kunskap före köp",
    /** The picture's description when the home has no address. */
    imageAlt: "Bostad",
  },

  chapters: {
    summary: { title: "Sammanfattning", sub: "Vad rapporten innehåller, vad som granskas och vad som saknas." },
    property: {
      title: "Fastighetsinformation",
      sub: "Samtliga tillgängliga uppgifter om bostaden. Fält som inte kunnat verifieras anges som Uppgift saknas.",
    },
    housingCost: { title: "Boendekalkyl", sub: "Vad bostaden kostar dig — varje månad och vid köpet." },
    association: { title: "Bostadsrättsförening", sub: "Föreningens ekonomi i klartext — granskad av Köpanalys." },
    area: { title: "Områdesanalys", sub: "Statistik och service i närområdet, baserat på tillgänglig data." },
    risks: { title: "Möjliga risker", sub: "Faktorer värda att undersöka vidare, baserat på tillgänglig data." },
    outlook: { title: "Framtidsutsikter", sub: "Ränteläge, sysselsättning och planerade projekt som kan påverka området framöver." },
    questions: {
      title: "Frågor inför visningen",
      subAssociation: "Det som är bra att fråga mäklaren och föreningen inför visningen och ett eventuellt bud.",
      subBroker: "Det som är bra att fråga mäklaren inför visningen och ett eventuellt bud.",
      source: "Sammanställt av Köpanalys",
    },
  },

  /** The summary chapter. */
  summary: {
    connectedSources: "Anslutna källor",
    /** {address}, {price}, {area}, {perM2}: the first sentence of the report. */
    priceWithArea: "{address} är utannonserad för {price} ({area} m², {perM2}).",
    priceOnly: "{address} är utannonserad för {price}.",
    noPrice: "{address} analyseras utan ett registrerat utgångspris.",
    /** {priceLine} is one of the three sentences above; {scope} one of the two below. */
    intro: "{priceLine} Rapporten samlar det som påverkar köpet på ett ställe: {scope}. Analysen baseras på {connected} av {total} anslutna datakällor.",
    scopeAssociation: "föreningens ekonomi, området och riskerna",
    scopeHome: "bostaden, området och riskerna",
    housingCost:
      "Boendekalkylen — vad bostaden kostar dig varje månad och vid köpet, inklusive avgifter som är lätta att missa — håller på att färdigställas och lanseras inom kort.",
    area: "Området — service, skolor, pendling och trygghet — beskrivs i kapitlet Områdesanalys.",
    outlook:
      "Vad som kan påverka området och bostadens värde framöver — ränteläge, sysselsättning och planerad utveckling i närområdet — beskrivs i kapitlet Framtidsutsikter.",
    /** {topics} is a list of the topics that could not be described, written by the code. */
    unresolved: "Följande kunde inte beskrivas fullt ut i denna omgång: {topics} — se respektive kapitel för vilka källor som saknas.",
    unresolvedTopics: {
      market: "marknadsläget",
      risk: "riskbilden",
      futureDevelopment: "planerad utveckling i närområdet",
    },
    allResolved: "Samtliga delar kunde beskrivas utifrån de datakällor som är anslutna idag.",
    questionsAssociation: "Frågor att ställa till mäklaren och föreningen finns i kapitlet Frågor inför visningen.",
    questionsBroker: "Frågor att ställa till mäklaren finns i kapitlet Frågor inför visningen.",
  },

  /** The property information chapter: every fact, with "Uppgift saknas" instead of a hidden row. */
  overview: {
    labels: {
      address: "Adress",
      municipality: "Kommun",
      postalCode: "Postnummer",
      propertyType: "Boendetyp",
      housingAssociation: "Bostadsrättsförening",
      apartmentNumber: "Lägenhetsnummer",
      floor: "Våning",
      rooms: "Antal rum",
      livingArea: "Boarea",
      additionalArea: "Biarea",
      lotArea: "Tomtstorlek",
      askingPrice: "Utgångspris",
      pricePerM2: "Pris per m²",
      monthlyFee: "Månadsavgift",
      operatingCosts: "Driftskostnader",
      buildingYear: "Byggår",
      renovationYear: "Senaste renovering",
      energyClass: "Energiklass",
      condition: "Skick",
      balcony: "Balkong",
      patio: "Uteplats",
      elevator: "Hiss",
      parking: "Parkering",
      garage: "Garage",
      storage: "Förråd",
      solarPanels: "Solceller",
      fireplace: "Öppen spis",
      mortgageDeed: "Pantbrev",
      newConstruction: "Nyproduktion",
      biddingOpen: "Öppen budgivning",
      previousSale: "Föregående försäljning",
      ownershipType: "Upplåtelseform",
      listingDate: "Annonsdatum",
      objectId: "Objekt-ID",
      floorplan: "Planritning",
      features: "Bekvämligheter",
    },
    groups: {
      address: "Adress & bostad",
      price: "Pris & avgifter",
      condition: "Skick & byggnad",
      amenities: "Bekvämligheter",
      sale: "Försäljning & mäklare",
    },
    /** The previous sale: {price}, and {date} when it is known. */
    previousSaleWithDate: "{price} ({date})",
    imagesTitle: "Se bilder och planritning",
    imagesText: "Bilder och planritning visas nedan.",
    description: "Beskrivning",
    images: "Bilder",
    floorplan: "Planritning",
    /** The kinds of home and ownership, in the language of the listing (Swedish), for readers of another language. */
    terms: {
      lagenhet: "Lägenhet",
      bostadsratt: "Bostadsrätt",
      bostadsrattNyproduktion: "Bostadsrätt (nyproduktion)",
      villa: "Villa",
      radhus: "Radhus",
      parhus: "Parhus",
      kedjehus: "Kedjehus",
      fritidshus: "Fritidshus",
      tomt: "Tomt",
      gard: "Gård",
      aganderatt: "Äganderätt",
      agarlagenhet: "Ägarlägenhet",
      arrende: "Arrende",
      utmarkt: "Utmärkt",
      bra: "Bra",
      okej: "Okej",
      renovering: "Behöver renovering",
    },
  },

  /** The area analysis chapter. */
  area: {
    /** {municipality} and {postalCode}. */
    locatedWithPostalCode: "Bostaden ligger i {municipality} ({postalCode}). Adressens läge är verifierat mot officiella kartkällor.",
    located: "Bostaden ligger i {municipality}. Adressens läge är verifierat mot officiella kartkällor.",
    notVerified: "Bostadens läge har inte kunnat verifieras mot en kommun i denna analys, vilket begränsar hur säkert kapitlet nedan kan bedöma området.",
    /** The sentence about price trend, population and income; {list} joins the parts. */
    contextIntro: "Området visar {list}, vilket ger en bild av det långsiktiga efterfrågeläget.",
    contextNone: "Ingen sammanställd statistik om prisutveckling, befolkning eller inkomst kunde hämtas för området i denna analys.",
    /** {trend} is a percentage with a sign; {period} when the trend has a period. */
    contextTrend: "en prisutveckling på {trend} bland närliggande sålda bostäder",
    contextTrendPeriod: "en prisutveckling på {trend} ({period}) bland närliggande sålda bostäder",
    contextPopulation: "en befolkningsförändring på {value} de senaste fem åren",
    /** {value} is the median income in thousands of kronor. */
    contextIncome: "en medianinkomst på {value} tkr per år",
    amenitiesIntro:
      "Närhet till vardagsservice påverkar både boendekvalitet och framtida efterfrågan — tabellen nedan visar vad som finns registrerat inom 1 km, hämtat från OpenStreetMap.",
    amenitiesNone: "Ingen data om närservice (butiker, skolor, restauranger, kollektivtrafik) kunde hämtas för denna adress i denna körning.",
    civicWith: "Se avsnittet Trygghet & samhälle nedan för statistik om brottslighet och valdeltagande i kommunen.",
    civicNone: "Statistik om trygghet och brottslighet kunde inte hämtas för denna adress i denna körning (Polisen/Kolada kräver att kommunen är verifierad).",
    schoolsNote:
      "Betygsresultat (andel godkända i årskurs 9 och andel behöriga till gymnasiet) visas endast för fristående skolor som drivs av en huvudman med enbart en skolenhet i kommunen — för kommunala skolor och skolkedjor med flera enheter finns ännu ingen tillförlitlig skolspecifik statistik i denna analys, se förklaring i kapitlets källor.",
    /** The service rows: the long name and its note, then the short name used in the grid. */
    amenities: {
      grocery: { label: "Matbutiker inom 1 km", short: "Matbutiker", note: "Antal registrerade i OpenStreetMap." },
      school: {
        label: "Skolor inom 1 km",
        short: "Skolor",
        note: "Förekomst enligt OpenStreetMap — se \"Skolor i närområdet\" nedan för namn, avstånd och betygsresultat.",
      },
      restaurant: { label: "Restauranger & caféer inom 1 km", short: "Restauranger", note: "Antal registrerade i OpenStreetMap." },
      park: { label: "Parker & grönområden inom 1 km", short: "Parker", note: "Antal registrerade i OpenStreetMap." },
      transit: { label: "Kollektivtrafikhållplatser inom 1 km", short: "Kollektivtrafik", note: "Förekomst, ej tidtabell — se förklaring nedan." },
      hospital: { label: "Vårdinrättningar inom 1 km", short: "Vårdinrättning", note: "Antal registrerade i OpenStreetMap." },
    },
    serviceHeading: "Service inom 1 km",
    commuteHeading: "Pendling",
    civicHeading: "Trygghet & samhälle",
    schoolsHeading: "Skolor i närområdet",
    preschools: "Förskolor",
    primarySchools: "Grundskolor",
    highSchools: "Gymnasieskolor",
    civic: {
      safetyIndex: "Trygghetsindex (Kolada, kommunnivå)",
      policeEvents: "Polisens händelser, senaste 30 dagarna (länsnivå)",
      voterTurnout: "Valdeltagande, senaste kommunvalet",
      note: "Trygghetsindex och valdeltagande avser hela kommunen (Kolada), inte adressen specifikt. Polisens händelser är en händelselogg på länsnivå, inte en brottsstatistik — se BRÅ:s officiella statistik för en fullständig bild.",
    },
    commute: {
      carTo: "Bil till {place}",
      transitTo: "Kollektivt till {place}",
      walkTo: "Gång till {place}",
    },
    /** A school's official results. <b> makes the figure bold. {value} is the percentage, {year} the school year. */
    school: {
      passedAll: "Godkänt i alla ämnen åk 9: <b>{value}%</b>",
      eligible: "Behöriga till gymnasiet: <b>{value}%</b>",
      source: "(läsår {year}, Skolverket)",
    },
  },

  /** The risks chapter: eight named categories. */
  risks: {
    categories: {
      market: { label: "Marknadsrisk", headline: "Efterfrågan på orten" },
      interest_rate: { label: "Ränterisk", headline: "Känslighet för förändrat ränteläge" },
      housing_association: { label: "Föreningsrisk", headline: "Föreningens ekonomiska stabilitet" },
      area: { label: "Områdesrisk", headline: "Service, tillgänglighet och läge" },
      fee: { label: "Avgiftsrisk", headline: "Risk för höjd månadsavgift" },
      environmental: { label: "Miljörisk", headline: "Buller, luftkvalitet och översvämningsrisk" },
      construction: { label: "Byggnadsrisk", headline: "Byggnadens ålder och underhållsbehov" },
      future: { label: "Framtidsosäkerhet", headline: "Osäkerhet i prognoser och planer" },
    },
    /** What the sentences say when a fact is missing or what it means. */
    buildingAgeMissing: "Byggår saknas för denna bostad, så underhållsrisken kan inte bedömas.",
    /** {year}, {age}, and {renovation} when a renovation is known. */
    buildingAgeRenovated: "Byggnaden uppfördes {year} ({age} år gammal), med en senare större renovering {renovation}.",
    buildingAgeNoRenovation: "Byggnaden uppfördes {year} ({age} år gammal); inga större renoveringar är kända.",
    rateMissing: "Ingen aktuell styrränta är kopplad till denna analys.",
    rateHigh: "Ett högt ränteläge ökar generellt refinansieringskostnaderna för både föreningen och de boende.",
    rateLow: "Ett lågt ränteläge håller generellt refinansieringskostnaderna på en mer hanterbar nivå.",
    rateMedium: "Styrräntan ligger för närvarande på en måttlig nivå.",
    /** {rate} is the policy rate as a percentage and {note} one of the three sentences above. */
    rateSentence: "Aktuell styrränta är {rate}. {note}",
    populationMissing: "Ingen befolkningsstatistik är kopplad till denna analys.",
    /** {change} is "ökat" or "minskat"; {value} a percentage. */
    populationSentence:
      "Befolkningen i kommunen har {direction, select, up {ökat} other {minskat}} med {value} % de senaste fem åren. Befolkningstillväxt förknippas generellt med starkare efterfrågan på bostäder, medan en minskande befolkning generellt förknippas med svagare efterfrågan.",
    amenityMissing: "Ingen data om närservice är kopplad till denna adress i denna analys.",
    /** {count} groceries registered. */
    amenityFewGrocery: "{count, plural, one {# matbutik registrerad} other {# matbutiker registrerade}} inom 1 km",
    amenityFewTransit: "{count, plural, one {# kollektivtrafikhållplats registrerad} other {# kollektivtrafikhållplatser registrerade}} inom 1 km",
    amenityLimited: "Begränsad närservice registrerad: {list}.",
    amenityEnough: "{grocery} matbutiker och {transit} kollektivtrafikhållplatser är registrerade inom 1 km.",
    noiseMissing: "Ingen data om vägbuller är kopplad till denna adress.",
    noiseSentence:
      "{count, plural, one {# större väg registrerad} other {# större vägar registrerade}} inom 1 km. Närhet till större vägar förknippas generellt med högre bullerexponering och sämre luftkvalitet.",

    market: {
      population: "{populationSentence} En bredare marknadsbild (ränteläge, sysselsättning) finns i kapitlet Framtidsutsikter.",
      none: "Inga marknadsindikatorer är kopplade till denna analys ännu.",
      conclusion: "Efterfrågeläget på orten är en faktor att väga in tillsammans med de övriga observationerna i denna analys.",
      conclusionNone: "Kan inte bedömas utan mer marknadsdata.",
    },
    interest: {
      conclusion: "Ränteläget påverkar både ditt eget bolån och föreningens kostnader, och därmed den löpande boendekostnaden.",
      conclusionNone: "Kan inte bedömas utan ränteuppgifter.",
    },
    association: {
      concerns: "BRF-analysen pekar ut {count, plural, one {# punkt} other {# punkter}} i föreningens ekonomi som är {count, plural, one {värd} other {värda}} en närmare titt.",
      none: "Inget av föreningens nyckeltal ligger utanför de nivåer som brukar räknas som normala.",
      conclusion: "Kapitlet Bostadsrättsförening förklarar varje nyckeltal och vad det betyder för dig.",
      conclusionWaiting: "Föreningens ekonomi beskrivs i kapitlet Bostadsrättsförening när granskningen är klar.",
      /** The line while the review is pending: {when} is the time it is due. */
      awaitingDue: "Bedöms i BRF-analysen, som granskas av Köpanalys experter och publiceras senast {when}.",
      awaiting: "Bedöms i BRF-analysen, som granskas av Köpanalys experter och publiceras så snart den är klar.",
    },
    areaRisk: {
      conclusion: "Närservicen påverkar vardagen och kan vara värd att uppleva på plats vid ett besök.",
      conclusionNone: "Kan inte bedömas utan data om närservice.",
    },
    fee: {
      drivers: "Det här i föreningens årsredovisning kan påverka avgiften framöver:",
      none: "Inga beslutade avgiftshöjningar, planerade större åtgärder eller svaga nyckeltal framgår av årsredovisningen.",
      conclusion: "Vad en ränte- eller avgiftshöjning skulle betyda i kronor för den här lägenheten står under Vad det betyder för dig i kapitlet Bostadsrättsförening.",
      conclusionWaiting: "Avgiftsrisken beskrivs när BRF-analysen är publicerad.",
    },
    environmental: {
      conclusion: "Buller- och miljöexponering kan vara värt att uppleva på plats, gärna vid olika tider på dygnet.",
      conclusionNone: "Endast delvis kartlagt — se ovan.",
    },
    construction: {
      ageMissing: "Byggår saknas för denna bostad, så underhållsrisk kan inte bedömas.",
      conclusion: "Byggnadens ålder och skick kan vara värt att undersöka närmare, till exempel via en besiktning.",
      conclusionNone: "Kräver uppgift om byggår.",
    },
    future: {
      one: "1 planerat eller pågående utvecklingsprojekt är känt",
      many: "{count} planerade eller pågående utvecklingsprojekt är kända",
      /** {known} is one of the two above. */
      explanation: "{known} i närområdet — de beskrivs i kapitlet Framtidsutsikter. Denna kategori beskriver istället den generella osäkerheten i framtidsprognoser.",
      none: "Ingen data om planerad utveckling i området är kopplad till denna analys.",
      conclusion:
        "Alla framåtblickande beskrivningar i denna rapport bygger på idag kända planer och trender — oförutsedda politiska, ekonomiska eller lokala beslut kan förändra bilden.",
    },
  },

  /** The outlook chapter. */
  outlook: {
    intro:
      "Den här sidan fokuserar på vad som kan påverka området och bostadens värde framöver. För nuvarande prisläge, befolkningsutveckling och inkomstnivå i området, se kapitlet Områdesanalys.",
    /** {value} is a number of percentage points, written by the code. */
    rateLowered: "Styrräntan har sänkts med {value} procentenheter det senaste året, vilket normalt stärker efterfrågan på bostäder.",
    rateRaised: "Styrräntan har höjts med {value} procentenheter det senaste året, vilket normalt dämpar efterfrågan.",
    rateStable: "Styrräntan har varit relativt stabil.",
    rateStableWith: "Styrräntan har varit relativt stabil ({rate}).",
    employment: "Kommunens sysselsättningsgrad är {value} %.",
    marketNone:
      "Makroekonomiska indikatorer (ränteläge, sysselsättning) är i dagsläget för begränsade för att ge en tillförlitlig marknadsprognos.",
    projectsMissing: "Ingen information om planerade infrastruktur- eller utvecklingsprojekt är kopplad till denna analys.",
    projectsZero: "Inga planerade eller pågående utvecklingsprojekt hittades i närområdet i de källor som är anslutna idag.",
    projectsOne: "1 planerat eller pågående utvecklingsprojekt har",
    projectsMany: "{count} planerade eller pågående utvecklingsprojekt har",
    /** {found} is one of the two above. */
    projectsFound:
      "{found} identifierats i närområdet. Nya infrastruktur- och utvecklingsprojekt i ett område förknippas generellt med en förändrad efterfrågan och prisnivå över tid.",
    uncertainty:
      "Prognoser om framtida värdeutveckling är alltid förenade med osäkerhet — ränteläge, makroekonomi och lokalt utbud/efterfrågan kan förändras på sätt som inte syns i dagens data. Bedömningen ovan ska läsas som en nulägesbild, inte en garanti.",
    macro: {
      policyRate: "Styrränta, 12 mån",
      /** Percentage points: "+0,25 p.e." */
      policyRateValue: "{value} p.e.",
      policyRateNow: "Nu {rate}",
      employment: "Sysselsättningsgrad",
      projects: "Planerade projekt",
    },
    projectsHeading: "Planerad utveckling i närområdet",
  },

  /** The last chapter. */
  questions: {
    broker: "Till mäklaren",
    association: "Till föreningen",
    notCovered: "Det här ingår inte i rapporten",
    brokerList: {
      knownFaults: "Finns det kända fel eller brister i bostaden som inte framgår av annonsen?",
      feeIncluded: "Vad ingår i månadsavgiften — till exempel värme, vatten, el eller bredband?",
      feeUnknown: "Vad är månadsavgiften, och vad ingår i den?",
      transferFees: "Vem betalar överlåtelseavgiften och pantsättningsavgiften enligt föreningens stadgar?",
      inspectionReport: "Finns det en överlåtelsebesiktning, och vad visade den?",
      mortgageDeeds: "Hur många pantbrev finns redan uttagna i fastigheten, och till vilket belopp?",
      operatingCosts: "Vad är driftskostnaden per år för el, värme, vatten och försäkring?",
      energyDeclaration: "Finns det en giltig energideklaration, och vilken energiklass har huset?",
      buildingYear: "Vilket år byggdes huset, och när gjordes den senaste större renoveringen?",
      /** {date} is the date of the previous sale. */
      previousSale: "Bostaden såldes senast {date} — vad har gjorts med den sedan dess?",
      whySelling: "Varför säljs bostaden?",
    },
    associationWaiting: {
      renovations: "Finns det planerade renoveringar, till exempel stambyte, eller beslutade avgiftshöjningar de kommande åren?",
      loans: "Hur ser föreningens lån ut — vilken ränta, och när ska lånen omförhandlas?",
      maintenancePlan: "Finns det en aktuell underhållsplan?",
      note: "Frågor anpassade efter just den här föreningens ekonomi visas här när BRF-analysen är granskad.",
    },
    notCoveredList: {
      survey: "Bostadens skick är inte besiktigat — rapporten ersätter inte en besiktning.",
      finances: "Ditt eget lånelöfte och din privatekonomi ingår inte.",
      value: "Rapporten bedömer inte vad bostaden är värd eller vad den kommer att säljas för.",
      housingCost: "Boendekalkylen med samtliga kostnader vid köpet lanseras inom kort.",
    },
  },

  /** The cost calculation chapter, while it is only an announcement. */
  housingCostPreview: {
    badge: "Lanseras inom kort",
    title: "Boendekalkylen håller på att färdigställas",
    lead: "Här kommer du att se vad bostaden kostar dig på riktigt, och inte bara priset i annonsen:",
    monthly: "Vad bostaden kostar dig varje månad: avgift eller driftskostnad, ränta och amortering vid olika räntenivåer.",
    oneOff: "Engångskostnaderna vid köpet — till exempel lagfart och pantbrev när du köper ett hus.",
    easyToMiss: "Avgifter som är lätta att missa, som överlåtelse- och pantsättningsavgift och kommande avgiftshöjningar i föreningen.",
  },

  /** The page around the chapters. */
  page: {
    /** The two small texts at the end of the last chapter. {version}, {date}, {engine}, {connected}, {total}. */
    footerFull: "Analys v{version} · genererad {date} · motor {engine} · {connected} av {total} datakällor anslutna.",
    footerArea: "Områdesanalys · genererad {date} · motor {engine} · {connected} av {total} områdeskällor anslutna.",
    association: {
      uploadNewer: "Har föreningen en nyare årsredovisning?",
      uploadNewerText: "Ladda upp den (PDF, Word eller foto) så granskar vi den och uppdaterar analysen inom 24 timmar.",
      upload: "Ladda upp föreningens årsredovisning",
      uploadText: "PDF, Word eller foto av årsredovisningen, högst 20 MB. Du får den av mäklaren eller föreningen.",
    },
    newAnalysis: "← Ny analys",
    downloadPdf: "Ladda ner PDF",
    /** The notice that an analysis is old. {days} is its age and {date} when it was last updated. */
    stale: {
      title: "Denna analys är {days} dagar gammal",
      text: "Marknads- och fastighetsdata kan ha ändrats. Senast uppdaterad {date}.",
    },
    done: {
      title: "Klar med analysen?",
      text: "Ladda ner hela rapporten som PDF för att spara eller dela den.",
    },
    inspection: {
      title: "Nästa steg: Visningsguiden (ingår i Trygghetspaketet)",
      text: "Fortsätt till vår visningsguide — den läser automatiskt in den här analysen och guidar dig genom förberedelser, genomgång och en slutlig sammanfattning.",
      action: "Fortsätt till visningsguiden",
    },
    update: {
      button: "Uppdatera analysen",
      updating: "Uppdaterar…",
      /** Shown when updating fails: this text was written in English from the start. */
      error: "Something went wrong. Please try again.",
    },
    /** A failed analysis. */
    failed: {
      titleInsufficient: "Vi kunde tyvärr inte slutföra analysen",
      title: "Analysen kunde inte slutföras",
      /** {address} is the home's address. */
      insufficient1:
        "Vi lyckades inte hämta in tillräckligt med tillförlitlig information om {address} för att kunna göra en analys du kan lita på. Vi är verkligen ledsna för det.",
      insufficient2:
        "Din analys har <b>inte förbrukats</b> — krediten är automatiskt återförd till ditt konto, så du kan använda den för att analysera en annan bostad istället.",
      insufficient3:
        "Vi jobbar löpande med att förbättra Köpanalys och kommer att undersöka varför just den här bostaden inte gick att analysera. Målet är att kunna erbjuda en analys för adressen längre fram, när vi löst det underliggande problemet.",
      other: "Något gick fel vid analysen av {address}. Kontakta oss gärna på {email} om problemet kvarstår.",
      home: "Tillbaka till startsidan",
      account: "Till mitt konto",
    },
  },
};

export default report;
