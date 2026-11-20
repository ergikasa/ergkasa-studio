/**
 * Character v4 prototype: shared drawing helpers. Not production code.
 */
export const f = (n) => (Math.round(n * 100) / 100).toString();
export const rad = (d) => (d * Math.PI) / 180;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const mix = (p, q, t) => [lerp(p[0], q[0], t), lerp(p[1], q[1], t)];

/** Seeded random numbers, so every render of the same character is the same picture. */
export function rng(seed) {
  let s = seed >>> 0 || 1;
  const next = () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
  next.range = (a, b) => a + (b - a) * next();
  next.gauss = () => {
    let u = 0;
    for (let i = 0; i < 4; i++) u += next();
    return (u - 2) / 0.577;
  };
  return next;
}

/** Catmull-Rom through points, as cubic Béziers. `k` is the tension (1/6 is the classic curve). */
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

/** Points along a Catmull-Rom curve (for strokes that follow a guide). */
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
    out.push([c(p0[0], p1[0], p2[0], p3[0]), c(p0[1], p1[1], p2[1], p3[1])]);
  }
  return out;
}

/** A tapered stroke (a hair, a lash, a crease) as a filled path: wide at `w0`, thin at `w1`. */
export function taper(pts, w0, w1 = 0) {
  const n = pts.length;
  const L = [],
    R = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)],
      b = pts[Math.min(n - 1, i + 1)];
    const dx = b[0] - a[0],
      dy = b[1] - a[1],
      l = Math.hypot(dx, dy) || 1;
    const w = lerp(w0, w1, i / (n - 1)) / 2;
    L.push([pts[i][0] - (dy / l) * w, pts[i][1] + (dx / l) * w]);
    R.push([pts[i][0] + (dy / l) * w, pts[i][1] - (dx / l) * w]);
  }
  const ring = [...L, ...R.reverse()];
  return "M" + ring.map((p) => `${f(p[0])} ${f(p[1])}`).join(" L") + "Z";
}

/** Point-in-polygon (even-odd), for scattering strokes inside a region. */
export function inside(p, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i],
      [xj, yj] = poly[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

/** Hex colour helpers. */
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
