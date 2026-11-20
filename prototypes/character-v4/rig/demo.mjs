/**
 * Character v4 rig prototype: the performance demonstration. Not production code.
 *
 * One continuous scene (1080×1920, 30 fps): Daniel stands at a counter, listening to a colleague (foreground,
 * over the shoulder). She points him to a letter. His eyes go to it first, then his head; he blinks with the
 * shift, reaches, grips, lifts and reads it (the eyes scan the lines), is surprised, worried, saddened, puts it
 * down, looks up at her as she speaks, answers with frustration ("They shut the whole plant down.") and then
 * reassurance ("But we'll be fine. I promise. We'll figure it out."), with beat gestures and lip-sync.
 *
 * The timeline is simulated once (springs, saccades, blinks, emotion blends) into per-frame states; frames are
 * then drawn independently (so they can be rendered in parallel).
 */
import { smooth, f, lerp, clamp, rng } from "../lib.mjs";
import { EMOTIONS, blendAus, lipTrack } from "./face.mjs";
import { projector } from "../model.mjs";
import { VIEW0 } from "./proxy.mjs";
import { ik2, handSvg, torsoSvg, sleeveSvg, neckSvg, C } from "./body.mjs";

export const FPS = 30;
export const W = 1080,
  H = 1920;
export const DURATION = 22.5;
const K = 0.5; // head scale (portrait px → scene px): the face is ~430 px tall

// ------------------------------------------------------------------------------------------------ helpers

const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
/** Keyed value with smooth transitions: keys [[t, value, dur?]] (value number or array); holds between keys. */
function keyed(keys, t) {
  let v = keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [tk, val, dur = 0.4] = keys[i];
    if (t < tk) break;
    const u = ease((t - tk) / dur);
    v = Array.isArray(val) ? val.map((x, j) => lerp(v[j], x, u)) : lerp(v, val, u);
  }
  return v;
}
/** A damped spring following a target, integrated per frame (secondary motion: overshoot and settle). */
function spring(x, v, target, w, z, dt) {
  const a = w * w * (target - x) - 2 * z * w * v;
  v += a * dt;
  x += v * dt;
  return [x, v];
}

// ------------------------------------------------------------------------------------------------ script

const WORDS = [
  ["They", 13.3, 13.5],
  ["shut", 13.5, 13.78],
  ["the", 13.78, 13.88],
  ["whole", 13.88, 14.22],
  ["plant", 14.22, 14.58],
  ["down", 14.58, 15.0],
  ["But", 16.0, 16.18],
  ["we'll", 16.18, 16.42],
  ["be", 16.42, 16.56],
  ["fine", 16.56, 17.05],
  ["I", 17.45, 17.6],
  ["promise", 17.6, 18.25],
  ["We'll", 18.8, 19.02],
  ["figure", 19.02, 19.38],
  ["it", 19.38, 19.48],
  ["out", 19.48, 19.95],
].map(([text, start, end]) => ({ text, start, end }));
const BEATS = [13.88, 14.58, 16.56, 17.6, 19.02, 19.48];

// emotion keys: [t, emotion, intensity, transition]
const EMO = [
  [0, "neutral", 1, 0.1],
  [4.25, "concentration", 0.8, 0.6],
  [7.05, "surprise", 1, 0.18],
  [8.1, "worry", 0.95, 0.5],
  [9.8, "sadness", 0.9, 0.8],
  [12.85, "anger", 0.85, 0.35],
  [15.6, "reassure", 0.9, 0.6],
  [19.9, "joy", 0.85, 0.5],
];

// gaze: [t, target]; the eyes jump (saccade) and the head follows
const GAZE = [
  [0, "her"],
  [1.75, "letter"],
  [4.3, "read"],
  [7.6, "letterTop"],
  [8.2, "away"],
  [10.0, "down"],
  [10.6, "letter"],
  [12.62, "her"],
  [17.0, "herLow"],
  [17.5, "her"],
];
const BLINKS = [0.7, 1.78, 4.25, 6.4, 8.22, 10.2, 12.64, 15.3, 17.05, 20.4];

// the near hand: [t, wrist target, pose weights, hand angle (deg, the way the fingers point), foreshortening]
const REST_N = [800, 1648];
const HAND = [
  [0, REST_N, { rest: 1 }, 118, 0.62],
  [2.5, [790, 1600], { open: 0.6, rest: 0.4 }, 125, 0.75, 0.3],
  [2.62, [726, 1626], { open: 1 }, 138, 0.8, 0.5],
  [3.1, [722, 1640], { pinch: 1 }, 142, 0.85, 0.15],
  [3.32, [806, 1478], { pinch: 1 }, 162, 0.92, 0.9],
  [7.05, [810, 1500], { pinch: 1 }, 160, 0.92, 0.25],
  [8.1, [792, 1516], { pinch: 1 }, 156, 0.92, 0.8],
  [10.6, [716, 1618], { pinch: 1 }, 140, 0.85, 0.9],
  [11.55, [720, 1626], { open: 1 }, 132, 0.8, 0.25],
  [11.85, REST_N, { rest: 1 }, 118, 0.62, 0.5],
  [13.15, [774, 1350], { open: 1 }, 200, 1, 0.45],
  [15.15, [760, 1560], { curl: 1 }, 150, 0.9, 0.5],
  [16.0, [700, 1300], { open: 1 }, 214, 1, 0.55],
  [18.4, [736, 1420], { open: 0.6, curl: 0.4 }, 196, 1, 0.6],
  [20.2, REST_N, { rest: 1 }, 118, 0.62, 0.8],
];
const T_GRIP = 3.18,
  T_LIFT = 3.32,
  T_PLACE = 11.2,
  T_RELEASE = 11.55;

// body: lean (+ forward), shrug (+ up), twist (+ toward her)
const BODY = {
  lean: [
    [0, 0],
    [2.3, 0.25, 0.3],
    [3.3, -0.1, 0.6],
    [4.3, 0.15, 0.6],
    [7.05, -0.5, 0.2],
    [8.1, 0.1, 0.6],
    [9.8, 0.25, 0.8],
    [12.85, 0.3, 0.4],
    [15.6, 0.15, 0.6],
    [21, 0, 1],
  ],
  shrug: [
    [0, 0],
    [2.35, 0.12, 0.2],
    [2.7, 0, 0.3],
    [7.05, 0.35, 0.18],
    [8.1, 0.12, 0.5],
    [9.8, -0.45, 0.9],
    [12.85, 0.15, 0.4],
    [15.2, -0.2, 0.4],
    [15.6, -0.05, 0.6],
  ],
  twist: [
    [0, 0.2],
    [1.9, 0, 0.6],
    [12.7, 0.25, 0.8],
    [16, 0.4, 0.8],
  ],
};
// the colleague (foreground): turn toward him and nods while she talks
const HER = {
  turn: [
    [0, 0.15],
    [1.4, 0.05, 0.4],
    [12.2, 0.4, 0.5],
    [14.4, 0.25, 0.6],
    [20.4, 0.35, 0.5],
  ],
  nod: [
    [1.4, 1.5],
    [12.3, 13.4],
    [20.6, 21.1],
  ],
};
// camera: zoom about Daniel's face
const CAM = [
  [0, 1],
  [4.0, 1.16, 3.5],
  [10.4, 1.08, 1.6],
  [12.6, 1.1, 1.0],
  [20.5, 1.03, 2.0],
];

// ------------------------------------------------------------------------------------------------ simulate

/** Scene points the eyes can aim at, for a given time and letter state. */
function targetPoint(name, t, letter) {
  const c = letter.center;
  switch (name) {
    case "her":
      return [215, 905, 45];
    case "herLow":
      return [250, 1010, 45];
    case "letter":
      return [c[0], c[1], 25];
    case "letterTop":
      return [c[0] - 20, c[1] - 120, 25];
    case "away":
      return [880, 1290, 30];
    case "down":
      return [760, 1500, 30];
    case "read": {
      // four lines; on each, three fixations left→right, then a return sweep
      const local = t - 4.3;
      const line = Math.min(3, Math.floor(local / 0.68));
      const u = local - line * 0.68;
      const fix = Math.min(2, Math.floor(u / 0.2));
      const x = c[0] + 70 - fix * 55;
      const y = c[1] - 120 + line * 38;
      return [x, y, 25];
    }
    default:
      return [540, 900, 200];
  }
}

/** Letter geometry: on the desk, lifted into the hand, put back down. */
function letterAt(t, pinch, wristSpring) {
  const flat = [
    [640, 1598],
    [826, 1588],
    [848, 1676],
    [620, 1690],
  ];
  const placed = [
    [600, 1600],
    [786, 1592],
    [806, 1680],
    [580, 1692],
  ];
  const heldRel = [
    [-246, -404],
    [-26, -436],
    [16, 20],
    [-218, 26],
  ];
  const near = pinch;
  let pts,
    held = 0;
  if (t < T_GRIP) pts = flat;
  else if (t < T_PLACE + 0.4) {
    // relative to the grip: from flat-relative toward upright as it lifts, back toward flat as it lands
    const relFlat = flat.map((p) => [p[0] - 830, p[1] - 1672]);
    const relPlace = placed.map((p) => [p[0] - 790, p[1] - 1676]);
    const up = ease((t - T_LIFT) / 0.7);
    const down = ease((t - (T_PLACE - 0.5)) / 0.8);
    held = up * (1 - down);
    const rel = heldRel.map((h, i) => {
      const from = t < T_PLACE - 0.5 ? relFlat[i] : relPlace[i];
      return [lerp(from[0], h[0], held), lerp(from[1], h[1], held)];
    });
    // a little lag in the paper (it bends as it moves)
    const lag = [wristSpring?.[0] ?? 0, wristSpring?.[1] ?? 0];
    pts = rel.map((r, i) => [
      near[0] + r[0] - (i < 2 ? lag[0] * 0.05 : 0),
      near[1] + r[1] - (i < 2 ? lag[1] * 0.05 : 0),
    ]);
  } else pts = placed;
  const center = [
    (pts[0][0] + pts[1][0] + pts[2][0] + pts[3][0]) / 4,
    (pts[0][1] + pts[1][1] + pts[2][1] + pts[3][1]) / 4,
  ];
  return { pts, center, held };
}

export function simulate() {
  const N = Math.round(DURATION * FPS);
  const dt = 1 / FPS;
  const lips = lipTrack(WORDS);
  const states = [];
  // springs
  let hy = 24,
    hyv = 0,
    hp = 2,
    hpv = 0,
    hr = -1.5,
    hrv = 0;
  let wx = REST_N[0],
    wxv = 0,
    wy = REST_N[1],
    wyv = 0;
  let eye = targetPoint("her", 0, letterAt(0, [0, 0]));
  let eyeFrom = eye,
    eyeTo = eye,
    sacT = -1,
    gazeName = "her",
    lastLetter = letterAt(0, [0, 0]);
  const blinks = BLINKS.slice();
  // a one-second pre-roll at t = 0 so every spring starts at rest on its first target (no frame-0 snap)
  for (let n = -30; n < N; n++) {
    const t = Math.max(0, n * dt);
    // ---- body
    const lean = keyed(BODY.lean, t),
      shrug = keyed(BODY.shrug, t),
      twist = keyed(BODY.twist, t);
    const breathe = Math.sin(t * 2 * Math.PI * 0.24) * (1 + 0.3 * Math.max(0, shrug));
    const nb = [585 - lean * 30 - twist * 18, 930 - shrug * 26 + lean * 18 - breathe * 3];
    const sf = [350 - twist * 26 - lean * 20, 992 - shrug * 30 + lean * 14 - breathe * 2];
    const sn = [898 - twist * 38 - lean * 24, 986 - shrug * 34 + lean * 22 - breathe * 3];
    const waist = [600, 1420];
    // ---- hand (spring toward keyed targets: overshoot and settle)
    let tgt = HAND[0][1],
      pose = HAND[0][2],
      angle = HAND[0][3],
      fy = HAND[0][4];
    for (let i = 1; i < HAND.length; i++) {
      const [tk, wpos, ps, ang, fyk, dur = 0.5] = HAND[i];
      if (t < tk) break;
      const u = ease((t - tk) / dur);
      tgt = [lerp(tgt[0], wpos[0], u), lerp(tgt[1], wpos[1], u)];
      const keys = new Set([...Object.keys(pose), ...Object.keys(ps)]);
      const np = {};
      for (const k of keys) np[k] = lerp(pose[k] ?? 0, ps[k] ?? 0, u);
      pose = np;
      angle = lerp(angle, ang, u);
      fy = lerp(fy, fyk, u);
    }
    // beat gestures: a quick down-up stroke on stressed words while the hand is up
    let beat = 0;
    for (const b of BEATS) {
      const u = (t - b + 0.08) / 0.32;
      if (u > 0 && u < 1) beat += Math.sin(u * Math.PI) * 34;
    }
    [wx, wxv] = spring(wx, wxv, tgt[0], 11, 0.72, dt);
    [wy, wyv] = spring(wy, wyv, tgt[1] + (wy < 1500 ? beat : 0), 11, 0.72, dt);
    // the arms hang from the shoulder joints, below and outside the top of the shoulder line
    const jn = [sn[0] + 36, sn[1] + 62],
      jf = [sf[0] - 18, sf[1] + 62];
    const ik = ik2(jn, [wx, wy], 440, 360, [0.45, 1]);
    const ikF = ik2(jf, [445, 1652], 440, 360, [-0.45, 1]);
    // ---- the letter follows the pinch point (computed from the hand frame)
    const hand = handSvg("probe", { at: ik.wrist, angle: (angle * Math.PI) / 180, scale: 1.5, fy, pose });
    const letter = letterAt(t, hand.pinch, [wxv, wyv]);
    // ---- gaze
    let gname = gazeName;
    for (const [tg, nm] of GAZE) if (t >= tg) gname = nm;
    const wanted = targetPoint(gname, t, letter);
    if (gname !== gazeName) {
      gazeName = gname;
      eyeFrom = eye;
      eyeTo = wanted;
      sacT = t;
      // large shifts bring a blink with them
      const dx = eyeTo[0] - eyeFrom[0],
        dy = eyeTo[1] - eyeFrom[1];
      if (Math.hypot(dx, dy) > 260 && !blinks.some((b) => Math.abs(b - t) < 0.25)) blinks.push(t + 0.02);
    }
    if (sacT >= 0 && t - sacT < 0.07)
      eye = eyeFrom.map((v, i) => lerp(v, wanted[i], ease((t - sacT) / 0.07)));
    else if (gname === "read") {
      // reading: discrete fixations (fast saccades between them)
      eye = eye.map((v, i) => lerp(v, wanted[i], 0.65));
    } else eye = eye.map((v, i) => lerp(v, wanted[i], 0.35)); // smooth pursuit of a moving target
    lastLetter = letter;
    // ---- head: points the face part of the way toward the eye target, after the eyes (spring lag)
    const E = EMOTIONS;
    const emoNow = (tt) => {
      let prev = EMO[0],
        cur = EMO[0];
      for (const e of EMO)
        if (tt >= e[0]) {
          prev = cur;
          cur = e;
        }
      const u = ease((tt - cur[0]) / cur[3]);
      return { prev, cur, u };
    };
    const em = emoNow(t);
    const mixEm = (sel) => {
      const a = E[em.prev[1]],
        b = E[em.cur[1]];
      return sel(a, em.prev[2]).map((v, i) => lerp(v, sel(b, em.cur[2])[i], em.u));
    };
    const headOff = mixEm((e, k) => e.head.map((v) => v * k));
    const sceneHead = [nb[0] + 30, nb[1] - 300];
    const dxh = eye[0] - sceneHead[0],
      dyh = eye[1] - sceneHead[1];
    const dz = (eye[2] ?? 30) * 18;
    const gyaw = (Math.atan2(-dxh, dz) * 180) / Math.PI;
    const gpitch = (Math.atan2(dyh, dz) * 180) / Math.PI;
    const delayed = sacT >= 0 && t - sacT < 0.12; // the head starts ~4 frames after the eyes
    const yawT = clamp(lerp(18, gyaw, 0.55) + headOff[0] + twist * 6, 14, 42);
    let nodBeat = 0;
    for (const b of BEATS) {
      const u = (t - b) / 0.28;
      if (u > 0 && u < 1) nodBeat += Math.sin(u * Math.PI) * 3.2;
    }
    const pitchT = clamp(lerp(2, gpitch, 0.5) + headOff[1] + lean * 3 + nodBeat, -8, 15);
    const rollT = -1.5 + headOff[2];
    if (!delayed) {
      [hy, hyv] = spring(hy, hyv, yawT, 7.5, 0.82, dt);
      [hp, hpv] = spring(hp, hpv, pitchT, 8.5, 0.8, dt);
    } else {
      [hy, hyv] = spring(hy, hyv, hy, 7.5, 0.82, dt);
      [hp, hpv] = spring(hp, hpv, hp, 8.5, 0.8, dt);
    }
    [hr, hrv] = spring(hr, hrv, rollT, 6, 0.85, dt);
    // ---- face: emotion (brows lead by 80 ms), speech on top, blinks
    const emAus = (tt) => {
      const e = emoNow(tt);
      return blendAus([
        [E[e.prev[1]].aus, e.prev[2] * (1 - e.u)],
        [E[e.cur[1]].aus, e.cur[2] * e.u],
      ]);
    };
    const now = emAus(t),
      lead = emAus(t + 0.08);
    for (const k of ["browInnerUp", "browOuterUp", "browDown"]) now[k] = lead[k] ?? 0;
    const sp = lips(t);
    const MOUTH = [
      "jawOpen",
      "lipsPart",
      "pucker",
      "lipStretch",
      "lipPress",
      "smile",
      "frown",
      "upperLipRaise",
      "lowerLipTuck",
      "chinRaise",
    ];
    const aus = { ...now };
    for (const k of MOUTH) aus[k] = (aus[k] ?? 0) * (1 - 0.55 * sp.speaking);
    for (const [k, v] of Object.entries(sp.aus)) aus[k] = (aus[k] ?? 0) + v;
    // accents on stressed words: the brows lift a touch
    let accent = 0;
    for (const b of BEATS) {
      const u = (t - b + 0.05) / 0.3;
      if (u > 0 && u < 1) accent += Math.sin(u * Math.PI);
    }
    aus.browOuterUp = (aus.browOuterUp ?? 0) + accent * 0.22;
    aus.browInnerUp = (aus.browInnerUp ?? 0) + accent * 0.12;
    let lid = mixEm((e, k) => [(e.lids ?? 0) * k])[0];
    for (const b of blinks) {
      const slow = Math.abs(b - 10.2) < 0.01 ? 1.8 : 1;
      const u = (t - b) / (0.3 * slow);
      if (u < 0 || u > 1) continue;
      const c = u < 0.3 ? ease(u / 0.3) : u < 0.4 ? 1 : 1 - ease((u - 0.4) / 0.6);
      lid = Math.max(lid, c);
    }
    // ---- her
    const herTurn = keyed(HER.turn, t);
    let herNod = 0;
    for (const [a, b] of HER.nod)
      if (t > a && t < b) herNod += Math.sin(((t - a) / (b - a)) * Math.PI * 2) * 10;
    const cam = keyed(CAM, t);
    if (n < 0) continue;
    states.push({
      t,
      nb,
      sf,
      sn,
      waist,
      lean,
      head: {
        yaw: hy,
        pitch: hp,
        roll: hr,
        aus,
        lids: { n: lid, f: lid },
        pupil: em.cur[1] === "surprise" ? 0.85 : 1,
      },
      eye,
      arm: { shoulder: jn, elbow: ik.elbow, wrist: ik.wrist, angle, fy, pose },
      armF: { shoulder: jf, elbow: ikF.elbow, wrist: ikF.wrist },
      letter: { pts: letter.pts, held: letter.held },
      her: { turn: herTurn, nod: herNod },
      cam,
      speaking: sp.speaking,
    });
  }
  void lastLetter;
  return states;
}

// ------------------------------------------------------------------------------------------------ draw

/** The counter: flat shapes, drawn in front of the body every frame (cheap). */
function deskSvg() {
  return [
    `<path d="M-200 1566 L1280 1548 L1280 1728 L-200 1734 Z" fill="url(#deskTop)"/>`,
    `<path d="M-200 1566 L1280 1548" stroke="#2A1A10" stroke-width="3" opacity=".6"/>`,
    `<path d="M-200 1730 L1280 1724" stroke="#A47652" stroke-width="3" opacity=".7"/>`,
    `<path d="M-200 1734 L1280 1728 L1280 2120 L-200 2120 Z" fill="url(#deskFront)"/>`,
  ].join("");
}

const DESK_DEFS = `<linearGradient id="deskTop" x1="0" y1="1560" x2="0" y2="1730" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#4E3322"/><stop offset="1" stop-color="#7A5236"/></linearGradient><linearGradient id="deskFront" x1="0" y1="1720" x2="0" y2="1920" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#3A2618"/><stop offset="1" stop-color="#1E140D"/></linearGradient>`;

/** The static set: the wall (soft newsroom lights) and the counter. Rendered once when cached. */
export function setSvg() {
  const R = rng(4);
  let bokeh = "";
  for (let i = 0; i < 14; i++) {
    const x = R.range(380, 1080),
      y = R.range(80, 1300),
      r = R.range(18, 60);
    bokeh += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${R() < 0.5 ? "#E8CFA4" : "#A9C6D8"}" opacity="${f(R.range(0.05, 0.12))}"/>`;
  }
  return [
    `<defs><radialGradient id="wall" cx="860" cy="760" r="1200" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#4A5C61"/><stop offset=".45" stop-color="#2C383D"/><stop offset="1" stop-color="#121719"/></radialGradient>`,
    `<linearGradient id="deskTop" x1="0" y1="1560" x2="0" y2="1730" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#4E3322"/><stop offset="1" stop-color="#7A5236"/></linearGradient>`,
    `<linearGradient id="deskFront" x1="0" y1="1720" x2="0" y2="1920" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#3A2618"/><stop offset="1" stop-color="#1E140D"/></linearGradient></defs>`,
    `<rect x="-200" y="-200" width="1480" height="2320" fill="url(#wall)"/>`,
    `<g filter="url(#sb16)">${bokeh}</g>`,
    `<path d="M-200 1566 L1280 1548 L1280 1728 L-200 1734 Z" fill="url(#deskTop)"/>`,
    `<path d="M-200 1566 L1280 1548" stroke="#2A1A10" stroke-width="3" opacity=".6"/>`,
    `<path d="M-200 1730 L1280 1724" stroke="#A47652" stroke-width="3" opacity=".7"/>`,
    `<path d="M-200 1734 L1280 1728 L1280 2120 L-200 2120 Z" fill="url(#deskFront)"/>`,
  ].join("");
}

const SET_DEFS = `<filter id="herBlur" filterUnits="userSpaceOnUse" x="-260" y="680" width="820" height="1480"><feGaussianBlur stdDeviation="6"/></filter><filter id="sb16" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="16"/></filter><filter id="sb6" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="6"/></filter>`;

function paper(letter) {
  const [a, b, c, d] = letter.pts;
  const held = letter.held;
  const L = (p, q, u) => [lerp(p[0], q[0], u), lerp(p[1], q[1], u)];
  const out = [];
  // the shadow under it: on the desk when flat, on the jacket when held
  out.push(
    `<path d="${smooth(
      [a, b, c, d].map((p) => [p[0] + 10 + held * 14, p[1] + 8 + held * 10]),
      true,
      0.05,
    )}" fill="#0A0605" opacity="${f(0.45 - held * 0.15)}" filter="url(#b10)"/>`,
  );
  // a slight bend: the free top edge sags back
  const sag = held * 26;
  const top = `M${f(a[0])} ${f(a[1])} Q${f((a[0] + b[0]) / 2)} ${f((a[1] + b[1]) / 2 + sag)} ${f(b[0])} ${f(b[1])}`;
  const body = `${top} L${f(c[0])} ${f(c[1])} L${f(d[0])} ${f(d[1])} Z`;
  out.push(`<path d="${body}" fill="${held > 0.5 ? "#E4DCCF" : "#EDE6DA"}"/>`);
  out.push(`<path d="${body}" fill="#9A8C7A" opacity="${f(0.15 + held * 0.15)}" filter="url(#b6)"/>`);
  // folds in thirds, and the text: printed side up on the desk, showing through from behind when held
  for (const u of [1 / 3, 2 / 3]) {
    const p = L(a, d, u),
      q = L(b, c, u);
    out.push(
      `<path d="M${f(p[0])} ${f(p[1])} L${f(q[0])} ${f(q[1])}" stroke="#B8AC9C" stroke-width="2" opacity=".7"/>`,
    );
  }
  let lines = "";
  for (let i = 0; i < 12; i++) {
    const v = 0.1 + i * 0.065;
    const p = L(L(a, d, v), L(b, c, v), 0.1),
      q = L(L(a, d, v), L(b, c, v), i % 4 === 3 ? 0.55 : 0.88);
    lines += `M${f(p[0])} ${f(p[1])} L${f(q[0])} ${f(q[1])} `;
  }
  out.push(
    `<path d="${lines}" stroke="#3A3530" stroke-width="${held > 0.5 ? 3 : 2.4}" opacity="${f(held > 0.5 ? 0.12 : 0.55)}"/>`,
  );
  out.push(`<path d="${body}" fill="none" stroke="#6E6254" stroke-width="1.6" opacity=".6"/>`);
  return out.join("");
}

/** The colleague in the foreground: back of her head and shoulder, out of focus. */
function herSvg(s) {
  const turn = s.her.turn,
    nod = s.her.nod;
  const hc = [150 + turn * 12, 975 + nod];
  const out = [];
  out.push(
    `<path d="${smooth(
      [
        [-200, 1250],
        [120, 1180],
        [330, 1230],
        [430, 1400],
        [470, 1700],
        [470, 2120],
        [-200, 2120],
      ],
      true,
    )}" fill="#8A6748"/>`,
  );
  out.push(
    `<path d="${smooth(
      [
        [-200, 1300],
        [120, 1230],
        [330, 1280],
        [420, 1440],
        [-200, 1500],
      ],
      true,
    )}" fill="#A9825E" opacity=".55"/>`,
  );
  out.push(
    `<path d="${smooth(
      [
        [60, 1130],
        [250, 1120],
        [300, 1240],
        [180, 1280],
        [70, 1240],
      ],
      true,
    )}" fill="#B98A6A"/>`,
  );
  // the cheek and jaw show more as she turns toward him
  const cheek = 36 + turn * 70;
  out.push(
    `<path d="${smooth(
      [
        [hc[0] + 120, hc[1] - 60],
        [hc[0] + 150 + cheek * 0.4, hc[1] + 30],
        [hc[0] + 120 + cheek * 0.5, hc[1] + 150],
        [hc[0] + 60, hc[1] + 210],
        [hc[0] + 40, hc[1] + 60],
      ],
      true,
    )}" fill="#C99273"/>`,
  );
  out.push(
    `<ellipse cx="${f(hc[0] + 150 + turn * 6)}" cy="${f(hc[1] + 40)}" rx="20" ry="36" fill="#B57A60"/>`,
  );
  out.push(
    `<path d="${smooth(
      [
        [hc[0] - 170, hc[1] + 40],
        [hc[0] - 150, hc[1] - 160],
        [hc[0], hc[1] - 220],
        [hc[0] + 150, hc[1] - 150],
        [hc[0] + 165 - turn * 20, hc[1] - 10],
        [hc[0] + 110, hc[1] + 120],
        [hc[0] - 20, hc[1] + 200],
        [hc[0] - 150, hc[1] + 170],
      ],
      true,
    )}" fill="#2A1C16"/>`,
  );
  out.push(`<ellipse cx="${f(hc[0] - 120)}" cy="${f(hc[1] + 130)}" rx="80" ry="70" fill="#22160F"/>`);
  out.push(
    `<path d="${smooth(
      [
        [hc[0] - 160, hc[1] - 40],
        [hc[0] - 100, hc[1] - 190],
        [hc[0] + 40, hc[1] - 210],
      ],
      false,
    )}" fill="none" stroke="#7A5A44" stroke-width="16" opacity=".55"/>`,
  );
  return `<g id="colleague" filter="url(#herBlur)">${out.join("")}</g>`;
}

/**
 * One frame. `head` is the head rig; `cache` (optional) supplies pre-rendered layers: { set: dataURI, grade:
 * dataURI } so the static set and the grade are composited instead of re-rendered.
 */
export function frameSvg(s, head, cache = {}, pad = 0, skip = new Set()) {
  const defs = [SET_DEFS, DESK_DEFS];
  const parts = [];
  // head first (its pivot places it on the neck)
  const hd = head.draw({
    yaw: s.head.yaw,
    pitch: s.head.pitch,
    roll: s.head.roll,
    aus: s.head.aus,
    lids: s.head.lids,
    look: [0, 0, 60],
    pupil: s.head.pupil,
    _scene: true,
    ...lookOf(s),
  });
  defs.push(hd.defs);
  const neckTop = [s.nb[0] + 22, s.nb[1] - 160];
  const T = [neckTop[0] - K * hd.info.pivot[0], neckTop[1] - K * hd.info.pivot[1]];
  const toScene = (p) => [T[0] + K * p[0], T[1] + K * p[1]];
  // camera (zoom about the face)
  const fc = toScene([780, 900]);
  const z = s.cam;
  const camT = `translate(${f(fc[0])} ${f(fc[1])}) scale(${f(z)}) translate(${f(-fc[0])} ${f(-fc[1])})`;
  const herZ = 1 + (z - 1) * 1.35;
  const herT = `translate(${f(fc[0])} ${f(fc[1])}) scale(${f(herZ)}) translate(${f(-fc[0])} ${f(-fc[1])})`;
  if (skip.has("set"));
  else if (cache.set)
    parts.push(
      `<g transform="${camT}"><image href="${cache.set}" x="-200" y="-200" width="1480" height="2320"/></g>`,
    );
  else parts.push(`<g transform="${camT}">${setSvg()}</g>`);
  const body = [];
  // far arm (behind the torso, hand on the counter)
  const fa = sleeveSvg("slvF", {
    shoulder: s.armF.shoulder,
    elbow: s.armF.elbow,
    wrist: s.armF.wrist,
    near: false,
    light: 0.7,
  });
  defs.push(fa.defs);
  body.push(fa.svg);
  const nk = neckSvg({
    nb: s.nb,
    top: neckTop,
    beardBottom: (hd.info.beardLoop ?? []).filter((p) => p[1] > 1150).map(toScene),
  });
  defs.push(nk.defs);
  body.push(nk.svg);
  const ts = torsoSvg({ nb: s.nb, sf: s.sf, sn: s.sn, w: s.waist });
  defs.push(ts.defs);
  body.push(ts.svg);
  if (!skip.has("head"))
    body.push(`<g transform="translate(${f(T[0])} ${f(T[1])}) scale(${K})">${hd.svg}</g>`);
  // the far hand on the counter
  const hf = handSvg("hF", {
    at: s.armF.wrist,
    angle: (100 * Math.PI) / 180,
    scale: 1.45,
    fy: 0.62,
    pose: { rest: 1 },
    lit: 0.8,
    mirror: true,
  });
  defs.push(hf.defs);
  // counter in front of the body, then the letter, then the near arm and hand
  body.push(`<path d="M-200 1566 L1280 1548 L1280 2120 L-200 2120 Z" fill="none"/>`);
  body.push(deskSvg());
  body.push(
    `<ellipse cx="${f(s.armF.wrist[0] - 30)}" cy="${f(s.armF.wrist[1] + 70)}" rx="120" ry="34" fill="#0A0605" opacity=".45" filter="url(#b10)"/>`,
  );
  body.push(hf.svg);
  if (s.letter.held < 0.5) body.push(paper(s.letter));
  const na = sleeveSvg("slvN", {
    shoulder: s.arm.shoulder,
    elbow: s.arm.elbow,
    wrist: s.arm.wrist,
    near: true,
    light: 0.35,
  });
  defs.push(na.defs);
  if (s.arm.wrist[1] > 1540)
    body.push(
      `<ellipse cx="${f(s.arm.wrist[0] - 40)}" cy="${f(s.arm.wrist[1] + 80)}" rx="130" ry="34" fill="#0A0605" opacity=".45" filter="url(#b10)"/>`,
    );
  body.push(na.svg);
  if (s.letter.held >= 0.5) body.push(paper(s.letter));
  const hn = handSvg("hN", {
    at: s.arm.wrist,
    angle: (s.arm.angle * Math.PI) / 180,
    scale: 1.5,
    fy: s.arm.fy,
    pose: s.arm.pose,
    lit: 0.45,
  });
  defs.push(hn.defs);
  body.push(hn.svg);
  if (skip.has("body"))
    parts.push(
      `<g transform="${camT}">${skip.has("head") ? "" : `<g transform="translate(${f(T[0])} ${f(T[1])}) scale(${K})">${hd.svg}</g>`}</g>`,
    );
  else parts.push(`<g transform="${camT}">${body.join("")}</g>`);
  if (!skip.has("colleague")) parts.push(`<g transform="${herT}">${herSvg(s)}</g>`);
  if (skip.has("grade") || cache.gradeInPixels);
  else if (cache.grade) parts.push(`<image href="${cache.grade}" x="0" y="0" width="${W}" height="${H}"/>`);
  else parts.push(gradeSvg());
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W + 2 * pad}" height="${H + 2 * pad}" viewBox="${-pad} ${-pad} ${W + 2 * pad} ${H + 2 * pad}"><defs>${defs.join("")}</defs>${parts.join("")}</svg>`;
}

/** The eyes' target as a camera-space vector from the head origin (cm), from the scene point they look at. */
function lookOf(s) {
  // scene position of the head origin: the neck top minus the pivot offset, at the head scale
  const view = { ...VIEW0, yaw: s.head.yaw, pitch: s.head.pitch, roll: s.head.roll };
  const pr = projector(view);
  const piv = pr.p3([0, -6.2, -2.4]);
  const o = pr.p3([0, 0, 0]);
  const neckTop = [s.nb[0] + 22, s.nb[1] - 160];
  const O = [neckTop[0] + K * (o[0] - piv[0]), neckTop[1] + K * (o[1] - piv[1])];
  const pxPerCm = VIEW0.S * K;
  const e = s.eye;
  return { look: [(e[0] - O[0]) / pxPerCm, -(e[1] - O[1]) / pxPerCm, e[2] ?? 30] };
}

/** Vignette and film grain (rendered once when cached). */
export function gradeSvg() {
  return `<defs><radialGradient id="vig" cx="600" cy="860" r="1250" gradientUnits="userSpaceOnUse"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></radialGradient><filter id="grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="2"/><feColorMatrix type="matrix" values="0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  0.16 0 0 0 -0.04"/></filter></defs><rect width="${W}" height="${H}" fill="url(#vig)"/><rect width="${W}" height="${H}" filter="url(#grain)"/>`;
}

export { C };
