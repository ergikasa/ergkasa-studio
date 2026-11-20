/**
 * Daniel, human cartoon v1 (concept prototype): body forms as "tubes", rings of points around a 3D spine.
 *
 * One form (a sleeve with its elbow, a trouser leg, the jacket's torso) is one continuous tube, so its outline is
 * one continuous line and it bends without a seam. Outlines, cel shadows and surface details come from the same
 * 3D points, so the front and the 3/4 view are the same body.
 */
import { add, cross, dot, frame, lerp, lerp3, mul, norm, sub } from "./lib.mjs";

export const N_AROUND = 64;

/**
 * Builds a tube.
 * - `path`: spine points (3D), sampled into `rings` rings.
 * - `section(s, theta)`: radius at spine position s (0..1) and angle theta (radians, 0 = along `hint`, which is
 *   usually the forward direction), so a section can be flat at the front, round at the back, bulge at a muscle.
 */
export function tube({
  path,
  rings = 40,
  section,
  hint = [0, 0, 1],
  around = N_AROUND,
  twist = () => 0,
  axis = null,
}) {
  const spine = resample(path, rings);
  const R = [];
  for (let i = 0; i < spine.length; i++) {
    const s = i / (spine.length - 1);
    // `axis`: every ring lies in a plane across this fixed direction (horizontal slices for a head or a torso),
    // so a spine that moves forward does not tilt the rings into each other
    const a = axis ?? sub(spine[Math.min(spine.length - 1, i + 1)], spine[Math.max(0, i - 1)]);
    const fr = frame(a, hint);
    const pts = [];
    for (let j = 0; j < around; j++) {
      const th = (j / around) * Math.PI * 2 + twist(s);
      const r = section(s, th, spine[i]);
      pts.push(add(spine[i], add(mul(fr.u, Math.cos(th) * r), mul(fr.v, Math.sin(th) * r))));
    }
    R.push({ c: spine[i], a: norm(a), pts, s, local: spine[i] });
  }
  // normals from neighbouring points (outward)
  for (let i = 0; i < R.length; i++) {
    const r = R[i];
    r.n = r.pts.map((p, j) => {
      const t1 = sub(r.pts[(j + 1) % around], r.pts[(j - 1 + around) % around]);
      const t2 = sub(R[Math.min(R.length - 1, i + 1)].pts[j], R[Math.max(0, i - 1)].pts[j]);
      let n = norm(cross(t2, t1));
      if (dot(n, sub(p, r.c)) < 0) n = mul(n, -1);
      return n;
    });
  }
  return { rings: R, around };
}

/** Even spacing along a polyline. */
export function resample(path, count) {
  const seg = [];
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    const l = Math.hypot(...sub(path[i], path[i - 1]));
    seg.push(l);
    total += l;
  }
  const out = [];
  for (let k = 0; k < count; k++) {
    let d = (k / (count - 1)) * total;
    let i = 0;
    while (i < seg.length - 1 && d > seg[i]) {
      d -= seg[i];
      i++;
    }
    out.push(lerp3(path[i], path[i + 1], seg[i] ? Math.min(1, d / seg[i]) : 0));
  }
  return out;
}

/** A point on the surface at spine position s (0..1) and ring index position j (fractional, wraps). */
export function surface(T, s, j) {
  const R = T.rings;
  const x = s * (R.length - 1);
  const i0 = Math.max(0, Math.min(R.length - 2, Math.floor(x)));
  const ti = x - i0;
  const n = T.around;
  const jj = ((j % n) + n) % n;
  const j0 = Math.floor(jj),
    tj = jj - j0;
  const p = (i, k) => R[i].pts[k % n];
  const a = lerp3(p(i0, j0), p(i0, j0 + 1), tj);
  const b = lerp3(p(i0 + 1, j0), p(i0 + 1, j0 + 1), tj);
  return lerp3(a, b, ti);
}

/**
 * The outline of a tube on screen: the extreme points of every projected ring across the projected spine, plus the
 * visible halves of the end rings (`caps`). Returns a closed polygon in screen space.
 */
export function silhouette(T, cam, { capStart = true, capEnd = true, hull: forceHull = false } = {}) {
  const R = T.rings;
  const proj = R.map((r) => ({ c: cam.P(r.c), pts: r.pts.map(cam.P) }));
  // a tube that points at the viewer has no usable spine on screen: its outline is the hull of its rings
  const spineLen = proj
    .slice(1)
    .reduce((s, p, i) => s + Math.hypot(p.c[0] - proj[i].c[0], p.c[1] - proj[i].c[1]), 0);
  const radius =
    proj.reduce(
      (s, p) => s + p.pts.reduce((m, q) => Math.max(m, Math.hypot(q[0] - p.c[0], q[1] - p.c[1])), 0),
      0,
    ) / proj.length;
  if (forceHull || spineLen < 1.6 * radius) return hull(proj.flatMap((p) => p.pts));
  const left = [],
    right = [];
  const ext = [];
  for (let i = 0; i < R.length; i++) {
    const A = proj[Math.max(0, i - 1)].c,
      B = proj[Math.min(R.length - 1, i + 1)].c;
    let ax = B[0] - A[0],
      ay = B[1] - A[1];
    const l = Math.hypot(ax, ay) || 1;
    ax /= l;
    ay /= l;
    const nx = -ay,
      ny = ax;
    let lo = Infinity,
      hi = -Infinity,
      li = 0,
      hiI = 0;
    proj[i].pts.forEach((p, j) => {
      const d = p[0] * nx + p[1] * ny;
      if (d < lo) {
        lo = d;
        li = j;
      }
      if (d > hi) {
        hi = d;
        hiI = j;
      }
    });
    left.push(proj[i].pts[li]);
    right.push(proj[i].pts[hiI]);
    ext.push({ li, hi: hiI, ax, ay });
  }
  const cap = (i, forward) => {
    const { li, hi, ax, ay } = ext[i];
    const pts = proj[i].pts;
    const n = pts.length;
    const walk = (from, to, step) => {
      const out = [];
      for (let k = from; ; k = (k + step + n) % n) {
        out.push(pts[k]);
        if (k === to) break;
      }
      return out;
    };
    const c = proj[i].c;
    const score = (arr) =>
      arr.reduce((s, p) => s + ((p[0] - c[0]) * ax + (p[1] - c[1]) * ay), 0) / arr.length;
    const a = walk(li, hi, 1),
      b = walk(li, hi, -1);
    const pick = forward ? (score(a) > score(b) ? a : b) : score(a) < score(b) ? a : b;
    return pick;
  };
  T.lastChains = { left, right };
  const end = capEnd ? cap(R.length - 1, true) : [left[left.length - 1], right[right.length - 1]];
  const start = capStart ? cap(0, false).reverse() : [right[0], left[0]];
  return [...left, ...end, ...right.slice().reverse(), ...start];
}

/**
 * Cel shadow regions of a tube: where the surface faces the viewer but not the light. Marching squares over the
 * ring grid, contours mapped back to 3D and projected. Returns screen polygons.
 */
export function shadows(T, cam, light, threshold = 0.12, { lightAt, also, minArea = 0, vis } = {}) {
  return region(
    T,
    cam,
    (r, j, nc) => {
      const L = lightAt ? lightAt(r.pts[j]) : light;
      const v = dot(nc, L) - threshold;
      return also ? Math.max(v, also(r, j)) : v;
    },
    { minArea, ...(vis !== undefined ? { vis } : {}) },
  );
}

/**
 * Regions of a tube's visible surface where `value(ring, j, normalInCamera)` < 0, as screen polygons
 * (marching squares over the ring grid).
 */
export function region(T, cam, value, { visibleOnly = true, vis = -0.02, minArea = 0 } = {}) {
  const R = T.rings;
  const n = T.around;
  const V = [0, 0, 1];
  const val = R.map((r) =>
    r.n.map((nw, j) => {
      const nc = cam.dir(nw);
      if (visibleOnly && dot(nc, V) <= vis) return 1;
      return value(r, j, nc);
    }),
  );
  const rows = R.length;
  // pad with lit rows so contours close
  const g = (i, j) => (i < 0 || i >= rows ? 1 : val[i][((j % n) + n) % n]);
  const segs = [];
  const interp = (i1, j1, i2, j2) => {
    const a = g(i1, j1),
      b = g(i2, j2);
    const t = a === b ? 0.5 : a / (a - b);
    return [lerp(i1, i2, t), lerp(j1, j2, t)];
  };
  for (let i = -1; i < rows; i++) {
    for (let j = 0; j < n; j++) {
      const a = g(i, j) < 0,
        b = g(i, j + 1) < 0,
        c = g(i + 1, j + 1) < 0,
        d = g(i + 1, j) < 0;
      const code = (a ? 8 : 0) | (b ? 4 : 0) | (c ? 2 : 0) | (d ? 1 : 0);
      if (code === 0 || code === 15) continue;
      const top = () => interp(i, j, i, j + 1),
        rgt = () => interp(i, j + 1, i + 1, j + 1),
        bot = () => interp(i + 1, j, i + 1, j + 1),
        lft = () => interp(i, j, i + 1, j);
      const table = {
        1: [[lft, bot]],
        2: [[bot, rgt]],
        3: [[lft, rgt]],
        4: [[top, rgt]],
        5: [
          [lft, top],
          [bot, rgt],
        ],
        6: [[top, bot]],
        7: [[lft, top]],
        8: [[lft, top]],
        9: [[top, bot]],
        10: [
          [lft, bot],
          [top, rgt],
        ],
        11: [[top, rgt]],
        12: [[lft, rgt]],
        13: [[bot, rgt]],
        14: [[lft, bot]],
      };
      for (const [p, q] of table[code]) segs.push([p(), q()]);
    }
  }
  // the ring grid wraps at j = n (the front, θ = 0): fold it so contours join across the seam
  for (const sg of segs) for (const q of sg) q[1] = ((q[1] % n) + n) % n;
  const lines = link(segs, n);
  const toScreen = ([i, j]) => {
    const s = Math.max(0, Math.min(1, i / (rows - 1)));
    return cam.P(surface(T, s, j));
  };
  const area = (p) =>
    Math.abs(
      p.reduce((s, q, k) => s + q[0] * p[(k + 1) % p.length][1] - p[(k + 1) % p.length][0] * q[1], 0),
    ) / 2;
  return lines
    .filter((l) => l.length > 3)
    .map((l) => l.map(toScreen))
    .filter((p) => area(p) >= minArea);
}

/** Joins segments that share endpoints into polylines. */
function link(segs, n) {
  const key = (p) => `${Math.round(p[0] * 1000)},${Math.round(p[1] * 1000) % (n * 1000)}`;
  const map = new Map();
  segs.forEach((s, k) => {
    for (const e of [0, 1]) {
      const kk = key(s[e]);
      if (!map.has(kk)) map.set(kk, []);
      map.get(kk).push(k);
    }
  });
  const used = new Set();
  const out = [];
  for (let k = 0; k < segs.length; k++) {
    if (used.has(k)) continue;
    used.add(k);
    const line = [segs[k][0], segs[k][1]];
    let grew = true;
    while (grew) {
      grew = false;
      const tail = key(line[line.length - 1]);
      for (const m of map.get(tail) ?? []) {
        if (used.has(m)) continue;
        used.add(m);
        const s = segs[m];
        line.push(key(s[0]) === tail ? s[1] : s[0]);
        grew = true;
        break;
      }
    }
    out.push(line);
  }
  return out;
}

/** The front-most surface point of a vertical tube at height y and offset x (camera-independent, world x/y). */
export function onFront(T, x, y, side = 1) {
  const R = T.rings;
  // find the two rings around y (rings go along the spine, which may run up or down)
  let best = null;
  for (let i = 0; i < R.length - 1; i++) {
    const y0 = R[i].c[1],
      y1 = R[i + 1].c[1];
    if ((y - y0) * (y - y1) <= 0 && y0 !== y1) {
      best = { i, t: (y - y0) / (y1 - y0) };
      break;
    }
  }
  if (!best) best = { i: y > R[0].c[1] === R[0].c[1] > R[R.length - 1].c[1] ? 0 : R.length - 2, t: 0 };
  const ring = R[best.i].pts.map((p, j) => lerp3(p, R[best.i + 1].pts[j], best.t));
  // among points on the requested side (z > centre), find where x crosses
  const n = ring.length;
  let out = null;
  for (let j = 0; j < n; j++) {
    const a = ring[j],
      b = ring[(j + 1) % n];
    if ((a[0] - x) * (b[0] - x) <= 0 && a[0] !== b[0]) {
      const t = (x - a[0]) / (b[0] - a[0]);
      const p = lerp3(a, b, t);
      if (!out || (side > 0 ? p[2] > out[2] : p[2] < out[2])) out = p;
    }
  }
  return out ?? ring.reduce((m, p) => (side > 0 ? (p[2] > m[2] ? p : m) : p[2] < m[2] ? p : m));
}

/** Convex hull (monotone chain) of screen points. */
export function hull(points) {
  const P = points.map((p) => [p[0], p[1]]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const crs = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [],
    upper = [];
  for (const p of P) {
    while (lower.length >= 2 && crs(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  for (let i = P.length - 1; i >= 0; i--) {
    const p = P[i];
    while (upper.length >= 2 && crs(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

/** The two side chains of a tube's outline (screen points along its length). */
export function chains(T, cam) {
  silhouette(T, cam, { hull: false });
  return T.lastChains;
}
