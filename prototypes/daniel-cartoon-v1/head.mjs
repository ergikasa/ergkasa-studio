/**
 * Daniel, human cartoon v1 (concept prototype): the head.
 *
 * The head mass (skull, cheeks, jaw and the volume of the short beard) is one tube of horizontal sections, so its
 * outline in any view comes from the same form: the brow, the cheekbone and the jaw show on the far side of the
 * face in 3/4 without being drawn per view. The features (eyes, brows, nose, mouth, ears, hair) are curves through
 * 3D landmarks and move with expression parameters, which is also how a rig would drive them.
 *
 * Local head space (cm): origin between the pupils, x toward his left, y up, z forward.
 */
import { add, clamp, lerp, lerp3, mul, rad, rotate, smoothstep } from "./lib.mjs";
import { sectionRadius, table } from "./body.mjs";
import { tube } from "./tube.mjs";

// Head mass sections: [y, half-width, front depth, back depth, centre z].
const HEAD = [
  [-11.95, 0.3, 0.4, 0.3, 6.5],
  [-11.65, 1.6, 1.8, 1.4, 6.3],
  [-11.0, 3.1, 3.0, 2.3, 6.0],
  [-10.4, 3.9, 4.0, 2.9, 5.5],
  [-9.0, 5.15, 5.0, 3.7, 4.7],
  [-7.6, 6.15, 6.1, 4.3, 3.7],
  [-6.6, 6.4, 7.4, 5.4, 2.5],
  [-5.0, 6.6, 9.1, 6.6, 0.9],
  [-3.2, 6.9, 9.4, 8.2, 0.2],
  [-1.4, 7.1, 9.1, 9.2, 0],
  [0.0, 7.15, 8.8, 9.7, 0],
  [1.2, 7.15, 9.45, 10.0, 0],
  [2.4, 7.15, 9.3, 10.2, 0],
  [4.2, 7.1, 8.9, 10.3, 0],
  [6.6, 6.8, 8.0, 9.9, -0.2],
  [8.8, 6.0, 6.5, 8.9, -0.5],
  [10.4, 4.6, 4.6, 7.0, -0.7],
  [11.5, 2.9, 2.7, 4.4, -0.8],
  [12.1, 1.0, 1.0, 1.3, -0.8],
  [12.2, 0.3, 0.3, 0.3, -0.8],
];

const deg = (th) => (th * 180) / Math.PI;

/** The line where the beard starts on the cheek, as a height for an angle around the head (degrees, 0 = front). */
function cheekLine(a) {
  const A = Math.abs(a);
  return table(
    [
      [0, -8.05],
      [16, -8.05],
      [24, -6.7],
      [34, -5.7],
      [50, -5.5],
      [70, -4.5],
      [84, -1.4],
      [92, 0.3],
      [99, 0.6],
      [102, -7.8],
      [180, -7.8],
    ],
    A,
  )[0];
}

/** Extra radius of the head surface: brow ridge, cheekbone, beard. */
function relief(y, th, beard = 0.5) {
  const a = deg(th);
  const A = Math.abs(((a + 180) % 360) - 180);
  let r = 0;
  const bump = (cy, sy, ca, sa) => Math.exp(-(((y - cy) / sy) ** 2) - ((A - ca) / sa) ** 2);
  r += 0.35 * smoothstep(0, 1, 1 - Math.abs(y - 1.5) / 1.0) * smoothstep(0, 1, 1 - A / 45); // brow ridge
  r += 0.12 * bump(1.3, 0.8, 50, 9); // the brow's outer corner
  r -= 0.04 * bump(-0.3, 0.7, 52, 9); // the side of the eye socket
  r += 0.5 * bump(-1.9, 1.1, 57, 13); // cheekbone
  r -= 0.25 * bump(3.0, 1.4, 68, 10); // temple
  // the beard's volume (short, trimmed): thicker on the chin
  const line = cheekLine(A);
  const inBeard = smoothstep(line + 0.4, line - 0.3, y) * smoothstep(-13.5, -12.0, y);
  const chin = 1 + 0.6 * smoothstep(-8, -11, y) * smoothstep(40, 0, A);
  r += beard * inBeard * chin;
  return r;
}

export function headMass({ beard = 0.2 } = {}) {
  const y0 = HEAD[0][0],
    y1 = HEAD[HEAD.length - 1][0];
  const path = HEAD.map((r) => [0, r[0], r[4]]);
  return tube({
    path,
    rings: 70,
    around: 72,
    axis: [0, 1, 0],
    section: (s, th, c) => {
      const y = c[1];
      const [w, f, b] = table(HEAD, y);
      return sectionRadius(th, w, f, b, 2.55) + relief(y, th, beard);
    },
  });
}

// ------------------------------------------------------------------------------------------------ landmarks
/** One side (his left, x > 0); the other side mirrors it with the asymmetry below. */
const SIDE = {
  eyeC: [3.15, 0.0, 7.0],
  enCanthus: [1.6, -0.1, 7.85],
  exCanthus: [4.7, 0.3, 6.25],
  lidUpIn: [2.0, 0.42, 8.15],
  lidUpPeak: [2.95, 0.68, 8.3],
  lidUpOut: [4.0, 0.55, 7.7],
  lidLowIn: [2.2, -0.34, 8.0],
  lidLowLow: [3.2, -0.5, 8.05],
  lidLowOut: [4.2, -0.18, 7.35],
  creaseIn: [2.0, 0.95, 8.25],
  creasePeak: [3.1, 1.08, 8.2],
  creaseOut: [4.45, 0.8, 7.2],
  browIn: [1.25, 1.42, 9.35],
  browMid: [2.6, 1.86, 9.1],
  browPeak: [3.7, 1.98, 8.55],
  browTail: [5.2, 1.5, 6.9],
  alare: [1.75, -4.25, 9.4],
  alarTop: [1.4, -3.45, 9.65],
  subalare: [1.2, -4.85, 9.35],
  nostril: [0.7, -4.85, 10.3],
  noseSide: [0.95, -1.9, 9.75],
  cheilion: [2.55, -6.75, 8.6],
  upperLip: [1.35, -6.25, 9.75],
  lowerLip: [1.3, -7.55, 9.55],
  nasolabial: [2.6, -4.6, 9.2],
  tragus: [7.15, -1.4, 0.2],
  earTop: [8.0, 2.0, -1.0],
  earBack: [8.85, -0.2, -2.7],
  earLobe: [7.45, -3.9, -0.5],
  jawAngle: [6.0, -7.4, 1.6],
  jawMid: [4.6, -9.6, 5.0],
  chinSide: [2.1, -10.8, 8.0],
};

const MID = {
  vertex: [0, 12.1, -0.8],
  trichion: [0, 7.3, 8.15],
  glabella: [0, 1.6, 9.75],
  nasion: [0, 0.6, 9.15],
  rhinion: [0, -1.4, 10.15],
  supratip: [0, -3.3, 11.05],
  tip: [0, -4.0, 11.5],
  tipLow: [0, -4.55, 11.15],
  subnasale: [0, -5.1, 9.8],
  labSup: [0, -6.1, 10.05],
  stomion: [0, -6.75, 9.75],
  labInf: [0, -7.55, 9.8],
  sulcus: [0, -8.5, 9.35],
  pogonion: [0, -10.2, 9.75],
  menton: [0, -11.5, 7.9],
};

/** Daniel's own asymmetry: his left brow sits higher, his right mouth corner lifts a little more. */
const ASYM_L = { browPeak: [0, 0.18, 0], browTail: [0, 0.12, 0], browMid: [0, 0.1, 0] };
const ASYM_R = { cheilion: [0, 0.08, 0] };

/**
 * Expression parameters (all 0 at rest):
 * browUp (AU1+2), browInner (AU1, worry), browDown (AU4), lidUp (AU5 wider), lidDown (droop), squint (AU6/7),
 * smile (AU12), frown (AU15), jaw (AU26), press (AU24), sneer (AU9/10), and per-side `L`/`R` overrides.
 */
const EYE_KEYS = /^(lid|enCanthus|exCanthus|crease)/;
export function landmarks(expr = {}) {
  const L = {};
  for (const [k, v] of Object.entries(MID)) L[k] = v.slice();
  for (const [k, v0] of Object.entries(SIDE)) {
    // a slightly larger eye opening than the anthropometric average: the face reads at phone size
    const c = SIDE.eyeC;
    const v = EYE_KEYS.test(k) ? [c[0] + (v0[0] - c[0]) * 1.1, c[1] + (v0[1] - c[1]) * 1.2, v0[2]] : v0;
    L[`l.${k}`] = add(v, ASYM_L[k] ?? [0, 0, 0]);
    L[`r.${k}`] = add([-v[0], v[1], v[2]], ASYM_R[k] ?? [0, 0, 0]);
  }
  const e = (k, side) => (expr[side]?.[k] ?? 0) + (expr[k] ?? 0);
  const mv = (k, d) => {
    L[k] = add(L[k], d);
  };
  for (const s of ["l", "r"]) {
    const sx = s === "l" ? 1 : -1;
    const side = s === "l" ? "L" : "R";
    const browUp = e("browUp", side),
      browInner = e("browInner", side),
      browDown = e("browDown", side);
    // brows: big enough to read at phone size, within what a face can do
    mv(`${s}.browIn`, [
      -sx * 0.45 * browDown,
      0.9 * browUp + 1.0 * browInner - 0.8 * browDown,
      0.1 * browDown,
    ]);
    mv(`${s}.browMid`, [-sx * 0.25 * browDown, 1.0 * browUp + 0.55 * browInner - 0.55 * browDown, 0]);
    mv(`${s}.browPeak`, [0, 0.9 * browUp + 0.1 * browInner - 0.3 * browDown, 0]);
    mv(`${s}.browTail`, [0, 0.5 * browUp - 0.25 * browInner - 0.05 * browDown, 0]);
    // lids
    const squint = e("squint", side) + 0.45 * e("smile", side);
    const lidUp = e("lidUp", side) - e("lidDown", side) - 0.3 * squint - 0.2 * browDown;
    for (const k of ["lidUpIn", "lidUpPeak", "lidUpOut"])
      mv(`${s}.${k}`, [0, (k === "lidUpPeak" ? 0.5 : 0.38) * lidUp, 0]);
    for (const k of ["creaseIn", "creasePeak", "creaseOut"])
      mv(`${s}.${k}`, [0, 0.3 * lidUp + 0.2 * browUp, 0]);
    for (const k of ["lidLowIn", "lidLowLow", "lidLowOut"])
      mv(`${s}.${k}`, [0, (k === "lidLowLow" ? 0.42 : 0.3) * squint, 0]);
    // mouth corners
    const smile = e("smile", side),
      frown = e("frown", side),
      press = e("press", side);
    mv(`${s}.cheilion`, [sx * (0.6 * smile - 0.15 * press), 1.05 * smile - 0.85 * frown, -0.45 * smile]);
    mv(`${s}.upperLip`, [sx * 0.3 * smile, 0.3 * smile + 0.35 * e("sneer", side) - 0.1 * press, 0]);
    mv(`${s}.lowerLip`, [sx * 0.3 * smile, 0.25 * smile - 0.3 * frown + 0.15 * press, 0]);
    mv(`${s}.nasolabial`, [sx * 0.3 * smile, 0.35 * smile, 0.15 * smile]);
    mv(`${s}.alare`, [sx * 0.08 * smile, 0.12 * smile + 0.25 * e("sneer", side), 0]);
  }
  const jaw = expr.jaw ?? 0;
  // the jaw drops the lower lip, the chin and the jaw line together
  for (const k of [
    "stomion",
    "labInf",
    "l.lowerLip",
    "r.lowerLip",
    "sulcus",
    "pogonion",
    "menton",
    "l.jawMid",
    "r.jawMid",
    "l.chinSide",
    "r.chinSide",
  ]) {
    const w = k === "stomion" ? 0.5 : k.endsWith("jawMid") ? 0.8 : 1;
    if (L[k]) mv(k, [0, -1.5 * jaw * w, -0.3 * jaw * w]);
  }
  mv("l.cheilion", [0, -0.45 * jaw, 0]);
  mv("r.cheilion", [0, -0.45 * jaw, 0]);
  mv("labSup", [0, 0.15 * (expr.sneer ?? 0), 0]);
  return L;
}

/** Jaw opening also lowers the chin: the head mass below the mouth follows it. */
export const jawDrop = (expr) => 1.5 * (expr.jaw ?? 0);

// ------------------------------------------------------------------------------------------------ head pose
/**
 * The head in the world: placed on the neck, with its own turn, nod and tilt on top of the body's view.
 * Returns a function from local head space to world space.
 */
export function headToWorld({ at = [0, 169.2, 0.6], turn = 0, nod = 0, tilt = 0, scale = 1 } = {}) {
  return (p) => {
    let q = rotate(mul(p, scale), [0, 0, 1], tilt);
    q = rotate(q, [1, 0, 0], nod);
    q = rotate(q, [0, 1, 0], turn);
    return add(q, at);
  };
}

/** A head tube moved into the world. */
export function placeTube(T, toWorld) {
  return {
    ...T,
    rings: T.rings.map((r) => ({
      c: toWorld(r.c),
      a: r.a,
      pts: r.pts.map(toWorld),
      local: r.local,
      lpts: r.pts,
      s: r.s,
      n: r.n.map((n) => sub0(toWorld(n), toWorld([0, 0, 0]))),
    })),
  };
}
const sub0 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

export { clamp, lerp, lerp3, mul, rad };
