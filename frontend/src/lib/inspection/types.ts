export type DocumentType =
  | "annual_report"
  | "inspection_report"
  | "energy_declaration"
  | "floor_plan"
  | "maintenance_plan"
  | "bylaws"
  | "other";

export type Severity = "ok" | "minor" | "major";

export interface CheckpointState {
  checked: boolean;
  severity: Severity | null;
  notes: string;
  photoIds: string[];
}

/** { [roomId]: { [checkpointId]: CheckpointState } } */
export type ChecklistState = Record<string, Record<string, CheckpointState>>;

/** { [prepStepId]: boolean } */
export type PrepChecklistState = Record<string, boolean>;

export interface Observation {
  id: string;
  text: string;
  createdAt: string;
}

export type InspectionStatus = "before" | "during" | "after" | "complete";

export interface InspectionRecord {
  id: string;
  userId: string;
  propertyId: string;
  analysisId: string | null;
  step: 1 | 2 | 3;
  status: InspectionStatus;
  prepChecklist: PrepChecklistState;
  checklist: ChecklistState;
  observations: Observation[];
  summary: InspectionSummary | null;
  createdAt: string;
  updatedAt: string;
}

export interface InspectionDocument {
  id: string;
  inspectionId: string;
  docType: DocumentType;
  storagePath: string;
  originalFilename: string | null;
  contentType: string | null;
  uploadedBy: string;
  createdAt: string;
}

export interface InspectionPhoto {
  id: string;
  inspectionId: string;
  room: string;
  checkpointId: string | null;
  storagePath: string;
  originalFilename: string | null;
  createdAt: string;
}

export interface InspectionSummary {
  strengths: string[];
  weaknesses: string[];
  futureCosts: string[];
  followUp: string[];
  missingDocumentation: string[];
  openQuestions: string[];
  overallRecommendation: string;
  generatedAt: string;
}

/* ─── Static workflow definitions ─────────────────────────────────────── */

export interface PrepStepItem {
  /** The concrete, real-world document or number to look for — never a vague category. */
  name: string;
  /** Exactly where to get it, in plain language. */
  whereToFind: string;
}

export interface PrepStep {
  id: string;
  order: number;
  title: string;
  description: string;
  /** What "Vad du behöver" unpacks into — the concrete items behind the icon. */
  items: PrepStepItem[];
}

export const PREP_STEPS: PrepStep[] = [
  {
    id: "gather_documents",
    order: 1,
    title: "Skaffa rätt dokument",
    description: "De flesta vet inte vilka dokument de faktiskt behöver be om. Här är de fem viktigaste — och exakt var du hittar dem.",
    items: [
      {
        name: "Årsredovisning (bostadsrättsföreningens senaste)",
        whereToFind: "Be mäklaren om den, eller sök föreningens namn på allabrf.se — gratis och öppet för alla.",
      },
      {
        name: "Stadgar",
        whereToFind: "Finns oftast på föreningens egen hemsida under \"Dokument\"; annars skickar mäklaren eller styrelsen dem på begäran.",
      },
      {
        name: "Energideklaration",
        whereToFind: "Sök adressen på boverket.se/energideklaration — kostnadsfritt och knutet till fastigheten, inte säljaren.",
      },
      {
        name: "Underhållsplan",
        whereToFind: "Begär av mäklaren eller föreningens styrelse. Visar planerat underhåll och risk för framtida avgiftshöjningar.",
      },
      {
        name: "Planritning",
        whereToFind: "Finns oftast redan i bostadsannonsen på Hemnet eller Booli; annars hos mäklaren.",
      },
    ],
  },
  {
    id: "check_finances_and_property",
    order: 2,
    title: "Granska ekonomi & skick",
    description: "Med dokumenten i hand — det här är de konkreta siffrorna och åren att leta efter, och vad de faktiskt betyder.",
    items: [
      {
        name: "Belåningsgrad (kr per kvadratmeter)",
        whereToFind: "Räknas ut från föreningens totala lån delat med boarean, i årsredovisningens förvaltningsberättelse. Över cirka 15 000 kr/m² är värt att fråga styrelsen om.",
      },
      {
        name: "Avgiftsutveckling senaste 3–5 åren",
        whereToFind: "Jämför flera års årsredovisningar, eller fråga styrelsen/mäklaren direkt om avgiften höjts nyligen eller planeras höjas.",
      },
      {
        name: "Resultat- och kassaflöde",
        whereToFind: "Resultaträkningen i årsredovisningen visar om föreningen går plus eller minus — ett återkommande minus är en varningssignal.",
      },
      {
        name: "Byggår och stora renoveringar (stammar, tak, fasad)",
        whereToFind: "Fråga mäklaren om renoveringshistorik. Allt äldre än 30–40 år bör antingen vara åtgärdat eller finnas med i underhållsplanen.",
      },
    ],
  },
  {
    id: "prepare_questions",
    order: 3,
    title: "Förbered dina frågor",
    description: "Utgå från vad som faktiskt saknas i din analys, inte gissningar — så vet du precis vad du ska fråga på plats.",
    items: [
      {
        name: "Frågor till mäklaren och föreningen",
        whereToFind: "Redan förifyllda åt dig i korten \"Frågor till mäklaren\" och \"Frågor till föreningen\" här bredvid, baserat på vad som saknas i din analys.",
      },
      {
        name: "Områdets skolor, kommunikationer och framtidsplaner",
        whereToFind: "Se Områdesanalys-kapitlet i din rapport innan visningen, så kan du ställa uppföljande frågor på plats istället för att läsa in det efteråt.",
      },
    ],
  },
];

export interface RoomCheckpoint {
  id: string;
  label: string;
}

export interface Room {
  id: string;
  label: string;
  checkpoints: RoomCheckpoint[];
}

export const ROOMS: Room[] = [
  {
    id: "entrance",
    label: "Entré",
    checkpoints: [
      { id: "door_lock", label: "Dörr och lås" },
      { id: "floor", label: "Golv" },
      { id: "walls", label: "Väggar" },
    ],
  },
  {
    id: "hall",
    label: "Hall",
    checkpoints: [
      { id: "floor", label: "Golv" },
      { id: "storage", label: "Förvaring" },
      { id: "ventilation", label: "Ventilation" },
    ],
  },
  {
    id: "kitchen",
    label: "Kök",
    checkpoints: [
      { id: "appliances", label: "Vitvaror" },
      { id: "countertop", label: "Bänkskiva" },
      { id: "sink_drain", label: "Avlopp under diskbänk" },
      { id: "fan", label: "Ventilation/fläkt" },
    ],
  },
  {
    id: "bathroom",
    label: "Badrum",
    checkpoints: [
      { id: "waterproofing", label: "Tätskikt" },
      { id: "floor_drain", label: "Golvbrunn" },
      { id: "tiles_grout", label: "Fog och kakel" },
      { id: "ventilation", label: "Ventilation" },
    ],
  },
  {
    id: "living_room",
    label: "Vardagsrum",
    checkpoints: [
      { id: "floor", label: "Golv" },
      { id: "walls_ceiling", label: "Väggar och tak" },
      { id: "windows", label: "Fönster" },
    ],
  },
  {
    id: "bedroom",
    label: "Sovrum",
    checkpoints: [
      { id: "floor", label: "Golv" },
      { id: "walls_ceiling", label: "Väggar och tak" },
      { id: "windows", label: "Fönster" },
    ],
  },
  {
    id: "windows",
    label: "Fönster",
    checkpoints: [
      { id: "frames_sealing", label: "Karmar och tätning" },
      { id: "condensation", label: "Kondens/fukt" },
      { id: "glass", label: "Glas" },
    ],
  },
  {
    id: "roof",
    label: "Tak",
    checkpoints: [
      { id: "roofing", label: "Taktäckning" },
      { id: "chimney", label: "Skorsten" },
      { id: "gutters", label: "Hängrännor" },
    ],
  },
  {
    id: "facade",
    label: "Fasad",
    checkpoints: [
      { id: "cladding", label: "Puts/panel" },
      { id: "cracks", label: "Sprickor" },
      { id: "plinth", label: "Sockel" },
    ],
  },
  {
    id: "balcony",
    label: "Balkong",
    checkpoints: [
      { id: "railing", label: "Räcke" },
      { id: "waterproofing", label: "Tätskikt" },
      { id: "drainage", label: "Avrinning" },
    ],
  },
  {
    id: "basement",
    label: "Källare",
    checkpoints: [
      { id: "moisture_smell", label: "Fukt/lukt" },
      { id: "floor", label: "Golv" },
      { id: "foundation_wall", label: "Grundmur" },
    ],
  },
  {
    id: "electrical",
    label: "El",
    checkpoints: [
      { id: "fuse_box", label: "Elcentral" },
      { id: "outlets_switches", label: "Uttag och strömbrytare" },
      { id: "visible_wiring", label: "Synlig kabeldragning" },
    ],
  },
  {
    id: "heating",
    label: "Värme",
    checkpoints: [
      { id: "heat_source", label: "Värmekälla/element" },
      { id: "thermostats", label: "Termostater" },
      { id: "water_heater", label: "Varmvattenberedare" },
    ],
  },
  {
    id: "ventilation",
    label: "Ventilation",
    checkpoints: [
      { id: "exhaust_air", label: "Frånluft" },
      { id: "supply_air", label: "Tilluft" },
      { id: "filters", label: "Filter/rengöring" },
    ],
  },
  {
    id: "drainage",
    label: "Avlopp",
    checkpoints: [
      { id: "floor_drains", label: "Golvbrunnar" },
      { id: "pipes", label: "Stammar" },
      { id: "visible_leaks", label: "Synliga läckage" },
    ],
  },
  {
    id: "attic",
    label: "Vind",
    checkpoints: [
      { id: "insulation", label: "Isolering" },
      { id: "mold_moisture", label: "Fukt/mögel" },
      { id: "roof_trusses", label: "Takstolar" },
    ],
  },
];

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  annual_report: "Årsredovisning",
  inspection_report: "Besiktningsprotokoll",
  energy_declaration: "Energideklaration",
  floor_plan: "Planritning",
  maintenance_plan: "Underhållsplan",
  bylaws: "Stadgar",
  other: "Övrigt",
};
