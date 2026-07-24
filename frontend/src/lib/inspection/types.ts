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

export interface PrepStep {
  id: string;
  order: number;
  title: string;
  description: string;
}

export const PREP_STEPS: PrepStep[] = [
  {
    id: "gather_documents",
    order: 1,
    title: "Samla in dokument & information",
    description: "Årsredovisning, stadgar, energideklaration, underhållsplan m.m.",
  },
  {
    id: "check_finances",
    order: 2,
    title: "Kolla upp föreningens ekonomi",
    description: "Belåningsgrad, avgiftsutveckling och kassaflöde.",
  },
  {
    id: "check_property",
    order: 3,
    title: "Undersök fastigheten",
    description: "Byggår, renoveringar, planerat underhåll.",
  },
  {
    id: "area_analysis",
    order: 4,
    title: "Områdesanalys",
    description: "Kommunikationer, skolor, service och framtidsplaner.",
  },
  {
    id: "own_notes",
    order: 5,
    title: "Egna anteckningar & frågor",
    description: "Skriv ner dina frågor till mäklaren eller styrelsen.",
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
