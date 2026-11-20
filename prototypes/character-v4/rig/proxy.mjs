/**
 * Character v4 rig prototype: the head proxy. Not production code.
 *
 * The v4 painting was authored at one view. To turn the head, the paint needs a volume underneath it. The proxy
 * is that volume: a head lofted from horizontal sections whose control points come from the anatomical
 * landmarks (forehead, brow ridge, orbit, zygoma, malar, cheek hollow, jaw, chin), plus two shells offset from
 * it for the hair and the beard. Every frame the proxy is deformed (action units), projected and rasterised at
 * low resolution into a z-buffer; vector contours are then traced from that buffer: the silhouette, the
 * light-driven shadow shapes, the visible hair and beard masses. The authored strokes are bound to the proxy by
 * position maps taken once at the authoring view (projective binding), so they turn with it.
 */
import { projector } from "../model.mjs";
import { lerp, clamp } from "../lib.mjs";

/** The view the v4 portrait was painted at. */
export const VIEW0 = { yaw: 22, pitch: 3, roll: -1.5, S: 36, cx: 900, cy: 830 };

// ------------------------------------------------------------------------------------------------ sections

/**
 * Near half of each key section, front midline to back midline: [x, z] in cm (x toward the subject's left).
 * Columns: front, inner (nose side / inner eye), mid (eye / cheek), outer (outer eye / malar), temple–zygoma,
 * side-front, side, back-side, back.
 */
const KEY = [
  [
    11.9,
    [
      [0, 1.5],
      [0.9, 1.3],
      [1.7, 0.8],
      [2.3, 0.0],
      [2.6, -0.9],
      [2.7, -1.7],
      [2.6, -2.6],
      [1.8, -3.6],
      [0, -4.0],
    ],
  ],
  [
    10.6,
    [
      [0, 4.6],
      [1.9, 4.3],
      [3.5, 3.6],
      [4.7, 2.5],
      [5.5, 1.0],
      [5.9, -0.6],
      [5.9, -2.6],
      [4.8, -5.0],
      [0, -6.4],
    ],
  ],
  [
    8.6,
    [
      [0, 7.2],
      [2.1, 6.9],
      [3.9, 6.1],
      [5.3, 4.9],
      [6.5, 2.9],
      [7.1, 0.6],
      [7.3, -2.2],
      [6.2, -5.9],
      [0, -8.2],
    ],
  ],
  [
    6.4,
    [
      [0, 8.6],
      [2.0, 8.4],
      [3.8, 7.7],
      [5.2, 6.4],
      [6.4, 4.4],
      [7.3, 1.2],
      [7.6, -2.4],
      [6.6, -6.6],
      [0, -9.4],
    ],
  ],
  [
    4.3,
    [
      [0, 9.35],
      [1.9, 9.15],
      [3.6, 8.5],
      [5.0, 7.3],
      [6.25, 5.2],
      [7.3, 1.6],
      [7.6, -2.6],
      [6.8, -7.0],
      [0, -10.0],
    ],
  ],
  [
    2.6,
    [
      [0, 9.6],
      [1.7, 9.45],
      [3.3, 8.95],
      [4.8, 7.8],
      [6.2, 5.3],
      [7.2, 1.8],
      [7.5, -2.8],
      [6.8, -7.2],
      [0, -10.2],
    ],
  ],
  [
    1.6,
    [
      [0, 9.62],
      [1.4, 9.2],
      [2.8, 9.05],
      [4.4, 8.1],
      [5.6, 6.5],
      [6.9, 2.6],
      [7.4, -2.8],
      [6.7, -7.2],
      [0, -10.2],
    ],
  ],
  [
    0.4,
    [
      [0, 9.0],
      [1.65, 7.95],
      [3.1, 8.15],
      [4.6, 6.6],
      [5.45, 6.1],
      [6.85, 3.2],
      [7.3, -2.6],
      [6.6, -7.0],
      [0, -10.1],
    ],
  ],
  [
    -0.9,
    [
      [0, 9.25],
      [1.6, 8.85],
      [3.3, 8.15],
      [4.75, 7.2],
      [5.95, 5.8],
      [6.95, 3.3],
      [7.1, -2.2],
      [6.4, -6.6],
      [0, -9.8],
    ],
  ],
  [
    -2.2,
    [
      [0, 9.35],
      [1.6, 9.25],
      [3.3, 8.75],
      [4.7, 7.5],
      [5.9, 5.5],
      [6.75, 3.0],
      [6.9, -1.6],
      [6.0, -5.6],
      [0, -8.6],
    ],
  ],
  [
    -3.5,
    [
      [0, 9.45],
      [1.75, 9.25],
      [3.4, 8.6],
      [5.2, 6.8],
      [6.1, 4.4],
      [6.5, 2.0],
      [6.5, -1.2],
      [5.2, -4.4],
      [0, -6.4],
    ],
  ],
  [
    -5.2,
    [
      [0, 9.65],
      [1.9, 9.2],
      [3.5, 8.45],
      [5.15, 6.2],
      [5.9, 4.0],
      [6.15, 1.8],
      [6.0, -0.8],
      [4.4, -2.9],
      [0, -3.6],
    ],
  ],
  [
    -7.0,
    [
      [0, 9.62],
      [1.5, 9.5],
      [2.7, 8.5],
      [4.0, 7.6],
      [5.1, 5.9],
      [5.7, 3.0],
      [5.6, 0.8],
      [4.0, -1.2],
      [0, -2.0],
    ],
  ],
  [
    -9.3,
    [
      [0, 9.15],
      [1.5, 9.0],
      [3.0, 8.4],
      [4.1, 6.9],
      [4.75, 4.4],
      [4.85, 2.4],
      [4.2, 0.6],
      [2.9, -0.6],
      [0, -1.0],
    ],
  ],
  [
    -10.8,
    [
      [0, 9.0],
      [1.5, 8.75],
      [2.9, 7.3],
      [3.4, 5.8],
      [3.45, 4.2],
      [3.0, 2.8],
      [2.3, 1.6],
      [1.3, 0.8],
      [0, 0.5],
    ],
  ],
  [
    -11.6,
    [
      [0, 7.8],
      [1.0, 7.6],
      [1.8, 7.0],
      [2.2, 6.1],
      [2.2, 5.2],
      [1.9, 4.4],
      [1.3, 3.9],
      [0.7, 3.6],
      [0, 3.5],
    ],
  ],
];

const cr = (p0, p1, p2, p3, t) => {
  const t2 = t * t,
    t3 = t2 * t;
  return (
    0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  );
};

/** Ring points (closed, 16) for a key section: near half then the mirrored far half. */
const ringOf = (half) => [
  ...half,
  ...half
    .slice(1, -1)
    .reverse()
    .map(([x, z]) => [-x, z]),
];

/** Resample a closed ring with Catmull-Rom: `sub` points per span. Index 0 stays the front midline. */
function resample(ring, sub) {
  const n = ring.length;
  const out = [];
  for (let i = 0; i < n; i++) {
    const p0 = ring[(i - 1 + n) % n],
      p1 = ring[i],
      p2 = ring[(i + 1) % n],
      p3 = ring[(i + 2) % n];
    for (let s = 0; s < sub; s++) {
      const t = s / sub;
      out.push([cr(p0[0], p1[0], p2[0], p3[0], t), cr(p0[1], p1[1], p2[1], p3[1], t)]);
    }
  }
  return out;
}

export const RING = 64;
const LEVELS = 72;

/** The undeformed head proxy: levels × RING vertices in head space, top to bottom. */
export function buildHead() {
  const rings = KEY.map(([y, half]) => [y, resample(ringOf(half), RING / 16)]);
  const yTop = 12.1,
    yBot = -11.72;
  const verts = [];
  const levelY = [];
  for (let l = 0; l < LEVELS; l++) {
    const u = l / (LEVELS - 1);
    // denser levels where the face has detail (brow to chin)
    const y = lerp(yTop, yBot, u);
    levelY.push(y);
    const row = [];
    if (y >= rings[0][0] || y <= rings[rings.length - 1][0]) {
      // caps: shrink the first/last ring toward its centre
      const top = y >= rings[0][0];
      const [ry, r] = top ? rings[0] : rings[rings.length - 1];
      const k = top ? clamp(1 - (y - ry) / (yTop - ry), 0.02, 1) : clamp(1 - (ry - y) / (ry - yBot), 0.02, 1);
      const cx = 0,
        cz = r.reduce((a, p) => a + p[1], 0) / r.length;
      const kk = Math.sqrt(k);
      for (const [x, z] of r) row.push([cx + x * kk, y, cz + (z - cz) * kk]);
    } else {
      let k = 0;
      while (rings[k + 1][0] > y) k++;
      const a = rings[Math.max(0, k - 1)],
        b = rings[k],
        c = rings[k + 1],
        d = rings[Math.min(rings.length - 1, k + 2)];
      const t = (b[0] - y) / (b[0] - c[0]);
      for (let i = 0; i < RING; i++) {
        row.push([
          cr(a[1][i][0], b[1][i][0], c[1][i][0], d[1][i][0], t),
          y,
          cr(a[1][i][1], b[1][i][1], c[1][i][1], d[1][i][1], t),
        ]);
      }
    }
    verts.push(row);
  }
  return { verts, levelY };
}

/** Outward normals of a level × ring grid. */
export function normalsOf(verts) {
  const L = verts.length,
    N = verts[0].length;
  const out = [];
  for (let l = 0; l < L; l++) {
    const row = [];
    for (let i = 0; i < N; i++) {
      const a = verts[l][(i + 1) % N],
        b = verts[l][(i - 1 + N) % N];
      const c = verts[Math.max(0, l - 1)][i],
        d = verts[Math.min(L - 1, l + 1)][i];
      const tu = [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
      const tv = [c[0] - d[0], c[1] - d[1], c[2] - d[2]];
      let n = [tu[1] * tv[2] - tu[2] * tv[1], tu[2] * tv[0] - tu[0] * tv[2], tu[0] * tv[1] - tu[1] * tv[0]];
      const p = verts[l][i];
      // outward: away from the head's core axis
      const out2 = [p[0], 0, p[2] - 0.5];
      if (n[0] * out2[0] + n[2] * out2[2] + (l < 3 ? n[1] : l > L - 4 ? -n[1] : 0) < 0) n = n.map((v) => -v);
      const m = Math.hypot(n[0], n[1], n[2]) || 1;
      row.push([n[0] / m, n[1] / m, n[2] / m]);
    }
    out.push(row);
  }
  return out;
}

/** A shell offset along the normals by `t(p, n)` cm (hair, beard). */
export function offsetShell(verts, normals, t) {
  return verts.map((row, l) =>
    row.map((p, i) => {
      const n = normals[l][i];
      const d = t(p, n, l, i);
      return [p[0] + n[0] * d, p[1] + n[1] * d, p[2] + n[2] * d];
    }),
  );
}

// ------------------------------------------------------------------------------------------------ views

/** Rotation of head-space vectors into camera space (the projector's rotation, without the design warp). */
export function rotator(view) {
  const { yaw = 22, pitch = 3, roll = -1.5 } = view;
  const r = (d) => (d * Math.PI) / 180;
  const cy = Math.cos(r(yaw)),
    sy = Math.sin(r(yaw)),
    cp = Math.cos(r(pitch)),
    sp = Math.sin(r(pitch)),
    cr_ = Math.cos(r(roll)),
    sr = Math.sin(r(roll));
  const fwd = ([x, y, z]) => {
    const x1 = x * cy - z * sy,
      z1 = x * sy + z * cy;
    const y2 = y * cp - z1 * sp,
      z2 = y * sp + z1 * cp;
    return [x1 * cr_ - y2 * sr, x1 * sr + y2 * cr_, z2];
  };
  const inv = ([x3, y3, z2]) => {
    const x1 = x3 * cr_ + y3 * sr,
      y2 = -x3 * sr + y3 * cr_;
    const y = y2 * cp + z2 * sp,
      z1 = -y2 * sp + z2 * cp;
    return [x1 * cy + z1 * sy, y, -x1 * sy + z1 * cy];
  };
  return { fwd, inv };
}

/** Project a grid of head-space points: picture x, y and depth (toward the camera). */
export function projectGrid(verts, view) {
  const pr = projector(view);
  return verts.map((row) => row.map((p) => pr.p3(p)));
}

// ------------------------------------------------------------------------------------------------ z-buffer

/**
 * Rasterise triangle meshes into a coarse z-buffer. Each mesh: { proj, attrs, tris, mat } where proj are
 * projected vertices [x, y, depth], attrs per-vertex arrays of numbers to interpolate, tris [a, b, c] vertex
 * indices into the flattened grid. Returns the buffer with the front-most material and attributes per cell.
 */
export function zbuffer(meshes, bbox, cell, nAttr) {
  const [x0, y0, x1, y1] = bbox;
  const W = Math.ceil((x1 - x0) / cell) + 1,
    H = Math.ceil((y1 - y0) / cell) + 1;
  const depth = new Float32Array(W * H).fill(-Infinity);
  const mat = new Int8Array(W * H).fill(-1);
  const attr = new Float32Array(W * H * nAttr);
  const cover = new Uint8Array(W * H); // bit per material: any triangle covers the cell
  for (const m of meshes) {
    const P = m.proj,
      A = m.attrs;
    const bit = 1 << m.mat;
    for (const [ia, ib, ic] of m.tris) {
      const a = P[ia],
        b = P[ib],
        c = P[ic];
      const minx = Math.max(0, Math.floor((Math.min(a[0], b[0], c[0]) - x0) / cell)),
        maxx = Math.min(W - 1, Math.ceil((Math.max(a[0], b[0], c[0]) - x0) / cell));
      const miny = Math.max(0, Math.floor((Math.min(a[1], b[1], c[1]) - y0) / cell)),
        maxy = Math.min(H - 1, Math.ceil((Math.max(a[1], b[1], c[1]) - y0) / cell));
      const det = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
      if (Math.abs(det) < 1e-9) continue;
      for (let j = miny; j <= maxy; j++) {
        const py = y0 + j * cell;
        for (let i = minx; i <= maxx; i++) {
          const px = x0 + i * cell;
          const w0 = ((b[1] - c[1]) * (px - c[0]) + (c[0] - b[0]) * (py - c[1])) / det;
          const w1 = ((c[1] - a[1]) * (px - c[0]) + (a[0] - c[0]) * (py - c[1])) / det;
          const w2 = 1 - w0 - w1;
          if (w0 < -1e-4 || w1 < -1e-4 || w2 < -1e-4) continue;
          const k = j * W + i;
          cover[k] |= bit;
          const z = w0 * a[2] + w1 * b[2] + w2 * c[2] + (m.bias ?? 0);
          if (z <= depth[k]) continue;
          depth[k] = z;
          mat[k] = m.mat;
          const aa = A[ia],
            bb = A[ib],
            cc = A[ic];
          for (let q = 0; q < nAttr; q++) attr[k * nAttr + q] = w0 * aa[q] + w1 * bb[q] + w2 * cc[q];
        }
      }
    }
  }
  return { W, H, x0, y0, cell, depth, mat, attr, cover, nAttr };
}

/** Triangles of a level × ring grid (closed around the ring), optionally only where keep(l, i) holds. */
export function gridTris(L, N, keep) {
  const tris = [];
  for (let l = 0; l < L - 1; l++)
    for (let i = 0; i < N; i++) {
      const i2 = (i + 1) % N;
      const a = l * N + i,
        b = l * N + i2,
        c = (l + 1) * N + i,
        d = (l + 1) * N + i2;
      if (!keep || keep(l, i)) {
        tris.push([a, c, b]);
        tris.push([b, c, d]);
      }
    }
  return tris;
}

// ------------------------------------------------------------------------------------------------ contours

/**
 * Marching squares on a scalar field sampled at the cell centres: contours where f crosses `iso` (inside is
 * f > iso). Returns closed loops in picture space, simplified, largest first.
 */
export function contours(buf, f, iso = 0.5, minArea = 30) {
  const { W, H, x0, y0, cell } = buf;
  const v = (i, j) => (i < 0 || j < 0 || i >= W || j >= H ? -1e9 : f[j * W + i]);
  const segs = new Map();
  const key = (p) => `${Math.round(p[0] * 64)},${Math.round(p[1] * 64)}`;
  const add = (a, b) => {
    const ka = key(a);
    if (!segs.has(ka)) segs.set(ka, []);
    segs.get(ka).push([a, b]);
  };
  const interp = (i0, j0, i1, j1) => {
    const a = v(i0, j0),
      b = v(i1, j1);
    const t = Math.abs(b - a) < 1e-12 ? 0.5 : clamp((iso - a) / (b - a), 0, 1);
    return [x0 + (i0 + (i1 - i0) * t) * cell, y0 + (j0 + (j1 - j0) * t) * cell];
  };
  for (let j = -1; j < H; j++)
    for (let i = -1; i < W; i++) {
      const tl = v(i, j) > iso,
        tr = v(i + 1, j) > iso,
        br = v(i + 1, j + 1) > iso,
        bl = v(i, j + 1) > iso;
      const c = (tl ? 8 : 0) | (tr ? 4 : 0) | (br ? 2 : 0) | (bl ? 1 : 0);
      if (c === 0 || c === 15) continue;
      const T = () => interp(i, j, i + 1, j),
        R = () => interp(i + 1, j, i + 1, j + 1),
        B = () => interp(i, j + 1, i + 1, j + 1),
        Lf = () => interp(i, j, i, j + 1);
      // segments oriented with the inside on the left
      switch (c) {
        case 1:
          add(Lf(), B());
          break;
        case 2:
          add(B(), R());
          break;
        case 3:
          add(Lf(), R());
          break;
        case 4:
          add(R(), T());
          break;
        case 5:
          add(Lf(), T());
          add(R(), B());
          break;
        case 6:
          add(B(), T());
          break;
        case 7:
          add(Lf(), T());
          break;
        case 8:
          add(T(), Lf());
          break;
        case 9:
          add(T(), B());
          break;
        case 10:
          add(T(), R());
          add(B(), Lf());
          break;
        case 11:
          add(T(), R());
          break;
        case 12:
          add(R(), Lf());
          break;
        case 13:
          add(R(), B());
          break;
        case 14:
          add(B(), Lf());
          break;
      }
    }
  const loops = [];
  for (const [k0, list] of segs) {
    while (list.length) {
      const [a, b] = list.pop();
      const loop = [a, b];
      let cur = b,
        guard = 0;
      while (guard++ < 200000) {
        const k = key(cur);
        const next = segs.get(k);
        if (!next || !next.length) break;
        const [, nb] = next.pop();
        if (key(nb) === k0 && loop.length > 2) break;
        loop.push(nb);
        cur = nb;
      }
      if (loop.length > 4) loops.push(loop);
    }
  }
  const area = (pts) => {
    let s = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i],
        b = pts[(i + 1) % pts.length];
      s += a[0] * b[1] - b[0] * a[1];
    }
    return Math.abs(s) / 2;
  };
  return loops
    .map((l) => simplify(l, cell * 0.35))
    .filter((l) => area(l) > minArea)
    .sort((a, b) => area(b) - area(a));
}

/** Ramer–Douglas–Peucker on a closed loop. */
export function simplify(pts, eps) {
  if (pts.length < 5) return pts;
  const rdp = (a, b) => {
    let best = 0,
      idx = -1;
    const [ax, ay] = pts[a],
      [bx, by] = pts[b];
    const dx = bx - ax,
      dy = by - ay,
      l = Math.hypot(dx, dy) || 1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((pts[i][0] - ax) * dy - (pts[i][1] - ay) * dx) / l;
      if (d > best) {
        best = d;
        idx = i;
      }
    }
    if (best > eps) return [...rdp(a, idx).slice(0, -1), ...rdp(idx, b)];
    return [pts[a], pts[b]];
  };
  const mid = Math.floor(pts.length / 2);
  return [...rdp(0, mid).slice(0, -1), ...rdp(mid, pts.length - 1).slice(0, -1)];
}

// ------------------------------------------------------------------------------------------------ fields

/**
 * Fill invalid cells of a field from their valid neighbours (a few passes), so contours of a quantity defined
 * on the surface do not run along the silhouette.
 */
export function dilate(buf, f, valid, passes) {
  const { W, H } = buf;
  const out = Float32Array.from(f);
  let ok = Uint8Array.from(valid);
  for (let p = 0; p < passes; p++) {
    const next = Uint8Array.from(ok);
    for (let j = 0; j < H; j++)
      for (let i = 0; i < W; i++) {
        const k = j * W + i;
        if (ok[k]) continue;
        let s = 0,
          n = 0;
        for (const [di, dj] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const ii = i + di,
            jj = j + dj;
          if (ii < 0 || jj < 0 || ii >= W || jj >= H) continue;
          const kk = jj * W + ii;
          if (ok[kk]) {
            s += out[kk];
            n++;
          }
        }
        if (n) {
          out[k] = s / n;
          next[k] = 1;
        }
      }
    ok = next;
  }
  return { field: out, valid: ok };
}

void lerp;
