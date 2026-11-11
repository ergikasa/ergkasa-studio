import type { Keyframe, RenderTimeline } from "@erkasa/contracts";
import { FLOOR, feetForSeat, kf, type Facing } from "./staging.js";

/**
 * Staged sets: a background plus furniture and named marks, so a scene can say "Alex enters through
 * the door, walks to chair_left and sits" and the compiler knows exactly where that is.
 * Positions are world pixels of the background; every set is built for characters at staging.SCALE.
 */

type TimelineNode = RenderTimeline["scenes"][number]["nodes"][number];

export interface Mark {
  kind: "door" | "chair" | "spot";
  /** door/spot: where the feet stand. chair: where the hips sit (the seat's hip anchor). */
  x: number;
  /** Which way someone at this mark faces (a chair: towards the desk). */
  facing: Facing;
  description: string;
}

export interface StageSet {
  id: string;
  name: string;
  background: string;
  description: string;
  marks: Record<string, Mark>;
  /** Pairs of chair marks across a desk whose occupants can hand things over (hands meet above it). */
  handover: Array<[string, string]>;
  /** Furniture nodes; `doorOpen` = frames where the door should be open (someone passes). */
  furniture(doorOpen: number[]): TimelineNode[];
}

/** Where the feet are for someone standing at a mark (in front of a chair, or on the spot). */
export function standX(mark: Mark): number {
  return mark.kind === "chair" ? feetForSeat(mark.x, mark.facing) : mark.x;
}

const svg = (
  id: string,
  asset: string,
  z: number,
  x: number,
  y: number,
  extra: Partial<TimelineNode> & { scale?: number } = {},
): TimelineNode => {
  const { scale, tracks, props, ...rest } = extra;
  return {
    id,
    adapter: "svg",
    asset,
    z,
    space: "world",
    props: props ?? {},
    tracks: {
      x: [kf(0, x)],
      y: [kf(0, y)],
      ...(scale !== undefined ? { scale: [kf(0, scale)] } : {}),
      ...tracks,
    },
    ...rest,
  } as TimelineNode;
};

/** Door leaf keyframes: opens shortly before each passage and closes after it. */
function doorTrack(open: number[]): Keyframe[] {
  const keys: Keyframe[] = [kf(0, 1)];
  for (const f of [...open].sort((a, b) => a - b)) {
    const start = Math.max(1, f - 8);
    const last = keys[keys.length - 1];
    if (last && last.f >= start) continue; // still open from the previous passage
    keys.push(
      kf(start, 1),
      kf(start + 12, 0.12, { ease: "easeOutCubic" }),
      kf(start + 50, 0.12),
      kf(start + 66, 1, { ease: "easeInOutCubic" }),
    );
  }
  return keys;
}

const DESK_X = 1230;
const DESK_TOP = FLOOR - 348;

export const SETS: Record<string, StageSet> = {
  interview_office: {
    id: "interview_office",
    name: "Interview office",
    background: "bg_interview_office_01",
    description:
      "A calm office seen from the side: a door on the left, a desk in the middle with a chair on each side (chair_left faces right, chair_right faces left), a laptop and a mug on the desk. For interviews, meetings, a talk across a desk.",
    marks: {
      door: { kind: "door", x: 560, facing: "right", description: "the door on the left: enter / exit here" },
      chair_left: {
        kind: "chair",
        x: 880,
        facing: "right",
        description: "chair on the left of the desk, facing right (the visitor)",
      },
      chair_right: {
        kind: "chair",
        x: 1540,
        facing: "left",
        description: "chair on the right of the desk, facing left (the host of the office)",
      },
      by_window: {
        kind: "spot",
        x: 1900,
        facing: "left",
        description: "a spot by the window on the right, standing",
      },
    },
    handover: [["chair_left", "chair_right"]],
    furniture: (doorOpen) => [
      svg("set_door", "prop_door_01@1", 2, 560, 1560 - 465, {
        tracks: { "part.leaf.scaleX": doorTrack(doorOpen) },
      }),
      svg("set_clock", "prop_wall_clock_01@1", 2, 1220, 640, { scale: 0.8 }),
      svg("set_plant", "prop_plant_floor_01@1", 3, 1840, 1600 - 210),
      svg("set_chair_left", "prop_chair_office_side_01@1", 5, 880 + 30, FLOOR - 280),
      svg("set_chair_right", "prop_chair_office_side_01@1", 5, 1540 - 30, FLOOR - 280, {
        props: { flip: true },
      }),
      svg("set_desk", "prop_desk_side_01@1", 15, DESK_X, FLOOR - 190),
      svg("set_laptop", "prop_laptop_side_01@1", 16, DESK_X + 70, DESK_TOP - (162 - 85) * 0.62, {
        scale: 0.62,
      }),
      svg("set_mug", "prop_mug_01@1", 16, DESK_X - 100, DESK_TOP - 43, { scale: 0.85 }),
    ],
  },
};

/** The sets section of the planner prompt. */
export function describeSets(): string {
  return Object.values(SETS)
    .map(
      (s) =>
        `- ${s.id} (background ${s.background}): ${s.description}\n  marks: ${Object.entries(s.marks)
          .map(([k, m]) => `${k} = ${m.description}`)
          .join("; ")}\n  hand-overs across the desk: ${s.handover.map((p) => p.join(" <-> ")).join(", ")}`,
    )
    .join("\n");
}
