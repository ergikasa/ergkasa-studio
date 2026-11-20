/**
 * Character v4 prototype: the head as a 3D landmark model (centimetres, adult male anthropometry).
 *
 * Every shape in the drawing is a curve through projected landmarks, so proportions come from measured human
 * averages rather than from eyeballed circles, and the same drawing can later be re-projected for a head turn.
 *
 * Axes: x toward the subject's left (the viewer's right when he faces us), y up, z toward the viewer.
 * Origin: the middle of the skull at the height of the pupils.
 */
import { rad } from "./lib.mjs";

/** One side of the face (the subject's left, x > 0). The other side is mirrored, with the asymmetry below. */
const SIDE = {
  // eye (palpebral fissure 3.1 cm, positive canthal tilt)
  eyeC: [3.15, 0.0, 7.0], // eyeball centre, radius 1.2
  pupil: [3.15, 0.0, 8.25],
  enCanthus: [1.62, -0.12, 7.75],
  exCanthus: [4.62, 0.22, 6.15],
  lidUpPeak: [2.9, 0.46, 8.25],
  lidUpIn: [2.0, 0.3, 8.05],
  lidUpOut: [3.95, 0.4, 7.65],
  lidLowLow: [3.3, -0.4, 8.05],
  lidLowIn: [2.2, -0.3, 7.95],
  lidLowOut: [4.15, -0.15, 7.35],
  creaseIn: [1.95, 0.72, 8.0],
  creasePeak: [3.05, 0.9, 8.15],
  creaseOut: [4.5, 0.6, 7.0],
  bagIn: [2.3, -0.95, 8.25],
  bagLow: [3.4, -1.25, 8.2],
  bagOut: [4.55, -0.85, 7.1],
  // brow
  browIn: [1.35, 1.32, 9.1],
  browInTop: [1.45, 1.78, 9.05],
  browPeak: [3.55, 1.88, 8.6],
  browTail: [5.15, 1.4, 6.85],
  browRidge: [2.6, 1.6, 9.1],
  // skull and forehead
  temple: [6.35, 3.0, 4.6],
  forehead: [3.4, 4.8, 8.3],
  orbitRim: [5.35, 0.75, 6.35],
  // hairline
  hairTempleCorner: [4.9, 6.4, 6.9],
  hairSide: [6.85, 3.6, 3.1],
  sideburnTop: [7.05, 1.2, 1.9],
  sideburnLow: [7.1, -1.4, 1.6],
  // cheek and jaw
  zygion: [6.95, -0.9, 3.4],
  malar: [4.65, -2.05, 7.45],
  malarLow: [5.3, -3.3, 6.7],
  cheekHollow: [5.2, -5.2, 6.15],
  jawAngle: [5.65, -7.4, 0.9],
  jawMid: [4.75, -9.3, 4.4],
  jawFront: [2.9, -10.85, 7.1],
  chinSide: [1.7, -10.5, 8.75],
  // nose
  alare: [1.78, -4.35, 9.35],
  alarTop: [1.45, -3.5, 9.55],
  subalare: [1.25, -4.95, 9.25],
  nostril: [0.72, -4.92, 10.25],
  noseSide: [0.95, -2.2, 9.55],
  // mouth
  cheilion: [2.6, -7.0, 8.45],
  bowPeak: [0.55, -6.1, 10.0],
  upperLipMid: [1.4, -6.47, 9.65],
  lowerLipMid: [1.35, -7.65, 9.4],
  nasolabialTop: [1.95, -4.25, 9.15],
  nasolabialMid: [2.7, -5.9, 8.9],
  nasolabialLow: [3.15, -7.4, 8.4],
  // ear (seen from the side)
  tragus: [7.3, -1.55, 0.35],
  earTop: [7.75, 2.05, -0.9],
  earBack: [8.6, 0.2, -2.7],
  earLobe: [7.45, -4.25, -0.35],
  // neck
  neckSide: [5.6, -12.5, -0.5],
  neckBack: [4.8, -12.0, -5.0],
};

/** Midline points. */
const MID = {
  vertex: [0, 12.1, -1.2],
  crownBack: [0, 9.5, -8.2],
  occiput: [0, 2.0, -10.2],
  trichion: [0, 7.25, 8.05],
  foreheadMid: [0, 4.3, 9.35],
  glabella: [0, 1.75, 9.65],
  nasion: [0, 0.7, 8.95],
  rhinion: [0, -1.35, 10.05],
  supratip: [0, -3.35, 11.0],
  tip: [0, -4.05, 11.5],
  tipLow: [0, -4.6, 11.15],
  subnasale: [0, -5.18, 9.65],
  philtrum: [0, -5.6, 9.85],
  labSup: [0, -6.22, 10.05],
  stomion: [0, -6.92, 9.62],
  labInf: [0, -7.8, 9.72],
  sulcus: [0, -8.75, 9.05],
  pogonion: [0, -10.25, 9.42],
  menton: [0, -11.55, 8.05],
  throat: [0, -11.6, 4.0],
  adamsApple: [0, -14.0, 4.3],
  jugular: [0, -19.0, 3.6],
};

/** Small, deliberate differences between the two halves (no real face is symmetric). */
const ASYM = {
  browPeak: [0, 0.22, 0], // the far brow sits a little higher
  browTail: [0, 0.15, 0],
  cheilion: [0, 0.12, 0], // a slight lift at the far mouth corner
  lidUpPeak: [0, 0.05, 0],
};

export function landmarks() {
  const L = { ...MID };
  for (const [k, v] of Object.entries(SIDE)) {
    L[`n.${k}`] = v; // near side (subject's left)
    const a = ASYM[k] ?? [0, 0, 0];
    L[`f.${k}`] = [-v[0] + a[0], v[1] + a[1], v[2] + a[2]];
  }
  return L;
}

/** A view: yaw (degrees, positive turns the face toward the viewer's left), pitch (chin down), roll, scale, centre. */
export function projector({ yaw = 22, pitch = 3, roll = -1.5, S = 36, cx = 900, cy = 830 }) {
  const cy_ = Math.cos(rad(yaw)),
    sy = Math.sin(rad(yaw));
  const cp = Math.cos(rad(pitch)),
    sp = Math.sin(rad(pitch));
  const cr = Math.cos(rad(roll)),
    sr = Math.sin(rad(roll));
  const L = landmarks();
  const p3 = (v) => {
    if (Array.isArray(v) && v.length === 2) return [v[0], v[1], 0]; // already a picture-space point
    const [x, y0, z] = typeof v === "string" ? L[v] : v;
    // design warp: a shorter nose and a longer upper lip than the raw averages (the nose base rises 4 mm, the
    // mouth 0.7 mm), applied to every point so shapes stay attached to the features
    const y = y0 + 0.42 * Math.exp(-(((y0 + 4.4) / 1.9) ** 2));
    if (x === undefined) throw new Error(`unknown landmark ${v}`);
    const x1 = x * cy_ - z * sy,
      z1 = x * sy + z * cy_;
    const y2 = y * cp - z1 * sp,
      z2 = y * sp + z1 * cp;
    const x3 = x1 * cr - y2 * sr,
      y3 = x1 * sr + y2 * cr;
    return [cx + S * x3, cy - S * y3, z2];
  };
  const P = (v) => p3(v).slice(0, 2);
  /** A point part-way between landmarks, in 3D (so it stays on the face when the head turns). */
  const at = (a, b, t) => {
    const A = typeof a === "string" ? L[a] : a,
      B = typeof b === "string" ? L[b] : b;
    return [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t];
  };
  const off = (a, d) => {
    const A = typeof a === "string" ? L[a] : a;
    return [A[0] + d[0], A[1] + d[1], A[2] + d[2]];
  };
  return { P, p3, at, off, L, S };
}
