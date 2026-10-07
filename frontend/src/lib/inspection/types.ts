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
/*
 * What these are: the ids of the steps, rooms and checkpoints of the viewing guide. The words - titles,
 * descriptions, where to find a document, the names of the rooms - are in the message files
 * (src/i18n/messages/<language>/inspection.ts), under "prep" and "rooms", in each language.
 */

export interface PrepStepItem {
  /** Names the item's two texts in the messages: inspection.prep.<step id>.items.<id>.name / .whereToFind */
  id: string;
}

export interface PrepStep {
  /** Also the key of the step's title and description: inspection.prep.<id>.title / .description */
  id: "gather_documents" | "check_finances_and_property" | "prepare_questions";
  order: number;
  /** What "Vad du behöver" unpacks into - the concrete items behind the icon. */
  items: PrepStepItem[];
}

export const PREP_STEPS: PrepStep[] = [
  {
    id: "gather_documents",
    order: 1,
    items: [{ id: "annualReport" }, { id: "bylaws" }, { id: "energy" }, { id: "maintenance" }, { id: "floorPlan" }],
  },
  {
    id: "check_finances_and_property",
    order: 2,
    items: [{ id: "loanRatio" }, { id: "feeTrend" }, { id: "result" }, { id: "renovations" }],
  },
  {
    id: "prepare_questions",
    order: 3,
    items: [{ id: "questions" }, { id: "area" }],
  },
];

export interface RoomCheckpoint {
  id: string;
}

export interface Room {
  /** Also the key of the room's name and checkpoint names: inspection.rooms.<id>.label / .checkpoints.<checkpoint id> */
  id: RoomId;
  checkpoints: RoomCheckpoint[];
}

export type RoomId =
  | "entrance"
  | "hall"
  | "kitchen"
  | "bathroom"
  | "living_room"
  | "bedroom"
  | "windows"
  | "roof"
  | "facade"
  | "balcony"
  | "basement"
  | "electrical"
  | "heating"
  | "ventilation"
  | "drainage"
  | "attic";

const cp = (...ids: string[]): RoomCheckpoint[] => ids.map((id) => ({ id }));

export const ROOMS: Room[] = [
  { id: "entrance", checkpoints: cp("door_lock", "floor", "walls") },
  { id: "hall", checkpoints: cp("floor", "storage", "ventilation") },
  { id: "kitchen", checkpoints: cp("appliances", "countertop", "sink_drain", "fan") },
  { id: "bathroom", checkpoints: cp("waterproofing", "floor_drain", "tiles_grout", "ventilation") },
  { id: "living_room", checkpoints: cp("floor", "walls_ceiling", "windows") },
  { id: "bedroom", checkpoints: cp("floor", "walls_ceiling", "windows") },
  { id: "windows", checkpoints: cp("frames_sealing", "condensation", "glass") },
  { id: "roof", checkpoints: cp("roofing", "chimney", "gutters") },
  { id: "facade", checkpoints: cp("cladding", "cracks", "plinth") },
  { id: "balcony", checkpoints: cp("railing", "waterproofing", "drainage") },
  { id: "basement", checkpoints: cp("moisture_smell", "floor", "foundation_wall") },
  { id: "electrical", checkpoints: cp("fuse_box", "outlets_switches", "visible_wiring") },
  { id: "heating", checkpoints: cp("heat_source", "thermostats", "water_heater") },
  { id: "ventilation", checkpoints: cp("exhaust_air", "supply_air", "filters") },
  { id: "drainage", checkpoints: cp("floor_drains", "pipes", "visible_leaks") },
  { id: "attic", checkpoints: cp("insulation", "mold_moisture", "roof_trusses") },
];

/** The kinds of document, in the order they are offered. Their names: inspection.documents.<type> */
export const DOCUMENT_TYPES: DocumentType[] = [
  "annual_report",
  "inspection_report",
  "energy_declaration",
  "floor_plan",
  "maintenance_plan",
  "bylaws",
  "other",
];
