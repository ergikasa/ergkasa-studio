/**
 * Character v4 RIG prototype: the painted head, driven. A copy of ../head.mjs (the approved v4 paint) in which
 * the silhouette, the shadow side, the eyes (gaze, lids) and the mouth (opening, teeth, tongue) come from the
 * rig. ../head.mjs stays the untouched reference. Not production code.
 *
 * Original notes:
 *
 * Construction: every feature sits on projected 3D landmarks (model.mjs). The look is built in named layers,
 * each one a separately animatable group:
 *   skin base → colour zones → form light → designed shadow shapes → occlusion → highlights → texture →
 *   features (eyes, brows, nose, mouth) → line work.
 * Shadows are designed shapes with a crisp edge on bone (temple, cheekbone, nose) and a soft edge on rounded
 * flesh (cheek), the way a 2D key artist paints planes. Hair, brows, lashes, stubble and iris fibres are
 * generated strokes (seeded: every render is the same picture).
 *
 * Lighting: a warm key from the upper left, in front of the face (short lighting: the broad, near side falls
 * into shadow, with a Rembrandt triangle of light on the shadow cheek), a cool rim from behind on the right.
 */
import { smooth, sample, taper, rng, f, lerp } from "../lib.mjs";

export const PAL = {
  skin: "#E2AA88",
  skinHi: "#F5D2B6",
  spec: "#FFF1E4",
  shade: "#A8644E",
  terminator: "#B85A44",
  shadeDeep: "#6A3428",
  bounce: "#BD7C61",
  blood: "#CB6556",
  lip: "#B4675A",
  line: "#3A1C14",
  hair: "#1E1714",
  iris: "#5A3C24",
  irisIn: "#94703D",
  irisDark: "#1F140D",
  rim: "#BCD5EE",
};

// ------------------------------------------------------------------------------------------------ helpers

const blurDef = (id, sd) =>
  `<filter id="${id}" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="${sd}"/></filter>`;

export const BLURS = [
  ["b05", 0.5],
  ["b1", 1],
  ["b2", 2],
  ["b3", 3],
  ["b4", 4],
  ["b6", 6],
  ["b10", 10],
  ["b16", 16],
  ["b24", 24],
  ["b40", 40],
];

export function soft(H, list, fill, opacity, blur, k) {
  const fl = blur ? ` filter="url(#${blur})"` : "";
  return `<path d="${H.path(list, true, k)}" fill="${fill}" opacity="${opacity}"${fl}/>`;
}

export function line(H, list, stroke, width, opacity = 1, blur = "") {
  const fl = blur ? ` filter="url(#${blur})"` : "";
  return `<path d="${H.path(list, false)}" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" opacity="${opacity}"${fl}/>`;
}

/** A brush line: a filled stroke that swells in the middle and tapers at both ends (line-art weight). */
export function brush(H, list, w, color = PAL.line, opacity = 0.9, blur = "b05", shape = [0.15, 1, 0.15]) {
  const pts = sample(H.pts(list), 28);
  const n = pts.length;
  const L = [],
    R = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)],
      b = pts[Math.min(n - 1, i + 1)];
    const dx = b[0] - a[0],
      dy = b[1] - a[1],
      l = Math.hypot(dx, dy) || 1;
    const t = i / (n - 1);
    const s = t < 0.5 ? lerp(shape[0], shape[1], t / 0.5) : lerp(shape[1], shape[2], (t - 0.5) / 0.5);
    const ww = (w * Math.sin(Math.PI * 0.5 * Math.min(1, s * 1.6))) / 2;
    L.push([pts[i][0] - (dy / l) * ww, pts[i][1] + (dx / l) * ww]);
    R.push([pts[i][0] + (dy / l) * ww, pts[i][1] - (dx / l) * ww]);
  }
  return `<path d="${smooth([...L, ...R.reverse()], true, 0.12)}" fill="${color}" opacity="${opacity}" filter="url(#${blur})"/>`;
}

/** A stroke of varying width along points, thickest near the end (`w0` at the start, `w1` near the end). */
function taperVar(pts, w0, w1) {
  const n = pts.length;
  const L = [],
    Rr = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)],
      b = pts[Math.min(n - 1, i + 1)];
    const dx = b[0] - a[0],
      dy = b[1] - a[1],
      l = Math.hypot(dx, dy) || 1;
    const t = i / (n - 1);
    const w = (t < 0.85 ? lerp(w0, w1, t / 0.85) : lerp(w1, 0.6, (t - 0.85) / 0.15)) / 2;
    L.push([pts[i][0] - (dy / l) * w, pts[i][1] + (dx / l) * w - w * 0.6]);
    Rr.push([pts[i][0] + (dy / l) * w, pts[i][1] - (dx / l) * w - w * 0.6]);
  }
  const ring = [...L, ...Rr.reverse()];
  return "M" + ring.map((p) => `${f(p[0])} ${f(p[1])}`).join(" L") + "Z";
}

// ------------------------------------------------------------------------------------------------ outlines

/** The skin silhouette at this view (the production rig derives it from the model; here it is authored). */
export function skinOutline() {
  return [
    [668, 512],
    [648, 572],
    [636, 636],
    [631, 690],
    [631, 728],
    [633, 760],
    [634, 790],
    [637, 812],
    [629, 836],
    [621, 864],
    [620, 894],
    [624, 928],
    [632, 966],
    [638, 1006],
    [642, 1046],
    [648, 1092],
    [658, 1140],
    [674, 1184],
    [697, 1221],
    [728, 1247],
    [770, 1261],
    [815, 1262],
    [860, 1252],
    [905, 1236],
    [960, 1206],
    [1015, 1163],
    [1056, 1122],
    [1076, 1094],
    [1090, 1050],
    [1104, 1006],
    [1132, 976],
    [1172, 936],
    [1200, 856],
    [1210, 760],
    [1200, 650],
    [1172, 545],
    [1110, 455],
    [990, 395],
    [850, 405],
    [740, 458],
  ];
}

const NECK = [
  [740, 1150],
  [766, 1262],
  [760, 1340],
  [748, 1410],
  [700, 1480],
  [1290, 1480],
  [1214, 1400],
  [1184, 1310],
  [1166, 1180],
  [1156, 1000],
  [1100, 1000],
];

// ------------------------------------------------------------------------------------------------ eye

function eye(H, s, R, look) {
  const { P, S, Q } = H;
  const near = s === "n";
  const dir = near ? 1 : -1; // outward, in picture space
  const open = [
    `${s}.enCanthus`,
    `${s}.lidUpIn`,
    `${s}.lidUpPeak`,
    `${s}.lidUpOut`,
    `${s}.exCanthus`,
    `${s}.lidLowOut`,
    `${s}.lidLowLow`,
    `${s}.lidLowIn`,
  ];
  const id = `eye${s}`;
  const out = [];
  const defs = [];
  const openD = H.path(open, true, 0.19);
  defs.push(`<clipPath id="${id}"><path d="${openD}"/></clipPath>`);

  // the upper lid: skin between the lash line and the crease, a convex shape that catches the key on top
  const lid = [
    `${s}.enCanthus`,
    H.off(`${s}.creaseIn`, [0, -0.04, 0]),
    `${s}.creasePeak`,
    `${s}.creaseOut`,
    `${s}.exCanthus`,
    `${s}.lidUpOut`,
    `${s}.lidUpPeak`,
    `${s}.lidUpIn`,
  ];
  out.push(soft(H, lid, near ? "#B9785F" : "#CC8C6E", 0.75, "b2"));
  out.push(
    soft(
      H,
      [
        H.at(`${s}.lidUpIn`, `${s}.creaseIn`, 0.45),
        H.at(`${s}.lidUpPeak`, `${s}.creasePeak`, 0.55),
        H.at(`${s}.lidUpOut`, `${s}.creaseOut`, 0.4),
        H.at(`${s}.lidUpPeak`, `${s}.creasePeak`, 0.25),
      ],
      PAL.skinHi,
      near ? 0.3 : 0.55,
      "b3",
    ),
  );

  // the eyeball: sclera, darker into the corners and under the lid, never paper white
  const g = `scl${s}`;
  const [ex, ey] = P(`${s}.eyeC`);
  defs.push(
    `<radialGradient id="${g}" cx="${f(ex - dir * 4)}" cy="${f(ey + 5)}" r="${f(1.75 * S)}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${near ? "#D8C7B9" : "#E0D0C2"}"/><stop offset=".55" stop-color="#C2A999"/><stop offset="1" stop-color="#8E6253"/></radialGradient>`,
  );
  const inner = [`<path d="${openD}" fill="url(#${g})"/>`];

  // iris: a disc on the front of the eyeball, turned by the gaze. Its projection is an ellipse squashed along
  // the direction the eye points (foreshortening): a sideways look reads as a turned eye, not a slid circle.
  const ir = 0.64 * S;
  const gz = H.gaze?.[s] ?? { c: [ex, ey], ang: 0, k: 1 };
  const cx = gz.c[0],
    cy = gz.c[1];
  void look;
  const ig = `iris${s}`;
  defs.push(
    `<radialGradient id="${ig}" cx="0" cy="0" r="${f(ir)}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#B08A4C"/><stop offset=".34" stop-color="${PAL.irisIn}"/><stop offset=".62" stop-color="${PAL.iris}"/><stop offset=".86" stop-color="#3B2616"/><stop offset="1" stop-color="${PAL.irisDark}"/></radialGradient>`,
  );
  const disc = [`<circle cx="0" cy="0" r="${f(ir)}" fill="url(#${ig})"/>`];
  let fib = "";
  for (let i = 0; i < 80; i++) {
    const a = (i / 80) * Math.PI * 2 + R.range(-0.04, 0.04);
    const r0 = ir * R.range(0.34, 0.42),
      r1 = ir * R.range(0.68, 0.95);
    const bend = R.range(-0.09, 0.09);
    fib += `M${f(Math.cos(a) * r0)} ${f(Math.sin(a) * r0)} Q${f(Math.cos(a + bend) * (r0 + r1) * 0.5)} ${f(Math.sin(a + bend) * (r0 + r1) * 0.5)} ${f(Math.cos(a) * r1)} ${f(Math.sin(a) * r1)} `;
  }
  disc.push(`<path d="${fib}" stroke="#CDA466" stroke-width="0.9" fill="none" opacity=".42"/>`);
  let fib2 = "";
  for (let i = 0; i < 46; i++) {
    const a = R.range(0, Math.PI * 2);
    const r0 = ir * R.range(0.45, 0.62),
      r1 = ir * R.range(0.76, 0.97);
    fib2 += `M${f(Math.cos(a) * r0)} ${f(Math.sin(a) * r0)} L${f(Math.cos(a) * r1)} ${f(Math.sin(a) * r1)} `;
  }
  disc.push(`<path d="${fib2}" stroke="#2A1A10" stroke-width="1.1" fill="none" opacity=".32"/>`);
  disc.push(
    `<circle cx="0" cy="0" r="${f(ir * 0.5)}" fill="none" stroke="#8A8648" stroke-width="${f(ir * 0.16)}" opacity=".22"/>`,
    `<circle cx="0" cy="0" r="${f(ir * 0.43)}" fill="none" stroke="#6A4826" stroke-width="1.6" opacity=".5"/>`,
    `<circle cx="0" cy="0" r="${f(ir * 0.96)}" fill="none" stroke="#1A100B" stroke-width="${f(ir * 0.1)}" opacity=".55"/>`,
    `<circle cx="0" cy="0" r="${f(ir * 0.32 * (H.pupil ?? 1))}" fill="#0C0806"/>`,
  );
  const deg = (gz.ang * 180) / Math.PI;
  inner.push(
    `<g transform="translate(${f(cx)} ${f(cy)}) rotate(${f(deg)}) scale(${f(Math.max(0.3, gz.k))} 1) rotate(${f(-deg)})">${disc.join("")}</g>`,
  );
  // the upper lid and lashes shade the top of the eyeball; the lower lid's rim catches a little light
  inner.push(
    `<path d="${H.path([`${s}.enCanthus`, `${s}.lidUpIn`, `${s}.lidUpPeak`, `${s}.lidUpOut`, `${s}.exCanthus`, H.off(`${s}.lidUpOut`, [0, -0.42, 0]), H.off(`${s}.lidUpPeak`, [0, -0.5, 0]), H.off(`${s}.lidUpIn`, [0, -0.4, 0])], true)}" fill="#2E1A12" opacity=".72" filter="url(#b3)"/>`,
  );
  // corners: the sclera turns away and reddens
  const exc = P(`${s}.exCanthus`),
    enc = P(`${s}.enCanthus`);
  inner.push(
    `<circle cx="${f(exc[0])}" cy="${f(exc[1])}" r="${f(0.55 * S)}" fill="#8A5A4C" opacity=".6" filter="url(#b4)"/>`,
    `<circle cx="${f(enc[0])}" cy="${f(enc[1])}" r="${f(0.42 * S)}" fill="#A05E54" opacity=".55" filter="url(#b4)"/>`,
    `<ellipse cx="${f(enc[0] + dir * 0.11 * S)}" cy="${f(enc[1])}" rx="${f(0.1 * S)}" ry="${f(0.07 * S)}" fill="#B46F66" opacity=".8" filter="url(#b1)"/>`,
  );
  // catchlights: the key (a soft window shape, upper left), a faint fill reflection low on the right
  inner.push(
    `<path d="M${f(cx - ir * 0.52)} ${f(cy - ir * 0.34)} q${f(ir * 0.13)} ${f(-ir * 0.09)} ${f(ir * 0.27)} ${f(-ir * 0.02)} l${f(-ir * 0.04)} ${f(ir * 0.22)} q${f(-ir * 0.12)} ${f(-ir * 0.04)} ${f(-ir * 0.24)} ${f(ir * 0.02)}z" fill="#FFF6EC" opacity="${f(0.92 * (gz.open ?? 1))}"/>`,
    `<ellipse cx="${f(cx + ir * 0.44)}" cy="${f(cy + ir * 0.4)}" rx="${f(ir * 0.09)}" ry="${f(ir * 0.05)}" fill="#E8EEF5" opacity=".45"/>`,
  );
  out.push(`<g clip-path="url(#${id})">${inner.join("")}</g>`);

  // lower lid: the wet rim, the lid's own ledge, then a soft shadow where the lid meets the cheek
  out.push(
    line(H, [`${s}.lidLowIn`, `${s}.lidLowLow`, `${s}.lidLowOut`, `${s}.exCanthus`], "#E9B6A4", 2.4, 0.8),
    line(
      H,
      [
        H.off(`${s}.lidLowIn`, [0, -0.12, 0]),
        H.off(`${s}.lidLowLow`, [0, -0.13, 0]),
        H.off(`${s}.lidLowOut`, [0, -0.1, 0]),
      ],
      "#7C4434",
      1.7,
      0.55,
      "b1",
    ),
    line(
      H,
      [
        H.off(`${s}.lidLowIn`, [0, -0.3, 0]),
        H.off(`${s}.lidLowLow`, [0, -0.34, 0]),
        H.off(`${s}.lidLowOut`, [0, -0.26, 0]),
      ],
      PAL.skinHi,
      3,
      near ? 0.25 : 0.4,
      "b2",
    ),
  );
  // upper lash line: dense, darkest at the outer half; individual lashes sweep up and out
  const lashLine = sample(
    H.pts([`${s}.enCanthus`, `${s}.lidUpIn`, `${s}.lidUpPeak`, `${s}.lidUpOut`, `${s}.exCanthus`]),
    26,
  );
  out.push(`<path d="${taperVar(lashLine, near ? 1.6 : 1.3, near ? 4.6 : 3.8)}" fill="#1E120D"/>`);
  let lash = "";
  for (let i = 8; i < lashLine.length - 1; i += 1) {
    if (R() < 0.45) continue;
    const t = i / (lashLine.length - 1);
    const [x, y] = lashLine[i];
    const len = lerp(2.5, 6.5, t) * R.range(0.7, 1.1);
    const deg = near ? lerp(-100, -32, t) : lerp(-80, -148, t);
    const a = (deg * Math.PI) / 180;
    const dx = Math.cos(a) * len,
      dy = Math.sin(a) * len;
    lash += taper(
      [
        [x, y - 1.5],
        [x + dx * 0.5, y - 1.5 + dy * 0.62],
        [x + dx + dir * 1.2, y - 1.5 + dy * 0.9],
      ],
      1.6,
      0.25,
    );
  }
  out.push(`<path d="${lash}" fill="#1E120D" opacity=".6"/>`);
  let llash = "";
  const lowLine = sample(H.pts([`${s}.lidLowIn`, `${s}.lidLowLow`, `${s}.lidLowOut`, `${s}.exCanthus`]), 16);
  for (let i = 5; i < lowLine.length - 1; i += 2) {
    const [x, y] = lowLine[i];
    const len = R.range(2, 3.8);
    llash += taper(
      [
        [x, y + 1.2],
        [x + dir * len * 0.35, y + 1.2 + len],
      ],
      0.9,
      0.1,
    );
  }
  out.push(`<path d="${llash}" fill="#3A2419" opacity=".32"/>`);
  // the crease (a hooded lid) and the fold of skin above it catching the key
  out.push(line(H, [`${s}.creaseIn`, `${s}.creasePeak`, `${s}.creaseOut`], "#5E3024", 2.3, 0.6, "b1"));
  out.push(
    line(
      H,
      [
        H.off(`${s}.creaseIn`, [0, 0.14, 0]),
        H.off(`${s}.creasePeak`, [0, 0.17, 0]),
        H.off(`${s}.creaseOut`, [0, 0.12, 0]),
      ],
      PAL.skinHi,
      3,
      near ? 0.2 : 0.42,
      "b2",
    ),
  );
  // the inner corner: the deep notch toward the bridge of the nose
  out.push(
    line(
      H,
      [
        H.off(`${s}.enCanthus`, [dir * 0.05, 0.25, 0]),
        H.off(`${s}.enCanthus`, [-dir * 0.18, 0.02, 0]),
        H.off(`${s}.enCanthus`, [dir * 0.02, -0.18, 0]),
      ],
      "#5E3024",
      1.8,
      0.5,
      "b1",
    ),
  );
  // under-eye: the lid–cheek junction, the soft bag, a few crow's feet at the outer corner
  out.push(line(H, [`${s}.bagIn`, `${s}.bagLow`, `${s}.bagOut`], "#7F4A3C", 2.6, near ? 0.4 : 0.32, "b2"));
  out.push(
    line(
      H,
      [
        H.at(`${s}.lidLowIn`, `${s}.bagIn`, 0.55),
        H.at(`${s}.lidLowLow`, `${s}.bagLow`, 0.5),
        H.at(`${s}.lidLowOut`, `${s}.bagOut`, 0.5),
      ],
      PAL.skinHi,
      4,
      near ? 0.16 : 0.32,
      "b3",
    ),
  );
  let crow = "";
  for (const [a, l] of [
    [-0.4, 0.7],
    [0.05, 0.85],
    [0.45, 0.65],
  ]) {
    const x0 = exc[0] + dir * 0.34 * S,
      y0 = exc[1] + a * 0.25 * S;
    crow += `M${f(x0)} ${f(y0)} q${f(dir * l * 0.5 * S)} ${f(a * 0.2 * S)} ${f(dir * l * S)} ${f(a * 0.55 * S)} `;
  }
  out.push(
    `<path d="${crow}" stroke="#7A4637" stroke-width="1.4" fill="none" opacity="${near ? 0.28 : 0.32}" filter="url(#b1)"/>`,
  );
  void Q;
  return { defs: defs.join(""), svg: out.join("") };
}

// ------------------------------------------------------------------------------------------------ brows

function brow(H, s, R) {
  const near = s === "n";
  const low = H.pts([
    `${s}.browIn`,
    H.at(`${s}.browIn`, `${s}.browPeak`, 0.5),
    `${s}.browPeak`,
    `${s}.browTail`,
  ]);
  const top = H.pts([
    H.off(`${s}.browInTop`, [0, 0.08, 0]),
    H.off(H.at(`${s}.browIn`, `${s}.browPeak`, 0.5), [0, 0.66, 0]),
    H.off(`${s}.browPeak`, [0, 0.46, 0]),
    H.off(`${s}.browTail`, [0, 0.14, 0]),
  ]);
  const lo = sample(low, 40),
    hi = sample(top, 40);
  const region = [...lo, ...hi.slice().reverse()];
  const base = `<path d="${smooth(region, true)}" fill="#3B2A22" opacity=".42" filter="url(#b2)"/>`;
  let strokes = "",
    light = "",
    grey = "";
  const n = 300;
  for (let i = 0; i < n; i++) {
    const t = Math.pow(R(), 0.9);
    const j = Math.min(39, Math.floor(t * 40));
    const u = R.range(0.02, 0.98);
    const p = [lerp(lo[j][0], hi[j][0], u), lerp(lo[j][1], hi[j][1], u)];
    // hairs grow up at the head of the brow, then lie along it toward the tail, converging at the middle
    const along = [
      lo[Math.min(39, j + 2)][0] - lo[Math.max(0, j - 2)][0],
      lo[Math.min(39, j + 2)][1] - lo[Math.max(0, j - 2)][1],
    ];
    const la = Math.hypot(...along) || 1;
    const dirA = [along[0] / la, along[1] / la];
    const k = Math.min(1, t * 3.4);
    const conv = (u - 0.5) * 0.5;
    const d = [lerp(dirA[0] * 0.25, dirA[0], k), lerp(-1, dirA[1] - conv, k)];
    const dl = Math.hypot(...d);
    const len = R.range(10, 20) * (near ? 1 : 0.85) * (t > 0.85 ? 0.7 : 1);
    const e = [p[0] + (d[0] / dl) * len, p[1] + (d[1] / dl) * len];
    const m = [lerp(p[0], e[0], 0.5) + R.range(-1.5, 1.5), lerp(p[1], e[1], 0.5) + R.range(-1.5, 1.5)];
    const pathS = taper([p, m, e], R.range(1.3, 2.2), 0.2);
    const r = R();
    if (r < 0.04) grey += pathS;
    else if (r < 0.16 || t < 0.12) light += pathS;
    else strokes += pathS;
  }
  return `<g id="brow-${s}">${base}<path d="${strokes}" fill="#21160F" opacity=".88"/><path d="${light}" fill="#4E392C" opacity=".75"/><path d="${grey}" fill="#9C948C" opacity=".6"/></g>`;
}

// ------------------------------------------------------------------------------------------------ ear

/**
 * The ear is designed once in its own flat frame (front edge at x=0, top at y=0, 100 × 170) and placed with an
 * affine transform from three anchors (tragus, top, back of the helix), so it turns with the head.
 */
const EAR = {
  outline: [
    [18, 44],
    [24, 18],
    [44, 3],
    [68, 4],
    [88, 20],
    [99, 50],
    [98, 86],
    [91, 113],
    [79, 134],
    [71, 152],
    [58, 167],
    [42, 170],
    [29, 161],
    [23, 145],
    [21, 128],
    [8, 112],
    [7, 92],
    [12, 70],
  ],
  scapha: [
    [27, 34],
    [46, 15],
    [68, 16],
    [84, 32],
    [90, 58],
    [88, 92],
    [80, 116],
    [69, 134],
  ],
  antihelix: [
    [64, 132],
    [74, 106],
    [77, 78],
    [70, 54],
    [56, 38],
    [40, 32],
  ],
  inferiorCrus: [
    [70, 58],
    [55, 54],
    [36, 52],
  ],
  concha: [
    [34, 58],
    [56, 62],
    [66, 82],
    [65, 108],
    [56, 124],
    [38, 126],
    [26, 112],
    [27, 80],
  ],
  tragus: [
    [10, 90],
    [24, 96],
    [26, 110],
    [14, 116],
  ],
  antitragus: [
    [42, 130],
    [55, 128],
    [60, 138],
    [48, 142],
  ],
};

function earTransform(H) {
  // anchors: tragus (14, 100), top of the helix (46, 3), back of the helix (99, 60)
  const A = [
    [14, 100],
    [46, 3],
    [99, 60],
  ];
  const B = [H.Q("n.tragus", -4, 2), H.Q("n.earTop", -6, -2), H.Q("n.earBack", -2, 4)];
  // solve B = M·A + t
  const [a1, a2, a3] = A,
    [b1, b2, b3] = B;
  const det = (a2[0] - a1[0]) * (a3[1] - a1[1]) - (a3[0] - a1[0]) * (a2[1] - a1[1]);
  const m = (k) => {
    const d2 = b2[k] - b1[k],
      d3 = b3[k] - b1[k];
    const p = (d2 * (a3[1] - a1[1]) - d3 * (a2[1] - a1[1])) / det;
    const q = ((a2[0] - a1[0]) * d3 - (a3[0] - a1[0]) * d2) / det;
    return [p, q, b1[k] - p * a1[0] - q * a1[1]];
  };
  const X = m(0),
    Y = m(1);
  return (p) => [X[0] * p[0] + X[1] * p[1] + X[2], Y[0] * p[0] + Y[1] * p[1] + Y[2]];
}

function ear(H) {
  const T = earTransform(H);
  const E = (list) => list.map(T);
  const p = (list, closed = true) => smooth(E(list), closed);
  const defs = `<clipPath id="hdEar"><path d="${p(EAR.outline)}"/></clipPath>`;
  const g = [];
  g.push(`<path d="${p(EAR.outline)}" fill="#B36F57"/>`);
  g.push(`<g clip-path="url(#hdEar)">`);
  // the ear is on the shadow side: warm translucency through the rim, a cool rim light on the back edge
  g.push(
    `<path d="${p([
      [60, 10],
      [98, 40],
      [96, 110],
      [70, 160],
      [80, 100],
      [80, 50],
    ])}" fill="${PAL.blood}" opacity=".45" filter="url(#b6)"/>`,
  );
  g.push(
    `<path d="${p(EAR.scapha, false)}" fill="none" stroke="#5E2E22" stroke-width="7" opacity=".6" filter="url(#b2)"/>`,
  );
  g.push(
    `<path d="${p(EAR.antihelix, false)}" fill="none" stroke="#C88C72" stroke-width="10" opacity=".6" filter="url(#b3)"/>`,
  );
  g.push(
    `<path d="${p(EAR.inferiorCrus, false)}" fill="none" stroke="#C88C72" stroke-width="6" opacity=".45" filter="url(#b2)"/>`,
  );
  g.push(`<path d="${p(EAR.concha)}" fill="#4A2219" opacity=".85" filter="url(#b2)"/>`);
  g.push(
    `<path d="${p([
      [30, 70],
      [50, 72],
      [56, 90],
      [48, 100],
      [32, 96],
    ])}" fill="#6E3326" opacity=".6" filter="url(#b4)"/>`,
  );
  g.push(
    `<circle cx="${f(T([28, 102])[0])}" cy="${f(T([28, 102])[1])}" r="5" fill="#1E0C08" opacity=".8" filter="url(#b2)"/>`,
  );
  g.push(`<path d="${p(EAR.tragus)}" fill="#BE7D63" opacity=".95" filter="url(#b1)"/>`);
  g.push(`<path d="${p(EAR.antitragus)}" fill="#BE7D63" opacity=".8" filter="url(#b1)"/>`);
  g.push(
    `<path d="${p([
      [30, 140],
      [56, 146],
      [60, 164],
      [40, 168],
      [28, 156],
    ])}" fill="#C27F66" opacity=".6" filter="url(#b4)"/>`,
  );
  g.push(
    `<path d="${p(
      [
        [88, 22],
        [99, 50],
        [98, 86],
        [91, 113],
        [79, 134],
      ],
      false,
    )}" fill="none" stroke="${PAL.rim}" stroke-width="4" opacity=".75" filter="url(#b1)"/>`,
  );
  g.push(`</g>`);
  // line work
  const lw = (list, w, o, closed = false) =>
    `<path d="${p(list, closed)}" fill="none" stroke="${PAL.line}" stroke-width="${w}" stroke-linecap="round" opacity="${o}" filter="url(#b05)"/>`;
  g.push(lw(EAR.outline.slice(0, 15), 2.6, 0.75));
  g.push(lw(EAR.scapha, 1.6, 0.55));
  g.push(lw(EAR.antihelix.slice(0, 4), 1.4, 0.35));
  g.push(
    lw(
      [
        [34, 58],
        [56, 62],
        [66, 82],
        [65, 108],
        [56, 124],
      ],
      1.6,
      0.5,
    ),
  );
  g.push(
    lw(
      [
        [12, 92],
        [24, 97],
        [26, 110],
      ],
      1.5,
      0.55,
    ),
  );
  return { defs, svg: `<g id="ear">${g.join("")}</g>` };
}

// ------------------------------------------------------------------------------------------------ head

export function svgHead(H, opts = {}) {
  const { P, path, S, Q } = H;
  const R = rng(opts.seed ?? 7);
  const defs = [];
  const look = opts.look ?? [0, 0];
  const skinPts = skinOutline();
  const skinList = opts.skinPaths ?? [smooth(skinPts, true)];
  const skin = skinList[0];
  defs.push(`<clipPath id="hdSkin">${skinList.map((d) => `<path d="${d}"/>`).join("")}</clipPath>`);
  for (const [id, sd] of BLURS) defs.push(blurDef(id, sd));
  defs.push(
    `<filter id="pores" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.62" numOctaves="2" seed="11"/><feColorMatrix type="matrix" values="0 0 0 0 0.33  0 0 0 0 0.17  0 0 0 0 0.12  0 0 0 -0.36 0.195"/></filter>`,
    `<filter id="mottle" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="3" seed="4"/><feColorMatrix type="matrix" values="0 0 0 0 0.78  0 0 0 0 0.36  0 0 0 0 0.3  0 0 0 -0.54 0.315"/></filter>`,
  );

  // ---- neck (behind the head)
  const neck = smooth(NECK, true);
  defs.push(`<clipPath id="hdNeck"><path d="${neck}"/></clipPath>`);
  const nk = [`<path d="${neck}" fill="${PAL.skin}"/>`, `<g clip-path="url(#hdNeck)">`];
  nk.push(
    // under the head the neck is in shadow: the key is above and in front, the jaw and beard block it
    soft(
      H,
      [
        [740, 1200],
        [1300, 1100],
        [1300, 1500],
        [700, 1500],
      ],
      "#93543F",
      1,
      "b10",
    ),
    // light reaches the lower front and far side of the neck, below the beard's shadow
    soft(
      H,
      [
        [752, 1380],
        [800, 1370],
        [860, 1400],
        [890, 1450],
        [860, 1490],
        [760, 1490],
        [745, 1440],
      ],
      PAL.skin,
      0.45,
      "b16",
    ),
    soft(
      H,
      [
        [756, 1390],
        [796, 1384],
        [830, 1430],
        [796, 1476],
        [752, 1460],
      ],
      PAL.skinHi,
      0.25,
      "b10",
    ),
    // the sternocleidomastoid: a ridge from behind the ear to the pit of the neck, catching bounce light
    line(
      H,
      [
        [1110, 1210],
        [1050, 1290],
        [980, 1370],
        [910, 1450],
      ],
      "#A86A52",
      18,
      0.35,
      "b10",
    ),
    soft(
      H,
      [
        [1060, 1180],
        [1300, 1100],
        [1300, 1500],
        [1150, 1500],
        [1100, 1340],
      ],
      PAL.shadeDeep,
      0.5,
      "b16",
    ),
    // larynx
    soft(
      H,
      [
        [815, 1330],
        [846, 1328],
        [848, 1360],
        [818, 1364],
      ],
      "#B87A5E",
      0.45,
      "b4",
    ),
    line(
      H,
      [
        [815, 1362],
        [830, 1370],
        [850, 1362],
      ],
      PAL.shadeDeep,
      4,
      0.35,
      "b2",
    ),
    // the beard's cast shadow: a band that follows the beard's neckline, crisp at the top
    soft(
      H,
      [
        [740, 1230],
        [778, 1282],
        [826, 1286],
        [876, 1280],
        [932, 1262],
        [996, 1232],
        [1050, 1192],
        [1092, 1137],
        [1118, 1072],
        [1170, 1000],
        [1200, 1100],
        [1150, 1200],
        [1080, 1270],
        [1000, 1320],
        [920, 1366],
        [840, 1372],
        [770, 1362],
      ],
      "#552A20",
      0.85,
      "b6",
    ),
    soft(
      H,
      [
        [760, 1300],
        [840, 1330],
        [940, 1320],
        [1050, 1270],
        [1130, 1200],
        [1150, 1260],
        [1040, 1340],
        [900, 1390],
        [780, 1380],
      ],
      PAL.shade,
      0.6,
      "b16",
    ),
    // cool rim down the back of the neck
    line(
      H,
      [
        [1166, 1090],
        [1172, 1180],
        [1182, 1290],
        [1210, 1400],
      ],
      PAL.rim,
      6,
      0.45,
      "b3",
    ),
    `</g>`,
    brush(
      H,
      [
        [768, 1280],
        [764, 1340],
        [756, 1400],
        [746, 1440],
      ],
      2.6,
      PAL.line,
      0.5,
    ),
  );
  const neckSvg = `<g id="neck">${nk.join("")}</g>`;

  // ---- the face: colour zones, light, shadow shapes, occlusion, highlights, texture
  const F = [];
  F.push(`<rect x="600" y="370" width="640" height="920" filter="url(#mottle)"/>`);
  // colour zones: a warmer, yellower forehead; red through the middle of the face (nose, cheeks, ears)
  F.push(
    soft(
      H,
      [
        [640, 520],
        [1000, 500],
        [1010, 700],
        [640, 730],
      ],
      "#E8B88F",
      0.45,
      "b24",
    ),
  );
  F.push(
    soft(
      H,
      [
        [640, 880],
        [760, 860],
        [900, 900],
        [980, 960],
        [900, 1040],
        [760, 1000],
        [650, 990],
      ],
      PAL.blood,
      0.22,
      "b24",
    ),
  );
  F.push(
    `<circle cx="${f(Q("tip")[0] + 4)}" cy="${f(Q("tip")[1] + 4)}" r="${f(0.6 * S)}" fill="${PAL.blood}" opacity=".32" filter="url(#b6)"/>`,
  );

  // form light inside the lit side: the forehead turns back toward the hair, the far cheek turns away at the edge
  F.push(
    soft(
      H,
      [
        [640, 520],
        [980, 470],
        [1000, 560],
        [820, 600],
        [660, 640],
      ],
      "#B97A5E",
      0.35,
      "b24",
    ),
  );
  if (opts.edgeTurn) F.push(opts.edgeTurn);

  // THE SHADOW SIDE: computed by the rig from the light and the proxy (headrig.mjs)
  if (opts.shadow) F.push(opts.shadow);

  // the eye sockets: the brow ridge shades the orbit from the key above; the near socket is deeper
  for (const s of ["f", "n"]) {
    const near = s === "n";
    const o = near ? 1 : -1;
    F.push(
      soft(
        H,
        [
          H.off(`${s}.browIn`, [0, -0.45, -0.4]),
          H.off(`${s}.browPeak`, [0, -0.55, -0.3]),
          H.off(`${s}.browTail`, [0, -0.5, 0]),
          H.off(`${s}.exCanthus`, [o * 0.45, 0, 0]),
          H.off(`${s}.bagOut`, [0, -0.1, 0]),
          H.off(`${s}.bagLow`, [0, -0.1, 0]),
          `${s}.bagIn`,
          H.off(`${s}.enCanthus`, [-o * 0.55, 0.2, 0]),
        ],
        near ? "#8F5544" : "#A86C56",
        near ? 0.62 : 0.42,
        "b6",
      ),
    );
    F.push(
      soft(
        H,
        [
          H.off(`${s}.enCanthus`, [-o * 0.2, 0.75, 0.2]),
          H.off(`${s}.enCanthus`, [-o * 0.75, 0.2, 0.6]),
          H.off(`${s}.enCanthus`, [-o * 0.35, -0.5, 0.3]),
          H.off(`${s}.enCanthus`, [o * 0.25, 0.05, 0]),
        ],
        "#5E3024",
        near ? 0.62 : 0.45,
        "b4",
      ),
    );
  }

  // the nose: its near side plane, the shadow under the tip, and its cast shadow on the near cheek. The cast
  // shadow and the cheek shadow frame a triangle of light under the near eye (Rembrandt lighting).
  F.push(
    soft(
      H,
      [
        [0.3, 0.6, 8.9],
        [0.42, -1.2, 10.05],
        [0.5, -3.0, 10.9],
        [0.62, -3.8, 11.2],
        [1.25, -3.4, 9.95],
        [1.55, -2.0, 9.25],
        [1.35, -0.2, 8.7],
      ],
      PAL.shade,
      0.85,
      "b2",
    ),
  );
  const cast = [
    [1.15, -3.25, 9.9],
    [1.9, -3.6, 9.4],
    [2.25, -4.2, 9.2],
    [2.85, -4.75, 8.95],
    [3.3, -5.3, 8.7],
    [3.8, -5.75, 8.2],
    [3.25, -6.1, 8.7],
    [2.5, -5.85, 9.0],
    [1.6, -5.2, 9.3],
    [1.0, -4.7, 9.6],
  ];
  F.push(soft(H, cast, PAL.shade, 0.92, "b2"));
  F.push(soft(H, cast, PAL.shadeDeep, 0.25, "b4"));
  F.push(
    soft(
      H,
      [
        [-0.95, -4.35, 10.5],
        [0.95, -4.35, 10.5],
        [1.05, -4.95, 9.85],
        [0, -5.2, 9.9],
        [-0.95, -4.95, 9.85],
      ],
      PAL.shadeDeep,
      0.6,
      "b3",
    ),
  );
  // the far side of the nose: the bridge edge against the far cheek is lit; a thin occlusion where they meet
  F.push(
    line(
      H,
      [
        [-0.62, 0.3, 8.8],
        [-0.7, -1.4, 9.8],
        [-0.82, -3.0, 10.6],
      ],
      "#B87256",
      4,
      0.3,
      "b2",
    ),
  );

  // lit planes: forehead, brow ridge, bridge, tip, the far cheekbone, the top of the near cheekbone
  F.push(
    soft(
      H,
      [
        [-4.8, 6.6, 6.4],
        [-0.5, 7.0, 8.2],
        [1.8, 5.2, 9.0],
        [1.2, 3.0, 9.4],
        [-1.5, 2.6, 9.4],
        [-4.6, 3.4, 7.2],
      ],
      PAL.skinHi,
      0.5,
      "b24",
    ),
  );
  F.push(
    soft(
      H,
      [
        [-4.3, 2.0, 7.8],
        [-2.6, 2.45, 8.9],
        [-0.6, 2.0, 9.6],
        [-0.9, 1.45, 9.5],
        [-3.0, 1.75, 8.6],
        [-4.4, 1.55, 7.4],
      ],
      PAL.skinHi,
      0.45,
      "b4",
    ),
  );
  F.push(
    soft(
      H,
      [
        [0.5, 2.0, 9.6],
        [2.6, 2.4, 8.9],
        [3.6, 2.2, 8.4],
        [2.8, 1.7, 8.9],
        [0.7, 1.5, 9.5],
      ],
      PAL.skinHi,
      0.3,
      "b4",
    ),
  );
  F.push(
    soft(
      H,
      [
        [-0.3, 0.3, 9.0],
        [-0.1, -1.3, 10.05],
        [-0.18, -3.0, 11.0],
        [-0.5, -3.0, 10.9],
        [-0.52, -1.3, 9.9],
        [-0.55, 0.3, 8.9],
      ],
      PAL.skinHi,
      0.5,
      "b3",
    ),
  );
  F.push(
    `<circle cx="${f(Q("tip", -6, -5)[0])}" cy="${f(Q("tip", -6, -5)[1])}" r="${f(0.28 * S)}" fill="${PAL.skinHi}" opacity=".8" filter="url(#b3)"/>`,
  );
  F.push(
    `<circle cx="${f(Q("tip", -8, -7)[0])}" cy="${f(Q("tip", -8, -7)[1])}" r="${f(0.09 * S)}" fill="${PAL.spec}" opacity=".9" filter="url(#b1)"/>`,
  );
  F.push(
    soft(
      H,
      [
        [-6.3, -0.4, 5.0],
        [-4.4, -0.9, 7.6],
        [-3.5, -2.5, 8.2],
        [-4.6, -3.3, 7.6],
        [-6.1, -2.5, 5.6],
      ],
      PAL.skinHi,
      0.5,
      "b6",
    ),
  );
  F.push(
    soft(
      H,
      [
        [3.0, -1.25, 8.35],
        [4.2, -1.45, 7.9],
        [4.4, -2.2, 7.65],
        [3.3, -2.3, 8.2],
      ],
      PAL.skinHi,
      0.4,
      "b4",
    ),
  );
  // the Rembrandt triangle reads as a little warmer and brighter than the rest of the lit skin
  F.push(
    soft(
      H,
      [
        [2.4, -1.4, 8.6],
        [4.5, -1.5, 7.7],
        [3.4, -3.9, 8.7],
        [2.3, -3.0, 9.2],
      ],
      "#EDBD9A",
      0.45,
      "b6",
    ),
  );
  // the far cheek hollow under the cheekbone, and the far temple
  F.push(
    soft(
      H,
      [
        [640, 940],
        [690, 950],
        [705, 1010],
        [690, 1060],
        [650, 1060],
      ],
      PAL.shade,
      0.3,
      "b10",
    ),
  );
  F.push(
    soft(
      H,
      [
        [632, 690],
        [668, 700],
        [662, 760],
        [632, 760],
      ],
      PAL.shade,
      0.26,
      "b10",
    ),
  );
  // forehead lines (two, faint), the vertical lines between the brows (a man in his forties)
  for (const [y, w, o] of [
    [4.3, 3.2, 0.22],
    [5.05, 3.8, 0.17],
  ]) {
    const a = [
      [-w, y + 0.2, 8.4 - w * 0.25],
      [-w * 0.4, y - 0.05, 9.1],
      [w * 0.3, y + 0.08, 9.0],
      [w, y - 0.1, 8.4 - w * 0.2],
    ];
    F.push(line(H, a, "#8C5643", 2.4, o, "b2"));
    F.push(
      line(
        H,
        a.map((q) => [q[0], q[1] - 0.13, q[2]]),
        PAL.skinHi,
        2.4,
        o * 1.2,
        "b2",
      ),
    );
  }
  F.push(
    line(
      H,
      [
        [-0.5, 1.55, 9.5],
        [-0.42, 2.3, 9.45],
      ],
      "#8C5643",
      1.8,
      0.32,
      "b1",
    ),
  );
  F.push(
    line(
      H,
      [
        [0.58, 1.5, 9.45],
        [0.52, 2.2, 9.4],
      ],
      "#8C5643",
      1.8,
      0.28,
      "b1",
    ),
  );
  // nasolabial folds (mostly under the beard, the top shows)
  F.push(line(H, ["n.nasolabialTop", "n.nasolabialMid", "n.nasolabialLow"], "#5E3026", 4, 0.5, "b3"));
  F.push(line(H, ["f.nasolabialTop", "f.nasolabialMid", "f.nasolabialLow"], "#8A4E3D", 3, 0.38, "b3"));
  F.push(
    line(
      H,
      [
        H.off("f.nasolabialTop", [-0.3, 0.1, -0.1]),
        H.off("f.nasolabialMid", [-0.35, 0, -0.15]),
        H.off("f.nasolabialLow", [-0.3, 0, -0.1]),
      ],
      PAL.skinHi,
      5,
      0.35,
      "b4",
    ),
  );
  // under the lower lip and the chin (under the beard, for the lip shape)
  F.push(
    soft(
      H,
      [
        [-1.15, -7.95, 9.6],
        [-0.4, -8.05, 9.75],
        [0.5, -8.05, 9.7],
        [1.25, -7.95, 9.4],
        [0.9, -8.55, 9.1],
        [0, -8.85, 9.15],
        [-0.95, -8.55, 9.1],
      ],
      PAL.shadeDeep,
      0.5,
      "b3",
    ),
  );
  // the shadow of the hair on the forehead (the forelock is above and to the left of it)
  F.push(
    soft(
      H,
      [
        [640, 560],
        [700, 600],
        [790, 598],
        [880, 600],
        [960, 605],
        [990, 560],
        [800, 540],
        [660, 520],
      ],
      "#7A4434",
      0.5,
      "b10",
    ),
  );
  F.push(`<rect x="600" y="370" width="640" height="920" filter="url(#pores)"/>`);

  // line work on the skin silhouette: traced by the rig along the computed contour
  const L = [];
  if (opts.silLines) L.push(opts.silLines);
  // nose: the underside of the tip, the near wing, a broken line down the far edge of the bridge
  L.push(
    brush(
      H,
      [
        [-0.55, -4.6, 10.7],
        [-0.1, -4.75, 11.0],
        [0.45, -4.72, 10.9],
        [0.85, -4.6, 10.45],
      ],
      1.8,
      PAL.line,
      0.45,
    ),
  );
  L.push(
    brush(
      H,
      [
        [1.6, -3.5, 9.6],
        [1.96, -3.95, 9.38],
        [1.88, -4.5, 9.3],
        [1.45, -4.8, 9.42],
      ],
      2.2,
      PAL.line,
      0.55,
    ),
  );
  L.push(
    brush(
      H,
      [
        [-1.74, -3.98, 9.5],
        [-1.84, -4.42, 9.36],
        [-1.58, -4.76, 9.3],
      ],
      1.7,
      PAL.line,
      0.32,
    ),
  );
  L.push(
    brush(
      H,
      [
        [-0.55, 0.2, 8.95],
        [-0.62, -0.9, 9.6],
        [-0.7, -1.9, 10.2],
      ],
      1.6,
      PAL.line,
      0.28,
    ),
  );
  L.push(
    brush(
      H,
      [
        [-0.72, -2.6, 10.55],
        [-0.8, -3.3, 10.95],
        [-0.72, -3.85, 11.15],
      ],
      1.8,
      PAL.line,
      0.35,
    ),
  );

  const faceSvg = `<g id="face">${skinList.map((d) => `<path d="${d}" fill="${PAL.skin}"/>`).join("")}<g clip-path="url(#hdSkin)">${F.join("")}</g><g id="face-lines">${L.join("")}</g></g>`;

  // ---- features
  const feat = [];
  for (const s of ["f", "n"]) {
    const e = eye(H, s, R, look);
    defs.push(e.defs);
    feat.push(`<g id="eye-${s}">${e.svg}</g>`);
  }
  feat.push(brow(H, "f", R), brow(H, "n", R));
  // nostrils: the near one seen from below and the side, the far one a sliver past the tip
  feat.push(
    `<g id="nose">`,
    soft(
      H,
      [
        [0.32, -4.64, 10.4],
        [0.78, -4.52, 10.12],
        [1.12, -4.64, 9.86],
        [0.92, -4.76, 9.86],
        [0.44, -4.76, 10.2],
      ],
      "#2E130C",
      0.8,
      "b1",
    ),
    soft(
      H,
      [
        [0.2, -4.6, 10.45],
        [1.2, -4.5, 9.9],
        [1.1, -4.85, 9.85],
        [0.3, -4.85, 10.3],
      ],
      "#5A2A20",
      0.35,
      "b3",
    ),
    soft(
      H,
      [
        [-0.28, -4.66, 10.4],
        [-0.58, -4.6, 10.2],
        [-0.72, -4.72, 10.0],
        [-0.42, -4.78, 10.1],
      ],
      "#3E1B14",
      0.45,
      "b1",
    ),
    soft(
      H,
      [
        [1.42, -3.55, 9.65],
        [1.72, -3.7, 9.55],
        [1.62, -4.05, 9.55],
        [1.38, -3.85, 9.65],
      ],
      PAL.skinHi,
      0.3,
      "b3",
    ),
    `</g>`,
  );
  // mouth: a man's lips, close to the skin tone; the far corner sits a little higher (asymmetry)
  const upper = [
    "f.cheilion",
    H.at("f.upperLipMid", "f.cheilion", 0.4),
    "f.upperLipMid",
    "f.bowPeak",
    "labSup",
    "n.bowPeak",
    "n.upperLipMid",
    H.at("n.upperLipMid", "n.cheilion", 0.4),
    "n.cheilion",
    "n.innerU",
    "stomionU",
    "f.innerU",
  ];
  const lower = [
    "f.cheilion",
    "f.innerL",
    "stomionL",
    "n.innerL",
    "n.cheilion",
    H.at("n.lowerLipMid", "n.cheilion", 0.45),
    "n.lowerLipMid",
    "labInf",
    "f.lowerLipMid",
    H.at("f.lowerLipMid", "f.cheilion", 0.45),
  ];
  // the mouth opening, between the inner edges of the lips: dark inside, upper and lower teeth, the tongue
  const gap = Math.hypot(P("stomionU")[0] - P("stomionL")[0], P("stomionU")[1] - P("stomionL")[1]);
  const inside = [
    "f.cheilion",
    "f.innerU",
    "stomionU",
    "n.innerU",
    "n.cheilion",
    "n.innerL",
    "stomionL",
    "f.innerL",
  ];
  const mouthInside = [];
  if (gap > 1.2) {
    defs.push(`<clipPath id="mouthIn"><path d="${path(inside, true, 0.2)}"/></clipPath>`);
    const tu = ["f.toothU", "toothU", "n.toothU"].map((k) => P(k));
    const tl = ["f.toothL", "toothL", "n.toothL"].map((k) => P(k));
    const tg = P("tongue");
    mouthInside.push(
      `<path d="${path(inside, true, 0.2)}" fill="#2A0E0B"/>`,
      `<g clip-path="url(#mouthIn)">`,
      `<ellipse cx="${f(tg[0])}" cy="${f(tg[1] + 0.25 * S)}" rx="${f(1.5 * S)}" ry="${f(0.55 * S)}" fill="#8A3A33" opacity=".85" filter="url(#b3)"/>`,
      `<path d="M${f(tu[0][0] - 0.6 * S)} ${f(tu[0][1] - 0.7 * S)} L${f(tu[2][0] + 0.6 * S)} ${f(tu[2][1] - 0.7 * S)} L${f(tu[2][0] + 0.5 * S)} ${f(tu[2][1])} Q${f(tu[1][0])} ${f(tu[1][1] + 0.12 * S)} ${f(tu[0][0] - 0.5 * S)} ${f(tu[0][1])}Z" fill="#E3D9CB"/>`,
      `<path d="M${f(tl[0][0] - 0.5 * S)} ${f(tl[0][1] + 0.6 * S)} L${f(tl[2][0] + 0.5 * S)} ${f(tl[2][1] + 0.6 * S)} L${f(tl[2][0] + 0.45 * S)} ${f(tl[2][1])} Q${f(tl[1][0])} ${f(tl[1][1] - 0.08 * S)} ${f(tl[0][0] - 0.45 * S)} ${f(tl[0][1])}Z" fill="#C9BEB0" opacity=".9"/>`,
      `<path d="${path(inside, true, 0.2)}" fill="none" stroke="#1A0705" stroke-width="${f(0.22 * S)}" opacity=".55" filter="url(#b3)"/>`,
      `</g>`,
    );
  }
  defs.push(
    `<linearGradient id="lipU" x1="0" y1="${f(P("labSup")[1])}" x2="0" y2="${f(P("stomion")[1])}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#9A5E51"/><stop offset="1" stop-color="#6C3830"/></linearGradient>`,
    `<linearGradient id="lipL" x1="0" y1="${f(P("stomion")[1])}" x2="0" y2="${f(P("labInf")[1] + 6)}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#83493E"/><stop offset=".45" stop-color="#A56A5B"/><stop offset="1" stop-color="#B27A69"/></linearGradient>`,
  );
  const lp = [...mouthInside];
  lp.push(`<path d="${path(upper, true, 0.17)}" fill="url(#lipU)" filter="url(#b1)"/>`);
  lp.push(`<path d="${path(lower, true, 0.17)}" fill="url(#lipL)" filter="url(#b1)"/>`);
  defs.push(
    `<clipPath id="lipsClip"><path d="${path(upper, true, 0.17)}"/><path d="${path(lower, true, 0.17)}"/></clipPath>`,
  );
  lp.push(
    `<g clip-path="url(#lipsClip)">`,
    // the near half of the mouth turns into the shadow side
    soft(
      H,
      [
        [1.1, -5.8, 9.8],
        [3.2, -6.4, 8.5],
        [3.2, -8.4, 8.5],
        [1.0, -8.3, 9.6],
      ],
      "#5E2D27",
      0.5,
      "b6",
    ),
    // vertical lip texture
    ...[-1.6, -1.1, -0.6, -0.1, 0.4, 0.9, 1.4].map((x) =>
      line(
        H,
        [
          [x, -7.15, 9.85],
          [x + 0.05, -7.65, 9.7],
        ],
        "#7E4036",
        1.4,
        0.3,
        "b1",
      ),
    ),
    soft(
      H,
      [
        [-1.6, -7.2, 9.6],
        [0.0, -7.3, 9.85],
        [0.35, -7.6, 9.85],
        [-1.4, -7.65, 9.6],
      ],
      "#C99282",
      0.4,
      "b3",
    ),
    `<ellipse cx="${f(P([-0.6, -7.42, 9.85])[0])}" cy="${f(P([-0.6, -7.42, 9.85])[1])}" rx="6" ry="2.4" fill="#E9C2B1" opacity=".32" filter="url(#b1)"/>`,
    `</g>`,
  );
  // the mouth line: the strongest line in the face, heaviest in the corners
  if (gap <= 1.2)
    lp.push(
      brush(
        H,
        ["f.cheilion", "f.innerU", "stomionU", "n.innerU", "n.cheilion"],
        3.2,
        "#3E1A15",
        0.9,
        "b05",
        [0.7, 0.75, 1],
      ),
    );
  else
    lp.push(
      brush(
        H,
        ["f.cheilion", "f.innerU", "stomionU", "n.innerU", "n.cheilion"],
        2.2,
        "#3E1A15",
        0.6,
        "b1",
        [0.7, 0.6, 1],
      ),
    );
  lp.push(
    soft(
      H,
      [
        H.off("n.cheilion", [-0.2, 0.18, 0]),
        H.off("n.cheilion", [0.3, 0.05, 0]),
        H.off("n.cheilion", [0, -0.3, 0]),
      ],
      "#4A1F1A",
      0.65,
      "b2",
    ),
  );
  lp.push(
    soft(
      H,
      [
        H.off("f.cheilion", [0.2, 0.18, 0]),
        H.off("f.cheilion", [-0.3, 0.12, 0]),
        H.off("f.cheilion", [0, -0.22, 0]),
      ],
      "#5A2A22",
      0.5,
      "b2",
    ),
  );
  // the lower edge of the lower lip: a soft line, lost in the middle where the light hits
  lp.push(
    brush(
      H,
      [H.at("f.lowerLipMid", "f.cheilion", 0.5), "f.lowerLipMid", H.off("labInf", [-0.3, -0.02, 0])],
      1.6,
      "#5A2A22",
      0.4,
    ),
  );
  lp.push(
    brush(
      H,
      [H.off("labInf", [0.4, 0, 0]), "n.lowerLipMid", H.at("n.lowerLipMid", "n.cheilion", 0.5)],
      1.8,
      "#4A2018",
      0.5,
    ),
  );
  feat.push(`<g id="mouth">${lp.join("")}</g>`);

  const E = ear(H);
  defs.push(E.defs);
  defs.push(`<clipPath id="beardSkin"><path d="${skin}"/><path d="${neck}"/></clipPath>`);
  const lips = [H.pts(upper), H.pts(lower), H.pts(inside)];
  return {
    defs: defs.join(""),
    neck: opts.noNeck ? "" : neckSvg,
    face: faceSvg,
    features: `<g id="features">${feat.join("")}</g>`,
    ear: E.svg,
    skin,
    skinPts,
    lips,
  };
}
