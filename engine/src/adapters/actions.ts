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
