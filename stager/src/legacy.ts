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
export { K, fmt } from "../../film/src/motion.js";
export { FPS, W, H, PALETTE, kineticType, fontFiles, type TypeLine } from "../../film/src/style.js";
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
