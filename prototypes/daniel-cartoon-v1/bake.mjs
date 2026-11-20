/**
 * Daniel, human cartoon v1: the concept construction drawn as package artwork (bake mode).
 *
 * The Character Builder (character/src/builder/build-daniel.ts) calls `bakeSources()`: for every view it gets the
 * tagged SVG at rest and at every key state (one per morph target), the way an artist would deliver a rest
 * drawing and its expression keys. Package units are millimetres: the camera draws 10 units per centimetre with
 * the origin on the floor between the feet, y down.
 */
import { add, camera, norm, pngOf, sub, svgDoc } from "./all.mjs";
import { POSE } from "./body.mjs";
import { drawHead, HPAL } from "./face.mjs";
import { figure, HEAD_POSE } from "./figure.mjs";
import { PAL } from "./palette.mjs";

export const S = 10; // package units per centimetre

/** Head views: the yaw each was drawn at. head_yaw is the head's yaw relative to the camera. */
export const HEAD_VIEWS = [-45, -30, -15, 0, 15, 30, 45];
/** Body views. */
export const BODY_VIEWS = [0, 35];
/** In-view turn and nod covered by morphs (degrees). */
export const YAW_SPAN = 7.5;
export const PITCH_SPAN = 10;

/** The expression keys: one per morph target, as the concept's expression parameters. */
export const FACE_KEYS = {
  au01: { browInner: 1 },
  au02: { browUp: 1 },
  au04: { browDown: 1 },
  au05: { lidUp: 1 },
  au06: { squint: 0.8 },
  au07: { squint: 0.5, lidDown: 0.35 },
  au10: { sneer: 1 },
  au12: { smile: 1 },
  au15: { frown: 1 },
  au23: { pucker: 1 },
  au24: { press: 1 },
  jaw: { jaw: 1 },
  blink_l: { L: { blink: 1 } },
  blink_r: { R: { blink: 1 } },
};

export const viewId = (prefix, yaw) => `${prefix}${yaw < 0 ? "n" : ""}${Math.abs(yaw)}`;

function headState(yaw, { expr = {}, turn = 0, nod = 0 } = {}) {
  const cam = camera({ yaw: 0, S, cx: 0, cy: 0 });
  const centerPose = { ...HEAD_POSE, turn: yaw };
  const pose = { ...HEAD_POSE, turn: yaw + turn, nod: HEAD_POSE.nod + nod };
  const suffix = `_${viewId("h", yaw)}`;
  const { svg, meta } = drawHead(cam, { pose, expr, gaze: [0, 0], bake: { suffix, centerPose } });
  return { svg: `<svg xmlns="http://www.w3.org/2000/svg">${svg}</svg>`, meta };
}

/** Everything the Builder needs, drawn from the construction. */
export function bakeSources() {
  const head = HEAD_VIEWS.map((yaw) => {
    const states = { rest: headState(yaw) };
    for (const [k, expr] of Object.entries(FACE_KEYS)) states[k] = headState(yaw, { expr });
    states.yaw_pos = headState(yaw, { turn: YAW_SPAN });
    states.yaw_neg = headState(yaw, { turn: -YAW_SPAN });
    states.pitch_pos = headState(yaw, { nod: PITCH_SPAN });
    states.pitch_neg = headState(yaw, { nod: -PITCH_SPAN });
    return { id: viewId("h", yaw), yaw, states };
  });
  const body = BODY_VIEWS.map((yaw) => {
    const cam = camera({ yaw, S, cx: 0, cy: 0 });
    const P = (p) => cam.P(p).slice(0, 2);
    const svg = figure({ yaw, S, cx: 0, floorY: 0, bake: { suffix: `_${viewId("b", yaw)}` } });
    const J = POSE.joints;
    const joints = {};
    for (const [k, v] of Object.entries(J)) joints[k] = P(v);
    // hand: from the wrist along the forearm's direction, a palm and fingers' length
    for (const s of ["R", "L"]) {
      const d = norm(sub(J[`wrist${s}`], J[`elbow${s}`]));
      joints[`handTip${s}`] = P(add(J[`wrist${s}`], [d[0] * 17, d[1] * 17, d[2] * 17]));
    }
    return { id: viewId("b", yaw), yaw, svg: `<svg xmlns="http://www.w3.org/2000/svg">${svg}</svg>`, joints };
  });
  const headJoint = camera({ yaw: 0, S, cx: 0, cy: 0 }).P([0, 161, 0]).slice(0, 2);
  return {
    units: "mm",
    head,
    body,
    torso: { pelvis: [0, -930], chest: [0, -1130], neck: [0, -1490], head: headJoint },
    palette: {
      skin: HPAL.skin,
      skinShadow: HPAL.skinShade,
      eyes: HPAL.iris,
      hair: HPAL.hair,
      iris: HPAL.iris,
      irisRing: HPAL.irisDark,
      pupil: HPAL.pupil,
      jacket: PAL.jacket,
    },
    eye: {
      // the eyeball (1.2 cm) and iris (0.66 cm) of face.mjs, times the head's scale, in package units
      travel: 1.2 * Math.cos(Math.asin(0.66 / 1.2)) * HEAD_POSE.scale * S,
      iris: 0.66 * HEAD_POSE.scale * S,
      pupil: 0.27 * HEAD_POSE.scale * S,
      highlight: { offset: [-0.2 * S, -0.2 * S], radius: 0.11 * S },
    },
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const t0 = Date.now();
  const src = bakeSources();
  const n = src.head.reduce((m, v) => m + Object.keys(v.states).length, 0);
  console.log(
    `${src.head.length} head views (${n} states), ${src.body.length} body views in ${Date.now() - t0} ms`,
  );
}

/**
 * The concept drawing (not bake mode) as PNG bytes, placed like a runtime frame: package origin at (x, y) pixels,
 * `k` pixels per package unit. For comparing the package's frames with the approved concept.
 */
export function conceptPng({
  width,
  height,
  x,
  y,
  k,
  yaw = 0,
  headYaw = yaw,
  nod = 0,
  expr = {},
  gaze = [0, 0],
  bg = "#EFEBE4",
}) {
  const head = { ...HEAD_POSE, turn: headYaw - yaw, nod: HEAD_POSE.nod + nod };
  const svg = figure({ yaw, S: S * k, cx: x, floorY: y, expr, gaze, head });
  return pngOf(svgDoc(width, height, svg, bg));
}

/** The concept head alone (no body), placed the same way. */
export function conceptHeadPng({
  width,
  height,
  x,
  y,
  k,
  headYaw = 0,
  nod = 0,
  expr = {},
  gaze = [0, 0],
  bg = "#EFEBE4",
}) {
  const cam = camera({ yaw: 0, S: S * k, cx: x, cy: y });
  const pose = { ...HEAD_POSE, turn: headYaw, nod: HEAD_POSE.nod + nod };
  return pngOf(svgDoc(width, height, drawHead(cam, { pose, expr, gaze }).svg, bg));
}
