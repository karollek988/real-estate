/**
 * The three ways to start an analysis: upload screenshots of the listing, fill in the details by hand, or
 * analyse just an area. (The texts around them - headings, the tabs - are in landing.ts.)
 *
 * The choices in the drop-down lists are written here in each language, but what is SAVED is always the
 * Swedish word (the code keeps that list): do not worry about it when translating.
 */
const forms = {
  screenshot: {
    dropTitle: "Ladda upp skärmdumpar av annonsen",
    /** {maxFiles} is the number of pictures allowed and {maxMb} the size limit of one picture: keep both. */
    dropHint: "PNG, JPEG eller WEBP · upp till {maxFiles} bilder · max {maxMb} MB/bild",
    /** The little x button after a picture's file name. {name} is the file name. */
    removeFile: "Ta bort {name}",
    submit: "Läs av bilder",
    submitting: "Läser av bilder...",
    manualInstead: "Fyll i uppgifterna manuellt istället",
    /** Shown only to help find faults; it can stay short. */
    ocrDebug: "Visa rå OCR-text (tillfälligt, för felsökning)",
    /** Shown above the filled-in form. {count} is how many fields were read from the pictures. */
    foundNotice: "Vi läste av {count, plural, one {# fält} other {# fält}} från dina skärmdumpar — kontrollera att de stämmer och fyll i resten.",
    nothingFoundNotice: "Vi kunde inte läsa av några uppgifter automatiskt från bilderna — fyll i formuläret nedan.",
    errors: {
      fileType: "Endast PNG-, JPEG- eller WEBP-bilder stöds.",
      fileSize: "Varje bild får vara max {maxMb} MB.",
      tooMany: "Max {maxFiles} bilder åt gången.",
      generic: "Något gick fel. Försök igen.",
    },
  },

  manual: {
    fields: {
      address: "Adress",
      propertyType: "Typ av bostad",
      propertyTypePlaceholder: "Välj typ",
      livingArea: "Boarea (m²)",
      rooms: "Antal rum",
      askingPrice: "Utgångspris (kr)",
      askingPriceHint: "Bostadens totala pris, inte pris per kvadratmeter.",
      monthlyFee: "Månadsavgift (kr)",
      operatingCosts: "Driftskostnader (kr/mån)",
      floor: "Våning",
      buildingYear: "Byggår",
      energyClass: "Energiklass",
      energyClassPlaceholder: "Välj klass",
      condition: "Skick",
      conditionPlaceholder: "Välj skick",
      balcony: "Balkong",
      elevator: "Hiss",
      parking: "Parkering",
      choose: "Välj",
      broker: "Mäklare",
      agency: "Mäklarbyrå",
      description: "Beskrivning",
    },
    /** The choices of "Typ av bostad". Bostadsrätt = a flat owned through a housing association (BRF); äganderätt = freehold; arrende = leasehold. */
    propertyTypes: {
      bostadsratt: "Bostadsrätt",
      aganderatt: "Äganderätt",
      arrende: "Arrende",
      bostadsrattNyproduktion: "Bostadsrätt (nyproduktion)",
    },
    conditions: {
      excellent: "Utmärkt",
      good: "Bra",
      okay: "Okej",
      needsRenovation: "Behöver renovering",
    },
    yes: "Ja",
    no: "Nej",
    /** Under the form: what the analysis includes (it uses up one Trygghetspaket from the account). */
    includes: "Drar ett Trygghetspaket: BRF-analys, områdesanalys och dolda kostnader för den här bostaden.",
    submit: "Analysera bostad",
    submitting: "Analyserar...",
    errors: {
      address: "Ange en adress för att analysera bostaden.",
      askingPrice: "Ange ett utgångspris för att analysera bostaden.",
      livingArea: "Ange boarean för att analysera bostaden.",
      monthlyFee: "Ange månadsavgiften för att analysera bostaden.",
    },
  },

  area: {
    /** {price} is the price of one area analysis in kronor, written by the code. */
    intro: "Skriv in en adress så analyserar vi området runt den: service, skolor, pendling och trygghet. Kostar {price} kr och dras från dina Områdesanalyser.",
    addressLabel: "Adress och ort",
    /** An example address in a Swedish town. */
    addressHint: "Till exempel Storgatan 12, Stockholm",
    submit: "Analysera området",
    submitting: "Analyserar...",
    errors: {
      address: "Ange adressen du vill analysera området runt.",
      needsCity: "Ange både gatuadress och ort, till exempel Storgatan 12, Stockholm.",
    },
  },

  /** Messages the browser writes itself when the server cannot be asked. */
  submit: {
    fallback: "Något gick fel. Försök igen.",
    unauthorized: "Logga in eller skapa ett konto för att fortsätta.",
  },

  /** The link in the error shown when the account has no analyses left. */
  goToStore: "Gå till butiken",
};

export default forms;
