import type { PartPose } from "../core/svg-template.js";

/**
 * Character actions for the front-facing biped skeleton (`erkasa_biped_front_v1`).
 * An action is a pure function of the time since it started (seconds) -> bone poses.
 * Angles are degrees, SVG convention (positive = clockwise on screen).
 * Left/right are screen sides: raising the left arm outward is positive, the right arm negative.
 */
export type Pose = Record<string, PartPose>;
export type Action = (t: number, phase: number) => Pose;

const TAU = Math.PI * 2;
const sin = (t: number, hz: number, ph = 0): number => Math.sin(t * TAU * hz + ph);
/** Ease in over the first `d` seconds so actions don't snap. */
const ramp = (t: number, d = 0.35): number => {
  const x = Math.min(1, Math.max(0, t / d));
  return x * x * (3 - 2 * x);
};

function idleBase(t: number, phase: number): Pose {
  const breath = (1 - Math.cos(t * TAU * 0.28 + phase)) / 2;
  return {
    torso: { y: -2.5 * breath, scaleY: 1 + 0.006 * breath },
    head: { rotation: 1.4 * sin(t, 0.19, phase), y: -2.5 * breath },
    neck: { y: -2.5 * breath },
    arm_upper_l: { rotation: 2 * sin(t, 0.28, phase + 0.4), y: -2.5 * breath },
    arm_upper_r: { rotation: -2 * sin(t, 0.28, phase + 0.9), y: -2.5 * breath },
    arm_lower_l: { rotation: 2.5 * sin(t, 0.28, phase + 1.0) },
    arm_lower_r: { rotation: -2.5 * sin(t, 0.28, phase + 1.4) },
  };
}

function merge(base: Pose, over: Pose): Pose {
  const out: Pose = { ...base };
  for (const [k, v] of Object.entries(over)) out[k] = { ...(out[k] ?? {}), ...v };
  return out;
}

export const ACTIONS: Record<string, Action> = {
  idle: idleBase,

  talk: (t, ph) => {
    const k = ramp(t);
    return merge(idleBase(t, ph), {
      head: {
        rotation: 2.2 * sin(t, 0.7, ph) * k + 1.2 * sin(t, 2.1, ph) * k,
        y: -1.5 * Math.abs(sin(t, 2.4, ph)) * k,
      },
      arm_upper_r: { rotation: (-14 - 6 * sin(t, 0.9, ph)) * k },
      arm_lower_r: { rotation: (55 + 18 * sin(t, 1.3, ph + 0.5)) * k },
      hand_r: { rotation: 10 * sin(t, 1.3, ph + 1) * k },
    });
  },

  wave: (t, ph) => {
    const k = ramp(t, 0.45);
    return merge(idleBase(t, ph), {
      arm_upper_r: { rotation: -150 * k },
      arm_lower_r: { rotation: (18 + 24 * sin(t, 2.0, ph)) * k },
      hand_r: { rotation: -12 * sin(t, 2.0, ph + 0.6) * k },
      head: { rotation: 4 * k },
    });
  },

  point_side: (t, ph) => {
    const k = ramp(t, 0.4);
    return merge(idleBase(t, ph), {
      arm_upper_r: { rotation: (-88 + 1.5 * sin(t, 0.5, ph)) * k },
      arm_lower_r: { rotation: -4 * k },
      head: { rotation: 5 * k },
    });
  },

  point_side_left: (t, ph) => {
    const k = ramp(t, 0.4);
    return merge(idleBase(t, ph), {
      arm_upper_l: { rotation: (88 + 1.5 * sin(t, 0.5, ph)) * k },
      arm_lower_l: { rotation: 4 * k },
      head: { rotation: -5 * k },
    });
  },

  think: (t, ph) => {
    const k = ramp(t, 0.5);
    return merge(idleBase(t, ph), {
      arm_upper_r: { rotation: 20 * k },
      arm_lower_r: { rotation: 148 * k },
      hand_r: { rotation: -20 * k },
      head: { rotation: (-6 + 1 * sin(t, 0.3, ph)) * k },
    });
  },

  arms_up: (t, ph) => {
    const k = ramp(t, 0.3);
    const hop = Math.max(0, sin(t, 1.6, ph)) * 14 * k;
    return merge(idleBase(t, ph), {
      arm_upper_l: { rotation: 155 * k, y: -hop },
      arm_upper_r: { rotation: -155 * k, y: -hop },
      arm_lower_l: { rotation: (-20 + 10 * sin(t, 3.2, ph)) * k },
      arm_lower_r: { rotation: (20 - 10 * sin(t, 3.2, ph)) * k },
      torso: { y: -hop },
      neck: { y: -hop },
      head: { y: -hop, rotation: 3 * sin(t, 1.6, ph) * k },
    });
  },

  nod: (t, ph) => {
    const k = ramp(t, 0.2);
    return merge(idleBase(t, ph), {
      head: { y: 5 * Math.abs(sin(t, 1.4, ph)) * k, scaleY: 1 - 0.015 * Math.abs(sin(t, 1.4, ph)) * k },
    });
  },

  shake_head: (t, ph) => {
    const k = ramp(t, 0.2);
    return merge(idleBase(t, ph), {
      head: { x: 5 * sin(t, 2.2, ph) * k, rotation: 3 * sin(t, 2.2, ph) * k },
    });
  },

  // ---- body language with the hand item (`holding`: phone, document) and emotions ----

  /** Phone held in front of the chest, eyes down, thumb scrolling. */
  use_phone: (t, ph) => {
    const k = ramp(t, 0.45);
    return merge(idleBase(t, ph), {
      arm_upper_r: { rotation: 4 * k },
      arm_lower_r: { rotation: 118 * k },
      hand_r: { rotation: (52 + 4 * sin(t, 1.1, ph)) * k },
      head: { rotation: 3 * k, y: 5 * k },
    });
  },

  /** A sheet held with both hands, reading it. */
  read: (t, ph) => {
    const k = ramp(t, 0.45);
    return merge(idleBase(t, ph), {
      arm_upper_r: { rotation: 2 * k },
      arm_lower_r: { rotation: 128 * k },
      hand_r: { rotation: 40 * k },
      arm_upper_l: { rotation: -2 * k },
      arm_lower_l: { rotation: -122 * k },
      head: { rotation: 1.5 * sin(t, 0.25, ph) * k, y: 6 * k },
    });
  },

  /** Raises the left wrist and looks at the watch. */
  check_watch: (t, ph) => {
    const k = ramp(t, 0.4);
    return merge(idleBase(t, ph), {
      arm_upper_l: { rotation: -26 * k },
      arm_lower_l: { rotation: -98 * k },
      hand_l: { rotation: 10 * k },
      head: { rotation: -7 * k, y: 4 * k },
    });
  },

  /** Hand to the forehead, head drops: "why did I do that". */
  facepalm: (t, ph) => {
    const k = ramp(t, 0.35);
    return merge(idleBase(t, ph), {
      arm_upper_r: { rotation: 24 * k, y: -16 * k },
      arm_lower_r: { rotation: 166 * k },
      hand_r: { rotation: -40 * k },
      neck: { y: 6 * k },
      head: { rotation: (5 + 1.5 * sin(t, 0.7, ph)) * k, y: 12 * k },
    });
  },

  /** Both hands on the head, a small anxious sway. */
  stressed: (t, ph) => {
    const k = ramp(t, 0.4);
    const sway = 2.5 * sin(t, 1.3, ph);
    return merge(idleBase(t, ph), {
      arm_upper_r: { rotation: -148 * k },
      arm_lower_r: { rotation: -100 * k },
      hand_r: { rotation: -20 * k },
      arm_upper_l: { rotation: 148 * k },
      arm_lower_l: { rotation: 100 * k },
      hand_l: { rotation: 20 * k },
      head: { rotation: sway * k, y: 3 * k },
      torso: { rotation: sway * 0.3 * k },
    });
  },

  /** Shoulders drop, head down: tired, guilty, defeated. */
  slump: (t, ph) => {
    const k = ramp(t, 0.6);
    const breath = (1 - Math.cos(t * TAU * 0.2 + ph)) / 2;
    return {
      torso: { y: (7 + 2 * breath) * k, scaleY: 1 - 0.015 * k },
      neck: { y: (8 + 2 * breath) * k },
      head: { y: (13 + 2 * breath) * k, rotation: -4 * k },
      arm_upper_l: { y: 8 * k, rotation: -3 * k },
      arm_upper_r: { y: 8 * k, rotation: 3 * k },
      arm_lower_l: { rotation: -4 * k },
      arm_lower_r: { rotation: 4 * k },
    };
  },

  /** Palms out, shoulders up: "I don't know" / "it is what it is". */
  shrug: (t, ph) => {
    const k = ramp(t, 0.3);
    const up = 7 * k;
    return merge(idleBase(t, ph), {
      arm_upper_r: { rotation: -24 * k, y: -up },
      arm_lower_r: { rotation: -78 * k },
      hand_r: { rotation: -18 * k },
      arm_upper_l: { rotation: 24 * k, y: -up },
      arm_lower_l: { rotation: 78 * k },
      hand_l: { rotation: 18 * k },
      neck: { y: -up * 0.4 },
      head: { rotation: 7 * k, y: -up * 0.3 },
    });
  },

  // ---- social body language (production list, category 01) ----

  /** Arms folded across the chest, chin slightly up: closed, sceptical, defensive, confident. */
  cross_arms: (t, ph) => {
    const k = ramp(t, 0.45);
    return merge(idleBase(t, ph), {
      arm_upper_r: { rotation: 12 * k },
      arm_lower_r: { rotation: 86 * k },
      hand_r: { rotation: 6 * k },
      arm_upper_l: { rotation: -10 * k, y: -6 * k },
      arm_lower_l: { rotation: -94 * k },
      hand_l: { rotation: -6 * k },
      head: { rotation: (-2 + 1 * sin(t, 0.2, ph)) * k, y: -2 * k },
    });
  },

  /** Heated argument: the right arm jabs an accusing finger to the side, the left fist is raised, head jerking. */
  argue: (t, ph) => {
    const k = ramp(t, 0.25);
    const jab = Math.max(0, sin(t, 1.6, ph)) ** 2;
    return merge(idleBase(t, ph), {
      arm_upper_r: { rotation: (-60 - 14 * jab) * k },
      arm_lower_r: { rotation: (-16 + 22 * jab) * k },
      hand_r: { rotation: -10 * k },
      arm_upper_l: { rotation: (46 + 4 * jab) * k },
      arm_lower_l: { rotation: (112 + 8 * sin(t, 1.6, ph + 1.5)) * k },
      hand_l: { rotation: 6 * k },
      torso: { rotation: 1.5 * sin(t, 1.6, ph) * k },
      head: { rotation: (4 + 3 * sin(t, 1.6, ph + 0.3)) * k, y: (2 - 3 * jab) * k },
    });
  },

  /** Calm negotiation: both palms open at waist height, offering one option then the other. */
  negotiate: (t, ph) => {
    const k = ramp(t, 0.5);
    const side = sin(t, 0.45, ph);
    return merge(idleBase(t, ph), {
      arm_upper_r: { rotation: -26 * k },
      arm_lower_r: { rotation: (60 + 18 * Math.max(0, side)) * k },
      hand_r: { rotation: -24 * k },
      arm_upper_l: { rotation: 26 * k },
      arm_lower_l: { rotation: (-60 - 18 * Math.max(0, -side)) * k },
      hand_l: { rotation: 24 * k },
      head: { rotation: 3 * side * k },
    });
  },

  /** Presenting: the right arm opens towards the screen side, palm up, as if showing a chart. */
  present: (t, ph) => {
    const k = ramp(t, 0.45);
    return merge(idleBase(t, ph), {
      arm_upper_r: { rotation: (-66 + 4 * sin(t, 0.5, ph)) * k },
      arm_lower_r: { rotation: (-26 + 6 * sin(t, 0.5, ph + 0.7)) * k },
      hand_r: { rotation: -24 * k },
      arm_upper_l: { rotation: 10 * k },
      arm_lower_l: { rotation: -38 * k },
      hand_l: { rotation: 12 * k },
      head: { rotation: (6 + 1.5 * sin(t, 0.6, ph)) * k },
    });
  },

  /** Observing: still body, arms close, the head slowly scanning from one side to the other. */
  observe: (t, ph) => {
    const k = ramp(t, 0.5);
    const scan = Math.sin(t * TAU * 0.16 + ph);
    return merge(idleBase(t, ph), {
      arm_upper_r: { rotation: 16 * k },
      arm_lower_r: { rotation: 72 * k },
      arm_upper_l: { rotation: -8 * k },
      arm_lower_l: { rotation: -20 * k },
      head: { rotation: 8 * scan * k, x: 7 * scan * k, y: 2 * k },
      eyes: { x: 3 * scan * k },
      torso: { rotation: 1.2 * scan * k },
    });
  },

  /** Looking up (at a wall clock, a sign, the sky): head tips back, shoulders settle. */
  look_up: (t, ph) => {
    const k = ramp(t, 0.5);
    return merge(idleBase(t, ph), {
      neck: { y: -3 * k },
      head: { y: -8 * k, scaleY: 1 - 0.03 * k, rotation: 1 * sin(t, 0.2, ph) * k },
      eyes: { y: -5 * k },
      brows: { y: -7 * k },
      arm_upper_r: { rotation: 2 * k },
      arm_upper_l: { rotation: -2 * k },
    });
  },
};

export const ACTION_NAMES = Object.keys(ACTIONS);

/** Linear blend of two poses (rotation, offsets, scale, opacity). */
export function blendPoses(a: Pose, b: Pose, k: number): Pose {
  const out: Pose = {};
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    const pa = a[key] ?? {};
    const pb = b[key] ?? {};
    const mix = (x: number | undefined, y: number | undefined, d: number): number =>
      (x ?? d) + ((y ?? d) - (x ?? d)) * k;
    out[key] = {
      rotation: mix(pa.rotation, pb.rotation, 0),
      x: mix(pa.x, pb.x, 0),
      y: mix(pa.y, pb.y, 0),
      scaleX: mix(pa.scaleX, pb.scaleX, 1),
      scaleY: mix(pa.scaleY, pb.scaleY, 1),
    };
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Side view (`erkasa_biped_side_v1`, drawn facing right). Forward = negative rotation.
// `_n` = near limb, `_f` = far limb. Legs and arms are nested chains (thigh > shin > foot).
// The special key `root` moves the whole character (used by jump).
// ---------------------------------------------------------------------------------------------

const UPPER = ["torso", "neck", "head", "arm_upper_n", "arm_upper_f"];

function lift(pose: Pose, dy: number): Pose {
  for (const k of UPPER) pose[k] = { ...(pose[k] ?? {}), y: (pose[k]?.y ?? 0) + dy };
  return pose;
}

function sideIdle(t: number, phase: number): Pose {
  const breath = (1 - Math.cos(t * TAU * 0.28 + phase)) / 2;
  return lift(
    {
      torso: { scaleY: 1 + 0.006 * breath },
      head: { rotation: 1.2 * sin(t, 0.19, phase) },
      arm_upper_n: { rotation: 2 * sin(t, 0.28, phase) },
      arm_upper_f: { rotation: -2 * sin(t, 0.28, phase + 0.5) },
      arm_lower_n: { rotation: -6 },
      arm_lower_f: { rotation: -6 },
    },
    -2.5 * breath,
  );
}

/**
 * One leg through a gait cycle. Stance (the first `stance` fraction): the leg is straight and sweeps
 * from forward to back while the foot stays planted. Swing: the knee bends, the leg comes forward and
 * the foot clears the floor. `phase` 0..1.
 */
function leg(
  phase: number,
  amp: number,
  knee: number,
  stance: number,
): { thigh: number; shin: number; foot: number } {
  const p = ((phase % 1) + 1) % 1;
  if (p < stance) {
    const u = p / stance;
    const thigh = -amp + 2 * amp * u; // forward (negative) -> back (positive)
    const shin = 4;
    return { thigh, shin, foot: -(thigh + shin) };
  }
  const u = (p - stance) / (1 - stance);
  const e = u * u * (3 - 2 * u);
  const thigh = amp - 2 * amp * e;
  const shin = 4 + knee * Math.sin(Math.PI * u);
  return { thigh, shin, foot: -(thigh + shin) * 0.7 };
}

/** A walk or run cycle: legs half a cycle apart, arms swinging against the legs. */
function gait(
  t: number,
  hz: number,
  thighAmp: number,
  kneeAmp: number,
  armAmp: number,
  elbow: number,
  lean: number,
  bob: number,
  stance = 0.6,
): Pose {
  const ph = t * hz;
  const n = leg(ph, thighAmp, kneeAmp, stance);
  const f = leg(ph + 0.5, thighAmp, kneeAmp, stance);
  const swingN = n.thigh / thighAmp; // -1 forward .. 1 back
  const pose: Pose = {
    thigh_n: { rotation: n.thigh },
    shin_n: { rotation: n.shin },
    foot_n: { rotation: n.foot },
    thigh_f: { rotation: f.thigh },
    shin_f: { rotation: f.shin },
    foot_f: { rotation: f.foot },
    arm_upper_n: { rotation: -armAmp * swingN },
    arm_upper_f: { rotation: armAmp * swingN },
    arm_lower_n: { rotation: elbow - 6 * Math.max(0, -swingN) },
    arm_lower_f: { rotation: elbow - 6 * Math.max(0, swingN) },
    torso: { rotation: lean },
    head: { rotation: -lean * 0.5 + 1.2 * Math.sin(ph * TAU * 2) },
  };
  return lift(pose, bob * Math.abs(Math.sin(ph * TAU * 2)));
}

// ---- leg kinematics of erkasa_biped_side_v1 (all studio characters share these pivots) ----
const HIP: Vec = [200, 474];
const KNEE: Vec = [200, 642];
const ANKLE: Vec = [200, 828];
const HEEL: Vec = [172, 872];
const TOE: Vec = [264, 872];
/** The floor line of the side rig (its ground anchor). */
export const SIDE_FLOOR_Y = 872;
type Vec = [number, number];

/** Rotates a vector by `deg` in SVG convention (positive = clockwise on screen, y down). */
function rotate([x, y]: Vec, deg: number): Vec {
  const a = (deg * Math.PI) / 180;
  return [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
}
const add = (a: Vec, b: Vec): Vec => [a[0] + b[0], a[1] + b[1]];
const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1]];

/** Heel and toe of one leg in rig coordinates, before any `root` offset. */
export function sideFoot(pose: Pose, leg: "n" | "f"): { heel: Vec; toe: Vec } {
  const a1 = pose[`thigh_${leg}`]?.rotation ?? 0;
  const a2 = a1 + (pose[`shin_${leg}`]?.rotation ?? 0);
  const a3 = a2 + (pose[`foot_${leg}`]?.rotation ?? 0);
  const knee = add(HIP, rotate(sub(KNEE, HIP), a1));
  const ankle = add(knee, rotate(sub(ANKLE, KNEE), a2));
  return { heel: add(ankle, rotate(sub(HEEL, ANKLE), a3)), toe: add(ankle, rotate(sub(TOE, ANKLE), a3)) };
}

/**
 * Where the near hand holds an item (the centre of the `item` slot), in rig coordinates, including
 * the root offset. Used to stage hand-overs: two characters' hands must meet at the same point.
 */
export function sideHandItem(pose: Pose): Vec {
  const T: Vec = [200, 430];
  const S: Vec = [200, 240];
  const E: Vec = [200, 338];
  const H: Vec = [200, 440];
  const I: Vec = [200, 487];
  const rt = pose["torso"]?.rotation ?? 0;
  const ra = rt + (pose["arm_upper_n"]?.rotation ?? 0);
  const rb = ra + (pose["arm_lower_n"]?.rotation ?? 0);
  const rc = rb + (pose["hand_n"]?.rotation ?? 0);
  const shoulder = add(T, rotate(sub(S, T), rt));
  const elbow = add(shoulder, rotate(sub(E, S), ra));
  const hand = add(elbow, rotate(sub(H, E), rb));
  const item = add(hand, rotate(sub(I, H), rc));
  return [item[0] + (pose["root"]?.x ?? 0), item[1] + (pose["root"]?.y ?? 0)];
}

/** Lowest point of both feet (largest y). */
function lowestFootY(pose: Pose): number {
  const n = sideFoot(pose, "n");
  const f = sideFoot(pose, "f");
  return Math.max(n.heel[1], n.toe[1], f.heel[1], f.toe[1]);
}

/**
 * Keeps the feet on the floor: moves the whole body (root) so the lowest foot touches the floor.
 * Without this the hips stay fixed and the planted foot floats when the legs swing apart.
 */
function grounded(pose: Pose): Pose {
  const dy = SIDE_FLOOR_Y - lowestFootY(pose);
  return { ...pose, root: { ...(pose["root"] ?? {}), y: (pose["root"]?.y ?? 0) + dy } };
}

/**
 * Ground speed of a side walk cycle in rig px per second: how fast the planted foot moves backwards
 * relative to the hips. Moving the character at exactly this speed (times its scale) means no sliding feet.
 */
export function sideGaitSpeed(name: "walk" | "walk_phone"): number {
  const act = SIDE_ACTIONS[name];
  if (!act) return 0;
  const dt = 1 / 240;
  let dist = 0;
  let time = 0;
  for (let t = 2; t < 4; t += dt) {
    const a = act(t, 0);
    const b = act(t + dt, 0);
    const planted = (p: Pose): "n" | "f" => {
      const n = sideFoot(p, "n");
      const f = sideFoot(p, "f");
      return Math.max(n.heel[1], n.toe[1]) >= Math.max(f.heel[1], f.toe[1]) ? "n" : "f";
    };
    const leg = planted(a);
    const ax = (sideFoot(a, leg).heel[0] + sideFoot(a, leg).toe[0]) / 2;
    const bx = (sideFoot(b, leg).heel[0] + sideFoot(b, leg).toe[0]) / 2;
    dist += ax - bx;
    time += dt;
  }
  return Math.max(0, dist / time);
}

// ---- seated (side view) ----
/** Legs of a seated figure: thighs forward, shins down, feet flat. */
const SEATED_LEGS: Pose = {
  thigh_n: { rotation: -86 },
  shin_n: { rotation: 84 },
  foot_n: { rotation: 2 },
  thigh_f: { rotation: -80 },
  shin_f: { rotation: 82 },
  foot_f: { rotation: -2 },
};

/**
 * Where the hips end up relative to the standing feet. A seated figure keeps its feet where it stood:
 * the body moves back (x) and down (y) onto the seat. Exposed so props can be sized to the rig.
 */
export const SEAT = (() => {
  const legs = SEATED_LEGS;
  const footX = (sideFoot(legs, "n").heel[0] + sideFoot(legs, "n").toe[0]) / 2;
  const standX = (HEEL[0] + TOE[0]) / 2;
  const back = footX - standX; // the feet go forward by this much when the thighs swing up
  const down = SIDE_FLOOR_Y - lowestFootY(legs);
  /** Height of the hip joint above the floor when seated, rig px. */
  const hipHeight = SIDE_FLOOR_Y - (HIP[1] + down);
  return { back, down, hipHeight };
})();

function seatedBase(t: number, ph: number): Pose {
  const breath = (1 - Math.cos(t * TAU * 0.28 + ph)) / 2;
  return lift(
    {
      ...SEATED_LEGS,
      root: { x: -SEAT.back, y: SEAT.down },
      torso: { rotation: 2, scaleY: 1 + 0.006 * breath },
      head: { rotation: 1.2 * sin(t, 0.19, ph) },
      arm_upper_n: { rotation: -22 + 2 * sin(t, 0.28, ph) },
      arm_lower_n: { rotation: -52 },
      arm_upper_f: { rotation: -18 - 2 * sin(t, 0.28, ph + 0.5) },
      arm_lower_f: { rotation: -56 },
    },
    -2 * breath,
  );
}

/** Seated variants: the seated body plus an upper-body behaviour, eased in. */
function seatedWith(over: (t: number, ph: number) => Pose, d = 0.35): Action {
  return (t, ph) => {
    const k = ramp(t, d);
    return blendPoses(seatedBase(t, ph), merge(seatedBase(t, ph), over(t, ph)), k);
  };
}

/** 0..1 eased progress of a move that takes `d` seconds. */
const progress = (t: number, d: number): number => {
  const x = Math.min(1, Math.max(0, t / d));
  return x * x * (3 - 2 * x);
};

/** Standing <-> seated. The torso leans forward halfway, as people do; feet stay planted. */
function sitMotion(t: number, ph: number, up: boolean): Pose {
  const d = 0.85;
  const p = progress(t, d);
  const k = up ? 1 - p : p; // 0 = standing, 1 = seated
  const pose = blendPoses(sideIdle(t, ph), seatedBase(t, ph), k);
  const lean = -22 * Math.sin(Math.PI * Math.min(1, t / d));
  return merge(pose, {
    torso: { rotation: (pose["torso"]?.rotation ?? 0) + lean },
    head: { rotation: (pose["head"]?.rotation ?? 0) - lean * 0.4 },
    root: { x: -SEAT.back * k, y: SEAT.down * k },
  });
}

export const SIDE_ACTIONS: Record<string, Action> = {
  idle: sideIdle,

  walk: (t) => {
    const k = ramp(t, 0.25);
    return grounded(blendPoses(sideIdle(t, 0), gait(t, 0.95, 22, 48, 18, -14, 3, 0), k));
  },

  run: (t) => {
    const k = ramp(t, 0.2);
    return blendPoses(sideIdle(t, 0), gait(t, 1.45, 40, 78, 42, -85, 10, 11, 0.4), k);
  },

  talk: (t, ph) => {
    const k = ramp(t);
    return merge(sideIdle(t, ph), {
      head: { rotation: 2 * sin(t, 0.7, ph) * k + 1.2 * sin(t, 2.1, ph) * k },
      arm_upper_n: { rotation: (-24 - 8 * sin(t, 0.9, ph)) * k },
      arm_lower_n: { rotation: (-58 - 16 * sin(t, 1.3, ph + 0.5)) * k },
    });
  },

  /** Walking while staring at the phone (needs `holding: phone`). */
  walk_phone: (t) => {
    const k = ramp(t, 0.25);
    const g = gait(t, 0.85, 20, 30, 0, -14, 2, 4);
    return grounded(
      blendPoses(
        sideIdle(t, 0),
        merge(g, {
          arm_upper_n: { rotation: -6 },
          arm_lower_n: { rotation: -118 },
          hand_n: { rotation: 20 },
          head: { rotation: 10 + 1 * Math.sin(t * TAU * 1.7) },
        }),
        k,
      ),
    );
  },

  /** Standing at a desk, typing: forearms forward, hands tapping. */
  type: (t, ph) => {
    const k = ramp(t, 0.35);
    return merge(sideIdle(t, ph), {
      arm_upper_n: { rotation: -38 * k },
      arm_lower_n: { rotation: (-52 + 4 * sin(t, 5.5, ph)) * k },
      arm_upper_f: { rotation: -32 * k },
      arm_lower_f: { rotation: (-58 + 4 * sin(t, 5.5, ph + 1.6)) * k },
      head: { rotation: (6 + 1 * sin(t, 0.4, ph)) * k },
      torso: { rotation: 3 * k },
    });
  },

  /** Standing, leans over a desk and holds something out at arm's length (a hand-over). */
  give: (t, ph) => {
    const k = ramp(t, 0.6);
    return merge(sideIdle(t, ph), {
      torso: { rotation: -8 * k },
      head: { rotation: 6 * k },
      arm_upper_n: { rotation: -38 * k },
      arm_lower_n: { rotation: -22 * k },
      hand_n: { rotation: 10 * k },
    });
  },

  /** Sits down from standing, onto a seat behind: feet stay where they are. Then stays seated. */
  sit: (t, ph) => sitMotion(t, ph, false),
  /** Stands up from seated; ends standing where the feet are. */
  stand_up: (t, ph) => sitMotion(t, ph, true),
  seated: seatedBase,
  seated_talk: seatedWith((t, ph) => ({
    head: { rotation: 2 * sin(t, 0.7, ph) + 1.2 * sin(t, 2.1, ph) },
    arm_upper_n: { rotation: -34 - 8 * sin(t, 0.9, ph) },
    arm_lower_n: { rotation: -62 - 14 * sin(t, 1.3, ph + 0.5) },
  })),
  /** Typing on a laptop on the desk in front. */
  seated_type: seatedWith((t, ph) => ({
    arm_upper_n: { rotation: -30 },
    arm_lower_n: { rotation: -64 + 4 * sin(t, 5.5, ph) },
    arm_upper_f: { rotation: -26 },
    arm_lower_f: { rotation: -70 + 4 * sin(t, 5.5, ph + 1.6) },
    head: { rotation: 7 + 1 * sin(t, 0.4, ph) },
    torso: { rotation: -3 },
  })),
  /** Nods twice, then listens. */
  seated_nod: seatedWith(
    (t) => ({
      head: { rotation: t < 1.4 ? 7 * Math.sin(t * TAU * 1.5) * (1 - t / 1.4) + 2 : 2 },
    }),
    0.15,
  ),
  /** Reads a document held in front (holding: document). */
  seated_read: seatedWith((t, ph) => ({
    arm_upper_n: { rotation: -40 },
    arm_lower_n: { rotation: -78 },
    hand_n: { rotation: 10 },
    head: { rotation: 9 + 1 * sin(t, 0.3, ph) },
  })),
  /** Reaches forward across a desk (handing something over), then holds the arm out. */
  seated_give: seatedWith(
    () => ({
      arm_upper_n: { rotation: -78 },
      arm_lower_n: { rotation: -12 },
      hand_n: { rotation: 0 },
      torso: { rotation: -8 },
    }),
    0.55,
  ),

  point_forward: (t, ph) => {
    const k = ramp(t, 0.4);
    return merge(sideIdle(t, ph), {
      arm_upper_n: { rotation: -84 * k },
      arm_lower_n: { rotation: -4 * k },
      head: { rotation: -2 * k },
    });
  },

  /** A jump every 1.1 s: crouch, take off, airborne with tucked legs, land. */
  jump: (t) => {
    const p = (t % 1.1) / 1.1;
    const air = p >= 0.2 && p < 0.7 ? Math.sin(((p - 0.2) / 0.5) * Math.PI) : 0;
    const crouch =
      p < 0.2
        ? Math.sin((p / 0.2) * Math.PI * 0.5)
        : p < 0.7
          ? 1 - Math.min(1, (p - 0.2) / 0.1)
          : Math.sin(((1 - p) / 0.3) * Math.PI * 0.5) * 0.8;
    let rootY = -150 * air;
    rootY += 24 * crouch;
    return {
      root: { y: rootY },
      thigh_n: { rotation: -28 * crouch - 30 * air },
      shin_n: { rotation: 52 * crouch + 60 * air },
      foot_n: { rotation: -24 * crouch - 30 * air },
      thigh_f: { rotation: -22 * crouch - 20 * air },
      shin_f: { rotation: 46 * crouch + 50 * air },
      foot_f: { rotation: -24 * crouch - 30 * air },
      torso: { rotation: 10 * crouch },
      arm_upper_n: { rotation: 30 * crouch - 150 * air },
      arm_upper_f: { rotation: 30 * crouch - 140 * air },
      arm_lower_n: { rotation: -10 },
      arm_lower_f: { rotation: -10 },
    };
  },
};

/** Pose of `root` (pivot at the drawing origin) that rotates the whole body by `deg` around point `p`. */
function rootRotation(deg: number, p: Vec): { rotation: number; x: number; y: number } {
  const r = (deg * Math.PI) / 180;
  const [px, py] = p;
  return {
    rotation: deg,
    x: px - (px * Math.cos(r) - py * Math.sin(r)),
    y: py - (px * Math.sin(r) + py * Math.cos(r)),
  };
}

Object.assign(SIDE_ACTIONS, {
  /** Handshake: the near arm forward at waist height, pumping twice, a small lean and nod. */
  shake_hands: ((t, ph) => {
    const k = ramp(t, 0.5);
    const pump = t > 0.6 && t < 1.8 ? 7 * Math.sin((t - 0.6) * TAU * 1.6) : 0;
    return merge(sideIdle(t, ph), {
      torso: { rotation: -4 * k },
      head: { rotation: (3 + (pump > 0 ? 1.5 : 0)) * k },
      arm_upper_n: { rotation: -48 * k + pump * k },
      arm_lower_n: { rotation: -26 * k },
      hand_n: { rotation: 6 * k },
    });
  }) satisfies Action,

  /** Trips and falls forward flat on the floor (about 1 s), then stays down, breathing. */
  fall: ((t) => {
    const d = 0.95;
    const u = Math.min(1, t / d);
    const g = u * u; // falls faster and faster
    const settle = t > d ? 3 * Math.exp(-(t - d) * 6) * Math.sin((t - d) * 30) : 0;
    const breath = t > d ? 1.5 * Math.sin(t * TAU * 0.3) : 0;
    return {
      // lies flat: a full quarter turn around the toes, then down onto the chest
      root: (() => {
        const r = rootRotation(90 * g + settle, TOE);
        return { ...r, y: r.y + 34 * g };
      })(),
      thigh_n: { rotation: -10 * Math.sin(Math.PI * u) },
      shin_n: { rotation: 18 * Math.sin(Math.PI * u) },
      thigh_f: { rotation: 14 * u },
      shin_f: { rotation: 10 * u },
      torso: { rotation: -6 * u, scaleY: 1 + 0.004 * breath },
      head: { rotation: -14 * u },
      // arms go forward to break the fall, then rest along the floor
      arm_upper_n: { rotation: -150 * Math.min(1, u * 1.6) + 40 * Math.max(0, u - 0.8) * 5 },
      arm_lower_n: { rotation: -20 * u },
      arm_upper_f: { rotation: -130 * Math.min(1, u * 1.4) + 30 * Math.max(0, u - 0.8) * 5 },
      arm_lower_f: { rotation: -24 * u },
    };
  }) satisfies Action,

  /**
   * Climbing stairs in place: the leading knee lifts high, the body pushes up and leans forward.
   * The ascent itself comes from the `y` track (the planner moves the character up the steps).
   */
  climb: ((t) => {
    const k = ramp(t, 0.3);
    const hz = 0.8;
    const p = (t * hz) % 1;
    const stepLeg = (q: number): { thigh: number; shin: number; foot: number } => {
      const lifted = Math.sin(Math.PI * Math.min(1, q / 0.5)) * (q < 0.5 ? 1 : 0);
      const thigh = -58 * lifted + 8 * (q >= 0.5 ? Math.sin((Math.PI * (q - 0.5)) / 0.5) : 0);
      const shin = 76 * lifted + 4;
      return { thigh, shin, foot: -(thigh + shin) * 0.8 };
    };
    const n = stepLeg(p);
    const f = stepLeg((p + 0.5) % 1);
    const push = -10 * Math.abs(Math.sin(t * TAU * hz));
    return blendPoses(
      sideIdle(t, 0),
      lift(
        {
          thigh_n: { rotation: n.thigh },
          shin_n: { rotation: n.shin },
          foot_n: { rotation: n.foot },
          thigh_f: { rotation: f.thigh },
          shin_f: { rotation: f.shin },
          foot_f: { rotation: f.foot },
          torso: { rotation: -9 },
          head: { rotation: 4 },
          arm_upper_n: { rotation: 22 * Math.sin(t * TAU * hz) },
          arm_upper_f: { rotation: -22 * Math.sin(t * TAU * hz) },
          arm_lower_n: { rotation: -24 },
          arm_lower_f: { rotation: -24 },
        },
        push,
      ),
      k,
    );
  }) satisfies Action,
});

/** Actions per skeleton, so the engine never runs a front action on a side rig (or vice versa). */
export const ACTIONS_BY_SKELETON: Record<string, Record<string, Action>> = {
  erkasa_biped_front_v1: ACTIONS,
  erkasa_biped_side_v1: SIDE_ACTIONS,
};
