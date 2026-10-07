/**
 * Where the state diagram's boxes and arrows go. Hand-placed, in a 780-wide drawing:
 * the lifecycle runs left to right along the top (a new visitor, then engaged,
 * registered, premium), and the ways out and back are underneath.
 *
 *   S0 never   S1 visited   S2 engaged   S3 registered   S4 premium
 *              S8 bounce    S7 reactivated   S5 inactive   S6 churned
 *
 * No React in here, so markov.verify.mjs can check that every move in the model has an arrow.
 */
import type { EdgeKey, StateId } from "@/lib/markov/model";

export const NODE_W = 112;
export const NODE_H = 64;
/** the drawing's coordinate box: x from 0, y from VIEW_TOP (room above for the arc over the top) */
export const VIEW = { width: 780, top: -52, height: 380 };

const ROW_A = 52;
const ROW_B = 200;

export const POSITIONS: Record<StateId, { x: number; y: number }> = {
  never: { x: 62, y: ROW_A },
  visited: { x: 212, y: ROW_A },
  engaged: { x: 372, y: ROW_A },
  registered: { x: 532, y: ROW_A },
  premium: { x: 712, y: ROW_A },
  bounced: { x: 212, y: ROW_B },
  reactivated: { x: 372, y: ROW_B },
  inactive: { x: 532, y: ROW_B },
  churned: { x: 712, y: ROW_B },
};

export interface EdgeShape {
  /** an SVG path, ending where the arrowhead goes */
  d: string;
  /** where the percentage is written */
  label: { x: number; y: number; anchor: "start" | "middle" | "end" };
}

// Row A runs y 20-84 and row B y 168-232 (the boxes' top and bottom edges).
export const EDGE_SHAPES: Partial<Record<EdgeKey, EdgeShape>> = {
  "visited>bounced": { d: "M200,84 L200,168", label: { x: 190, y: 130, anchor: "end" } },
  "bounced>visited": { d: "M224,168 L224,84", label: { x: 234, y: 130, anchor: "start" } },
  "visited>engaged": { d: "M268,52 L316,52", label: { x: 292, y: 42, anchor: "middle" } },

  "engaged>registered": { d: "M428,52 L476,52", label: { x: 452, y: 42, anchor: "middle" } },
  "engaged>premium": { d: "M392,20 C412,-36 692,-36 702,20", label: { x: 547, y: -30, anchor: "middle" } },
  "engaged>inactive": { d: "M404,84 L500,168", label: { x: 440, y: 132, anchor: "end" } },

  "registered>premium": { d: "M588,52 L656,52", label: { x: 622, y: 42, anchor: "middle" } },
  "registered>inactive": { d: "M532,84 L532,168", label: { x: 542, y: 130, anchor: "start" } },
  "registered>churned": { d: "M576,84 L684,168", label: { x: 654, y: 114, anchor: "start" } },

  "premium>inactive": { d: "M696,84 L572,168", label: { x: 584, y: 152, anchor: "end" } },
  "premium>churned": { d: "M736,84 L736,168", label: { x: 746, y: 130, anchor: "start" } },

  "inactive>reactivated": { d: "M476,212 L428,212", label: { x: 452, y: 228, anchor: "middle" } },
  "inactive>churned": { d: "M588,200 L656,200", label: { x: 622, y: 190, anchor: "middle" } },

  "churned>reactivated": { d: "M696,232 C696,312 404,312 404,232", label: { x: 550, y: 308, anchor: "middle" } },

  "reactivated>engaged": { d: "M352,168 L352,84", label: { x: 342, y: 130, anchor: "end" } },
  "reactivated>premium": { d: "M404,168 C470,118 626,122 672,84", label: { x: 540, y: 112, anchor: "middle" } },
  "reactivated>inactive": { d: "M428,190 L476,190", label: { x: 452, y: 182, anchor: "middle" } },
};

/** The arrow from the pool of never-visited people into "visited": its size is "new visitors per month", not a chance. */
export const SOURCE_SHAPE = "M118,52 L156,52";
