/**
 * Character v3 prototype: body, limbs and hands. Not production code.
 *
 * The construction method: every limb (and every finger) is a bone chain with a width profile. The outline is
 * computed from the skeleton every frame — tapering, muscle bulge, a joint that bends as one continuous shape —
 * so the body deforms like a body instead of being tubes and circles pinned together. Cel shading is the same
 * outline drawn twice: a shadow colour, and the lit colour shifted toward the light and clipped to the shape.
 *
 * World space: the pit of the neck at (0, 0), y down, the character faces +x (3/4). Head height H = 280.
 * Angles: 0 = pointing down, positive = toward +x (forward).
 */
import { head as drawHead, FACE_REST, SKIN } from "./head.mjs";

const f = (n) => (Math.round(n * 100) / 100).toString();
const rad = (d) => (d * Math.PI) / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const along = ([x, y], len, deg) => [x + Math.sin(rad(deg)) * len, y + Math.cos(rad(deg)) * len];

// ------------------------------------------------------------------------------------------------ outlines

/** Catmull-Rom through points, as cubic Béziers (closed or open). */
export function smooth(pts, closed = true) {
  const n = pts.length;
  const P = (i) => pts[closed ? (i + n) % n : clamp(i, 0, n - 1)];
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = P(i - 1),
      p1 = P(i),
      p2 = P(i + 1),
      p3 = P(i + 2);
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`;
  }
  return closed ? d + "Z" : d;
}

/**
 * The outline of a bone chain. `joints` are points, `widths` the width at each joint, `bulge` the extra width in
 * the middle of each segment (a muscle), `caps` rounds the ends. Returns a closed smooth path.
 */
export function chainOutline(joints, widths, bulge = [], caps = [true, true]) {
  const L = [],
    R = [];
  const dir = (a, b) => {
    const dx = b[0] - a[0],
      dy = b[1] - a[1],
      l = Math.hypot(dx, dy) || 1;
    return [dx / l, dy / l];
  };
  const nrm = (d) => [-d[1], d[0]];
  const N = joints.length;
  for (let i = 0; i < N - 1; i++) {
    const a = joints[i],
      b = joints[i + 1];
    const d = dir(a, b);
    const steps = 4;
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      const p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      let n = nrm(d);
      if (s === 0 && i > 0) {
        // at a joint: the average of both directions, slightly narrower on the inside of the bend
        const d0 = dir(joints[i - 1], a);
        const m = [d0[0] + d[0], d0[1] + d[1]];
        const ml = Math.hypot(m[0], m[1]) || 1;
        n = nrm([m[0] / ml, m[1] / ml]);
      }
      const w = (widths[i] + (widths[i + 1] - widths[i]) * t + (bulge[i] ?? 0) * Math.sin(Math.PI * t)) / 2;
      L.push([p[0] + n[0] * w, p[1] + n[1] * w]);
      R.push([p[0] - n[0] * w, p[1] - n[1] * w]);
    }
  }
  const end = joints[N - 1],
    dEnd = dir(joints[N - 2], end),
    nE = nrm(dEnd),
    wE = widths[N - 1] / 2;
  L.push([end[0] + nE[0] * wE, end[1] + nE[1] * wE]);
  R.push([end[0] - nE[0] * wE, end[1] - nE[1] * wE]);
  const pts = [...L];
  if (caps[1]) pts.push([end[0] + dEnd[0] * wE * 0.85, end[1] + dEnd[1] * wE * 0.85]);
  pts.push(...R.reverse());
  if (caps[0]) {
    const st = joints[0],
      d0 = dir(st, joints[1]),
      w0 = widths[0] / 2;
    pts.push([st[0] - d0[0] * w0 * 0.85, st[1] - d0[1] * w0 * 0.85]);
  }
  return smooth(pts, true);
}

let uid = 0;
/** A shape with cel shading: the shadow colour, then the lit colour shifted toward the light, clipped. */
function shaded(d, base, shade, light = [-0.22, -0.06], size = 60, extra = "") {
  const id = `cs${uid++}`;
  return (
    `<clipPath id="${id}"><path d="${d}"/></clipPath><path d="${d}" fill="${shade}"/>` +
    `<path d="${d}" fill="${base}" clip-path="url(#${id})" transform="translate(${f(light[0] * size)} ${f(light[1] * size)})"/>${extra}`
  );
}

// ------------------------------------------------------------------------------------------------ hands

/** Hand poses as finger curls (index, middle, ring, pinky), thumb, spread. */
export const HAND_POSES = {
  relaxed: { curl: [0.3, 0.38, 0.45, 0.52], thumb: 0.25, spread: 0.2 },
  open: { curl: [0.02, 0.02, 0.04, 0.06], thumb: -0.1, spread: 1 },
  point: { curl: [0, 0.95, 1, 1], thumb: 0.75, spread: 0 },
  fist: { curl: [1, 1, 1, 1], thumb: 0.9, spread: 0 },
  grip: { curl: [0.55, 0.6, 0.62, 0.66], thumb: 0.55, spread: 0.1 },
  explain: { curl: [0.12, 0.18, 0.25, 0.32], thumb: 0.05, spread: 0.6 },
};

/**
 * A hand seen from the thumb side (the view of a hand that gestures, points or holds in a 3/4 shot): wrist at
 * (0, 0), the hand along +y, the palm facing +x. Fingers are stacked in depth (index nearest) and curl in the
 * picture plane toward the palm, joint by joint; the thumb opposes them. `angle` turns the hand with the forearm.
 */
export function hand(pose, angle, skin, opts = {}) {
  const p = { ...HAND_POSES.relaxed, ...pose };
  // index, middle, ring, pinky: base (knuckle), lengths of the three phalanges, widths (base .. tip), depth tint
  const fingers = [
    { base: [16, 82], len: [42, 27, 21], w: [21, 19, 17, 13], tint: 0 },
    { base: [8, 88], len: [46, 29, 22], w: [21, 19, 17, 13], tint: 0.25 },
    { base: [0, 86], len: [43, 27, 21], w: [20, 18, 16, 12], tint: 0.45 },
    { base: [-8, 80], len: [33, 21, 17], w: [18, 16, 14, 11], tint: 0.65 },
  ];
  const mix = (a, b, k) => {
    const pa = parseInt(a.slice(1), 16),
      pb = parseInt(b.slice(1), 16);
    const ch = (sh) => Math.round(((pa >> sh) & 255) * (1 - k) + ((pb >> sh) & 255) * k);
    return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, "0")}`;
  };
  const parts = [];
  const spread = p.spread ?? 0;
  // back fingers first
  [3, 2, 1, 0].forEach((i) => {
    const fg = fingers[i];
    const curl = p.curl[i];
    let a = (1.5 - i) * -6 * spread - 4; // the fingers fan out as the hand opens
    const pts = [fg.base];
    [70, 92, 66].forEach((bend, k) => {
      a += bend * curl;
      pts.push(along(pts[pts.length - 1], fg.len[k], a));
    });
    const d = chainOutline(pts, fg.w, [2, 1, 0]);
    const base = mix(skin.base, skin.shade, fg.tint);
    parts.push(
      shaded(
        d,
        base,
        mix(skin.shade, skin.deep, fg.tint),
        [-0.16, -0.04],
        22,
        `<path d="${d}" fill="none" stroke="${skin.deep}" stroke-width="1.5" opacity=".6"/>`,
      ),
    );
    // knuckle creases on the near finger
    if (i === 0)
      pts
        .slice(1, 3)
        .forEach(([x, y]) =>
          parts.push(`<circle cx="${f(x)}" cy="${f(y)}" r="2" fill="${skin.deep}" opacity=".35"/>`),
        );
    // the nail, on the back of the finger tip
    if (i <= 1) {
      const [tx, ty] = pts[3];
      parts.push(
        `<ellipse cx="${f(tx - 3)}" cy="${f(ty - 4)}" rx="4" ry="6.5" fill="${skin.light}" opacity=".75" transform="rotate(${f(-a)} ${f(tx)} ${f(ty)})"/>`,
      );
    }
  });
  // the palm, seen from the thumb side: narrow, with the thenar (thumb muscle) bulging toward the palm side
  const palm = smooth([
    [-14, -6],
    [14, -6],
    [26, 18],
    [31, 46],
    [25, 76],
    [9, 92],
    [-11, 88],
    [-17, 44],
  ]);
  parts.push(
    shaded(
      palm,
      skin.base,
      skin.shade,
      [-0.18, -0.04],
      30,
      `<path d="${palm}" fill="none" stroke="${skin.deep}" stroke-width="1.6" opacity=".5"/>`,
    ),
  );
  parts.push(
    `<path d="M-11 16 C-13 40 -11 64 -6 84" fill="none" stroke="${skin.light}" stroke-width="3" stroke-linecap="round" opacity=".45"/>`,
  );
  // the thumb, nearest: it swings toward the fingers as the hand closes (opposition)
  const t = p.thumb ?? 0;
  const tpts = [[20, 22]];
  let ta = 14 + t * 14;
  [38, 30].forEach((l, k) => {
    ta += k === 0 ? 6 + t * 26 : 8 + t * 40;
    tpts.push(along(tpts[tpts.length - 1], l, ta));
  });
  const thumb = chainOutline(tpts, [27, 21, 15], [3, 1]);
  parts.push(
    shaded(
      thumb,
      skin.base,
      skin.shade,
      [-0.18, -0.04],
      22,
      `<path d="${thumb}" fill="none" stroke="${skin.deep}" stroke-width="1.6" opacity=".6"/>`,
    ),
  );
  const tip = tpts[2];
  parts.push(
    `<ellipse cx="${f(tip[0] - 2)}" cy="${f(tip[1] - 4)}" rx="4.5" ry="7" fill="${skin.light}" opacity=".75" transform="rotate(${f(-ta)} ${f(tip[0])} ${f(tip[1])})"/>`,
  );
  const s = opts.scale ?? 1;
  return `<g transform="rotate(${f(-angle)}) scale(${opts.flip ? -s : s} ${s})">${parts.join("")}</g>`;
}

// ------------------------------------------------------------------------------------------------ body

export const POSE_REST = {
  lean: 0, // the whole upper body, degrees forward
  breath: 0.5,
  shrug: 0, // shoulders up
  arm: 8, // near upper arm
  fore: 12, // near forearm, relative
  wrist: 0,
  armF: 4,
  foreF: 14,
  wristF: 0,
  handN: "relaxed",
  handF: "relaxed",
  handNBlend: null, // { from, to, k } to blend two poses
  handFBlend: null,
};

const H = 280;
const UPPER = 1.38 * H,
  FORE = 1.15 * H;

const blendPose = (b, name) => {
  if (!b) return HAND_POSES[name] ?? HAND_POSES.relaxed;
  const A = HAND_POSES[b.from],
    B = HAND_POSES[b.to];
  const k = b.k;
  return {
    curl: A.curl.map((c, i) => c + (B.curl[i] - c) * k),
    thumb: A.thumb + (B.thumb - A.thumb) * k,
    spread: A.spread + (B.spread - A.spread) * k,
  };
};

/**
 * The whole character. `pose` (POSE_REST), `face` (FACE_REST), `look` (colours). `legs` draws the lower body
 * (full figure); without it the figure ends at the hips (medium shots).
 */
export function character(pose = {}, face = {}, look = {}, opts = {}) {
  uid = 0;
  const p = { ...POSE_REST, ...pose };
  const L = {
    sweater: "#2F6E73",
    sweaterShade: "#21525A",
    shirt: "#EEF0EC",
    trousers: "#2B2D42",
    trousersShade: "#1E1F30",
    shoes: "#4A2E22",
    ...look,
  };
  const skin = { base: SKIN.base, shade: SKIN.shade, deep: SKIN.deep, light: SKIN.light };
  const b = p.breath * 6;
  const sh = p.shrug * 22;
  // skeleton
  const shN = [-150, 66 - sh - b * 0.4];
  const shF = [112, 66 - sh * 0.8 - b * 0.4];
  const elN = along(shN, UPPER, p.arm);
  const wrN = along(elN, FORE, p.arm + p.fore);
  const elF = along(shF, UPPER * 0.92, p.armF);
  const wrF = along(elF, FORE * 0.92, p.armF + p.foreF);
  const parts = [];

  // far arm (behind the torso)
  const farSleeve = chainOutline([shF, elF, wrF], [96, 80, 64], [8, 6], [false, false]);
  parts.push(
    shaded(
      farSleeve,
      L.sweaterShade,
      "#1A4249",
      [-0.25, 0],
      40,
      `<path d="${farSleeve}" fill="none" stroke="#123238" stroke-width="3"/>`,
    ),
  );
  parts.push(
    `<g transform="translate(${f(wrF[0])} ${f(wrF[1])})">${hand(blendPose(p.handFBlend, p.handF), p.armF + p.foreF + p.wristF, { ...skin, base: SKIN.shade, shade: SKIN.deep }, { scale: 0.92 })}</g>`,
  );

  // legs (full figure)
  if (opts.legs) {
    const hipN = [-58, 742],
      hipF = [74, 736];
    const knN = along(hipN, 500, 3),
      anN = along(knN, 470, -2);
    const knF = along(hipF, 495, -4),
      anF = along(knF, 465, 3);
    const legF = chainOutline([hipF, knF, anF], [150, 104, 82], [16, 12]);
    parts.push(shaded(legF, L.trousersShade, "#15162A", [-0.2, 0], 50));
    parts.push(shoe(anF, L.shoes, true));
    const legN = chainOutline([hipN, knN, anN], [168, 112, 88], [18, 14]);
    parts.push(
      shaded(
        legN,
        L.trousers,
        L.trousersShade,
        [-0.22, 0],
        60,
        `<path d="M${f(knN[0] - 30)} ${f(knN[1] - 20)} q20 14 50 4" fill="none" stroke="${L.trousersShade}" stroke-width="5" stroke-linecap="round"/>`,
      ),
    );
    parts.push(shoe(anN, L.shoes, false));
    // pelvis / trousers top
    const hips = smooth([
      [-150, 600],
      [160, 590],
      [176, 700],
      [150, 800],
      [-30, 820],
      [-140, 800],
      [-160, 700],
    ]);
    parts.push(shaded(hips, L.trousers, L.trousersShade, [-0.22, 0], 70));
  }

  // neck: from the shoulders up under the jaw; the jaw casts a shadow on it
  const neck = chainOutline(
    [
      [4, 40],
      [14, -40],
      [22, -96],
    ],
    [132, 108, 104],
    [0, 0],
  );
  parts.push(shaded(neck, SKIN.base, SKIN.shade, [-0.3, 0], 50));
  parts.push(
    `<clipPath id="neck-clip"><path d="${neck}"/></clipPath><path d="M-60 -110 C-10 -60 50 -62 90 -110 L90 -54 C40 -24 -16 -30 -60 -66Z" fill="${SKIN.deep}" opacity=".22" clip-path="url(#neck-clip)"/>`,
  );

  // torso: a sweater over a shirt
  const tor = smooth([
    [-60, -10],
    [-132, 22 - sh],
    [-188, 62 - sh],
    [-206, 150],
    [-204, 260],
    [-186, 470],
    [-178, 640],
    [-40, 664],
    [120, 650],
    [168, 600],
    [184, 420],
    [196, 220],
    [178, 90 - sh * 0.8],
    [150, 40 - sh * 0.8],
    [104, 10 - sh * 0.8],
    [62, -14],
  ]);
  const chestLight = `<path d="M-120 120 C-60 90 20 100 60 160" fill="none" stroke="#3E8A8E" stroke-width="10" stroke-linecap="round" opacity=".55"/>`;
  const folds =
    `<path d="M-150 230 C-120 260 -90 270 -60 268" fill="none" stroke="${L.sweaterShade}" stroke-width="5" stroke-linecap="round"/>` +
    `<path d="M150 260 C120 300 100 330 96 380" fill="none" stroke="${L.sweaterShade}" stroke-width="5" stroke-linecap="round"/>` +
    `<path d="M-176 600 C-100 620 40 626 166 594" fill="none" stroke="${L.sweaterShade}" stroke-width="6" stroke-linecap="round"/>` +
    `<path d="M-170 618 L-168 652 M-120 624 L-119 660 M-70 628 L-69 664 M-20 630 L-20 666 M30 630 L30 664 M80 626 L80 660 M126 616 L126 650" stroke="${L.sweaterShade}" stroke-width="3" opacity=".7"/>`;
  parts.push(
    `<g transform="translate(0 ${f(-b * 0.3)}) rotate(${f(p.lean)} 0 640)">${shaded(tor, L.sweater, L.sweaterShade, [-0.2, -0.02], 120, chestLight + folds)}`,
  );
  // shirt collar in the crew neck
  parts.push(
    `<path d="M-62 -14 C-30 30 34 30 64 -18 C40 4 -30 6 -62 -14Z" fill="${L.sweaterShade}"/>`,
    `<path d="M-50 -8 L-10 40 L4 -2Z" fill="${L.shirt}" stroke="#C9CCC6" stroke-width="2"/>`,
    `<path d="M52 -12 L18 40 L4 -2Z" fill="#D9DCD6" stroke="#B9BCB6" stroke-width="2"/>`,
    `</g>`,
  );

  // head
  const hd = drawHead(face, look.headLook ?? {});
  parts.push(`<g transform="translate(16 -200) scale(1.06)">${hd.svg}</g>`);

  // near arm, in front
  const sleeve = chainOutline([shN, elN, wrN], [106, 88, 72], [16, 8], [true, false]);
  parts.push(
    shaded(
      sleeve,
      L.sweater,
      L.sweaterShade,
      [-0.22, -0.04],
      60,
      // the sleeve folds at the elbow, on the inside of the bend
      `<path d="M${f(elN[0] + 16)} ${f(elN[1] - 30)} q-14 18 -6 40 M${f(elN[0] + 6)} ${f(elN[1] - 10)} q-10 14 -2 28" fill="none" stroke="${L.sweaterShade}" stroke-width="5" stroke-linecap="round" opacity="${f(clamp(p.fore / 60, 0.2, 1))}"/>` +
        `<path d="${sleeve}" fill="none" stroke="#173C42" stroke-width="3.5" stroke-linejoin="round"/>`,
    ),
  );
  // cuff
  const cuffA = along(wrN, -14, p.arm + p.fore);
  parts.push(
    `<path d="${chainOutline([cuffA, wrN], [80, 78], [0], [false, false])}" fill="${L.sweaterShade}"/>`,
  );
  parts.push(
    `<g transform="translate(${f(wrN[0])} ${f(wrN[1])})">${hand(blendPose(p.handNBlend, p.handN), p.arm + p.fore + p.wrist, skin, { scale: 1.05 })}</g>`,
  );

  return { svg: parts.join(""), defs: hd.defs, joints: { shN, elN, wrN, shF, elF, wrF } };
}

function shoe([x, y], col, far) {
  const s = far ? 0.95 : 1;
  const d = smooth([
    [x - 40 * s, y - 20],
    [x + 30 * s, y - 24],
    [x + 110 * s, y + 6],
    [x + 116 * s, y + 40],
    [x - 44 * s, y + 42],
  ]);
  return `<path d="${d}" fill="${far ? "#3A241B" : col}"/><path d="M${f(x - 44 * s)} ${f(y + 36)} L${f(x + 116 * s)} ${f(y + 36)}" stroke="#241510" stroke-width="8"/>`;
}

export { FACE_REST };
