/**
 * A 2.5D camera over layered places. The camera has a centre and a visible height on the actors' plane, like the
 * studio-v2 camera, plus a distance: when it moves closer, nearer layers grow faster than far ones, and when it
 * pans, far layers slide less. Part of every zoom is lens and part is distance (GAMMA), so close shots keep some
 * of the room behind the subject instead of losing it.
 */
import { H, W } from "../style.js";

export interface Cam {
  cx: number;
  cy: number;
  height: number;
}

/** The wide reference view every layer is authored for. */
export const REF: Cam = { cx: 1450, cy: 1120, height: 2140 };
const DREF = REF.height;
/** 0 = pure lens zoom (no parallax), 1 = pure dolly. */
const GAMMA = 0.55;

const dist = (c: Cam): number => DREF * (c.height / REF.height) ** GAMMA;

/** Affine projection of a layer at depth dz: screen = (p - c) * s + (W/2, H/2). */
export interface Proj {
  s: number;
  cx: number;
  cy: number;
}

export function project(c: Cam, dz: number): Proj {
  const D = dist(c);
  const s = (H / c.height) * ((D * (DREF + dz)) / (DREF * (D + dz)));
  const k = DREF / (DREF + dz);
  return { s, cx: REF.cx + (c.cx - REF.cx) * k, cy: REF.cy + (c.cy - REF.cy) * k };
}

export const toScreen = (p: Proj, x: number, y: number): [number, number] => [
  (x - p.cx) * p.s + W / 2,
  (y - p.cy) * p.s + H / 2,
];

export const svgTransform = (p: Proj): string =>
  `translate(${W / 2} ${H / 2}) scale(${p.s.toFixed(5)}) translate(${(-p.cx).toFixed(3)} ${(-p.cy).toFixed(3)})`;

/** The camera centre that puts a point of a layer at depth dz at screen position (sx, sy). */
export function aimAt(height: number, dz: number, x: number, y: number, sx = W / 2, sy = H / 2): Cam {
  // solve (x - cx_p) * s + W/2 = sx with cx_p = REF.cx + (cx - REF.cx) * k
  const probe = project({ cx: REF.cx, cy: REF.cy, height }, dz);
  const k = DREF / (DREF + dz);
  const cxp = x - (sx - W / 2) / probe.s;
  const cyp = y - (sy - H / 2) / probe.s;
  return { cx: REF.cx + (cxp - REF.cx) / k, cy: REF.cy + (cyp - REF.cy) / k, height };
}

export const lerpCam = (a: Cam, b: Cam, k: number): Cam => ({
  cx: a.cx + (b.cx - a.cx) * k,
  cy: a.cy + (b.cy - a.cy) * k,
  height: a.height * (b.height / a.height) ** k,
});
