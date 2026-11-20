/**
 * Daniel, human cartoon v1 (concept prototype): drawing the head, its features, beard and hair.
 */
import {
  add,
  blend,
  clamp,
  cross,
  dot,
  ink,
  lerp,
  lerp3,
  mix2,
  mul,
  norm,
  poly,
  sample,
  smooth,
  sub,
  table,
  taperBoth,
  taperEnd,
  taperStart,
} from "./all.mjs";
import { headMass, headToWorld, jawDrop, landmarks, placeTube } from "./head.mjs";
import { region, shadows, silhouette, tube } from "./tube.mjs";
import { sectionRadius } from "./body.mjs";
import { LIGHT, shapePath, thin } from "./render.mjs";
import { id } from "./lib.mjs";

export const HPAL = {
  line: "#2A1D18",
  skin: "#E8B391",
  skinShade: "#C98B6D",
  skinDeep: "#B27159",
  lip: "#C98272",
  lipShade: "#A9665A",
  beard: "#8E6D57",
  beardShade: "#735643",
  stubble: "#D3A487",
  beardLine: "#241913",
  hair: "#4B3528",
  hairShade: "#33241C",
  hairHi: "#6E5141",
  grey: "#8B8079",
  greyHi: "#857970",
  sclera: "#F5F0E8",
  scleraShade: "#D9CFC4",
  iris: "#6E4A2F",
  irisDark: "#3F2918",
  pupil: "#1C130F",
  mouth: "#4A2420",
  teeth: "#F1ECE3",
  tongue: "#B9656A",
};

const deg = (t) => (t * 180) / Math.PI;
const angleOf = (lp, lc) => deg(Math.atan2(lp[0] - lc[0], lp[2] - lc[2])); // 0 = front, + = his left

// ------------------------------------------------------------------------------------------------ hair
/** Where the hair starts, as a local height for an angle around the head (degrees, + = his left). */
function hairline(a) {
  const A = Math.abs(a);
  // a soft M: a little recession at the temples (he is 44), the part side slightly higher
  const y = table(
    [
      [0, 7.15],
      [10, 7.3],
      [24, 7.0],
      [36, 6.2],
      [44, 6.35],
      [52, 5.6],
      [60, 4.3],
      [70, 3.0],
      [80, 2.4],
      [87, 0.6],
      [97, 0.6],
      [101, 2.5],
      [112, 2.6],
      [124, -1.0],
      [148, -3.6],
      [180, -4.4],
    ],
    A,
  )[0];
  const tuft = (c, w, d) => d * Math.exp(-(((a - c) / w) ** 2));
  return y + (a < 0 ? 0.15 * Math.exp(-(((A - 36) / 10) ** 2)) : 0) - tuft(-30, 4, 0.0);
}

/** Thickness of the hair over the skull (cm): short sides, a fuller top swept from the part toward his left. */
function hairThickness(a, y) {
  const A = Math.abs(a);
  const top = smoothstep(4.5, 10, y);
  let t = lerp(0.22, 0.75, top);
  // the front lifts and sweeps: fuller on his left of the part, near the hairline
  const sweep =
    smoothstep(-30, 10, a) * smoothstep(70, 20, a) * smoothstep(6.2, 8.6, y) * smoothstep(12.8, 10.5, y);
  t += 0.75 * sweep;
  if (a < 0) t *= 1 - 0.3 * Math.exp(-(((A - 34) / 7) ** 2)) * top; // the part
  // locks: a slow ripple so the outline is not a helmet
  t *= 1 + 0.16 * Math.sin(a * 0.11 + y * 1.3) * top + 0.08 * Math.sin(a * 0.31 - y * 0.7);
  t *= smoothstep(-5, -1, y) * 0.6 + 0.4; // thinner at the nape
  return Math.max(0.05, t);
}
function smoothstep(a, b, x) {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

/** The hair as a tube: the head mass plus the hair's thickness above the hairline. */
function hairMass(base) {
  // rebuild the head sections with extra radius; reuse the base tube's spine
  const rings = base.rings.map((r) => r.local);
  const lc = (i) => rings[i];
  return tube({
    path: rings,
    rings: rings.length,
    around: base.around,
    axis: [0, 1, 0],
    section: (s, th, c) => {
      const y = c[1];
      // radius of the head at this angle from the base tube's points
      const i = Math.round(s * (base.rings.length - 1));
      const j = Math.round((th / (2 * Math.PI)) * base.around) % base.around;
      const p = base.rings[i].pts[j];
      const r0 =
        Math.hypot(p[0] - lc(i)[0], p[2] - lc(i)[2]) / Math.max(1e-6, Math.hypot(Math.sin(th), Math.cos(th)));
      const a = deg(th > Math.PI ? th - 2 * Math.PI : th);
      const above = smoothstep(hairline(a) - 0.25, hairline(a) + 0.5, y);
      return r0 + 0.02 + hairThickness(a, y) * above;
    },
  });
}

/** A point on a head-space tube at local height y and angle a (degrees). */
function onTube(T, y, a) {
  const R = T.rings;
  let i = 0;
  while (i < R.length - 2 && R[i + 1].local[1] < y) i++;
  const y0 = R[i].local[1],
    y1 = R[i + 1].local[1];
  const t = clamp((y - y0) / (y1 - y0 || 1), 0, 1);
  const n = T.around;
  const jj = ((((a / 360) * n) % n) + n) % n;
  const j0 = Math.floor(jj),
    tj = jj - j0;
  const pt = (k, q) => lerp3(R[k].pts[q % n], R[k].pts[(q + 1) % n], tj);
  return lerp3(pt(i, j0), pt(i + 1, j0), t);
}

// ------------------------------------------------------------------------------------------------ ear
// Ear design, side view, in its own frame: tragus (0,0), top (0.3,1), back (1,0.2), lobe (0.15,-0.78).
const EAR_OUT = [
  [0.02, 0.32],
  [0.1, 0.82],
  [0.38, 1.02],
  [0.72, 0.9],
  [0.98, 0.5],
  [1.0, 0.1],
  [0.86, -0.32],
  [0.6, -0.58],
  [0.36, -0.82],
  [0.12, -0.84],
  [0.0, -0.62],
  [-0.04, -0.28],
];
const EAR_HELIX = [
  [0.22, 0.86],
  [0.55, 0.88],
  [0.82, 0.58],
  [0.86, 0.12],
  [0.7, -0.24],
];
const EAR_ANTI = [
  [0.4, 0.62],
  [0.58, 0.42],
  [0.6, 0.1],
  [0.46, -0.16],
  [0.3, -0.3],
];
const EAR_CONCHA = [
  [0.1, 0.18],
  [0.28, 0.3],
  [0.42, 0.1],
  [0.34, -0.2],
  [0.14, -0.26],
];

function affineFrom(src, dst) {
  // least squares 2D affine: dst = A src + t
  let sxx = 0,
    sxy = 0,
    syy = 0,
    sx = 0,
    sy = 0,
    n = src.length;
  const bx = [0, 0, 0],
    by = [0, 0, 0];
  for (let k = 0; k < n; k++) {
    const [x, y] = src[k],
      [u, v] = dst[k];
    sxx += x * x;
    sxy += x * y;
    syy += y * y;
    sx += x;
    sy += y;
    bx[0] += x * u;
    bx[1] += y * u;
    bx[2] += u;
    by[0] += x * v;
    by[1] += y * v;
    by[2] += v;
  }
  const M = [
    [sxx, sxy, sx],
    [sxy, syy, sy],
    [sx, sy, n],
  ];
  const solve = (b) => {
    const m = M.map((r, i) => [...r, b[i]]);
    for (let c = 0; c < 3; c++) {
      let p = c;
      for (let r = c + 1; r < 3; r++) if (Math.abs(m[r][c]) > Math.abs(m[p][c])) p = r;
      [m[c], m[p]] = [m[p], m[c]];
      for (let r = 0; r < 3; r++) {
        if (r === c) continue;
        const k = m[r][c] / m[c][c];
        for (let q = c; q < 4; q++) m[r][q] -= k * m[c][q];
      }
    }
    return [m[0][3] / m[0][0], m[1][3] / m[1][1], m[2][3] / m[2][2]];
  };
  const a = solve(bx),
    b = solve(by);
  return ([x, y]) => [a[0] * x + a[1] * y + a[2], b[0] * x + b[1] * y + b[2]];
}

// ------------------------------------------------------------------------------------------------ head
/**
 * Draws the head. `cam` is the figure's camera; `pose` places the head ({at, turn, nod, tilt});
 * `expr` are expression parameters; `gaze` is [x, y] (-1..1) in head space.
 */
export function drawHead(cam, { pose = {}, expr = {}, gaze = [0, 0], S = cam.S } = {}) {
  const toW = headToWorld(pose);
  const L = landmarks(expr);
  const P = (k) => cam.P(toW(typeof k === "string" ? L[k] : k));
  const P2 = (k) => P(k).slice(0, 2);
  const facing = (localN) => cam.dir(sub(toW(localN), toW([0, 0, 0])))[2];
  const lw = 2.2 * (S / 10);
  const W = (cm) => cm * S;

  const base = headMass({ beard: 0.2 });
  // the open jaw lowers the chin: move the lower head mass with it
  const drop = jawDrop(expr);
  if (drop > 0)
    for (const r of base.rings) {
      r.pts = r.pts.map((p) => {
        const w = smoothstep(-5.6, -8.4, p[1]) * smoothstep(-2, 4, p[2]);
        return [p[0], p[1] - drop * w, p[2] - 0.2 * drop * w];
      });
    }
  const head = placeTube(base, toW);
  const hairT = placeTube(hairMass(base), toW);

  let svg = "";
  // -------------------------------------------------------------- ears (behind the head's outline)
  const ear = (s) => {
    const n = s === "l" ? [1, 0.1, -0.25] : [-1, 0.1, -0.25];
    if (facing(n) < -0.15) return "";
    const anchors = [`${s}.tragus`, `${s}.earTop`, `${s}.earBack`, `${s}.earLobe`].map(P2);
    const design = [
      [0, 0],
      [0.3, 1],
      [1, 0.2],
      [0.15, -0.78],
    ];
    const A = affineFrom(design, anchors);
    const out = EAR_OUT.map(A);
    const d = smooth(out);
    let e = `<path d="${d}" fill="${HPAL.line}" stroke="${HPAL.line}" stroke-width="${lw * 2}" stroke-linejoin="round"/>`;
    e += `<path d="${d}" fill="${HPAL.skin}"/>`;
    e += `<path d="${smooth(EAR_CONCHA.map(A))}" fill="${HPAL.skinShade}"/>`;
    e += `<path d="${ink(EAR_HELIX.map(A), lw * 1.2, taperBoth)}" fill="${HPAL.line}"/>`;
    e += `<path d="${ink(EAR_ANTI.map(A), lw * 0.9, taperBoth)}" fill="${HPAL.skinDeep}"/>`;
    return e;
  };
  // -------------------------------------------------------------- head mass (skin)
  const headOut = shapePath(silhouette(head, cam));
  svg += `<path d="${headOut}" fill="${HPAL.line}" stroke="${HPAL.line}" stroke-width="${lw * 2}" stroke-linejoin="round"/>`;
  // the whole mass starts as beard; the skin is laid over everything above the beard line
  svg += `<path d="${headOut}" fill="${HPAL.beard}"/>`;
  const clipHead = id("h");
  svg += `<clipPath id="${clipHead}"><path d="${headOut}"/></clipPath><g clip-path="url(#${clipHead})">`;
  const beardVal = (r, j) => {
    const lp = r.lpts[j],
      lc = r.local;
    const a = angleOf(lp, lc);
    return lp[1] - cheekLineOf(a);
  };
  // beard in shadow (on visible surface), under the skin
  for (const p of region(head, cam, (r, j, nc) => Math.max(beardVal(r, j), dot(nc, LIGHT) - 0.3), {
    minArea: W(0.5) ** 2,
  }))
    svg += `<path d="${smooth(thin(p, 1.5))}" fill="${HPAL.beardShade}" stroke="${HPAL.beardShade}" stroke-width="1.2"/>`;
  // stubble band, then skin
  for (const p of region(head, cam, (r, j) => -beardVal(r, j)))
    svg += `<path d="${smooth(thin(p, 1.5))}" fill="${HPAL.stubble}" stroke="${HPAL.stubble}" stroke-width="1.2"/>`;
  for (const p of region(head, cam, (r, j) => -(beardVal(r, j) - 0.55)))
    svg += `<path d="${smooth(thin(p, 1.5))}" fill="${HPAL.skin}" stroke="${HPAL.skin}" stroke-width="1.2"/>`;
  for (const p of region(head, cam, (r, j, nc) => Math.max(-(beardVal(r, j) - 0.55), dot(nc, LIGHT) - 0.3)))
    svg += `<path d="${smooth(thin(p, 2))}" fill="${HPAL.skinShade}" stroke="${HPAL.skinShade}" stroke-width="1.2"/>`;
  for (const p of region(head, cam, (r, j, nc) =>
    Math.max(-beardVal(r, j), beardVal(r, j) - 0.55, dot(nc, LIGHT) - 0.3),
  ))
    svg += `<path d="${smooth(thin(p, 2))}" fill="${blend(HPAL.stubble, HPAL.skinShade, 0.6)}" stroke="${blend(HPAL.stubble, HPAL.skinShade, 0.6)}" stroke-width="1.2"/>`;
  svg += designedShadows(P2, L, facing);
  // the hair's cast shadow on the forehead: a band under the hairline
  for (const p of region(head, cam, (r, j, nc) => {
    const lp = r.lpts[j];
    const a = angleOf(lp, r.local);
    const h = hairline(a);
    return Math.max(h - 0.55 - lp[1], lp[1] - h, Math.abs(a) > 75 ? 1 : -1);
  }))
    svg += `<path d="${smooth(thin(p, 1.5))}" fill="${HPAL.skinShade}" opacity="0.8"/>`;
  svg += `</g>`;
  svg += ear("r") + ear("l");

  // -------------------------------------------------------------- eyes (features stay inside the head's outline)
  svg += `<g clip-path="url(#${clipHead})">`;
  for (const s of ["r", "l"]) svg += eye(s);
  function eye(s) {
    const sx = s === "l" ? 1 : -1;
    if (facing([sx * 0.45, 0, 1]) < -0.05) return "";
    const up = [`${s}.enCanthus`, `${s}.lidUpIn`, `${s}.lidUpPeak`, `${s}.lidUpOut`, `${s}.exCanthus`].map(
      P2,
    );
    const low = [`${s}.exCanthus`, `${s}.lidLowOut`, `${s}.lidLowLow`, `${s}.lidLowIn`, `${s}.enCanthus`].map(
      P2,
    );
    const upS = sample(up, 24),
      lowS = sample(low, 24);
    const scleraPoly = [...upS, ...lowS.slice(1)];
    const cid = id("e");
    let e = `<clipPath id="${cid}"><path d="${poly(scleraPoly)}"/></clipPath>`;
    e += `<path d="${poly(scleraPoly)}" fill="${HPAL.sclera}"/>`;
    e += `<g clip-path="url(#${cid})">`;
    // iris and pupil on the eyeball, turned by the gaze
    const c = L[`${s}.eyeC`];
    const g = norm([gaze[0] * 0.45 - sx * 0.03, gaze[1] * 0.35 - 0.02, 1]);
    const u = norm(cross([0, 1, 0], g)),
      v = cross(g, u);
    const ring = (rr) => {
      const al = Math.asin(rr / 1.2);
      const out = [];
      for (let k = 0; k < 28; k++) {
        const ph = (k / 28) * Math.PI * 2;
        const d = add(
          mul(g, Math.cos(al)),
          add(mul(u, Math.sin(al) * Math.cos(ph)), mul(v, Math.sin(al) * Math.sin(ph))),
        );
        out.push(P2(add(c, mul(d, 1.2))));
      }
      return out;
    };
    const irisPts = ring(0.66);
    e += `<path d="${poly(irisPts)}" fill="${HPAL.iris}" stroke="${HPAL.irisDark}" stroke-width="${lw * 0.7}"/>`;
    // darker upper iris (the lid's shadow) and a warm lower ring
    e += `<path d="${poly(ring(0.4))}" fill="${blend(HPAL.iris, "#9A6B44", 0.35)}" opacity="0.55"/>`;
    e += `<path d="${poly(ring(0.27))}" fill="${HPAL.pupil}"/>`;
    // shadow of the upper lid across the top of the eye
    const lidShadow = [
      ...upS,
      ...upS
        .slice()
        .reverse()
        .map((p) => [p[0], p[1] + W(0.32)]),
    ];
    e += `<path d="${poly(lidShadow)}" fill="${HPAL.scleraShade}" opacity="0.85"/>`;
    // highlight (fixed to the light, upper left)
    const hc = P2(add(c, mul(g, 1.2)));
    e += `<circle cx="${hc[0] - W(0.2)}" cy="${hc[1] - W(0.2)}" r="${W(0.11)}" fill="#FFFFFF"/>`;
    e += `</g>`;
    // tear duct
    const en = P2(`${s}.enCanthus`);
    e += `<circle cx="${en[0] + sx * W(0.08)}" cy="${en[1]}" r="${W(0.1)}" fill="#D99A8C"/>`;
    // ink: upper lid heavy, lower lid light, crease thin
    const upInk = up;
    e += `<path d="${ink(upInk, lw * 1.9, (t) => 0.12 + 0.88 * Math.sin(Math.PI * clamp(t * 0.88 + 0.02, 0, 1)) ** 0.6)}" fill="${HPAL.line}"/>`;
    e += `<path d="${ink(low.slice(0, 4), lw * 0.75, taperBoth)}" fill="${HPAL.line}" opacity="0.8"/>`;
    const crease = [`${s}.creaseIn`, `${s}.creasePeak`, `${s}.creaseOut`].map(P2);
    e += `<path d="${ink(crease, lw * 0.7, taperBoth)}" fill="${HPAL.skinDeep}"/>`;
    // under-eye line (age): a gentle arc below the lower lid
    const bag = [
      add(L[`${s}.lidLowIn`], [sx * 0.2, -0.5, 0]),
      add(L[`${s}.lidLowLow`], [0, -0.6, 0]),
      add(L[`${s}.lidLowOut`], [sx * 0.1, -0.5, -0.1]),
    ].map(P2);
    e += `<path d="${ink(bag, lw * 0.5, taperBoth)}" fill="${HPAL.skinDeep}" opacity="0.5"/>`;
    return e;
  }

  // -------------------------------------------------------------- brows
  for (const s of ["r", "l"]) {
    const sx = s === "l" ? 1 : -1;
    if (facing([sx * 0.5, 0.2, 1]) < -0.1) continue;
    const pts = [`${s}.browIn`, `${s}.browMid`, `${s}.browPeak`, `${s}.browTail`].map(P2);
    const prof = (t) => (t < 0.12 ? 0.75 + 2 * t : 1 - 0.8 * ((t - 0.12) / 0.88) ** 1.3);
    svg += `<path d="${ink(pts, W(0.74), prof)}" fill="${HPAL.hair}"/>`;
    svg += `<path d="${ink(
      pts.map((p) => [p[0], p[1] - W(0.08)]),
      W(0.22),
      prof,
    )}" fill="${HPAL.hairShade}" opacity="0.7"/>`;
  }

  // -------------------------------------------------------------- nose
  const turned = Math.abs(cam.yaw + (pose.turn ?? 0)) > 12;
  {
    // shadow on the nose's far side and under it
    const sh = [
      [0.35, -1.2, 10.15],
      [0.32, -3.0, 10.9],
      [0.25, -3.95, 11.45],
      L["l.nostril"],
      L["l.subalare"],
      L["l.alare"],
      L["l.alarTop"],
      [1.2, -2.6, 9.8],
      [0.85, -1.4, 9.85],
    ].map(P2);
    svg += `<path d="${smooth(sh)}" fill="${HPAL.skinShade}"/>`;
    const under = [
      L["r.subalare"],
      L["r.nostril"],
      [0, -4.75, 11.0],
      L["l.nostril"],
      L["l.subalare"],
      add(L["l.subalare"], [-0.3, -0.35, -0.2]),
      [0, -5.45, 9.95],
      add(L["r.subalare"], [0.3, -0.35, -0.2]),
    ].map(P2);
    svg += `<path d="${smooth(under)}" fill="${HPAL.skinDeep}" opacity="0.8"/>`;
    // the bridge line on the shadow side, wings, nostrils, tip
    if (!turned)
      svg += `<path d="${ink([[0.7, -1.2, 9.95], [0.95, -2.5, 10.0], L["l.alarTop"]].map(P2), lw * 0.8, taperStart)}" fill="${HPAL.line}"/>`;
    for (const s of ["r", "l"]) {
      const sx = s === "l" ? 1 : -1;
      if (facing([sx, -0.2, 0.6]) > 0.15)
        svg += `<path d="${ink([`${s}.alarTop`, `${s}.alare`, `${s}.subalare`].map(P2), lw * 1.05, taperBoth)}" fill="${HPAL.line}"/>`;
      const no = [
        L[`${s}.subalare`],
        add(L[`${s}.nostril`], [sx * 0.15, 0.05, -0.1]),
        L[`${s}.nostril`],
        add(L[`${s}.subalare`], [-sx * 0.25, -0.12, 0.1]),
      ].map(P2);
      svg += `<path d="${smooth(no)}" fill="${HPAL.mouth}"/>`;
    }
    if (turned) {
      // the bridge seen against the far cheek
      const prof = [[0, -1.3, 10.15], "rhinion", "supratip", "tip", "tipLow"].map(P2);
      svg += `<path d="${ink(prof, lw * 1.1, (t) => 0.1 + 0.9 * t ** 0.8)}" fill="${HPAL.line}"/>`;
    } else {
      svg += `<path d="${ink([L["r.nostril"], [0, -4.62, 11.15], L["l.nostril"]].map(P2), lw * 0.9, taperBoth)}" fill="${HPAL.line}"/>`;
    }
  }

  // -------------------------------------------------------------- mouth, lower lip, mustache
  {
    const jaw = expr.jaw ?? 0;
    const lip = (k, d) => add(L[k], d);
    const lowerLip = [
      L["r.cheilion"],
      mix3(L["r.cheilion"], L.stomion, 0.55, [0, -0.06, 0.35]),
      add(L.stomion, [0, -0.02, 0]),
      mix3(L["l.cheilion"], L.stomion, 0.55, [0, -0.06, 0.35]),
      L["l.cheilion"],
      lip("l.lowerLip", [-0.15, -0.42, -0.1]),
      lip("labInf", [0, -0.48, -0.12]),
      lip("r.lowerLip", [0.15, -0.42, -0.1]),
    ].map(P2);
    svg += `<path d="${smooth(lowerLip)}" fill="${HPAL.lip}"/>`;
    svg += `<path d="${smooth([lip("l.lowerLip", [0.1, -0.25, -0.1]), lip("labInf", [0, -0.46, -0.12]), lip("l.lowerLip", [-0.15, -0.42, -0.1])].map(P2))}" fill="${HPAL.lipShade}" opacity="0.7"/>`;
    svg += `<path d="${ink([lip("r.lowerLip", [0.35, -0.12, 0.05]), lip("labInf", [-0.2, -0.15, 0.05])].map(P2), lw * 0.8, taperBoth)}" fill="#E7B3A3" opacity="0.8"/>`;
    const openAmt =
      jaw + 0.35 * Math.max(0, Math.min(expr.smile ?? 0, (expr.L?.smile ?? 0) + (expr.smile ?? 0)) - 0.5);
    if (openAmt > 0.12) {
      const open = [
        L["r.cheilion"],
        add(L["r.upperLip"], [0, -0.25, 0]),
        add(L.labSup, [0, -0.25, 0]),
        add(L["l.upperLip"], [0, -0.25, 0]),
        L["l.cheilion"],
        add(L["l.lowerLip"], [0, 0.35, 0]),
        add(L.stomion, [0, -0.55 * jaw, 0]),
        add(L["r.lowerLip"], [0, 0.35, 0]),
      ].map(P2);
      svg += `<path d="${smooth(open)}" fill="${HPAL.mouth}"/>`;
      const cidm = id("m");
      svg += `<clipPath id="${cidm}"><path d="${smooth(open)}"/></clipPath><g clip-path="url(#${cidm})">`;
      const teeth = [
        add(L["r.upperLip"], [0.1, -0.2, -0.1]),
        add(L.labSup, [0, -0.2, -0.1]),
        add(L["l.upperLip"], [-0.1, -0.2, -0.1]),
        add(L["l.upperLip"], [-0.1, -0.75, -0.2]),
        add(L.labSup, [0, -0.82, -0.2]),
        add(L["r.upperLip"], [0.1, -0.75, -0.2]),
      ].map(P2);
      svg += `<path d="${smooth(teeth)}" fill="${HPAL.teeth}"/>`;
      const tongue = [
        add(L["r.lowerLip"], [0.2, 0.2, -0.3]),
        add(L.labInf, [0, 0.55, -0.4]),
        add(L["l.lowerLip"], [-0.2, 0.2, -0.3]),
        add(L.labInf, [0, -0.2, -0.3]),
      ].map(P2);
      svg += `<path d="${smooth(tongue)}" fill="${HPAL.tongue}"/></g>`;
      svg += `<path d="${smooth(open)}" fill="none" stroke="${HPAL.line}" stroke-width="${lw}"/>`;
    } else {
      const ml = [
        L["r.cheilion"],
        mix3(L["r.cheilion"], L.stomion, 0.5, [0, -0.08, 0.4]),
        L.stomion,
        mix3(L["l.cheilion"], L.stomion, 0.5, [0, -0.08, 0.4]),
        L["l.cheilion"],
      ].map(P2);
      svg += `<path d="${ink(ml, lw * 1.35, taperBoth)}" fill="${HPAL.line}"/>`;
    }
    // mustache, over the upper lip, joined to the beard at the corners
    const mu = [
      add(L["r.cheilion"], [-0.35, -0.75, -0.25]),
      add(L["r.alare"], [-0.35, -0.75, -0.2]),
      add(L["r.subalare"], [0.1, -0.35, 0.05]),
      add(L.subnasale, [0, -0.22, 0.25]),
      add(L["l.subalare"], [-0.1, -0.35, 0.05]),
      add(L["l.alare"], [0.35, -0.75, -0.2]),
      add(L["l.cheilion"], [0.35, -0.75, -0.25]),
      add(L["l.cheilion"], [0.05, -0.05, 0.1]),
      add(L["l.upperLip"], [0, -0.32, 0.2]),
      add(L.labSup, [0, -0.45, 0.25]),
      add(L["r.upperLip"], [0, -0.32, 0.2]),
      add(L["r.cheilion"], [-0.05, -0.05, 0.1]),
    ].map(P2);
    svg += `<path d="${smooth(mu)}" fill="${blend(HPAL.beard, HPAL.beardShade, 0.4)}"/>`;
    // a few hairs in the mustache
    for (let k = 0; k < 7; k++) {
      const t = (k + 0.5) / 7;
      const x = lerp(-2.0, 2.0, t);
      const a = [x * 0.85, -5.35, 10.0 - Math.abs(x) * 0.35],
        b = [x * 1.05, -6.05, 10.1 - Math.abs(x) * 0.4];
      svg += `<path d="${ink([a, b].map(P2), lw * 0.55, taperEnd)}" fill="${HPAL.beardShade}"/>`;
    }
  }

  // -------------------------------------------------------------- the jaw under the beard (structure)
  for (const s of ["r", "l"]) {
    const sx = s === "l" ? 1 : -1;
    const f = facing([sx * 0.8, -0.5, 0.3]);
    if (f < 0.1) continue;
    const jl = [
      add(L[`${s}.jawAngle`], [0, 0.6, -0.3]),
      L[`${s}.jawAngle`],
      L[`${s}.jawMid`],
      L[`${s}.chinSide`],
    ].map(P2);
    svg += `<path d="${ink(jl, lw * 1.1, taperBoth)}" fill="${HPAL.beardShade}" opacity="${Math.min(1, f * 1.4)}"/>`;
  }
  // -------------------------------------------------------------- face lines (age, structure)
  for (const s of ["r", "l"]) {
    const sx = s === "l" ? 1 : -1;
    if (facing([sx * 0.6, 0, 0.8]) < 0.35) continue;
    // nasolabial, mostly hidden in the beard: only its top
    svg += `<path d="${ink([add(L[`${s}.alarTop`], [sx * 0.35, 0.1, -0.2]), add(L[`${s}.nasolabial`], [0, 0.5, 0]), L[`${s}.nasolabial`]].map(P2), lw * 0.75, taperBoth)}" fill="${HPAL.skinDeep}"/>`;
  }
  // forehead lines: faint at rest, deeper when the brows go up; curved up in the middle for worry
  const ev = (k) => Math.max(expr[k] ?? 0, ((expr.L?.[k] ?? 0) + (expr.R?.[k] ?? 0)) / 2 + (expr[k] ?? 0));
  const up = Math.max(ev("browUp"), ev("browInner"));
  for (const [y, w] of [
    [3.4, 2.6],
    [4.3, 2.2],
    [5.1, 1.6],
  ]) {
    if (y > 5 && up < 0.4) continue;
    const curve = 0.35 * ev("browInner") - 0.1 * ev("browUp");
    const pts = [-w, -w / 2, 0, w / 2, w].map((x) => [
      x,
      y + 0.3 * up + curve * Math.cos((x / w) * 1.4),
      9.0 - 0.06 * x * x,
    ]);
    svg += `<path d="${ink(pts.map(P2), lw * (0.5 + 0.4 * up), taperBoth)}" fill="${HPAL.skinDeep}" opacity="${0.4 + 0.5 * up}"/>`;
  }
  // frown lines between the brows
  if (ev("browDown") > 0.3) {
    for (const sx of [-1, 1]) {
      const pts = [
        [sx * 0.45, 1.0, 9.6],
        [sx * 0.55, 2.3, 9.5],
      ];
      svg += `<path d="${ink(pts.map(P2), lw * 0.9, taperBoth)}" fill="${HPAL.skinDeep}" opacity="${Math.min(1, ev("browDown"))}"/>`;
    }
  }
  // smiling: the cheek lifts (a crease under the eye) and the nose-to-mouth line deepens
  for (const s of ["r", "l"]) {
    const sx = s === "l" ? 1 : -1;
    const sm =
      (expr.smile ?? 0) +
      (expr[s === "l" ? "L" : "R"]?.smile ?? 0) +
      0.5 * ((expr.squint ?? 0) + (expr[s === "l" ? "L" : "R"]?.squint ?? 0));
    if (sm < 0.25 || facing([sx * 0.5, 0, 0.85]) < 0.05) continue;
    const ll = L[`${s}.lidLowLow`];
    const cr = [
      add(ll, [-sx * 0.6, -0.55, 0.05]),
      add(ll, [sx * 0.2, -0.75, 0]),
      add(ll, [sx * 1.1, -0.55, -0.4]),
    ];
    svg += `<path d="${ink(cr.map(P2), lw * 0.75, taperBoth)}" fill="${HPAL.skinDeep}" opacity="${Math.min(1, sm)}"/>`;
    const nl = [
      add(L[`${s}.alarTop`], [sx * 0.35, 0.05, -0.2]),
      add(L[`${s}.nasolabial`], [sx * 0.1, 0.3, 0]),
      add(L[`${s}.cheilion`], [sx * 0.45, 0.25, 0]),
    ];
    svg += `<path d="${ink(nl.map(P2), lw * 1.0, taperBoth)}" fill="${HPAL.beardShade}" opacity="${Math.min(1, sm)}"/>`;
    if (sm > 0.6) {
      const ex = L[`${s}.exCanthus`];
      for (const dy of [0.25, -0.2, -0.6])
        svg += `<path d="${ink([add(ex, [sx * 0.45, dy * 0.6, -0.35]), add(ex, [sx * 1.05, dy * 1.2, -0.95])].map(P2), lw * 0.5, taperBoth)}" fill="${HPAL.skinDeep}" opacity="0.7"/>`;
    }
  }

  svg += `</g>`;
  // -------------------------------------------------------------- hair
  const hairVal = (r, j) => {
    const lp = r.lpts[j],
      lc = r.local;
    const a = angleOf(lp, lc);
    return hairline(a) - lp[1];
  };
  const hairPolys = region(hairT, cam, hairVal, { vis: 0.04, minArea: W(0.6) ** 2 });
  const hairD = hairPolys.map((p) => smooth(thin(p, 1.8))).join(" ");
  svg += `<path d="${hairD}" fill="${HPAL.line}" stroke="${HPAL.line}" stroke-width="${lw * 2}" stroke-linejoin="round"/>`;
  svg += `<path d="${hairD}" fill="${HPAL.hair}"/>`;
  const hc = id("hr");
  svg += `<clipPath id="${hc}"><path d="${hairD}"/></clipPath><g clip-path="url(#${hc})">`;
  // sheen on the lit side of the hair: a lighter shape where the hair faces the key light
  for (const p of region(hairT, cam, (r, j, nc) => Math.max(0.72 - dot(nc, LIGHT), hairVal(r, j) + 0.8), {
    vis: 0.1,
    minArea: W(0.5) ** 2,
  }))
    svg += `<path d="${smooth(thin(p, 2))}" fill="${HPAL.hairHi}" stroke="${HPAL.hairHi}" stroke-width="1.2"/>`;
  for (const p of shadows(hairT, cam, LIGHT, 0.18, { vis: 0.04, minArea: W(0.4) ** 2 }))
    svg += `<path d="${smooth(thin(p, 2))}" fill="${HPAL.hairShade}" stroke="${HPAL.hairShade}" stroke-width="1.2"/>`;
  // flow strokes: from the part (his right) over the top toward his left and back
  const strokes = [];
  for (let k = 0; k < 9; k++) {
    const y0 = 6.6 + k * 0.62;
    strokes.push({
      pts: [
        [-32, y0],
        [-12, y0 + 2.6],
        [18, y0 + 3.1 - k * 0.12],
        [52, y0 + 1.6 - k * 0.2],
        [84, y0 - 1.0 - k * 0.3],
      ],
      w: 0.9,
      col: HPAL.hairShade,
    });
  }
  for (let k = 0; k < 6; k++) {
    const y0 = 7.0 + k * 0.7;
    strokes.push({
      pts: [
        [-36, y0 + 0.4],
        [-52, y0 - 0.6],
        [-70, y0 - 2.4],
        [-84, y0 - 4.2],
      ],
      w: 0.8,
      col: HPAL.hairShade,
    });
  }
  for (let k = 0; k < 5; k++) {
    const y0 = 9.4 + k * 0.45;
    strokes.push({
      pts: [
        [-26 + k * 3, y0],
        [-6 + k * 3, y0 + 1.6],
        [20 + k * 2, y0 + 1.6],
      ],
      w: 1.1,
      col: HPAL.hairHi,
    });
  }
  // a little grey: at the temples, combed back, and a few on top
  for (let k = 0; k < 9; k++) {
    const a = 60 + k * 5.5,
      y = 4.6 - (k % 3) * 0.5;
    strokes.push({
      pts: [
        [a, y],
        [a + 7, y - 0.9],
        [a + 14, y - 1.6],
      ],
      w: 0.75,
      col: HPAL.greyHi,
    });
    strokes.push({
      pts: [
        [-a, y],
        [-a - 7, y - 0.9],
        [-a - 14, y - 1.6],
      ],
      w: 0.75,
      col: HPAL.greyHi,
    });
  }
  for (const [a, y] of [
    [-8, 9.6],
    [14, 10.2],
    [34, 9.4],
    [-20, 8.6],
  ]) {
    strokes.push({
      pts: [
        [a, y],
        [a + 12, y + 0.9],
        [a + 26, y + 0.6],
      ],
      w: 0.55,
      col: HPAL.greyHi,
    });
  }
  for (const st of strokes) {
    const pts = st.pts.map(([a, y]) => cam.P(onTube(hairT, y, a)));
    svg += `<path d="${ink(
      pts.map((p) => p.slice(0, 2)),
      lw * st.w,
      taperBoth,
    )}" fill="${st.col}" opacity="0.9"/>`;
  }
  // the part line
  svg += `<path d="${ink(
    [
      [-34, 7.2],
      [-35, 8.8],
      [-30, 10.4],
    ].map(([a, y]) => cam.P(onTube(hairT, y, a)).slice(0, 2)),
    lw * 1.0,
    taperBoth,
  )}" fill="${HPAL.line}"/>`;
  svg += `</g>`;

  return { svg, head, toW, L };

  function mix3(a, b, t, d) {
    return add(lerp3(a, b, t), d);
  }
}

/** The beard's cheek line, in the same terms as head.mjs (degrees from the front). */
function cheekLineOf(a) {
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

function beardEdge(cam, toW, head, lw, facing) {
  let out = "";
  for (let a = -100; a <= 100; a += 3.2) {
    if (Math.abs(a) < 24) continue;
    const y = cheekLineOf(a);
    const p = onTube(head, y + 0.15, a);
    const q = onTube(head, y - 0.35, a + (a > 0 ? 1.0 : -1.0));
    const n = sub(p, toW([0, y, 0]));
    if (cam.dir(n)[2] < 0.05) continue;
    out += `<path d="${ink([cam.P(q).slice(0, 2), cam.P(p).slice(0, 2)], lw * 0.7, taperEnd)}" fill="${HPAL.beard}" opacity="0.8"/>`;
  }
  return out;
}

export { sectionRadius };

/** Shadow shapes an artist would design: under the brow by the nose, under the cheekbone, under the lower lip. */
function designedShadows(P2, L, facing) {
  let out = "";
  // the eye socket by the bridge of the nose, on the shadow side only
  const s = "l";
  if (facing([0.5, 0, 0.85]) >= 0) {
    const socket = [
      add(L["l.browIn"], [0.1, -0.45, -0.25]),
      add(L["l.enCanthus"], [0.05, 0.3, 0.05]),
      add(L["l.enCanthus"], [-0.3, -0.25, 0.25]),
      [0.62, -0.9, 9.7],
      [0.55, 0.2, 9.4],
    ];
    out += `<path d="${smooth(socket.map(P2))}" fill="${HPAL.skinShade}" opacity="0.75"/>`;
  }
  return out + (s ? "" : "");
}
