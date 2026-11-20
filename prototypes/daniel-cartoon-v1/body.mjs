/**
 * Daniel, human cartoon v1 (concept prototype): the posed body under and in his clothes, as tubes.
 *
 * Height 181 cm, about 7.3 heads. Relaxed standing pose with a little contrapposto: weight on his right leg.
 */
import { add, clamp, lerp, rad, smoothstep } from "./lib.mjs";
import { tube } from "./tube.mjs";

/** Polar radius of a superellipse section: half-width w (sideways), depth f (front) or b (back). */
export function sectionRadius(th, w, f, b, n = 2.4) {
  const s = Math.sin(th),
    c = Math.cos(th);
  const d = c >= 0 ? f : b;
  return 1 / (Math.abs(s / w) ** n + Math.abs(c / d) ** n) ** (1 / n);
}

/** Piecewise-linear table lookup with smoothing. */
export function table(rows, y) {
  if (y <= rows[0][0]) return rows[0].slice(1);
  if (y >= rows[rows.length - 1][0]) return rows[rows.length - 1].slice(1);
  for (let i = 0; i < rows.length - 1; i++) {
    const a = rows[i],
      b = rows[i + 1];
    if (y >= a[0] && y <= b[0]) {
      const t = smoothstep(0, 1, (y - a[0]) / (b[0] - a[0]));
      return a.slice(1).map((v, k) => lerp(v, b[k + 1], t));
    }
  }
}

// The pose: joint positions (cm). R = his right (x < 0), L = his left (x > 0).
export const POSE = {
  pelvisTilt: 1.2, // his right hip higher (weight on the right leg)
  shoulderTilt: -0.8,
  joints: {
    hipR: [-9.2, 93.2, 0.5],
    kneeR: [-10.2, 50.5, 1.8],
    ankleR: [-10.6, 8.6, -1.2],
    hipL: [9.2, 92.0, 0.5],
    kneeL: [10.8, 50.0, 3.8],
    ankleL: [12.6, 8.6, 0.8],
    shoulderR: [-17.6, 144.2, -0.8],
    elbowR: [-21.8, 114.5, -3.2],
    wristR: [-21.8, 89.5, 0.8],
    shoulderL: [17.6, 143.8, -0.8],
    elbowL: [21.6, 114.0, -2.6],
    wristL: [21.0, 89.2, 2.8],
  },
};

// Jacket torso: [y, half-width, front depth, back depth] (cm).
const JACKET = [
  [80.5, 17.9, 11.0, 13.2],
  [87, 17.6, 11.4, 13.4],
  [96, 16.8, 11.8, 12.5],
  [106, 15.9, 12.0, 11.0],
  [118, 16.6, 12.2, 11.3],
  [128, 17.6, 12.5, 12.0],
  [136, 18.7, 12.1, 12.3],
  [141.4, 20.4, 10.9, 11.7],
  [144.2, 21.9, 9.4, 10.2],
  [146.0, 20.8, 8.6, 9.2],
  [147.4, 18.8, 8.0, 8.5],
  [148.8, 15.0, 7.6, 8.0],
  [150.5, 10.2, 7.1, 7.6],
  [152.6, 7.8, 6.4, 7.2],
];

export function jacketTorso() {
  const y0 = JACKET[0][0],
    y1 = JACKET[JACKET.length - 1][0];
  return tube({
    path: [
      [0, y0, 0.4],
      [0, 100, 0.2],
      [0, 130, -0.3],
      [0, y1, -0.8],
    ],
    rings: 64,
    section: (s, th) => {
      const y = lerp(y0, y1, s);
      const [w, f, b] = table(JACKET, y);
      return sectionRadius(th, w, f, b, 2.5);
    },
  });
}

/** A sleeve from shoulder to wrist (one tube, bent at the elbow). */
export function sleeve(side) {
  const J = POSE.joints;
  const k = side === "R" ? -1 : 1;
  const sh = J[`shoulder${side}`],
    el = J[`elbow${side}`],
    wr = J[`wrist${side}`];
  const top = [sh[0] - k * 0.8, sh[1] - 0.6, sh[2]];
  return tube({
    path: [top, sh, el, wr],
    rings: 60,
    hint: [0, 0, 1],
    section: (s, th) => {
      // the sleeve head domes over the shoulder, then upper arm, elbow, forearm, cuff
      const r = table(
        [
          [0, 3.0],
          [0.04, 4.5],
          [0.09, 5.4],
          [0.2, 5.5],
          [0.45, 5.3],
          [0.56, 5.2],
          [0.75, 5.0],
          [1, 4.6],
        ],
        s,
      )[0];
      // a little flatter front-to-back on the forearm
      const flat = 1 - 0.08 * smoothstep(0.55, 0.8, s) * Math.abs(Math.cos(th));
      return r * flat;
    },
  });
}

/** Trousers: the seat and one leg each. */
export function trouserSeat() {
  return tube({
    path: [
      [0, 80.5, 0.6],
      [0, 102, 0.6],
    ],
    rings: 24,
    section: (s, th) => {
      const y = lerp(80.5, 102, s);
      const [w, f, b] = table(
        [
          [80.5, 13.5, 8.5, 9],
          [86, 16.6, 10.2, 12.4],
          [94, 17.0, 10.8, 12.2],
          [102, 16.2, 11.0, 10.8],
        ],
        y,
      );
      return sectionRadius(th, w, f, b, 2.4);
    },
  });
}

export function trouserLeg(side) {
  const J = POSE.joints;
  const hip = J[`hip${side}`],
    knee = J[`knee${side}`],
    ankle = J[`ankle${side}`];
  const top = add(hip, [0, 6, 0]);
  const hem = add(ankle, [0, -1.4, 0.4]);
  return tube({
    path: [top, hip, knee, hem],
    rings: 64,
    section: (s, th) => {
      const r = table(
        [
          [0, 9.4],
          [0.12, 8.9],
          [0.35, 7.3],
          [0.55, 6.0],
          [0.62, 5.8],
          [0.8, 5.2],
          [0.95, 5.0],
          [1, 5.3],
        ],
        s,
      )[0];
      // the front crease keeps the trouser a little fuller at the front
      return r * (1 + 0.05 * Math.max(0, Math.cos(th)));
    },
  });
}

/** A shoe (a plain derby): heel to toe, flat sole. */
export function shoe(side) {
  const J = POSE.joints;
  const a = J[`ankle${side}`];
  const out = side === "R" ? -1 : 1;
  const splay = rad(side === "R" ? 9 : 14) * out; // toes turned out a little
  const along = (d) => [a[0] + Math.sin(splay) * d, 0, a[2] + Math.cos(splay) * d];
  const H = 3.6; // centre line height
  return tube({
    path: [
      add(along(-6.2), [0, H + 0.6, 0]),
      add(along(4), [0, H + 0.9, 0]),
      add(along(17.5), [0, H - 0.4, 0]),
      add(along(22.5), [0, H - 0.9, 0]),
    ],
    rings: 40,
    hint: [0, 1, 0],
    section: (s, th) => {
      const [w, up, down] = table(
        [
          [0, 3.6, 4.4, 3.4],
          [0.12, 4.4, 5.6, 3.6],
          [0.4, 4.6, 5.4, 3.7],
          [0.7, 4.9, 3.6, 3.4],
          [0.92, 4.2, 2.6, 2.9],
          [1, 2.2, 1.6, 2.2],
        ],
        s,
      );
      // θ = 0 is up; sole flat (high exponent at the bottom)
      const c = Math.cos(th);
      const n = c >= 0 ? 2.3 : 5;
      return sectionRadius(th, w, up, down, n);
    },
  });
}

/** The neck (skin), from inside the collar up into the head. */
export function neck() {
  return tube({
    path: [
      [0, 147, -1.2],
      [0, 158, -0.2],
      [0, 163, 0.2],
    ],
    rings: 20,
    section: (s, th) => {
      const w = lerp(6.6, 5.9, s),
        f = lerp(6.0, 5.6, s),
        b = lerp(6.4, 5.8, s);
      return sectionRadius(th, w, f, b, 2.2);
    },
  });
}

export const clamp01 = (v) => clamp(v, 0, 1);
