/* global process */
/**
 * Character v4 rig prototype: the head, driven per frame. Not production code.
 *
 * Once (binding): the proxy and its hair and beard shells are built; the shells are labelled from the authored
 * v4 masses; position maps are rasterised at the authoring view, so every authored picture point knows the 3D
 * surface point it was painted on; the hair and beard are generated once at the authoring view (seeded).
 *
 * Per frame (pose → SVG): deform the landmarks and the proxy with the action units; project at the frame's head
 * yaw/pitch/roll; rasterise the proxy into a coarse z-buffer and trace the silhouette, the shadow shapes (from a
 * fixed key light, so the light stays put while the head turns), the edge falloff and the hair and beard
 * extents; carry the authored picture-space paint through the position maps; aim each eye at its target.
 */
import { svgHead, PAL } from "./headpaint.mjs";
import { svgHair, svgBeard, HAIRSTYLE, BEARD } from "../hair.mjs";
import {
  buildHead,
  normalsOf,
  offsetShell,
  rotator,
  zbuffer,
  gridTris,
  contours,
  dilate,
  RING,
  VIEW0,
} from "./proxy.mjs";
import { deformLandmarks, rigLandmarks } from "./face.mjs";
import { projector } from "../model.mjs";
import { smooth, inside, f, clamp } from "../lib.mjs";

/** Key light (toward the light, camera space) and the warm bounce from the shoulders below-right. */
export const KEY = norm([-0.72, 0.5, 0.48]);
const BOUNCE = norm([0.55, -0.75, 0.25]);

function norm(v) {
  const m = Math.hypot(...v);
  return v.map((x) => x / m);
}

/** The projector with a design warp, taking the frame's landmark dict and deformation field. */
function makeH(view, L, def, map0) {
  const base = projector(view);
  const tag = (a) => {
    a.d = true;
    return a;
  };
  const p3 = (v) => {
    if (typeof v === "string") {
      const q = L[v];
      if (!q) throw new Error(`unknown landmark ${v}`);
      return base.p3(q);
    }
    if (v.length === 2) {
      // authored picture point: back to the surface it was painted on, deformed, re-projected
      const q = map0.lookup(v);
      return base.p3(def(q));
    }
    return base.p3(v.d ? v : def(v));
  };
  const P = (v) => p3(v).slice(0, 2);
  const pts = (list) => list.map((v) => P(v));
  const path = (list, closed = true, k) => smooth(pts(list), closed, k);
  const Q = (k, dx = 0, dy = 0) => {
    const p = P(k);
    return [p[0] + dx, p[1] + dy];
  };
  const get = (a) => (typeof a === "string" ? L[a] : a);
  const at = (a, b, t) => {
    const A = get(a),
      B = get(b);
    return tag([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]);
  };
  const off = (a, d) => {
    const A = get(a);
    return tag([A[0] + d[0], A[1] + d[1], A[2] + d[2]]);
  };
  return { P, p3, pts, path, Q, at, off, L, S: view.S, view, tag };
}

// ------------------------------------------------------------------------------------------------ maps

/**
 * A position map: for every cell of the authoring view, the head-space point of the front-most surface of a
 * mesh. Outside the mesh, the nearest surface point plus the picture offset carried rigidly in head space.
 */
function positionMap(verts, tris, cell, bbox) {
  const pr = projector(VIEW0);
  const flat = verts.flat();
  const proj = flat.map((p) => pr.p3(p));
  const buf = zbuffer([{ proj, attrs: flat, tris, mat: 0 }], bbox, cell, 3);
  const { W, H, x0, y0 } = buf;
  const valid = new Uint8Array(W * H);
  for (let k = 0; k < W * H; k++) valid[k] = buf.mat[k] === 0 ? 1 : 0;
  // nearest valid cell (BFS)
  const near = new Int32Array(W * H).fill(-1);
  const queue = new Int32Array(W * H);
  let qh = 0,
    qt = 0;
  for (let k = 0; k < W * H; k++)
    if (valid[k]) {
      near[k] = k;
      queue[qt++] = k;
    }
  while (qh < qt) {
    const k = queue[qh++];
    const i = k % W,
      j = (k / W) | 0;
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
      if (near[kk] >= 0) continue;
      near[kk] = near[k];
      queue[qt++] = kk;
    }
  }
  const inv = rotator(VIEW0).inv;
  const posAt = (k) => [buf.attr[k * 3], buf.attr[k * 3 + 1], buf.attr[k * 3 + 2]];
  const lookup = ([x, y]) => {
    const fi = (x - x0) / cell,
      fj = (y - y0) / cell;
    const i = Math.max(0, Math.min(W - 2, Math.floor(fi))),
      j = Math.max(0, Math.min(H - 2, Math.floor(fj)));
    const ks = [j * W + i, j * W + i + 1, (j + 1) * W + i, (j + 1) * W + i + 1];
    if (ks.every((k) => valid[k]) && fi >= 0 && fj >= 0 && fi < W - 1 && fj < H - 1) {
      const u = fi - i,
        v = fj - j;
      const w = [(1 - u) * (1 - v), u * (1 - v), (1 - u) * v, u * v];
      const out = [0, 0, 0];
      ks.forEach((k, n) => {
        for (let q = 0; q < 3; q++) out[q] += buf.attr[k * 3 + q] * w[n];
      });
      return out;
    }
    const ci = Math.max(0, Math.min(W - 1, Math.round(fi))),
      cj = Math.max(0, Math.min(H - 1, Math.round(fj)));
    const nk = near[cj * W + ci];
    if (nk < 0) return [0, 0, 0];
    const base = posAt(nk);
    const bx = x0 + (nk % W) * cell,
      by = y0 + ((nk / W) | 0) * cell;
    const d = inv([(x - bx) / VIEW0.S, -(y - by) / VIEW0.S, 0]);
    return [base[0] + d[0], base[1] + d[1], base[2] + d[2]];
  };
  return { lookup, buf };
}

/** Per-frame warp of authored picture space through a map: a grid of mapped nodes, bilinear in between. */
function warpGrid(map, bbox, step, toPicture) {
  const [x0, y0, x1, y1] = bbox;
  const W = Math.ceil((x1 - x0) / step) + 1,
    H = Math.ceil((y1 - y0) / step) + 1;
  const gx = new Float64Array(W * H),
    gy = new Float64Array(W * H);
  for (let j = 0; j < H; j++)
    for (let i = 0; i < W; i++) {
      const q = toPicture(map.lookup([x0 + i * step, y0 + j * step]));
      gx[j * W + i] = q[0];
      gy[j * W + i] = q[1];
    }
  return (x, y) => {
    const fi = Math.max(0, Math.min(W - 1.001, (x - x0) / step)),
      fj = Math.max(0, Math.min(H - 1.001, (y - y0) / step));
    const i = Math.floor(fi),
      j = Math.floor(fj),
      u = fi - i,
      v = fj - j;
    const a = j * W + i,
      b = a + 1,
      c = a + W,
      d = c + 1;
    return [
      gx[a] * (1 - u) * (1 - v) + gx[b] * u * (1 - v) + gx[c] * (1 - u) * v + gx[d] * u * v,
      gy[a] * (1 - u) * (1 - v) + gy[b] * u * (1 - v) + gy[c] * (1 - u) * v + gy[d] * u * v,
    ];
  };
}

const PAIR = /(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g;
/** Rewrite every coordinate pair inside path data (all v4 paths are absolute M/L/C/Z with space-separated pairs). */
function warpSvg(svg, warp) {
  return svg.replace(/ d="([^"]*)"/g, (m, d) => {
    const out = d.replace(PAIR, (mm, a, b) => {
      const q = warp(+a, +b);
      return `${Math.round(q[0] * 10) / 10} ${Math.round(q[1] * 10) / 10}`;
    });
    return ` d="${out}"`;
  });
}

/** Convex hull (monotone chain). */
function hull(pts) {
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [],
    up = [];
  for (const q of p) {
    while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop();
    lo.push(q);
  }
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i];
    while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop();
    up.push(q);
  }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}

/** A few passes of a 3×3 box blur over a field. */
function blurField(buf, field, passes) {
  const { W, H } = buf;
  let a = field;
  for (let pass = 0; pass < passes; pass++) {
    const b = new Float32Array(W * H);
    for (let j = 0; j < H; j++)
      for (let i = 0; i < W; i++) {
        let s = 0,
          n = 0;
        for (let dj = -1; dj <= 1; dj++)
          for (let di = -1; di <= 1; di++) {
            const ii = i + di,
              jj = j + dj;
            if (ii < 0 || jj < 0 || ii >= W || jj >= H) continue;
            s += a[jj * W + ii];
            n++;
          }
        b[j * W + i] = s / n;
      }
    a = b;
  }
  return a;
}

/**
 * Box-blur a mask into a smooth field (soft contours instead of stair steps). `bit` selects coverage (any
 * triangle, used for the head itself); `front` selects cells where that material is the front-most surface
 * (hair and beard: their back halves project over the face and must not count).
 */
function softMask(buf, bit, front) {
  const { W, H } = buf;
  let a = new Float32Array(W * H);
  const fr = front === undefined ? null : [].concat(front);
  for (let k = 0; k < W * H; k++) a[k] = fr ? (fr.includes(buf.mat[k]) ? 1 : 0) : buf.cover[k] & bit ? 1 : 0;
  for (let pass = 0; pass < 2; pass++) {
    const b = new Float32Array(W * H);
    for (let j = 0; j < H; j++)
      for (let i = 0; i < W; i++) {
        let s = 0,
          n = 0;
        for (let dj = -1; dj <= 1; dj++)
          for (let di = -1; di <= 1; di++) {
            const ii = i + di,
              jj = j + dj;
            if (ii < 0 || jj < 0 || ii >= W || jj >= H) continue;
            s += a[jj * W + ii];
            n++;
          }
        b[j * W + i] = s / n;
      }
    a = b;
  }
  return a;
}

// ------------------------------------------------------------------------------------------------ rig

export function createHeadRig(opts = {}) {
  const t0 = Date.now();
  const { verts } = buildHead();
  const normals = normalsOf(verts);
  const Lv = verts.length;
  const pr0 = projector(VIEW0);
  const rot0 = rotator(VIEW0).fwd;
  // labels from the authored masses at the authoring view; hidden vertices take their mirror's label
  const label = (poly, extra) => {
    const out = verts.map((row) => row.map(() => 0));
    for (let l = 0; l < Lv; l++)
      for (let i = 0; i < RING; i++) {
        const p = verts[l][i];
        const facing = rot0(normals[l][i])[2] > 0.05;
        if (facing && inside(pr0.p3(p).slice(0, 2), poly)) out[l][i] = 1;
        if (extra && extra(p)) out[l][i] = 1;
      }
    for (let l = 0; l < Lv; l++)
      for (let i = 0; i < RING; i++) {
        const facing = rot0(normals[l][i])[2] > 0.05;
        if (!facing) out[l][i] = out[l][i] || out[l][(RING - i) % RING];
      }
    for (let l = 0; l < Lv; l++)
      for (let i = 0; i < RING; i++) out[l][i] = out[l][i] || out[l][(RING - i) % RING];
    return out;
  };
  const beardLab = label(BEARD.zone, (p) => p[1] < -10.4 && p[2] > 1.5);
  const hairLab = label(HAIRSTYLE.reach, (p) => p[2] < -2.5 && p[1] > -3.2);
  const keepOf = (lab) => (l, i) =>
    lab[l][i] || lab[l + 1][i] || lab[l][(i + 1) % RING] || lab[l + 1][(i + 1) % RING];
  // shells: hair volume (fuller at the front top), the beard a few millimetres off the skin
  const hairT = (p) => {
    const front = clamp((p[2] - 2) / 7, 0, 1),
      top = clamp((p[1] - 4) / 6, 0, 1);
    return 0.75 + 0.55 * front * top + 0.4 * top;
  };
  const hairV = offsetShell(verts, normals, (p, n, l, i) => (hairLab[l][i] ? hairT(p) : 0.05));
  const beardV = offsetShell(verts, normals, (p, n, l, i) => (beardLab[l][i] ? 0.34 : 0.0));
  const trisHead = gridTris(Lv, RING);
  const trisHair = gridTris(Lv, RING, keepOf(hairLab));
  const trisBeard = gridTris(Lv, RING, keepOf(beardLab));
  const bbox0 = [440, 160, 1400, 1460];
  const headMap = positionMap(verts, trisHead, 3, bbox0);
  const hairMap = positionMap(hairV, trisHair, 3, bbox0);
  const beardMap = positionMap(beardV, trisBeard, 3, bbox0);
  // authored hair and beard, generated once at the authoring view
  const lod = opts.lod ?? 1;
  const hair = svgHair({ lod });
  const beardBase = svgBeard(null, { lips: [], lod });
  const bindMs = Date.now() - t0;

  /**
   * pose: { yaw, pitch, roll, aus, lids: {n, f}, look: [x, y, z] camera-space cm from the head origin,
   *         pupil (1 = normal) }
   */
  function draw(pose = {}) {
    const T = {};
    let t = process.hrtime.bigint();
    const lap = (k) => {
      const n = process.hrtime.bigint();
      T[k] = Number(n - t) / 1e6;
      t = n;
    };
    const view = {
      ...VIEW0,
      yaw: pose.yaw ?? VIEW0.yaw,
      pitch: pose.pitch ?? VIEW0.pitch,
      roll: pose.roll ?? VIEW0.roll,
    };
    const rot = rotator(view);
    // gaze: each eye aims at the target; the lids follow the vertical angle
    const L0 = rigLandmarks();
    const target = pose.look ?? [0, 0, 60];
    const gazeOf = (s) => {
      const e = rot.fwd(L0[`${s}.eyeC`]);
      let d = norm([target[0] - e[0], target[1] - e[1], target[2] - e[2]]);
      // the eye cannot turn more than ~38° from straight ahead: clamp in head space
      let dh = rot.inv(d);
      const lim = Math.sin((38 * Math.PI) / 180);
      const hx = clamp(dh[0], -lim, lim),
        hy = clamp(dh[1], -lim * 0.8, lim * 0.8);
      dh = norm([hx, hy, Math.sqrt(Math.max(0.05, 1 - hx * hx - hy * hy))]);
      d = rot.fwd(dh);
      return { dh, d };
    };
    const G = { n: gazeOf("n"), f: gazeOf("f") };
    const gazeY = Math.asin((G.n.dh[1] + G.f.dh[1]) / 2);
    const { L, def } = deformLandmarks(pose.aus ?? {}, pose.lids ?? {}, gazeY);
    const H = makeH(view, L, def, headMap);
    H.pupil = pose.pupil ?? 1;
    H.gaze = {};
    for (const s of ["n", "f"]) {
      const c = L[`${s}.eyeC`];
      const dh = G[s].dh;
      const pupil = H.tag([c[0] + dh[0] * 1.08, c[1] + dh[1] * 1.08, c[2] + dh[2] * 1.08]);
      const d = G[s].d;
      H.gaze[s] = {
        c: H.P(pupil),
        ang: Math.atan2(-d[1], d[0]),
        k: Math.abs(d[2]),
        open: 1 - clamp(((pose.lids ?? {})[s] ?? 0) * 1.4, 0, 1),
      };
    }
    lap("rig");
    // proxy, deformed and projected; normals rotated into camera space
    const pr = projector(view);
    const flatP = [];
    const attrH = [],
      attrS = [];
    const shells = [];
    const push = (V, attr, lab, where) => {
      const proj = [];
      for (let l = 0; l < Lv; l++)
        for (let i = 0; i < RING; i++) {
          const p = def(V[l][i]);
          proj.push(pr.p3(p));
          if (attr) {
            const n = rot.fwd(normals[l][i]);
            const key = n[0] * KEY[0] + n[1] * KEY[1] + n[2] * KEY[2];
            // the hair shell carries where it is on the head instead (for the base fill)
            if (where) attr.push([key, V[l][i][0], V[l][i][2]]);
            else attr.push([key, n[0] * BOUNCE[0] + n[1] * BOUNCE[1] + n[2] * BOUNCE[2], n[2]]);
          }
        }
      return proj;
    };
    const projHead = push(verts, attrH);
    const attrHair = [];
    const projHair = push(hairV, attrHair, null, true);
    const projBeard = push(beardV, attrS, beardLab);
    void shells;
    void flatP;
    let x0 = Infinity,
      y0 = Infinity,
      x1 = -Infinity,
      y1 = -Infinity;
    for (const p of projHair.concat(projHead)) {
      x0 = Math.min(x0, p[0]);
      y0 = Math.min(y0, p[1]);
      x1 = Math.max(x1, p[0]);
      y1 = Math.max(y1, p[1]);
    }
    const cell = opts.cell ?? 4;
    const buf = zbuffer(
      [
        { proj: projHead, attrs: attrH, tris: trisHead, mat: 0 },
        { proj: projBeard, attrs: attrS, tris: trisBeard, mat: 1, bias: 0.01 },
        { proj: projHair, attrs: attrHair, tris: trisHair, mat: 2, bias: 0.01 },
      ],
      [x0 - 40, y0 - 40, x1 + 40, y1 + 40],
      cell,
      3,
    );
    lap("zbuffer");
    const loopPath = (loop) => smooth(loop, true, 0.12);
    // silhouette: the head, plus the nose and the lips where they stand off the face
    const skinLoop = contours(buf, softMask(buf, 1), 0.5, 200)[0] ?? [];
    const noseHull = hull(
      [
        "nasion",
        "rhinion",
        "supratip",
        "tip",
        "tipLow",
        "subnasale",
        "n.alare",
        "f.alare",
        "n.alarTop",
        "f.alarTop",
      ].map((k) => H.P(k)),
    );
    const lipHull = hull(
      [
        "f.cheilion",
        "f.upperLipMid",
        "labSup",
        "n.upperLipMid",
        "n.cheilion",
        "n.lowerLipMid",
        "labInf",
        "f.lowerLipMid",
      ].map((k) => H.P(k)),
    );
    const skinPaths = [loopPath(skinLoop), smooth(noseHull, true, 0.14), smooth(lipHull, true, 0.14)];
    // shading from the light: dilate the surface quantities past the silhouette so contours only follow form
    const nW = buf.W * buf.H;
    const onHead = new Uint8Array(nW);
    const nl = new Float32Array(nW),
      nb = new Float32Array(nW),
      nz = new Float32Array(nW);
    for (let k = 0; k < nW; k++) {
      if (buf.mat[k] !== 0) continue;
      onHead[k] = 1;
      nl[k] = buf.attr[k * 3];
      nb[k] = buf.attr[k * 3 + 1];
      nz[k] = buf.attr[k * 3 + 2];
    }
    const dl = dilate(buf, nl, onHead, 10).field;
    const db = dilate(buf, nb, onHead, 10).field;
    const dz = dilate(buf, nz, onHead, 10).field;
    const neg = (a, s = 1) => a.map((v) => -v * s);
    const shadowLoops = contours(buf, neg(dl), -0.04, 80);
    const coreLoops = contours(buf, neg(dl), 0.28, 80);
    const halfLoops = contours(buf, neg(dl), -0.3, 80);
    const bounceLoops = contours(
      buf,
      db.map((v, k) => (dl[k] < 0 ? v : -1)),
      0.32,
      80,
    );
    const edgeLoops = contours(buf, neg(dz), -0.32, 80);
    const P = (loops) => loops.map(loopPath).join(" ");
    // an empty path with a filter aborts resvg: emit only what has geometry
    const el = (loops, attrs) => (loops.length ? `<path d="${P(loops)}" ${attrs}/>` : "");
    const shadow = [
      el(halfLoops, `fill="${PAL.shade}" opacity=".2" filter="url(#b10)"`),
      el(shadowLoops, `fill="${PAL.shade}" opacity=".92" filter="url(#b3)"`),
      el(shadowLoops, `fill="${PAL.shade}" opacity=".3" transform="translate(-10 0)" filter="url(#b16)"`),
      el(
        shadowLoops,
        `fill="none" stroke="${PAL.terminator}" stroke-width="14" opacity=".38" filter="url(#b6)"`,
      ),
      el(coreLoops, `fill="${PAL.shadeDeep}" opacity=".26" filter="url(#b16)"`),
      el(bounceLoops, `fill="${PAL.bounce}" opacity=".35" filter="url(#b16)"`),
    ].join("");
    const edgeTurn = el(edgeLoops, `fill="#C98C6E" opacity=".35" filter="url(#b16)"`);
    const silLines = `<path d="${loopPath(skinLoop)}" fill="none" stroke="${PAL.line}" stroke-width="2.4" opacity=".5" filter="url(#b05)"/>`;
    lap("contours");
    const h = svgHead(H, { skinPaths, shadow, edgeTurn, silLines, noNeck: true, seed: 7 });
    lap("paint");
    // hair and beard: the authored strokes carried through their shells' maps
    const toPic = (deform) => (q) => pr.p3(deform ? def(q) : q).slice(0, 2);
    const hairWarp = warpGrid(hairMap, [480, 240, 1320, 1120], 8, toPic(false));
    const beardWarp = warpGrid(beardMap, [580, 860, 1220, 1360], 6, toPic(true));
    const hairSvg = warpSvg(hair.svg, hairWarp);
    const hairDefs = warpSvg(hair.defs, hairWarp);
    // the beard mask: the authored zone carried along, the current lips cut out of it
    const lipCut = h.lips
      .map((lp) => `<path d="${smooth(lp, true, 0.17)}" fill="#000" filter="url(#b1)"/>`)
      .join("");
    const beardDefs = warpSvg(beardBase.defs, beardWarp).replace("</mask>", `${lipCut}</mask>`);
    const beardSvg = warpSvg(beardBase.svg, beardWarp);
    lap("warp");
    // extents of the hair and beard from their shells (a little room for the hairs that break the outline)
    const hairLoop = contours(buf, softMask(buf, 0, [0, 1, 2]), 0.2, 200)[0] ?? [];
    const beardLoop = contours(buf, softMask(buf, 0, [0, 1]), 0.12, 200)[0] ?? [];
    const defs = [
      h.defs,
      hairDefs,
      beardDefs,
      `<clipPath id="hairExt"><path d="${loopPath(hairLoop)}"/></clipPath>`,
      `<clipPath id="beardExt"><path d="${loopPath(beardLoop)}"/></clipPath>`,
    ].join("");
    // the hair's own volume under the authored strokes: covers whatever the painting never showed (the far
    // temple at a frontal view, the back of the skull at a wide one), lit from the same key
    const onHair = new Uint8Array(nW);
    const hl = new Float32Array(nW);
    for (let k = 0; k < nW; k++)
      if (buf.mat[k] === 2) {
        onHair[k] = 1;
        hl[k] = buf.attr[k * 3];
      }
    const hairLitField = dilate(buf, hl, onHair, 6).field;
    // the base stays back from the skin (the authored hairline and its roots own that edge) but reaches the
    // outer silhouette
    const distSkin = new Int16Array(nW).fill(999);
    const q = [];
    for (let k = 0; k < nW; k++)
      if (buf.mat[k] === 0 || buf.mat[k] === 1) {
        distSkin[k] = 0;
        q.push(k);
      }
    for (let h2 = 0; h2 < q.length; h2++) {
      const k = q[h2];
      if (distSkin[k] >= 6) continue;
      const i = k % buf.W,
        j = (k / buf.W) | 0;
      for (const [di, dj] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const ii = i + di,
          jj = j + dj;
        if (ii < 0 || jj < 0 || ii >= buf.W || jj >= buf.H) continue;
        const kk = jj * buf.W + ii;
        if (distSkin[kk] <= distSkin[k] + 1) continue;
        distSkin[kk] = distSkin[k] + 1;
        q.push(kk);
      }
    }
    const baseField = new Float32Array(nW);
    // only where the painting cannot reach: the far side of the head and the back (the near temple is painted)
    for (let k = 0; k < nW; k++) {
      const hx = buf.attr[k * 3 + 1],
        hz = buf.attr[k * 3 + 2];
      baseField[k] = buf.mat[k] === 2 && distSkin[k] > 5 && (hx < -1.5 || hz < -0.5) ? 1 : 0;
    }
    const baseLoops = contours(buf, blurField(buf, baseField, 2), 0.5, 200);
    const hairLit = contours(
      buf,
      blurField(
        buf,
        hairLitField.map((v, k) => (baseField[k] ? v : -1)),
        1,
      ),
      0.28,
      150,
    );
    const hairBase = baseLoops.length
      ? `<path d="${P(baseLoops)}" fill="#120D0A" filter="url(#b4)"/>` +
        (hairLit.length ? `<path d="${P(hairLit)}" fill="#3A2C22" opacity=".55" filter="url(#b16)"/>` : "")
      : "";
    const svg = [
      h.face,
      h.features,
      `<g clip-path="url(#beardExt)">${beardSvg}</g>`,
      `<g clip-path="url(#hairExt)">${hairBase}${hairSvg}</g>`,
      h.ear,
    ].join("");
    lap("assemble");
    // what the body needs: the neck's top (the skull base pivot) and the beard's lower edge
    const pivot = pr.p3([0, -6.2, -2.4]).slice(0, 2);
    return { defs, svg, info: { pivot, skinLoop, beardLoop, view }, timing: T };
  }
  return { draw, bindMs };
}
