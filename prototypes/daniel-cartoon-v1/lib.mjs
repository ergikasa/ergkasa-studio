/**
 * Daniel, human cartoon v1 (concept prototype, not production code): shared math, curves, SVG and rendering.
 *
 * Space: centimetres. x toward the subject's left, y up from the floor, z toward the viewer when he faces us.
 */
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const { Resvg } = require("../../node_modules/.pnpm/@resvg+resvg-js@2.6.2/node_modules/@resvg/resvg-js");

export const f = (n) => (Math.round(n * 100) / 100).toString();
export const rad = (d) => (d * Math.PI) / 180;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// ------------------------------------------------------------------------------------------------ vectors
export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const len = (a) => Math.hypot(a[0], a[1], a[2]);
export const norm = (a) => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
export const lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
export const mix2 = (p, q, t) => [lerp(p[0], q[0], t), lerp(p[1], q[1], t)];

/** Rotation of a vector about an axis (Rodrigues). */
export function rotate(v, axis, deg) {
  const k = norm(axis),
    a = rad(deg),
    c = Math.cos(a),
    s = Math.sin(a);
  return add(add(mul(v, c), mul(cross(k, v), s)), mul(k, dot(k, v) * (1 - c)));
}

/** Two unit vectors perpendicular to `axis` (and to each other), with `u` as close as possible to `hint`. */
export function frame(axis, hint = [0, 0, 1]) {
  const a = norm(axis);
  let u = sub(hint, mul(a, dot(hint, a)));
  if (len(u) < 1e-6) u = sub([1, 0, 0], mul(a, a[0]));
  u = norm(u);
  return { a, u, v: cross(a, u) };
}

// ------------------------------------------------------------------------------------------------ camera
/**
 * An orthographic camera. `yaw` turns the subject toward his own left (his face moves to the viewer's right).
 * Returns screen points [X, Y, depth]; depth grows toward the viewer.
 */
export function camera({ yaw = 0, S = 10, cx = 0, cy = 0, floor = 0 }) {
  const c = Math.cos(rad(yaw)),
    s = Math.sin(rad(yaw));
  const view = (p) => [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c];
  const P = (p) => {
    const q = view(p);
    return [cx + S * q[0], cy - S * (q[1] - floor), q[2]];
  };
  /** Camera-space direction (for normals and light). */
  const dir = (d) => view(d);
  return { P, dir, S, yaw };
}

// ------------------------------------------------------------------------------------------------ curves
/** Catmull-Rom through points, as cubic Béziers. */
export function smooth(pts, closed = true, k = 1 / 6) {
  const n = pts.length;
  if (n < 2) return "";
  const P = (i) => pts[closed ? (i + n) % n : clamp(i, 0, n - 1)];
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = P(i - 1),
      p1 = P(i),
      p2 = P(i + 1),
      p3 = P(i + 2);
    const c1 = [p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k];
    const c2 = [p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k];
    d += ` C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`;
  }
  return closed ? d + "Z" : d;
}

/** A polygon as a path (straight segments). */
export const poly = (pts, closed = true) =>
  "M" + pts.map((p) => `${f(p[0])} ${f(p[1])}`).join(" L") + (closed ? "Z" : "");

/** Points along a Catmull-Rom curve through `pts`. */
export function sample(pts, count, closed = false) {
  const n = pts.length;
  const P = (i) => pts[closed ? (i + n) % n : clamp(i, 0, n - 1)];
  const segs = closed ? n : n - 1;
  const out = [];
  for (let j = 0; j <= count; j++) {
    const u = (j / count) * segs;
    const i = Math.min(Math.floor(u), segs - 1);
    const t = u - i;
    const p0 = P(i - 1),
      p1 = P(i),
      p2 = P(i + 1),
      p3 = P(i + 2);
    const t2 = t * t,
      t3 = t2 * t;
    const c = (a, b, c2, d2) =>
      0.5 * (2 * b + (-a + c2) * t + (2 * a - 5 * b + 4 * c2 - d2) * t2 + (-a + 3 * b - 3 * c2 + d2) * t3);
    out.push(pts[0].map((_, k) => c(p0[k], p1[k], p2[k], p3[k])));
  }
  return out;
}

/** Chaikin smoothing of a polygon (keeps shapes organic after sampling). */
export function chaikin(pts, iters = 2, closed = true) {
  let p = pts;
  for (let it = 0; it < iters; it++) {
    const q = [];
    const n = p.length;
    const last = closed ? n : n - 1;
    if (!closed) q.push(p[0]);
    for (let i = 0; i < last; i++) {
      const a = p[i],
        b = p[(i + 1) % n];
      q.push(mix2(a, b, 0.25), mix2(a, b, 0.75));
    }
    if (!closed) q.push(p[n - 1]);
    p = q;
  }
  return p;
}

/**
 * A brush stroke along `pts` as a filled shape: width follows `profile(t)` (0..1 along the stroke), so ink lines
 * swell and taper like a drawn line.
 */
export function brush(pts, width, profile = (t) => Math.sin(Math.PI * clamp(t, 0, 1)) ** 0.6) {
  const n = pts.length;
  if (n < 2) return "";
  const L = [],
    R = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)],
      b = pts[Math.min(n - 1, i + 1)];
    const dx = b[0] - a[0],
      dy = b[1] - a[1],
      l = Math.hypot(dx, dy) || 1;
    const w = (width * Math.max(0.12, profile(i / (n - 1)))) / 2;
    L.push([pts[i][0] - (dy / l) * w, pts[i][1] + (dx / l) * w]);
    R.push([pts[i][0] + (dy / l) * w, pts[i][1] - (dx / l) * w]);
  }
  return poly([...L, ...R.reverse()]);
}

/** Ink line through control points: smoothed, then brushed. */
export const ink = (ctrl, width, profile, count = 40) => brush(sample(ctrl, count), width, profile);

/** Profiles for brush strokes. */
export const taperBoth = (t) => Math.sin(Math.PI * clamp(t, 0, 1)) ** 0.55;
export const taperEnd = (t) => (1 - clamp(t, 0, 1)) ** 0.7;
export const taperStart = (t) => clamp(t, 0, 1) ** 0.7;
export const even = () => 1;

// ------------------------------------------------------------------------------------------------ colour
export function hex2rgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function rgb2hex([r, g, b]) {
  const c = (v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}
export function blend(a, b, t) {
  const A = hex2rgb(a),
    B = hex2rgb(b);
  return rgb2hex([lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t)]);
}

// ------------------------------------------------------------------------------------------------ svg
let uid = 0;
export const id = (p = "i") => `${p}${++uid}`;

export function svgDoc(w, h, body, bg = null) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${
    bg ? `<rect width="${w}" height="${h}" fill="${bg}"/>` : ""
  }${body}</svg>`;
}

/** Renders an SVG string to PNG. `fitWidth` scales the output. */
export function renderPng(svg, file, fitWidth) {
  const r = new Resvg(svg, {
    fitTo: fitWidth ? { mode: "width", value: fitWidth } : { mode: "original" },
    font: { loadSystemFonts: true, defaultFontFamily: "Inter" },
  });
  writeFileSync(file, r.render().asPng());
}
