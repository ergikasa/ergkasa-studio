/**
 * Character v4 rig prototype: the face controls. Not production code.
 *
 * Action units (FACS-like) are DEFORMATION FIELDS in head space, not pictures: each one moves every point near
 * its handles (landmarks, the proxy, the paint bound to it, the beard) by a smooth falloff, and the jaw is a
 * rotation about the temporomandibular axis. Because the features, the silhouette, the shading and the beard all
 * read their positions through the same field, a smile lifts the cheek shading and the beard with the mouth
 * corner, and an open jaw moves the chin, the lower lip and the beard together.
 *
 * Eyelids are explicit (they must close exactly): the upper lid line is blended toward the lower lid.
 */
import { landmarks } from "../model.mjs";
import { clamp, lerp } from "../lib.mjs";

// ------------------------------------------------------------------------------------------------ landmarks

/** The v4 landmarks plus the inner lip edges, split so the mouth can open. */
export function rigLandmarks() {
  const L = landmarks();
  const st = L.stomion;
  L.stomionU = [...st];
  L.stomionL = [...st];
  for (const s of ["n", "f"]) {
    const sx = s === "n" ? 1 : -1;
    L[`${s}.innerU`] = [st[0] + 1.3 * sx, st[1] + 0.03, st[2] - 0.3];
    L[`${s}.innerL`] = [st[0] + 1.3 * sx, st[1] + 0.0, st[2] - 0.3];
    // teeth: the front of the upper and lower incisors (seen when the lips part)
    L[`${s}.toothU`] = [0.9 * sx, -6.55, 9.35];
    L[`${s}.toothL`] = [0.85 * sx, -7.15, 9.2];
  }
  L.toothU = [0, -6.55, 9.55];
  L.toothL = [0, -7.2, 9.4];
  L.tongue = [0, -7.35, 8.6];
  return L;
}

// ------------------------------------------------------------------------------------------------ action units

/**
 * Handles: [anchor (landmark name, mirrored for both sides with "*." prefix), radius cm, displacement per unit
 * amount [dx, dy, dz] for the near side (x mirrored on the far side)].
 */
const AU = {
  browInnerUp: [
    ["*.browIn", 1.5, [0.04, 0.5, 0.05]],
    ["*.browInTop", 1.5, [0.04, 0.45, 0.04]],
    ["*.browPeak", 1.3, [0, 0.16, 0]],
  ],
  browOuterUp: [
    ["*.browTail", 1.6, [0, 0.4, 0]],
    ["*.browPeak", 1.6, [0, 0.36, 0]],
    ["*.creaseOut", 1.0, [0, 0.12, 0]],
  ],
  browDown: [
    ["*.browIn", 1.4, [-0.28, -0.32, 0.08]],
    ["*.browInTop", 1.4, [-0.25, -0.3, 0.08]],
    ["*.browPeak", 1.6, [-0.08, -0.22, 0.04]],
    ["*.browTail", 1.4, [0, -0.1, 0]],
    ["*.creasePeak", 1.0, [0, -0.1, 0.02]],
  ],
  cheekRaise: [
    ["*.malar", 2.0, [0.05, 0.32, 0.12]],
    ["*.bagLow", 1.2, [0, 0.2, 0.06]],
    ["*.lidLowLow", 0.9, [0, 0.12, 0]],
    ["*.lidLowOut", 0.8, [0, 0.12, 0]],
    ["*.nasolabialTop", 1.0, [0.06, 0.08, 0.05]],
  ],
  lidTight: [
    ["*.lidLowLow", 0.8, [0, 0.13, 0]],
    ["*.lidLowIn", 0.8, [0, 0.08, 0]],
    ["*.lidLowOut", 0.8, [0, 0.1, 0]],
    ["*.lidUpPeak", 0.6, [0, -0.06, 0]],
  ],
  noseWrinkle: [
    ["*.alare", 1.0, [0.02, 0.16, 0.0]],
    ["*.alarTop", 1.0, [0, 0.18, 0]],
    ["*.nasolabialTop", 1.0, [0.04, 0.12, 0]],
    ["*.browIn", 1.0, [-0.1, -0.12, 0]],
  ],
  upperLipRaise: [
    ["*.upperLipMid", 1.0, [0, 0.22, 0.04]],
    ["*.bowPeak", 0.9, [0, 0.18, 0.04]],
    ["*.innerU", 0.9, [0, 0.16, 0]],
    ["stomionU", 0.9, [0, 0.18, 0]],
    ["*.nasolabialMid", 1.2, [0.02, 0.1, 0]],
  ],
  smile: [
    ["*.cheilion", 1.2, [0.32, 0.36, -0.28]],
    ["*.innerU", 0.9, [0.22, 0.24, -0.15]],
    ["*.innerL", 0.9, [0.24, 0.22, -0.15]],
    ["*.upperLipMid", 1.0, [0.12, 0.12, -0.06]],
    ["*.lowerLipMid", 1.0, [0.12, 0.14, -0.06]],
    ["*.nasolabialMid", 1.3, [0.12, 0.12, 0.06]],
    ["*.nasolabialLow", 1.2, [0.14, 0.12, 0.04]],
    ["*.malar", 1.8, [0.04, 0.12, 0.06]],
  ],
  frown: [
    ["*.cheilion", 1.1, [0.04, -0.3, -0.04]],
    ["*.innerU", 0.8, [0.02, -0.16, 0]],
    ["*.innerL", 0.8, [0.02, -0.2, 0]],
    ["*.lowerLipMid", 1.0, [0, -0.08, 0]],
    ["*.nasolabialLow", 1.0, [0.02, -0.1, 0]],
  ],
  chinRaise: [
    ["sulcus", 1.4, [0, 0.12, 0.12]],
    ["labInf", 0.9, [0, 0.14, 0.12]],
    ["*.lowerLipMid", 0.9, [0, 0.12, 0.1]],
    ["pogonion", 1.4, [0, 0.1, 0.16]],
  ],
  lipStretch: [
    ["*.cheilion", 1.1, [0.36, -0.06, -0.12]],
    ["*.innerU", 0.8, [0.26, -0.02, -0.08]],
    ["*.innerL", 0.8, [0.26, -0.04, -0.08]],
    ["*.upperLipMid", 0.9, [0.12, 0, -0.04]],
    ["*.lowerLipMid", 0.9, [0.12, 0, -0.04]],
  ],
  lipPress: [
    ["labSup", 0.7, [0, -0.12, -0.04]],
    ["*.bowPeak", 0.7, [0, -0.12, -0.04]],
    ["*.upperLipMid", 0.8, [0, -0.1, -0.04]],
    ["labInf", 0.7, [0, 0.14, -0.04]],
    ["*.lowerLipMid", 0.8, [0, 0.12, -0.04]],
    ["*.cheilion", 0.8, [0.04, 0, -0.04]],
  ],
  pucker: [
    ["*.cheilion", 1.1, [-0.62, 0.02, 0.28]],
    ["*.innerU", 0.8, [-0.5, 0.02, 0.3]],
    ["*.innerL", 0.8, [-0.5, 0.0, 0.3]],
    ["*.upperLipMid", 0.9, [-0.32, 0.04, 0.32]],
    ["*.lowerLipMid", 0.9, [-0.32, -0.02, 0.32]],
    ["labSup", 0.8, [0, 0.02, 0.32]],
    ["labInf", 0.8, [0, -0.02, 0.32]],
  ],
  lipsPart: [
    ["stomionU", 0.8, [0, 0.12, 0]],
    ["*.innerU", 0.7, [0, 0.08, 0]],
    ["stomionL", 0.8, [0, -0.14, 0]],
    ["*.innerL", 0.7, [0, -0.1, 0]],
  ],
  lowerLipTuck: [
    // F/V: the lower lip rolls up and in under the upper teeth
    ["labInf", 0.9, [0, 0.42, -0.42]],
    ["*.lowerLipMid", 0.9, [0, 0.36, -0.38]],
    ["stomionL", 0.8, [0, 0.36, -0.42]],
    ["*.innerL", 0.8, [0, 0.3, -0.36]],
  ],
};

const JAW_PIVOT = [0, -1.0, 0.6];
const JAW_MAX = 21; // degrees at jawOpen = 1

/** Weight of the jaw rotation at a head-space point: 1 on the jaw and lower lip, 0 above the mouth. */
function jawWeight(p, name) {
  if (name) {
    if (
      name === "stomionL" ||
      name.endsWith(".innerL") ||
      name.endsWith(".toothL") ||
      name === "toothL" ||
      name === "tongue"
    )
      return 1;
    if (name === "stomionU" || name.endsWith(".innerU") || name.endsWith(".toothU") || name === "toothU")
      return 0;
    if (name.endsWith(".cheilion")) return 0.5;
  }
  const [x, y, z] = p;
  // the mouth line slopes up toward the ear (the jaw's upper border runs back to the TMJ)
  const line = -6.95 + Math.max(0, Math.abs(x) - 2.6) * 0.55 + Math.max(0, 6 - z) * 0.18;
  const t = clamp((line + 0.25 - y) / 0.9, 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * Build a deformer for a set of AU amounts. Returns def(p, name?) → p'. Lid closure and gaze-driven lid follow
 * are applied to the landmark set only (see deformLandmarks).
 */
export function deformer(aus = {}) {
  const handles = [];
  const base = rigLandmarks();
  for (const [k, amt] of Object.entries(aus)) {
    if (!amt || !AU[k]) continue;
    for (const [anchor, r, d] of AU[k]) {
      const sides = anchor.startsWith("*.") ? ["n", "f"] : [null];
      for (const s of sides) {
        const name = s ? `${s}.${anchor.slice(2)}` : anchor;
        const a = base[name];
        if (!a) continue;
        const sx = s === "f" ? -1 : 1;
        handles.push({ a, r2: r * r, d: [d[0] * sx * amt, d[1] * amt, d[2] * amt], name });
      }
    }
  }
  const jaw = clamp(aus.jawOpen ?? 0, -0.1, 1.2);
  const ang = (jaw * JAW_MAX * Math.PI) / 180;
  const ca = Math.cos(ang),
    sa = Math.sin(ang);
  return (p, name) => {
    let [x, y, z] = p;
    let dx = 0,
      dy = 0,
      dz = 0;
    for (const h of handles) {
      const ex = x - h.a[0],
        ey = y - h.a[1],
        ez = z - h.a[2];
      const q = (ex * ex + ey * ey + ez * ez) / h.r2;
      if (q > 4) continue;
      // a named landmark that is the handle itself takes the full displacement
      const w = name && name === h.name ? 1 : Math.exp(-q * 1.6);
      dx += h.d[0] * w;
      dy += h.d[1] * w;
      dz += h.d[2] * w;
    }
    x += dx;
    y += dy;
    z += dz;
    if (ang) {
      const w = jawWeight([x, y, z], name);
      if (w > 0) {
        const a2 = ang * w;
        const c2 = w === 1 ? ca : Math.cos(a2),
          s2 = w === 1 ? sa : Math.sin(a2);
        const ry = y - JAW_PIVOT[1],
          rz = z - JAW_PIVOT[2];
        // open: the chin swings down and slightly back
        y = JAW_PIVOT[1] + ry * c2 + rz * -s2;
        z = JAW_PIVOT[2] + ry * s2 + rz * c2;
      }
    }
    return [x, y, z];
  };
}

/**
 * The landmark set for a face state: AU field, then the lids (blink/close per eye, raise, follow the gaze's
 * vertical angle), then nothing else. Lids: { n: close 0..1, f: close 0..1 }, gazeY: radians (down negative).
 */
export function deformLandmarks(aus = {}, lids = {}, gazeY = 0) {
  const def = deformer(aus);
  const L = rigLandmarks();
  const out = {};
  for (const [k, v] of Object.entries(L)) out[k] = def(v, k);
  for (const s of ["n", "f"]) {
    const up = ["lidUpIn", "lidUpPeak", "lidUpOut"].map((k) => `${s}.${k}`);
    const low = ["lidLowIn", "lidLowLow", "lidLowOut"].map((k) => `${s}.${k}`);
    // the upper lid follows the eye up and down (it covers the same share of the iris), and AU5 lifts it
    const follow = clamp(gazeY, -0.5, 0.5) * 0.9;
    const raise = (aus.lidUp ?? 0) * 0.16;
    for (const k of up) out[k] = [out[k][0], out[k][1] + follow + raise, out[k][2]];
    for (const k of low) out[k] = [out[k][0], out[k][1] + follow * 0.35, out[k][2]];
    out[`${s}.creasePeak`] = [
      out[`${s}.creasePeak`][0],
      out[`${s}.creasePeak`][1] + follow * 0.4 + raise * 0.6,
      out[`${s}.creasePeak`][2],
    ];
    // closing: the upper lid travels down to a line just above the lower lid (the lower lid rises a touch)
    const c = clamp(lids[s] ?? 0, 0, 1);
    if (c > 0) {
      const target = [out[`${s}.lidLowIn`], out[`${s}.lidLowLow`], out[`${s}.lidLowOut`]];
      up.forEach((k, i) => {
        const tgt = [target[i][0], target[i][1] + 0.04, target[i][2] + 0.12];
        out[k] = [lerp(out[k][0], tgt[0], c), lerp(out[k][1], tgt[1], c), lerp(out[k][2], tgt[2], c)];
      });
      for (const k of low) out[k] = [out[k][0], out[k][1] + c * 0.05, out[k][2]];
      for (const k of ["creaseIn", "creasePeak", "creaseOut"]) {
        const kk = `${s}.${k}`;
        out[kk] = [out[kk][0], out[kk][1] - c * 0.2, out[kk][2]];
      }
    }
  }
  return { L: out, def };
}

// ------------------------------------------------------------------------------------------------ expressions

/**
 * Emotions as whole-face states: AUs, a head posture offset, how the eyes behave and how the body carries it.
 * Values are for intensity 1; the rig scales and blends them.
 */
export const EMOTIONS = {
  neutral: { aus: {}, head: [0, 0, 0], gaze: { contact: 1 }, body: { shoulders: 0, lean: 0 } },
  concentration: {
    aus: { browDown: 0.35, lidTight: 0.35, lipPress: 0.35 },
    head: [0, 2, 0],
    gaze: { contact: 0.4 },
    body: { shoulders: 0.05, lean: 0.4 },
  },
  surprise: {
    aus: { browInnerUp: 0.85, browOuterUp: 0.9, lidUp: 0.85, jawOpen: 0.32, lipsPart: 0.5 },
    head: [0, -4, 0],
    gaze: { contact: 1 },
    body: { shoulders: 0.35, lean: -0.5 },
  },
  worry: {
    aus: {
      browInnerUp: 0.75,
      browDown: 0.35,
      lidTight: 0.15,
      lipPress: 0.4,
      frown: 0.35,
      lipStretch: 0.15,
      chinRaise: 0.2,
    },
    head: [-2, 4, 3],
    gaze: { contact: 0.3, avert: [0.35, -0.25] },
    body: { shoulders: 0.2, lean: 0.2 },
  },
  sadness: {
    aus: { browInnerUp: 0.7, browDown: 0.2, frown: 0.6, chinRaise: 0.35, lidTight: 0.1 },
    lids: 0.32,
    head: [-3, 7, -3],
    gaze: { contact: 0.15, avert: [0.1, -0.45] },
    body: { shoulders: -0.45, lean: 0.35 },
  },
  anger: {
    aus: {
      browDown: 1,
      lidTight: 0.55,
      lidUp: 0.25,
      noseWrinkle: 0.35,
      lipPress: 0.6,
      chinRaise: 0.35,
      upperLipRaise: 0.1,
    },
    head: [2, 3, 0],
    gaze: { contact: 1 },
    body: { shoulders: 0.25, lean: 0.25 },
  },
  joy: {
    aus: {
      smile: 1.15,
      cheekRaise: 0.9,
      lidTight: 0.3,
      browOuterUp: 0.15,
      lipsPart: 0.55,
      upperLipRaise: 0.45,
      jawOpen: 0.1,
    },
    head: [2, -2, 4],
    gaze: { contact: 1 },
    body: { shoulders: 0.05, lean: -0.1 },
  },
  reassure: {
    aus: { smile: 0.7, cheekRaise: 0.45, browInnerUp: 0.35, browOuterUp: 0.1, lidTight: 0.1 },
    head: [3, 1, 5],
    gaze: { contact: 1 },
    body: { shoulders: -0.1, lean: 0.25 },
  },
};

/** Blend AU sets: Σ w_i · aus_i (weights need not sum to 1; intensity scales). */
export function blendAus(parts) {
  const out = {};
  for (const [aus, w] of parts) for (const [k, v] of Object.entries(aus)) out[k] = (out[k] ?? 0) + v * w;
  return out;
}

// ------------------------------------------------------------------------------------------------ speech

/** Mouth shapes (visemes) as AU sets. */
export const VISEMES = {
  sil: {},
  PP: { lipPress: 0.9, chinRaise: 0.15 },
  FF: { lowerLipTuck: 1, jawOpen: 0.08, upperLipRaise: 0.25 },
  TH: { jawOpen: 0.14, lipsPart: 0.6 },
  DD: { jawOpen: 0.16, lipsPart: 0.55, lipStretch: 0.15 },
  kk: { jawOpen: 0.2, lipsPart: 0.5 },
  CH: { pucker: 0.45, lipsPart: 0.7, jawOpen: 0.08, upperLipRaise: 0.25 },
  SS: { lipStretch: 0.35, lipsPart: 0.55, jawOpen: 0.05, upperLipRaise: 0.15 },
  nn: { jawOpen: 0.14, lipsPart: 0.45 },
  RR: { pucker: 0.35, jawOpen: 0.14, lipsPart: 0.4 },
  aa: { jawOpen: 0.62, lipsPart: 0.6, lipStretch: 0.1 },
  E: { jawOpen: 0.36, lipStretch: 0.45, lipsPart: 0.55, upperLipRaise: 0.1 },
  ih: { jawOpen: 0.2, lipStretch: 0.4, smile: 0.12, lipsPart: 0.5 },
  oh: { jawOpen: 0.42, pucker: 0.55, lipsPart: 0.55 },
  ou: { pucker: 0.95, jawOpen: 0.16, lipsPart: 0.35 },
};

/** Phoneme classes → viseme and a relative duration weight. */
const PH = {
  p: ["PP", 0.8],
  b: ["PP", 0.8],
  m: ["PP", 0.9],
  f: ["FF", 1],
  v: ["FF", 0.9],
  th: ["TH", 1],
  dh: ["TH", 0.8],
  t: ["DD", 0.7],
  d: ["DD", 0.7],
  k: ["kk", 0.8],
  g: ["kk", 0.8],
  ng: ["kk", 0.9],
  ch: ["CH", 1.1],
  j: ["CH", 1],
  sh: ["CH", 1.1],
  s: ["SS", 1.1],
  z: ["SS", 1],
  n: ["nn", 0.8],
  l: ["nn", 0.9],
  r: ["RR", 0.9],
  w: ["ou", 0.9],
  y: ["ih", 0.7],
  h: ["kk", 0.6],
  a: ["aa", 1.6],
  ae: ["aa", 1.5],
  ah: ["aa", 1.4],
  ay: ["E", 1.6],
  e: ["E", 1.4],
  i: ["ih", 1.2],
  ee: ["ih", 1.5],
  o: ["oh", 1.5],
  ow: ["oh", 1.7],
  oo: ["ou", 1.5],
  u: ["oh", 1.2],
  er: ["RR", 1.4],
};

/** A small English grapheme-to-phoneme pass: digraphs first, then single letters. Good enough for lip shapes. */
export function phonemes(word) {
  const w = word.toLowerCase().replace(/[^a-z']/g, "");
  const out = [];
  const rules = [
    ["tion", ["sh", "ah", "n"]],
    ["ight", ["ay", "t"]],
    ["ough", ["o"]],
    ["th", ["th"]],
    ["sh", ["sh"]],
    ["ch", ["ch"]],
    ["ph", ["f"]],
    ["wh", ["w"]],
    ["ck", ["k"]],
    ["ng", ["ng"]],
    ["qu", ["k", "w"]],
    ["ee", ["ee"]],
    ["ea", ["ee"]],
    ["oo", ["oo"]],
    ["ou", ["ow"]],
    ["ow", ["ow"]],
    ["ai", ["ay"]],
    ["ay", ["ay"]],
    ["oa", ["o"]],
    ["er", ["er"]],
    ["ir", ["er"]],
    ["ur", ["er"]],
    ["ll", ["l"]],
    ["ss", ["s"]],
    ["tt", ["t"]],
  ];
  const single = { a: "ae", e: "e", i: "i", o: "o", u: "ah", y: "ee", c: "k", x: "k", q: "k" };
  let i = 0;
  while (i < w.length) {
    let hit = false;
    for (const [g, ps] of rules)
      if (w.startsWith(g, i)) {
        out.push(...ps);
        i += g.length;
        hit = true;
        break;
      }
    if (hit) continue;
    const c = w[i];
    if (c === "'") {
      i++;
      continue;
    }
    // a silent final e
    if (c === "e" && i === w.length - 1 && w.length > 2) {
      i++;
      continue;
    }
    const p = single[c] ?? c;
    if (PH[p]) out.push(p);
    i++;
  }
  return out;
}

/**
 * Lip-sync track from timed words ({ text, start, end } seconds — the voice alignment the pipeline already
 * carries). Each phoneme gets a share of its word by weight; visemes ramp in and out with overlap
 * (coarticulation); bilabials (PP) and FF reach their target so the lips really close or tuck.
 */
export function lipTrack(words) {
  const keys = [];
  for (const w of words) {
    const ph = phonemes(w.text);
    if (!ph.length) continue;
    const ws = ph.map((p) => PH[p][1]);
    const tot = ws.reduce((a, b) => a + b, 0);
    let t = w.start;
    const dur = w.end - w.start;
    ph.forEach((p, k) => {
      const d = (dur * ws[k]) / tot;
      keys.push({ v: PH[p][0], t0: t, t1: t + d, strong: PH[p][0] === "PP" || PH[p][0] === "FF" });
      t += d;
    });
  }
  return (t) => {
    const out = {};
    let total = 0;
    for (const k of keys) {
      const ramp = Math.min(0.07, (k.t1 - k.t0) * 0.7);
      if (t < k.t0 - ramp || t > k.t1 + ramp) continue;
      let w;
      if (t < k.t0) w = 1 - (k.t0 - t) / ramp;
      else if (t > k.t1) w = 1 - (t - k.t1) / ramp;
      else w = 1;
      w = w * w * (3 - 2 * w);
      if (k.strong) w = Math.min(1, w * 1.4);
      const vs = VISEMES[k.v];
      for (const [au, v] of Object.entries(vs)) out[au] = Math.max(out[au] ?? 0, v * w);
      total = Math.max(total, w);
    }
    // a little jaw always moves while talking (the voice), even through consonants
    return { aus: out, speaking: total };
  };
}
