/**
 * Character v4 prototype: the full-body design (approval piece for the artistic direction). Not production code.
 *
 * Daniel Vos, 44. 7.6 heads tall, standing in a relaxed contrapposto: weight on the far leg, the near knee
 * eased forward, the near shoulder a touch higher than the far one. The far hand is in the jacket's hip pocket,
 * the near hand hangs relaxed with the fingers curling naturally. Same head as the portrait (scaled), same light:
 * a warm key from the upper left, a cool rim from behind on the right.
 */
import { headLayers } from "./portrait.mjs";
import { smooth, sample, taper, rng, f, lerp, clamp } from "./lib.mjs";

export const FB = { W: 1400, H: 2700 };
const HEAD = "translate(392 31) scale(0.37)";

const C = {
  navy: "#25314A",
  navyLit: "#3A4A69",
  navyHi: "#5A6D90",
  navyDark: "#121827",
  stitch: "#7186AA",
  knit: "#CDBFA8",
  knitShade: "#8F8270",
  trou: "#3A3C42",
  trouLit: "#555861",
  trouDark: "#1C1D21",
  boot: "#6E4329",
  bootLit: "#9A653F",
  bootDark: "#3A2215",
  sole: "#2B201A",
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
/** A fold: a tapered soft stroke (shadow) with an optional lit lip beside it. */
const fold = (pts, w, c, o, blur = "b3") =>
  `<path d="${taper(sample(pts, 16), w, 0.5)}" fill="${c}" opacity="${o}" filter="url(#${blur})"/>`;

// ------------------------------------------------------------------------------------------------ hand

/**
 * The near hand, relaxed, hanging: seen from the back and the thumb side (the thumb points forward, toward
 * the face's direction). Local frame: wrist centre at 0,0, the hand hangs down +y, px at full-body scale.
 * Each finger is a joint chain (MCP, PIP, DIP, tip) with a width per joint, so the rig can curl it.
 */
const HAND = {
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
  // relaxed curl toward the palm (to the left here): the index least, the little finger most
  fingers: [
    {
      j: [
        [20, 100],
        [20, 130],
        [12, 152],
        [2, 162],
      ],
      w: [16, 14, 12, 10],
    },
    {
      j: [
        [10, 108],
        [8, 146],
        [-3, 172],
        [-15, 182],
      ],
      w: [19, 17, 15, 12],
    },
    {
      j: [
        [-1, 112],
        [-6, 154],
        [-20, 184],
        [-33, 195],
      ],
      w: [20, 18, 16, 13],
    },
    {
      j: [
        [-12, 106],
        [-18, 148],
        [-32, 176],
        [-45, 187],
      ],
      w: [20, 18, 16, 13],
    },
  ],
  // the thumb rests along the side of the index finger, its tip near the index's middle joint
  thumb: {
    j: [
      [-16, 38],
      [-33, 70],
      [-42, 104],
      [-41, 132],
    ],
    w: [28, 21, 17, 13],
  },
};

function chainShape(joints, widths) {
  const pts = sample(joints, 14);
  const n = pts.length;
  const ws = pts.map((_, i) => {
    const u = (i / (n - 1)) * (widths.length - 1);
    const a = Math.floor(u),
      b = Math.min(widths.length - 1, a + 1);
    return lerp(widths[a], widths[b], u - a);
  });
  const L = [],
    R = [];
  const nr = [];
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
  const first = pts[0],
    second = pts[1];
  const d0 = Math.hypot(second[0] - first[0], second[1] - first[1]) || 1;
  const base = [
    first[0] - ((second[0] - first[0]) / d0) * ws[0] * 0.35,
    first[1] - ((second[1] - first[1]) / d0) * ws[0] * 0.35,
  ];
  const Rr = R.slice().reverse();
  return {
    d: smooth([...L, tip, ...Rr, base], true, 0.14),
    open: smooth([...L, tip, ...Rr], false, 0.14),
    pts,
    ws,
    nr,
    tip,
  };
}

/** A limb as a chain with separate widths on its two sides (front / back), so calves and knees can bulge. */
function limb(joints, wl, wr, k = 16) {
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
  return { left: L, right: R, ring: [...L, ...R.slice().reverse()] };
}

function handSvg(id) {
  const defs = [];
  const g = [];
  const dors = P(HAND.dorsum, 0.16);
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
    // the key is on the left: the left edge of each finger is lit, the right edge turns into shadow
    out.push(
      `<path d="${smooth(side(-1, 0.42), false)}" fill="none" stroke="${C.skinShade}" stroke-width="${f(ws[0] * 0.6)}" opacity=".75" filter="url(#b3)"/>`,
    );
    out.push(
      `<path d="${smooth(side(1, 0.3), false)}" fill="none" stroke="${C.skinLit}" stroke-width="${f(ws[0] * 0.35)}" opacity="${front ? 0.7 : 0.4}" filter="url(#b2)"/>`,
    );
    // joint creases on the back of the finger, and the knuckle bump
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
    // the nail: on the back of the last joint, turned toward the lower right
    const e = pts.length - 1;
    const a = pts[e - 2],
      b = pts[e];
    const ang = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
    const nw = ws[e] * 0.5;
    const cx = lerp(a[0], b[0], 0.72) - nr[e][0] * ws[e] * 0.12,
      cy = lerp(a[1], b[1], 0.72) - nr[e][1] * ws[e] * 0.12;
    out.push(
      `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(nw * 0.9)}" ry="${f(nw * 0.55)}" transform="rotate(${f(ang)} ${f(cx)} ${f(cy)})" fill="#E2B6A2" opacity=".85"/>`,
      `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(nw * 0.9)}" ry="${f(nw * 0.55)}" transform="rotate(${f(ang)} ${f(cx)} ${f(cy)})" fill="none" stroke="#8A5040" stroke-width="1" opacity=".6"/>`,
    );
    return out.join("");
  };
  // fingers behind the back of the hand first (their roots go under the knuckles)
  const fingers = HAND.fingers.map((fg) => chainShape(fg.j, fg.w));
  for (let k = 0; k < 3; k++) g.push(part(fingers[k], k, false));
  // back of the hand: lit along the thumb side, the knuckles catching the key, two veins
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
      0.7,
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
      0.55,
      "b6",
    ),
  );
  for (const [x, y] of [
    [-12, 100],
    [1, 106],
    [14, 103],
    [25, 94],
  ])
    g.push(
      `<ellipse cx="${x}" cy="${y}" rx="7" ry="5" fill="${C.skinLit}" opacity=".45" filter="url(#b2)"/>`,
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
        [6, 44],
        [16, 66],
        [14, 96],
      ],
      "#9A6A6A",
      2.2,
      0.12,
      "b1",
    ),
  );
  // the knuckles break the lower edge of the back of the hand
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
  // the index finger in front of the hand, then the thumb in front of everything
  g.push(part(fingers[3], 3, true));
  const th = chainShape(HAND.thumb.j, HAND.thumb.w);
  g.push(part(th, 4, true));
  // the web between thumb and index, in shadow
  g.push(
    fill(
      [
        [-26, 70],
        [-14, 96],
        [-24, 112],
        [-34, 96],
      ],
      C.skinShade,
      0.5,
      "b3",
    ),
  );
  return { defs: defs.join(""), svg: g.join("") };
}

// ------------------------------------------------------------------------------------------------ figure

export function fullBodySvg() {
  const R = rng(17);
  const defs = [];
  const out = [];
  const L = headLayers();
  defs.push(L.defs);
  defs.push(
    `<linearGradient id="fbBg" x1="0" y1="0" x2="0" y2="2700" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#1A2226"/><stop offset=".55" stop-color="#2E3A3F"/><stop offset=".82" stop-color="#3A474B"/><stop offset=".84" stop-color="#2A3337"/><stop offset="1" stop-color="#161C1F"/></linearGradient>`,
    `<radialGradient id="fbGlow" cx="980" cy="900" r="900" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#5A6E74" stop-opacity=".55"/><stop offset="1" stop-color="#5A6E74" stop-opacity="0"/></radialGradient>`,
    `<radialGradient id="fbVig" cx="700" cy="1300" r="1500" gradientUnits="userSpaceOnUse"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></radialGradient>`,
    `<filter id="fbGrain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="2"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope="0" intercept=".06"/></feComponentTransfer></filter>`,
    `<filter id="fbPaper" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.016" numOctaves="4" seed="6"/><feColorMatrix type="matrix" values="0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 -0.9 0.55"/></filter>`,
    `<filter id="fbTwill" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="1.2 0.32" numOctaves="2" seed="8"/><feColorMatrix type="matrix" values="0 0 0 0 0.62  0 0 0 0 0.68  0 0 0 0 0.82  0 0 0 -1.7 0.95"/></filter>`,
    `<filter id="fbWool" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.5 0.9" numOctaves="2" seed="12"/><feColorMatrix type="matrix" values="0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.52  0 0 0 -1.8 1.0"/></filter>`,
  );
  const clipOf = (id, pts, k) => {
    defs.push(`<clipPath id="${id}"><path d="${P(pts, k)}"/></clipPath>`);
    return `clip-path="url(#${id})"`;
  };

  // ---- set: a studio sweep, a cool light behind the shadow side, the floor
  out.push(
    `<rect width="1400" height="2700" fill="url(#fbBg)"/><rect width="1400" height="2700" fill="url(#fbGlow)"/><rect width="1400" height="2700" filter="url(#fbPaper)" opacity=".22"/>`,
  );
  // the shadow on the floor: contact under the boots, the cast falls to the right, away from the key
  out.push(
    fill(
      [
        [560, 2520],
        [1000, 2560],
        [1360, 2590],
        [1380, 2640],
        [980, 2630],
        [560, 2570],
      ],
      "#07090A",
      0.55,
      "b16",
    ),
  );
  out.push(`<ellipse cx="637" cy="2522" rx="115" ry="16" fill="#050607" opacity=".8" filter="url(#b6)"/>`);
  out.push(`<ellipse cx="944" cy="2576" rx="92" ry="15" fill="#050607" opacity=".8" filter="url(#b6)"/>`);

  // ---- the far arm (upper part, behind the torso)
  const farUpper = [
    [484, 618],
    [452, 690],
    [430, 810],
    [414, 930],
    [410, 1000],
    [436, 1048],
    [486, 1030],
    [492, 900],
    [500, 760],
    [510, 660],
  ];
  out.push(fill(farUpper, C.navy));
  out.push(`<g ${clipOf("fbFarUp", farUpper)}>`);
  out.push(
    fill(
      [
        [440, 640],
        [470, 640],
        [450, 1000],
        [400, 1000],
      ],
      C.navyLit,
      0.8,
      "b16",
    ),
  );
  out.push(
    fold(
      [
        [430, 900],
        [452, 960],
        [470, 1010],
      ],
      7,
      C.navyDark,
      0.5,
    ),
  );
  out.push(`</g>`);
  out.push(
    stroke(
      [
        [484, 618],
        [452, 690],
        [430, 810],
        [414, 930],
        [410, 1000],
        [436, 1048],
      ],
      C.line,
      2.4,
      0.7,
    ),
  );

  // ---- trousers, built on the leg skeleton. Far leg: weight-bearing, straight. Near leg: knee eased forward.
  // Joints: hip, mid-thigh, knee, mid-calf, ankle. Widths are half-widths, front side / back side.
  const far = limb(
    [
      [612, 1360],
      [622, 1610],
      [636, 1850],
      [648, 2120],
      [662, 2405],
    ],
    [112, 98, 72, 70, 50],
    [118, 100, 76, 84, 50],
  );
  const near = limb(
    [
      [880, 1384],
      [862, 1640],
      [836, 1890],
      [880, 2150],
      [926, 2412],
    ],
    [104, 92, 80, 70, 50],
    [116, 100, 70, 86, 52],
  );
  const farLeg = far.ring;
  const nearLeg = near.ring;
  out.push(fill(farLeg, C.trou, 1, "", 0.1), `<g ${clipOf("fbFarLeg", farLeg, 0.1)}>`);
  out.push(
    fill(
      [
        [480, 1340],
        [610, 1340],
        [650, 2440],
        [560, 2440],
      ],
      C.trouLit,
      0.7,
      "b24",
    ),
  );
  out.push(
    fill(
      [
        [520, 1400],
        [590, 1400],
        [610, 1820],
        [560, 1820],
      ],
      "#6A6D76",
      0.45,
      "b16",
    ),
  );
  out.push(
    fill(
      [
        [580, 1900],
        [630, 1900],
        [650, 2380],
        [600, 2380],
      ],
      "#6A6D76",
      0.35,
      "b16",
    ),
  );
  out.push(
    fill(
      [
        [690, 1380],
        [800, 1380],
        [740, 2440],
        [680, 2440],
      ],
      C.trouDark,
      0.65,
      "b16",
    ),
  );
  // the pressed crease down the front, the break over the boot, drag lines from the crotch
  out.push(
    stroke(
      [
        [584, 1440],
        [598, 1800],
        [616, 2120],
        [628, 2380],
      ],
      C.trouLit,
      3,
      0.5,
      "b2",
    ),
  );
  out.push(
    fold(
      [
        [612, 2352],
        [660, 2386],
        [712, 2372],
      ],
      7,
      C.trouDark,
      0.7,
    ),
  );
  out.push(
    fold(
      [
        [618, 2322],
        [658, 2344],
        [702, 2334],
      ],
      4,
      C.trouLit,
      0.4,
      "b2",
    ),
  );
  out.push(
    fold(
      [
        [716, 1450],
        [676, 1520],
        [650, 1610],
      ],
      7,
      C.trouDark,
      0.5,
    ),
  );
  out.push(
    fold(
      [
        [704, 1480],
        [664, 1560],
      ],
      4,
      C.trouLit,
      0.35,
      "b2",
    ),
  );
  out.push(
    `<ellipse cx="600" cy="1860" rx="34" ry="60" fill="${C.trouLit}" opacity=".35" filter="url(#b16)"/>`,
  );
  out.push(`<rect x="480" y="1300" width="320" height="1150" filter="url(#fbWool)" opacity=".12"/></g>`);
  out.push(stroke(far.left, C.line, 2.4, 0.7));
  out.push(fill(nearLeg, C.trou, 1, "", 0.1), `<g ${clipOf("fbNearLeg", nearLeg, 0.1)}>`);
  // the near leg: lit down its front edge, its outside turned away, a cool rim on the back edge
  out.push(
    fill(
      [
        [760, 1380],
        [830, 1400],
        [860, 2440],
        [800, 2440],
      ],
      C.trouLit,
      0.55,
      "b16",
    ),
  );
  out.push(
    fill(
      [
        [790, 1950],
        [840, 1950],
        [880, 2380],
        [840, 2380],
      ],
      "#62656E",
      0.35,
      "b16",
    ),
  );
  out.push(
    fill(
      [
        [910, 1330],
        [1020, 1330],
        [1010, 2440],
        [900, 2440],
      ],
      C.trouDark,
      0.75,
      "b16",
    ),
  );
  out.push(stroke(near.right.slice(1, -2), C.rim, 6, 0.32, "b4"));
  // the eased knee: the front catches light, the back folds in short creases
  out.push(
    `<ellipse cx="786" cy="1890" rx="28" ry="46" fill="${C.trouLit}" opacity=".5" filter="url(#b10)"/>`,
  );
  out.push(
    fold(
      [
        [906, 1866],
        [880, 1884],
        [860, 1906],
      ],
      7,
      C.trouDark,
      0.75,
    ),
  );
  out.push(
    fold(
      [
        [910, 1910],
        [884, 1924],
        [866, 1948],
      ],
      6,
      C.trouDark,
      0.65,
    ),
  );
  out.push(
    fold(
      [
        [902, 1836],
        [880, 1850],
      ],
      4,
      C.trouDark,
      0.5,
    ),
  );
  out.push(
    fold(
      [
        [790, 1560],
        [840, 1650],
        [870, 1780],
      ],
      7,
      C.trouDark,
      0.35,
      "b4",
    ),
  );
  out.push(
    fold(
      [
        [878, 2376],
        [926, 2400],
        [978, 2388],
      ],
      7,
      C.trouDark,
      0.7,
    ),
  );
  out.push(
    fold(
      [
        [884, 2344],
        [922, 2362],
        [966, 2354],
      ],
      4,
      C.trouLit,
      0.35,
      "b2",
    ),
  );
  out.push(`<rect x="740" y="1300" width="320" height="1150" filter="url(#fbWool)" opacity=".12"/></g>`);
  out.push(stroke(near.left, C.line, 2.2, 0.55));
  out.push(stroke(near.right, C.line, 2.6, 0.8));

  // ---- boots: brown suede chukkas, the far one pointing forward-left, the near one toward the camera
  const farBoot = [
    [610, 2392],
    [714, 2398],
    [724, 2436],
    [730, 2494],
    [716, 2512],
    [652, 2516],
    [592, 2526],
    [542, 2524],
    [524, 2510],
    [530, 2486],
    [560, 2468],
    [596, 2446],
    [608, 2420],
  ];
  const nearBoot = [
    [876, 2400],
    [978, 2406],
    [990, 2446],
    [1010, 2500],
    [1014, 2546],
    [994, 2574],
    [944, 2582],
    [896, 2570],
    [872, 2534],
    [868, 2478],
    [872, 2432],
  ];
  for (const [id, b, lit] of [
    ["fbFarBoot", farBoot, 1],
    ["fbNearBoot", nearBoot, 0],
  ]) {
    out.push(fill(b, C.boot), `<g ${clipOf(id, b)}>`);
    if (lit) {
      // the toe box and the vamp face the key; the heel turns away; a stitched welt over a dark sole
      out.push(
        fill(
          [
            [512, 2480],
            [600, 2430],
            [640, 2460],
            [580, 2508],
            [520, 2508],
          ],
          C.bootLit,
          0.85,
          "b10",
        ),
      );
      out.push(
        `<ellipse cx="560" cy="2486" rx="26" ry="10" fill="#C99468" opacity=".55" filter="url(#b4)"/>`,
      );
      out.push(
        fill(
          [
            [676, 2396],
            [730, 2396],
            [730, 2530],
            [684, 2530],
          ],
          C.bootDark,
          0.65,
          "b10",
        ),
      );
      out.push(
        stroke(
          [
            [606, 2404],
            [640, 2440],
            [646, 2496],
          ],
          C.bootDark,
          2,
          0.55,
          "b1",
        ),
      );
      out.push(
        fill(
          [
            [505, 2500],
            [600, 2510],
            [720, 2496],
            [724, 2540],
            [505, 2540],
          ],
          C.sole,
          1,
          "b1",
        ),
      );
      out.push(
        stroke(
          [
            [518, 2502],
            [600, 2510],
            [712, 2496],
          ],
          "#C9A27E",
          1.5,
          0.5,
          "",
          "4 4",
        ),
      );
      for (const [y, o] of [
        [2416, 0.7],
        [2430, 0.65],
        [2444, 0.6],
      ])
        out.push(
          stroke(
            [
              [596, y],
              [612, y + 8],
              [630, y + 4],
            ],
            "#2A1A10",
            2,
            o,
          ),
        );
    } else {
      out.push(
        fill(
          [
            [852, 2440],
            [912, 2440],
            [930, 2566],
            [866, 2566],
          ],
          C.bootLit,
          0.6,
          "b10",
        ),
      );
      out.push(
        `<ellipse cx="916" cy="2552" rx="30" ry="12" fill="#B8865E" opacity=".45" filter="url(#b4)"/>`,
      );
      out.push(
        fill(
          [
            [948, 2400],
            [1004, 2420],
            [1004, 2590],
            [948, 2590],
          ],
          C.bootDark,
          0.75,
          "b10",
        ),
      );
      out.push(
        stroke(
          [
            [864, 2470],
            [910, 2490],
            [962, 2478],
          ],
          C.bootDark,
          2,
          0.5,
          "b1",
        ),
      );
      out.push(
        fill(
          [
            [846, 2556],
            [900, 2572],
            [1004, 2550],
            [1004, 2600],
            [846, 2600],
          ],
          C.sole,
          1,
          "b1",
        ),
      );
      out.push(
        stroke(
          [
            [864, 2558],
            [928, 2572],
            [990, 2552],
          ],
          "#C9A27E",
          1.5,
          0.45,
          "",
          "4 4",
        ),
      );
      for (const [y, o] of [
        [2420, 0.7],
        [2436, 0.62],
        [2452, 0.55],
      ])
        out.push(
          stroke(
            [
              [892, y],
              [912, y + 9],
              [934, y + 4],
            ],
            "#2A1A10",
            2,
            o,
          ),
        );
    }
    out.push(`</g>`, `<path d="${P(b)}" fill="none" stroke="#1A0F09" stroke-width="2.4" opacity=".75"/>`);
  }
  out.push(
    stroke(
      [
        [988, 2446],
        [1006, 2500],
        [1008, 2548],
      ],
      C.rim,
      4,
      0.35,
      "b2",
    ),
  );

  // ---- the near collar stand behind the neck, then the neck (from the head)
  out.push(
    fill(
      [
        [780, 548],
        [820, 524],
        [858, 524],
        [880, 556],
        [844, 578],
        [796, 580],
      ],
      "#1A2234",
    ),
  );
  out.push(
    stroke(
      [
        [820, 524],
        [858, 524],
        [880, 556],
      ],
      "#8DA6C2",
      2,
      0.5,
      "b1",
    ),
  );
  out.push(`<g transform="${HEAD}">${L.neck}</g>`);

  // ---- the knit between the jacket fronts
  const knit = [
    [652, 566],
    [706, 600],
    [790, 586],
    [784, 800],
    [780, 1050],
    [782, 1262],
    [710, 1272],
    [650, 1262],
    [648, 1050],
    [650, 800],
  ];
  out.push(fill(knit, C.knit), `<g ${clipOf("fbKnit", knit)}>`);
  out.push(`<rect x="600" y="550" width="220" height="740" filter="url(#fbWool)" opacity=".3"/>`);
  out.push(
    fill(
      [
        [640, 580],
        [790, 590],
        [800, 700],
        [640, 680],
      ],
      C.knitShade,
      0.55,
      "b10",
    ),
  );
  out.push(
    fill(
      [
        [720, 600],
        [810, 600],
        [810, 1280],
        [740, 1280],
      ],
      "#6E6352",
      0.55,
      "b16",
    ),
  );
  // the chest: the far pectoral catches the key, the underside of the chest and the stomach turn away
  out.push(`<ellipse cx="690" cy="720" rx="44" ry="70" fill="#E9DFCC" opacity=".55" filter="url(#b16)"/>`);
  out.push(
    fold(
      [
        [652, 860],
        [700, 878],
        [770, 870],
      ],
      14,
      "#8F8270",
      0.45,
      "b10",
    ),
  );
  out.push(
    fold(
      [
        [652, 1040],
        [700, 1060],
        [780, 1050],
      ],
      10,
      "#8F8270",
      0.3,
      "b10",
    ),
  );
  out.push(
    fold(
      [
        [650, 1180],
        [700, 1200],
        [760, 1190],
      ],
      6,
      C.knitShade,
      0.5,
    ),
  );
  out.push(
    fold(
      [
        [640, 1240],
        [700, 1252],
        [780, 1246],
      ],
      5,
      C.knitShade,
      0.6,
      "b2",
    ),
  );
  out.push(`</g>`);
  out.push(
    stroke(
      [
        [656, 566],
        [708, 596],
        [788, 584],
      ],
      "#D8CCB6",
      9,
      1,
    ),
  );
  out.push(
    stroke(
      [
        [656, 566],
        [708, 596],
        [788, 584],
      ],
      "#A39580",
      9,
      0.5,
      "",
      "1.6 2.4",
    ),
  );
  out.push(
    stroke(
      [
        [658, 560],
        [708, 588],
        [786, 578],
      ],
      "#6E604E",
      2,
      0.6,
      "b1",
    ),
  );
  // the trousers' waistband and fly between the fronts, below the knit's hem
  out.push(
    fill(
      [
        [648, 1262],
        [784, 1262],
        [784, 1362],
        [648, 1350],
      ],
      C.trou,
      1,
    ),
  );
  out.push(
    fill(
      [
        [648, 1262],
        [784, 1262],
        [784, 1300],
        [648, 1296],
      ],
      C.trouDark,
      0.5,
      "b4",
    ),
  );
  out.push(
    stroke(
      [
        [716, 1276],
        [720, 1360],
      ],
      C.trouDark,
      3,
      0.6,
    ),
  );

  // ---- the jacket: far front panel (lit), near front panel, collars, pockets
  const farPanel = [
    [652, 562],
    [580, 586],
    [486, 618],
    [476, 700],
    [494, 800],
    [512, 950],
    [520, 1090],
    [516, 1240],
    [512, 1336],
    [660, 1344],
    [656, 1250],
    [652, 1050],
    [652, 800],
    [660, 640],
  ];
  const nearPanel = [
    [790, 576],
    [880, 590],
    [996, 612],
    [1002, 700],
    [1000, 900],
    [994, 1090],
    [1010, 1366],
    [764, 1360],
    [770, 1250],
    [770, 1050],
    [768, 800],
    [770, 640],
  ];
  out.push(fill(farPanel, C.navy), `<g ${clipOf("fbFarPanel", farPanel)}>`);
  out.push(
    fill(
      [
        [470, 610],
        [600, 600],
        [630, 900],
        [520, 1000],
        [480, 800],
      ],
      C.navyLit,
      0.85,
      "b24",
    ),
  );
  out.push(
    fill(
      [
        [480, 616],
        [580, 594],
        [600, 640],
        [500, 680],
      ],
      C.navyHi,
      0.5,
      "b10",
    ),
  );
  out.push(
    fill(
      [
        [600, 700],
        [650, 700],
        [650, 1350],
        [600, 1350],
      ],
      C.navyDark,
      0.4,
      "b16",
    ),
  );
  out.push(
    stroke(
      [
        [480, 700],
        [560, 690],
        [640, 676],
      ],
      C.navyDark,
      4,
      0.5,
      "b2",
    ),
  );
  out.push(
    stroke(
      [
        [480, 706],
        [560, 696],
        [640, 682],
      ],
      C.stitch,
      1.4,
      0.5,
      "",
      "6 5",
    ),
  );
  out.push(
    fold(
      [
        [520, 860],
        [570, 900],
        [610, 980],
      ],
      6,
      C.navyDark,
      0.4,
    ),
  );
  // the hip pocket the far hand is in: the hand pushes the cloth out
  out.push(
    fill(
      [
        [532, 1130],
        [628, 1122],
        [632, 1292],
        [540, 1300],
      ],
      "#2C3A57",
      0.8,
      "",
      0.04,
    ),
  );
  out.push(
    fill(
      [
        [548, 1150],
        [620, 1146],
        [622, 1240],
        [552, 1246],
      ],
      C.navyLit,
      0.6,
      "b10",
    ),
  );
  out.push(
    stroke(
      [
        [532, 1130],
        [540, 1300],
        [632, 1292],
        [628, 1122],
      ],
      C.stitch,
      1.4,
      0.5,
      "",
      "6 5",
    ),
  );
  out.push(
    fold(
      [
        [540, 1280],
        [590, 1290],
        [630, 1284],
      ],
      6,
      C.navyDark,
      0.6,
    ),
  );
  out.push(`<rect x="460" y="550" width="200" height="820" filter="url(#fbTwill)" opacity=".16"/></g>`);
  out.push(
    stroke(
      [
        [660, 640],
        [652, 800],
        [652, 1050],
        [656, 1250],
        [660, 1344],
      ],
      C.navyDark,
      3,
      0.85,
    ),
  );
  out.push(
    stroke(
      [
        [668, 650],
        [662, 800],
        [662, 1050],
        [666, 1250],
        [668, 1336],
      ],
      C.stitch,
      1.4,
      0.45,
      "",
      "6 5",
    ),
  );
  out.push(
    stroke(
      [
        [486, 618],
        [476, 700],
        [494, 800],
        [512, 950],
        [520, 1090],
        [516, 1240],
        [512, 1336],
      ],
      C.line,
      2.4,
      0.7,
    ),
  );
  out.push(fill(nearPanel, C.navy), `<g ${clipOf("fbNearPanel", nearPanel)}>`);
  out.push(
    fill(
      [
        [860, 590],
        [1010, 600],
        [1010, 1350],
        [880, 1350],
      ],
      C.navyDark,
      0.6,
      "b24",
    ),
  );
  out.push(
    fill(
      [
        [778, 640],
        [830, 640],
        [830, 1350],
        [778, 1350],
      ],
      C.navyLit,
      0.45,
      "b16",
    ),
  );
  out.push(
    stroke(
      [
        [790, 700],
        [880, 702],
        [990, 708],
      ],
      C.navyDark,
      4,
      0.5,
      "b2",
    ),
  );
  out.push(
    stroke(
      [
        [790, 706],
        [880, 708],
        [990, 714],
      ],
      C.stitch,
      1.4,
      0.4,
      "",
      "6 5",
    ),
  );
  // chest pocket
  out.push(
    fill(
      [
        [800, 760],
        [882, 758],
        [884, 870],
        [804, 872],
      ],
      "#2A3654",
      0.8,
      "",
      0.04,
    ),
  );
  out.push(
    stroke(
      [
        [800, 760],
        [804, 872],
        [884, 870],
        [882, 758],
      ],
      C.stitch,
      1.4,
      0.45,
      "",
      "6 5",
    ),
  );
  out.push(
    stroke(
      [
        [800, 772],
        [882, 770],
      ],
      C.stitch,
      1.4,
      0.4,
      "",
      "6 5",
    ),
  );
  // hip pocket (mostly behind the hanging arm)
  out.push(
    fill(
      [
        [800, 1140],
        [900, 1136],
        [904, 1300],
        [806, 1304],
      ],
      "#26324E",
      0.8,
      "",
      0.04,
    ),
  );
  out.push(
    stroke(
      [
        [800, 1140],
        [806, 1304],
        [904, 1300],
        [900, 1136],
      ],
      C.stitch,
      1.4,
      0.4,
      "",
      "6 5",
    ),
  );
  out.push(
    fold(
      [
        [800, 1000],
        [840, 1060],
        [870, 1110],
      ],
      6,
      C.navyDark,
      0.4,
    ),
  );
  out.push(`<rect x="770" y="560" width="250" height="800" filter="url(#fbTwill)" opacity=".12"/></g>`);
  out.push(
    stroke(
      [
        [770, 640],
        [768, 800],
        [770, 1050],
        [770, 1250],
        [764, 1360],
      ],
      "#0B0F18",
      3,
      0.85,
    ),
  );
  out.push(
    stroke(
      [
        [762, 650],
        [760, 800],
        [762, 1050],
        [762, 1250],
        [756, 1352],
      ],
      "#4E6088",
      1.4,
      0.45,
      "",
      "6 5",
    ),
  );
  // the hem
  out.push(
    stroke(
      [
        [512, 1336],
        [660, 1344],
      ],
      C.line,
      2.4,
      0.7,
    ),
  );
  out.push(
    stroke(
      [
        [764, 1360],
        [1010, 1366],
      ],
      C.line,
      2.4,
      0.7,
    ),
  );
  out.push(
    fill(
      [
        [512, 1336],
        [660, 1344],
        [660, 1372],
        [512, 1364],
      ],
      "#0A0C10",
      0.5,
      "b6",
    ),
  );
  out.push(
    fill(
      [
        [764, 1360],
        [1010, 1366],
        [1010, 1396],
        [764, 1390],
      ],
      "#0A0C10",
      0.55,
      "b6",
    ),
  );

  // collars
  const farCollar = [
    [652, 548],
    [664, 572],
    [672, 620],
    [676, 680],
    [646, 666],
    [604, 628],
    [582, 596],
    [616, 568],
  ];
  const nearCollar = [
    [796, 552],
    [846, 556],
    [890, 578],
    [866, 620],
    [790, 692],
    [780, 640],
    [790, 590],
  ];
  out.push(
    `<path d="${P(farCollar, 0.1)}" fill="#05070C" opacity=".5" transform="translate(3 6)" filter="url(#b4)"/>`,
  );
  out.push(fill(farCollar, "#30405F", 1, "", 0.1));
  out.push(
    fill(
      [
        [600, 600],
        [650, 570],
        [668, 620],
        [630, 640],
      ],
      C.navyHi,
      0.5,
      "b6",
    ),
  );
  out.push(`<path d="${P(farCollar, 0.1)}" fill="none" stroke="#0B0F18" stroke-width="2" opacity=".7"/>`);
  out.push(
    `<path d="${P(nearCollar, 0.1)}" fill="#05070C" opacity=".55" transform="translate(4 6)" filter="url(#b4)"/>`,
  );
  out.push(fill(nearCollar, "#1F2840", 1, "", 0.1));
  out.push(
    fill(
      [
        [790, 600],
        [840, 572],
        [860, 600],
        [800, 660],
      ],
      "#33415E",
      0.6,
      "b6",
    ),
  );
  out.push(`<path d="${P(nearCollar, 0.1)}" fill="none" stroke="#0B0F18" stroke-width="2" opacity=".75"/>`);
  out.push(
    stroke(
      [
        [846, 556],
        [890, 578],
      ],
      C.rim,
      3,
      0.45,
      "b1",
    ),
  );

  // ---- the far forearm, in front of the panel, the hand inside the pocket
  const farFore = [
    [418, 986],
    [436, 1040],
    [480, 1098],
    [530, 1146],
    [566, 1172],
    [618, 1150],
    [604, 1118],
    [560, 1082],
    [508, 1024],
    [474, 962],
  ];
  out.push(
    `<path d="${P(farFore)}" fill="#05070C" opacity=".45" transform="translate(5 10)" filter="url(#b6)"/>`,
  );
  out.push(fill(farFore, C.navy), `<g ${clipOf("fbFarFore", farFore)}>`);
  out.push(
    fill(
      [
        [420, 990],
        [480, 960],
        [620, 1110],
        [600, 1130],
      ],
      C.navyLit,
      0.75,
      "b10",
    ),
  );
  out.push(
    fold(
      [
        [470, 1060],
        [500, 1050],
        [520, 1080],
      ],
      5,
      C.navyDark,
      0.6,
      "b2",
    ),
  );
  out.push(
    fold(
      [
        [505, 1095],
        [535, 1090],
        [550, 1118],
      ],
      5,
      C.navyDark,
      0.55,
      "b2",
    ),
  );
  out.push(`</g>`);
  out.push(
    fill(
      [
        [562, 1150],
        [626, 1124],
        [634, 1144],
        [574, 1172],
      ],
      "#1E2A44",
    ),
  );
  out.push(
    stroke(
      [
        [416, 990],
        [440, 1050],
        [490, 1106],
        [540, 1150],
        [572, 1166],
      ],
      C.line,
      2.4,
      0.7,
    ),
  );
  out.push(
    stroke(
      [
        [478, 960],
        [510, 1020],
        [566, 1076],
        [612, 1110],
        [626, 1138],
      ],
      C.line,
      1.8,
      0.45,
    ),
  );

  // ---- the near arm, hanging in front of the side of the body
  const nearSleeve = [
    [996, 606],
    [1036, 640],
    [1052, 740],
    [1052, 900],
    [1048, 1060],
    [1036, 1110],
    [1032, 1250],
    [1030, 1384],
    [922, 1392],
    [914, 1250],
    [906, 1130],
    [910, 1080],
    [912, 960],
    [910, 800],
    [920, 690],
  ];
  out.push(
    `<path d="${P(nearSleeve)}" fill="#05070C" opacity=".4" transform="translate(-10 8)" filter="url(#b10)"/>`,
  );
  out.push(fill(nearSleeve, C.navy), `<g ${clipOf("fbNearSleeve", nearSleeve)}>`);
  out.push(
    fill(
      [
        [960, 600],
        [1070, 620],
        [1070, 1400],
        [980, 1400],
      ],
      C.navyDark,
      0.6,
      "b16",
    ),
  );
  out.push(
    fill(
      [
        [908, 680],
        [940, 680],
        [940, 1390],
        [910, 1390],
      ],
      C.navyLit,
      0.55,
      "b10",
    ),
  );
  // drape: the sleeve breaks at the elbow, short folds at the inside of the arm
  out.push(
    fold(
      [
        [920, 1060],
        [956, 1086],
        [980, 1080],
      ],
      6,
      C.navyDark,
      0.6,
      "b2",
    ),
  );
  out.push(
    fold(
      [
        [922, 1110],
        [960, 1130],
        [990, 1124],
      ],
      5,
      C.navyDark,
      0.5,
      "b2",
    ),
  );
  out.push(
    fold(
      [
        [924, 1030],
        [948, 1046],
      ],
      4,
      C.navyHi,
      0.4,
      "b2",
    ),
  );
  out.push(
    stroke(
      [
        [1040, 640],
        [1058, 740],
        [1056, 900],
        [1050, 1080],
        [1044, 1250],
        [1034, 1384],
      ],
      C.rim,
      7,
      0.4,
      "b4",
    ),
  );
  out.push(
    stroke(
      [
        [996, 640],
        [1004, 800],
        [1000, 1000],
      ],
      C.navyDark,
      3,
      0.4,
      "b2",
    ),
  );
  out.push(
    stroke(
      [
        [1003, 645],
        [1011, 800],
        [1007, 1000],
      ],
      "#4E6088",
      1.4,
      0.4,
      "",
      "6 5",
    ),
  );
  out.push(`<rect x="900" y="590" width="170" height="810" filter="url(#fbTwill)" opacity=".14"/>`);
  out.push(`</g>`);
  // cuff and the knit cuff under it
  out.push(
    fill(
      [
        [926, 1376],
        [1034, 1370],
        [1032, 1394],
        [926, 1402],
      ],
      "#1E2840",
    ),
  );
  out.push(
    stroke(
      [
        [926, 1384],
        [1034, 1378],
      ],
      "#4E6088",
      1.4,
      0.45,
      "",
      "6 5",
    ),
  );
  out.push(
    fill(
      [
        [936, 1396],
        [1024, 1392],
        [1022, 1410],
        [940, 1414],
      ],
      C.knit,
    ),
  );
  out.push(
    fill(
      [
        [980, 1394],
        [1024, 1392],
        [1022, 1410],
        [984, 1412],
      ],
      C.knitShade,
      0.7,
      "b2",
    ),
  );
  out.push(`<path d="${P(nearSleeve)}" fill="none" stroke="${C.line}" stroke-width="2.6" opacity=".7"/>`);

  // ---- the near hand
  const hand = handSvg("fbHand");
  defs.push(hand.defs);
  out.push(`<g id="near-hand" transform="translate(980 1402) rotate(-4) scale(1.22)">${hand.svg}</g>`);

  // ---- the head
  out.push(`<g transform="${HEAD}">${L.head}</g>`);

  // ---- grade
  out.push(
    `<rect width="1400" height="2700" fill="url(#fbVig)"/><rect width="1400" height="2700" filter="url(#fbGrain)"/>`,
  );
  void R;
  void clamp;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="2700" viewBox="0 0 1400 2700"><defs>${defs.join("")}</defs>${out.join("")}</svg>`;
}
