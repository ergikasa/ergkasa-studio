/**
 * Character v4 rig prototype: walk and stop (body mechanics test). Not production code.
 *
 * The same character, full body, walks in from the right (the camera tracks him), slows down over his last
 * step, brings the back foot in, lets the weight settle (the hips overshoot and come back, the arms swing out),
 * then his eyes find the camera, his head follows and he smiles.
 *
 * Mechanics: the walk phase is the distance travelled divided by the stride, so slowing down slows the legs;
 * each foot is planted (fixed on the floor) for 60 % of its cycle and swings on an arc for the rest; the legs
 * reach their feet with IK (knees forward); the hips bob twice per cycle; the shoulders counter-rotate; the arms
 * swing against the legs and keep swinging, damped, after the stop.
 */
import { smooth, f, lerp, clamp } from "../lib.mjs";
import { ik2, limb, handSvg, torsoSvg, sleeveSvg, neckSvg, C } from "./body.mjs";
import { EMOTIONS } from "./face.mjs";
import { projector } from "../model.mjs";
import { VIEW0 } from "./proxy.mjs";

export const W = 1080,
  H = 1920;
export const FPS = 30;
export const DURATION = 5.6;
const K = 0.5; // head: portrait px → figure units (as in the medium shot)
const SCALE = 0.44; // figure units → screen px
const FLOOR = 1830; // screen y of the floor under him
const STEP = 1260; // figure units (0.7 m)
const VMAX = 2250; // figure units / s (1.25 m/s)
const T_DECEL = 1.6,
  T_STOP = 2.4;
const PHI0 = 0.264;

const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

function distance(t) {
  if (t <= T_DECEL) return VMAX * t;
  if (t <= T_STOP) {
    const u = t - T_DECEL,
      D = T_STOP - T_DECEL;
    return VMAX * T_DECEL + VMAX * (u - (u * u) / (2 * D));
  }
  return VMAX * T_DECEL + (VMAX * (T_STOP - T_DECEL)) / 2;
}

/** Foot position (figure units, x along the floor, y up from the floor) and pitch (degrees, toe up positive). */
function foot(k, phase, X0) {
  const off = k === 0 ? 0 : 0.5;
  const p = phase + PHI0 + off;
  const c = Math.floor(p),
    u = p - c;
  const plant = (cc) => X0 - (cc - PHI0 - off + 0.3) * 2 * STEP;
  if (u < 0.6) {
    const s = u / 0.6;
    // heel strike toes-up, flat in mid stance, heel lifting toward toe-off
    const pitch = s < 0.15 ? 14 * (1 - s / 0.15) : s > 0.7 ? -28 * ((s - 0.7) / 0.3) : 0;
    return { x: plant(c), y: 0, pitch, swing: 0 };
  }
  const s = (u - 0.6) / 0.4;
  const e = ease(s);
  return {
    x: lerp(plant(c), plant(c + 1), e),
    y: Math.sin(Math.PI * s) * 150,
    pitch: lerp(-28, 14, s),
    swing: 1,
  };
}

export function simulate() {
  const N = Math.round(DURATION * FPS);
  const dt = 1 / FPS;
  const states = [];
  const X0 = 2600; // where he starts (figure units, world)
  let camX = X0 - 900,
    settle = 0,
    settleV = 0,
    swingA = 0,
    swingV = 0,
    hy = 30,
    hyv = 0;
  for (let n = -30; n < N; n++) {
    const t = Math.max(0, n * dt);
    const d = distance(t);
    const phase = d / (2 * STEP);
    const hipX = X0 - d;
    let f0 = foot(0, phase, X0),
      f1 = foot(1, phase, X0);
    // the stopping step: the back foot comes in beside the front one, then both stay planted
    if (t > T_STOP) {
      const front = f0.x < f1.x ? f0 : f1;
      const backIsF1 = front === f0;
      const back = backIsF1 ? f1 : f0;
      const u = ease((t - T_STOP) / 0.45);
      const tx = front.x + STEP * 0.32;
      const moved = {
        x: lerp(back.x, tx, u),
        y: Math.sin(Math.PI * clamp((t - T_STOP) / 0.45, 0, 1)) * 90,
        pitch: lerp(back.pitch, 0, u),
        swing: u < 1 ? 1 : 0,
      };
      const fr = { ...front, pitch: lerp(front.pitch, 0, ease((t - T_STOP) / 0.2)) };
      if (backIsF1) {
        f1 = moved;
        f0 = fr;
      } else {
        f0 = moved;
        f1 = fr;
      }
    }
    // hips: bob while walking; after the stop they settle between the feet with an overshoot
    const walking = clamp((T_STOP - t) / 0.6, 0, 1);
    const bob = -Math.cos(phase * 4 * Math.PI) * 26 * walking;
    const targetSettle = t > T_STOP ? 1 : 0;
    const a = 22 * 22 * (targetSettle - settle) - 2 * 0.55 * 22 * settleV;
    settleV += a * dt;
    settle += settleV * dt;
    const midFeet = (f0.x + f1.x) / 2;
    const hx = t > T_STOP ? lerp(hipX, midFeet + 40, clamp(settle, -0.2, 1.3)) : hipX;
    const hipY = -1712 + 30 * walking + bob + (t > T_STOP ? (1 - settle) * 22 : 0);
    // arms swing against the legs, then swing out and damp after the stop
    const target = t < T_STOP ? -0.32 * Math.sin(phase * 2 * Math.PI + Math.PI * 0.1) * walking : 0;
    const aa = 9 * 9 * (target - swingA) - 2 * 0.25 * 9 * swingV;
    swingV += aa * dt;
    swingA += swingV * dt;
    // camera follows his hips with a small lag
    camX = lerp(camX, hx, 0.12);
    // the head: eyes ahead while walking, then the camera
    const toCam = t > 3.6;
    const yawT = toCam ? 16 : 30;
    const ac = 7 * 7 * (yawT - hy) - 2 * 0.8 * 7 * hyv;
    if (!(t > 3.6 && t < 3.72)) {
      hyv += ac * dt;
      hy += hyv * dt;
    }
    const joy = ease((t - 4.0) / 0.6) * 0.55;
    let lid = 0;
    for (const b of [0.9, 3.62, 5.1]) {
      const u = (t - b) / 0.3;
      if (u >= 0 && u <= 1)
        lid = Math.max(lid, u < 0.3 ? ease(u / 0.3) : u < 0.4 ? 1 : 1 - ease((u - 0.4) / 0.6));
    }
    const aus = {};
    for (const [k, v] of Object.entries(EMOTIONS.joy.aus)) aus[k] = v * joy;
    if (n < 0) continue;
    states.push({
      t,
      hip: [hx, hipY],
      feet: [f0, f1],
      swing: swingA,
      walking,
      camX,
      phase,
      head: {
        yaw: hy,
        pitch: 3 - bob * 0.02,
        roll: -1.5 + Math.sin(phase * 2 * Math.PI) * 1.2 * walking,
        aus,
        lids: { n: lid, f: lid },
      },
      look: toCam ? [0, 6, 80] : [-60, 2, 40],
    });
  }
  return states;
}

// ------------------------------------------------------------------------------------------------ draw

function boot(ankle, pitch, near) {
  // a chukka seen from the front-left three-quarters: toe toward the walk (left), sole on the floor
  const r = (pitch * Math.PI) / 180;
  const R = ([x, y]) => [
    ankle[0] + x * Math.cos(r) + y * Math.sin(r),
    ankle[1] - x * Math.sin(r) + y * Math.cos(r),
  ];
  const pts = [
    [70, -170],
    [-60, -168],
    [-120, -60],
    [-250, 10],
    [-310, 70],
    [-300, 150],
    [-200, 164],
    [40, 160],
    [100, 150],
    [104, 40],
  ].map(R);
  const sole = [
    [-320, 120],
    [104, 112],
    [104, 168],
    [-300, 172],
  ].map(R);
  return [
    `<path d="${smooth(pts, true, 0.12)}" fill="${near ? "#6E4329" : "#5A3520"}"/>`,
    `<path d="${smooth(pts.slice(1, 5), false)}" fill="none" stroke="#9A653F" stroke-width="22" opacity="${near ? 0.7 : 0.4}" stroke-linecap="round" filter="url(#b10)"/>`,
    `<path d="${smooth(sole, true, 0.05)}" fill="#2B201A"/>`,
    `<path d="${smooth(pts, true, 0.12)}" fill="none" stroke="#1A0F09" stroke-width="5" opacity=".75"/>`,
  ].join("");
}

function leg(hip, ft, near) {
  const ankle = [ft.x, -162 - ft.y];
  const ik = ik2(hip, ankle, 810, 774, [-1, 0.15]);
  const L = limb([hip, ik.elbow, ik.wrist], [150, 122, 96], [158, 126, 98], 18);
  const col = near ? "#3A3C42" : "#2C2E33";
  const out = [];
  out.push(`<path d="${smooth(L.ring, true, 0.1)}" fill="${col}"/>`);
  out.push(
    `<path d="${smooth(L.left, false)}" fill="none" stroke="#5A5D66" stroke-width="60" opacity="${near ? 0.45 : 0.25}" filter="url(#b16)"/>`,
  );
  out.push(
    `<path d="${smooth(L.right, false)}" fill="none" stroke="#141519" stroke-width="70" opacity=".55" filter="url(#b16)"/>`,
  );
  // the knee folds when it bends
  const bend = Math.abs(
    Math.atan2(ik.elbow[0] - hip[0], ik.elbow[1] - hip[1]) -
      Math.atan2(ik.wrist[0] - ik.elbow[0], ik.wrist[1] - ik.elbow[1]),
  );
  if (bend > 0.15)
    for (const o of [-30, 10]) {
      const k = ik.elbow;
      out.push(
        `<path d="M${f(k[0] + 40)} ${f(k[1] + o)} q-50 ${f(10 + bend * 20)} -110 0" fill="none" stroke="#141519" stroke-width="12" opacity="${f(Math.min(0.6, bend))}" filter="url(#b4)"/>`,
      );
    }
  out.push(
    `<path d="${smooth(L.ring, true, 0.1)}" fill="none" stroke="${C.line}" stroke-width="5" opacity=".7"/>`,
  );
  return { svg: out.join("") + boot(ankle, ft.pitch, near), knee: ik.elbow, ankle };
}

/** One frame of the walk. */
export function frameSvg(s, head, cache = {}, pad = 0) {
  const defs = [];
  const parts = [];
  const sx = (x) => 540 + (x - s.camX) * SCALE;
  // set: a wall, a polished floor with seams that slide past as the camera tracks him
  parts.push(
    `<rect x="-200" y="-200" width="1480" height="2320" fill="#283338"/>`,
    `<rect x="-200" y="-200" width="1480" height="${FLOOR - 120 + 200}" fill="url(#wwall)"/>`,
    `<rect x="-200" y="${FLOOR - 120}" width="1480" height="900" fill="url(#wfloor)"/>`,
  );
  defs.push(
    `<linearGradient id="wwall" x1="0" y1="0" x2="0" y2="${FLOOR}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#1A2226"/><stop offset="1" stop-color="#3A474B"/></linearGradient>`,
    `<linearGradient id="wfloor" x1="0" y1="${FLOOR - 120}" x2="0" y2="2120" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#2E3A3F"/><stop offset="1" stop-color="#151B1E"/></linearGradient>`,
  );
  let seams = "";
  for (let k = -6; k < 30; k++) {
    const wx = k * 900;
    const x = sx(wx);
    if (x < -300 || x > 1400) continue;
    seams += `M${f(x)} ${FLOOR - 120} L${f(x - 260)} 2120 `;
  }
  parts.push(`<path d="${seams}" stroke="#4A585E" stroke-width="3" opacity=".5"/>`);
  parts.push(
    `<path d="M-200 ${FLOOR - 120} L1280 ${FLOOR - 120}" stroke="#56666C" stroke-width="3" opacity=".5"/>`,
  );
  // the figure, in figure units: floor at y = 0, y up is negative
  const g = [];
  const hip = s.hip;
  const lean = 0.06 * s.walking;
  const chest = [hip[0] - 110 * lean * 10 - 10, hip[1] - 720];
  const nb = [chest[0] - 20, chest[1] - 330];
  const twist = Math.sin(s.phase * 2 * Math.PI) * 26 * s.walking;
  const sf = [nb[0] - 250 + twist, nb[1] + 80];
  const sn = [nb[0] + 300 - twist, nb[1] + 70];
  const hipF = [hip[0] - 60, hip[1] + 10],
    hipN = [hip[0] + 90, hip[1] + 24];
  // floor contact shadows
  for (const ft of s.feet)
    g.push(
      `<ellipse cx="${f(ft.x - 90)}" cy="12" rx="${f(220 - ft.y * 0.6)}" ry="34" fill="#050607" opacity="${f(0.6 - ft.y / 400)}" filter="url(#b16)"/>`,
    );
  // far arm, far leg, near leg (the near leg is the front one in this view)
  const armAt = (j, a, near) => {
    const elbow = [j[0] + Math.sin(a) * 440, j[1] + Math.cos(a) * 440];
    const wrist = [elbow[0] + Math.sin(a * 1.4 - 0.22) * 360, elbow[1] + Math.cos(a * 1.4 - 0.22) * 360];
    return sleeveSvg(near ? "wsN" : "wsF", { shoulder: j, elbow, wrist, near, light: near ? 0.35 : 0.7 });
  };
  const jf = [sf[0] - 18, sf[1] + 62],
    jn = [sn[0] + 36, sn[1] + 62];
  const af = armAt(jf, s.swing, false);
  defs.push(af.defs);
  g.push(af.svg);
  const legF = leg(hipF, s.feet[1], false),
    legN = leg(hipN, s.feet[0], true);
  g.push(legF.svg, legN.svg);
  // neck, torso (the jacket hem covers the tops of the legs), head
  const hd = head.draw({ ...s.head, look: s.look });
  defs.push(hd.defs);
  const neckTop = [nb[0] + 22, nb[1] - 160];
  const T = [neckTop[0] - K * hd.info.pivot[0], neckTop[1] - K * hd.info.pivot[1]];
  const nk = neckSvg({ nb, top: neckTop, beardBottom: [] });
  defs.push(nk.defs);
  g.push(nk.svg);
  const ts = torsoSvg({ nb, sf, sn, w: [hip[0], hip[1] - 120] });
  defs.push(ts.defs);
  g.push(ts.svg);
  g.push(`<g transform="translate(${f(T[0])} ${f(T[1])}) scale(${K})">${hd.svg}</g>`);
  const an = armAt(jn, -s.swing, true);
  defs.push(an.defs);
  g.push(an.svg);
  // hands: relaxed, following the forearms
  const handAt = (j, a, id, mirror) => {
    const elbow = [j[0] + Math.sin(a) * 440, j[1] + Math.cos(a) * 440];
    const ang = a * 1.4 - 0.22;
    const wrist = [elbow[0] + Math.sin(ang) * 360, elbow[1] + Math.cos(ang) * 360];
    return handSvg(id, {
      at: wrist,
      angle: Math.PI / 2 - ang,
      scale: 1.5,
      fy: 1,
      pose: { curl: 1 },
      lit: mirror ? 0.8 : 0.45,
      mirror,
    });
  };
  const hf = handAt(jf, s.swing, "whF", true),
    hn = handAt(jn, -s.swing, "whN", false);
  defs.push(hf.defs, hn.defs);
  g.splice(1, 0, hf.svg);
  g.push(hn.svg);
  parts.push(
    `<g transform="translate(${f(sx(0))} ${FLOOR}) scale(${SCALE}) translate(${f(-0)} 0)"><g transform="translate(${f(-0)} 0)">${g.join("")}</g></g>`,
  );
  void cache;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W + 2 * pad}" height="${H + 2 * pad}" viewBox="${-pad} ${-pad} ${W + 2 * pad} ${H + 2 * pad}"><defs>${defs.join("")}</defs>${parts.join("")}</svg>`;
}

void projector;
void VIEW0;
