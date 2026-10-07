/**
 * The viewing guide ("Visningsguide", part of the Trygghetspaket): what to do before, during and after a
 * viewing. It is a three-step tool with a preparation list, a room-by-room checklist, notes and photos, and a
 * summary at the end. Some of its texts are made on the server (the questions, the summary, what is missing):
 * those are in `questions`, `gaps` and `summary` below.
 *
 * {address}, {due}, {count} and so on are filled in by the code. In "rooms" the keys (entrance, hall, kitchen ...)
 * are fixed; the same goes for every id: translate the texts, never the ids.
 */
const inspection = {
  title: "Visningsguide",
  lead: "Din kompletta guide inför, under och efter visningen — ingår i Trygghetspaketet.",
  loading: "Laddar...",
  /** Shown while an autosave has just happened. */
  saved: "Sparat",
  /** {address} is the home's address. */
  header: "{address} · Din kompletta guide inför, under och efter visningen.",
  /** Above the list of homes, when the visitor has more than one. */
  picker: "Välj vilken bostad du vill starta eller fortsätta visningsguiden för.",

  empty: {
    noAnalysis: {
      title: "Ingen analys hittades",
      text: "Visningsguiden ingår i Trygghetspaketet. Analysera en bostad med ett Trygghetspaket för att komma igång.",
      action: "Starta en analys",
    },
    requiresPackage: {
      title: "Kräver Trygghetspaketet",
      text: "Den här bostaden har ingen hel analys kopplad till ditt konto. Visningsguiden ingår i Trygghetspaketet.",
      action: "Starta en analys",
    },
    loadFailed: {
      title: "Kunde inte ladda besiktningen",
      text: "Något gick fel. Försök igen om en stund.",
      action: "Till översikten",
    },
    noSummary: {
      title: "Ingen sammanfattning än",
      text: "Gå tillbaka till steg 2 och slutför genomgången för att generera en sammanfattning.",
      action: "Till steg 2",
    },
  },

  /** The three steps along the top. */
  steps: {
    before: { title: "Inför visningen", subtitle: "Förberedelser & info" },
    during: { title: "Under visningen", subtitle: "Steg för steg" },
    after: { title: "Efter visningen", subtitle: "Uppföljning & analys" },
  },

  /** Step 1. */
  step1: {
    prepTitle: "Inför din visning",
    prepLead: "Tre steg för att förbereda dig ordentligt — vet exakt vilka dokument du behöver och var du hittar dem.",
    knownTitle: "Vad analysen redan vet",
    knownLead: "Baserat på din slutförda analys av bostaden.",
    docsTitle: "Dokument att ladda upp",
    docsLead: "Ladda upp relevanta dokument så stärker du analysen och får mer precisa rekommendationer.",
    downloadTitle: "Ladda ner checklista",
    downloadLead: "Ladda ner vår kompletta checklista så har du den med dig vid varje steg.",
    download: "Ladda ner checklista",
    ready: {
      title: "Redo att gå vidare?",
      text: "När du har samlat in dokument och gått igenom checklistan är du redo för nästa steg.",
      action: "Gå vidare till steg 2",
    },
    brf: {
      title: "Föreningens ekonomi",
      noConcerns: "BRF-analysen pekar inte ut något nyckeltal utanför de vanliga nivåerna.",
      /** {due} is when the review is due, written out. */
      awaitingDue: "BRF-analysen granskas av Köpanalys experter och är klar senast {due}. Punkterna att hålla koll på visas här när den är publicerad.",
      awaiting: "BRF-analysen granskas av Köpanalys experter. Punkterna att hålla koll på visas här när den är publicerad.",
      notBrf: "Bostaden ingår inte i någon bostadsrättsförening.",
    },
    brokerQuestions: "Frågor till mäklaren",
    brfQuestions: "Frågor till föreningen",
    tips: {
      title: "Tips",
      text: "Ju mer information du laddar upp, desto bättre blir vår analys. Saknas något dokument? Kontakta styrelsen eller mäklaren.",
    },
  },

  /** Step 2. */
  step2: {
    title: "Under visningen",
    lead: "Tre saker att göra medan du är på plats — sen går du igenom bostaden rum för rum nedan.",
    guide: {
      rooms: {
        title: "Gå igenom varje rum",
        text: "Bocka av kontrollpunkterna i checklistan nedan, rum för rum. Hoppa gärna över rum som inte finns i just den här bostaden.",
      },
      notes: {
        title: "Notera skador & fråga på plats",
        text: "Skriv ner allt du är osäker på i Egna observationer här bredvid, så har du det kvar när du jämför bostäder efteråt.",
      },
      photos: {
        title: "Fota det du vill dokumentera",
        text: "Ladda upp foton direkt vid kontrollpunkten. Särskilt värdefullt vid fukt, sprickor eller annat som är svårt att minnas efteråt.",
      },
    },
    roomsTitle: "Rum för rum",
    observationsTitle: "Egna observationer",
    done: {
      title: "Klar med genomgången?",
      text: "Vi sammanställer en professionell sammanfattning åt dig.",
      action: "Skapa sammanfattning",
    },
  },

  /** The checklist file the visitor can download. */
  download: {
    heading: "Köpanalys — Checklista inför visning",
    needs: "Vad du behöver:",
    /** The name of the downloaded file. */
    fileName: "checklista-infor-visning.txt",
  },

  /** The three preparation steps of step 1. */
  prep: {
    /** The label of the button that ticks a step off, and of the heading over what is needed. */
    markDone: "Markera som klar",
    markUndone: "Markera som ej klar",
    needs: "Vad du behöver",
    gather_documents: {
      title: "Skaffa rätt dokument",
      description: "De flesta vet inte vilka dokument de faktiskt behöver be om. Här är de fem viktigaste — och exakt var du hittar dem.",
      items: {
        annualReport: {
          name: "Årsredovisning (bostadsrättsföreningens senaste)",
          whereToFind: "Be mäklaren om den, eller sök föreningens namn på allabrf.se — gratis och öppet för alla.",
        },
        bylaws: {
          name: "Stadgar",
          whereToFind: "Finns oftast på föreningens egen hemsida under \"Dokument\"; annars skickar mäklaren eller styrelsen dem på begäran.",
        },
        energy: {
          name: "Energideklaration",
          whereToFind: "Sök adressen på boverket.se/energideklaration — kostnadsfritt och knutet till fastigheten, inte säljaren.",
        },
        maintenance: {
          name: "Underhållsplan",
          whereToFind: "Begär av mäklaren eller föreningens styrelse. Visar planerat underhåll och risk för framtida avgiftshöjningar.",
        },
        floorPlan: {
          name: "Planritning",
          whereToFind: "Finns oftast redan i bostadsannonsen på Hemnet eller Booli; annars hos mäklaren.",
        },
      },
    },
    check_finances_and_property: {
      title: "Granska ekonomi & skick",
      description: "Med dokumenten i hand — det här är de konkreta siffrorna och åren att leta efter, och vad de faktiskt betyder.",
      items: {
        loanRatio: {
          name: "Belåningsgrad (kr per kvadratmeter)",
          whereToFind:
            "Räknas ut från föreningens totala lån delat med boarean, i årsredovisningens förvaltningsberättelse. Över cirka 15 000 kr/m² är värt att fråga styrelsen om.",
        },
        feeTrend: {
          name: "Avgiftsutveckling senaste 3–5 åren",
          whereToFind: "Jämför flera års årsredovisningar, eller fråga styrelsen/mäklaren direkt om avgiften höjts nyligen eller planeras höjas.",
        },
        result: {
          name: "Resultat- och kassaflöde",
          whereToFind: "Resultaträkningen i årsredovisningen visar om föreningen går plus eller minus — ett återkommande minus är en varningssignal.",
        },
        renovations: {
          name: "Byggår och stora renoveringar (stammar, tak, fasad)",
          whereToFind: "Fråga mäklaren om renoveringshistorik. Allt äldre än 30–40 år bör antingen vara åtgärdat eller finnas med i underhållsplanen.",
        },
      },
    },
    prepare_questions: {
      title: "Förbered dina frågor",
      description: "Utgå från vad som faktiskt saknas i din analys, inte gissningar — så vet du precis vad du ska fråga på plats.",
      items: {
        questions: {
          name: "Frågor till mäklaren och föreningen",
          whereToFind: "Redan förifyllda åt dig i korten \"Frågor till mäklaren\" och \"Frågor till föreningen\" här bredvid, baserat på vad som saknas i din analys.",
        },
        area: {
          name: "Områdets skolor, kommunikationer och framtidsplaner",
          whereToFind: "Se Områdesanalys-kapitlet i din rapport innan visningen, så kan du ställa uppföljande frågor på plats istället för att läsa in det efteråt.",
        },
      },
    },
  },

  /** The rooms of the checklist and what to check in each. */
  rooms: {
    entrance: { label: "Entré", checkpoints: { door_lock: "Dörr och lås", floor: "Golv", walls: "Väggar" } },
    hall: { label: "Hall", checkpoints: { floor: "Golv", storage: "Förvaring", ventilation: "Ventilation" } },
    kitchen: { label: "Kök", checkpoints: { appliances: "Vitvaror", countertop: "Bänkskiva", sink_drain: "Avlopp under diskbänk", fan: "Ventilation/fläkt" } },
    bathroom: { label: "Badrum", checkpoints: { waterproofing: "Tätskikt", floor_drain: "Golvbrunn", tiles_grout: "Fog och kakel", ventilation: "Ventilation" } },
    living_room: { label: "Vardagsrum", checkpoints: { floor: "Golv", walls_ceiling: "Väggar och tak", windows: "Fönster" } },
    bedroom: { label: "Sovrum", checkpoints: { floor: "Golv", walls_ceiling: "Väggar och tak", windows: "Fönster" } },
    windows: { label: "Fönster", checkpoints: { frames_sealing: "Karmar och tätning", condensation: "Kondens/fukt", glass: "Glas" } },
    roof: { label: "Tak", checkpoints: { roofing: "Taktäckning", chimney: "Skorsten", gutters: "Hängrännor" } },
    facade: { label: "Fasad", checkpoints: { cladding: "Puts/panel", cracks: "Sprickor", plinth: "Sockel" } },
    balcony: { label: "Balkong", checkpoints: { railing: "Räcke", waterproofing: "Tätskikt", drainage: "Avrinning" } },
    basement: { label: "Källare", checkpoints: { moisture_smell: "Fukt/lukt", floor: "Golv", foundation_wall: "Grundmur" } },
    electrical: { label: "El", checkpoints: { fuse_box: "Elcentral", outlets_switches: "Uttag och strömbrytare", visible_wiring: "Synlig kabeldragning" } },
    heating: { label: "Värme", checkpoints: { heat_source: "Värmekälla/element", thermostats: "Termostater", water_heater: "Varmvattenberedare" } },
    ventilation: { label: "Ventilation", checkpoints: { exhaust_air: "Frånluft", supply_air: "Tilluft", filters: "Filter/rengöring" } },
    drainage: { label: "Avlopp", checkpoints: { floor_drains: "Golvbrunnar", pipes: "Stammar", visible_leaks: "Synliga läckage" } },
    attic: { label: "Vind", checkpoints: { insulation: "Isolering", mold_moisture: "Fukt/mögel", roof_trusses: "Takstolar" } },
  },

  /** How serious an anmärkning (a remark about the condition) is. */
  severities: {
    ok: "OK",
    minor: "Mindre anmärkning",
    major: "Allvarlig anmärkning",
  },
  checkpoint: {
    notes: "Anteckningar...",
    addPhoto: "Lägg till foto",
    uploading: "Laddar upp...",
    /** {count} is the number of photos. */
    photos: "{count, plural, one {# foto} other {# foton}}",
  },

  observations: {
    placeholder: "Skriv en egen observation, t.ex. fuktlukt i badrummet...",
    add: "Lägg till",
    remove: "Ta bort observation",
    /** Short examples that fill the field when clicked. */
    examples: {
      damp: "Fuktlukt",
      cracks: "Sprickor",
      waterDamage: "Vattenskada",
      uneven: "Ojämnt golv",
      paint: "Färgskada",
      electrical: "Elfel",
    },
  },

  /** The kinds of document that can be uploaded. */
  documents: {
    annual_report: "Årsredovisning",
    inspection_report: "Besiktningsprotokoll",
    energy_declaration: "Energideklaration",
    floor_plan: "Planritning",
    maintenance_plan: "Underhållsplan",
    bylaws: "Stadgar",
    other: "Övrigt",
  },
  dropzone: {
    drop: "Dra och släpp filer här",
    or: "eller",
    choose: "Välj filer",
    uploading: "Laddar upp...",
    recommended: "Rekommenderade dokument",
    /** {name} is the kind of document, e.g. "Årsredovisning". */
    pdf: "{name} (PDF)",
    genericError: "Något gick fel vid uppladdningen.",
    noProperty: "Ingen bostad vald.",
  },

  /** What the analysis already knows, and what is missing. The ids (brf_identity ...) are fixed. */
  gaps: {
    brf_identity: "Bostadsrättsförening",
    annual_report: "Årsredovisning",
    maintenance_history: "Underhållshistorik",
    energy_declaration: "Energideklaration",
    parking: "Parkering/garage",
    bylaws: "Stadgar",
    /** What is shown for a thing that is missing. */
    missing: "Saknas — ladda upp underlag för att stärka analysen.",
    upload: "Ladda upp",
    /** What is shown for a thing that is known without a value of its own. */
    known: {
      available: "Tillgänglig",
      uploaded: "Uppladdad",
      parkingExists: "Parkering finns",
      garageExists: "Garage finns",
      noParking: "Ingen parkering angiven",
    },
  },

  /** The questions made from what is missing; written on the server in the page's language. */
  questions: {
    broker: {
      annualReport: "Kan du skicka föreningens senaste årsredovisning?",
      maintenancePlan: "Finns det en underhållsplan och har den följts historiskt?",
      energyDeclaration: "Finns en giltig energideklaration för bostaden?",
      /** {date} is the date of the previous sale. */
      previousSale: "Varför säljs bostaden nu, och stämmer skicket med föregående försäljning {date}?",
      knownFaults: "Finns kända fel eller anmärkningar som inte framgår av annonsen?",
    },
    brf: {
      bylaws: "Kan styrelsen dela föreningens stadgar?",
      renovations: "Finns planerade renoveringar eller avgiftshöjningar de kommande åren?",
      loans: "Hur ser föreningens lån och räntebindning ut?",
      parking: "Hanterar föreningen parkering/garage, och finns kö?",
    },
  },

  /** The summary at the end (step 3); written on the server from what was recorded. */
  summary: {
    recommendation: "Övergripande rekommendation",
    strengths: "Styrkor",
    weaknesses: "Svagheter",
    futureCosts: "Möjliga framtida kostnader",
    followUpTitle: "Rekommenderad uppföljning",
    missingDocumentation: "Saknad dokumentation",
    openQuestions: "Öppna frågor",
    /** Shown when there is nothing to summarise yet. The quoted words are the name of step 2 in some older text: keep the quotes. */
    empty: "Gå igenom checklistan under \"Under besiktning\" för att generera en fullständig sammanfattning.",

    /** {room} and {checkpoint} are the names of a room and of a point in it; {note} is what the visitor wrote. */
    major: "{room} – {checkpoint}: {note}",
    majorNoNote: "{room} – {checkpoint} uppvisar en allvarlig anmärkning.",
    minor: "{room} – {checkpoint}: {note}",
    minorNoNote: "{room} – {checkpoint} uppvisar en mindre anmärkning.",
    /** {room} and {checkpoint} are written in lower case here. */
    possibleAction: "Möjlig åtgärd: {room} ({checkpoint}).",
    okPoints: "{count} kontrollpunkter genomgicks utan anmärkning.",
    noRemarks: "Inga anmärkningar noterades vid genomgången.",
    /** {text} is what the visitor wrote. */
    ownObservation: "Egen observation: {text}",
    followUp: {
      major: "Begär en fördjupad besiktning av en certifierad besiktningsman för de allvarliga anmärkningarna.",
      minor: "Be säljaren eller mäklaren kommentera de mindre anmärkningarna innan budgivning.",
      missing: "Komplettera saknad dokumentation innan slutgiltigt beslut.",
      none: "Inga särskilda uppföljningspunkter utöver den ordinarie processen.",
    },
    overall: {
      major: "Allvarliga anmärkningar noterades. Vi rekommenderar en fördjupad besiktning innan bud läggs, och att kostnaderna för åtgärder vägs in i budgivningen.",
      several: "Inga allvarliga anmärkningar, men flera mindre punkter och/eller saknad dokumentation bör klargöras innan ett slutgiltigt beslut.",
      few: "Besiktningen visar en överlag god bild av bostaden, med ett fåtal punkter att följa upp innan köp.",
      clean: "Besiktningen visar inga anmärkningar. Bostaden framstår som väl underhållen utifrån genomförd genomgång.",
      notDone: "Besiktningen är ännu inte genomförd. Gå igenom checklistan rum för rum för att få en fullständig bedömning.",
    },
  },
};

export default inspection;
