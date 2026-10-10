/**
 * The public map (/karta): the loading and error lines, the search bar, the lists of listings, the forms for adding
 * a listing, the detail panel, and the example listings the map starts with.
 *
 * The map is built by plain code (src/components/admin/atlas/atlas.ts), which asks for these texts by their key.
 * Where a text has {something} in it, the code writes that part: keep it in the translation.
 * The example listings (`samples`) are made up: translate them freely, keep the meaning. A listing a visitor adds
 * is shown exactly as they wrote it, in whatever language they wrote it.
 */
const map = {
  loading: "Laddar kartan…",
  failed: "Kartan kunde inte laddas. Ladda om sidan och försök igen.",
  /** Shown in the map's hint line when the listings could not be fetched. */
  loadFailed: "Annonserna kunde inte hämtas just nu. Ladda om sidan för att försöka igen.",

  search: { placeholder: "Sök plats eller pin...", label: "Sök plats eller pin", button: "Sök" },
  notice: {
    title: "Karta",
    badge: "Förhandsversion",
    text: "Kartan visar exempelannonser och annonser som användare har lagt upp. Logga in för att lägga upp en egen.",
  },
  myListings: "Mina annonser",
  locate: "Visa min position",

  /** The list beside the map. */
  closeList: "Stäng listan",
  showList: "Visa annonslistan",
  eyebrow: "Karta",
  heading: "Bostadsmarknaden",
  intro: "Översikt över Sveriges bostadsmarknad. Här kan du se bostäder till salu och köpförfrågan.",
  create: "Skapa annons",
  /** The three kinds of listing. */
  kinds: { sale: "Till salu", buyer: "Köpare söker", exchange: "Byter bostad" },
  filter: "Filtrera kartan",
  osmData: "OpenStreetMap data",
  about: "Om",
  empty: {
    sale: "Inga bostäder ännu.",
    saleHint: "Klicka på kartan för att lägga till en.",
    buyer: "Inga köpare ännu.",
    exchange: "Inga bytesförfrågningar ännu.",
  },

  /** On the map. */
  hint: "Klicka för att lägga till ett pin.",
  hintPick: "Klicka på kartan för att välja plats.",
  zoomIn: "Zooma in",
  zoomOut: "Zooma ut",
  style: { toSatellite: "Byt till satellitkarta", satellite: "Satellit", toMap: "Byt till vanlig karta", map: "Karta" },
  transit: { show: "Visa tåg- och tunnelbanelinjer", title: "Tåg- och tunnelbanelinjer", hide: "Dölj tåg- och tunnelbanelinjer" },
  /** {n} is the listing's number in its list. */
  tooltips: { buyer: "Köpare {n}. {title}", exchange: "Byte {n}: {title}", exchangeTo: "Byte {n}: vill bo i {place}" },
  close: "Stäng",

  /** The panel that opens when a listing is chosen. */
  detail: {
    photoOf: "Foto av {title}",
    viewListing: "Se annonsen",
    requestActive: "Förfrågan aktiv",
    contact: "Kontakt",
    /** The subject of the e-mail to Köpanalys about a listing. */
    contactSubject: "Kontakt om {title}",
    createAnalysis: "Skapa analys",
    openInGoogleMaps: "Öppna i Google Maps",
    saleMeta: "Kontakta säljaren för fler uppgifter",
    saleDetails: "Se annonsen för fullständig information om bostaden.",
    requestMeta: "Detaljerad förfrågan",
    requestDetails: "Kontakta personen för mer information om önskemål och tidsplan.",
    livesNow: "Bor nu",
    wantsToLive: "Vill bo",
    currentPlace: "Nuvarande plats",
    wantedPlace: "Önskad plats",
    /** Under a listing that a visitor wrote in another language, shown translated. */
    translated: "Översatt automatiskt.",
    showOriginal: "Visa originalet",
    showTranslation: "Visa översättningen",
    /** Shown to the owner of a listing that the team has hidden. */
    hiddenNotice: "Den här annonsen är dold av Köpanalys och syns bara för dig.",
  },

  /**
   * The lite area analysis in a sale listing: how to get around. Facts only: a name and a straight-line distance.
   * {km} is the distance searched, as a number.
   */
  transport: {
    title: "Kommunikationer",
    bus: "Närmaste busshållplats",
    train: "Närmaste tågstation",
    missing: "Uppgift saknas – ingen inom {km} km",
    source: "Källa: Trafiklab och andra öppna trafikdata via Transitous. Avstånd i fågelvägen.",
    loading: "Hämtar uppgifter om kollektivtrafik…",
    unavailable: "Uppgifterna om kollektivtrafik kunde inte hämtas just nu. De hämtas igen nästa gång du öppnar annonsen.",
  },

  /** The form for adding or changing a listing. */
  form: {
    eyebrow: "Ny kartmarkering",
    titles: { sale: "Lägg till bostad till salu", buyer: "Lägg till köpare", exchange: "Lägg till bytesförfrågan", edit: "Redigera annons" },
    pinType: "Typ av pin",
    heading: "Rubrik",
    headingPlaceholder: "t.ex. Villa nära centrum",
    place: { sale: "Plats eller område", buyer: "Önskat område", exchange: "Bor nu (plats)" },
    placePlaceholder: "t.ex. Eslövs kommun",
    pickOnMap: "Välj plats på kartan",
    optional: "valfritt",
    imageLink: "Bildlänk",
    imageUpload: "Ladda upp bild",
    removeImage: "Ta bort bild",
    saleMeta: "Pris, storlek och rum",
    saleMetaPlaceholder: "t.ex. 3 rum · 78 m² · 2 495 000 kr",
    saleLink: "Annonslänk",
    saleDescription: "Beskrivning",
    saleDescriptionPlaceholder: "Beskriv bostaden kort",
    buyerMeta: "Budget och önskemål",
    buyerMetaPlaceholder: "t.ex. Budget upp till 3 000 000 kr · 2–3 rum",
    buyerMore: "Mer information",
    buyerMorePlaceholder: "Vad söker köparen? Berätta om läge, storlek och tidsplan.",
    exchangeMeta: "Erbjuder och söker",
    exchangeMetaPlaceholder: "t.ex. Erbjuder 3 rum · Söker 4+ rum",
    exchangeWantsToLive: "Vill bo i",
    exchangeWantsPlaceholder: "t.ex. Uppsala",
    exchangeInfo: "Bytesinformation",
    exchangeInfoPlaceholder: "Beskriv bostaden som erbjuds och vad personen vill byta till.",
    save: "Spara pin",
    saveChanges: "Spara ändringar",
    saving: "Sparar…",
    /** Shown when the site refused to save a listing without saying why. */
    saveFailed: "Annonsen kunde inte sparas. Försök igen.",
    searching: "Söker plats...",
    fetchingAddress: "Hämtar adress...",
    /** {place} is what the visitor typed. */
    placeNotFound: "Kunde inte hitta platsen \"{place}\". Försök med en annan sökning.",
  },

  /** The visitor's own listings. */
  mine: {
    eyebrow: "Mitt konto",
    heading: "Mina annonser",
    edit: "Redigera",
    remove: "Ta bort",
    confirmRemove: "Vill du ta bort den här annonsen?",
    empty: "Du har inte lagt till några annonser ännu.",
    emptyHint: "Klicka på \"Skapa annons\" för att komma igång.",
    /** After the kind of a listing that the team has hidden. */
    hidden: "dold",
  },

  samples: {
    sale: {
      "1": { note: "Eslövs kommun", details: "Ljus 3:a nära centrum med balkong och låg månadsavgift.", meta: "3 rum · 78 m² · 2 495 000 kr" },
      "2": { note: "Trollhättans kommun", details: "Renoverad bostad med centralt läge och närhet till resecentrum.", meta: "2 rum · 64 m² · 1 895 000 kr" },
      "3": { note: "Södermalm, Stockholm", details: "Sekelskifteslägenhet med högt i tak och stuckatur, gångavstånd till Slussen.", meta: "3 rum · 72 m² · 5 250 000 kr" },
      "4": { note: "Vasastan, Stockholm", details: "Ljus tvåa i klassisk fastighet med nära till Vasaparken och tunnelbana.", meta: "2 rum · 58 m² · 4 100 000 kr" },
      "5": { note: "Östermalm, Stockholm", details: "Exklusiv våning med sjöutsikt, öppen spis och privat loftgång.", meta: "4 rum · 135 m² · 12 900 000 kr" },
      "6": { note: "Kungsholmen, Stockholm", details: "Genomgående trea med balkong i två väderstreck och renoverat kök.", meta: "3 rum · 81 m² · 6 450 000 kr" },
      "7": { note: "Gamla Stan, Stockholm", details: "Charmig tvåa i medeltida kvarter med synliga takbjälkar.", meta: "2 rum · 55 m² · 4 950 000 kr" },
      "8": { note: "Bromma, Stockholm", details: "Rymlig villa med stor trädgård, dubbelgarage och nära till skola.", meta: "5 rum · 140 m² · 8 900 000 kr" },
      "9": { note: "Solna, Stockholm", details: "Modern trea nära Friends Arena med gemensam takterrass.", meta: "3 rum · 76 m² · 4 700 000 kr" },
      "10": { note: "Nacka, Stockholm", details: "Nyproducerad tvåa med havsutsikt och nära till Sickla köpkvarter.", meta: "2 rum · 64 m² · 3 950 000 kr" },
      "11": { note: "Täby, Stockholm", details: "Fyra rum med generös planlösning nära Täby Centrum och grönområden.", meta: "4 rum · 102 m² · 6 200 000 kr" },
      "12": { note: "Lidingö, Stockholm", details: "Havsnära villa med brygga, orangeri och stor uteplats.", meta: "6 rum · 165 m² · 11 500 000 kr" },
      "13": { note: "Enskede, Stockholm", details: "Mysig trea i lugnt kvarter med nära till Globen och tunnelbana.", meta: "3 rum · 79 m² · 4 800 000 kr" },
      "14": { note: "Hässelby, Stockholm", details: "Rymlig fyra med utsikt över Mälaren och nyrenoverat badrum.", meta: "4 rum · 95 m² · 3 750 000 kr" },
      "15": { note: "Årsta, Stockholm", details: "Instegsvänlig tvåa nära pendeltåg och Årsta torg.", meta: "2 rum · 61 m² · 3 400 000 kr" },
    },
    buyer: {
      "101": { title: "Familj söker villa", note: "Södermalm", details: "Två vuxna och ett barn söker ett långsiktigt boende nära grönområden och skolor.", meta: "Budget upp till 8 000 000 kr · 4+ rum" },
      "102": { title: "Köpare söker 2:a", note: "Centrala Kista", details: "Förstaboende med önskemål om goda kommunikationer och inflyttning under hösten.", meta: "Budget upp till 2 600 000 kr · 50–70 m²" },
      "103": { title: "Par söker första bostaden", note: "Vasastan", details: "Ungt par söker en ombonad etta eller tvåa med närhet till tunnelbana och caféer.", meta: "Budget upp till 3 200 000 kr · 1–2 rum" },
      "104": { title: "Köpare söker exklusiv trea", note: "Östermalm", details: "Söker en representativ bostad med högt i tak, gärna med balkong mot innergård.", meta: "Budget upp till 9 500 000 kr · 3–4 rum" },
      "105": { title: "Barnfamilj söker radhus", note: "Hägersten", details: "Familj med två barn önskar radhus eller parhus med nära till förskola.", meta: "Budget upp till 6 500 000 kr · 4–5 rum" },
      "106": { title: "Söker villa med trädgård", note: "Bromma", details: "Söker en villa med gott om utrymme för odling och lek, gärna med garage.", meta: "Budget upp till 9 000 000 kr · 5+ rum" },
      "107": { title: "Söker nyproducerad lägenhet", note: "Solna", details: "Söker modern nyproduktion med balkong och närhet till pendeltåg.", meta: "Budget upp till 5 200 000 kr · 2–3 rum" },
      "108": { title: "Söker fyra med sjöutsikt", note: "Nacka", details: "Familj söker rymlig bostad med vattennära läge och balkong i söderläge.", meta: "Budget upp till 7 800 000 kr · 4 rum" },
      "109": { title: "Familj söker villa nära skola", note: "Täby", details: "Söker villa i barnvänligt område med gångavstånd till skola och natur.", meta: "Budget upp till 8 500 000 kr · 5+ rum" },
      "110": { title: "Söker tvåa med balkong", note: "Liljeholmen", details: "Söker en ljus tvåa med balkong och närhet till vattnet och tunnelbana.", meta: "Budget upp till 3 800 000 kr · 2 rum" },
      "111": { title: "Förstagångsköpare söker etta", note: "Årsta", details: "Förstagångsköpare söker en mindre lägenhet med rimlig månadsavgift.", meta: "Budget upp till 2 800 000 kr · 1–2 rum" },
      "112": { title: "Söker radhus eller parhus", note: "Enskede", details: "Söker radhus med liten trädgård och nära till grönområden.", meta: "Budget upp till 6 000 000 kr · 4 rum" },
      "113": { title: "Söker nyproducerad tvåa", note: "Sundbyberg", details: "Söker modern lägenhet i nyproduktion med gemensamma ytor.", meta: "Budget upp till 4 400 000 kr · 2–3 rum" },
      "114": { title: "Söker större villa", note: "Danderyd", details: "Söker en rymlig villa med stor tomt i lugnt och barnvänligt område.", meta: "Budget upp till 14 000 000 kr · 6+ rum" },
      "115": { title: "Student söker etta", note: "Uppsala", details: "Student söker en billig etta nära universitetet med inflyttning till hösten.", meta: "Budget upp till 1 800 000 kr · 1 rum" },
    },
    exchange: {
      "201": { title: "Byter 3:a mot större", details: "Erbjuder en välplanerad 3:a och söker en större bostad med hiss och balkong.", meta: "Erbjuder 3 rum · Söker 4+ rum · Flexibelt tillträde", fromNote: "Södermalm, Stockholm", toNote: "Kungsholmen, Stockholm" },
      "202": { title: "Önskar byta villa", details: "Familj vill byta från villa i Stockholm till ett lugnare läge i Uppsalaområdet.", meta: "Erbjuder villa · Söker 4–6 rum", fromNote: "Bromma, Stockholm", toNote: "Uppsala" },
      "203": { title: "Byter 2:a mot 3:a", details: "Erbjuder en fräsch tvåa och söker en trea med plats för hemmakontor.", meta: "Erbjuder 2 rum · Söker 3 rum", fromNote: "Vasastan, Stockholm", toNote: "Liljeholmen, Stockholm" },
      "204": { title: "Byter lägenhet mot villa", details: "Erbjuder en välskött lägenhet och söker villa med trädgård för familjen.", meta: "Erbjuder 3 rum · Söker 5+ rum", fromNote: "Östermalm, Stockholm", toNote: "Bromma, Stockholm" },
      "205": { title: "Byter mot hus med sjöutsikt", details: "Erbjuder en central lägenhet och söker hus med närhet till vatten.", meta: "Erbjuder 3 rum · Söker 4+ rum", fromNote: "Kungsholmen, Stockholm", toNote: "Nacka, Stockholm" },
      "206": { title: "Barnfamilj byter till förort", details: "Familj erbjuder lägenhet i city och söker lugnare läge med bra skolor.", meta: "Erbjuder 3 rum · Söker 4–5 rum", fromNote: "Hägersten, Stockholm", toNote: "Täby, Stockholm" },
      "207": { title: "Byter till mer centralt läge", details: "Erbjuder en lugn förortslägenhet och söker något mer centralt.", meta: "Erbjuder 2 rum · Söker 2–3 rum", fromNote: "Årsta, Stockholm", toNote: "Södermalm, Stockholm" },
      "208": { title: "Byter till lugnare läge", details: "Erbjuder en trea nära Solna centrum och söker något lugnare.", meta: "Erbjuder 3 rum · Söker 2–3 rum", fromNote: "Solna, Stockholm", toNote: "Sundbyberg, Stockholm" },
      "209": { title: "Byter till radhus", details: "Erbjuder en lägenhet i Farsta och söker radhus med egen trädgård.", meta: "Erbjuder 3 rum · Söker 4 rum", fromNote: "Farsta, Stockholm", toNote: "Enskede, Stockholm" },
      "210": { title: "Byter mot större bostad", details: "Erbjuder en kompakt tvåa och söker något större för växande familj.", meta: "Erbjuder 2 rum · Söker 3–4 rum", fromNote: "Skarpnäck, Stockholm", toNote: "Vällingby, Stockholm" },
      "211": { title: "Byter villa mot mindre villa", details: "Erbjuder en stor villa och söker något mindre nu när barnen flyttat hemifrån.", meta: "Erbjuder 7 rum · Söker 4–5 rum", fromNote: "Danderyd, Stockholm", toNote: "Djursholm, Stockholm" },
      "212": { title: "Flyttar till Västkusten", details: "Erbjuder en lägenhet på Söder och söker nytt liv i Göteborg.", meta: "Erbjuder 3 rum · Söker 3–4 rum", fromNote: "Södermalm, Stockholm", toNote: "Göteborg" },
      "213": { title: "Flyttar söderut", details: "Erbjuder en lägenhet i Vasastan och söker nytt hem i Malmö.", meta: "Erbjuder 2 rum · Söker 2–3 rum", fromNote: "Vasastan, Stockholm", toNote: "Malmö" },
      "214": { title: "Flyttar från storstan", details: "Erbjuder en lägenhet på Kungsholmen och söker lugnare tillvaro i Västerås.", meta: "Erbjuder 3 rum · Söker 3–4 rum", fromNote: "Kungsholmen, Stockholm", toNote: "Västerås" },
      "215": { title: "Flyttar till huvudstaden", details: "Erbjuder en lägenhet i Uppsala och söker nytt hem i Stockholm.", meta: "Erbjuder 2 rum · Söker 2–3 rum", fromNote: "Uppsala", toNote: "Kungsholmen, Stockholm" },
    },
  },
};

export default map;
