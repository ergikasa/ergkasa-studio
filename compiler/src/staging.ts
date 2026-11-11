import type { Keyframe } from "@erkasa/contracts";
import { SEAT, SIDE_ACTIONS, sideGaitSpeed, sideHandItem } from "@erkasa/engine";

/**
 * Staging: the geometry of people moving on a set. Shared by hand-directed scenes and by the
 * blocking resolver, so both obey the same physics:
 *
 * - a walk moves at exactly the speed of its steps (no sliding feet)
 * - a seated character keeps its feet where it stood; the hips land on the chair's `hip` anchor
 * - a hand-over happens where two hands actually meet
 *
 * World units: background pixels (2560x1920), floor at FLOOR, characters at SCALE.
 */

export const FLOOR = 1690;
export const SCALE = 0.92;
const FPS = 30;

export type Facing = "left" | "right";
const dir = (f: Facing): number => (f === "right" ? 1 : -1);

export function kf(f: number, v: number | string, extra: Partial<Keyframe> = {}): Keyframe {
  return { f: Math.round(f), v, ...extra } as Keyframe;
}

/** World px per second of a side walk at the given scale. */
export function walkSpeed(action: "walk" | "walk_phone" = "walk", scale = SCALE): number {
  return sideGaitSpeed(action) * scale;
}

/**
 * x keyframes of a walk from x0 to x1 that starts at frame f0: eases in over the gait's ramp (0.25 s),
 * then moves at exactly the gait speed and stops on a planted foot. Returns the keys and the arrival frame.
 */
export function walkKeys(
  f0: number,
  x0: number,
  x1: number,
  action: "walk" | "walk_phone" = "walk",
  scale = SCALE,
): { keys: Keyframe[]; arrive: number } {
  const speed = walkSpeed(action, scale);
  const d = Math.sign(x1 - x0);
  const dist = Math.abs(x1 - x0);
  if (dist < 1) return { keys: [kf(f0, x0)], arrive: Math.round(f0) };
  const rampF = 0.25 * FPS;
  const rampDist = Math.min(dist, (speed * 0.25) / 2);
  const a = f0 + rampF;
  const arrive = a + ((dist - rampDist) / speed) * FPS;
  return {
    keys: [kf(f0, x0), kf(a, x0 + d * rampDist, { ease: "easeIn" }), kf(arrive, x1, { ease: "linear" })],
    arrive: Math.round(arrive),
  };
}

/** Frames a walk of `dist` world px takes. */
export function walkFrames(dist: number, action: "walk" | "walk_phone" = "walk", scale = SCALE): number {
  const speed = walkSpeed(action, scale);
  return Math.round(0.25 * FPS + ((Math.abs(dist) - (speed * 0.25) / 2) / speed) * FPS);
}

/** Frames `sit` / `stand_up` take. */
export const SIT_FRAMES = Math.round(0.85 * FPS);

/** Where the feet stand for a character seated with its hips at `hipX`, facing `facing`. */
export function feetForSeat(hipX: number, facing: Facing, scale = SCALE): number {
  return hipX + dir(facing) * SEAT.back * scale;
}

/** World point of the near hand's held item for a side action pose (after its ease-in). */
export function handPoint(
  feetX: number,
  facing: Facing,
  action: "give" | "seated_give",
  scale = SCALE,
): [number, number] {
  const fn = SIDE_ACTIONS[action];
  if (!fn) throw new Error(`no side action ${action}`);
  const [x, y] = sideHandItem(fn(2, 0));
  return [feetX + dir(facing) * (x - 200) * scale, FLOOR + (y - 872) * scale];
}

/** World position (centre) for an SVG prop of size w x h whose `anchor` (normalized) must land at (ax, ay). */
export function propCentre(
  size: [number, number],
  anchor: [number, number],
  at: [number, number],
  flip = false,
  scale = 1,
): [number, number] {
  const [w, h] = size;
  const dx = (w / 2 - anchor[0] * w) * scale * (flip ? -1 : 1);
  const dy = (h / 2 - anchor[1] * h) * scale;
  return [at[0] + dx, at[1] + dy];
}
