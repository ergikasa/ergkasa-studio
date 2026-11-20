/**
 * Character v3 prototype: the performance layer (eyes, face, body over time). Not production code.
 *
 *   gaze      every eye movement has a target in the scene; saccades (4 frames, the head follows 6 frames later
 *             when the turn is large), smooth pursuit of a moving target, blinks (rate by emotion, and one at the
 *             start of a large saccade), gaze aversion, and anticipation (the eyes move before the head and hand)
 *   face      expressions are blends of action units, with transitions of 0.5 s or more
 *   body      keyframed joints with successive breaking: the upper arm leads, the forearm follows 2 frames later,
 *             the wrist 4 frames later, the fingers 5 frames later (overlapping action, no robot moves)
 *
 * Nothing is random: blinks and holds come from the timeline, not from noise.
 */
import { EXPRESSIONS, FACE_REST } from "./head.mjs";
import { POSE_REST } from "./body.mjs";

export const FPS = 30;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
const easeOut = (k) => 1 - Math.pow(1 - k, 3);

/** A keyed number track: [[t, v], ...], eased between keys. */
export function track(keys, t, fn = ease) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [t1, v1] = keys[i];
    const [t0, v0] = keys[i - 1];
    if (t <= t1) return v0 + (v1 - v0) * fn(clamp((t - t0) / (t1 - t0 || 1), 0, 1));
  }
  return keys[keys.length - 1][1];
}

/** Expression blend over time: [[t, name]] → controls, crossfading from the previous expression over `dur`. */
export function expressionAt(script, t, dur = 0.6) {
  const idx = script.filter(([ts]) => t >= ts).length - 1;
  const preset = (i) => ({ ...FACE_REST, ...EXPRESSIONS[script[Math.max(0, i)][1]] });
  if (idx <= 0) return preset(0);
  return blendTo(preset(idx - 1), preset(idx), ease(clamp((t - script[idx][0]) / dur, 0, 1)));
}
function blendTo(a, b, k) {
  const o = {};
  for (const key of Object.keys({ ...a, ...b })) o[key] = (a[key] ?? 0) + ((b[key] ?? 0) - (a[key] ?? 0)) * k;
  return o;
}

/**
 * The gaze. `targets(t)` returns the current target point (world) and whether it is a new target (a saccade);
 * the eye position is `eye` (world). Returns iris offsets (gx, gy), head follow (nod, tilt) and blink requests.
 */
export function gazeSolver(timeline, eyeWorld) {
  // timeline: [[t, targetId]], points: { id: (t) => [x, y] }
  return (t, points) => {
    let i = 0;
    for (let k = 0; k < timeline.length; k++) if (t >= timeline[k][0]) i = k;
    const [t0, id] = timeline[i];
    const prevId = i > 0 ? timeline[i - 1][1] : id;
    const dirTo = (pid, tt) => {
      const p = points[pid](tt);
      const dx = p[0] - eyeWorld[0],
        dy = p[1] - eyeWorld[1];
      return [Math.atan2(dy, Math.max(80, Math.abs(dx))) * (180 / Math.PI), dx];
    };
    // saccade: 4 frames from the previous target to this one (ease-out), then fixation or pursuit
    const k = clamp((t - t0) / (4 / FPS), 0, 1);
    const lag = 2 / FPS; // pursuit lags two frames behind a moving target
    const [aPrev, dxPrev] = dirTo(prevId, t0);
    const [aCur, dxCur] = dirTo(id, Math.max(t0, t - lag));
    const ang = aPrev + (aCur - aPrev) * easeOut(k);
    const dx = dxPrev + (dxCur - dxPrev) * easeOut(k);
    // the head takes over part of a large vertical turn, 6 frames after the eyes, over 0.4 s
    const hk = clamp((t - t0 - 6 / FPS) / 0.4, 0, 1);
    const headShare = clamp((Math.abs(aCur) - 12) / 40, 0, 0.7);
    const headAng =
      aPrev * clamp((Math.abs(aPrev) - 12) / 40, 0, 0.7) * (1 - ease(hk)) + aCur * headShare * ease(hk);
    const eyeAng = ang - headAng;
    return {
      gx: clamp(dx / 300, -1, 1),
      gy: clamp(eyeAng / 28, -1, 1),
      nod: clamp(headAng / 22, -1, 1),
      saccadeAt: t0,
      saccadeSize: Math.abs(aCur - aPrev),
    };
  };
}

/** Blinks: a list of blink start times; plus one at every large saccade. 5 frames: close fast, open slower. */
export function blinkAt(times, t) {
  for (const b of times) {
    const u = (t - b) * FPS;
    if (u >= 0 && u < 2) return u / 2;
    if (u >= 2 && u < 6) return 1 - (u - 2) / 4;
  }
  return 0;
}

/**
 * Joints keyed in time with successive breaking: each joint of the chain follows the one before it by `delay`
 * frames, so a gesture travels down the arm instead of every joint moving at once.
 */
export function armAt(keys, t, delays = { arm: 0, fore: 2, wrist: 4, hand: 5 }) {
  const at = (ch) =>
    track(
      keys.map(([tk, pose]) => [tk + delays[ch] / FPS, pose[ch]]),
      t,
    );
  const handKeys = keys.map(([tk, pose]) => [tk + delays.hand / FPS, pose.handN]);
  // hand pose: blend between the two keyed poses around t
  let from = handKeys[0][1],
    to = from,
    k = 0;
  for (let i = 1; i < handKeys.length; i++) {
    const [t0, p0] = handKeys[i - 1];
    const [t1, p1] = handKeys[i];
    if (t >= t0 && t <= t1) {
      from = p0;
      to = p1;
      k = ease((t - t0) / (t1 - t0));
    } else if (t > t1) {
      from = to = p1;
      k = 1;
    }
  }
  return { arm: at("arm"), fore: at("fore"), wrist: at("wrist"), handNBlend: { from, to, k } };
}

export { POSE_REST };
