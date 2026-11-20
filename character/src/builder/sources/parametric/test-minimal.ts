/**
 * chr_test_minimal: the technical test character of Phase 2. It proves the format and the runtime, nothing else:
 * it is not one of the reference characters and is never cast in a film (purpose: technical_test).
 *
 * A parametric source: the head is a small 3D model (an ellipsoid cranium, a tapered jaw, features as 3D points)
 * projected into each view, so both head views, their angle morphs and every facial morph come from the same
 * numbers. The body is a front-view bust: spine, chest, neck, shoulders, two-bone arms with skinned elbows, and
 * a painted T-shirt texture on a deformable mesh (the outfit `test_tee`).
 *
 * Units: package units (world units at scale 1); origin at the waist (the `root` joint); y down.
 */
import { createCanvas } from "@napi-rs/canvas";
import type { CharacterPart } from "@erkasa/contracts";
import type { PackageSpec } from "../../writer.js";
import { anchor, PartGeometry, round, type Anchor, type Vec, type Weights } from "../../geometry.js";

// ------------------------------------------------------------------------------------------------ palette

const SKIN = "#D9A07C";
const SKIN_SHADOW = "#B07A5A";
const SKIN_LIGHT = "#EDBE9B";
const HAIR = "#3B2A20";
const HAIR_LIGHT = "#5A4232";
const LIP = "#B5655A";
const LINE = "#3A241C";
const EYE_WHITE = "#F3EEE8";

// ------------------------------------------------------------------------------------------------ head model

/** Head centre in package space and the cranium's radii (x half-width, y half-height, z half-depth). */
const HC: Vec = [0, -650];
const RX = 100;
const RY = 128;
const RZ = 105;

type V3 = [number, number, number];

interface ViewSpec {
  id: string;
  /** Yaw the artwork is drawn at; positive turns the face toward screen right. */
  yaw: number;
  range: [number, number];
}
const VIEWS: ViewSpec[] = [
  { id: "front", yaw: 0, range: [-15, 15] },
  // the q3 view stops at 40°: beyond it the far brow and cheek leave the silhouette (seen at 45° in testing)
  { id: "q3", yaw: 30, range: [15, 40] },
];
const ANGLE = 15; // angle morphs reach ±15° from the view's centre
const PITCH = 12;

const rad = (d: number): number => (d * Math.PI) / 180;

/** Head-local 3D point (relative to HC, y down, z toward the camera) → package space for a yaw and pitch. */
function project(q: V3, yaw: number, pitch = 0): Vec {
  const [x, y, z] = q;
  // pitch about the head's x axis (positive: chin down), then yaw about the vertical axis
  const y1 = y * Math.cos(rad(pitch)) + z * Math.sin(rad(pitch));
  const z1 = -y * Math.sin(rad(pitch)) + z * Math.cos(rad(pitch));
  const x2 = x * Math.cos(rad(yaw)) + z1 * Math.sin(rad(yaw));
  return [HC[0] + x2, HC[1] + y1];
}

/** Depth toward the camera after the yaw (positive: facing the camera). */
const facing = (q: V3, yaw: number): number => -q[0] * Math.sin(rad(yaw)) + q[2] * Math.cos(rad(yaw));

const HEAD: Weights = { head: 1 };

/**
 * An anchor for a 3D point in one view: its projection, the angle morphs of that view (the point re-projected at
 * centre ± 15° yaw and ± 12° pitch) and the given 3D morphs (displacements in head space) projected the same way.
 */
function headAnchor(v: ViewSpec, q: V3, morphs: Record<string, V3> = {}, w: Weights = HEAD): Anchor {
  const p = project(q, v.yaw);
  const m: Record<string, Vec> = {};
  const diff = (a: Vec): Vec => [a[0] - p[0], a[1] - p[1]];
  m[`${v.id}_yaw_pos`] = diff(project(q, v.yaw + ANGLE));
  m[`${v.id}_yaw_neg`] = diff(project(q, v.yaw - ANGLE));
  m[`${v.id}_pitch_pos`] = diff(project(q, v.yaw, PITCH));
  m[`${v.id}_pitch_neg`] = diff(project(q, v.yaw, -PITCH));
  for (const [id, d] of Object.entries(morphs)) {
    const moved: V3 = [q[0] + d[0], q[1] + d[1], q[2] + d[2]];
    m[id] = diff(project(moved, v.yaw));
  }
  return anchor(p, w, m);
}

interface Slice {
  y: number;
  w: number;
  d: number;
  oz: number;
  jaw: number;
}

/**
 * The head as horizontal slices from the crown to the chin: each slice is an ellipse (half-width, half-depth,
 * forward offset). Its extremes after the yaw are the outline's points in a view; the same slices at another yaw
 * give the angle morphs; the jaw slices drop with `jaw_open`.
 */
const SLICES: Slice[] = (() => {
  const out: Slice[] = [];
  for (let i = 0; i <= 6; i++) {
    const y = -RY + (i / 6) * RY; // crown to centre
    const k = Math.sqrt(Math.max(0, 1 - (y / RY) ** 2));
    out.push({ y, w: RX * Math.max(0.12, k), d: RZ * Math.max(0.12, k), oz: 0, jaw: 0 });
  }
  for (let i = 1; i <= 5; i++) {
    const t = i / 5;
    out.push({
      y: t * 118,
      w: RX * (1 - 0.72 * t ** 1.5),
      d: 102 * (1 - 0.45 * t),
      oz: 40 * t ** 1.3,
      jaw: t ** 1.2,
    });
  }
  return out;
})();

/** The extreme of a slice along screen x after the yaw (and its height after the pitch), `out` units outside. */
function slicePoint(sl: Slice, side: 1 | -1, yaw: number, pitch = 0, out = 0): Vec {
  const ext = Math.sqrt((sl.w * Math.cos(rad(yaw))) ** 2 + (sl.d * Math.sin(rad(yaw))) ** 2) + out;
  const cx = sl.oz * Math.sin(rad(yaw));
  const y = sl.y * Math.cos(rad(pitch)) + sl.oz * Math.sin(rad(pitch));
  return [HC[0] + cx + side * ext, HC[1] + y - (sl.y < -RY + 1 ? out : 0)];
}

function sliceAnchor(v: ViewSpec, sl: Slice, side: 1 | -1, out = 0): Anchor {
  const p = slicePoint(sl, side, v.yaw, 0, out);
  const diff = (a: Vec): Vec => [a[0] - p[0], a[1] - p[1]];
  const m: Record<string, Vec> = {
    [`${v.id}_yaw_pos`]: diff(slicePoint(sl, side, v.yaw + ANGLE, 0, out)),
    [`${v.id}_yaw_neg`]: diff(slicePoint(sl, side, v.yaw - ANGLE, 0, out)),
    [`${v.id}_pitch_pos`]: diff(slicePoint(sl, side, v.yaw, PITCH, out)),
    [`${v.id}_pitch_neg`]: diff(slicePoint(sl, side, v.yaw, -PITCH, out)),
  };
  if (sl.jaw > 0) m["jaw"] = [0, 22 * sl.jaw];
  return anchor(p, HEAD, m);
}

/** The head's outline in a view: down the right side, up the left. */
function silhouette(v: ViewSpec): Anchor[] {
  const right = SLICES.map((sl) => sliceAnchor(v, sl, 1));
  const left = SLICES.map((sl) => sliceAnchor(v, sl, -1)).reverse();
  return [...right, ...left];
}

/** A point on the cranium's surface at (x, y), lifted `lift` units off it. */
function onCranium(x: number, y: number, lift = 0): V3 {
  const k = 1 - (x / RX) ** 2 - (y / RY) ** 2;
  return [x, y, RZ * Math.sqrt(Math.max(0, k)) + lift];
}

function vectorPart(
  id: string,
  z: number,
  g: PartGeometry,
  paths: Array<Omit<Extract<CharacterPart, { kind: "vector" }>["paths"][number], never>>,
  opacity = 1,
): CharacterPart {
  return { id, kind: "vector", z, opacity, ...g.build(), paths };
}

function headParts(v: ViewSpec): CharacterPart[] {
  const parts: CharacterPart[] = [];
  const s = v.id;

  // hair behind the head: a larger cranium shell, down to the ears
  {
    const g = new PartGeometry();
    const pts: Anchor[] = [];
    for (let i = 0; i <= 10; i++) {
      const a = Math.PI * (i / 10); // right ear → crown → left ear
      pts.push(
        headAnchor(v, [(RX + 14) * Math.cos(a), -(RY + 12) * Math.sin(a) + 6, -20 * Math.sin(a) - 10]),
      );
    }
    pts.push(headAnchor(v, [-(RX - 6), 40, -40]), headAnchor(v, [RX - 6, 40, -40]));
    const cmds = g.closed(pts.reverse());
    parts.push(vectorPart(`hair_back_${s}`, 5, g, [{ cmds, fill: { kind: "solid", color: HAIR } }]));
  }

  // ears (only the ones facing the camera)
  for (const side of [1, -1] as const) {
    const q: V3 = [side * (RX - 4), 4, -6];
    if (facing([side, 0, 0], v.yaw) < -0.2) continue;
    const g = new PartGeometry();
    const pts = [
      [0, -24, 0],
      [side * 16, -18, -4],
      [side * 18, 6, -6],
      [side * 8, 24, -2],
      [0, 18, 2],
    ].map(([x, y, z]) => headAnchor(v, [q[0] + (x as number), q[1] + (y as number), q[2] + (z as number)]));
    const cmds = g.closed(pts);
    parts.push(
      vectorPart(`ear_${side > 0 ? "l" : "r"}_${s}`, 9, g, [
        { cmds, fill: { kind: "solid", color: SKIN_SHADOW } },
      ]),
    );
  }

  // head skin, with a radial gradient whose centre and edge are vertices (they move with the head)
  {
    const g = new PartGeometry();
    const cmds = g.closed(silhouette(v));
    const light = g.add(headAnchor(v, [-30, -50, 90]));
    const edge = g.add(headAnchor(v, [-30 + 170, -50, 60]));
    parts.push(
      vectorPart(`head_${s}`, 10, g, [
        {
          cmds,
          fill: {
            kind: "radial",
            center: light,
            edge,
            stops: [
              [0, SKIN_LIGHT],
              [0.55, SKIN],
              [1, SKIN_SHADOW],
            ],
          },
        },
      ]),
    );
  }

  // eyes: the eye white (clips the iris; blink closes it) and the upper lid line
  for (const side of [1, -1] as const) {
    const e: V3 = [side * 38, -12, 90];
    const lr = side > 0 ? "l" : "r";
    const blink = `blink_${lr}`;
    const g = new PartGeometry();
    const lidTop = (x: number, h: number): V3 => [e[0] + x, e[1] - h, e[2] + 2];
    const inner: V3 = [e[0] - side * 20, e[1] + 2, e[2] - 4];
    const outer: V3 = [e[0] + side * 20, e[1] - 1, e[2] - 8];
    const lowerAt = (x: number, h: number): V3 => [e[0] + x, e[1] + h, e[2] + 1];
    const upper = [lidTop(-side * 10, 9), lidTop(0, 11), lidTop(side * 10, 8)];
    const lower = [lowerAt(side * 9, 7), lowerAt(0, 8), lowerAt(-side * 9, 6)];
    // closing: each upper point travels to the lower point below it
    const closeTo = (u: V3, l: V3): V3 => [l[0] - u[0], l[1] - u[1] - 1, 0];
    const pts = [
      headAnchor(v, inner),
      headAnchor(v, upper[0] as V3, { [blink]: closeTo(upper[0] as V3, lower[2] as V3), au05: [0, -3, 0] }),
      headAnchor(v, upper[1] as V3, { [blink]: closeTo(upper[1] as V3, lower[1] as V3), au05: [0, -4, 0] }),
      headAnchor(v, upper[2] as V3, { [blink]: closeTo(upper[2] as V3, lower[0] as V3), au05: [0, -3, 0] }),
      headAnchor(v, outer),
      ...lower.map((l) => headAnchor(v, l)),
    ];
    const cmds = g.closed(pts, 0.8);
    const center = g.add(headAnchor(v, e)); // not on the path: the iris's anchor
    void center;
    parts.push(
      vectorPart(`eye_white_${lr}_${s}`, 15, g, [{ cmds, fill: { kind: "solid", color: EYE_WHITE } }]),
    );

    const lid = new PartGeometry();
    const lidCmds = lid.open([
      headAnchor(v, inner),
      ...upper.map((u, i) => headAnchor(v, u, { [blink]: closeTo(u, lower[2 - i] as V3), au05: [0, -3, 0] })),
      headAnchor(v, outer),
    ]);
    parts.push(
      vectorPart(`lid_${lr}_${s}`, 17, lid, [
        { cmds: lidCmds, stroke: { paint: { kind: "solid", color: LINE }, width: 3.2 } },
      ]),
    );
  }

  // brows: au01 lifts the inner end, au02 the outer, au04 lowers and pulls them together
  for (const side of [1, -1] as const) {
    const lr = side > 0 ? "l" : "r";
    const g = new PartGeometry();
    const xs = [16, 32, 50, 64];
    const top = xs.map((x, i) => {
      const inner = 1 - i / 3;
      return headAnchor(v, [side * x, -44 - 4 * Math.sin((i / 3) * Math.PI), 96 - i * 5], {
        au01: [0, -10 * inner, 0],
        au02: [0, -9 * (1 - inner), 0],
        au04: [-side * 5 * inner, 7, 0],
      });
    });
    const bottom = [...xs].reverse().map((x, j) => {
      const i = 3 - j;
      const inner = 1 - i / 3;
      return headAnchor(v, [side * x, -36 - 3 * Math.sin((i / 3) * Math.PI), 96 - i * 5], {
        au01: [0, -10 * inner, 0],
        au02: [0, -9 * (1 - inner), 0],
        au04: [-side * 5 * inner, 7, 0],
      });
    });
    const cmds = g.closed([...top, ...bottom], 0.7);
    parts.push(vectorPart(`brow_${lr}_${s}`, 20, g, [{ cmds, fill: { kind: "solid", color: HAIR } }]));
  }

  // nose: a soft shadow under the tip and the nostril line
  {
    const g = new PartGeometry();
    const cmds = g.open([
      headAnchor(v, [-14, 30, 98]),
      headAnchor(v, [-6, 36, 104]),
      headAnchor(v, [6, 36, 104]),
      headAnchor(v, [14, 30, 98]),
    ]);
    parts.push(
      vectorPart(`nose_${s}`, 16, g, [
        { cmds, stroke: { paint: { kind: "solid", color: SKIN_SHADOW }, width: 4 } },
      ]),
    );
  }

  // mouth: lips (au12 lifts and widens the corners, jaw_open lowers the lower lip) and the inside
  {
    const corner = (side: 1 | -1): V3 => [side * 30, 66, 86];
    const smile = (side: 1 | -1): V3 => [side * 5, -7, -2];
    const g = new PartGeometry();
    const pts = [
      headAnchor(v, corner(-1), { au12: smile(-1), jaw: [0, 3, 0] }),
      headAnchor(v, [-14, 58, 97], { au12: [-2, -2, 0] }),
      headAnchor(v, [0, 61, 99]),
      headAnchor(v, [14, 58, 97], { au12: [2, -2, 0] }),
      headAnchor(v, corner(1), { au12: smile(1), jaw: [0, 3, 0] }),
      headAnchor(v, [16, 76, 93], { au12: [2, -1, 0], jaw: [0, 16, 0] }),
      headAnchor(v, [0, 80, 95], { jaw: [0, 18, 0] }),
      headAnchor(v, [-16, 76, 93], { au12: [-2, -1, 0], jaw: [0, 16, 0] }),
    ];
    const inside = new PartGeometry();
    const ins = [
      headAnchor(v, corner(-1), { au12: smile(-1), jaw: [0, 3, 0] }),
      headAnchor(v, [0, 66, 96], { jaw: [0, -2, 0] }),
      headAnchor(v, corner(1), { au12: smile(1), jaw: [0, 3, 0] }),
      headAnchor(v, [0, 68, 96], { jaw: [0, 16, 0] }),
    ];
    const insideCmds = inside.closed(ins, 0.9);
    parts.push(
      vectorPart(`mouth_inside_${s}`, 17.5, inside, [
        { cmds: insideCmds, fill: { kind: "solid", color: "#4A1E1E" } },
      ]),
    );
    const cmds = g.closed(pts, 0.8);
    // the lips' parting line moves with the mouth
    const line = g.open([
      headAnchor(v, corner(-1), { au12: smile(-1), jaw: [0, 3, 0] }),
      headAnchor(v, [0, 67, 97], { jaw: [0, 1, 0] }),
      headAnchor(v, corner(1), { au12: smile(1), jaw: [0, 3, 0] }),
    ]);
    parts.push(
      vectorPart(`mouth_${s}`, 18, g, [
        { cmds, fill: { kind: "solid", color: LIP } },
        { cmds: line, stroke: { paint: { kind: "solid", color: "#6E3530" }, width: 2.2 } },
      ]),
    );
  }

  // hair: a cap from the temples over the crown (outer edge on the view's silhouette), down to a fringe
  {
    const g = new PartGeometry();
    // on the side turned away from the camera the hair covers the back of the head, down past the ear
    const back: 1 | -1 = v.yaw >= 0 ? -1 : 1;
    const turn = Math.min(1, Math.abs(Math.sin(rad(v.yaw))) / 0.5);
    const limit = (side: 1 | -1): number => (side === back ? -60 + 80 * turn : -60);
    const outer = SLICES.filter((sl) => sl.y <= limit(1))
      .reverse()
      .map((sl) => sliceAnchor(v, sl, 1, 7)); // right temple → crown
    const outerL = SLICES.filter((sl) => sl.y <= limit(-1)).map((sl) => sliceAnchor(v, sl, -1, 7)); // crown → left
    const behindEar = turn > 0 ? [headAnchor(v, [back * (RX - 10), -26, -22])] : [];
    const line: Anchor[] = [];
    for (let i = 0; i <= 8; i++) {
      const x = -90 + (i / 8) * 180;
      const wave = 9 * Math.sin((i / 8) * Math.PI * 3);
      line.push(headAnchor(v, onCranium(x * 0.97, -74 + wave + 14 * Math.abs(x / 90) ** 2, 5)));
    }
    const cmds = g.closed(
      back < 0
        ? [...outer, ...outerL.slice(1), ...behindEar, ...line]
        : [...outer, ...outerL.slice(1), ...line, ...behindEar],
      0.9,
    );
    const a = g.add(headAnchor(v, [0, -140, 60]));
    const b = g.add(headAnchor(v, [0, -70, 90]));
    parts.push(
      vectorPart(`hair_front_${s}`, 30, g, [
        {
          cmds,
          fill: {
            kind: "linear",
            from: a,
            to: b,
            stops: [
              [0, HAIR_LIGHT],
              [1, HAIR],
            ],
          },
        },
      ]),
    );
  }
  return parts;
}

// ------------------------------------------------------------------------------------------------ body

/** Weights by height for the torso: waist → spine, chest → chest. */
function torsoWeights(x: number, y: number): Weights {
  const t = Math.min(1, Math.max(0, (-y - 150) / 160));
  const w: Weights = { spine: 1 - t, chest: t };
  const side = x > 0 ? "shoulder_l" : "shoulder_r";
  const s = Math.min(1, Math.max(0, (Math.abs(x) - 95) / 50)) * Math.min(1, Math.max(0, (-y - 330) / 50));
  if (s > 0) {
    for (const k of Object.keys(w)) w[k] = (w[k] as number) * (1 - s);
    w[side] = s;
  }
  return w;
}

const breathOf = (x: number, y: number): Vec => {
  const k = Math.min(1, Math.max(0, (-y - 200) / 200));
  return [Math.sign(x) * 5 * k, -4 * k];
};

function torsoOutline(): Vec[] {
  return [
    [-118, 0],
    [-124, -120],
    [-132, -260],
    [-150, -360],
    [-138, -402],
    [-60, -428],
    [0, -432],
    [60, -428],
    [138, -402],
    [150, -360],
    [132, -260],
    [124, -120],
    [118, 0],
  ];
}

function armParts(side: 1 | -1): CharacterPart[] {
  const lr = side > 0 ? "l" : "r";
  const x0 = side * 150;
  // stations from the shoulder to the wrist: y, half-width, weights
  const stations: Array<{ y: number; hw: number; w: Weights }> = [];
  for (let i = 0; i <= 10; i++) {
    const y = -400 + (i / 10) * 360;
    const hw = 34 - (i / 10) * 14;
    const tElbow = (y + 210) / 40; // −1 … 1 across the elbow
    const lower = Math.min(1, Math.max(0, (tElbow + 1) / 2));
    const w: Weights = { [`arm_${lr}_upper`]: 1 - lower, [`arm_${lr}_lower`]: lower };
    if (i === 0) {
      w[`arm_${lr}_upper`] = 0.6;
      w[`shoulder_${lr}`] = 0.4;
    }
    stations.push({ y, hw, w });
  }
  const g = new PartGeometry();
  const outerSide = stations.map((s) => anchor([x0 + side * s.hw, s.y], s.w));
  const innerSide = [...stations].reverse().map((s) => anchor([x0 - side * s.hw, s.y], s.w));
  const cmds = g.closed([...outerSide, ...innerSide], 0.6);
  const lightA = g.add(anchor([x0 - side * 30, -300], { [`arm_${lr}_upper`]: 1 }));
  const lightB = g.add(anchor([x0 + side * 30, -300], { [`arm_${lr}_upper`]: 1 }));
  const arm: CharacterPart = {
    id: `arm_${lr}`,
    kind: "vector",
    z: 4,
    opacity: 1,
    ...g.build(),
    paths: [
      {
        cmds,
        fill: {
          kind: "linear",
          from: lightA,
          to: lightB,
          stops: [
            [0, SKIN],
            [1, SKIN_SHADOW],
          ],
        },
      },
    ],
  };
  const h = new PartGeometry();
  const hw: Weights = { [`hand_${lr}`]: 1 };
  const hpts = [
    [-22, -42],
    [24, -42],
    [28, -10],
    [22, 22],
    [6, 34],
    [-12, 30],
    [-24, 8],
  ].map(([dx, dy]) => anchor([x0 + side * (dx as number), (dy as number) + 6], hw));
  const hcmds = h.closed(hpts, 0.8);
  const hand: CharacterPart = {
    id: `hand_${lr}`,
    kind: "vector",
    z: 4.5,
    opacity: 1,
    ...h.build(),
    paths: [
      {
        cmds: hcmds,
        fill: { kind: "solid", color: SKIN },
        stroke: { paint: { kind: "solid", color: SKIN_SHADOW }, width: 2 },
      },
    ],
  };
  // the T-shirt's sleeve: the upper arm's first stations, a little wider
  const sl = new PartGeometry();
  const top = stations.slice(0, 5);
  const so = top.map((s) => anchor([x0 + side * (s.hw + 6), s.y - 4], s.w));
  const si = [...top].reverse().map((s) => anchor([x0 - side * (s.hw + 5), s.y - 4], s.w));
  const scmds = sl.closed([...so, ...si], 0.5);
  const sleeve: CharacterPart = {
    id: `sleeve_${lr}`,
    kind: "vector",
    z: 4.2,
    opacity: 1,
    ...sl.build(),
    paths: [
      {
        cmds: scmds,
        fill: { kind: "solid", color: "#3E6C8C" },
        stroke: { paint: { kind: "solid", color: "#2C5470" }, width: 2 },
      },
    ],
  };
  return [arm, hand, sleeve];
}

function bodyParts(teeImage: { path: string; width: number; height: number }): CharacterPart[] {
  const parts: CharacterPart[] = [];
  {
    const g = new PartGeometry();
    const cmds = g.closed(
      torsoOutline().map((p) => anchor(p, torsoWeights(p[0], p[1]), { breath: breathOf(p[0], p[1]) })),
      0.5,
    );
    parts.push({
      id: "torso_skin",
      kind: "vector",
      z: 2,
      opacity: 1,
      ...g.build(),
      paths: [{ cmds, fill: { kind: "solid", color: SKIN } }],
    });
  }
  {
    const g = new PartGeometry();
    const w = (y: number): Weights => {
      const t = Math.min(1, Math.max(0, (-y - 440) / 70));
      return t < 0.5 ? { chest: 1 - t * 2, neck: t * 2 } : { neck: 2 - t * 2, head: t * 2 - 1 };
    };
    const pts: Vec[] = [
      [-34, -425],
      [-36, -470],
      [-33, -540],
      [33, -540],
      [36, -470],
      [34, -425],
    ];
    const cmds = g.closed(
      pts.map((p) => anchor(p, w(p[1]))),
      0.4,
    );
    const a = g.add(anchor([0, -540], { head: 1 }));
    const b = g.add(anchor([0, -470], { neck: 1 }));
    parts.push({
      id: "neck",
      kind: "vector",
      z: 2.5,
      opacity: 1,
      ...g.build(),
      paths: [
        {
          cmds,
          fill: {
            kind: "linear",
            from: a,
            to: b,
            stops: [
              [0, SKIN_SHADOW],
              [1, SKIN],
            ],
          },
        },
      ],
    });
  }
  // the T-shirt: a painted texture on an 8 × 10 mesh over the torso
  {
    const X0 = -170;
    const X1 = 170;
    const Y0 = -440;
    const Y1 = 10;
    const cols = 8;
    const rows = 10;
    const g = new PartGeometry();
    const uv: Vec[] = [];
    for (let j = 0; j <= rows; j++)
      for (let i = 0; i <= cols; i++) {
        const x = X0 + ((X1 - X0) * i) / cols;
        const y = Y0 + ((Y1 - Y0) * j) / rows;
        g.add(anchor([x, y], torsoWeights(x, y), { breath: breathOf(x, y) }));
        uv.push([round((teeImage.width * i) / cols), round((teeImage.height * j) / rows)]);
      }
    const triangles: Array<[number, number, number]> = [];
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) {
        const a = j * (cols + 1) + i;
        triangles.push([a, a + 1, a + cols + 1], [a + 1, a + cols + 2, a + cols + 1]);
      }
    parts.push({
      id: "tee",
      kind: "texture",
      z: 3,
      opacity: 1,
      ...g.build(),
      images: { medium: teeImage.path },
      uv,
      triangles,
    });
  }
  for (const side of [1, -1] as const) parts.push(...armParts(side));
  return parts;
}

// ------------------------------------------------------------------------------------------------ texture

/** A deterministic PRNG (mulberry32) for the painted fabric. */
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The T-shirt, painted: silhouette, vertical light, folds and a fabric grain, transparent outside the shirt. */
export function paintTee(width = 384, height = 512): Uint8Array {
  const c = createCanvas(width, height);
  const g = c.getContext("2d");
  const sx = (x: number): number => ((x + 170) / 340) * width;
  const sy = (y: number): number => ((y + 440) / 450) * height;
  const outline: Vec[] = [
    [-120, 10],
    [-126, -120],
    [-136, -260],
    [-156, -362],
    [-142, -408],
    [-62, -432],
    [-30, -438],
    [0, -412],
    [30, -438],
    [62, -432],
    [142, -408],
    [156, -362],
    [136, -260],
    [126, -120],
    [120, 10],
  ];
  g.beginPath();
  outline.forEach(([x, y], i) => (i ? g.lineTo(sx(x), sy(y)) : g.moveTo(sx(x), sy(y))));
  g.closePath();
  const base = g.createLinearGradient(0, 0, width, 0);
  base.addColorStop(0, "#335C79");
  base.addColorStop(0.45, "#4A7EA2");
  base.addColorStop(1, "#2C5068");
  g.fillStyle = base;
  g.fill();
  g.save();
  g.clip();
  const rnd = prng(20261120);
  // folds: soft darker and lighter strokes, painted with wide translucent lines
  for (let k = 0; k < 14; k++) {
    const x = -110 + rnd() * 220;
    const y = -360 + rnd() * 330;
    const len = 40 + rnd() * 90;
    const ang = rad(70 + rnd() * 40);
    g.strokeStyle = rnd() < 0.6 ? "rgba(20,40,60,0.18)" : "rgba(255,255,255,0.10)";
    g.lineWidth = 6 + rnd() * 10;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(sx(x), sy(y));
    g.quadraticCurveTo(sx(x + 12 * rnd()), sy(y + len / 2), sx(x + Math.cos(ang) * 10), sy(y + len));
    g.stroke();
  }
  // collar and hem
  g.strokeStyle = "#24435A";
  g.lineWidth = 7;
  g.beginPath();
  g.moveTo(sx(-30), sy(-438));
  g.quadraticCurveTo(sx(0), sy(-398), sx(30), sy(-438));
  g.stroke();
  // fabric grain
  const img = g.getImageData(0, 0, width, height);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rnd() - 0.5) * 10;
    img.data[i] = Math.max(0, Math.min(255, (img.data[i] as number) + n));
    img.data[i + 1] = Math.max(0, Math.min(255, (img.data[i + 1] as number) + n));
    img.data[i + 2] = Math.max(0, Math.min(255, (img.data[i + 2] as number) + n));
  }
  g.putImageData(img, 0, 0);
  g.restore();
  return c.toBuffer("image/png");
}

// ------------------------------------------------------------------------------------------------ the package

export function testMinimalSpec(): PackageSpec {
  const TEE = { path: "textures/tee.png", width: 384, height: 512 };
  const head = VIEWS.flatMap(headParts);
  const body = bodyParts(TEE);
  const bone = (id: string, at: Vec, angle: number, length: number, parent?: string) =>
    parent ? { id, parent, at, angle, length } : { id, at, angle, length };
  const morph = (m: string, from: number, to: number) => ({ kind: "morph" as const, morph: m, from, to });
  const boneDrive = (b: string, degPerUnit: number) => ({ kind: "bone" as const, bone: b, degPerUnit });
  const viewParts = (id: string): string[] => head.filter((p) => p.id.endsWith(`_${id}`)).map((p) => p.id);
  const eyeViews = (lr: "l" | "r") =>
    VIEWS.map((v) => {
      const clip = head.find((p) => p.id === `eye_white_${lr}_${v.id}`) as CharacterPart;
      // the eye looks slightly outward: the far eye (the left one when the face turns right) is foreshortened more
      const squash = Math.max(0.35, Math.min(1, Math.cos(rad(v.yaw + (lr === "l" ? 12 : -12)))));
      return {
        view: v.id,
        centerVertex: clip.vertices.length - 1,
        radius: 13,
        squash: round(squash, 3),
        clip: clip.id,
        over: `lid_${lr}_${v.id}`,
      };
    });
  const eye = (id: "l" | "r") => ({
    id,
    bone: "head",
    iris: { radius: 8.5, color: "#4A6A8A", ring: "#2A3C50" },
    pupil: { radius: 3.8, color: "#101418" },
    highlight: { offset: [-2.5, -3] as Vec, radius: 1.8, color: "#FFFFFFDD" },
    maxAngle: 30,
    views: eyeViews(id),
  });
  const channels = [
    "spine_bend",
    "chest_bend",
    "breath",
    "neck_bend",
    "head_roll",
    "head_yaw",
    "head_pitch",
    "shoulder_l_raise",
    "shoulder_r_raise",
    "arm_l_upper",
    "arm_r_upper",
    "arm_l_lower",
    "arm_r_lower",
    "au01",
    "au02",
    "au04",
    "au05",
    "au12",
    "jaw_open",
    "lid_l",
    "lid_r",
    "gaze_x",
    "gaze_y",
    "gaze_z",
  ];
  return {
    manifest: {
      schema: "erkasa.character/1",
      id: "chr_test_minimal",
      version: 1,
      name: "Technical test character",
      purpose: "technical_test",
      identity: {
        build: "neutral",
        height: 790,
        heads: 3.1,
        palette: { skin: SKIN, skinShadow: SKIN_SHADOW, eyes: "#4A6A8A", hair: HAIR },
        hairStyle: "short_fringe",
        facialHair: "none",
        marks: [],
      },
      formats: { rig: "erkasa.rig.layered/1", channels: "erkasa.humanoid/1" },
      compatibility: { minRuntime: 1 },
      origin: "root",
      skeleton: {
        bones: [
          bone("root", [0, 0], -90, 0),
          bone("spine", [0, 0], -90, 230, "root"),
          bone("chest", [0, -230], -90, 200, "spine"),
          bone("neck", [0, -430], -90, 75, "chest"),
          bone("head", [0, -505], -90, 280, "neck"),
          ...(["l", "r"] as const).flatMap((s) => {
            const k = s === "l" ? 1 : -1;
            return [
              bone(`shoulder_${s}`, [k * 55, -400], s === "l" ? 0 : 180, 95, "chest"),
              bone(`arm_${s}_upper`, [k * 150, -400], 90, 190, `shoulder_${s}`),
              bone(`arm_${s}_lower`, [k * 150, -210], 90, 170, `arm_${s}_upper`),
              bone(`hand_${s}`, [k * 150, -40], 90, 55, `arm_${s}_lower`),
            ];
          }),
        ],
        sockets: [
          { id: "hand_l", bone: "hand_l", at: [150, 6] },
          { id: "hand_r", bone: "hand_r", at: [-150, 6] },
        ],
        contacts: [],
      },
      controls: [
        { channel: "spine_bend", range: [-12, 12], rest: 0, drives: [boneDrive("spine", 1)] },
        { channel: "chest_bend", range: [-12, 12], rest: 0, drives: [boneDrive("chest", 1)] },
        { channel: "breath", range: [0, 1], rest: 0, drives: [morph("breath", 0, 1)] },
        { channel: "neck_bend", range: [-15, 15], rest: 0, drives: [boneDrive("neck", 1)] },
        { channel: "head_roll", range: [-18, 18], rest: 0, drives: [boneDrive("head", 1)] },
        {
          channel: "head_yaw",
          range: [-15, 40],
          rest: 0,
          drives: [
            morph("front_yaw_pos", 0, 15),
            morph("front_yaw_neg", 0, -15),
            morph("q3_yaw_pos", 30, 45),
            morph("q3_yaw_neg", 30, 15),
          ],
        },
        {
          channel: "head_pitch",
          range: [-12, 12],
          rest: 0,
          drives: [
            morph("front_pitch_pos", 0, 12),
            morph("front_pitch_neg", 0, -12),
            morph("q3_pitch_pos", 0, 12),
            morph("q3_pitch_neg", 0, -12),
          ],
        },
        { channel: "shoulder_l_raise", range: [-10, 20], rest: 0, drives: [boneDrive("shoulder_l", -1)] },
        { channel: "shoulder_r_raise", range: [-10, 20], rest: 0, drives: [boneDrive("shoulder_r", 1)] },
        { channel: "arm_l_upper", range: [-20, 110], rest: 0, drives: [boneDrive("arm_l_upper", -1)] },
        { channel: "arm_r_upper", range: [-20, 110], rest: 0, drives: [boneDrive("arm_r_upper", 1)] },
        { channel: "arm_l_lower", range: [0, 130], rest: 0, drives: [boneDrive("arm_l_lower", -1)] },
        { channel: "arm_r_lower", range: [0, 130], rest: 0, drives: [boneDrive("arm_r_lower", 1)] },
        { channel: "au01", range: [0, 1], rest: 0, drives: [morph("au01", 0, 1)] },
        { channel: "au02", range: [0, 1], rest: 0, drives: [morph("au02", 0, 1)] },
        { channel: "au04", range: [0, 1], rest: 0, drives: [morph("au04", 0, 1)] },
        { channel: "au05", range: [0, 1], rest: 0, drives: [morph("au05", 0, 1)] },
        { channel: "au12", range: [0, 1], rest: 0, drives: [morph("au12", 0, 1)] },
        {
          channel: "jaw_open",
          range: [0, 1],
          rest: 0,
          drives: [
            morph("jaw", 0, 1),
            ...VIEWS.map((v) => ({
              kind: "opacity" as const,
              part: `mouth_inside_${v.id}`,
              from: 0,
              to: 0.15,
            })),
          ],
        },
        { channel: "lid_l", range: [0, 1], rest: 0, drives: [morph("blink_l", 0, 1)] },
        { channel: "lid_r", range: [0, 1], rest: 0, drives: [morph("blink_r", 0, 1)] },
      ],
      views: {
        head: {
          yawChannel: "head_yaw",
          pitchChannel: "head_pitch",
          views: VIEWS.map((v) => ({
            id: v.id,
            yaw: v.range,
            pitch: [-PITCH, PITCH] as [number, number],
            center: { yaw: v.yaw, pitch: 0 },
            parts: viewParts(v.id),
            blend: 3,
          })),
        },
      },
      face: {
        aus: ["au01", "au02", "au04", "au05", "au12"],
        visemes: [],
        blink: { l: "blink_l", r: "blink_r" },
        gaze: {
          rest: [0, 0, 600],
          range: [
            [-500, 500],
            [-500, 500],
            [60, 3000],
          ],
        },
      },
      eyes: [eye("l"), eye("r")],
      hands: [],
      wardrobe: [
        {
          id: "test_tee",
          label: "Test T-shirt (painted texture on a mesh)",
          tags: ["casual", "test"],
          garments: [{ kind: "tshirt", parts: ["tee", "sleeve_l", "sleeve_r"] }],
          hides: ["torso_skin"],
        },
      ],
      capabilities: {
        channels,
        views: { head: VIEWS.map((v) => v.id) },
        face: {
          aus: ["au01", "au02", "au04", "au05", "au12"],
          visemes: [],
          blink: true,
          gaze: true,
          jaw: true,
        },
        hands: { fingers: false },
        locomotion: [],
        interactions: [],
        wardrobe: ["test_tee"],
        lod: ["medium"],
        evidence: [],
      },
      provenance: { origin: "builder", tool: "character-builder/parametric/test-minimal@1" },
      license: "LicenseRef-Erkasa-Original",
      approval: {
        status: "pending",
        note: "Phase 2 technical test character: proves the format and the runtime only.",
      },
    },
    parts: [
      { path: "parts/body.json", parts: body },
      { path: "parts/head.json", parts: head },
    ],
    textures: [{ path: TEE.path, bytes: paintTee(TEE.width, TEE.height), media: "image/png" }],
  };
}
