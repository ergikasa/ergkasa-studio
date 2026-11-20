/**
 * Character v4 rig prototype: the upper body. Not production code.
 *
 * A skeleton in picture space (the 2D convention of the engine): spine (pelvis → chest → neck base → skull
 * base), clavicles (shoulder lift and drop), two-bone IK arms with a chosen elbow side, and hands whose fingers
 * are joint chains blended between authored poses (rest, relaxed curl, pinch, open). The jacket, the knit and the
 * sleeves are built around the bones every frame, so a shrug lifts the collar and a reach stretches the sleeve.
 */
import { smooth, sample, taper, f, lerp, clamp } from "../lib.mjs";
import { PAL } from "./headpaint.mjs";

export const C = {
  navy: "#25314A",
  navyLit: "#3A4A69",
  navyHi: "#5A6D90",
  navyDark: "#121827",
  stitch: "#7186AA",
  knit: "#C2B49D",
  knitShade: "#8F8270",
  skin: "#DDA483",
  skinLit: "#ECB996",
  skinShade: "#A8644E",
  skinDeep: "#6A3428",
  line: "#141A28",
  rim: "#BCD5EE",
};

const P = (pts, k = 0.14) => smooth(pts, true, k);
const fill = (pts, c, o = 1, blur = "", k) =>
  `<path d="${P(pts, k)}" fill="${c}" opacity="${o}"${blur ? ` filter="url(#${blur})"` : ""}/>`;
const stroke = (pts, c, w, o = 1, blur = "", dash = "") =>
  `<path d="${smooth(pts, false)}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" opacity="${o}"${dash ? ` stroke-dasharray="${dash}"` : ""}${blur ? ` filter="url(#${blur})"` : ""}/>`;
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const mul = (a, k) => [a[0] * k, a[1] * k];
const len = (a) => Math.hypot(a[0], a[1]);

// ------------------------------------------------------------------------------------------------ IK

/**
 * Two-bone IK in the picture plane: shoulder, target, bone lengths, elbow side (+1 / -1), or a preferred
 * direction for the elbow ([dx, dy]): of the two solutions the one further along it (arms hang: elbows go down).
 */
export function ik2(a, t, l1, l2, side) {
  if (Array.isArray(side)) {
    const p = ik2(a, t, l1, l2, 1),
      q = ik2(a, t, l1, l2, -1);
    const score = (e) => e.elbow[0] * side[0] + e.elbow[1] * side[1];
    return score(p) >= score(q) ? p : q;
  }
  const d = sub(t, a);
  let D = len(d);
  const maxD = (l1 + l2) * 0.999;
  let tt = t;
  if (D > maxD) {
    tt = add(a, mul(d, maxD / D));
    D = maxD;
  }
  D = Math.max(D, Math.abs(l1 - l2) + 1);
  const cosA = clamp((l1 * l1 + D * D - l2 * l2) / (2 * l1 * D), -1, 1);
  const ang = Math.atan2(d[1], d[0]) + side * Math.acos(cosA);
  const elbow = add(a, [Math.cos(ang) * l1, Math.sin(ang) * l1]);
  return { elbow, wrist: tt };
}

/** A limb as a chain with separate widths on its two sides. */
export function limb(joints, wl, wr, k = 16) {
  const pts = sample(joints, k);
  const n = pts.length;
  const at = (ws, i) => {
    const u = (i / (n - 1)) * (ws.length - 1);
    const a = Math.floor(u),
      b = Math.min(ws.length - 1, a + 1);
    return lerp(ws[a], ws[b], u - a);
  };
  const L = [],
    R = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)],
      b = pts[Math.min(n - 1, i + 1)];
    const dx = b[0] - a[0],
      dy = b[1] - a[1],
      l = Math.hypot(dx, dy) || 1;
    const nx = -dy / l,
      ny = dx / l;
    L.push([pts[i][0] - nx * at(wl, i), pts[i][1] - ny * at(wl, i)]);
    R.push([pts[i][0] + nx * at(wr, i), pts[i][1] + ny * at(wr, i)]);
  }
  return { left: L, right: R, ring: [...L, ...R.slice().reverse()], pts };
}

// ------------------------------------------------------------------------------------------------ hands

/**
 * Hand poses in the hand's own frame: wrist at 0,0, the hand pointing +y, the thumb on −x, the back of the hand
 * toward the camera. Each finger: MCP, PIP, DIP, tip. Poses blend joint by joint.
 */
const POSES = {
  rest: {
    dorsum: [
      [-26, -4],
      [26, -4],
      [32, 22],
      [34, 58],
      [32, 90],
      [26, 106],
      [12, 114],
      [-2, 116],
      [-16, 110],
      [-28, 96],
      [-34, 62],
      [-34, 30],
      [-30, 6],
    ],
    fingers: [
      [
        [22, 98],
        [28, 134],
        [31, 156],
        [33, 170],
      ],
      [
        [12, 106],
        [15, 152],
        [17, 182],
        [18, 198],
      ],
      [
        [0, 110],
        [0, 160],
        [0, 192],
        [0, 212],
      ],
      [
        [-14, 104],
        [-20, 150],
        [-23, 180],
        [-25, 198],
      ],
    ],
    thumb: [
      [-22, 28],
      [-40, 62],
      [-52, 92],
      [-58, 116],
    ],
  },
  curl: {
    dorsum: [
      [-24, -4],
      [24, -4],
      [28, 20],
      [30, 55],
      [28, 88],
      [22, 104],
      [10, 114],
      [-4, 116],
      [-16, 110],
      [-25, 94],
      [-30, 60],
      [-30, 28],
      [-27, 6],
    ],
    fingers: [
      [
        [20, 100],
        [20, 130],
        [12, 152],
        [2, 162],
      ],
      [
        [10, 108],
        [8, 146],
        [-3, 172],
        [-15, 182],
      ],
      [
        [-1, 112],
        [-6, 154],
        [-20, 184],
        [-33, 195],
      ],
      [
        [-12, 106],
        [-18, 148],
        [-32, 176],
        [-45, 187],
      ],
    ],
    thumb: [
      [-16, 38],
      [-33, 70],
      [-42, 104],
      [-41, 132],
    ],
  },
  pinch: {
    dorsum: [
      [-24, -4],
      [24, -4],
      [28, 20],
      [30, 55],
      [28, 88],
      [22, 104],
      [10, 114],
      [-4, 116],
      [-16, 110],
      [-25, 94],
      [-30, 60],
      [-30, 28],
      [-27, 6],
    ],
    fingers: [
      [
        [22, 100],
        [23, 130],
        [16, 148],
        [8, 152],
      ],
      [
        [12, 108],
        [10, 148],
        [-1, 168],
        [-11, 170],
      ],
      [
        [1, 110],
        [-3, 156],
        [-16, 180],
        [-26, 182],
      ],
      [
        [-12, 106],
        [-20, 146],
        [-36, 160],
        [-46, 158],
      ],
    ],
    thumb: [
      [-18, 30],
      [-36, 66],
      [-44, 104],
      [-42, 140],
    ],
  },
  open: {
    dorsum: [
      [-26, -4],
      [26, -4],
      [30, 22],
      [32, 58],
      [30, 90],
      [24, 106],
      [12, 114],
      [-2, 116],
      [-16, 110],
      [-27, 94],
      [-32, 60],
      [-32, 28],
      [-28, 6],
    ],
    fingers: [
      [
        [22, 98],
        [30, 132],
        [34, 154],
        [36, 168],
      ],
      [
        [12, 106],
        [14, 154],
        [14, 184],
        [13, 200],
      ],
      [
        [0, 110],
        [-4, 160],
        [-8, 192],
        [-11, 210],
      ],
      [
        [-12, 104],
        [-24, 148],
        [-32, 176],
        [-38, 192],
      ],
    ],
    thumb: [
      [-22, 26],
      [-44, 56],
      [-60, 82],
      [-70, 102],
    ],
  },
};
const FW = [
  [16, 14, 12, 10],
  [19, 17, 15, 12],
  [20, 18, 16, 13],
  [20, 18, 16, 13],
];
const TW = [28, 21, 17, 13];

/** Blend poses: weights { rest, curl, pinch, open } (normalised). */
export function handPose(w) {
  const keys = Object.keys(POSES).filter((k) => (w[k] ?? 0) > 0);
  const tot = keys.reduce((a, k) => a + w[k], 0) || 1;
  const mix = (get) => {
    const first = get(POSES[keys[0] ?? "curl"]);
    return first.map((_, i) => {
      let x = 0,
        y = 0;
      for (const k of keys) {
        const p = get(POSES[k])[i];
        x += (p[0] * w[k]) / tot;
        y += (p[1] * w[k]) / tot;
      }
      return [x, y];
    });
  };
  if (!keys.length) return POSES.curl;
  return {
    dorsum: mix((p) => p.dorsum),
    fingers: [0, 1, 2, 3].map((i) => mix((p) => p.fingers[i])),
    thumb: mix((p) => p.thumb),
  };
}

function chainShape(joints, widths) {
  const pts = sample(joints, 12);
  const n = pts.length;
  const ws = pts.map((_, i) => {
    const u = (i / (n - 1)) * (widths.length - 1);
    const a = Math.floor(u),
      b = Math.min(widths.length - 1, a + 1);
    return lerp(widths[a], widths[b], u - a);
  });
  const L = [],
    R = [],
    nr = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)],
      b = pts[Math.min(n - 1, i + 1)];
    const dx = b[0] - a[0],
      dy = b[1] - a[1],
      l = Math.hypot(dx, dy) || 1;
    nr.push([-dy / l, dx / l]);
    L.push([pts[i][0] + (-dy / l) * ws[i] * 0.5, pts[i][1] + (dx / l) * ws[i] * 0.5]);
    R.push([pts[i][0] - (-dy / l) * ws[i] * 0.5, pts[i][1] - (dx / l) * ws[i] * 0.5]);
  }
  const last = pts[n - 1],
    prev = pts[n - 2];
  const dl = Math.hypot(last[0] - prev[0], last[1] - prev[1]) || 1;
  const tip = [
    last[0] + ((last[0] - prev[0]) / dl) * ws[n - 1] * 0.45,
    last[1] + ((last[1] - prev[1]) / dl) * ws[n - 1] * 0.45,
  ];
  const d0 = Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]) || 1;
  const base = [
    pts[0][0] - ((pts[1][0] - pts[0][0]) / d0) * ws[0] * 0.35,
    pts[0][1] - ((pts[1][1] - pts[0][1]) / d0) * ws[0] * 0.35,
  ];
  const Rr = R.slice().reverse();
  return {
    d: smooth([...L, tip, ...Rr, base], true, 0.14),
    open: smooth([...L, tip, ...Rr], false, 0.14),
    pts,
    ws,
    nr,
  };
}

/**
 * A hand at a wrist point: angle (radians, the direction the hand points), scale, foreshortening along the
 * hand, pose weights, light (0..1: how much the back of the hand faces the key). Returns svg and the pinch point.
 */
export function handSvg(id, { at, angle, scale, fy = 1, pose, lit = 0.5, mirror = false }) {
  const hp = handPose(pose);
  const defs = [];
  const g = [];
  const part = (shape, k, front) => {
    const cid = `${id}f${k}`;
    defs.push(`<clipPath id="${cid}"><path d="${shape.d}"/></clipPath>`);
    const { pts, ws, nr } = shape;
    const side = (s, frac) =>
      pts.map((p, i) => [p[0] + nr[i][0] * s * ws[i] * frac, p[1] + nr[i][1] * s * ws[i] * frac]);
    const out = [
      `<path d="${shape.d}" fill="${front ? C.skin : "#C98E6E"}"/>`,
      `<g clip-path="url(#${cid})">`,
    ];
    out.push(
      `<path d="${smooth(side(-1, 0.42), false)}" fill="none" stroke="${C.skinShade}" stroke-width="${f(ws[0] * 0.6)}" opacity=".7" filter="url(#b3)"/>`,
    );
    out.push(
      `<path d="${smooth(side(1, 0.3), false)}" fill="none" stroke="${C.skinLit}" stroke-width="${f(ws[0] * 0.35)}" opacity="${f((front ? 0.6 : 0.35) * (0.5 + lit))}" filter="url(#b2)"/>`,
    );
    for (const t of [0.36, 0.7]) {
      const i = Math.round(t * (pts.length - 1));
      const p = pts[i],
        q = nr[i];
      const w = ws[i] * 0.42;
      out.push(
        `<path d="M${f(p[0] + q[0] * w)} ${f(p[1] + q[1] * w)} Q${f(p[0] + 2)} ${f(p[1] + 3)} ${f(p[0] - q[0] * w * 0.4)} ${f(p[1] - q[1] * w * 0.4)}" fill="none" stroke="${C.skinDeep}" stroke-width="1.3" opacity=".5"/>`,
      );
    }
    out.push(`</g>`);
    out.push(`<path d="${shape.open}" fill="none" stroke="#4A2018" stroke-width="1.6" opacity=".7"/>`);
    const e = pts.length - 1;
    const a = pts[e - 2],
      b = pts[e];
    const ang = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
    const nw = ws[e] * 0.5;
    const cx = lerp(a[0], b[0], 0.72) - nr[e][0] * ws[e] * 0.12,
      cy = lerp(a[1], b[1], 0.72) - nr[e][1] * ws[e] * 0.12;
    out.push(
      `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(nw * 0.9)}" ry="${f(nw * 0.55)}" transform="rotate(${f(ang)} ${f(cx)} ${f(cy)})" fill="#E2B6A2" opacity=".85"/>`,
    );
    return out.join("");
  };
  const fingers = hp.fingers.map((j, i) => chainShape(j, FW[i]));
  for (let k = 0; k < 3; k++) g.push(part(fingers[k], k, false));
  const dors = P(hp.dorsum, 0.16);
  defs.push(`<clipPath id="${id}d"><path d="${dors}"/></clipPath>`);
  g.push(`<path d="${dors}" fill="${C.skin}"/>`, `<g clip-path="url(#${id}d)">`);
  g.push(
    fill(
      [
        [10, -10],
        [40, -10],
        [40, 120],
        [6, 120],
        [14, 50],
      ],
      C.skinShade,
      0.45 + (1 - lit) * 0.35,
      "b10",
    ),
  );
  g.push(
    fill(
      [
        [-30, 0],
        [-6, 0],
        [-4, 90],
        [-30, 90],
      ],
      C.skinLit,
      0.3 + lit * 0.35,
      "b6",
    ),
  );
  g.push(
    stroke(
      [
        [-4, 4],
        [-6, 40],
        [-10, 76],
        [-12, 98],
      ],
      "#9A6A6A",
      3,
      0.18,
      "b1",
    ),
  );
  g.push(
    stroke(
      [
        [8, 10],
        [6, 44],
        [8, 70],
        [2, 100],
      ],
      "#9A6A6A",
      2.6,
      0.15,
      "b1",
    ),
  );
  g.push(
    stroke(
      [
        [-18, 104],
        [-12, 110],
        [-4, 114],
        [4, 114],
        [12, 110],
        [20, 102],
      ],
      "#8A4E3C",
      2,
      0.35,
      "b1",
    ),
  );
  g.push(`</g>`);
  g.push(`<path d="${dors}" fill="none" stroke="#4A2018" stroke-width="1.8" opacity=".65"/>`);
  g.push(part(fingers[3], 3, true));
  g.push(part(chainShape(hp.thumb, TW), 4, true));
  g.push(
    fill(
      [
        [-26, 70],
        [-14, 96],
        [-24, 112],
        [-34, 96],
      ],
      C.skinShade,
      0.45,
      "b3",
    ),
  );
  const deg = (angle * 180) / Math.PI - 90;
  const sx = mirror ? -scale : scale;
  const T = (p) => {
    // local → picture: scale, foreshorten along y, rotate, translate
    const x = p[0] * sx,
      y = p[1] * scale * fy;
    const c = Math.cos((deg * Math.PI) / 180),
      s = Math.sin((deg * Math.PI) / 180);
    return [at[0] + x * c - y * s, at[1] + x * s + y * c];
  };
  const pinch = T([-42, 148]);
  const svg = `<g transform="translate(${f(at[0])} ${f(at[1])}) rotate(${f(deg)}) scale(${f(sx)} ${f(scale * fy)})">${g.join("")}</g>`;
  return { defs: defs.join(""), svg, pinch, T };
}

// ------------------------------------------------------------------------------------------------ torso

/**
 * The torso from the skeleton: pose { neckBase, shoulderF, shoulderN, waist, lean, breathe }. Draws the jacket
 * (two fronts, collars, yoke and stitching, chest pocket), the knit with its crew neck, and returns the anchor
 * points the arms attach to.
 */
export function torsoSvg(s) {
  const { nb, sf, sn, w } = s;
  const out = [];
  const defs = [];
  // collar line around the neck base (front-left is the throat, back-right the nape)
  const throat = add(nb, [-62, 18]),
    nape = add(nb, [104, -24]);
  const farPanel = [
    add(throat, [-14, -30]),
    add(sf, [104, -24]),
    add(sf, [10, -6]),
    add(sf, [-30, 40]),
    add(sf, [-26, 150]),
    add(w, [-292, -40]),
    add(w, [-290, 260]),
    add(w, [-30, 262]),
    add(w, [-32, 0]),
    add(throat, [-2, 200]),
    add(throat, [6, 100]),
  ];
  const nearPanel = [
    add(nape, [-10, -10]),
    add(sn, [-110, -34]),
    add(sn, [-10, -8]),
    add(sn, [44, 40]),
    add(sn, [52, 180]),
    add(w, [330, -20]),
    add(w, [336, 262]),
    add(w, [70, 266]),
    add(w, [66, 0]),
    add(throat, [96, 210]),
    add(throat, [96, 110]),
    add(nape, [-40, 34]),
  ];
  const knit = [
    add(throat, [-20, -26]),
    add(nape, [-30, -10]),
    add(throat, [100, 120]),
    add(w, [62, 270]),
    add(w, [-34, 270]),
    add(throat, [-10, 120]),
  ];
  out.push(fill(knit, C.knit));
  defs.push(`<clipPath id="tKnit"><path d="${P(knit)}"/></clipPath>`);
  out.push(`<g clip-path="url(#tKnit)">`);
  out.push(
    fill(
      [add(throat, [40, -40]), add(nape, [0, 0]), add(w, [140, 300]), add(w, [10, 300])],
      C.knitShade,
      0.7,
      "b16",
    ),
  );
  out.push(
    fill(
      [add(throat, [-40, 160]), add(throat, [140, 160]), add(w, [140, 300]), add(w, [-60, 300])],
      "#7A6E5E",
      0.45,
      "b24",
    ),
  );
  out.push(
    fill(
      [add(throat, [-30, 40]), add(throat, [30, 40]), add(throat, [30, 140]), add(throat, [-30, 140])],
      "#E9DFCC",
      0.45,
      "b16",
    ),
  );
  out.push(`</g>`);
  // crew neck rib band
  const band = [add(throat, [-24, -18]), add(throat, [30, 10]), add(nape, [-60, 20]), add(nape, [-26, -6])];
  out.push(
    stroke(band, "#D8CCB6", 16, 1),
    stroke(band, "#A39580", 16, 0.45, "", "2 3"),
    stroke(
      band.map((p) => add(p, [0, -7])),
      "#6E604E",
      2.5,
      0.6,
      "b1",
    ),
  );
  defs.push(
    `<clipPath id="tFar"><path d="${P(farPanel)}"/></clipPath>`,
    `<clipPath id="tNear"><path d="${P(nearPanel)}"/></clipPath>`,
  );
  out.push(fill(farPanel, C.navy));
  out.push(`<g clip-path="url(#tFar)">`);
  out.push(
    fill(
      [add(sf, [-40, -20]), add(sf, [140, -40]), add(w, [-40, 0]), add(w, [-300, 100])],
      C.navyLit,
      0.85,
      "b24",
    ),
  );
  out.push(
    fill(
      [add(sf, [-20, -10]), add(sf, [110, -30]), add(sf, [100, 20]), add(sf, [-10, 40])],
      C.navyHi,
      0.45,
      "b10",
    ),
  );
  out.push(
    fill(
      [add(throat, [-40, 120]), add(throat, [10, 120]), add(w, [-20, 270]), add(w, [-80, 270])],
      C.navyDark,
      0.45,
      "b16",
    ),
  );
  out.push(stroke([add(sf, [-26, 96]), add(sf, [80, 84]), add(throat, [-10, 76])], C.navyDark, 4, 0.5, "b2"));
  out.push(
    stroke([add(sf, [-26, 104]), add(sf, [80, 92]), add(throat, [-10, 84])], C.stitch, 1.5, 0.5, "", "6 5"),
  );
  out.push(`</g>`);
  out.push(
    stroke(
      [add(throat, [6, 100]), add(throat, [-2, 200]), add(w, [-32, 0]), add(w, [-30, 262])],
      C.navyDark,
      3.5,
      0.85,
    ),
  );
  out.push(fill(nearPanel, C.navy));
  out.push(`<g clip-path="url(#tNear)">`);
  out.push(
    fill(
      [add(sn, [-120, -40]), add(sn, [80, -20]), add(w, [360, 280]), add(w, [100, 280])],
      C.navyDark,
      0.6,
      "b24",
    ),
  );
  out.push(
    fill(
      [add(throat, [96, 120]), add(throat, [150, 120]), add(w, [130, 280]), add(w, [70, 280])],
      C.navyLit,
      0.4,
      "b16",
    ),
  );
  out.push(stroke([add(throat, [100, 64]), add(sn, [-60, 70]), add(sn, [40, 80])], C.navyDark, 4, 0.5, "b2"));
  out.push(
    stroke([add(throat, [100, 72]), add(sn, [-60, 78]), add(sn, [40, 88])], "#4E6088", 1.5, 0.45, "", "6 5"),
  );
  // chest pocket on the near front
  const pk = [
    add(throat, [130, 170]),
    add(throat, [250, 160]),
    add(throat, [254, 300]),
    add(throat, [134, 306]),
  ];
  out.push(fill(pk, "#2A3654", 0.75, "", 0.04));
  out.push(
    `<path d="${P(pk, 0.04)}" fill="none" stroke="#4E6088" stroke-width="1.5" stroke-dasharray="6 5" opacity=".5"/>`,
  );
  out.push(`</g>`);
  out.push(
    stroke(
      [add(throat, [96, 110]), add(throat, [96, 210]), add(w, [66, 0]), add(w, [70, 266])],
      "#0B0F18",
      3.5,
      0.85,
    ),
  );
  // collars, turned down over the fronts
  const farCollar = [
    add(throat, [-20, -36]),
    add(throat, [0, -6]),
    add(throat, [14, 56]),
    add(throat, [10, 118]),
    add(throat, [-28, 92]),
    add(throat, [-70, 36]),
    add(throat, [-84, 0]),
    add(throat, [-56, -28]),
  ];
  const nearCollar = [
    add(nape, [-24, -40]),
    add(nape, [24, -30]),
    add(nape, [38, 4]),
    add(nape, [0, 52]),
    add(throat, [104, 132]),
    add(throat, [92, 74]),
    add(nape, [-58, 18]),
  ];
  for (const [col, base, hi] of [
    [farCollar, "#30405F", C.navyHi],
    [nearCollar, "#1F2840", "#33415E"],
  ]) {
    out.push(
      `<path d="${P(col, 0.1)}" fill="#05070C" opacity=".5" transform="translate(4 8)" filter="url(#b4)"/>`,
    );
    out.push(fill(col, base, 1, "", 0.1));
    out.push(fill(col.slice(0, 4), hi, 0.4, "b6", 0.1));
    out.push(`<path d="${P(col, 0.1)}" fill="none" stroke="#0B0F18" stroke-width="2.2" opacity=".7"/>`);
  }
  out.push(stroke([add(nape, [-20, -44]), add(nape, [40, -30]), add(nape, [60, 10])], C.rim, 3, 0.45, "b1"));
  out.push(stroke([add(sn, [-110, -34]), add(sn, [-10, -8]), add(sn, [44, 40])], C.rim, 6, 0.35, "b3"));
  out.push(
    stroke(
      [add(sf, [104, -24]), add(sf, [10, -6]), add(sf, [-30, 40]), add(sf, [-26, 150])],
      C.line,
      2.6,
      0.7,
    ),
  );
  return { defs: defs.join(""), svg: `<g id="torso">${out.join("")}</g>` };
}

// ------------------------------------------------------------------------------------------------ arms

/** A sleeve from shoulder to wrist (through the IK elbow), with the knit cuff peeking out. */
export function sleeveSvg(id, { shoulder, elbow, wrist, near, light = 0.5 }) {
  const lb = limb([shoulder, elbow, wrist], [74, 80, 76, 58], [80, 86, 78, 60], 18);
  const ring = lb.ring;
  const out = [];
  const defs = [`<clipPath id="${id}"><path d="${P(ring)}"/></clipPath>`];
  out.push(
    `<path d="${P(ring)}" fill="#05070C" opacity=".35" transform="translate(-8 10)" filter="url(#b10)"/>`,
  );
  out.push(fill(ring, C.navy));
  out.push(`<g clip-path="url(#${id})">`);
  // lit on the side toward the key (the left of the picture), dark on the right, folds inside the elbow
  out.push(
    `<path d="${smooth(lb.left, false)}" fill="none" stroke="${C.navyLit}" stroke-width="70" opacity="${f(0.35 + light * 0.4)}" filter="url(#b16)"/>`,
  );
  out.push(
    `<path d="${smooth(lb.right, false)}" fill="none" stroke="${C.navyDark}" stroke-width="80" opacity="${near ? 0.7 : 0.5}" filter="url(#b16)"/>`,
  );
  const e = elbow;
  const u = mul(sub(wrist, elbow), 1 / (len(sub(wrist, elbow)) || 1));
  const v = [-u[1], u[0]];
  for (const [o, s] of [
    [12, 1],
    [34, 0.8],
    [-14, 0.7],
  ]) {
    const p0 = add(e, add(mul(u, o), mul(v, -40 * s))),
      p1 = add(e, add(mul(u, o + 8), mul(v, 30 * s)));
    out.push(
      `<path d="${taper([p0, mul(add(p0, p1), 0.5), p1], 8, 1)}" fill="${C.navyDark}" opacity=".55" filter="url(#b2)"/>`,
    );
  }
  if (near)
    out.push(
      `<path d="${smooth(lb.right.slice(0, -2), false)}" fill="none" stroke="${C.rim}" stroke-width="7" opacity=".35" filter="url(#b4)"/>`,
    );
  out.push(`</g>`);
  out.push(`<path d="${P(ring)}" fill="none" stroke="${C.line}" stroke-width="2.4" opacity=".65"/>`);
  // cuff and the knit sleeve under it
  const cl = lb.left[lb.left.length - 1],
    cr = lb.right[lb.right.length - 1];
  const inward = mul(u, 12);
  out.push(fill([cl, cr, add(cr, mul(inward, -1.6)), add(cl, mul(inward, -1.6))], "#1E2840"));
  out.push(
    fill(
      [
        add(cl, mul(sub(cr, cl), 0.12)),
        add(cr, mul(sub(cl, cr), 0.12)),
        add(add(cr, mul(sub(cl, cr), 0.14)), mul(u, 16)),
        add(add(cl, mul(sub(cr, cl), 0.14)), mul(u, 16)),
      ],
      C.knit,
    ),
  );
  return { defs: defs.join(""), svg: out.join("") };
}

/** The neck from the torso's neck base up to the skull base, shaded under the jaw. */
export function neckSvg({ nb, top, beardBottom }) {
  const out = [];
  const lft = [add(nb, [-64, 20]), add(top, [-80, 40]), add(top, [-70, -60])];
  const rgt = [add(top, [100, -80]), add(top, [110, 30]), add(nb, [120, -10])];
  const ring = [...lft, ...rgt];
  out.push(fill(ring, PAL.skin));
  out.push(`<g clip-path="url(#neckClip)">`);
  out.push(
    fill(
      [add(top, [-10, -80]), add(top, [140, -80]), add(nb, [160, 40]), add(nb, [10, 40])],
      "#93543F",
      0.95,
      "b10",
    ),
  );
  if (beardBottom?.length)
    out.push(
      `<path d="${P(beardBottom)}" fill="#552A20" opacity=".8" transform="translate(4 26)" filter="url(#b10)"/>`,
    );
  out.push(
    fill(
      [add(nb, [-60, -30]), add(nb, [10, -40]), add(nb, [20, 30]), add(nb, [-60, 30])],
      PAL.skin,
      0.5,
      "b10",
    ),
  );
  out.push(`</g>`);
  return {
    defs: `<clipPath id="neckClip"><path d="${P(ring)}"/></clipPath>`,
    svg: `<g id="neck">${out.join("")}</g>`,
  };
}
