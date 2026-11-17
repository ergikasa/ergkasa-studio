/**
 * The only door from the stager into the engine's current staging code (E1.2 bridge).
 *
 * The stager does not stage anything itself yet: it runs the existing, deterministic staging code (timing,
 * perform, compose, the W0 composer) and records what it computes, frame by frame, into a Render Package. In
 * E1.5 this code moves out of the engine into the stager and this file disappears. Until then every import of
 * engine internals goes through here, so the dependency is visible in one place. The engine is not modified.
 *
 * A few constants of compose.ts are module-private; they are repeated here verbatim (marked COPY) and the
 * reproduction tests fail if a copy and the engine disagree on what is drawn.
 */
export { prepare as prepareV2 } from "../../film/src/film.js";
export { FilmPlan, type Shot } from "../../film/src/contract.js";
export { shotFrames, type Composed, type ComposedShot } from "../../film/src/compose.js";
export { propAt, type ActorPerf, type Performance, type PropState } from "../../film/src/perform.js";
export { drawProp, type PropKind } from "../../film/src/props.js";
export {
  drawPerson,
  lookFor,
  STANDING,
  type Look,
  type Pose,
  type Placed,
  CHANNELS,
} from "../../film/src/rig.js";
export { SETS } from "../../film/src/sets.js";
export { TEMPLATES, PARAMS, type TemplateCtx } from "../../film/src/templates.js";
export { anchorTime, type Timing } from "../../film/src/timing.js";
export { K, fmt, clamp, ramp } from "../../film/src/motion.js";
export { FPS, W, H, PALETTE, kineticType, fontFiles, type TypeLine } from "../../film/src/style.js";
import { W, kineticType, type TypeLine } from "../../film/src/style.js";
import { clamp, fmt, ramp } from "../../film/src/motion.js";
export { parsePlan as parseW0Plan, prepare as prepareW0, typeSvg } from "../../film/src/w0/composer.js";
export type { Prepared as W0Prepared, PreparedShot as W0PreparedShot } from "../../film/src/w0/composer.js";
export { DEPTH as W0_DEPTH, WORLD_W, WORLD_H } from "../../film/src/w0/world.js";
export { REF as W0_REF } from "../../film/src/w0/camera.js";

/** COPY of compose.ts LIGHT. */
export const LIGHT = { day: 0, golden: 1, dusk: 2, night: 3 } as const;
/** COPY of compose.ts LIGHT_BG: editorial templates drawn on a light background (dark type). */
export const LIGHT_BG = new Set(["clock", "word_shadow", "window_dream"]);
/** COPY of compose.ts TRANSITION_SEC. */
export const TRANSITION_SEC = { cut: 0, fade: 0.45, whip: 0.32 } as const;
/** COPY of the W0 composer: a fade into a W0 shot lasts 0.5 s. */
export const W0_FADE_SEC = 0.5;

// ---- COPIES of drawings that are module-private in the engine. They are what the builtins `overlay.ots`,
// ---- `overlay.scrim` and `type.w0` draw; the reproduction tests rebuild whole frames with them and compare with
// ---- the engine's output, so a copy that drifts from the engine fails the tests.

/** COPY of compose.ts otsShoulder: the near shoulder and head of the subject, dark, in the foreground. */
export function otsShoulder(t: number, dur: number, facing: 1 | -1): string {
  const sh = ramp(t, 0, dur, "lin");
  const mirror = facing === 1 ? "" : ` transform="translate(${W} 0) scale(-1 1)"`;
  return `<g${mirror}><g transform="translate(${fmt(-90 * sh)} ${fmt(60 * sh)})"><path d="M-80 1920 Q-40 1500 200 1430 Q420 1380 520 1560 L560 1920Z" fill="#141B2E"/><ellipse cx="300" cy="1270" rx="190" ry="210" fill="#141B2E"/></g></g>`;
}

/** COPY of compose.ts typeLayer's scrim behind type on staged shots. */
export function scrimSvg(place: "top" | "center" | "bottom"): string {
  return place === "bottom"
    ? `<rect x="0" y="1150" width="${W}" height="770" fill="url(#scrimB)"/>`
    : `<rect x="0" y="0" width="${W}" height="${place === "center" ? 1100 : 620}" fill="url(#scrimT)"/>`;
}

/** COPY of the type part of the W0 composer's typeSvg (scrim with its fade, then kinetic type). */
export function w0TypeSvg(
  t: number,
  lines: TypeLine[],
  place: "top" | "center" | "bottom",
  at: number,
  out: number | null,
): string {
  const y = place === "bottom" ? 1300 : place === "center" ? 860 : 250;
  const a = clamp((t - at + 0.2) / 0.5) * (out !== null ? 1 - clamp((t - out) / 0.4) : 1);
  let o = "";
  if (a > 0.01)
    o += `<rect x="0" y="0" width="${W}" height="${place === "top" ? 760 : 1920}" fill="url(#scrimW0)" opacity="${a.toFixed(3)}"/>`;
  return o + kineticType(t, lines, { y, at, out });
}

/** The engine source files whose hashes pin each builtin (until the engine publishes fingerprints, E1.3). */
export const IMPLEMENTATION = {
  rig: "film/src/rig.ts",
  sets: "film/src/sets.ts",
  props: "film/src/props.ts",
  templates: "film/src/templates.ts",
  type: "film/src/style.ts",
  compose: "film/src/compose.ts",
  w0world: "film/src/w0/world.ts",
  w0composer: "film/src/w0/composer.ts",
} as const;
