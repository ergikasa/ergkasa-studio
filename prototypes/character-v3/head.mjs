/**
 * Character v3 prototype: the head (3/4 view, facing right). Not production code.
 *
 * Construction: an authored head shape and face features (designed paths, not primitives), with every feature
 * driven by named controls (FACS-like action units) so expressions are blends of the same shapes, and the eyes are
 * real eyes: sclera, iris, pupil, highlights, lids that clip the iris, lash line, crease, lower lid.
 *
 * Local space: head centre near (0, 0), crown at y ≈ -150, chin at y ≈ 130; the face looks to +x.
 */

const f = (n) => (Math.round(n * 100) / 100).toString();
const lerp = (a, b, k) => a + (b - a) * k;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const SKIN = {
  base: "#E9B48E",
  shade: "#CF9272",
  deep: "#B87A5C",
  light: "#F6CDAA",
  blush: "#E8907E",
  lip: "#CB8573",
  lipDark: "#AE6553",
};

/** Every control of the face, 0 = rest. Ranges are about -1..1. */
export const FACE_REST = {
  // eyes
  gx: 0, // iris left/right (-1 back, 1 toward the face's front)
  gy: 0, // iris up (-1) / down (1)
  lidUp: 0, // upper lid: 0 open, 1 closed, negative = wide
  squint: 0, // lower lid raised (cheek push, suspicion)
  wide: 0, // eye widened (fear, surprise)
  pupil: 0, // -1 small .. 1 dilated
  // brows
  browIn: 0, // inner brow up (+) / down (-)
  browOut: 0, // outer brow up (+) / down (-)
  knit: 0, // brows pulled together (anger, concentration)
  // mouth and cheeks
  smile: 0, // lip corners up (+) / down (-)
  open: 0, // jaw open 0..1
  wideM: 0, // mouth stretched wide (fear, effort)
  round: 0, // lips rounded (o, u, surprise)
  press: 0, // lips pressed thin (tension, anger, resolve)
  cheek: 0, // cheeks raised (genuine smile)
  sneer: 0, // upper lip raised on one side, nose wrinkle (disgust, contempt)
  // head
  tilt: 0, // roll, degrees
  nod: 0, // pitch, -1 up .. 1 down
  yaw: 0, // -1 more profile .. 1 more frontal (small range)
};

// ------------------------------------------------------------------------------------------------ eyes

/**
 * One eye. (cx, cy) centre; w, h size; `inner` is the side toward the nose (+1: inner corner on the right).
 * `far` eyes are narrower (foreshortened) and lose part of the inner corner behind the nose bridge.
 */
function eye(id, cx, cy, w, h, inner, c, iris, far, lashes = false) {
  const open = clamp(1 - c.lidUp + c.wide * 0.35, 0, 1.45);
  const ix = cx + (inner * w) / 2,
    iy = cy + 2;
  const ox = cx - (inner * w) / 2,
    oy = cy - 2 - c.squint * 2;
  const hL = h * 0.42 * (1 - clamp(c.squint, 0, 1) * 0.55) * (1 + clamp(c.wide, 0, 1) * 0.25);
  // the upper lid: open arc, closing down onto the lower lid line
  const hUopen = h * 0.95 * open;
  const hU = lerp(-hL * 0.55, hUopen, clamp(open, 0, 1.45) / 1.0);
  const u1 = [ix - inner * w * 0.22, iy - hU];
  const u2 = [ox + inner * w * 0.32, oy - hU * 1.08];
  const l1 = [ox + inner * w * 0.3, oy + hL];
  const l2 = [ix - inner * w * 0.28, iy + hL];
  const opening = `M${f(ix)} ${f(iy)} C${f(u1[0])} ${f(u1[1])} ${f(u2[0])} ${f(u2[1])} ${f(ox)} ${f(oy)} C${f(l1[0])} ${f(l1[1])} ${f(l2[0])} ${f(l2[1])} ${f(ix)} ${f(iy)}Z`;
  const upper = `M${f(ix)} ${f(iy)} C${f(u1[0])} ${f(u1[1])} ${f(u2[0])} ${f(u2[1])} ${f(ox)} ${f(oy)}`;
  const lower = `M${f(ox + inner * w * 0.1)} ${f(oy + hL * 0.45)} C${f(l1[0])} ${f(l1[1] + 1)} ${f(l2[0])} ${f(l2[1] + 1)} ${f(ix - inner * 3)} ${f(iy + 2)}`;
  // iris: follows the gaze, stays inside the eye; far eyes see the iris foreshortened
  const r = h * 0.62;
  const irx = cx + c.gx * inner * w * 0.26 + inner * w * 0.04;
  const iry = cy + c.gy * h * 0.22 - h * 0.05;
  const rx = far ? r * 0.82 : r;
  const pr = r * (0.42 + clamp(c.pupil, -1, 1) * 0.12);
  const lidShadowW = Math.max(3, h * 0.55);
  const crease = h * 0.62 + hU * 0.25;
  const closed = open < 0.12;
  const parts = [];
  parts.push(`<clipPath id="${id}-clip"><path d="${opening}"/></clipPath>`);
  if (!closed) {
    parts.push(`<path d="${opening}" fill="#F6F1EA"/>`);
    parts.push(
      `<g clip-path="url(#${id}-clip)">` +
        `<ellipse cx="${f(irx)}" cy="${f(iry)}" rx="${f(rx)}" ry="${f(r)}" fill="url(#iris-${id})"/>` +
        `<ellipse cx="${f(irx)}" cy="${f(iry)}" rx="${f(rx)}" ry="${f(r)}" fill="none" stroke="#2A1B12" stroke-width="${f(r * 0.14)}" opacity=".85"/>` +
        `<ellipse cx="${f(irx + c.gx * 0.6)}" cy="${f(iry)}" rx="${f(far ? pr * 0.82 : pr)}" ry="${f(pr)}" fill="#120C0A"/>` +
        `<circle cx="${f(irx - r * 0.32)}" cy="${f(iry - r * 0.36)}" r="${f(r * 0.2)}" fill="#FFFFFF" opacity=".92"/>` +
        `<circle cx="${f(irx + r * 0.3)}" cy="${f(iry + r * 0.3)}" r="${f(r * 0.09)}" fill="#FFFFFF" opacity=".6"/>` +
        // the lid casts a shadow on the top of the eyeball
        `<path d="${upper}" fill="none" stroke="#7A5040" stroke-opacity=".28" stroke-width="${f(lidShadowW)}"/>` +
        `</g>`,
    );
  }
  // the upper lid skin above the opening (moves down when the lid closes)
  parts.push(
    `<path d="${upper} C${f(ox + inner * w * 0.2)} ${f(oy - crease)} ${f(ix - inner * w * 0.25)} ${f(iy - crease - 2)} ${f(ix)} ${f(iy)}Z" fill="#DFA985"/>`,
  );
  // crease of the upper lid
  parts.push(
    `<path d="M${f(ix - inner * 2)} ${f(iy - 4)} C${f(ix - inner * w * 0.3)} ${f(iy - crease - 4)} ${f(ox + inner * w * 0.25)} ${f(oy - crease - 2)} ${f(ox - inner * 3)} ${f(oy - 1)}" fill="none" stroke="${SKIN.deep}" stroke-width="2.2" stroke-linecap="round" opacity="${f(clamp(0.75 - c.lidUp * 0.6, 0.15, 0.8))}"/>`,
  );
  // lash line, thick at the outer corner, with a small flick
  parts.push(
    `<path d="${upper}" fill="none" stroke="#24170F" stroke-width="${f(far ? 3 : lashes ? 4.4 : 3.6)}" stroke-linecap="round"/>`,
    lashes
      ? `<path d="M${f(ox + inner * 4)} ${f(oy - 1)} q${f(-inner * 7)} -2 ${f(-inner * 11)} -7" fill="none" stroke="#24170F" stroke-width="${f(far ? 2.6 : 3.4)}" stroke-linecap="round"/>`
      : "",
  );
  // lower lid and the soft fold under the eye
  if (!closed)
    parts.push(
      `<path d="${lower}" fill="none" stroke="${SKIN.deep}" stroke-width="1.8" stroke-linecap="round" opacity=".8"/>`,
      `<path d="M${f(ox + inner * w * 0.15)} ${f(oy + hL + 8)} Q${f(cx)} ${f(cy + hL + 14 - c.squint * 6)} ${f(ix - inner * 6)} ${f(iy + hL + 6)}" fill="none" stroke="${SKIN.shade}" stroke-width="2" stroke-linecap="round" opacity="${f(0.35 + clamp(c.squint, 0, 1) * 0.4)}"/>`,
    );
  return parts.join("");
}

/** A brow: a tapered shape from the inner end (thick) to the outer end (thin). */
function brow(cxIn, cyIn, cxOut, cyOut, inner, c, hair, far) {
  const inY = cyIn - c.browIn * 11 + clamp(c.knit, 0, 1) * 4;
  const inX = cxIn + inner * clamp(c.knit, 0, 1) * 5;
  const outY = cyOut - c.browOut * 9 - c.browIn * 2;
  // the arch: higher when the brow is raised, flatter and lower when knit or angry
  const pkX = lerp(inX, cxOut, 0.58);
  const pkY = lerp(inY, outY, 0.5) - 8 - c.browOut * 3 + clamp(c.knit, 0, 1) * 4 - clamp(c.browIn, 0, 1) * 4;
  const t0 = far ? 6 : 8,
    t1 = far ? 4.5 : 6;
  const d =
    `M${f(inX)} ${f(inY + t0 / 2)} Q${f(inX - inner * 4)} ${f(inY - t0 / 2)} ${f(inX - inner * 8)} ${f(inY - t0 / 2 - 1)}` +
    ` Q${f(pkX + inner * 8)} ${f(pkY - t1)} ${f(pkX)} ${f(pkY - t1 / 2)}` +
    ` Q${f(lerp(pkX, cxOut, 0.6))} ${f(lerp(pkY, outY, 0.4) - 2)} ${f(cxOut)} ${f(outY)}` +
    ` Q${f(lerp(pkX, cxOut, 0.5))} ${f(lerp(pkY, outY, 0.5) + 3)} ${f(pkX)} ${f(pkY + t1 / 2)}` +
    ` Q${f(pkX + inner * 10)} ${f(pkY + 2)} ${f(inX)} ${f(inY + t0 / 2)}Z`;
  return `<path d="${d}" fill="${hair}"/>`;
}

// ------------------------------------------------------------------------------------------------ mouth

function mouth(c, jaw) {
  const s = clamp(c.smile, -1, 1);
  const o = clamp(c.open, 0, 1);
  const wd = clamp(c.wideM, -1, 1);
  const rd = clamp(c.round, 0, 1);
  const pr = clamp(c.press, 0, 1);
  // corners: the near one (left) is further from the centre (3/4)
  const cxm = 62 + c.yaw * 4;
  const halfN = 27 + wd * 7 - rd * 9 + Math.max(0, s) * 4;
  const halfF = 18 + wd * 4 - rd * 6 + Math.max(0, s) * 2;
  const y0 = 80;
  const cy = (k) => y0 - s * 8 * k + (s < 0 ? -s * 2 : 0);
  const L = [cxm - halfN, cy(1)];
  const R = [cxm + halfF, cy(0.8)];
  const gap = o * 26 + rd * o * 4;
  const upT = 5.5 * (1 - pr * 0.6) + rd * 2; // upper lip thickness
  const loT = 8.5 * (1 - pr * 0.55) + rd * 3; // lower lip thickness
  const sneer = clamp(c.sneer, 0, 1) * 5;
  // the mouth line (where the lips meet) and its curvature
  const midY = y0 + 1 + s * 4 - pr * 1;
  const upperIn = `M${f(L[0])} ${f(L[1])} C${f(L[0] + 12)} ${f(midY - 1 - gap * 0.35 - sneer)} ${f(R[0] - 12)} ${f(midY - 1 - gap * 0.35)} ${f(R[0])} ${f(R[1])}`;
  const lowerIn = `M${f(R[0])} ${f(R[1])} C${f(R[0] - 10)} ${f(midY + gap)} ${f(L[0] + 10)} ${f(midY + gap + 1)} ${f(L[0])} ${f(L[1])}`;
  const bowX = cxm + 2;
  const upperOut =
    `M${f(L[0] - 1)} ${f(L[1])} C${f(L[0] + 8)} ${f(L[1] - upT * 0.6)} ${f(bowX - 12)} ${f(midY - upT - 2 - sneer)} ${f(bowX - 5)} ${f(midY - upT - 1.5 - sneer)}` +
    ` Q${f(bowX)} ${f(midY - upT + 1.5)} ${f(bowX + 5)} ${f(midY - upT - 1.5)}` +
    ` C${f(bowX + 10)} ${f(midY - upT - 1)} ${f(R[0] - 6)} ${f(R[1] - upT * 0.5)} ${f(R[0] + 1)} ${f(R[1])}`;
  const lowerOut = `C${f(R[0] - 8)} ${f(midY + gap + loT * 1.1)} ${f(L[0] + 12)} ${f(midY + gap + loT * 1.2)} ${f(L[0] - 1)} ${f(L[1])}`;
  const parts = [];
  // the inside of the mouth, teeth and tongue
  if (gap > 2) {
    const inside = `${upperIn} ${lowerIn.replace(/^M[^C]+/, "")}Z`;
    parts.push(`<clipPath id="mouth-in"><path d="${inside}"/></clipPath>`);
    parts.push(`<path d="${inside}" fill="#4A1C20"/>`);
    parts.push(
      `<g clip-path="url(#mouth-in)">` +
        `<rect x="${f(L[0])}" y="${f(midY - 4 - gap * 0.35)}" width="${f(R[0] - L[0])}" height="${f(Math.min(9, gap * 0.45 + 3))}" fill="#F3EEE6"/>` +
        `<ellipse cx="${f(cxm - 2)}" cy="${f(midY + gap + 6)}" rx="${f(halfN * 0.75)}" ry="${f(8 + gap * 0.15)}" fill="#B65A5C"/>` +
        `</g>`,
    );
  }
  // lips: upper lip darker (it faces down, away from the light), lower lip lighter with a highlight
  // build the upper lip as a closed shape: outer contour L->R, then the inner line back R->L
  const upperInRev = `C${f(R[0] - 12)} ${f(midY - 1 - gap * 0.35)} ${f(L[0] + 12)} ${f(midY - 1 - gap * 0.35 - sneer)} ${f(L[0] - 1)} ${f(L[1])}`;
  parts.push(`<path d="${upperOut} ${upperInRev}Z" fill="${SKIN.lipDark}"/>`);
  const lowerInRev = `M${f(L[0] - 1)} ${f(L[1])} C${f(L[0] + 10)} ${f(midY + gap + 1)} ${f(R[0] - 10)} ${f(midY + gap)} ${f(R[0] + 1)} ${f(R[1])}`;
  parts.push(`<path d="${lowerInRev} ${lowerOut}Z" fill="${SKIN.lip}"/>`);
  parts.push(
    `<path d="M${f(cxm - 12)} ${f(midY + gap + loT * 0.55)} Q${f(cxm)} ${f(midY + gap + loT * 0.35)} ${f(cxm + 8)} ${f(midY + gap + loT * 0.55)}" fill="none" stroke="#F2B3A3" stroke-width="2.4" stroke-linecap="round" opacity=".7"/>`,
  );
  // the line where the lips meet, darker at the corners
  parts.push(`<path d="${upperIn}" fill="none" stroke="#5E2A28" stroke-width="2.2" stroke-linecap="round"/>`);
  // corner dimples / creases: deeper with a smile or tension
  const k = clamp(Math.abs(s) * 0.8 + pr * 0.5, 0, 1);
  parts.push(
    `<path d="M${f(L[0] - 2)} ${f(L[1] - 4)} q-4 4 -1 ${f(8 + s * 2)}" fill="none" stroke="${SKIN.deep}" stroke-width="2" stroke-linecap="round" opacity="${f(0.2 + k * 0.6)}"/>`,
  );
  // shadow under the lower lip and the chin
  parts.push(
    `<path d="M${f(cxm - 18)} ${f(midY + gap + loT + 8)} Q${f(cxm)} ${f(midY + gap + loT + 3)} ${f(cxm + 14)} ${f(midY + gap + loT + 7)}" fill="none" stroke="${SKIN.shade}" stroke-width="4" stroke-linecap="round" opacity=".35"/>`,
  );
  void jaw;
  return parts.join("");
}

// ------------------------------------------------------------------------------------------------ head

/**
 * The head, with hair. `look` = { hair, hairLight, iris, irisDark, skin? }.
 * Returns { svg, defs } where defs holds gradients the eyes use.
 */
export function head(controls = {}, look = {}) {
  const c = { ...FACE_REST, ...controls };
  const L = {
    hair: "#2F241E",
    hairLight: "#4C3A30",
    iris: "#7A5432",
    irisDark: "#3E2715",
    ...look,
  };
  const jaw = clamp(c.open, 0, 1) * 14;
  const yawX = c.yaw * 6; // features slide toward the front when the head turns toward the viewer
  const nodY = c.nod * 6;
  const fx = (x) => x + yawX * (x > 0 ? 1 : 0.4);
  const fy = (y) => y + nodY;

  const defs =
    `<radialGradient id="iris-eyeN" cx="50%" cy="45%" r="55%"><stop offset="0" stop-color="${L.iris}" stop-opacity=".55"/><stop offset=".35" stop-color="${L.iris}"/><stop offset="1" stop-color="${L.irisDark}"/></radialGradient>` +
    `<radialGradient id="iris-eyeF" cx="50%" cy="45%" r="55%"><stop offset="0" stop-color="${L.iris}" stop-opacity=".55"/><stop offset=".35" stop-color="${L.iris}"/><stop offset="1" stop-color="${L.irisDark}"/></radialGradient>` +
    `<radialGradient id="cheek-glow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="${SKIN.blush}" stop-opacity=".55"/><stop offset="1" stop-color="${SKIN.blush}" stop-opacity="0"/></radialGradient>` +
    `<linearGradient id="hair-shine" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${L.hairLight}"/><stop offset="1" stop-color="${L.hair}"/></linearGradient>`;

  // the skull and face silhouette (3/4), the jaw drops with the mouth
  const outline =
    `M-6 -150 C52 -152 94 -120 101 -72 C104 -50 99 -36 103 -24 C108 -10 99 4 97 18 ` +
    `C98 40 ${f(94)} ${f(66 + jaw * 0.5)} ${f(86)} ${f(92 + jaw)} C78 ${f(112 + jaw)} 66 ${f(126 + jaw)} 48 ${f(131 + jaw)} ` +
    `C26 ${f(134 + jaw)} -2 ${f(122 + jaw * 0.7)} -24 ${f(105 + jaw * 0.5)} C-44 92 -58 72 -63 48 ` +
    `C-80 40 -104 8 -107 -40 C-110 -100 -66 -148 -6 -150Z`;

  const parts = [];
  // hair behind the head (the nape), under the face
  parts.push(`<path d="M-60 -40 C-80 -30 -100 0 -96 44 C-88 52 -76 50 -66 40 Z" fill="${L.hair}"/>`);
  // neck shadow under the jaw is drawn by the body; the face
  parts.push(`<path d="${outline}" fill="${SKIN.base}"/>`);
  parts.push(`<clipPath id="face-clip"><path d="${outline}"/></clipPath>`);
  // modelling: shadow on the far plane of the face and under the jaw, soft light on the near cheek and forehead
  parts.push(
    `<g clip-path="url(#face-clip)">` +
      `<path d="M78 -120 C108 -80 104 -30 106 0 C108 40 98 80 70 ${f(120 + jaw)} L120 ${f(150 + jaw)} L120 -150Z" fill="${SKIN.shade}" opacity=".55"/>` +
      `<path d="M-70 40 C-40 90 0 ${f(118 + jaw)} 40 ${f(130 + jaw)} L40 ${f(160 + jaw)} L-90 ${f(160 + jaw)}Z" fill="${SKIN.shade}" opacity=".45"/>` +
      `<ellipse cx="34" cy="-66" rx="40" ry="14" fill="${SKIN.light}" opacity=".18"/>` +
      `<ellipse cx="${f(fx(-8))}" cy="${f(fy(36))}" rx="34" ry="24" fill="url(#cheek-glow)" opacity="${f(0.55 + clamp(c.cheek, 0, 1) * 0.4)}"/>` +
      `<ellipse cx="${f(fx(14))}" cy="${f(fy(22 - c.cheek * 6))}" rx="20" ry="8" fill="${SKIN.light}" opacity="${f(0.25 + clamp(c.cheek, 0, 1) * 0.35)}"/>` +
      // the side of the nose, in shade
      `<path d="M${f(fx(56))} ${f(fy(18))} C${f(fx(60))} ${f(fy(28))} ${f(fx(63))} ${f(fy(36))} ${f(fx(67))} ${f(fy(43))} L${f(fx(60))} ${f(fy(45))} C${f(fx(56))} ${f(fy(36))} ${f(fx(52))} ${f(fy(28))} ${f(fx(50))} ${f(fy(20))}Z" fill="${SKIN.shade}" opacity=".22"/>` +
      // eye sockets: a soft shadow under the brow ridge
      `<ellipse cx="${f(fx(6))}" cy="${f(fy(-16))}" rx="30" ry="15" fill="${SKIN.shade}" opacity=".32"/>` +
      `<ellipse cx="${f(fx(74))}" cy="${f(fy(-18))}" rx="18" ry="13" fill="${SKIN.shade}" opacity=".35"/>` +
      `</g>`,
  );
  // eyes (near and far), brows
  parts.push(eye("eyeN", fx(6), fy(-6), 46, 15, 1, c, L.iris, false, L.lashes));
  parts.push(eye("eyeF", fx(76), fy(-8), 28, 13.5, 1, c, L.iris, true, L.lashes));
  parts.push(brow(fx(34), fy(-35), fx(-26), fy(-34), 1, c, L.hair, false));
  parts.push(brow(fx(64), fy(-37), fx(94), fy(-33), -1, { ...c, knit: c.knit * 0.7 }, L.hair, true));
  // forehead lines (surprise, worry) and the frown line between the brows (anger, concentration)
  const lift = clamp(c.browIn, 0, 1);
  if (lift > 0.25)
    parts.push(
      `<path d="M${f(fx(-10))} ${f(fy(-70))} Q${f(fx(30))} ${f(fy(-76 - lift * 3))} ${f(fx(78))} ${f(fy(-70))}" fill="none" stroke="${SKIN.deep}" stroke-width="2" stroke-linecap="round" opacity="${f((lift - 0.25) * 0.8)}"/>`,
      `<path d="M${f(fx(0))} ${f(fy(-58))} Q${f(fx(32))} ${f(fy(-64 - lift * 2))} ${f(fx(70))} ${f(fy(-58))}" fill="none" stroke="${SKIN.deep}" stroke-width="1.8" stroke-linecap="round" opacity="${f((lift - 0.25) * 0.6)}"/>`,
    );
  const kn = clamp(c.knit, 0, 1);
  if (kn > 0.2)
    parts.push(
      `<path d="M${f(fx(48))} ${f(fy(-44))} q2 8 0 15" fill="none" stroke="${SKIN.deep}" stroke-width="2.2" stroke-linecap="round" opacity="${f(kn * 0.8)}"/>`,
      `<path d="M${f(fx(55))} ${f(fy(-42))} q1 6 0 11" fill="none" stroke="${SKIN.deep}" stroke-width="1.8" stroke-linecap="round" opacity="${f(kn * 0.6)}"/>`,
    );
  // nose: bridge, the near wing and nostril, the tip catching light, a shadow underneath
  const nx = (x) => fx(x) + c.yaw * 3;
  const sn = clamp(c.sneer, 0, 1) * 3;
  parts.push(
    `<path d="M${f(nx(74))} ${f(fy(8))} C${f(nx(82))} ${f(fy(20))} ${f(nx(90))} ${f(fy(28))} ${f(nx(97))} ${f(fy(36 - sn))} C${f(nx(103))} ${f(fy(42 - sn))} ${f(nx(98))} ${f(fy(52 - sn))} ${f(nx(88))} ${f(fy(51 - sn))}" fill="none" stroke="${SKIN.deep}" stroke-width="2.4" stroke-linecap="round" opacity=".75"/>`,
    `<path d="M${f(nx(88))} ${f(fy(51 - sn))} C${f(nx(82))} ${f(fy(56 - sn))} ${f(nx(72))} ${f(fy(55 - sn))} ${f(nx(68))} ${f(fy(48 - sn))} C${f(nx(62))} ${f(fy(42 - sn))} ${f(nx(68))} ${f(fy(33 - sn))} ${f(nx(76))} ${f(fy(36 - sn))}" fill="${SKIN.base}" stroke="${SKIN.deep}" stroke-width="2.4" stroke-linecap="round"/>`,
    `<path d="M${f(nx(78))} ${f(fy(51 - sn))} q4 2 8 -1" fill="none" stroke="#7A4434" stroke-width="3.4" stroke-linecap="round"/>`,
    `<ellipse cx="${f(nx(92))}" cy="${f(fy(39 - sn))}" rx="5" ry="3.5" fill="${SKIN.light}" opacity=".8"/>`,
    `<path d="M${f(nx(70))} ${f(fy(58 - sn))} Q${f(nx(84))} ${f(fy(63 - sn))} ${f(nx(96))} ${f(fy(56 - sn))}" fill="none" stroke="${SKIN.shade}" stroke-width="4" stroke-linecap="round" opacity=".5"/>`,
  );
  // nasolabial fold: from the nose wing toward the mouth corner, deeper with a smile
  const fold = clamp(c.smile, 0, 1) * 0.7 + clamp(c.cheek, 0, 1) * 0.3 + clamp(c.sneer, 0, 1) * 0.6;
  parts.push(
    `<path d="M${f(nx(64))} ${f(fy(48))} C${f(nx(48))} ${f(fy(58))} ${f(fx(38))} ${f(fy(70 - c.smile * 4))} ${f(fx(34 - c.smile * 2))} ${f(fy(82 - c.smile * 6))}" fill="none" stroke="${SKIN.deep}" stroke-width="2.2" stroke-linecap="round" opacity="${f(0.18 + fold * 0.55)}"/>`,
  );
  // mouth, moved with the nod and the jaw
  parts.push(`<g transform="translate(${f(yawX)} ${f(nodY + jaw * 0.4)})">${mouth(c, jaw)}</g>`);
  // the chin: a soft light on its front plane (no crease line)
  parts.push(
    `<ellipse cx="${f(fx(52))}" cy="${f(118 + jaw)}" rx="12" ry="6" fill="${SKIN.light}" opacity=".35"/>`,
  );
  // hair: one designed mass (hairline, temple, sideburn, around the ear, nape), then texture
  parts.push(
    `<path d="M98 -86 C106 -124 78 -164 26 -172 C-34 -180 -98 -150 -114 -90 C-124 -40 -112 12 -92 48 C-84 42 -76 30 -70 18 C-68 0 -62 -22 -56 -30 C-50 -36 -44 -36 -40 -30 L-37 -4 C-33 -6 -31 -22 -29 -50 C-25 -76 -10 -92 20 -98 C48 -104 72 -100 98 -86Z" fill="url(#hair-shine)"/>`,
    // the hairline is soft: a few short locks over the forehead
    `<path d="M20 -98 C30 -92 40 -90 52 -94 C46 -100 34 -102 20 -98Z" fill="${L.hair}"/>`,
    `<path d="M70 -98 C80 -92 90 -90 98 -86 C94 -96 84 -100 70 -98Z" fill="${L.hair}"/>`,
    // locks and shine following the growth from the crown
    `<path d="M-60 -150 C-20 -168 40 -164 84 -132" fill="none" stroke="${L.hairLight}" stroke-width="6" stroke-linecap="round" opacity=".85"/>`,
    `<path d="M-74 -132 C-36 -150 14 -150 56 -126" fill="none" stroke="#6E584A" stroke-width="3" stroke-linecap="round" opacity=".6"/>`,
    `<path d="M-90 -96 C-70 -120 -40 -130 -8 -128" fill="none" stroke="${L.hairLight}" stroke-width="3" stroke-linecap="round" opacity=".6"/>`,
    `<path d="M-100 -40 C-96 -70 -84 -92 -64 -104" fill="none" stroke="#1E1612" stroke-width="3" stroke-linecap="round" opacity=".5"/>`,
    `<path d="M10 -112 C30 -124 56 -124 78 -110" fill="none" stroke="#1E1612" stroke-width="2.6" stroke-linecap="round" opacity=".45"/>`,
  );
  // ear (near side)
  parts.push(
    `<path d="M-46 -22 C-66 -30 -76 -6 -70 14 C-66 30 -56 40 -44 38 C-40 26 -42 -6 -46 -22Z" fill="${SKIN.base}" stroke="${SKIN.shade}" stroke-width="2"/>`,
    `<path d="M-50 -12 C-62 -12 -64 6 -60 18 C-58 24 -52 26 -50 22" fill="none" stroke="${SKIN.deep}" stroke-width="2.4" stroke-linecap="round"/>`,
  );
  const tilt = c.tilt;
  const svg = `<g transform="rotate(${f(tilt)} -10 120)">${parts.join("")}</g>`;
  return { svg, defs };
}

/** Expressions as control sets (FACS-like action units). */
export const EXPRESSIONS = {
  neutral: {},
  joy: { smile: 0.9, cheek: 0.8, squint: 0.45, open: 0.18, browOut: 0.15 },
  sadness: {
    browIn: 0.95,
    browOut: -0.45,
    smile: -0.65,
    lidUp: 0.35,
    gy: 0.45,
    cheek: -0.2,
    tilt: -4,
    nod: 0.6,
  },
  worry: { browIn: 0.75, knit: 0.45, smile: -0.25, press: 0.35, lidUp: 0.08, gx: -0.4, gy: 0.25 },
  fear: {
    browIn: 0.95,
    browOut: 0.55,
    knit: 0.35,
    wide: 0.9,
    lidUp: -0.15,
    open: 0.32,
    wideM: 0.7,
    smile: -0.2,
    pupil: 0.6,
  },
  anger: {
    browIn: -0.95,
    browOut: 0.15,
    knit: 1,
    lidUp: 0.28,
    squint: 0.35,
    press: 0.7,
    smile: -0.35,
    sneer: 0.2,
    pupil: -0.4,
  },
  surprise: { browIn: 1, browOut: 1, wide: 1, lidUp: -0.2, open: 0.55, round: 0.65, pupil: 0.3 },
  convince: { browIn: -0.25, browOut: 0.2, knit: 0.3, smile: 0.2, press: 0.25, lidUp: 0.08, tilt: 2 },
  reassure: { smile: 0.5, cheek: 0.35, browIn: 0.35, lidUp: 0.18, tilt: 5, nod: 0.3 },
  thinking: {
    browIn: 0.2,
    browOut: -0.15,
    knit: 0.35,
    gx: -0.6,
    gy: -0.6,
    smile: -0.05,
    press: 0.2,
    tilt: -3,
  },
};
