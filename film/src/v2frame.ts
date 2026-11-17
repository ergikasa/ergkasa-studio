/**
 * The v2 picture around the shot drawings: the camera views, the over-the-shoulder shoulder, the scrims behind
 * type, the transitions and the frame. Pure functions of their inputs (E1.4): the plan path (compose.ts) and the
 * package renderer (package/) draw through the same code, so they cannot drift apart.
 */
import { fmt, ramp } from "./motion.js";
import { H, W, frame } from "./style.js";

export const SCRIMS = `<linearGradient id="scrimT" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0C1529" stop-opacity=".78"/><stop offset="1" stop-color="#0C1529" stop-opacity="0"/></linearGradient>
<linearGradient id="scrimB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0C1529" stop-opacity="0"/><stop offset="1" stop-color="#0C1529" stop-opacity=".8"/></linearGradient>`;

export type ScrimPlace = "top" | "center" | "bottom";

/** The dark gradient behind type on a set shot. */
export const scrimRect = (place: ScrimPlace): string =>
  place === "bottom"
    ? `<rect x="0" y="1150" width="${W}" height="770" fill="url(#scrimB)"/>`
    : `<rect x="0" y="0" width="${W}" height="${place === "center" ? 1100 : 620}" fill="url(#scrimT)"/>`;

/** Over the shoulder: the near shoulder and head of the subject, dark, in the foreground. */
export function otsShoulder(t: number, dur: number, facing: 1 | -1): string {
  const sh = ramp(t, 0, dur, "lin");
  const mirror = facing === 1 ? "" : ` transform="translate(${W} 0) scale(-1 1)"`;
  return `<g${mirror}><g transform="translate(${fmt(-90 * sh)} ${fmt(60 * sh)})"><path d="M-80 1920 Q-40 1500 200 1430 Q420 1380 520 1560 L560 1920Z" fill="#141B2E"/><ellipse cx="300" cy="1270" rx="190" ry="210" fill="#141B2E"/></g></g>`;
}

/** A set seen by the camera: world point (cx, cy) at the centre of the frame, `height` world units tall. */
export const setView = (cam: { cx: number; cy: number; height: number }, world: string): string =>
  `<g transform="translate(${W / 2} ${H / 2}) scale(${fmt(H / cam.height)}) translate(${fmt(-cam.cx)} ${fmt(-cam.cy)})">${world}</g>`;

/** An editorial template under its camera: zoomed by `z` about the frame centre, raised by `dy`. */
export const editorialView = (z: number, dy: number, svg: string): string =>
  `<g transform="translate(540 ${fmt(960 + dy)}) scale(${fmt(z)}) translate(-540 -960)">${svg}</g>`;

export interface Drawn {
  body: string;
  bg: string;
}

/**
 * One finished v2 frame: the current drawing on its background, and, inside a transition, the previous one
 * (`p` is the eased progress, 0..1). A dissolve fades the current drawing in over the previous one; a whip slides
 * the previous one out to the left as the current one comes in from the right.
 */
export function v2Frame(cur: Drawn, prev?: { drawn: Drawn; kind: "dissolve" | "whip"; p: number }): string {
  let body = `<rect width="${W}" height="${H}" fill="${cur.bg}"/>${cur.body}`;
  if (prev) {
    const { p } = prev;
    const pb = `<rect width="${W}" height="${H}" fill="${prev.drawn.bg}"/>${prev.drawn.body}`;
    if (prev.kind === "dissolve") body = `${pb}<g opacity="${fmt(p)}">${body}</g>`;
    else
      body = `<g transform="translate(${fmt(-W * p)} 0)">${pb}</g><g transform="translate(${fmt(W * (1 - p))} 0)">${body}</g>`;
  }
  return frame(`<defs>${SCRIMS}</defs>${body}`, cur.bg);
}
